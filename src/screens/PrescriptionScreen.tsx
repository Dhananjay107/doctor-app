import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from "react-native";
import { useAppSelector } from "../store/hooks";
import { getPatientName, formatFriendlyDate, formatFriendlyTime } from "../utils/helpers";
import Toast from "react-native-toast-message";
import { MedicalTheme } from "../constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface Appointment {
  _id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  reason?: string;
  channel?: string;
  patientName?: string;
}

export default function PrescriptionScreen() {
  const { user, token } = useAppSelector((state: any) => state.auth);
  const [appointmentId, setAppointmentId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [currentItem, setCurrentItem] = useState<PrescriptionItem>({
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
    notes: "",
  });
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [showAppointmentPicker, setShowAppointmentPicker] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedPrescription, setSubmittedPrescription] = useState<any>(null);
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const doctorId = user?.id || null;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user?.id && token && user.role === "DOCTOR") {
      fetchRecentAppointments(user.id, token);
      }
  }, [user?.id, token]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const fetchRecentAppointments = useCallback(async (docId: string, authToken: string) => {
    try {
      setLoadingAppointments(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const res = await fetch(`${API_BASE}/api/appointments?doctorId=${docId}`, { headers });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch: ${res.status}`);
      }
      
      const data = await res.json();
      const appointments = Array.isArray(data) ? data : [];
      
      // Filter for CONFIRMED and COMPLETED statuses only
      const filteredAppointments = appointments.filter(
        (apt: Appointment) => apt.status === "CONFIRMED" || apt.status === "COMPLETED"
      );
      
      // Fetch patient names
      const appointmentsWithNames = await Promise.all(
        filteredAppointments.map(async (apt: Appointment) => {
          try {
            const patientName = await getPatientName(apt.patientId, authToken);
            return { ...apt, patientName };
          } catch (e) {
            console.error(`Failed to fetch patient name for ${apt.patientId}`, e);
            return { ...apt, patientName: `Patient ${apt.patientId.slice(-8)}` };
          }
        })
      );
      
      // Sort by most recent
      appointmentsWithNames.sort((a: Appointment, b: Appointment) => 
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );
      
      setRecentAppointments(appointmentsWithNames.slice(0, 10));
    } catch (e: any) {
      console.error("Failed to fetch appointments", e);
      Toast.show({
        type: "error",
        text1: "Error Loading Appointments",
        text2: e.message || "Failed to fetch recent appointments",
        visibilityTime: 3000,
      });
      setRecentAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  const handleSelectAppointment = useCallback(async (appointment: Appointment) => {
    setAppointmentId(appointment._id);
    setPatientId(appointment.patientId);
    setSelectedPatientName(appointment.patientName || `Patient ${appointment.patientId.slice(-8)}`);
    setShowAppointmentPicker(false);
    
    Toast.show({
      type: "success",
      text1: "Appointment Selected",
      text2: "You can now add medicines",
      visibilityTime: 2000,
    });
  }, []);

  const startVoiceInput = useCallback(() => {
    // Note: Web Speech API is not available in React Native
    // This should be implemented using a React Native speech recognition library like @react-native-voice/voice
    Alert.alert("Info", "Voice input is not available. Please use manual entry.");
    /* Web-only code (commented out for React Native):
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        setVoiceText("");
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }
        setVoiceText(finalTranscript || interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        Alert.alert("Error", "Speech recognition failed. Please try again.");
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (voiceText.trim()) {
          processVoiceText(voiceText);
        }
      };

      recognition.start();
    }
    */
  }, []);

  const processVoiceText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    if (!appointmentId || !doctorId || !patientId) {
      Alert.alert("Error", "Please select an appointment first before using voice input.");
      return;
    }

    try {
      if (!token) {
        Alert.alert("Error", "Authentication required. Please login again.");
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      Toast.show({
        type: "info",
        text1: "Processing Voice Input",
        text2: "Parsing medicines...",
        visibilityTime: 2000,
      });

      const res = await fetch(`${API_BASE}/api/prescriptions/voice`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId,
          doctorId,
          patientId,
          pharmacyId: pharmacyId || undefined,
          voiceText: text,
          notes: "Generated from voice input",
        }),
      });

      const data = await res.json();

      if (res.ok && data.items && Array.isArray(data.items)) {
        setItems(data.items);
        Toast.show({
          type: "success",
          text1: "Voice Prescription Parsed",
          text2: `Found ${data.items.length} medicine(s). Review and submit.`,
          visibilityTime: 3000,
        });
      } else {
        Alert.alert(
          "Voice Input Received",
          `Could not automatically parse all medicines. Please review and add manually.\n\nVoice text:\n${text}`,
          [{ text: "OK" }]
        );
      }
    } catch (e: any) {
      console.error("Failed to process voice text", e);
      Alert.alert(
        "Voice Input Received",
        `Could not process voice input automatically. Please add medicines manually.\n\nVoice text:\n${text}`,
        [{ text: "OK" }]
      );
    }
  }, [appointmentId, doctorId, patientId, token, pharmacyId]);

  const stopVoiceInput = useCallback(() => {
    setIsRecording(false);
  }, []);

  const addItem = useCallback(() => {
    if (!currentItem.medicineName || !currentItem.dosage || !currentItem.frequency || !currentItem.duration) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }
    setItems([...items, { ...currentItem }]);
    setCurrentItem({
      medicineName: "",
      dosage: "",
      frequency: "",
      duration: "",
      notes: "",
    });
    Toast.show({
      type: "success",
      text1: "Medicine Added",
      text2: `${currentItem.medicineName} added to prescription`,
      visibilityTime: 2000,
    });
  }, [currentItem]);

  const removeItem = useCallback((index: number) => {
    const removed = items[index];
    setItems(items.filter((_, i) => i !== index));
    Toast.show({
      type: "info",
      text1: "Medicine Removed",
      text2: `${removed.medicineName} removed`,
      visibilityTime: 2000,
    });
  }, [items]);

  const sendToPharmacy = useCallback(async () => {
    if (!patientId || !doctorId) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select an appointment",
        visibilityTime: 3000,
      });
      return;
    }
    if (items.length === 0) {
      Toast.show({
        type: "error",
        text1: "No Medicines Added",
        text2: "Please add at least one medicine",
        visibilityTime: 3000,
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (!token) {
        throw new Error("Authentication required. Please login again.");
      }
      
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/prescriptions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appointmentId: appointmentId || undefined,
          doctorId,
          patientId,
          pharmacyId: pharmacyId || undefined,
          items,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmittedPrescription({
          prescriptionId: data._id || data.id,
          patientId,
          itemCount: items.length,
          submittedAt: new Date().toLocaleString(),
        });
        setShowSuccessModal(true);
        
        Toast.show({
          type: "success",
          text1: "Prescription Submitted",
          text2: "Prescription sent successfully",
          visibilityTime: 3000,
        });
        
        // Reset form
        setAppointmentId("");
        setPatientId("");
        setPharmacyId("");
        setItems([]);
        setVoiceText("");
        setSelectedPatientName("");
        setCurrentItem({
          medicineName: "",
          dosage: "",
          frequency: "",
          duration: "",
          notes: "",
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Submission Failed",
          text2: data.message || data.error || "Failed to submit prescription",
          visibilityTime: 4000,
        });
      }
    } catch (e: any) {
      console.error("Failed to submit prescription", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to submit prescription",
        visibilityTime: 4000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [patientId, doctorId, appointmentId, pharmacyId, items, token]);

  const handleCreateNewPrescription = useCallback(() => {
    setShowSuccessModal(false);
    setSubmittedPrescription(null);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Appointment Selection Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📅 Select Appointment</Text>
          <Text style={styles.sectionSubtitle}>Choose a patient appointment to create prescription</Text>
          
          {appointmentId && patientId ? (
            <View style={styles.selectedAppointmentCard}>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedPatientName}>👤 {selectedPatientName}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setAppointmentId("");
                    setPatientId("");
                    setSelectedPatientName("");
                    setItems([]);
                  }}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.selectedDetail}>Patient ID: {patientId.slice(-8)}</Text>
              <Text style={styles.selectedDetail}>Appointment ID: {appointmentId.slice(-8)}</Text>
            </View>
          ) : (
          <TouchableOpacity
              style={styles.selectButton}
            onPress={async () => {
              if (doctorId && token) {
                await fetchRecentAppointments(doctorId, token);
              }
              setShowAppointmentPicker(true);
            }}
          >
              <Text style={styles.selectButtonText}>📋 Select Appointment</Text>
          </TouchableOpacity>
          )}
        </View>

        {/* Voice Input Section */}
        {appointmentId && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🎤 Voice Input</Text>
            <Text style={styles.sectionSubtitle}>Speak medicines naturally (e.g., "Paracetamol 500mg twice daily for 5 days")</Text>
            
          <View style={styles.voiceContainer}>
            {isRecording ? (
              <TouchableOpacity style={[styles.voiceButton, styles.recordingButton]} onPress={stopVoiceInput}>
                <View style={styles.recordingIndicator} />
                <Text style={styles.voiceButtonText}>⏹ Stop Recording</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                  style={styles.voiceButton}
                onPress={startVoiceInput}
              >
                  <Text style={styles.micIcon}>🎤 </Text>
                <Text style={styles.voiceButtonText}>Start Voice Input</Text>
              </TouchableOpacity>
            )}
          </View>
            
          {voiceText ? (
            <View style={styles.voiceTextContainer}>
                <Text style={styles.voiceTextLabel}>Recognized:</Text>
              <Text style={styles.voiceText}>{voiceText}</Text>
            </View>
          ) : null}
        </View>
        )}

        {/* Manual Entry Section */}
        {appointmentId && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>✍️ Add Medicine</Text>
            <Text style={styles.sectionSubtitle}>Enter medicine details manually</Text>
          
            <View style={styles.formRow}>
              <Text style={styles.label}>Medicine Name *</Text>
            <TextInput
                placeholder="e.g., Paracetamol"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              value={currentItem.medicineName}
              onChangeText={(text) => setCurrentItem({ ...currentItem, medicineName: text })}
            />
          </View>
            
            <View style={styles.formRow}>
              <Text style={styles.label}>Dosage *</Text>
            <TextInput
                placeholder="e.g., 500mg"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              value={currentItem.dosage}
              onChangeText={(text) => setCurrentItem({ ...currentItem, dosage: text })}
            />
          </View>
            
            <View style={styles.formRow}>
              <Text style={styles.label}>Frequency *</Text>
            <TextInput
                placeholder="e.g., Twice daily"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              value={currentItem.frequency}
              onChangeText={(text) => setCurrentItem({ ...currentItem, frequency: text })}
            />
          </View>
            
            <View style={styles.formRow}>
              <Text style={styles.label}>Duration *</Text>
            <TextInput
                placeholder="e.g., 7 days"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              value={currentItem.duration}
              onChangeText={(text) => setCurrentItem({ ...currentItem, duration: text })}
            />
          </View>
            
            <View style={styles.formRow}>
              <Text style={styles.label}>Instructions (Optional)</Text>
            <TextInput
                placeholder="e.g., Take with food"
                placeholderTextColor="#94a3b8"
                style={[styles.input, styles.textArea]}
              value={currentItem.notes}
              onChangeText={(text) => setCurrentItem({ ...currentItem, notes: text })}
              multiline
              numberOfLines={2}
            />
          </View>
            
          <TouchableOpacity 
              style={[styles.addButton, (!currentItem.medicineName || !currentItem.dosage || !currentItem.frequency || !currentItem.duration) && styles.addButtonDisabled]} 
            onPress={addItem}
            disabled={!currentItem.medicineName || !currentItem.dosage || !currentItem.frequency || !currentItem.duration}
          >
              <Text style={styles.addButtonText}>+ Add Medicine</Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Prescription Items List */}
        {items.length > 0 && (
          <View style={styles.card}>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionTitle}>💊 Prescription ({items.length})</Text>
            </View>
            
            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemNumber}>
                    <Text style={styles.itemNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{item.medicineName}</Text>
                  <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeButton}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.itemDetails}>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Dosage:</Text>
                    <Text style={styles.itemValue}>{item.dosage}</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Frequency:</Text>
                    <Text style={styles.itemValue}>{item.frequency}</Text>
                  </View>
                  <View style={styles.itemRow}>
                    <Text style={styles.itemLabel}>Duration:</Text>
                    <Text style={styles.itemValue}>{item.duration}</Text>
                  </View>
                  {item.notes && (
                    <View style={styles.itemRow}>
                      <Text style={styles.itemLabel}>Notes:</Text>
                      <Text style={styles.itemValue}>{item.notes}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Submit Button */}
        {appointmentId && (
          <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
                styles.submitButton,
                (isProcessing || !patientId || items.length === 0) && styles.submitButtonDisabled
            ]}
            onPress={sendToPharmacy}
            disabled={isProcessing || !patientId || items.length === 0}
          >
            {isProcessing ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </View>
            ) : (
                <Text style={styles.submitButtonText}>📤 Submit Prescription</Text>
            )}
          </TouchableOpacity>
          {(!patientId || items.length === 0) && (
              <Text style={styles.submitHelp}>
                {!patientId ? "⚠️ Please select an appointment" : "⚠️ Please add at least one medicine"}
            </Text>
          )}
        </View>
        )}
      </ScrollView>

      {/* Appointment Picker Modal */}
      <Modal
        visible={showAppointmentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAppointmentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Appointment</Text>
              <TouchableOpacity onPress={() => setShowAppointmentPicker(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              {loadingAppointments ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={MedicalTheme.colors.medicalBlue} />
                  <Text style={styles.loadingText}>Loading appointments...</Text>
                </View>
              ) : recentAppointments.length > 0 ? (
                recentAppointments.map((apt) => (
                  <TouchableOpacity
                    key={apt._id}
                    style={styles.appointmentCard}
                    onPress={() => handleSelectAppointment(apt)}
                  >
                    <Text style={styles.appointmentDate}>{formatFriendlyDate(apt.scheduledAt)}</Text>
                    <Text style={styles.appointmentTime}>{formatFriendlyTime(apt.scheduledAt)}</Text>
                    <Text style={styles.appointmentPatient}>👤 {apt.patientName || `Patient ${apt.patientId.slice(-8)}`}</Text>
                    {apt.reason && <Text style={styles.appointmentReason}>📝 {apt.reason}</Text>}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No appointments found</Text>
                  <Text style={styles.emptySubtext}>Only confirmed/completed appointments are shown</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleCreateNewPrescription}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✅</Text>
            </View>
            <Text style={styles.successTitle}>Prescription Submitted!</Text>
            <Text style={styles.successMessage}>Prescription has been sent successfully</Text>
            
            {submittedPrescription && (
              <View style={styles.successDetails}>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Medicines:</Text>
                  <Text style={styles.successDetailValue}>{submittedPrescription.itemCount} items</Text>
                </View>
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Submitted:</Text>
                  <Text style={styles.successDetailValue}>{submittedPrescription.submittedAt}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.successButton} onPress={handleCreateNewPrescription}>
              <Text style={styles.successButtonText}>Create New Prescription</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  card: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 12,
    margin: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  selectButton: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderRadius: MedicalTheme.borderRadius.md,
    paddingVertical: MedicalTheme.spacing.md,
    alignItems: "center",
    ...MedicalTheme.shadows.md,
    shadowColor: MedicalTheme.colors.medicalBlue,
  },
  selectButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  selectedAppointmentCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: MedicalTheme.colors.medicalBlue,
  },
  selectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  selectedPatientName: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MedicalTheme.colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  clearButtonText: {
    color: MedicalTheme.colors.error,
    fontSize: 16,
    fontWeight: "700",
  },
  selectedDetail: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    marginTop: 4,
  },
  voiceContainer: {
    marginTop: 8,
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  recordingButton: {
    backgroundColor: "#dc2626",
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "white",
  },
  micIcon: {
    fontSize: 20,
  },
  voiceButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  voiceTextContainer: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#059669",
  },
  voiceTextLabel: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  voiceText: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 20,
  },
  formRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    minHeight: 48,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  addButton: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonDisabled: {
    backgroundColor: "#cbd5e1",
    opacity: 0.6,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  itemsHeader: {
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemNumberText: {
    color: MedicalTheme.colors.textInverse,
    fontWeight: "700",
    fontSize: 13,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    color: "#dc2626",
    fontSize: 18,
    fontWeight: "700",
  },
  itemDetails: {
    marginTop: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  itemLabel: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    width: 80,
  },
  itemValue: {
    flex: 1,
    fontSize: 14,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "500",
  },
  submitContainer: {
    padding: 12,
    paddingBottom: 24,
  },
  submitButton: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: MedicalTheme.colors.medicalBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#cbd5e1",
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  submitHelp: {
    color: "#dc2626",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: MedicalTheme.colors.borderDark,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#dc2626",
    fontSize: 18,
    fontWeight: "700",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 12,
    fontSize: 14,
  },
  appointmentCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  appointmentDate: {
    fontSize: 15,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 8,
  },
  appointmentPatient: {
    fontSize: 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  appointmentReason: {
    fontSize: 12,
    color: MedicalTheme.colors.dark.textSecondary,
    fontStyle: "italic",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  emptySubtext: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
  successModalContent: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 30,
    width: "100%",
    maxWidth: 450,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#d1fae5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 48,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 15,
    color: "#059669",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "600",
  },
  successDetails: {
    width: "100%",
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  successDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  successDetailLabel: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  successDetailValue: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  successButton: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
  },
  successButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
});
