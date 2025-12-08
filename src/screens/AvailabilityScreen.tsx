import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useAppSelector } from "../store/hooks";
import { useFocusEffect } from "@react-navigation/native";
import DatePicker from "../components/DatePicker";
import TimePicker from "../components/TimePicker";
import Toast from "react-native-toast-message";
import { MedicalTheme } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface AvailabilitySlot {
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "ONLINE" | "OFFLINE";
  isActive: boolean;
}

export default function AvailabilityScreen() {
  const { user, token } = useAppSelector((state) => state.auth);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [slotType, setSlotType] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [isActive, setIsActive] = useState(true);

  const doctorId = user?.id || user?._id;

  useFocusEffect(
    useCallback(() => {
      if (doctorId && token) {
        fetchSlots();
      }
    }, [doctorId, token])
  );

  const fetchSlots = async () => {
    if (!doctorId || !token) return;

    setFetching(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(`${API_BASE}/api/availability?doctorId=${doctorId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSlots(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch slots", e);
    } finally {
      setFetching(false);
    }
  };

  const handleAddSlot = () => {
    setSelectedSlot(null);
    setDate("");
    setStartTime("");
    setEndTime("");
    setSlotType("ONLINE");
    setIsActive(true);
    setModalVisible(true);
  };

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setDate(slot.date);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setSlotType(slot.type);
    setIsActive(slot.isActive);
    setModalVisible(true);
  };

  const handleSaveSlot = async () => {
    if (!date || !startTime || !endTime) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill all fields",
      });
      return;
    }

    if (startTime >= endTime) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "End time must be after start time",
      });
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const slotData = {
        doctorId,
        date,
        startTime,
        endTime,
        type: slotType,
        isActive,
      };

      const url = selectedSlot?._id
        ? `${API_BASE}/api/availability/${selectedSlot._id}`
        : `${API_BASE}/api/availability`;
      const method = selectedSlot?._id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(slotData),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: selectedSlot ? "Slot Updated" : "Slot Added",
          text2: "Availability slot saved successfully",
        });
        setModalVisible(false);
        fetchSlots();
      } else {
        const data = await res.json();
        Toast.show({
          type: "error",
          text1: "Error",
          text2: data.message || "Failed to save slot",
        });
      }
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to save slot",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!slotId) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(`${API_BASE}/api/availability/${slotId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Slot Deleted",
          text2: "Availability slot removed successfully",
        });
        fetchSlots();
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to delete slot",
        });
      }
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to delete slot",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  if (fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={MedicalTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Availability Slots</Text>
          <Text style={styles.subtitle}>Manage your online and offline appointment slots</Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddSlot}>
          <LinearGradient
            colors={MedicalTheme.colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Text style={styles.addButtonText}>+ Add New Slot</Text>
          </LinearGradient>
        </TouchableOpacity>

        {slots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No availability slots set</Text>
            <Text style={styles.emptySubtext}>Add slots to allow patients to book appointments</Text>
          </View>
        ) : (
          <View style={styles.slotsContainer}>
            {slots.map((slot) => (
              <View key={slot._id || `${slot.date}-${slot.startTime}`} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <View style={styles.slotTypeBadge}>
                    <Text style={styles.slotTypeText}>
                      {slot.type === "ONLINE" ? "📹 Online" : "🏥 Offline"}
                    </Text>
                  </View>
                  <Switch
                    value={slot.isActive}
                    onValueChange={async () => {
                      const updatedSlot = { ...slot, isActive: !slot.isActive };
                      setLoading(true);
                      try {
                        const headers: Record<string, string> = {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        };
                        const res = await fetch(`${API_BASE}/api/availability/${slot._id}`, {
                          method: "PUT",
                          headers,
                          body: JSON.stringify({
                            doctorId,
                            date: updatedSlot.date,
                            startTime: updatedSlot.startTime,
                            endTime: updatedSlot.endTime,
                            type: updatedSlot.type,
                            isActive: updatedSlot.isActive,
                          }),
                        });
                        if (res.ok) {
                          fetchSlots();
                        }
                      } catch (e) {
                        console.error("Failed to update slot", e);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    trackColor={{ false: "#CBD5E1", true: MedicalTheme.colors.success }}
                  />
                </View>
                <Text style={styles.slotDate}>{formatDate(slot.date)}</Text>
                <Text style={styles.slotTime}>
                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </Text>
                <View style={styles.slotActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditSlot(slot)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => slot._id && handleDeleteSlot(slot._id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedSlot ? "Edit Slot" : "Add New Slot"}
            </Text>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalLabel}>Date</Text>
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder="Select date"
              />
            </View>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalLabel}>Start Time</Text>
              <TimePicker
                value={startTime}
                onChange={setStartTime}
                placeholder="Select start time"
              />
            </View>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalLabel}>End Time</Text>
              <TimePicker
                value={endTime}
                onChange={setEndTime}
                placeholder="Select end time"
              />
            </View>

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalLabel}>Appointment Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    slotType === "ONLINE" && styles.typeButtonActive,
                  ]}
                  onPress={() => setSlotType("ONLINE")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      slotType === "ONLINE" && styles.typeButtonTextActive,
                    ]}
                  >
                    📹 Online
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    slotType === "OFFLINE" && styles.typeButtonActive,
                  ]}
                  onPress={() => setSlotType("OFFLINE")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      slotType === "OFFLINE" && styles.typeButtonTextActive,
                    ]}
                  >
                    🏥 Offline
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalInputContainer}>
              <View style={styles.switchContainer}>
                <Text style={styles.modalLabel}>Active</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: "#CBD5E1", true: MedicalTheme.colors.success }}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSaveSlot}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  addButton: {
    borderRadius: MedicalTheme.borderRadius.md,
    marginBottom: MedicalTheme.spacing.lg,
    overflow: "hidden",
    ...MedicalTheme.shadows.md,
  },
  addButtonGradient: {
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: MedicalTheme.spacing["3xl"],
  },
  emptyText: {
    fontSize: MedicalTheme.typography.fontSize.xl,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.textSecondary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  emptySubtext: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.textTertiary,
    textAlign: "center",
  },
  slotsContainer: {
    gap: MedicalTheme.spacing.base,
  },
  slotCard: {
    backgroundColor: MedicalTheme.colors.surface,
    borderRadius: MedicalTheme.borderRadius.md,
    padding: MedicalTheme.spacing.base,
    ...MedicalTheme.shadows.sm,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
  },
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: MedicalTheme.spacing.sm,
  },
  slotTypeBadge: {
    backgroundColor: MedicalTheme.colors.infoBg,
    paddingHorizontal: MedicalTheme.spacing.sm,
    paddingVertical: MedicalTheme.spacing.xs,
    borderRadius: MedicalTheme.borderRadius.sm,
  },
  slotTypeText: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.info,
  },
  slotDate: {
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  slotTime: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    color: MedicalTheme.colors.textSecondary,
    marginBottom: MedicalTheme.spacing.base,
  },
  slotActions: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.sm,
    marginTop: MedicalTheme.spacing.sm,
  },
  editButton: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.primary,
    paddingVertical: MedicalTheme.spacing.sm,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    alignItems: "center",
  },
  editButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.error,
    paddingVertical: MedicalTheme.spacing.sm,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    alignItems: "center",
  },
  deleteButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
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
  modalInputContainer: {
    marginBottom: MedicalTheme.spacing.base,
  },
  modalLabel: {
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    color: MedicalTheme.colors.textPrimary,
    marginBottom: MedicalTheme.spacing.xs,
  },
  typeSelector: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    borderWidth: 2,
    borderColor: MedicalTheme.colors.border,
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.background,
  },
  typeButtonActive: {
    borderColor: MedicalTheme.colors.primary,
    backgroundColor: MedicalTheme.colors.infoBg,
  },
  typeButtonText: {
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
    color: MedicalTheme.colors.textSecondary,
  },
  typeButtonTextActive: {
    color: MedicalTheme.colors.primary,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.base,
    marginTop: MedicalTheme.spacing.lg,
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
  saveButton: {
    flex: 1,
    paddingVertical: MedicalTheme.spacing.base,
    paddingHorizontal: MedicalTheme.spacing.base,
    borderRadius: MedicalTheme.borderRadius.sm,
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    color: MedicalTheme.colors.textInverse,
  },
});

