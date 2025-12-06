import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppSelector } from "../store/hooks";
import Toast from "react-native-toast-message";
import { LinearGradient } from "expo-linear-gradient";
import { MedicalTheme } from "../constants/theme";
import MedicineIcon from "../components/icons/MedicineIcon";
import DocumentIcon from "../components/icons/DocumentIcon";
import CheckIcon from "../components/icons/CheckIcon";
import UserIcon from "../components/icons/UserIcon";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface PrescriptionFlowScreenProps {
  route: {
    params: {
      appointmentId: string;
      patientId: string;
      patientName: string;
      age: number;
      issue: string;
    };
  };
}

export default function PrescriptionFlowScreen({ route }: PrescriptionFlowScreenProps) {
  const navigation = useNavigation();
  const { user, token } = useAppSelector((state) => state.auth);
  const { appointmentId, patientId, patientName, age, issue } = route.params;

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
      if (!token || !user?.id) {
        throw new Error("Authentication required");
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      // Create prescription
      const prescriptionRes = await fetch(`${API_BASE}/api/prescriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId,
          doctorId: user.id,
          patientId,
          items: medicines,
          notes: doctorPrescription,
        }),
      });

      if (!prescriptionRes.ok) {
        const errorData = await prescriptionRes.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create prescription");
      }

      // Update appointment status to COMPLETED
      const appointmentRes = await fetch(`${API_BASE}/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!appointmentRes.ok) {
        console.warn("Failed to update appointment status");
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
  }, [medicines, doctorPrescription, appointmentId, patientId, token, user?.id]);

  const handleThankYouClose = useCallback(() => {
    setShowThankYou(false);
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (step === 2) {
      setStep(1);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <LinearGradient
        colors={MedicalTheme.colors.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Create Prescription" : "Add Medicines"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {step === 1 ? "Write your prescription" : "Add medicines for patient"}
          </Text>
        </View>
      </LinearGradient>

      {/* Step Indicator */}
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, step >= 1 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepCircle, step >= 2 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
          </View>
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>Prescription</Text>
          <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>Medicines</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Patient Info Card - Enhanced */}
        <View style={styles.patientCard}>
          <View style={styles.patientCardHeader}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>{patientName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.patientDetails}>Age: {age} years</Text>
            </View>
          </View>
          <View style={styles.issueContainer}>
            <Text style={styles.issueLabel}>Issue:</Text>
            <Text style={styles.issueText}>{issue}</Text>
          </View>
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
              placeholder="Enter prescription details...&#10;&#10;Example:&#10;• Diagnosis: Common cold&#10;• Recommendations: Rest, plenty of fluids&#10;• Follow-up: Return if symptoms persist"
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
            {/* Prescription Summary */}
            {doctorPrescription && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryTitleRow}>
                  <DocumentIcon width={18} height={18} color={MedicalTheme.colors.medicalBlue} />
                  <Text style={styles.summaryTitle}>Prescription Summary</Text>
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
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
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
                  <View style={[styles.formGroup, styles.formGroupHalf]}>
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

            {/* Medicines List */}
            {medicines.length > 0 && (
              <View style={styles.medicinesListCard}>
                <View style={styles.medicinesListTitleRow}>
                  <MedicineIcon width={20} height={20} color={MedicalTheme.colors.medicalBlue} />
                  <Text style={styles.medicinesListTitle}>
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
                        <Text style={styles.medicineName}>{medicine.medicineName}</Text>
                        <View style={styles.medicineDetails}>
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

            {/* Process Button */}
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

      {/* Thank You Modal - Enhanced */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "700",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#E0F2F7",
    fontWeight: "500",
  },
  stepIndicatorContainer: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: MedicalTheme.colors.borderDark,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MedicalTheme.colors.dark.background,
    borderWidth: 2,
    borderColor: MedicalTheme.colors.borderDark,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderColor: MedicalTheme.colors.medicalBlue,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  stepNumberActive: {
    color: "#ffffff",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: MedicalTheme.colors.borderDark,
    marginHorizontal: 12,
  },
  stepLineActive: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  stepLabel: {
    fontSize: 12,
    color: MedicalTheme.colors.dark.textSecondary,
    fontWeight: "500",
  },
  stepLabelActive: {
    color: MedicalTheme.colors.medicalBlue,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
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
    gap: 8,
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
    gap: 12,
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
    gap: 8,
  },
  medicinesListTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  medicineCard: {
    backgroundColor: MedicalTheme.colors.dark.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
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
  medicineName: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  medicineDetails: {
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
  medicineNotes: {
    fontSize: 12,
    color: MedicalTheme.colors.dark.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
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
});
