import { useState, useRef, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from "react-native";

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
}

export default function TimePicker({ value, onChange, placeholder = "Select Time" }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => [0, 15, 30, 45], []);

  const formatTime = (hour: number, minute: number, period: "AM" | "PM") => {
    let hour24 = hour;
    if (period === "PM" && hour !== 12) hour24 = hour + 12;
    if (period === "AM" && hour === 12) hour24 = 0;
    const hourStr = String(hour24).padStart(2, "0");
    const minuteStr = String(minute).padStart(2, "0");
    return `${hourStr}:${minuteStr}`;
  };

  const handleTimeSelect = () => {
    const time = formatTime(selectedHour, selectedMinute, ampm);
    onChange(time);
    setShowPicker(false);
  };

  const formatDisplayTime = (time: string) => {
    if (!time) return "";
    const [hour, minute] = time.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
  };

  useEffect(() => {
    if (value && showPicker) {
      const [hour, minute] = value.split(":").map(Number);
      const hour12 = hour % 12 || 12;
      setSelectedHour(hour12);
      setSelectedMinute(minute);
      setAmpm(hour >= 12 ? "PM" : "AM");

      setTimeout(() => {
        const hourIndex = hours.indexOf(hour12);
        const minuteIndex = minutes.indexOf(minute);
        if (hourScrollRef.current && hourIndex >= 0) {
          hourScrollRef.current.scrollTo({ y: hourIndex * 50, animated: true });
        }
        if (minuteScrollRef.current && minuteIndex >= 0) {
          minuteScrollRef.current.scrollTo({ y: minuteIndex * 50, animated: true });
        }
      }, 100);
    }
  }, [showPicker, value, hours, minutes]);

  return (
    <>
      <TouchableOpacity
        style={styles.timeInput}
        onPress={() => {
          if (value) {
            const [hour, minute] = value.split(":").map(Number);
            const hour12 = hour % 12 || 12;
            setSelectedHour(hour12);
            setSelectedMinute(minute);
            setAmpm(hour >= 12 ? "PM" : "AM");
          }
          setShowPicker(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.timeInputText, !value && styles.placeholderText]}>
          {value ? formatDisplayTime(value) : placeholder}
        </Text>
        <Text style={styles.clockIcon}>🕐</Text>
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.govHeader}>
              <View style={styles.govHeaderContent}>
                <View style={styles.govLogo}>
                  <Text style={styles.govLogoText}>🕐</Text>
                </View>
                <View style={styles.govHeaderText}>
                  <Text style={styles.govTitle}>Government Medical Services</Text>
                  <Text style={styles.govSubtitle}>Select Time</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={styles.govCloseButton}
              >
                <Text style={styles.govCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timeDisplayContainer}>
              <Text style={styles.timeDisplayLabel}>SELECTED TIME</Text>
              <Text style={styles.timeDisplayText}>
                {formatDisplayTime(formatTime(selectedHour, selectedMinute, ampm))}
              </Text>
            </View>

            <View style={styles.timePickerContainer}>
              <View style={styles.timeColumn}>
                <Text style={styles.columnLabel}>HOUR</Text>
                <View style={styles.scrollContainer}>
                  <ScrollView 
                    ref={hourScrollRef}
                    style={styles.scrollView} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                  >
                    {hours.map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.timeOption,
                          selectedHour === hour && styles.selectedTimeOption,
                        ]}
                        onPress={() => setSelectedHour(hour)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            selectedHour === hour && styles.selectedTimeOptionText,
                          ]}
                        >
                          {String(hour).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={styles.separator}>:</Text>

              <View style={styles.timeColumn}>
                <Text style={styles.columnLabel}>MINUTE</Text>
                <View style={styles.scrollContainer}>
                  <ScrollView 
                    ref={minuteScrollRef}
                    style={styles.scrollView} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                  >
                    {minutes.map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.timeOption,
                          selectedMinute === minute && styles.selectedTimeOption,
                        ]}
                        onPress={() => setSelectedMinute(minute)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            selectedMinute === minute && styles.selectedTimeOptionText,
                          ]}
                        >
                          {String(minute).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.ampmColumn}>
                <Text style={styles.columnLabel}>PERIOD</Text>
                <View style={styles.ampmContainer}>
                  <TouchableOpacity
                    style={[
                      styles.ampmButton,
                      ampm === "AM" && styles.selectedAmpmButton,
                    ]}
                    onPress={() => setAmpm("AM")}
                  >
                    <Text
                      style={[
                        styles.ampmText,
                        ampm === "AM" && styles.selectedAmpmText,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.ampmButton,
                      ampm === "PM" && styles.selectedAmpmButton,
                    ]}
                    onPress={() => setAmpm("PM")}
                  >
                    <Text
                      style={[
                        styles.ampmText,
                        ampm === "PM" && styles.selectedAmpmText,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPicker(false)}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleTimeSelect}
              >
                <Text style={styles.confirmButtonText}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  timeInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  timeInputText: {
    fontSize: 15,
    color: "#111827",
    flex: 1,
  },
  placeholderText: {
    color: "#9ca3af",
  },
  clockIcon: {
    fontSize: 20,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    width: "100%",
    maxWidth: 420,
    borderWidth: 2,
    borderColor: "#1e40af",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  govHeader: {
    backgroundColor: "#1e40af",
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "#1e3a8a",
  },
  govHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  govLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  govLogoText: {
    fontSize: 24,
  },
  govHeaderText: {
    flex: 1,
  },
  govTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  govSubtitle: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "500",
  },
  govCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#b91c1c",
  },
  govCloseButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "700",
  },
  timeDisplayContainer: {
    backgroundColor: "#f9fafb",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
  },
  timeDisplayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timeDisplayText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1e40af",
    letterSpacing: 1,
  },
  timePickerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
    gap: 12,
  },
  timeColumn: {
    flex: 1,
    alignItems: "center",
    maxWidth: 100,
  },
  ampmColumn: {
    flex: 1,
    alignItems: "center",
    maxWidth: 100,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scrollContainer: {
    height: 200,
    width: "100%",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 75,
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginVertical: 1,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "#ffffff",
    minHeight: 50,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedTimeOption: {
    backgroundColor: "#1e40af",
    borderColor: "#1e3a8a",
    borderWidth: 2,
  },
  timeOptionText: {
    fontSize: 18,
    color: "#374151",
    fontWeight: "600",
  },
  selectedTimeOptionText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  separator: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e40af",
    marginTop: 40,
    marginHorizontal: 4,
  },
  ampmContainer: {
    width: "100%",
    gap: 8,
  },
  ampmButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    minHeight: 50,
    justifyContent: "center",
  },
  selectedAmpmButton: {
    backgroundColor: "#1e40af",
    borderColor: "#1e3a8a",
  },
  ampmText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectedAmpmText: {
    color: "#ffffff",
  },
  actionButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: "#1e40af",
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e3a8a",
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});