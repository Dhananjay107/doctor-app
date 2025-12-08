import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Share, SafeAreaView, Dimensions, TextInput, Modal } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppSelector } from "../store/hooks";
import Toast from "react-native-toast-message";
import { getPatientName, formatFriendlyDate } from "../utils/helpers";
import { LinearGradient } from "expo-linear-gradient";
import { MedicalTheme } from "../constants/theme";
import { RootStackParamList } from "../utils/navigation";
import MedicineIcon from "../components/icons/MedicineIcon";
import DocumentIcon from "../components/icons/DocumentIcon";
import CheckIcon from "../components/icons/CheckIcon";

const SCREEN_WIDTH = Dimensions.get("window").width;

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface Prescription {
  _id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  pharmacyId?: string;
  items: PrescriptionItem[];
  notes?: string;
  createdAt: string;
  finalizedAt?: string;
  patientName?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface RouteParams {
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  age?: number;
  issue?: string;
}

export default function EPrescriptionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = (route.params as RouteParams) || {};
  const { user, token } = useAppSelector((state: any) => state.auth);
  
  // Viewing mode state
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"Active" | "History" | "Reports">("Active");
  
  // Creating mode state
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [doctorPrescription, setDoctorPrescription] = useState("");
  const [currentMedicine, setCurrentMedicine] = useState<PrescriptionItem>({
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
    notes: "",
  });
  const [medicines, setMedicines] = useState<PrescriptionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const doctorId = user?.id ? String(user.id) : null;

  // Check if we're in creating mode
  useEffect(() => {
    if (params.appointmentId && params.patientId) {
      setIsCreatingMode(true);
      setStep(1);
    } else {
      setIsCreatingMode(false);
    }
  }, [params]);

  const fetchPrescriptions = useCallback(async () => {
    if (!doctorId || !token) {
      console.log("❌ Missing doctorId or token:", { doctorId, hasToken: !!token });
      return;
    }

    try {
      setLoading(true);
      const headers: any = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };
      
      const url = `${API_BASE}/api/prescriptions?doctorId=${doctorId}`;
      console.log("🔍 Fetching prescriptions from:", url);
      console.log("👤 Doctor ID:", doctorId);
      
      const presRes = await fetch(url, { headers });
      console.log("📡 Response status:", presRes.status, presRes.statusText);

      if (presRes.ok) {
        const data = await presRes.json();
        const presList = Array.isArray(data) ? data : [];
        console.log(`✅ Fetched ${presList.length} prescriptions`);
        
        const prescriptionsWithNames = await Promise.all(
          presList.map(async (pres: Prescription) => {
            try {
              const patientName = await getPatientName(pres.patientId, token);
              return { ...pres, patientName };
            } catch (e) {
              return { ...pres, patientName: `Patient ${pres.patientId.slice(-8)}` };
            }
          })
        );
        
        prescriptionsWithNames.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        console.log(`📋 Setting ${prescriptionsWithNames.length} prescriptions to state`);
        setPrescriptions(prescriptionsWithNames);
      } else {
        const errorData = await presRes.json().catch(() => ({}));
        console.error("❌ API Error:", errorData);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: errorData.message || "Failed to load prescriptions",
        });
      }
    } catch (e: any) {
      console.error("❌ Failed to fetch prescriptions:", e);
      console.error("Error details:", {
        message: e.message,
        stack: e.stack,
        doctorId,
        apiBase: API_BASE
      });
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to load prescriptions",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [doctorId, token]);

  useEffect(() => {
    if (!isCreatingMode && doctorId && token) {
      fetchPrescriptions();
    }
  }, [isCreatingMode, doctorId, token, fetchPrescriptions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  // Filter prescriptions based on active tab
  const getFilteredPrescriptions = useCallback(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (activeTab) {
      case "Active":
        // Show prescriptions from the last 30 days
        return prescriptions.filter((pres) => {
          const createdDate = new Date(pres.createdAt);
          return createdDate >= thirtyDaysAgo;
        });
      case "History":
        // Show prescriptions older than 30 days
        return prescriptions.filter((pres) => {
          const createdDate = new Date(pres.createdAt);
          return createdDate < thirtyDaysAgo;
        });
      case "Reports":
        // Show all prescriptions
        return prescriptions;
      default:
        return prescriptions;
    }
  }, [prescriptions, activeTab]);

  const downloadPrescription = async (prescription: Prescription) => {
    try {
      const prescriptionText = `
════════════════════════════════════════
           PRESCRIPTION
════════════════════════════════════════

Prescription ID: ${prescription._id.slice(-8)}
Date: ${formatFriendlyDate(prescription.createdAt)}
Patient: ${prescription.patientName || "Patient"}

════════════════════════════════════════
              MEDICINES
════════════════════════════════════════

${prescription.items.map((item, idx) => `
${idx + 1}. ${item.medicineName}
   Dosage: ${item.dosage}
   Frequency: ${item.frequency}
   Duration: ${item.duration}
   ${item.notes ? `Notes: ${item.notes}` : ""}
`).join("\n")}

${prescription.notes ? `\n════════════════════════════════════════\nDoctor's Notes:\n${prescription.notes}\n════════════════════════════════════════` : ""}

Generated on: ${new Date().toLocaleString()}
════════════════════════════════════════
      `.trim();

      await Share.share({
        message: prescriptionText,
        title: `Prescription #${prescription._id.slice(-8)}`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to download prescription",
      });
    }
  };

  // Creating mode handlers
  const handleNextToMedicines = useCallback(() => {
    if (!doctorPrescription.trim()) {
      Toast.show({
        type: "error",
        text1: "Prescription Required",
        text2: "Please write your prescription before proceeding",
        visibilityTime: 3000,
      });
      return;
    }
    setStep(2);
  }, [doctorPrescription]);

  const handleAddMedicine = useCallback(() => {
    if (!currentMedicine.medicineName || !currentMedicine.dosage || !currentMedicine.frequency || !currentMedicine.duration) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please fill all required medicine fields",
        visibilityTime: 3000,
      });
      return;
    }
    setMedicines([...medicines, { ...currentMedicine }]);
    setCurrentMedicine({
      medicineName: "",
      dosage: "",
      frequency: "",
      duration: "",
      notes: "",
    });
    Toast.show({
      type: "success",
      text1: "Medicine Added",
      text2: `${currentMedicine.medicineName} added to list`,
      visibilityTime: 2000,
    });
  }, [currentMedicine, medicines]);

  const handleRemoveMedicine = useCallback((index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  }, [medicines]);

  const handleProcess = useCallback(async () => {
    if (medicines.length === 0) {
      Toast.show({
        type: "error",
        text1: "No Medicines",
        text2: "Please add at least one medicine",
        visibilityTime: 3000,
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (!token || !user?.id || !params.appointmentId || !params.patientId) {
        throw new Error("Authentication or appointment data required");
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      const prescriptionData = {
        appointmentId: params.appointmentId,
        doctorId: user.id,
        patientId: params.patientId,
        items: medicines,
        notes: doctorPrescription,
      };
      
      console.log("📝 Creating prescription with data:", {
        doctorId: user.id,
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        itemCount: medicines.length
      });

      const prescriptionRes = await fetch(`${API_BASE}/api/prescriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify(prescriptionData),
      });

      if (!prescriptionRes.ok) {
        const errorData = await prescriptionRes.json().catch(() => ({}));
        console.error("❌ Failed to create prescription:", errorData);
        throw new Error(errorData.message || "Failed to create prescription");
      }
      
      const createdPrescription = await prescriptionRes.json();
      console.log("✅ Prescription created successfully:", {
        prescriptionId: createdPrescription._id,
        doctorId: createdPrescription.doctorId
      });

      const appointmentRes = await fetch(`${API_BASE}/api/appointments/${params.appointmentId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!appointmentRes.ok) {
        // Appointment status update failed, but prescription was created successfully
      }

      setShowThankYou(true);
    } catch (e: any) {
      console.error("Failed to process prescription", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to process prescription",
        visibilityTime: 4000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [medicines, doctorPrescription, params, token, user?.id]);

  const handleThankYouClose = useCallback(() => {
    setShowThankYou(false);
    setIsCreatingMode(false);
    setStep(1);
    setDoctorPrescription("");
    setMedicines([]);
    setCurrentMedicine({
      medicineName: "",
      dosage: "",
      frequency: "",
      duration: "",
      notes: "",
    });
    // Navigate back and refresh prescriptions
    navigation.goBack();
    // Refresh prescriptions immediately and after a delay to ensure it's updated
    setTimeout(() => {
      console.log("🔄 Refreshing prescriptions after creation...");
      fetchPrescriptions();
    }, 300);
    setTimeout(() => {
      console.log("🔄 Second refresh to ensure data is synced...");
      fetchPrescriptions();
    }, 1500);
  }, [navigation, fetchPrescriptions]);


  // Creating mode render
  if (isCreatingMode) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Patient Info Card */}
          <View style={styles.patientCard}>
            <View style={styles.patientCardHeader}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>{(params.patientName || "P").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{params.patientName || "Patient"}</Text>
                {params.age && <Text style={styles.patientDetails}>Age: {params.age} years</Text>}
              </View>
            </View>
            {params.issue && (
              <View style={styles.issueContainer}>
                <Text style={styles.issueLabel}>Issue:</Text>
                <Text style={styles.issueText}>{params.issue}</Text>
              </View>
            )}
          </View>

          {/* Step 1: Doctor's Prescription */}
          {step === 1 && (
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Doctor's Prescription</Text>
                <Text style={styles.requiredBadge}>* Required</Text>
              </View>
              <Text style={styles.stepDescription}>
                Write your prescription, diagnosis, recommendations, and any notes for the patient
              </Text>
              <TextInput
                style={styles.prescriptionInput}
                placeholder="Enter prescription details...\n\nExample:\n• Diagnosis: Common cold\n• Recommendations: Rest, plenty of fluids\n• Follow-up: Return if symptoms persist"
                placeholderTextColor="#94a3b8"
                value={doctorPrescription}
                onChangeText={setDoctorPrescription}
                multiline
                numberOfLines={12}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.primaryButton, !doctorPrescription.trim() && styles.primaryButtonDisabled]}
                onPress={handleNextToMedicines}
                disabled={!doctorPrescription.trim()}
              >
                <LinearGradient
                  colors={!doctorPrescription.trim() ? ["#cbd5e1", "#94a3b8"] : MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>Continue to Medicines →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Medicine Form */}
          {step === 2 && (
            <>
              {doctorPrescription && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryTitleRow}>
                    <DocumentIcon width={18} height={18} color={MedicalTheme.colors.medicalBlue} />
                    <Text style={[styles.summaryTitle, { marginLeft: 8 }]}>Prescription Summary</Text>
                  </View>
                  <Text style={styles.summaryText} numberOfLines={3}>{doctorPrescription}</Text>
                </View>
              )}

              <View style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>Add Medicines</Text>
                  <Text style={styles.medicineCount}>{medicines.length} added</Text>
                </View>
                <Text style={styles.stepDescription}>
                  Add medicines with dosage, frequency, and duration
                </Text>

                <View style={styles.medicineForm}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>
                      Medicine Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Paracetamol 500mg"
                      placeholderTextColor="#94a3b8"
                      value={currentMedicine.medicineName}
                      onChangeText={(text) => setCurrentMedicine({ ...currentMedicine, medicineName: text })}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, styles.formGroupHalf]}>
                      <Text style={styles.label}>
                        Dosage <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., 500mg"
                        placeholderTextColor="#94a3b8"
                        value={currentMedicine.dosage}
                        onChangeText={(text) => setCurrentMedicine({ ...currentMedicine, dosage: text })}
                      />
                    </View>
                    <View style={[styles.formGroup, styles.formGroupHalf, { marginLeft: 12 }]}>
                      <Text style={styles.label}>
                        Frequency <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., 2x daily"
                        placeholderTextColor="#94a3b8"
                        value={currentMedicine.frequency}
                        onChangeText={(text) => setCurrentMedicine({ ...currentMedicine, frequency: text })}
                      />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, styles.formGroupHalf]}>
                      <Text style={styles.label}>
                        Duration <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., 7 days"
                        placeholderTextColor="#94a3b8"
                        value={currentMedicine.duration}
                        onChangeText={(text) => setCurrentMedicine({ ...currentMedicine, duration: text })}
                      />
                    </View>
                    <View style={[styles.formGroup, styles.formGroupHalf, { marginLeft: 12 }]}>
                      <Text style={styles.label}>Notes (Optional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Additional notes..."
                        placeholderTextColor="#94a3b8"
                        value={currentMedicine.notes}
                        onChangeText={(text) => setCurrentMedicine({ ...currentMedicine, notes: text })}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.addButton, (!currentMedicine.medicineName || !currentMedicine.dosage || !currentMedicine.frequency || !currentMedicine.duration) && styles.addButtonDisabled]}
                    onPress={handleAddMedicine}
                    disabled={!currentMedicine.medicineName || !currentMedicine.dosage || !currentMedicine.frequency || !currentMedicine.duration}
                  >
                    <LinearGradient
                      colors={(!currentMedicine.medicineName || !currentMedicine.dosage || !currentMedicine.frequency || !currentMedicine.duration) ? ["#cbd5e1", "#94a3b8"] : ["#10b981", "#059669"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.addButtonGradient}
                    >
                      <Text style={styles.addButtonText}>+ Add Medicine</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {medicines.length > 0 && (
                <View style={styles.medicinesListCard}>
                  <View style={styles.medicinesListTitleRow}>
                    <MedicineIcon width={20} height={20} color={MedicalTheme.colors.medicalBlue} />
                    <Text style={[styles.medicinesListTitle, { marginLeft: 8 }]}>
                      Added Medicines ({medicines.length})
                    </Text>
                  </View>
                  {medicines.map((medicine, index) => (
                    <View key={index} style={styles.medicineCard}>
                      <View style={styles.medicineCardHeader}>
                        <View style={styles.medicineNumber}>
                          <Text style={styles.medicineNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.medicineInfo}>
                          <Text style={styles.medicineNameForm}>{medicine.medicineName}</Text>
                          <View style={styles.medicineDetailsForm}>
                            <Text style={styles.medicineDetail}>{medicine.dosage}</Text>
                            <Text style={styles.medicineSeparator}>•</Text>
                            <Text style={styles.medicineDetail}>{medicine.frequency}</Text>
                            <Text style={styles.medicineSeparator}>•</Text>
                            <Text style={styles.medicineDetail}>{medicine.duration}</Text>
                          </View>
                          {medicine.notes && (
                            <Text style={styles.medicineNotes}>Note: {medicine.notes}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveMedicine(index)}
                          style={styles.removeButton}
                        >
                          <Text style={styles.removeButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.processButton, (isProcessing || medicines.length === 0) && styles.processButtonDisabled]}
                onPress={handleProcess}
                disabled={isProcessing || medicines.length === 0}
              >
                <LinearGradient
                  colors={(isProcessing || medicines.length === 0) ? ["#cbd5e1", "#94a3b8"] : ["#22c55e", "#16a34a"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.processButtonGradient}
                >
                  {isProcessing ? (
                    <View style={styles.processButtonContent}>
                      <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.processButtonText}>Processing...</Text>
                    </View>
                  ) : (
                    <View style={styles.processButtonContent}>
                      <CheckIcon width={20} height={20} color="#ffffff" />
                      <Text style={styles.processButtonText}>Process & Send</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Thank You Modal */}
        <Modal visible={showThankYou} transparent animationType="fade" onRequestClose={handleThankYouClose}>
          <View style={styles.thankYouOverlay}>
            <View style={styles.thankYouContent}>
              <View style={styles.thankYouIconContainer}>
                <LinearGradient
                  colors={["#d1fae5", "#a7f3d0"]}
                  style={styles.thankYouIconGradient}
                >
                  <CheckIcon width={56} height={56} color="#059669" />
                </LinearGradient>
              </View>
              <Text style={styles.thankYouTitle}>Success!</Text>
              <Text style={styles.thankYouMessage}>
                Prescription has been sent successfully to the patient and admin panel.
              </Text>
              <TouchableOpacity style={styles.thankYouButton} onPress={handleThankYouClose}>
                <LinearGradient
                  colors={MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.thankYouButtonGradient}
                >
                  <Text style={styles.thankYouButtonText}>Go to Homepage</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Viewing mode render
  if (loading && prescriptions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MedicalTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading prescriptions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredPrescriptions = getFilteredPrescriptions();

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "Active" && styles.tabButtonActive]}
          onPress={() => setActiveTab("Active")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === "Active" && styles.tabIconActive]}>📊</Text>
          <Text style={[styles.tabText, activeTab === "Active" && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, { marginLeft: 8 }, activeTab === "History" && styles.tabButtonActive]}
          onPress={() => setActiveTab("History")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === "History" && styles.tabIconActive]}>📷</Text>
          <Text style={[styles.tabText, activeTab === "History" && styles.tabTextActive]}>History</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, { marginLeft: 8 }, activeTab === "Reports" && styles.tabButtonActive]}
          onPress={() => setActiveTab("Reports")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === "Reports" && styles.tabIconActive]}>📷</Text>
          <Text style={[styles.tabText, activeTab === "Reports" && styles.tabTextActive]}>Reports</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MedicalTheme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredPrescriptions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Prescriptions Yet</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "Active" && "No active prescriptions in the last 30 days"}
              {activeTab === "History" && "No older prescriptions found"}
              {activeTab === "Reports" && "Prescriptions you create will appear here"}
            </Text>
          </View>
        ) : (
          filteredPrescriptions.map((prescription) => (
            <View key={prescription._id} style={styles.prescriptionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.headerIndicator} />
                  <Text style={styles.cardHeaderTitle}>PRESCRIPTION</Text>
                </View>
                <TouchableOpacity
                  onPress={() => downloadPrescription(prescription)}
                  style={styles.downloadButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.downloadIcon}>⬇</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📅</Text>
                <Text style={styles.detailText}>Issued: {formatFriendlyDate(prescription.createdAt)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>👤</Text>
                <Text style={styles.detailText}>{prescription.patientName || `Patient ${prescription.patientId.slice(-8)}`}</Text>
              </View>

              <View style={styles.separator} />

              {prescription.items.map((item, idx) => (
                <View key={idx} style={styles.medicineCard}>
                  <View style={styles.medicineHeader}>
                    <View style={styles.medicineNumberBadge}>
                      <Text style={styles.medicineNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.medicineName} numberOfLines={2} ellipsizeMode="tail">
                      {item.medicineName}
                    </Text>
                  </View>
                  <View style={styles.medicineInfoContainer}>
                    <View style={styles.medicineInfoItem}>
                      <Text style={styles.medicineInfoLabel}>Dosage:</Text>
                      <Text style={styles.medicineInfoValue}>{item.dosage}</Text>
                    </View>
                    <View style={styles.medicineInfoItem}>
                      <Text style={styles.medicineInfoLabel}>Frequency:</Text>
                      <Text style={styles.medicineInfoValue}>{item.frequency}</Text>
                    </View>
                    <View style={styles.medicineInfoItem}>
                      <Text style={styles.medicineInfoLabel}>Duration:</Text>
                      <Text style={styles.medicineInfoValue}>{item.duration}</Text>
                    </View>
                  </View>
                  {item.notes && (
                    <View style={styles.medicineNotesContainer}>
                      <Text style={styles.medicineNotesLabel}>Note:</Text>
                      <Text style={styles.medicineNotes}>{item.notes}</Text>
                    </View>
                  )}
                </View>
              ))}

              {prescription.notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Doctor's Notes:</Text>
                  <Text style={styles.notesText}>{prescription.notes}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SCREEN_WIDTH < 375 ? 12 : 16,
    paddingBottom: 24,
  },
  // Viewing mode styles
  prescriptionCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: SCREEN_WIDTH < 375 ? 18 : 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIndicator: {
    width: 4,
    height: 20,
    backgroundColor: MedicalTheme.colors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  cardHeaderTitle: {
    fontSize: SCREEN_WIDTH < 375 ? 14 : 15,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    letterSpacing: 0.5,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MedicalTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadIcon: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  detailText: {
    fontSize: SCREEN_WIDTH < 375 ? 14 : 15,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "500",
  },
  separator: {
    height: 1,
    backgroundColor: MedicalTheme.colors.borderDark,
    marginVertical: 16,
  },
  medicineCard: {
    backgroundColor: MedicalTheme.colors.dark.background,
    borderRadius: 12,
    padding: SCREEN_WIDTH < 375 ? 14 : 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: MedicalTheme.colors.primary,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  medicineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  medicineNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MedicalTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  medicineNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  medicineName: {
    flex: 1,
    fontSize: SCREEN_WIDTH < 375 ? 16 : 17,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    lineHeight: 22,
  },
  medicineInfoContainer: {
    marginTop: 4,
  },
  medicineInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  medicineInfoLabel: {
    fontSize: SCREEN_WIDTH < 375 ? 13 : 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    width: 80,
    marginRight: 8,
  },
  medicineInfoValue: {
    flex: 1,
    fontSize: SCREEN_WIDTH < 375 ? 14 : 15,
    fontWeight: "500",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  medicineNotesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
  },
  medicineNotesLabel: {
    fontSize: SCREEN_WIDTH < 375 ? 12 : 13,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 4,
  },
  medicineNotes: {
    fontSize: SCREEN_WIDTH < 375 ? 13 : 14,
    color: MedicalTheme.colors.dark.textPrimary,
    lineHeight: 18,
    fontStyle: "italic",
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
  },
  notesLabel: {
    fontSize: SCREEN_WIDTH < 375 ? 12 : 13,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: SCREEN_WIDTH < 375 ? 13 : 14,
    color: MedicalTheme.colors.dark.textPrimary,
    lineHeight: 20,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: SCREEN_WIDTH < 375 ? 18 : 20,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: SCREEN_WIDTH < 375 ? 13 : 14,
    color: MedicalTheme.colors.dark.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  // Creating mode styles
  patientCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  patientCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  patientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  patientAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 20,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  issueContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
  },
  issueLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  issueText: {
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    lineHeight: 22,
  },
  stepCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ef4444",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  medicineCount: {
    fontSize: 14,
    fontWeight: "700",
    color: MedicalTheme.colors.medicalBlue,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepDescription: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  prescriptionInput: {
    backgroundColor: MedicalTheme.colors.dark.background,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    minHeight: 220,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: MedicalTheme.colors.medicalBlue,
  },
  summaryText: {
    fontSize: 13,
    color: "#0c4a6e",
    lineHeight: 20,
  },
  medicineForm: {
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: "row",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: MedicalTheme.colors.dark.background,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    minHeight: 50,
  },
  addButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  medicinesListCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  medicinesListTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  medicinesListTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  medicineCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  medicineNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  medicineNumberText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  medicineInfo: {
    flex: 1,
  },
  medicineNameForm: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  medicineDetailsForm: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  medicineDetail: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  medicineSeparator: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    marginHorizontal: 6,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  removeButtonText: {
    color: "#dc2626",
    fontSize: 18,
    fontWeight: "700",
  },
  processButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  processButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  processButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 8,
  },
  thankYouOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  thankYouContent: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  thankYouIconContainer: {
    marginBottom: 20,
  },
  thankYouIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  thankYouTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 12,
  },
  thankYouMessage: {
    fontSize: 15,
    color: MedicalTheme.colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  thankYouButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  thankYouButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  thankYouButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  // Tab Bar styles
  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingHorizontal: SCREEN_WIDTH < 375 ? 12 : 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: "#2a429a",
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
    color: "#2a429a",
  },
  tabIconActive: {
    color: "#ffffff",
  },
  tabText: {
    fontSize: SCREEN_WIDTH < 375 ? 12 : 13,
    fontWeight: "600",
    color: "#2a429a",
  },
  tabTextActive: {
    color: "#ffffff",
  },
});
