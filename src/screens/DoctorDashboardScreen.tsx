import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Animated } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { logout } from "../store/authSlice";
import Toast from "react-native-toast-message";
import { formatFriendlyDate, formatFriendlyTime, getFriendlyStatus, getPatientName } from "../utils/helpers";
import { navigateToAuth } from "../utils/navigation";
import { MedicalTheme } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import AnimatedLogo from "../components/AnimatedLogo";
import { onSocketEvent, offSocketEvent } from "../services/socket";
import AppointmentIcon from "../components/icons/AppointmentIcon";
import PatientIcon from "../components/icons/PatientIcon";
import PrescriptionIcon from "../components/icons/PrescriptionIcon";
import StatsIcon from "../components/icons/StatsIcon";
import LabReportIcon from "../components/icons/LabReportIcon";
import MedicalHistoryIcon from "../components/icons/MedicalHistoryIcon";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface Appointment {
  _id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  reason?: string;
  channel?: string;
  patientName?: string; // Cached patient name
}

export default function DoctorDashboardScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user, token, isAuthenticated } = useAppSelector((state: any) => state.auth);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    today: 0,
    totalPatients: 0,
  });

  const doctorId = user?.id || null;
  const doctorName = user?.name || "Doctor";

  useEffect(() => {
    if (doctorId && token && isAuthenticated) {
      fetchAppointments(doctorId, token);
    }
  }, [doctorId, token, isAuthenticated]);

  // Socket.IO real-time updates for appointments
  useEffect(() => {
    if (!doctorId || !token || !isAuthenticated) return;

    console.log("🔌 Setting up socket listeners for dashboard...");

    const handleAppointmentCreated = (data: any) => {
      console.log("📅 Dashboard - New appointment received:", data);
      if (data.doctorId === doctorId || !data.doctorId) {
        console.log("✅ Dashboard - Refreshing appointments...");
        fetchAppointments(doctorId, token);
        Toast.show({
          type: "success",
          text1: "🎉 New Appointment!",
          text2: data.patientName ? `${data.patientName} booked an appointment` : "A new appointment has been booked",
          visibilityTime: 4000,
        });
      }
    };

    const handleAppointmentStatusUpdated = (data: any) => {
      console.log("📅 Dashboard - Appointment status updated:", data);
      if (data.doctorId === doctorId || !data.doctorId) {
        console.log("✅ Dashboard - Refreshing appointments after status update...");
        fetchAppointments(doctorId, token);
      }
    };

    onSocketEvent("appointment:created", handleAppointmentCreated);
    onSocketEvent("appointment:statusUpdated", handleAppointmentStatusUpdated);

    return () => {
      console.log("🔌 Cleaning up socket listeners for dashboard...");
      offSocketEvent("appointment:created", handleAppointmentCreated);
      offSocketEvent("appointment:statusUpdated", handleAppointmentStatusUpdated);
    };
  }, [doctorId, token, isAuthenticated, fetchAppointments]);

  useEffect(() => {
    if (!isAuthenticated && !loading && doctorId) {
      Toast.show({
        type: "error",
        text1: "Session Expired",
        text2: "Please login again",
        visibilityTime: 3000,
      });
    }
  }, [isAuthenticated, loading, doctorId]);

  const fetchAppointments = useCallback(async (docId: string, token?: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const res = await fetch(`${API_BASE}/api/appointments?doctorId=${docId}`, { headers });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch: ${res.status}`);
      }
      
      const data = await res.json();
      const apts = Array.isArray(data) ? data : [];
      
      // Fetch patient names for recent appointments
      const recentAppointments = apts.slice(0, 5);
      const appointmentsWithNames = await Promise.all(
        recentAppointments.map(async (apt: Appointment) => {
          try {
            const patientName = await getPatientName(apt.patientId, token);
            return { ...apt, patientName };
          } catch (e) {
            console.error(`Failed to fetch patient name for ${apt.patientId}`, e);
            return { ...apt, patientName: `Patient ${apt.patientId.slice(-8)}` };
          }
        })
      );
      
      setAppointments(appointmentsWithNames);

      // Calculate stats
      const today = new Date().toDateString();
      // Fetch patient count from doctor history
      let totalPatients = 0;
      try {
        const statsRes = await fetch(`${API_BASE}/api/doctor-history/patient-count`, { headers });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          totalPatients = statsData.totalPatients || 0;
        }
      } catch (e) {
        console.error("Failed to fetch patient count", e);
      }

      setStats({
        pending: apts.filter((a: Appointment) => a.status === "PENDING").length,
        confirmed: apts.filter((a: Appointment) => a.status === "CONFIRMED").length,
        today: apts.filter((a: Appointment) => 
          new Date(a.scheduledAt).toDateString() === today
        ).length,
        totalPatients,
      });
    } catch (e: any) {
      console.error("Failed to fetch appointments", e);
      Toast.show({
        type: "error",
        text1: "Error Loading Data",
        text2: e.message || "Failed to fetch appointments. Please check your connection.",
        visibilityTime: 4000,
      });
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (doctorId && token) {
      await fetchAppointments(doctorId, token);
    }
  }, [doctorId, token, fetchAppointments]);

  const handleLogout = useCallback(async () => {
    // Prevent multiple clicks
    if (isLoggingOut) {
      return;
    }

    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            if (isLoggingOut) return;
            
            setIsLoggingOut(true);
            try {
              // Dispatch logout action (this will clear Redux state and storage)
              await dispatch(logout()).unwrap();
              
              // Show success message
              Toast.show({
                type: "success",
                text1: "Logged out successfully",
                text2: "Redirecting to login...",
                visibilityTime: 1500,
              });
              
              // Navigate to auth screen - App.tsx will handle this automatically when isAuthenticated becomes false
              // But we call navigateToAuth as a fallback to ensure navigation happens
              navigateToAuth();
              
            } catch (e: any) {
              console.error("Logout error", e);
              Toast.show({
                type: "error",
                text1: "Logout failed",
                text2: e.message || "Please try again",
                visibilityTime: 2000,
              });
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  }, [isLoggingOut, dispatch, navigation]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={MedicalTheme.colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Header with Logo */}
      <LinearGradient
        colors={MedicalTheme.colors.blueGreenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <AnimatedLogo size={60} animated={true} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>MediCare</Text>
            <Text style={styles.headerSubtitle}>Doctor Portal</Text>
            {doctorName && (
              <Text style={styles.doctorName}>👨‍⚕️ Dr. {doctorName}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity 
          onPress={handleLogout} 
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          activeOpacity={0.8}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={MedicalTheme.colors.textInverse} />
          ) : (
            <Text style={styles.logoutText}>Logout</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={MedicalTheme.colors.primary}
          />
        }
      >
        {/* Modern Stats Cards with SVG Icons */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => {
              navigation.navigate("Appointments" as never);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#f59e0b", "#fbbf24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <AppointmentIcon width={32} height={32} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => {
              navigation.navigate("Appointments" as never);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#10b981", "#34d399"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <AppointmentIcon width={32} height={32} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.confirmed}</Text>
              <Text style={styles.statLabel}>Confirmed</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => {
              navigation.navigate("Appointments" as never);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#0ea5e9", "#38bdf8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <AppointmentIcon width={32} height={32} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.today}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Patient Count Card */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={[styles.statCard, { flex: 1 }]}
            onPress={() => {
              navigation.navigate("Patients" as never);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#8b5cf6", "#a78bfa"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statCardGradient}
            >
              <View style={styles.statIconContainer}>
                <PatientIcon width={32} height={32} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.totalPatients}</Text>
              <Text style={styles.statLabel}>Total Patients</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Actions with SVG Icons */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithIcon}>
            <StatsIcon width={24} height={24} color={MedicalTheme.colors.primary} />
            <Text style={styles.cardTitle}>Quick Actions</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                navigation.navigate("Appointments" as never);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#0ea5e9", "#38bdf8"]}
                style={styles.actionButtonGradient}
              >
                <View style={styles.actionIconContainer}>
                  <AppointmentIcon width={28} height={28} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Appointments</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                navigation.navigate("Patients" as never);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#10b981", "#34d399"]}
                style={styles.actionButtonGradient}
              >
                <View style={styles.actionIconContainer}>
                  <PatientIcon width={28} height={28} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Patients</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                navigation.navigate("E-Prescriptions" as never);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#8b5cf6", "#a78bfa"]}
                style={styles.actionButtonGradient}
              >
                <View style={styles.actionIconContainer}>
                  <PrescriptionIcon width={28} height={28} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Prescriptions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Features */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithIcon}>
            <MedicalHistoryIcon width={24} height={24} color={MedicalTheme.colors.primary} />
            <Text style={styles.cardTitle}>Medical Tools</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Toast.show({
                  type: "info",
                  text1: "Lab Reports",
                  text2: "Feature coming soon",
                  visibilityTime: 2000,
                });
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#ef4444", "#f87171"]}
                style={styles.actionButtonGradient}
              >
                <View style={styles.actionIconContainer}>
                  <LabReportIcon width={28} height={28} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Lab Reports</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Toast.show({
                  type: "info",
                  text1: "Medical History",
                  text2: "Feature coming soon",
                  visibilityTime: 2000,
                });
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#06b6d4", "#22d3ee"]}
                style={styles.actionButtonGradient}
              >
                <View style={styles.actionIconContainer}>
                  <MedicalHistoryIcon width={28} height={28} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>History</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                navigation.navigate("Settings" as never);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#64748b", "#94a3b8"]}
                style={styles.actionButtonGradient}
              >
                <View style={styles.actionIconContainer}>
                  <StatsIcon width={28} height={28} color="#FFFFFF" />
                </View>
                <Text style={styles.actionText}>Analytics</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.card}>
          <LinearGradient
            colors={["#0ea5e9", "#38bdf8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardHeaderGradient}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderWithIcon}>
                <AppointmentIcon width={20} height={20} color="#FFFFFF" />
                <Text style={styles.cardTitleWhite}>Upcoming Appointments</Text>
              </View>
              <TouchableOpacity onPress={() => {
                navigation.navigate("Appointments" as never);
              }}>
                <Text style={styles.viewAllText}>View All →</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
          {appointments.length > 0 ? (
            appointments.map((apt) => (
              <TouchableOpacity
                key={apt._id}
                style={styles.appointmentCard}
                onPress={() => {
                  Toast.show({
                    type: "info",
                    text1: "Viewing Appointment Details",
                    text2: `Patient: ${apt.patientName || apt.patientId.slice(-8)}`,
                    visibilityTime: 1500,
                  });
                  navigation.navigate("Appointments" as never);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.appointmentContent}>
                  <View style={[styles.statusDot, {
                    backgroundColor: apt.status === "CONFIRMED" ? MedicalTheme.colors.success :
                      apt.status === "PENDING" ? MedicalTheme.colors.warning : MedicalTheme.colors.textSecondary
                  }]} />
                  <View style={styles.appointmentText}>
                    <Text style={styles.appointmentPatient}>
                      👤 {apt.patientName || `Patient ${apt.patientId.slice(-8)}`}
                    </Text>
                    <Text style={styles.patientId}>ID: {apt.patientId.slice(-8)}</Text>
                    <View style={styles.appointmentDetails}>
                      <Text style={styles.appointmentDetail}>
                        📅 {apt.scheduledAt ? formatFriendlyDate(apt.scheduledAt) : "N/A"}
                      </Text>
                      <Text style={styles.appointmentDetail}>
                        ⏰ {apt.scheduledAt ? formatFriendlyTime(apt.scheduledAt) : "N/A"}
                      </Text>
                      {apt.reason && (
                        <Text style={styles.appointmentDetail}>📝 {apt.reason}</Text>
                      )}
                      {apt.channel && (
                        <Text style={styles.appointmentDetail}>
                          {apt.channel === "VIDEO" ? "📹 Video Consultation" : "🏥 In-Person Visit"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: apt.status === "CONFIRMED" ? MedicalTheme.colors.successBg :
                    apt.status === "PENDING" ? MedicalTheme.colors.warningBg : MedicalTheme.colors.borderLight
                }]}>
                  <Text style={[styles.statusText, {
                    color: apt.status === "CONFIRMED" ? MedicalTheme.colors.success :
                      apt.status === "PENDING" ? MedicalTheme.colors.warning : MedicalTheme.colors.textSecondary
                  }]}>
                    {getFriendlyStatus(apt.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No upcoming appointments</Text>
            </View>
          )}
        </View>

        {/* Quick Prescription Entry */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithIcon}>
            <PrescriptionIcon width={24} height={24} color={MedicalTheme.colors.primary} />
            <Text style={styles.cardTitle}>Quick Prescription</Text>
          </View>
          <Text style={styles.hintText}>
            Create prescriptions quickly using voice or manual entry
          </Text>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("E-Prescriptions" as never);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#8b5cf6", "#a78bfa"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.prescriptionButton}
            >
              <View style={styles.prescriptionButtonContent}>
                <PrescriptionIcon width={20} height={20} color="#FFFFFF" />
                <Text style={styles.prescriptionButtonText}>Create Prescription</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F4FD', // Light blue background - VERY VISIBLE CHANGE
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: MedicalTheme.colors.textSecondary,
    marginTop: MedicalTheme.spacing.md,
    fontSize: MedicalTheme.typography.fontSize.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: MedicalTheme.spacing.xl,
    paddingTop: MedicalTheme.spacing.base,
  },
  header: {
    paddingTop: MedicalTheme.spacing["3xl"] + 10,
    paddingBottom: MedicalTheme.spacing.lg,
    paddingHorizontal: MedicalTheme.spacing.lg,
    backgroundColor: 'transparent', // Gradient will show through
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: MedicalTheme.spacing.base,
  },
  logoContainer: {
    marginRight: MedicalTheme.spacing.base,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize["2xl"] + 4,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    marginBottom: MedicalTheme.spacing.xs,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
  },
  doctorName: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    marginTop: MedicalTheme.spacing.xs,
  },
  logoutButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: MedicalTheme.borderRadius.md,
    paddingHorizontal: MedicalTheme.spacing.lg,
    paddingVertical: MedicalTheme.spacing.md,
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
  },
  govHeaderTop: {
    alignItems: "center",
    marginBottom: 12,
  },
  govOfficialBadge: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    letterSpacing: 2,
    textTransform: "uppercase",
    backgroundColor: MedicalTheme.colors.primaryDark,
    paddingHorizontal: MedicalTheme.spacing.md,
    paddingVertical: MedicalTheme.spacing.xs,
    borderRadius: MedicalTheme.borderRadius.sm,
  },
  govHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  govLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MedicalTheme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: MedicalTheme.spacing.base,
  },
  govLogoText: {
    fontSize: 28,
  },
  govHeaderText: {
    flex: 1,
  },
  govTitle: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.lg,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    marginBottom: MedicalTheme.spacing.sm,
    letterSpacing: 0.5,
  },
  govTitleDivider: {
    width: 50,
    height: 2,
    backgroundColor: MedicalTheme.colors.secondary,
    marginBottom: MedicalTheme.spacing.sm,
    borderRadius: 1,
  },
  govSubtitle: {
    color: MedicalTheme.colors.border,
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    letterSpacing: 0.3,
    marginBottom: MedicalTheme.spacing.sm,
  },
  govDoctorNameContainer: {
    marginTop: MedicalTheme.spacing.sm,
    paddingTop: MedicalTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  govDoctorNameLabel: {
    color: MedicalTheme.colors.border,
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: MedicalTheme.spacing.xs,
  },
  govDoctorName: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    letterSpacing: 0.3,
  },
  govLogoutButton: {
    backgroundColor: MedicalTheme.colors.error,
    borderRadius: MedicalTheme.borderRadius.sm,
    paddingHorizontal: MedicalTheme.spacing.lg,
    paddingVertical: MedicalTheme.spacing.md,
    borderWidth: 2,
    borderColor: MedicalTheme.colors.warning,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: MedicalTheme.spacing.base,
    marginTop: MedicalTheme.spacing.sm,
    marginBottom: MedicalTheme.spacing.sm,
    ...MedicalTheme.shadows.md,
    minWidth: 120,
  },
  govLogoutButtonDisabled: {
    opacity: 0.6,
  },
  govLogoutText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  govDivider: {
    height: 3,
    backgroundColor: MedicalTheme.colors.secondary,
    width: "100%",
  },
  statsRow: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.md,
    margin: MedicalTheme.spacing.base,
    marginBottom: MedicalTheme.spacing.base,
  },
  statCard: {
    flex: 1,
    borderRadius: MedicalTheme.borderRadius.lg,
    overflow: "hidden",
    ...MedicalTheme.shadows.lg,
  },
  statCardGradient: {
    padding: MedicalTheme.spacing.lg,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
  },
  statIconContainer: {
    marginBottom: MedicalTheme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  statIcon: {
    fontSize: 32,
    marginBottom: MedicalTheme.spacing.sm,
  },
  statNumber: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize["3xl"],
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    marginBottom: MedicalTheme.spacing.xs,
  },
  statLabel: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    textAlign: "center",
    opacity: 0.95,
  },
  card: {
    backgroundColor: '#FFFFFF', // WHITE CARDS - BIG CHANGE
    borderRadius: MedicalTheme.borderRadius.lg,
    margin: MedicalTheme.spacing.base,
    marginBottom: MedicalTheme.spacing.base,
    padding: MedicalTheme.spacing.xl,
    ...MedicalTheme.shadows.lg,
    borderWidth: 2,
    borderColor: '#0066FF', // BLUE BORDER - VERY VISIBLE
    elevation: 8,
  },
  cardHeaderGradient: {
    borderRadius: MedicalTheme.borderRadius.md,
    marginBottom: MedicalTheme.spacing.base,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: MedicalTheme.spacing.md,
  },
  cardHeaderWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: MedicalTheme.spacing.base,
  },
  cardTitle: {
    color: MedicalTheme.colors.primary,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    fontSize: MedicalTheme.typography.fontSize.xl,
  },
  cardTitleWhite: {
    color: "#FFFFFF",
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    fontSize: MedicalTheme.typography.fontSize.lg,
  },
  viewAllText: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    opacity: 0.9,
  },
  actionsRow: {
    flexDirection: "row",
    gap: MedicalTheme.spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: MedicalTheme.borderRadius.md,
    overflow: "hidden",
    ...MedicalTheme.shadows.md,
  },
  actionButtonGradient: {
    padding: MedicalTheme.spacing.lg,
    alignItems: "center",
    minHeight: 100,
    justifyContent: "center",
  },
  actionIconContainer: {
    marginBottom: MedicalTheme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: MedicalTheme.spacing.sm,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    textAlign: "center",
  },
  appointmentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: '#FFFFFF',
    borderRadius: MedicalTheme.borderRadius.md,
    padding: MedicalTheme.spacing.md,
    marginBottom: MedicalTheme.spacing.md,
    borderWidth: 2,
    borderColor: '#E0EFFF',
    ...MedicalTheme.shadows.md,
  },
  appointmentContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  appointmentText: {
    flex: 1,
  },
  appointmentPatient: {
    color: MedicalTheme.colors.primary,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    fontSize: MedicalTheme.typography.fontSize.base,
    marginBottom: MedicalTheme.spacing.xs,
  },
  patientId: {
    color: MedicalTheme.colors.textSecondary,
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
    marginBottom: MedicalTheme.spacing.sm,
  },
  appointmentDetails: {
    gap: 4,
  },
  appointmentDetail: {
    color: MedicalTheme.colors.textSecondary,
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MedicalTheme.borderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    color: MedicalTheme.colors.textSecondary,
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontStyle: "italic",
  },
  hintText: {
    color: MedicalTheme.colors.primary,
    fontSize: MedicalTheme.typography.fontSize.sm,
    marginBottom: MedicalTheme.spacing.base,
    lineHeight: 20,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
  },
  prescriptionButton: {
    borderRadius: MedicalTheme.borderRadius.md,
    paddingVertical: MedicalTheme.spacing.base,
    alignItems: "center",
    ...MedicalTheme.shadows.md,
    overflow: "hidden",
  },
  prescriptionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prescriptionButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    fontSize: MedicalTheme.typography.fontSize.base,
  },
});
