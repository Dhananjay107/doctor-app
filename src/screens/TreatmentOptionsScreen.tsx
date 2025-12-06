import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useAppSelector } from "../store/hooks";
import Toast from "react-native-toast-message";
import { MedicalTheme } from "../constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

type TreatmentOptionsRouteParams = {
  TreatmentOptions: {
    appointmentId: string;
    patientId: string;
    appointmentReason?: string;
    scheduledAt?: string;
    diagnosis?: string;
  };
};

type TreatmentOptionsRouteProp = RouteProp<TreatmentOptionsRouteParams, "TreatmentOptions">;

interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export default function TreatmentOptionsScreen() {
  const route = useRoute<TreatmentOptionsRouteProp>();
  const navigation = useNavigation();
  const { user, token } = useAppSelector((state: any) => state.auth);
  const { appointmentId, patientId, diagnosis } = route.params || {};

  const [selectedOption, setSelectedOption] = useState<"changeMedicine" | "requestReports" | null>(null);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [currentPrescriptionItem, setCurrentPrescriptionItem] = useState<PrescriptionItem>({
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
    notes: "",
  });
  const [reportRequest, setReportRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const doctorId = user?.id || null;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleOptionSelect = useCallback((option: "changeMedicine" | "requestReports") => {
    setSelectedOption(option);
  }, []);

  const handleAddPrescriptionItem = useCallback(() => {
    if (!currentPrescriptionItem.medicineName || !currentPrescriptionItem.dosage || 
        !currentPrescriptionItem.frequency || !currentPrescriptionItem.duration) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please fill all required fields",
        visibilityTime: 3000,
      });
      return;
    }

    setPrescriptionItems([...prescriptionItems, { ...currentPrescriptionItem }]);
    setCurrentPrescriptionItem({
      medicineName: "",
      dosage: "",
      frequency: "",
      duration: "",
      notes: "",
    });
  }, [currentPrescriptionItem]);

  const handleRemovePrescriptionItem = useCallback((index: number) => {
    setPrescriptionItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitPrescription = useCallback(async () => {
    if (prescriptionItems.length === 0) {
      Toast.show({
        type: "error",
        text1: "No Medicines Added",
        text2: "Please add at least one medicine",
        visibilityTime: 3000,
      });
      return;
    }

    if (!appointmentId || !patientId || !doctorId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Appointment information is missing",
        visibilityTime: 3000,
      });
      return;
    }

    setSubmitting(true);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/prescriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId,
          doctorId,
          patientId,
          items: prescriptionItems,
        }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Prescription Submitted",
          text2: "Prescription has been sent to pharmacy successfully",
          visibilityTime: 3000,
        });
        
        timeoutRef.current = setTimeout(() => {
          navigation.getParent()?.goBack();
          (navigation as any).navigate("Doctor");
        }, 1000);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || "Failed to submit prescription",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      console.error("Failed to submit prescription", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to submit prescription",
        visibilityTime: 3000,
      });
    } finally {
      setSubmitting(false);
    }
  }, [prescriptionItems, appointmentId, patientId, doctorId, token, navigation]);

  const handleSubmitReportRequest = useCallback(async () => {
    if (!reportRequest.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please specify which reports are needed",
        visibilityTime: 3000,
      });
      return;
    }

    if (!patientId || !doctorId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Patient or doctor information is missing",
        visibilityTime: 3000,
      });
      return;
    }

    setSubmitting(true);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Parse report request to extract report type and description
      const reportLines = reportRequest.trim().split("\n");
      const reportType = reportLines[0] || "Lab Test Report";
      const description = reportLines.length > 1 
        ? reportLines.slice(1).join("\n") 
        : reportRequest.trim();

      const res = await fetch(`${API_BASE}/api/report-requests`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          patientId,
          reportType,
          description,
        }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Report Request Sent",
          text2: "Patient will be notified to provide the requested reports",
          visibilityTime: 3000,
        });
        
        timeoutRef.current = setTimeout(() => {
          navigation.getParent()?.goBack();
          (navigation as any).navigate("Doctor");
        }, 1000);
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || "Failed to submit report request",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      console.error("Failed to submit report request", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to submit report request",
        visibilityTime: 3000,
      });
    } finally {
      setSubmitting(false);
    }
  }, [reportRequest, patientId, doctorId, token, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Treatment Options</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {diagnosis && (
          <View style={styles.diagnosisCard}>
            <Text style={styles.diagnosisLabel}>Current Diagnosis:</Text>
            <Text style={styles.diagnosisText}>{diagnosis}</Text>
          </View>
        )}

        {!selectedOption ? (
          <View style={styles.optionsContainer}>
            <Text style={styles.sectionTitle}>Select Treatment Option</Text>
            <Text style={styles.sectionSubtitle}>Choose how you want to proceed with this patient</Text>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleOptionSelect("changeMedicine")}
              activeOpacity={0.7}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionIconText}>💊</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Change Medicine</Text>
                <Text style={styles.optionDescription}>
                  Prescribe new or modified medications for the patient
                </Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => handleOptionSelect("requestReports")}
              activeOpacity={0.7}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionIconText}>📋</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Request Reports Only</Text>
                <Text style={styles.optionDescription}>
                  Request lab tests or diagnostic reports from the patient
                </Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>
          </View>
        ) : selectedOption === "changeMedicine" ? (
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={() => setSelectedOption(null)} style={styles.backToOptions}>
                <Text style={styles.backToOptionsText}>← Back to Options</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>💊 Change Medicine</Text>
            </View>

            <ScrollView style={styles.formScroll}>
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Medicine Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., Paracetamol 500mg"
                  placeholderTextColor="#94A3B8"
                  value={currentPrescriptionItem.medicineName}
                  onChangeText={(text) => setCurrentPrescriptionItem({ ...currentPrescriptionItem, medicineName: text })}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>Dosage *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., 500mg"
                    placeholderTextColor="#94A3B8"
                    value={currentPrescriptionItem.dosage}
                    onChangeText={(text) => setCurrentPrescriptionItem({ ...currentPrescriptionItem, dosage: text })}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>Frequency *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., 2x daily"
                    placeholderTextColor="#94A3B8"
                    value={currentPrescriptionItem.frequency}
                    onChangeText={(text) => setCurrentPrescriptionItem({ ...currentPrescriptionItem, frequency: text })}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>Duration *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g., 7 days"
                    placeholderTextColor="#94A3B8"
                    value={currentPrescriptionItem.duration}
                    onChangeText={(text) => setCurrentPrescriptionItem({ ...currentPrescriptionItem, duration: text })}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Additional notes..."
                    placeholderTextColor="#94A3B8"
                    value={currentPrescriptionItem.notes}
                    onChangeText={(text) => setCurrentPrescriptionItem({ ...currentPrescriptionItem, notes: text })}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.addItemButton}
                onPress={handleAddPrescriptionItem}
              >
                <Text style={styles.addItemButtonText}>+ Add Medicine</Text>
              </TouchableOpacity>

              {prescriptionItems.length > 0 && (
                <View style={styles.itemsListSection}>
                  <Text style={styles.itemsListTitle}>Prescription Items ({prescriptionItems.length})</Text>
                  {prescriptionItems.map((item, index) => (
                    <View key={index} style={styles.prescriptionItemCard}>
                      <View style={styles.prescriptionItemHeader}>
                        <Text style={styles.prescriptionItemNumber}>{index + 1}.</Text>
                        <TouchableOpacity
                          onPress={() => handleRemovePrescriptionItem(index)}
                          style={styles.removeItemButton}
                        >
                          <Text style={styles.removeItemButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.prescriptionItemName}>{item.medicineName}</Text>
                      <Text style={styles.prescriptionItemDetail}>
                        Dosage: {item.dosage} | Frequency: {item.frequency} | Duration: {item.duration}
                      </Text>
                      {item.notes && (
                        <Text style={styles.prescriptionItemNotes}>Notes: {item.notes}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, prescriptionItems.length === 0 && styles.submitButtonDisabled]}
                onPress={handleSubmitPrescription}
                disabled={prescriptionItems.length === 0 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={MedicalTheme.colors.textInverse} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Prescription</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={() => setSelectedOption(null)} style={styles.backToOptions}>
                <Text style={styles.backToOptionsText}>← Back to Options</Text>
              </TouchableOpacity>
              <Text style={styles.formTitle}>📋 Request Reports</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Specify Required Reports *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="e.g., Blood test, X-Ray, ECG, etc."
                placeholderTextColor="#94A3B8"
                value={reportRequest}
                onChangeText={setReportRequest}
                multiline
                numberOfLines={5}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (!reportRequest.trim() || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmitReportRequest}
              disabled={!reportRequest.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={MedicalTheme.colors.textInverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report Request</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.background,
  },
  header: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    paddingTop: MedicalTheme.spacing["3xl"],
    paddingBottom: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...MedicalTheme.shadows.lg,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
  },
  headerTitle: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.lg,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  diagnosisCard: {
    backgroundColor: "#E0F2FE",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#0066CC",
  },
  diagnosisLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0066CC",
    marginBottom: 8,
  },
  diagnosisText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  optionsContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  optionIconText: {
    fontSize: 28,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  optionArrow: {
    fontSize: 24,
    color: "#0066CC",
    marginLeft: 12,
  },
  formContainer: {
    flex: 1,
  },
  formHeader: {
    marginBottom: 20,
  },
  backToOptions: {
    marginBottom: 12,
  },
  backToOptionsText: {
    color: "#0066CC",
    fontSize: 14,
    fontWeight: "600",
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  formScroll: {
    flex: 1,
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1E293B",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  formCol: {
    flex: 1,
  },
  addItemButton: {
    backgroundColor: "#0066CC",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  addItemButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  itemsListSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  itemsListTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },
  prescriptionItemCard: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#0066CC",
  },
  prescriptionItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  prescriptionItemNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0066CC",
  },
  removeItemButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  removeItemButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  prescriptionItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  prescriptionItemDetail: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
  },
  prescriptionItemNotes: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  submitButton: {
    backgroundColor: "#059669",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#94A3B8",
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

