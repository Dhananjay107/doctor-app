import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { useAppSelector } from "../store/hooks";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../utils/navigation";
import Toast from "react-native-toast-message";
import { getPatientName, formatFriendlyDate } from "../utils/helpers";
import { MedicalTheme } from "../constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface PatientRecord {
  _id?: string;
  patientId: string;
  diagnosis?: string[];
  allergies?: string[];
  currentMedications?: string[];
  pastSurgeries?: string[];
  hospitalizationHistory?: Array<{
    date: string;
    reason: string;
    duration?: string;
  }>;
  labReports?: Array<{
    date: string;
    testName: string;
    results: string;
  }>;
  notes?: string;
}

interface RecentPatient {
  patientId: string;
  patientName: string;
  lastAppointmentDate: string;
  appointmentCount: number;
  latestIssue?: string;
  appointmentId?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PatientRecordsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, token } = useAppSelector((state: any) => state.auth);
  const [patientId, setPatientId] = useState("");
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [newDiagnosis, setNewDiagnosis] = useState("");
  const [newAllergy, setNewAllergy] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const doctorId = user?.id || null;
  const doctorName = user?.name || "Doctor";
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id && token && user.role === "DOCTOR") {
      fetchRecentPatients(user.id, token);
      }
  }, [user?.id, token]);

  const fetchRecentPatients = useCallback(async (docId: string, authToken: string) => {
    try {
      setLoadingPatients(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      // Fetch doctor's appointments
      const res = await fetch(`${API_BASE}/api/appointments?doctorId=${docId}`, { headers });
      if (res.ok) {
        const appointments = await res.json();
        const appointmentsArray = Array.isArray(appointments) ? appointments : [];

        // Filter out cancelled appointments - only show active appointments (PENDING, CONFIRMED)
        const activeAppointments = appointmentsArray.filter((apt: any) => 
          apt.status !== "CANCELLED" && apt.status !== "COMPLETED"
        );

        // Get unique patient IDs with latest appointment date and issue (only from active appointments)
        const patientMap = new Map<string, { lastDate: string; count: number; latestIssue?: string; appointmentId?: string }>();
        activeAppointments.forEach((apt: any) => {
          const pid = apt.patientId;
          const aptDate = apt.scheduledAt || apt.createdAt;
          
          if (!patientMap.has(pid)) {
            patientMap.set(pid, { 
              lastDate: aptDate, 
              count: 1,
              latestIssue: apt.reason,
              appointmentId: apt._id,
            });
          } else {
            const existing = patientMap.get(pid)!;
            if (new Date(aptDate) > new Date(existing.lastDate)) {
              existing.lastDate = aptDate;
              existing.latestIssue = apt.reason;
              existing.appointmentId = apt._id;
            }
            existing.count += 1;
          }
        });

        // Fetch patient names
        const patientsList: RecentPatient[] = [];
        for (const [pid, data] of patientMap.entries()) {
          const patientName = await getPatientName(pid, authToken);
          patientsList.push({
            patientId: pid,
            patientName,
            lastAppointmentDate: data.lastDate,
            appointmentCount: data.count,
            latestIssue: data.latestIssue,
            appointmentId: data.appointmentId,
          });
        }

        // Sort by most recent appointment
        patientsList.sort((a, b) => 
          new Date(b.lastAppointmentDate).getTime() - new Date(a.lastAppointmentDate).getTime()
        );

        setRecentPatients(patientsList.slice(0, 20)); // Show top 20
      }
    } catch (e) {
      console.error("Failed to fetch recent patients", e);
    } finally {
      setLoadingPatients(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (doctorId && token) {
      await fetchRecentPatients(doctorId, token);
    }
  }, [doctorId, token, fetchRecentPatients]);

  const handleSelectPatient = useCallback(async (pid: string) => {
    setPatientId(pid);
    await fetchRecord(pid);
  }, []);

  const fetchRecord = useCallback(async (pid?: string) => {
    const targetId = pid || patientId;
    if (!targetId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select a patient or enter Patient ID",
        visibilityTime: 3000,
      });
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/patient-records/${targetId}`, { headers });
      
      if (res.ok) {
        const data = await res.json();
        setRecord(data);
        setNotes(data.notes || "");
        setPatientId(targetId);
        
        Toast.show({
          type: "success",
          text1: "Record Loaded",
          text2: "Patient medical record loaded successfully",
          visibilityTime: 2000,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Record Not Found",
          text2: errorData.message || errorData.error || "Patient record not found",
          visibilityTime: 4000,
        });
        setRecord(null);
      }
    } catch (e: any) {
      console.error("Failed to fetch patient record", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to fetch patient record. Please check your connection.",
        visibilityTime: 4000,
      });
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, token]);

  const addDiagnosis = useCallback(async () => {
    if (!newDiagnosis || !patientId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter diagnosis text",
        visibilityTime: 3000,
      });
      return;
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/patient-records/${patientId}/diagnosis`, {
        method: "POST",
        headers,
        body: JSON.stringify({ diagnosis: newDiagnosis }),
      });
      
      if (res.ok) {
        await fetchRecord();
        setNewDiagnosis("");
        Toast.show({
          type: "success",
          text1: "Diagnosis Added",
          text2: "New diagnosis has been added successfully",
          visibilityTime: 2000,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || errorData.error || "Failed to add diagnosis",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      console.error("Failed to add diagnosis", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to add diagnosis. Please check your connection.",
        visibilityTime: 3000,
      });
    }
  }, [newDiagnosis, patientId, token, fetchRecord]);

  const addAllergy = useCallback(async () => {
    if (!newAllergy || !patientId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter allergy information",
        visibilityTime: 3000,
      });
      return;
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/patient-records/${patientId}/allergies`, {
        method: "POST",
        headers,
        body: JSON.stringify({ allergy: newAllergy }),
      });
      
      if (res.ok) {
        await fetchRecord();
        setNewAllergy("");
        Toast.show({
          type: "success",
          text1: "Allergy Added",
          text2: "New allergy has been added successfully",
          visibilityTime: 2000,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || errorData.error || "Failed to add allergy",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      console.error("Failed to add allergy", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to add allergy. Please check your connection.",
        visibilityTime: 3000,
      });
    }
  }, [newAllergy, patientId, token, fetchRecord]);

  const updateNotes = useCallback(async () => {
    if (!patientId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select a patient first",
        visibilityTime: 3000,
      });
      return;
    }
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/patient-records/${patientId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ notes }),
      });
      
      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Notes Updated",
          text2: "Clinical notes have been saved successfully",
          visibilityTime: 2000,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || errorData.error || "Failed to update notes",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      console.error("Failed to update notes", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to update notes. Please check your connection.",
        visibilityTime: 3000,
      });
    }
  }, [patientId, token, notes]);

  const handleViewPatientIssues = useCallback((patient: RecentPatient) => {
    // Just view patient record
    handleSelectPatient(patient.patientId);
  }, [handleSelectPatient]);

  return (
    <View style={styles.container}>

      {!record ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MedicalTheme.colors.medicalBlue} />}
        >
          {/* Patients with Issues List */}
          <View style={styles.govCard}>
              <Text style={styles.govSectionTitle}>👥 PATIENTS & ISSUES</Text>
              <Text style={styles.govSectionSubtitle}>Click on a patient to view their issues and problems</Text>

            {loadingPatients ? (
              <View style={styles.govLoadingContainer}>
                <ActivityIndicator size="large" color={MedicalTheme.colors.medicalBlue} />
                <Text style={styles.govLoadingText}>Loading patients...</Text>
              </View>
              ) : recentPatients.length > 0 ? (
                recentPatients.map((patient) => (
                <TouchableOpacity
                  key={patient.patientId}
                  style={styles.govPatientCard}
                    onPress={() => handleViewPatientIssues(patient)}
                    activeOpacity={0.7}
                >
                  <View style={styles.govPatientInfo}>
                    <Text style={styles.govPatientName}>👤 {patient.patientName}</Text>
                    <Text style={styles.govPatientDetail}>
                      📅 Last visit: {formatFriendlyDate(patient.lastAppointmentDate)}
                    </Text>
                      {patient.latestIssue && (
                        <View style={styles.issueContainer}>
                          <Text style={styles.issueLabel}>🔍 Issue:</Text>
                          <Text style={styles.issueText} numberOfLines={2}>
                            {patient.latestIssue}
                          </Text>
                        </View>
                      )}
                      {!patient.latestIssue && (
                    <Text style={styles.govPatientDetail}>
                      📋 Total appointments: {patient.appointmentCount}
                    </Text>
                      )}
                  </View>
                  <Text style={styles.govPatientArrow}>→</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.govEmptyContainer}>
                  <Text style={styles.govEmptyText}>No patients with active appointments</Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <View style={styles.govBackContainer}>
            <TouchableOpacity
              style={styles.govBackButton}
              onPress={() => {
                setRecord(null);
                setPatientId("");
              }}
            >
              <Text style={styles.govBackButtonText}>← BACK TO PATIENTS</Text>
            </TouchableOpacity>
          </View>

          {/* Patient Info Header */}
          <View style={styles.govCard}>
            <Text style={styles.govPatientHeader}>
              👤 {record.patientId ? recentPatients.find(p => p.patientId === record.patientId)?.patientName || `Patient ${record.patientId.slice(-8)}` : "Patient Record"}
            </Text>
            <Text style={styles.govPatientId}>ID: {record.patientId}</Text>
          </View>

          {/* Diagnosis Section */}
          <View style={styles.govCard}>
            <Text style={styles.govSectionTitle}>🩺 DIAGNOSIS</Text>
            {record.diagnosis && record.diagnosis.length > 0 ? (
              record.diagnosis.map((d, i) => (
                <View key={i} style={styles.govItemCard}>
                  <Text style={styles.govItemText}>{d}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.govEmptyText}>No diagnosis recorded</Text>
            )}
            <View style={styles.govAddRow}>
              <TextInput
                placeholder="Enter new diagnosis"
                placeholderTextColor="#9ca3af"
                style={styles.govAddInput}
                value={newDiagnosis}
                onChangeText={setNewDiagnosis}
              />
              <TouchableOpacity
                style={[styles.govAddButton, !newDiagnosis && styles.govAddButtonDisabled]}
                onPress={addDiagnosis}
                disabled={!newDiagnosis}
              >
                <Text style={styles.govAddButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Allergies Section */}
          <View style={styles.govCard}>
            <Text style={styles.govSectionTitle}>⚠️ ALLERGIES</Text>
            {record.allergies && record.allergies.length > 0 ? (
              record.allergies.map((a, i) => (
                <View key={i} style={[styles.govItemCard, styles.govAllergyCard]}>
                  <Text style={styles.govItemText}>{a}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.govEmptyText}>No allergies recorded</Text>
            )}
            <View style={styles.govAddRow}>
              <TextInput
                placeholder="Enter new allergy"
                placeholderTextColor="#9ca3af"
                style={styles.govAddInput}
                value={newAllergy}
                onChangeText={setNewAllergy}
              />
              <TouchableOpacity
                style={[styles.govAddButton, !newAllergy && styles.govAddButtonDisabled]}
                onPress={addAllergy}
                disabled={!newAllergy}
              >
                <Text style={styles.govAddButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Current Medications */}
          <View style={styles.govCard}>
            <Text style={styles.govSectionTitle}>💊 CURRENT MEDICATIONS</Text>
            {record.currentMedications && record.currentMedications.length > 0 ? (
              record.currentMedications.map((m, i) => (
                <View key={i} style={styles.govItemCard}>
                  <Text style={styles.govItemText}>{m}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.govEmptyText}>No medications recorded</Text>
            )}
          </View>

          {/* Past Surgeries */}
          <View style={styles.govCard}>
            <Text style={styles.govSectionTitle}>🏥 PAST SURGERIES</Text>
            {record.pastSurgeries && record.pastSurgeries.length > 0 ? (
              record.pastSurgeries.map((s, i) => (
                <View key={i} style={styles.govItemCard}>
                  <Text style={styles.govItemText}>{s}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.govEmptyText}>No surgeries recorded</Text>
            )}
          </View>

          {/* Hospitalization History */}
          {record.hospitalizationHistory && record.hospitalizationHistory.length > 0 && (
            <View style={styles.govCard}>
              <Text style={styles.govSectionTitle}>📋 HOSPITALIZATION HISTORY</Text>
              {record.hospitalizationHistory.map((h, i) => (
                <View key={i} style={styles.govHistoryItem}>
                  <Text style={styles.govHistoryDate}>{new Date(h.date).toLocaleDateString()}</Text>
                  <Text style={styles.govItemText}>{h.reason}</Text>
                  {h.duration && <Text style={styles.govSubText}>Duration: {h.duration}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Lab Reports */}
          {record.labReports && record.labReports.length > 0 && (
            <View style={styles.govCard}>
              <Text style={styles.govSectionTitle}>🔬 LAB REPORTS</Text>
              {record.labReports.map((report, i) => (
                <View key={i} style={styles.govReportItem}>
                  <Text style={styles.govItemText}>{report.testName}</Text>
                  <Text style={styles.govSubText}>Date: {new Date(report.date).toLocaleDateString()}</Text>
                  <Text style={styles.govSubText}>Results: {report.results}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Clinical Notes */}
          <View style={styles.govCard}>
            <Text style={styles.govSectionTitle}>📝 CLINICAL NOTES</Text>
            <TextInput
              placeholder="Enter clinical notes and observations..."
              placeholderTextColor="#9ca3af"
              style={styles.govNotesInput}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={6}
            />
            <TouchableOpacity style={styles.govSaveButton} onPress={updateNotes}>
              <Text style={styles.govSaveButtonText}>💾 SAVE NOTES</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  govHeader: {
    backgroundColor: "#0066CC",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  govHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  govLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  govLogoText: {
    fontSize: 28,
  },
  govHeaderText: {
    flex: 1,
  },
  govTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  govSubtitle: {
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  govDoctorName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
    letterSpacing: 0.3,
  },
  govCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 8,
    margin: 16,
    marginBottom: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  govSectionTitle: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    fontSize: MedicalTheme.typography.fontSize.sm,
    marginBottom: MedicalTheme.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: MedicalTheme.colors.medicalBlue,
    paddingBottom: MedicalTheme.spacing.sm,
  },
  govSectionSubtitle: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  govSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#3A3A3A",
    borderRadius: 6,
    paddingHorizontal: 14,
    marginBottom: 16,
    minHeight: 48,
  },
  govSearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    paddingVertical: 12,
  },
  govSearchIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  govLoadingContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  govLoadingText: {
    color: MedicalTheme.colors.dark.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  govPatientCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  govPatientInfo: {
    flex: 1,
  },
  govPatientName: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  govPatientDetail: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  govPatientArrow: {
    color: MedicalTheme.colors.medicalBlue,
    fontSize: 24,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  govEmptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  govEmptyText: {
    color: "#CCCCCC",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  govManualSearchRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  govManualInput: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#3A3A3A",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#FFFFFF",
    minHeight: 48,
  },
  govManualButton: {
    backgroundColor: "#0066CC",
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 100,
  },
  govManualButtonDisabled: {
    backgroundColor: "#9ca3af",
    opacity: 0.6,
  },
  govManualButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  govBackContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  govBackButton: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  govBackButtonText: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  govPatientHeader: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  govPatientId: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 13,
  },
  govItemCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  govAllergyCard: {
    borderColor: "#dc2626",
    borderWidth: 2,
    backgroundColor: "#3A2A2A",
  },
  govItemText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  govSubText: {
    color: "#CCCCCC",
    fontSize: 12,
    marginTop: 4,
  },
  govAddRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  govAddInput: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderColor: "#3A3A3A",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 48,
  },
  govAddButton: {
    backgroundColor: "#059669",
    borderRadius: 6,
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#047857",
  },
  govAddButtonDisabled: {
    backgroundColor: "#d1d5db",
    borderColor: "#9ca3af",
  },
  govAddButtonText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  govHistoryItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  govHistoryDate: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  govReportItem: {
    backgroundColor: "#2A2A2A",
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  govNotesInput: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderColor: MedicalTheme.colors.borderDark,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: MedicalTheme.colors.dark.textPrimary,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 16,
    fontSize: 14,
  },
  govSaveButton: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderRadius: MedicalTheme.borderRadius.sm,
    paddingVertical: MedicalTheme.spacing.md,
    alignItems: "center",
    borderWidth: 0,
    ...MedicalTheme.shadows.md,
    shadowColor: MedicalTheme.colors.medicalBlue,
  },
  govSaveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  issueContainer: {
    marginTop: MedicalTheme.spacing.sm,
    padding: MedicalTheme.spacing.md,
    backgroundColor: MedicalTheme.colors.infoBg,
    borderRadius: MedicalTheme.borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: MedicalTheme.colors.medicalBlue,
  },
  issueLabel: {
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.medicalBlue,
    marginBottom: MedicalTheme.spacing.xs,
  },
  issueText: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textPrimary,
    lineHeight: 18,
  },
});
