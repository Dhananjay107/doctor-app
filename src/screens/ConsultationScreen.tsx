import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useAppSelector } from "../store/hooks";
import Toast from "react-native-toast-message";
import { MedicalTheme } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { recordingService } from "../services/recordingService";
import { transcribeAudio, getAISuggestions, TranscriptionResult } from "../services/transcriptionService";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface ConsultationParams {
  Consultation: {
    appointmentId: string;
    patientId: string;
    patientName: string;
    consultationType: "ONLINE" | "OFFLINE";
    baseFee?: number;
  };
}

type ConsultationRouteProp = RouteProp<ConsultationParams, "Consultation">;

export default function ConsultationScreen() {
  const route = useRoute<ConsultationRouteProp>();
  const navigation = useNavigation();
  const { user, token } = useAppSelector((state) => state.auth);
  const { appointmentId, patientId, patientName, consultationType, baseFee = 500 } = route.params;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<TranscriptionResult["suggestions"] | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [consultationFee, setConsultationFee] = useState(baseFee);
  const [extraFees, setExtraFees] = useState<Array<{ description: string; amount: number }>>([]);
  const [extraFeeDescription, setExtraFeeDescription] = useState("");
  const [extraFeeAmount, setExtraFeeAmount] = useState("");
  const [submittingBilling, setSubmittingBilling] = useState(false);
  const [consultationComplete, setConsultationComplete] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoRecordStartedRef = useRef(false);

  // Auto-start recording for online consultations
  useEffect(() => {
    if (consultationType === "ONLINE" && !autoRecordStartedRef.current) {
      autoRecordStartedRef.current = true;
      handleStartRecording();
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      recordingService.reset();
    };
  }, [consultationType]);

  // Update recording duration
  useEffect(() => {
    if (isRecording) {
      durationIntervalRef.current = setInterval(() => {
        const state = recordingService.getState();
        setRecordingDuration(state.duration);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      if (!recordingService.isSupported()) {
        Toast.show({
          type: "error",
          text1: "Recording Not Supported",
          text2: "Audio recording is not supported on this device",
        });
        return;
      }

      await recordingService.startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Recording Failed",
        text2: error.message || "Failed to start recording",
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      const audioBlob = recordingService.stopRecording();
      setIsRecording(false);

      if (!audioBlob) {
        Toast.show({
          type: "error",
          text1: "No Recording",
          text2: "No audio was recorded",
        });
        return;
      }

      // Transcribe the audio
      setIsTranscribing(true);
      try {
        const result = await transcribeAudio(audioBlob, token!);
        setTranscript(result.transcript);

        // Get AI suggestions
        if (result.transcript) {
          try {
            const suggestions = await getAISuggestions(result.transcript, token!);
            setAiSuggestions(suggestions);
          } catch (suggestionError) {
            console.error("Failed to get AI suggestions:", suggestionError);
          }
        }
      } catch (transcribeError: any) {
        Toast.show({
          type: "error",
          text1: "Transcription Failed",
          text2: transcribeError.message || "Failed to transcribe audio",
        });
      } finally {
        setIsTranscribing(false);
      }
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to stop recording",
      });
    }
  };

  const handleAddExtraFee = () => {
    if (!extraFeeDescription.trim() || !extraFeeAmount.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill all fields",
      });
      return;
    }

    const amount = parseFloat(extraFeeAmount);
    if (isNaN(amount) || amount <= 0) {
      Toast.show({
        type: "error",
        text1: "Invalid Amount",
        text2: "Please enter a valid amount",
      });
      return;
    }

    setExtraFees([
      ...extraFees,
      { description: extraFeeDescription.trim(), amount },
    ]);
    setExtraFeeDescription("");
    setExtraFeeAmount("");
  };

  const handleRemoveExtraFee = (index: number) => {
    setExtraFees(extraFees.filter((_, i) => i !== index));
  };

  const calculateTotalFee = () => {
    const extraTotal = extraFees.reduce((sum, fee) => sum + fee.amount, 0);
    return consultationFee + extraTotal;
  };

  const handleSubmitBilling = async () => {
    if (!token) return;

    setSubmittingBilling(true);
    try {
      const totalFee = calculateTotalFee();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const billingData = {
        appointmentId,
        patientId,
        consultationFee,
        extraFees,
        totalFee,
        transcript: transcript || null,
        aiSuggestions: aiSuggestions || null,
      };

      const res = await fetch(`${API_BASE}/api/appointments/${appointmentId}/billing`, {
        method: "POST",
        headers,
        body: JSON.stringify(billingData),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Billing Submitted",
          text2: `Total fee: ₹${totalFee.toFixed(2)}`,
        });
        setShowBillingModal(false);
        setConsultationComplete(true);
      } else {
        const data = await res.json();
        Toast.show({
          type: "error",
          text1: "Error",
          text2: data.message || "Failed to submit billing",
        });
      }
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to submit billing",
      });
    } finally {
      setSubmittingBilling(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Consultation</Text>
          <Text style={styles.subtitle}>
            {consultationType === "ONLINE" ? "📹 Online" : "🏥 Offline"} - {patientName}
          </Text>
        </View>

        {/* Recording Controls - Only for offline */}
        {consultationType === "OFFLINE" && (
          <View style={styles.recordingSection}>
            {!isRecording ? (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={handleStartRecording}
              >
                <LinearGradient
                  colors={[MedicalTheme.colors.error, MedicalTheme.colors.errorLight]}
                  style={styles.recordButtonGradient}
                >
                  <Text style={styles.recordButtonText}>🎤 Start Recording</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.recordingActive}>
                <View style={styles.recordingIndicator} />
                <Text style={styles.recordingText}>
                  Recording: {formatDuration(recordingDuration)}
                </Text>
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={handleStopRecording}
                >
                  <Text style={styles.stopButtonText}>⏹ Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Auto-recording indicator for online */}
        {consultationType === "ONLINE" && (
          <View style={styles.autoRecordingBanner}>
            <Text style={styles.autoRecordingText}>
              🔴 Auto-recording in progress...
              {isRecording && ` (${formatDuration(recordingDuration)})`}
            </Text>
            {isRecording && (
              <TouchableOpacity
                style={styles.stopAutoRecordButton}
                onPress={handleStopRecording}
              >
                <Text style={styles.stopAutoRecordText}>Stop Recording</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Transcription Status */}
        {isTranscribing && (
          <View style={styles.transcribingBanner}>
            <ActivityIndicator size="small" color={MedicalTheme.colors.primary} />
            <Text style={styles.transcribingText}>Transcribing conversation...</Text>
          </View>
        )}

        {/* Transcript */}
        {transcript && (
          <View style={styles.transcriptSection}>
            <Text style={styles.sectionTitle}>📝 Conversation Transcript</Text>
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          </View>
        )}

        {/* AI Suggestions */}
        {aiSuggestions && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionTitle}>🤖 AI Suggestions</Text>

            {aiSuggestions.diagnosis && aiSuggestions.diagnosis.length > 0 && (
              <View style={styles.suggestionBox}>
                <Text style={styles.suggestionLabel}>Diagnosis:</Text>
                {aiSuggestions.diagnosis.map((diag, idx) => (
                  <Text key={idx} style={styles.suggestionItem}>• {diag}</Text>
                ))}
              </View>
            )}

            {aiSuggestions.medicines && aiSuggestions.medicines.length > 0 && (
              <View style={styles.suggestionBox}>
                <Text style={styles.suggestionLabel}>Suggested Medicines:</Text>
                {aiSuggestions.medicines.map((med, idx) => (
                  <View key={idx} style={styles.medicineSuggestion}>
                    <Text style={styles.suggestionItem}>
                      • {med.name} - {med.dosage}, {med.frequency}, {med.duration}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {aiSuggestions.notes && (
              <View style={styles.suggestionBox}>
                <Text style={styles.suggestionLabel}>Notes:</Text>
                <Text style={styles.suggestionItem}>{aiSuggestions.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Billing Section */}
        {!consultationComplete && (
          <TouchableOpacity
            style={styles.billingButton}
            onPress={() => setShowBillingModal(true)}
          >
            <LinearGradient
              colors={MedicalTheme.colors.primaryGradient}
              style={styles.billingButtonGradient}
            >
              <Text style={styles.billingButtonText}>💰 Charge Consultation Fee</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {consultationComplete && (
          <View style={styles.completeBanner}>
            <Text style={styles.completeText}>✅ Consultation completed and billed</Text>
          </View>
        )}
      </ScrollView>

      {/* Billing Modal */}
      <Modal
        visible={showBillingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBillingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Consultation Billing</Text>

            <View style={styles.feeSection}>
              <Text style={styles.feeLabel}>Base Consultation Fee</Text>
              <TextInput
                style={styles.feeInput}
                value={consultationFee.toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text);
                  if (!isNaN(num) && num >= 0) {
                    setConsultationFee(num);
                  }
                }}
                keyboardType="numeric"
                placeholder="500"
              />
            </View>

            <View style={styles.extraFeesSection}>
              <Text style={styles.sectionTitle}>Extra Fees</Text>
              {extraFees.map((fee, idx) => (
                <View key={idx} style={styles.extraFeeItem}>
                  <View style={styles.extraFeeInfo}>
                    <Text style={styles.extraFeeDesc}>{fee.description}</Text>
                    <Text style={styles.extraFeeAmount}>₹{fee.amount.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeFeeButton}
                    onPress={() => handleRemoveExtraFee(idx)}
                  >
                    <Text style={styles.removeFeeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.addFeeForm}>
                <TextInput
                  style={styles.addFeeInput}
                  placeholder="Description (e.g., Procedure, Treatment)"
                  value={extraFeeDescription}
                  onChangeText={setExtraFeeDescription}
                />
                <TextInput
                  style={[styles.addFeeInput, styles.amountInput]}
                  placeholder="Amount"
                  value={extraFeeAmount}
                  onChangeText={setExtraFeeAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.addFeeButton}
                  onPress={handleAddExtraFee}
                >
                  <Text style={styles.addFeeButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Fee</Text>
              <Text style={styles.totalAmount}>₹{calculateTotalFee().toFixed(2)}</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowBillingModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submittingBilling && styles.submitButtonDisabled]}
                onPress={handleSubmitBilling}
                disabled={submittingBilling}
              >
                {submittingBilling ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Billing</Text>
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
    backgroundColor: MedicalTheme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: MedicalTheme.spacing.base,
  },
  header: {
    marginBottom: MedicalTheme.spacing.lg,
  },
  title: {
    fontSize: MedicalTheme.typography.fontSize["3xl"],
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  subtitle: {
    fontSize: MedicalTheme.typography.fontSize.base,
    color: MedicalTheme.colors.textSecondary,
  },
  recordingSection: {
    marginBottom: MedicalTheme.spacing.lg,
  },
  recordButton: {
    borderRadius: MedicalTheme.borderRadius.md,
    overflow: "hidden",
    ...MedicalTheme.shadows.md,
  },
  recordButtonGradient: {
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.lg,
    alignItems: "center",
  },
  recordButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  recordingActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.errorBg,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.md,
    gap: MedicalTheme.spacing.sm,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: MedicalTheme.colors.error,
  },
  recordingText: {
    flex: 1,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.error,
  },
  stopButton: {
    backgroundColor: MedicalTheme.colors.error,
    paddingVertical: MedicalTheme.spacing.xs,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
  },
  stopButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  autoRecordingBanner: {
    backgroundColor: MedicalTheme.colors.infoBg,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.md,
    marginBottom: MedicalTheme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  autoRecordingText: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.info,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
  },
  stopAutoRecordButton: {
    paddingVertical: MedicalTheme.spacing.xs,
    paddingHorizontal: MedicalTheme.spacing.sm,
  },
  stopAutoRecordText: {
    fontSize: MedicalTheme.typography.fontSize.xs,
    color: MedicalTheme.colors.info,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    textDecorationLine: "underline",
  },
  transcribingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: MedicalTheme.spacing.sm,
    backgroundColor: MedicalTheme.colors.infoBg,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.md,
    marginBottom: MedicalTheme.spacing.lg,
  },
  transcribingText: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.info,
  },
  transcriptSection: {
    marginBottom: MedicalTheme.spacing.lg,
  },
  sectionTitle: {
    fontSize: MedicalTheme.typography.fontSize.lg,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.sm,
  },
  transcriptBox: {
    backgroundColor: MedicalTheme.colors.surface,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
  },
  transcriptText: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.textPrimary,
    lineHeight: MedicalTheme.typography.lineHeight.relaxed * MedicalTheme.typography.fontSize.sm,
  },
  suggestionsSection: {
    marginBottom: MedicalTheme.spacing.lg,
  },
  suggestionBox: {
    backgroundColor: MedicalTheme.colors.surface,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.md,
    marginBottom: MedicalTheme.spacing.sm,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
  },
  suggestionLabel: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  suggestionItem: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.textSecondary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  medicineSuggestion: {
    marginBottom: MedicalTheme.spacing.xs,
  },
  billingButton: {
    borderRadius: MedicalTheme.borderRadius.md,
    overflow: "hidden",
    marginTop: MedicalTheme.spacing.base,
    ...MedicalTheme.shadows.md,
  },
  billingButtonGradient: {
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.lg,
    alignItems: "center",
  },
  billingButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  completeBanner: {
    backgroundColor: MedicalTheme.colors.successBg,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.md,
    marginTop: MedicalTheme.spacing.base,
  },
  completeText: {
    fontSize: MedicalTheme.typography.fontSize.base,
    color: MedicalTheme.colors.success,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: MedicalTheme.spacing.base,
  },
  modalContent: {
    backgroundColor: MedicalTheme.colors.surface,
    borderRadius: MedicalTheme.borderRadius.lg,
    padding: MedicalTheme.spacing.lg,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: MedicalTheme.typography.fontSize["2xl"],
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.lg,
    textAlign: "center",
  },
  feeSection: {
    marginBottom: MedicalTheme.spacing.lg,
  },
  feeLabel: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  feeInput: {
    backgroundColor: MedicalTheme.colors.background,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
    borderRadius: MedicalTheme.borderRadius.sm,
    padding: MedicalTheme.spacing.base,
    fontSize: MedicalTheme.typography.fontSize.base,
    color: MedicalTheme.colors.textPrimary,
  },
  extraFeesSection: {
    marginBottom: MedicalTheme.spacing.lg,
  },
  extraFeeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.background,
    padding: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    marginBottom: MedicalTheme.spacing.sm,
  },
  extraFeeInfo: {
    flex: 1,
  },
  extraFeeDesc: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  extraFeeAmount: {
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.primary,
  },
  removeFeeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MedicalTheme.colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  removeFeeText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  addFeeForm: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.sm,
    marginTop: MedicalTheme.spacing.sm,
  },
  addFeeInput: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.background,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
    borderRadius: MedicalTheme.borderRadius.sm,
    padding: MedicalTheme.spacing.base,
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.textPrimary,
  },
  amountInput: {
    flex: 0.5,
  },
  addFeeButton: {
    backgroundColor: MedicalTheme.colors.primary,
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  addFeeButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: MedicalTheme.spacing.base,
    backgroundColor: MedicalTheme.colors.primary,
    borderRadius: MedicalTheme.borderRadius.md,
    marginBottom: MedicalTheme.spacing.lg,
  },
  totalLabel: {
    fontSize: MedicalTheme.typography.fontSize.lg,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textInverse,
  },
  totalAmount: {
    fontSize: MedicalTheme.typography.fontSize["2xl"],
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textInverse,
  },
  modalActions: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.base,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.background,
  },
  cancelButtonText: {
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.textSecondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textInverse,
  },
});

