import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minimumDate?: Date;
}

export default function DatePicker({ value, onChange, placeholder = "Select Date", minimumDate }: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const today = new Date();
  const minDate = minimumDate || today;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isDateDisabled = (day: number, month: number, year: number) => {
    const date = new Date(year, month, day);
    return date < minDate;
  };

  const handleDateSelect = (day: number) => {
    const month = String(selectedMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    onChange(`${selectedYear}-${month}-${dayStr}`);
    setShowCalendar(false);
  };

  const renderCalendar = () => {
    const days = daysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const calendarDays: (number | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= days; day++) {
      calendarDays.push(day);
    }

    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => {
              const newMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
              const newYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
              setSelectedMonth(newMonth);
              setSelectedYear(newYear);
            }}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthYearText}>
            {months[selectedMonth]} {selectedYear}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const newMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
              const newYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
              setSelectedMonth(newMonth);
              setSelectedYear(newYear);
            }}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekDaysRow}>
          {weekDays.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <View key={index} style={styles.calendarCell} />;
            }

            const isDisabled = isDateDisabled(day, selectedMonth, selectedYear);
            const selectedDate = value ? new Date(value) : null;
            const isSelected = selectedDate &&
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === selectedMonth &&
              selectedDate.getFullYear() === selectedYear;
            const isToday =
              today.getDate() === day &&
              today.getMonth() === selectedMonth &&
              today.getFullYear() === selectedYear;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.calendarCell,
                  isSelected && styles.selectedCell,
                  isToday && !isSelected && styles.todayCell,
                ]}
                onPress={() => !isDisabled && handleDateSelect(day)}
                disabled={isDisabled}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    isDisabled && styles.disabledDayText,
                    isSelected && styles.selectedDayText,
                    isToday && !isSelected && styles.todayDayText,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={() => setShowCalendar(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dateInputText, !value && styles.placeholderText]}>
          {value ? new Date(value).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }) : placeholder}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>

      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Government Header */}
            <View style={styles.govHeader}>
              <View style={styles.govHeaderContent}>
                <View style={styles.govLogo}>
                  <Text style={styles.govLogoText}>📅</Text>
                </View>
                <View style={styles.govHeaderText}>
                  <Text style={styles.govTitle}>Government Medical Services</Text>
                  <Text style={styles.govSubtitle}>Select Date</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowCalendar(false)}
                style={styles.govCloseButton}
              >
                <Text style={styles.govCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            {renderCalendar()}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dateInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  dateInputText: {
    fontSize: 15,
    color: "#111827",
    flex: 1,
  },
  placeholderText: {
    color: "#9ca3af",
  },
  calendarIcon: {
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
    maxWidth: 400,
    maxHeight: "80%",
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
  calendarContainer: {
    width: "100%",
    padding: 20,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  navButtonText: {
    fontSize: 24,
    color: "#1e40af",
    fontWeight: "700",
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  selectedCell: {
    backgroundColor: "#1e40af",
    borderRadius: 6,
  },
  todayCell: {
    backgroundColor: "#dbeafe",
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#1e40af",
  },
  calendarDayText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  disabledDayText: {
    color: "#d1d5db",
  },
  selectedDayText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  todayDayText: {
    color: "#1e40af",
    fontWeight: "700",
  },
});