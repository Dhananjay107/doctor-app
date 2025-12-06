import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAppSelector } from "../store/hooks";
import { MedicalTheme } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import AppointmentIcon from "../components/icons/AppointmentIcon";
import PrescriptionIcon from "../components/icons/PrescriptionIcon";
import DocumentIcon from "../components/icons/DocumentIcon";
import MedicineIcon from "../components/icons/MedicineIcon";
import UserIcon from "../components/icons/UserIcon";
import StatsIcon from "../components/icons/StatsIcon";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface HistoryItem {
  _id: string;
  patientId: string;
  patientName: string;
  historyType: string;
  appointmentId?: string;
  appointmentDate?: string;
  appointmentStatus?: string;
  prescriptionId?: string;
  prescriptionItems?: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  prescriptionNotes?: string;
  reportRequest?: string;
  diagnosis?: string;
  treatment?: string;
  doctorNotes?: string;
  createdAt: string;
}

interface DoctorStats {
  totalPatients: number;
  totalAppointments: number;
  totalPrescriptions: number;
  totalReports: number;
}

export default function PatientHistoryScreen() {
  const { user, token } = useAppSelector((state) => state.auth);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");

  const fetchHistory = useCallback(async (showLoading: boolean = true) => {
    if (!user?.id || !token) return;

    try {
      if (showLoading) setLoading(true);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      const [historyRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/doctor-history?limit=100`, { headers }),
        fetch(`${API_BASE}/api/doctor-history/stats`, { headers }),
      ]);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        console.log("📋 Fetched history data:", historyData.length, "items");
        setHistory(Array.isArray(historyData) ? historyData : []);
      } else {
        const errorData = await historyRes.json().catch(() => ({}));
        console.error("❌ Failed to fetch history:", historyRes.status, errorData);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: errorData.message || "Failed to load patient history",
          visibilityTime: 3000,
        });
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log("📊 Fetched stats data:", statsData);
        setStats(statsData);
      } else {
        const errorData = await statsRes.json().catch(() => ({}));
        console.error("❌ Failed to fetch stats:", statsRes.status, errorData);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load patient history",
        visibilityTime: 3000,
      });
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(false);
  }, [fetchHistory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getHistoryIcon = (type: string) => {
    switch (type) {
      case "APPOINTMENT":
        return <AppointmentIcon width={24} height={24} color={MedicalTheme.colors.medicalBlue} />;
      case "PRESCRIPTION":
        return <PrescriptionIcon width={24} height={24} color="#22c55e" />;
      case "REPORT_REQUEST":
      case "REPORT_RECEIVED":
        return <DocumentIcon width={24} height={24} color="#f59e0b" />;
      case "MEDICINE_PRESCRIBED":
        return <MedicineIcon width={24} height={24} color="#8b5cf6" />;
      default:
        return <DocumentIcon width={24} height={24} color={MedicalTheme.colors.medicalBlue} />;
    }
  };

  const getHistoryTypeLabel = (type: string) => {
    switch (type) {
      case "APPOINTMENT":
        return "Appointment";
      case "PRESCRIPTION":
        return "Prescription";
      case "REPORT_REQUEST":
        return "Report Request";
      case "REPORT_RECEIVED":
        return "Report Received";
      case "MEDICINE_PRESCRIBED":
        return "Medicine";
      case "DIAGNOSIS":
        return "Diagnosis";
      case "TREATMENT":
        return "Treatment";
      default:
        return type;
    }
  };

  const filteredHistory = selectedFilter === "ALL" 
    ? history 
    : history.filter((item) => item.historyType === selectedFilter);

  const filterOptions = [
    { value: "ALL", label: "All" },
    { value: "APPOINTMENT", label: "Appointments" },
    { value: "PRESCRIPTION", label: "Prescriptions" },
    { value: "REPORT_REQUEST", label: "Reports" },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MedicalTheme.colors.medicalBlue} />
        <Text style={styles.loadingText}>Loading patient history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={MedicalTheme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconContainer}>
                  <UserIcon width={28} height={28} color="#ffffff" />
                </View>
                <Text style={styles.statValue}>{stats.totalPatients}</Text>
                <Text style={styles.statLabel}>Total Patients</Text>
              </LinearGradient>
            </View>

            <View style={styles.statCard}>
              <LinearGradient
                colors={["#22c55e", "#16a34a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconContainer}>
                  <AppointmentIcon width={28} height={28} color="#ffffff" />
                </View>
                <Text style={styles.statValue}>{stats.totalAppointments}</Text>
                <Text style={styles.statLabel}>Appointments</Text>
              </LinearGradient>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={["#8b5cf6", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconContainer}>
                  <PrescriptionIcon width={28} height={28} color="#ffffff" />
                </View>
                <Text style={styles.statValue}>{stats.totalPrescriptions}</Text>
                <Text style={styles.statLabel}>Prescriptions</Text>
              </LinearGradient>
            </View>

            <View style={styles.statCard}>
              <LinearGradient
                colors={["#f59e0b", "#d97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconContainer}>
                  <DocumentIcon width={28} height={28} color="#ffffff" />
                </View>
                <Text style={styles.statValue}>{stats.totalReports}</Text>
                <Text style={styles.statLabel}>Reports</Text>
              </LinearGradient>
            </View>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => setSelectedFilter(option.value)}
              style={[
                styles.filterTab,
                selectedFilter === option.value && styles.filterTabActive,
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  selectedFilter === option.value && styles.filterTabTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* History List */}
      <ScrollView
        style={styles.historyList}
        contentContainerStyle={styles.historyListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MedicalTheme.colors.medicalBlue} />}
      >
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <StatsIcon width={64} height={64} color={MedicalTheme.colors.dark.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No History Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === "ALL"
                ? "Your patient history will appear here"
                : `No ${filterOptions.find((o) => o.value === selectedFilter)?.label.toLowerCase()} found`}
            </Text>
          </View>
        ) : (
          filteredHistory.map((item) => (
            <View key={item._id} style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <View style={styles.historyIconContainer}>
                  {getHistoryIcon(item.historyType)}
                </View>
                <View style={styles.historyHeaderContent}>
                  <Text style={styles.historyPatientName}>{item.patientName}</Text>
                  <Text style={styles.historyType}>{getHistoryTypeLabel(item.historyType)}</Text>
                </View>
                <View style={styles.historyDateContainer}>
                  <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={styles.historyTime}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>

              {item.historyType === "APPOINTMENT" && item.appointmentDate && (
                <View style={styles.historyDetail}>
                  <Text style={styles.historyDetailLabel}>Appointment Date:</Text>
                  <Text style={styles.historyDetailValue}>
                    {formatDate(item.appointmentDate)} at {new Date(item.appointmentDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
              )}

              {item.historyType === "PRESCRIPTION" && item.prescriptionItems && item.prescriptionItems.length > 0 && (
                <View style={styles.historyDetail}>
                  <Text style={styles.historyDetailLabel}>Medicines Prescribed:</Text>
                  {item.prescriptionItems.map((med, idx) => (
                    <Text key={idx} style={styles.historyDetailValue}>
                      • {med.medicineName} - {med.dosage} ({med.frequency}) for {med.duration}
                    </Text>
                  ))}
                </View>
              )}

              {item.prescriptionNotes && (
                <View style={styles.historyDetail}>
                  <Text style={styles.historyDetailLabel}>Notes:</Text>
                  <Text style={styles.historyDetailValue}>{item.prescriptionNotes}</Text>
                </View>
              )}

              {item.reportRequest && (
                <View style={styles.historyDetail}>
                  <Text style={styles.historyDetailLabel}>Report Request:</Text>
                  <Text style={styles.historyDetailValue}>{item.reportRequest}</Text>
                </View>
              )}

              {item.diagnosis && (
                <View style={styles.historyDetail}>
                  <Text style={styles.historyDetailLabel}>Diagnosis:</Text>
                  <Text style={styles.historyDetailValue}>{item.diagnosis}</Text>
                </View>
              )}

              {item.treatment && (
                <View style={styles.historyDetail}>
                  <Text style={styles.historyDetailLabel}>Treatment:</Text>
                  <Text style={styles.historyDetailValue}>{item.treatment}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  statCardGradient: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  statIconContainer: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: MedicalTheme.colors.borderDark,
  },
  filterScroll: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: MedicalTheme.colors.dark.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  filterTabActive: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderColor: MedicalTheme.colors.medicalBlue,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  filterTabTextActive: {
    color: "#ffffff",
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  historyCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  historyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyHeaderContent: {
    flex: 1,
  },
  historyPatientName: {
    fontSize: 16,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  historyType: {
    fontSize: 12,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyDateContainer: {
    alignItems: "flex-end",
  },
  historyDate: {
    fontSize: 12,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 11,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  historyDetail: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
  },
  historyDetailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyDetailValue: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textPrimary,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

