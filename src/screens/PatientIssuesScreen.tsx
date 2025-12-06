import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Linking } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useAppSelector } from "../store/hooks";
import Toast from "react-native-toast-message";
import { getPatientName, formatFriendlyDate, formatFriendlyTime } from "../utils/helpers";
import { getSocket, onSocketEvent, offSocketEvent } from "../services/socket";
import { MedicalTheme } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";

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

interface Appointment {
  _id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  patientName?: string;
  age?: number;
  address?: string;
  issue?: string;
  reportFile?: string;
  reportFileName?: string;
  reason?: string; // Legacy field
  channel?: string;
}

type PatientIssuesRouteParams = {
  PatientIssues: {
    appointmentId: string;
    patientId: string;
    appointmentReason?: string;
    scheduledAt?: string;
  };
};

type PatientIssuesRouteProp = RouteProp<PatientIssuesRouteParams, "PatientIssues">;

export default function PatientIssuesScreen() {
  const route = useRoute<PatientIssuesRouteProp>();
  const navigation = useNavigation();
  const { user, token } = useAppSelector((state: any) => state.auth);
  const { appointmentId, patientId, appointmentReason, scheduledAt } = route.params || {};

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patientName, setPatientName] = useState("");
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [newDiagnosis, setNewDiagnosis] = useState("");
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [prescriptionSuggestions, setPrescriptionSuggestions] = useState("");
  const [currentPrescriptionItem, setCurrentPrescriptionItem] = useState({
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
    notes: "",
  });
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [uploadedReports, setUploadedReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showRequestReportModal, setShowRequestReportModal] = useState(false);
  const [showPatientIssuesModal, setShowPatientIssuesModal] = useState(true); // Modal opens by default
  const [reportType, setReportType] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [requestingReport, setRequestingReport] = useState(false);
  const doctorId = user?.id || null;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (patientId && token) {
      fetchPatientData();
      fetchUploadedReports();
    }
  }, [patientId, token]);

  // Socket.IO real-time updates for uploaded reports
  useEffect(() => {
    if (!patientId || !token || !doctorId) return;

    const socket = getSocket();
    if (!socket) return;

    const handleReportUploaded = (data: any) => {
      console.log("📋 Report uploaded:", data);
      if (data.patientId === patientId) {
        fetchUploadedReports();
        Toast.show({
          type: "success",
          text1: "Report Uploaded",
          text2: "Patient has uploaded the requested report",
          visibilityTime: 3000,
        });
      }
    };

    onSocketEvent("report:uploaded", handleReportUploaded);

    return () => {
      offSocketEvent("report:uploaded", handleReportUploaded);
    };
  }, [patientId, token, doctorId]);

  const fetchUploadedReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Fetch report requests for this patient from this doctor
      const res = await fetch(`${API_BASE}/api/report-requests?patientId=${patientId}&doctorId=${doctorId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        // Filter for uploaded or reviewed reports
        const uploaded = Array.isArray(data) 
          ? data.filter((r: any) => r.status === "UPLOADED" || r.status === "REVIEWED")
          : [];
        setUploadedReports(uploaded);
      }
    } catch (e) {
      console.error("Failed to fetch uploaded reports", e);
    } finally {
      setLoadingReports(false);
    }
  }, [patientId, doctorId, token]);

  const handleRequestReport = useCallback(async () => {
    if (!reportType.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter report type",
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setRequestingReport(true);
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Authentication Required",
          text2: "Please login again",
          visibilityTime: 3000,
        });
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/report-requests`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          patientId,
          reportType: reportType.trim(),
          description: reportDescription.trim() || undefined,
        }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Report Request Sent",
          text2: "Patient will receive a notification to upload the report",
          visibilityTime: 4000,
        });
        setShowRequestReportModal(false);
        setReportType("");
        setReportDescription("");
        // Refresh uploaded reports to show the new request
        await fetchUploadedReports();
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Request Failed",
          text2: errorData.message || "Failed to request report",
          visibilityTime: 4000,
        });
      }
    } catch (e: any) {
      console.error("Failed to request report", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to request report. Please check your connection.",
        visibilityTime: 4000,
      });
    } finally {
      setRequestingReport(false);
    }
  }, [reportType, reportDescription, token, patientId, fetchUploadedReports]);

  const handleReviewReport = useCallback(async (reportId: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/report-requests/${reportId}/review`, {
        method: "PATCH",
        headers,
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Report Reviewed",
          text2: "Report has been marked as reviewed",
          visibilityTime: 3000,
        });
        await fetchUploadedReports();
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || "Failed to review report",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to review report",
        visibilityTime: 3000,
      });
    }
  }, [token, fetchUploadedReports]);

  const fetchPatientData = useCallback(async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Fetch appointment details first
      if (appointmentId) {
        const aptRes = await fetch(`${API_BASE}/api/appointments/${appointmentId}`, { headers });
        if (aptRes.ok) {
          const aptData = await aptRes.json();
          setAppointment(aptData);
          // Use appointment patientName if available, otherwise fetch from user
          if (aptData.patientName) {
            setPatientName(aptData.patientName);
          } else {
            const name = await getPatientName(patientId, token);
            setPatientName(name);
          }
        } else {
          // Fallback: fetch patient name
          const name = await getPatientName(patientId, token);
          setPatientName(name);
        }
      } else {
        // Fallback: fetch patient name
        const name = await getPatientName(patientId, token);
        setPatientName(name);
      }

      // Fetch patient record
      const res = await fetch(`${API_BASE}/api/patient-records/${patientId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecord(data);
      } else {
        // If no record exists, create empty record
        setRecord({
          patientId,
          diagnosis: [],
          allergies: [],
          currentMedications: [],
          pastSurgeries: [],
        });
      }
    } catch (e: any) {
      console.error("Failed to fetch patient data", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load patient information",
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId, patientId, token]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPatientData(), fetchUploadedReports()]);
  }, [fetchPatientData, fetchUploadedReports]);

  // Extract issues from appointment issue or reason (for backward compatibility)
  const extractIssues = (issueText?: string): string[] => {
    if (!issueText) return [];
    // Split by common separators and clean up
    return issueText
      .split(/[,;|•\n]/)
      .map((issue) => issue.trim())
      .filter((issue) => issue.length > 0);
  };

  // Use appointment.issue if available, otherwise fallback to appointmentReason
  const issueText = appointment?.issue || appointmentReason || "";
  const issues = extractIssues(issueText);

  // Check if old diagnosis exists
  const hasOldDiagnosis = record?.diagnosis && record.diagnosis.length > 0;

  const handleProceed = useCallback(() => {
    // For new patients, go directly to prescription
    // For existing patients with diagnosis, show diagnosis modal first
    if (hasOldDiagnosis) {
      // Show diagnosis modal
      setShowDiagnosisModal(true);
    } else {
      // Show prescription form directly - doctor reads issue and provides prescription
      setShowPrescriptionForm(true);
    }
  }, [hasOldDiagnosis]);

  const handleUseSameDiagnosis = useCallback(() => {
    // Get the latest diagnosis
    const latestDiagnosis = record?.diagnosis && record.diagnosis.length > 0 
      ? record.diagnosis[record.diagnosis.length - 1] 
      : "";
    
    setShowDiagnosisModal(false);
    // Navigate to Treatment Options with the diagnosis
    (navigation as any).navigate("TreatmentOptions", {
      appointmentId,
      patientId,
      appointmentReason,
      scheduledAt,
      diagnosis: latestDiagnosis,
    });
  }, [record, navigation, appointmentId, patientId, appointmentReason, scheduledAt]);

  const handleAddDiagnosis = useCallback(async () => {
    if (!newDiagnosis.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter a diagnosis",
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
        body: JSON.stringify({ diagnosis: newDiagnosis.trim() }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Diagnosis Added",
          text2: "New diagnosis has been added successfully",
          visibilityTime: 2000,
        });
        setShowDiagnosisModal(false);
        setNewDiagnosis("");
        await fetchPatientData();
        // After adding diagnosis, navigate to Treatment Options
        const newDiag = newDiagnosis.trim();
        (navigation as any).navigate("TreatmentOptions", {
          appointmentId,
          patientId,
          appointmentReason,
          scheduledAt,
          diagnosis: newDiag,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Failed",
          text2: errorData.message || "Failed to add diagnosis",
          visibilityTime: 3000,
        });
      }
    } catch (e: any) {
      console.error("Failed to add diagnosis", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to add diagnosis",
        visibilityTime: 3000,
      });
    }
  }, [newDiagnosis, token, patientId, navigation, appointmentId, appointmentReason, scheduledAt, fetchPatientData]);

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
  }, [currentPrescriptionItem, prescriptionItems]);

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

    setSubmittingPrescription(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
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
          suggestions: prescriptionSuggestions.trim() || undefined,
        }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Prescription Submitted",
          text2: "Prescription has been sent to pharmacy successfully",
          visibilityTime: 3000,
        });
        
        // Navigate back to appointments screen
        timeoutRef.current = setTimeout(() => {
          setShowPrescriptionForm(false);
          setPrescriptionItems([]);
          setPrescriptionSuggestions("");
          // Navigate back to the main app (which will show appointments)
          navigation.getParent()?.goBack();
          // Also try direct navigation
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
      setSubmittingPrescription(false);
    }
  }, [prescriptionItems, appointmentId, patientId, doctorId, token, prescriptionSuggestions, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MedicalTheme.colors.medicalBlue} />
          <Text style={styles.loadingText}>Loading patient information...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Patient Issues Modal - Opens by default */}
      <Modal
        visible={showPatientIssuesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPatientIssuesModal(false);
          navigation.goBack();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.patientIssuesModalContent}>
            {/* Modal Header */}
            <View style={styles.patientIssuesModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.patientAvatarSmall}>
                  <Text style={styles.avatarTextSmall}>
                    {(appointment?.patientName || patientName)?.charAt(0)?.toUpperCase() || "P"}
                  </Text>
                </View>
                <View style={styles.modalHeaderInfo}>
                  <Text style={styles.modalTitle}>Patient Issues</Text>
                  <Text style={styles.modalSubtitle}>
                    {appointment?.patientName || patientName || `Patient ${patientId.slice(-8)}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowPatientIssuesModal(false);
                  navigation.goBack();
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body - Scrollable Content */}
            <ScrollView
              style={styles.patientIssuesModalBody}
              contentContainerStyle={styles.modalBodyContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MedicalTheme.colors.medicalBlue} />}
              showsVerticalScrollIndicator={false}
            >
              {/* Patient Basic Info */}
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Patient ID</Text>
                  <Text style={styles.infoValue}>{patientId.slice(-8).toUpperCase()}</Text>
                </View>
                {appointment?.age && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Age</Text>
                    <Text style={styles.infoValue}>{appointment.age} years</Text>
                  </View>
                )}
                {(appointment?.scheduledAt || scheduledAt) && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Appointment</Text>
                    <Text style={styles.infoValue}>
                      {formatFriendlyDate((appointment?.scheduledAt || scheduledAt) as string)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Main Issue Card */}
              <View style={styles.issueCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>🔍 Patient Issue / Problem</Text>
                </View>
                {issueText ? (
                  <View style={styles.issueContent}>
                    <Text style={styles.issueText}>{issueText}</Text>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📝</Text>
                    <Text style={styles.emptyText}>No issue description provided</Text>
                  </View>
                )}
              </View>

              {/* Uploaded Report from Appointment */}
              {appointment?.reportFile && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportCardTitle}>📄 Appointment Report</Text>
                  <Text style={styles.reportCardSubtitle}>
                    {appointment.reportFileName || "Report uploaded with appointment"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Linking.openURL(`${API_BASE}/api/appointments/${appointmentId}/report`).catch((err) => {
                        console.error("Failed to open report URL", err);
                        Toast.show({
                          type: "error",
                          text1: "Unable to open report",
                          text2: "Please try again later",
                          visibilityTime: 3000,
                        });
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#0066CC", "#0052A3", "#003366"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.viewReportButton}
                    >
                      <Text style={styles.viewReportButtonText}>👁️ View Report</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Patient Medical Records Section - Only show if there's actual data */}
              {record && (
                (record.diagnosis && record.diagnosis.length > 0) ||
                (record.allergies && record.allergies.length > 0) ||
                (record.currentMedications && record.currentMedications.length > 0) ||
                (record.pastSurgeries && record.pastSurgeries.length > 0) ||
                (record.hospitalizationHistory && record.hospitalizationHistory.length > 0) ||
                (record.labReports && record.labReports.length > 0) ||
                record.notes
              ) && (
                <View style={styles.medicalRecordsCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>📋 Medical Records</Text>
                  </View>

            {/* Diagnoses - Only show if has data */}
            {record.diagnosis && record.diagnosis.length > 0 && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>🩺 Diagnosis</Text>
                <View style={styles.recordItemsList}>
                  {record.diagnosis.map((diag, idx) => (
                    <View key={idx} style={styles.recordItem}>
                      <Text style={styles.recordItemText}>{diag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Allergies - Only show if has data */}
            {record.allergies && record.allergies.length > 0 && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>⚠️ Allergies</Text>
                <View style={styles.recordItemsList}>
                  {record.allergies.map((allergy, idx) => (
                    <View key={idx} style={[styles.recordItem, styles.allergyRecordItem]}>
                      <Text style={styles.allergyRecordText}>{allergy}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Current Medications - Only show if has data */}
            {record.currentMedications && record.currentMedications.length > 0 && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>💊 Current Medications</Text>
                <View style={styles.recordItemsList}>
                  {record.currentMedications.map((med, idx) => (
                    <View key={idx} style={styles.recordItem}>
                      <Text style={styles.recordItemText}>{med}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Past Surgeries - Only show if has data */}
            {record.pastSurgeries && record.pastSurgeries.length > 0 && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>🏥 Past Surgeries</Text>
                <View style={styles.recordItemsList}>
                  {record.pastSurgeries.map((surgery, idx) => (
                    <View key={idx} style={styles.recordItem}>
                      <Text style={styles.recordItemText}>{surgery}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Hospitalization History - Only show if has data */}
            {record.hospitalizationHistory && record.hospitalizationHistory.length > 0 && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>🏥 Hospitalization History</Text>
                <View style={styles.recordItemsList}>
                  {record.hospitalizationHistory.map((hosp, idx) => (
                    <View key={idx} style={styles.hospitalizationItem}>
                      <Text style={styles.hospitalizationDate}>
                        {formatFriendlyDate(hosp.date)}
                      </Text>
                      <Text style={styles.hospitalizationReason}>{hosp.reason}</Text>
                      {hosp.duration && (
                        <Text style={styles.hospitalizationDuration}>
                          Duration: {hosp.duration}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Lab Reports - Only show if has data */}
            {record.labReports && record.labReports.length > 0 && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>🔬 Lab Reports</Text>
                <View style={styles.recordItemsList}>
                  {record.labReports.map((report, idx) => (
                    <View key={idx} style={styles.labReportItem}>
                      <Text style={styles.labReportDate}>
                        {formatFriendlyDate(report.date)}
                      </Text>
                      <Text style={styles.labReportName}>{report.testName}</Text>
                      <Text style={styles.labReportResults}>{report.results}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Clinical Notes - Only show if has data */}
            {record.notes && (
              <View style={styles.recordSubSection}>
                <Text style={styles.recordSubTitle}>📝 Clinical Notes</Text>
                <View style={styles.notesCard}>
                  <Text style={styles.notesText}>{record.notes}</Text>
                </View>
              </View>
            )}
          </View>
        )}

              {/* Uploaded Reports Section */}
              {uploadedReports.length > 0 && (
                <View style={styles.reportsSection}>
                  <Text style={styles.sectionTitle}>📄 Uploaded Reports</Text>
                  {loadingReports ? (
                    <View style={styles.loadingReportsContainer}>
                      <ActivityIndicator size="small" color="#22C55E" />
                      <Text style={styles.loadingReportsText}>Loading reports...</Text>
                    </View>
                  ) : (
                    uploadedReports.map((report) => {
                      if (!report._id) return null;
                      return (
                        <View key={report._id} style={styles.reportCard}>
                          <View style={styles.reportCardHeader}>
                            <View style={styles.reportCardInfo}>
                              <Text style={styles.reportCardTitle}>{report.reportType}</Text>
                              <Text style={styles.reportCardDate}>
                                {formatFriendlyDate(report.uploadedAt || report.requestedAt)}
                              </Text>
                            </View>
                            <View style={[
                              styles.reportStatusBadge,
                              report.status === "UPLOADED" && styles.statusBadgeUploaded,
                              report.status === "REVIEWED" && styles.statusBadgeReviewed,
                            ]}>
                              <Text style={[
                                styles.reportStatusText,
                                report.status === "UPLOADED" && styles.statusTextUploaded,
                                report.status === "REVIEWED" && styles.statusTextReviewed,
                              ]}>
                                {report.status}
                              </Text>
                            </View>
                          </View>

                          {report.fileUrl && (
                            <TouchableOpacity
                              onPress={() => {
                                Linking.openURL(`${API_BASE}${report.fileUrl}`).catch((err) => {
                                  console.error("Failed to open report URL", err);
                                  Toast.show({
                                    type: "error",
                                    text1: "Unable to open report",
                                    text2: "Please try again later",
                                    visibilityTime: 3000,
                                  });
                                });
                              }}
                              activeOpacity={0.8}
                            >
                              <LinearGradient
                                colors={["#0066CC", "#0052A3", "#003366"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.viewReportButton}
                              >
                                <Text style={styles.viewReportButtonText}>👁️ View Report</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}

                          {report.status === "UPLOADED" && (
                            <TouchableOpacity
                              onPress={() => handleReviewReport(report._id)}
                              activeOpacity={0.8}
                            >
                              <LinearGradient
                                colors={["#22C55E", "#16A34A", "#15803D"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.reviewReportButton}
                              >
                                <Text style={styles.reviewReportButtonText}>✓ Mark as Reviewed</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}

                          {report.status === "REVIEWED" && (
                            <View style={styles.reviewedBadge}>
                              <Text style={styles.reviewedBadgeText}>✅ Reviewed</Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>

            {/* Modal Footer - Action Buttons in Rows */}
            <View style={styles.patientIssuesModalFooter}>
              {/* Row 1: Request Report & Proceed to Treatment */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={() => setShowRequestReportModal(true)}
                  activeOpacity={0.8}
                  style={styles.buttonRowItem}
                >
                  <LinearGradient
                    colors={["#0066CC", "#0052A3", "#003366"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>📄 Request Report</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleProceed}
                  activeOpacity={0.8}
                  style={styles.buttonRowItem}
                >
                  <LinearGradient
                    colors={["#22C55E", "#16A34A", "#15803D"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>✓ Proceed to Treatment</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Row 2: Back Button */}
              <TouchableOpacity
                onPress={() => {
                  setShowPatientIssuesModal(false);
                  navigation.goBack();
                }}
                activeOpacity={0.8}
                style={styles.backButtonFullWidth}
              >
                <LinearGradient
                  colors={["#3A3A3A", "#2A2A2A", "#1A1A1A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionButtonText}>← Back to Appointments</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Diagnosis Modal */}
      <Modal
        visible={showDiagnosisModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDiagnosisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🩺 Add Diagnosis</Text>
              <Text style={styles.modalSubtitle}>Patient has previous diagnoses. Add new diagnosis if needed.</Text>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {record?.diagnosis && record.diagnosis.length > 0 && (
                <View style={styles.oldDiagnosisSection}>
                  <Text style={styles.oldDiagnosisTitle}>Previous Diagnoses:</Text>
                  {record.diagnosis.map((diag, idx) => (
                    <View key={idx} style={styles.oldDiagnosisItem}>
                      <Text style={styles.oldDiagnosisText}>{diag}</Text>
                    </View>
                  ))}
                  
                  {/* Use Same Diagnosis Button */}
                  <TouchableOpacity
                    style={styles.useSameDiagnosisButton}
                    onPress={handleUseSameDiagnosis}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.useSameDiagnosisButtonText}>
                      ✓ Use Same Diagnosis ({record.diagnosis[record.diagnosis.length - 1]})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Or Add New Diagnosis</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter new diagnosis..."
                  placeholderTextColor="#94A3B8"
                  value={newDiagnosis}
                  onChangeText={setNewDiagnosis}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDiagnosisModal(false);
                  setNewDiagnosis("");
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              {newDiagnosis.trim() && (
                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleAddDiagnosis}
                >
                  <Text style={styles.modalSubmitButtonText}>Add & Continue</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Prescription Form Modal */}
      <Modal
        visible={showPrescriptionForm}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrescriptionForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💊 Create Prescription</Text>
              <Text style={styles.modalSubtitle}>Add medicines for the patient</Text>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Add Medicine Form */}
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

              {/* Prescription Items List */}
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

              {/* Suggestions Field */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Suggestions / Advice (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Add any suggestions, lifestyle advice, or follow-up instructions..."
                  placeholderTextColor="#94A3B8"
                  value={prescriptionSuggestions}
                  onChangeText={setPrescriptionSuggestions}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowPrescriptionForm(false);
                  setPrescriptionItems([]);
                  setPrescriptionSuggestions("");
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, prescriptionItems.length === 0 && styles.modalSubmitButtonDisabled]}
                onPress={handleSubmitPrescription}
                disabled={prescriptionItems.length === 0 || submittingPrescription}
              >
                {submittingPrescription ? (
                  <ActivityIndicator color={MedicalTheme.colors.textInverse} />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Submit Prescription</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Request Report Modal */}
      <Modal
        visible={showRequestReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📄 Request Report</Text>
              <Text style={styles.modalSubtitle}>Request additional reports from patient</Text>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Report Type *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., Blood Test, X-Ray, CT Scan, MRI, Lab Report"
                  placeholderTextColor="#94A3B8"
                  value={reportType}
                  onChangeText={setReportType}
                />
                <Text style={styles.formHint}>Specify what type of report you need</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Add any specific details or instructions for the patient..."
                  placeholderTextColor="#94A3B8"
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <Text style={styles.formHint}>Provide additional context or requirements</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRequestReportModal(false);
                  setReportType("");
                  setReportDescription("");
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, (!reportType.trim() || requestingReport) && styles.modalSubmitButtonDisabled]}
                onPress={handleRequestReport}
                disabled={!reportType.trim() || requestingReport}
              >
                {requestingReport ? (
                  <ActivityIndicator color={MedicalTheme.colors.textInverse} />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Send Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  // Patient Issues Modal Styles
  patientIssuesModalContent: {
    backgroundColor: "#2A2A2A",
    borderRadius: 20,
    width: "100%",
    maxWidth: 600,
    maxHeight: "95%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  patientIssuesModalHeader: {
    backgroundColor: "#0066CC",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#0052A3",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  patientAvatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarTextSmall: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0066CC",
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  patientIssuesModalBody: {
    flex: 1,
    maxHeight: 500,
  },
  modalBodyContent: {
    padding: 20,
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  infoItem: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  infoLabel: {
    fontSize: 12,
    color: "#CCCCCC",
    marginBottom: 4,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
  },
  loadingText: {
    marginTop: MedicalTheme.spacing.base,
    fontSize: MedicalTheme.typography.fontSize.base,
    color: "#CCCCCC",
  },
  // Patient Information Card
  patientInfoCard: {
    flexDirection: "row",
    backgroundColor: "#2A2A2A",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  patientAvatarContainer: {
    marginRight: 16,
  },
  patientAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#0066CC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  patientInfo: {
    flex: 1,
    justifyContent: "center",
  },
  patientName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  patientId: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 6,
    fontWeight: "500",
  },
  patientDetail: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 14,
    color: "#22C55E",
    fontWeight: "600",
    marginTop: 4,
  },
  // Appointment Details Card
  appointmentDetailsCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#CCCCCC",
    marginTop: 4,
    lineHeight: 18,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CCCCCC",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 22,
    fontWeight: "500",
  },
  // Patient Issue Card
  issueCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  issueContent: {
    marginTop: 8,
  },
  issueText: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 22,
    fontWeight: "400",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#CCCCCC",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#CCCCCC",
    textAlign: "center",
  },
  reasonCard: {
    backgroundColor: "#2A2A2A",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#CCCCCC",
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  allergyTag: {
    backgroundColor: "#3A2A2A",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  allergyText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
  },
  medicationsList: {
    gap: 8,
  },
  medicationItem: {
    backgroundColor: "#2A2A2A",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#0066CC",
  },
  medicationText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  diagnosisList: {
    gap: 8,
  },
  diagnosisItem: {
    backgroundColor: "#2A2A2A",
    padding: 12,
    borderRadius: 8,
  },
  diagnosisText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  notesCard: {
    backgroundColor: "#2A2A2A",
    padding: 16,
    borderRadius: 12,
  },
  notesText: {
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  // Reports Section
  reportsSection: {
    marginBottom: 16,
    gap: 12,
  },
  reportCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  reportCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  reportCardInfo: {
    flex: 1,
  },
  reportCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  reportCardSubtitle: {
    fontSize: 13,
    color: "#CCCCCC",
    marginBottom: 8,
  },
  reportCardDate: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 4,
  },
  reportCardDescription: {
    fontSize: 13,
    color: "#CCCCCC",
    marginTop: 4,
  },
  reportStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#3A3A3A",
  },
  reportStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#CCCCCC",
    textTransform: "uppercase",
  },
  statusBadgeUploaded: {
    backgroundColor: "#1E3A8A",
  },
  statusTextUploaded: {
    color: "#60A5FA",
  },
  statusBadgeReviewed: {
    backgroundColor: "#065F46",
  },
  statusTextReviewed: {
    color: "#34D399",
  },
  viewReportButton: {
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  viewReportButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  reviewReportButton: {
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  reviewReportButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  reviewedBadge: {
    backgroundColor: "#065F46",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  reviewedBadgeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#34D399",
  },
  // Medical Records Card
  medicalRecordsCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  // Modal Footer - Row Buttons
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  buttonRowItem: {
    flex: 1,
  },
  backButtonFullWidth: {
    width: "100%",
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  // Uploaded Reports Styles
  loadingReportsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  loadingReportsText: {
    fontSize: 14,
    color: "#CCCCCC",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    backgroundColor: "#0066CC",
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "#E0F2F7",
    fontSize: 13,
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  patientIssuesModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#3A3A3A",
    backgroundColor: "#2A2A2A",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#3A3A3A",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButtonText: {
    color: "#CCCCCC",
    fontSize: 15,
    fontWeight: "600",
  },
  modalSubmitButton: {
    flex: 2,
    backgroundColor: "#0066CC",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalSubmitButtonDisabled: {
    backgroundColor: "#94A3B8",
    opacity: 0.6,
  },
  modalSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  oldDiagnosisSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
  },
  oldDiagnosisTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  oldDiagnosisItem: {
    padding: 12,
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#0066CC",
  },
  oldDiagnosisText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: "#CCCCCC",
    marginTop: 4,
    fontStyle: "italic",
  },
  formInput: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#FFFFFF",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
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
  },
  itemsListTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  prescriptionItemCard: {
    backgroundColor: "#2A2A2A",
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
    color: "#FFFFFF",
    marginBottom: 4,
  },
  prescriptionItemDetail: {
    fontSize: 13,
    color: "#CCCCCC",
    marginBottom: 4,
  },
  prescriptionItemNotes: {
    fontSize: 12,
    color: "#CCCCCC",
    fontStyle: "italic",
  },
  useSameDiagnosisButton: {
    backgroundColor: "#059669",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  useSameDiagnosisButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  recordSubSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3A3A3A",
  },
  recordSubTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  recordItemsList: {
    gap: 8,
  },
  recordItem: {
    backgroundColor: "#2A2A2A",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#0066CC",
  },
  recordItemText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  emptyRecordText: {
    fontSize: 13,
    color: "#CCCCCC",
    fontStyle: "italic",
    padding: 12,
  },
  allergyRecordItem: {
    borderLeftColor: "#EF4444",
    backgroundColor: "#3A2A2A",
  },
  allergyRecordText: {
    color: "#DC2626",
    fontWeight: "600",
  },
  hospitalizationItem: {
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#0284C7",
    marginBottom: 8,
  },
  hospitalizationDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
    marginBottom: 4,
  },
  hospitalizationReason: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
    marginBottom: 4,
  },
  hospitalizationDuration: {
    fontSize: 12,
    color: "#CCCCCC",
  },
  labReportItem: {
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
    marginBottom: 8,
  },
  labReportDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
    marginBottom: 4,
  },
  labReportName: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 4,
  },
  labReportResults: {
    fontSize: 13,
    color: "#CCCCCC",
    lineHeight: 18,
  },
});

