import { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useAppSelector } from "../store/hooks";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../utils/navigation";
import { useAppointmentContext } from "../context/AppointmentContext";
import DatePicker from "../components/DatePicker";
import TimePicker from "../components/TimePicker";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatFriendlyDate, formatFriendlyTime, getFriendlyStatus, getPatientName } from "../utils/helpers";
import { onSocketEvent, offSocketEvent } from "../services/socket";
import { LinearGradient } from "expo-linear-gradient";
import { MedicalTheme } from "../constants/theme";
import SearchIcon from "../components/icons/SearchIcon";
import UserIcon from "../components/icons/UserIcon";
import AppointmentIcon from "../components/icons/AppointmentIcon";
import DocumentIcon from "../components/icons/DocumentIcon";
import MedicineIcon from "../components/icons/MedicineIcon";
import WarningIcon from "../components/icons/WarningIcon";
import CheckIcon from "../components/icons/CheckIcon";
import StatsIcon from "../components/icons/StatsIcon";
import ClockIcon from "../components/icons/ClockIcon";
import ArrowRightIcon from "../components/icons/ArrowRightIcon";
import RefreshIcon from "../components/icons/RefreshIcon";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface Appointment {
  _id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  reason?: string;
  channel?: string;
  patientName?: string;
  age?: number;
  issue?: string;
  hospitalId?: string;
  cancellationReason?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AppointmentsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { user, token } = useAppSelector((state) => state.auth);
  const { setPendingCount } = useAppointmentContext();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"PENDING" | "CONFIRMED" | "CANCELLED">("PENDING");
  const [patientHistory, setPatientHistory] = useState<{
    prescriptions: any[];
    medicalRecord: any;
    patientId: string;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [appointmentDetailsModal, setAppointmentDetailsModal] = useState(false);
  const [requestReportModal, setRequestReportModal] = useState(false);
  const [reportRequest, setReportRequest] = useState("");
  const doctorId = user?.id || null;

  const fetchPatientHistory = async (patientId: string) => {
    if (!token || !patientId) return;
    
    setLoadingHistory(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers.Authorization = `Bearer ${token}`;

      // Fetch prescriptions, medical records, and patient records
      const [prescriptionsRes, recordsRes] = await Promise.all([
        fetch(`${API_BASE}/api/prescriptions?patientId=${patientId}`, { headers }).catch(() => null),
        fetch(`${API_BASE}/api/patient-records/${patientId}`, { headers }).catch(() => null),
      ]);

      const prescriptions = prescriptionsRes?.ok ? await prescriptionsRes.json().catch(() => []) : [];
      const records = recordsRes?.ok ? await recordsRes.json().catch(() => null) : null;

      setPatientHistory({
        prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
        medicalRecord: records || null,
        patientId,
      });
    } catch (e) {
      console.error("Failed to fetch patient history", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to load patient history",
        visibilityTime: 3000,
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = async (apt: Appointment) => {
    setSelectedAppointment(apt);
    setHistoryModalVisible(true);
    await fetchPatientHistory(apt.patientId);
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setAppointmentDetailsModal(true);
  };

  const handleRequestReport = () => {
    setAppointmentDetailsModal(false);
    setRequestReportModal(true);
  };

  const handleProceedToTreatment = () => {
    if (!selectedAppointment) return;
    setAppointmentDetailsModal(false);
    // Navigate to prescription flow
    (navigation as any).navigate("PrescriptionFlow", {
      appointmentId: selectedAppointment._id,
      patientId: selectedAppointment.patientId,
      patientName: selectedAppointment.patientName || `Patient ${selectedAppointment.patientId.slice(-8)}`,
      age: selectedAppointment.age || 0,
      issue: selectedAppointment.issue || selectedAppointment.reason || "No issue specified",
    });
  };

  const handleSubmitReportRequest = async () => {
    if (!selectedAppointment || !reportRequest.trim()) {
      Toast.show({
        type: "error",
        text1: "Report Request Required",
        text2: "Please specify what report you need",
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setLoading(true);
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

      // Send report request to patient (via conversation or notification)
      // For now, we'll create a conversation message
      const res = await fetch(`${API_BASE}/api/conversations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          patientId: selectedAppointment.patientId,
          doctorId: doctorId,
          hospitalId: selectedAppointment.hospitalId || "",
          conversationType: "APPOINTMENT",
        }),
      });

      if (res.ok) {
        const conversation = await res.json();
        // Send message with report request
        await fetch(`${API_BASE}/api/conversations/${conversation._id}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            content: `Report Request: ${reportRequest.trim()}`,
            senderRole: "DOCTOR",
          }),
        });
      }

      Toast.show({
        type: "success",
        text1: "Report Request Sent",
        text2: "Patient will be notified to provide the requested report",
        visibilityTime: 3000,
      });

      setRequestReportModal(false);
      setReportRequest("");
      setSelectedAppointment(null);
    } catch (e: any) {
      console.error("Failed to send report request", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e.message || "Failed to send report request",
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("showQuickStatsFromDrawer").then((value) => {
        if (value === "true") {
          setShowQuickStats(true);
          AsyncStorage.removeItem("showQuickStatsFromDrawer");
        }
      });

      if (user?.id && token && user.role === "DOCTOR") {
        fetchAppointments(user.id, token, true);
      }
    }, [user?.id, token])
  );

  // Socket.IO real-time updates for appointments
  useEffect(() => {
    if (!user?.id || !token || user.role !== "DOCTOR") return;

    const handleAppointmentCreated = (data: any) => {
      console.log("📅 New appointment received:", data);
      console.log("📅 Current user ID:", user.id);
      console.log("📅 Data doctorId:", data.doctorId);
      
      // Since event is emitted to doctor's room, we can trust it's for this doctor
      if (data.doctorId === user.id || !data.doctorId) {
        console.log("✅ Refreshing appointments list...");
        fetchAppointments(user.id, token, false);
        Toast.show({
          type: "success",
          text1: "🎉 New Appointment!",
          text2: data.patientName ? `${data.patientName} booked an appointment` : "A new appointment has been booked",
          visibilityTime: 4000,
        });
      }
    };

    const handleAppointmentStatusUpdated = (data: any) => {
      console.log("📅 Appointment status updated:", data);
      console.log("📅 Current user ID:", user.id);
      console.log("📅 Data doctorId:", data.doctorId);
      
      // Refresh if this appointment is for this doctor
      if (data.doctorId === user.id || !data.doctorId) {
        console.log("✅ Refreshing appointments list after status update...");
        fetchAppointments(user.id, token, false);
        
        // Show notification for status changes
        const statusMessages: Record<string, string> = {
          CONFIRMED: "Appointment confirmed",
          COMPLETED: "Appointment completed",
          CANCELLED: "Appointment cancelled",
        };
        
        if (statusMessages[data.status]) {
          Toast.show({
            type: data.status === "CANCELLED" ? "error" : "success",
            text1: "Status Updated",
            text2: statusMessages[data.status],
            visibilityTime: 3000,
          });
        }
      }
    };

    onSocketEvent("appointment:created", handleAppointmentCreated);
    onSocketEvent("appointment:statusUpdated", handleAppointmentStatusUpdated);

    return () => {
      offSocketEvent("appointment:created", handleAppointmentCreated);
      offSocketEvent("appointment:statusUpdated", handleAppointmentStatusUpdated);
    };
  }, [user?.id, token]);

  // Real-time notifications for upcoming appointments
  useEffect(() => {
    if (!appointments.length) return;

    const notifiedKeys = new Set<string>();

    const checkUpcomingAppointments = () => {
      const now = new Date();

      appointments.forEach((apt) => {
        if (apt.status === "CONFIRMED" || apt.status === "PENDING") {
          const appointmentTime = new Date(apt.scheduledAt);
          const timeDiff = appointmentTime.getTime() - now.getTime();
          
          // Notify 15 minutes before appointment
          const fifteenMinutes = 15 * 60 * 1000;
          const oneMinute = 60 * 1000;
          const notificationKey15 = `notif_${apt._id}_15min`;
          const notificationKeyNow = `notif_${apt._id}_now`;
          
          if (timeDiff > 0 && timeDiff <= fifteenMinutes && timeDiff > fifteenMinutes - oneMinute) {
            if (!notifiedKeys.has(notificationKey15)) {
              const minutesUntil = Math.floor(timeDiff / 60000);
              Toast.show({
                type: "info",
                text1: "Appointment Reminder",
                text2: `Appointment with ${apt.patientName || "patient"} in ${minutesUntil} minutes at ${formatFriendlyTime(apt.scheduledAt)}`,
                visibilityTime: 5000,
              });
              notifiedKeys.add(notificationKey15);
            }
          }
          
          // Notify when appointment time arrives
          if (timeDiff > 0 && timeDiff <= oneMinute) {
            if (!notifiedKeys.has(notificationKeyNow)) {
              Toast.show({
                type: "info",
                text1: "Appointment Time",
                text2: `Appointment with ${apt.patientName || "patient"} is now at ${formatFriendlyTime(apt.scheduledAt)}`,
                visibilityTime: 5000,
              });
              notifiedKeys.add(notificationKeyNow);
            }
          }
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkUpcomingAppointments, 60000);
    
    // Initial check
    checkUpcomingAppointments();

    return () => clearInterval(interval);
  }, [appointments]);

  const fetchAppointments = async (docId: string, authToken?: string, showLoading: boolean = true) => {
    try {
      if (showLoading) {
      setFetching(true);
      }
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
      const appointmentsList = Array.isArray(data) ? data : [];
      
      // Fetch patient names for all appointments
      const appointmentsWithNames = await Promise.all(
        appointmentsList.map(async (apt: Appointment) => {
          try {
            const patientName = await getPatientName(apt.patientId, authToken);
            return { ...apt, patientName };
          } catch (e) {
            console.error(`Failed to fetch patient name for ${apt.patientId}`, e);
            return { ...apt, patientName: `Patient ${apt.patientId.slice(-8)}` };
          }
        })
      );
      
      setAppointments(appointmentsWithNames);
      
      // Update pending count in context
      const pendingCount = appointmentsList.filter((a: Appointment) => a.status === "PENDING").length;
      setPendingCount(pendingCount);
    } catch (e) {
      console.error("Failed to fetch appointments", e);
      if (showLoading) {
        Toast.show({
          type: "error",
          text1: "Error Loading Appointments",
          text2: e instanceof Error ? e.message : "Failed to fetch appointments. Please check your connection.",
          visibilityTime: 4000,
        });
      }
      // Don't clear appointments on polling errors
      if (showLoading) {
      setAppointments([]);
      }
    } finally {
      if (showLoading) {
      setFetching(false);
      }
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (doctorId && token) {
      await fetchAppointments(doctorId, token);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      setLoading(true);
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
      
      const res = await fetch(`${API_BASE}/api/appointments/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "CONFIRMED" }),
      });
      
      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Appointment Confirmed",
          text2: "Appointment moved to Confirmed section",
          visibilityTime: 3000,
        });
        
        // Refresh appointments and switch to confirmed tab
        if (doctorId && token) {
          await fetchAppointments(doctorId, token);
          setActiveTab("CONFIRMED"); // Auto-switch to confirmed tab
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Confirmation Failed",
          text2: errorData.message || errorData.error || "Failed to confirm appointment",
          visibilityTime: 4000,
        });
      }
    } catch (e) {
      console.error("Failed to accept appointment", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e instanceof Error ? e.message : "Failed to accept appointment. Please check your connection.",
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please select both date and time",
        visibilityTime: 3000,
      });
      return;
    }
    if (!rescheduleReason.trim()) {
      Toast.show({
        type: "error",
        text1: "Reason Required",
        text2: "Please provide a reason for rescheduling",
        visibilityTime: 3000,
      });
      return;
    }
    try {
      setLoading(true);
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
      
      const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}`);
      
      // Validate future date
      if (scheduledAt <= new Date()) {
        Toast.show({
          type: "error",
          text1: "Invalid Date",
          text2: "Appointment must be scheduled in the future",
          visibilityTime: 3000,
        });
        return;
      }
      
      const res = await fetch(`${API_BASE}/api/appointments/${selectedAppointment._id}/reschedule`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ 
          scheduledAt: scheduledAt.toISOString(),
          reason: rescheduleReason.trim(),
        }),
      });
      
      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Appointment Rescheduled",
          text2: "Appointment date and time updated successfully",
          visibilityTime: 3000,
        });
        
        setModalVisible(false);
        setRescheduleDate("");
        setRescheduleTime("");
        setRescheduleReason("");
        setSelectedAppointment(null);
        if (doctorId && token) {
          await fetchAppointments(doctorId, token);
          // Rescheduled appointments typically go to CONFIRMED
          setActiveTab("CONFIRMED");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Reschedule Failed",
          text2: errorData.message || errorData.error || "Failed to reschedule appointment",
          visibilityTime: 4000,
        });
      }
    } catch (e) {
      console.error("Failed to reschedule", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e instanceof Error ? e.message : "Failed to reschedule. Please check your connection.",
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setRescheduleDate("");
    setRescheduleTime("");
    setRescheduleReason("");
    setModalVisible(true);
  };

  const handleCancel = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setCancellationReason("");
    setCancelModalVisible(true);
  };

  const handleSubmitCancel = async () => {
    if (!selectedAppointment || !cancellationReason.trim()) {
      Toast.show({
        type: "error",
        text1: "Cancellation Reason Required",
        text2: "Please provide a reason for cancellation",
        visibilityTime: 3000,
      });
      return;
    }

    try {
      setLoading(true);
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
      
      const res = await fetch(`${API_BASE}/api/appointments/${selectedAppointment._id}/cancel`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ cancellationReason: cancellationReason.trim() }),
      });
      
      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Appointment Cancelled",
          text2: "Appointment moved to Cancelled section",
          visibilityTime: 3000,
        });
        
        setCancelModalVisible(false);
        setCancellationReason("");
        setSelectedAppointment(null);
        
        // Refresh appointments and switch to cancelled tab
        if (doctorId && token) {
          await fetchAppointments(doctorId, token);
          setActiveTab("CANCELLED");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        Toast.show({
          type: "error",
          text1: "Cancellation Failed",
          text2: errorData.message || errorData.error || "Failed to cancel appointment",
          visibilityTime: 4000,
        });
      }
    } catch (e) {
      console.error("Failed to cancel", e);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e instanceof Error ? e.message : "Failed to cancel. Please check your connection.",
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    Alert.alert(
      "Delete Appointment",
      "Are you sure you want to permanently delete this appointment? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
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
              
              console.log(`[DELETE] Attempting to delete appointment: ${id}`);
              
              const res = await fetch(`${API_BASE}/api/appointments/${id}`, {
                method: "DELETE",
                headers,
              });
              
              const responseData = await res.json().catch(() => ({}));
              console.log(`[DELETE] Response status: ${res.status}`, responseData);
              
              if (res.ok || res.status === 200) {
                Toast.show({
                  type: "success",
                  text1: "Appointment Deleted",
                  text2: responseData.message || "Appointment has been permanently deleted",
                  visibilityTime: 3000,
                });
                
                // Refresh appointments
                if (doctorId && token) {
                  await fetchAppointments(doctorId, token);
                }
              } else {
                const errorMessage = responseData.message || responseData.error || `Failed to delete appointment (Status: ${res.status})`;
                console.error("[DELETE] Error:", errorMessage);
                Toast.show({
                  type: "error",
                  text1: "Deletion Failed",
                  text2: errorMessage,
                  visibilityTime: 4000,
                });
              }
            } catch (e) {
              console.error("[DELETE] Exception:", e);
              Toast.show({
                type: "error",
                text1: "Error",
                text2: e instanceof Error ? e.message : "Failed to delete. Please check your connection.",
                visibilityTime: 4000,
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "#22c55e";
      case "PENDING":
        return "#f59e0b";
      case "CANCELLED":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayAppointments = appointments.filter((apt) => 
      new Date(apt.scheduledAt).toDateString() === today && 
      (apt.status === "PENDING" || apt.status === "CONFIRMED")
    );
    
    return {
      pending: appointments.filter((apt) => apt.status === "PENDING").length,
      confirmed: appointments.filter((apt) => apt.status === "CONFIRMED").length,
      cancelled: appointments.filter((apt) => apt.status === "CANCELLED").length,
      today: todayAppointments.length,
      upcoming: appointments.filter((apt) => 
        new Date(apt.scheduledAt) > new Date() && 
        (apt.status === "PENDING" || apt.status === "CONFIRMED")
      ).length,
    };
  }, [appointments]);

  // Filter appointments by active tab and search query
  const filteredAppointments = useMemo(() => {
    let filtered = appointments.filter((apt) => apt.status === activeTab);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((apt) => 
        apt.patientName?.toLowerCase().includes(query) ||
        apt.patientId.toLowerCase().includes(query) ||
        apt.reason?.toLowerCase().includes(query)
      );
    }
    
    // Sort: Today's appointments first, then by date
    const today = new Date().toDateString();
    return filtered.sort((a, b) => {
      const aIsToday = new Date(a.scheduledAt).toDateString() === today;
      const bIsToday = new Date(b.scheduledAt).toDateString() === today;
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  }, [appointments, activeTab, searchQuery]);

  // Get counts for each tab
  const pendingCount = stats.pending;
  const confirmedCount = stats.confirmed;
  const cancelledCount = stats.cancelled;

  useEffect(() => {
    setPendingCount(pendingCount);
  }, [pendingCount, setPendingCount]);

  return (
    <View style={styles.container}>

      {/* Quick Stats Widget */}
      {showQuickStats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsHeader}>
            <View style={styles.statsHeaderLeft}>
              <View style={styles.statsIconContainer}>
                <StatsIcon width={20} height={20} color={MedicalTheme.colors.medicalBlue} />
          </View>
              <Text style={styles.statsTitle}>Quick Stats</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowQuickStats(false)}
              style={styles.statsCloseButton}
              activeOpacity={0.7}
            >
              <Text style={styles.statsClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardToday]}>
              <View style={styles.statIconCircle}>
                <AppointmentIcon width={20} height={20} color={MedicalTheme.colors.medicalBlue} />
              </View>
              <Text style={styles.statNumber}>{stats.today}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <View style={[styles.statCard, styles.statCardPending]}>
              <View style={[styles.statIconCircle, styles.statIconCirclePending]}>
                <ClockIcon width={20} height={20} color="#f59e0b" />
              </View>
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, styles.statCardConfirmed]}>
              <View style={[styles.statIconCircle, styles.statIconCircleConfirmed]}>
                <CheckIcon width={20} height={20} color="#22c55e" />
              </View>
              <Text style={styles.statNumber}>{stats.confirmed}</Text>
              <Text style={styles.statLabel}>Confirmed</Text>
            </View>
            <View style={[styles.statCard, styles.statCardUpcoming]}>
              <View style={[styles.statIconCircle, styles.statIconCircleUpcoming]}>
                <ArrowRightIcon width={20} height={20} color="#3b82f6" />
              </View>
              <Text style={styles.statNumber}>{stats.upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
          </View>
        </View>
      )}

      {/* Upcoming Appointments Section - Enhanced */}
      <View style={styles.enhancedSectionContainer}>
        <View style={styles.enhancedSectionHeader}>
          <View style={styles.enhancedSectionHeaderLeft}>
            <View style={styles.enhancedSectionIcon}>
              <AppointmentIcon width={24} height={24} color={MedicalTheme.colors.medicalBlue} />
            </View>
            <View>
              <Text style={styles.enhancedSectionTitle}>Upcoming Appointments</Text>
              <Text style={styles.enhancedSectionSubtitle}>Manage and view all appointments</Text>
            </View>
          </View>
        </View>

        {/* Enhanced Search Bar */}
        <View style={styles.enhancedSearchContainer}>
          <View style={styles.enhancedSearchIconContainer}>
            <SearchIcon width={20} height={20} color="#64748b" />
          </View>
          <TextInput
            style={styles.enhancedSearchInput}
            placeholder="Search by patient name, ID, or reason..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={true}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity 
              onPress={() => setSearchQuery("")} 
              style={styles.enhancedSearchClear}
              activeOpacity={0.7}
            >
              <View style={styles.enhancedSearchClearButton}>
                <Text style={styles.enhancedSearchClearText}>✕</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Enhanced Status Tabs */}
        <View style={styles.enhancedStatusTabContainer}>
          <TouchableOpacity
            style={[styles.enhancedStatusTab, activeTab === "PENDING" && styles.enhancedStatusTabActive]}
            onPress={() => setActiveTab("PENDING")}
            activeOpacity={0.7}
          >
            <View style={styles.enhancedStatusTabContent}>
              <Text style={[styles.enhancedStatusTabText, activeTab === "PENDING" && styles.enhancedStatusTabTextActive]}>
                Pending
              </Text>
              {pendingCount > 0 && (
                <View style={[styles.enhancedStatusBadge, activeTab === "PENDING" && styles.enhancedStatusBadgeActive]}>
                  <Text style={[styles.enhancedStatusBadgeText, activeTab === "PENDING" && styles.enhancedStatusBadgeTextActive]}>
                    {pendingCount}
                  </Text>
                </View>
              )}
            </View>
            {activeTab === "PENDING" && <View style={styles.enhancedStatusTabIndicator} />}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.enhancedStatusTab, activeTab === "CONFIRMED" && styles.enhancedStatusTabActive]}
            onPress={() => setActiveTab("CONFIRMED")}
            activeOpacity={0.7}
          >
            <View style={styles.enhancedStatusTabContent}>
              <Text style={[styles.enhancedStatusTabText, activeTab === "CONFIRMED" && styles.enhancedStatusTabTextActive]}>
                Confirmed
              </Text>
              {confirmedCount > 0 && (
                <View style={[styles.enhancedStatusBadge, activeTab === "CONFIRMED" && styles.enhancedStatusBadgeActive]}>
                  <Text style={[styles.enhancedStatusBadgeText, activeTab === "CONFIRMED" && styles.enhancedStatusBadgeTextActive]}>
                    {confirmedCount}
                  </Text>
                </View>
              )}
            </View>
            {activeTab === "CONFIRMED" && <View style={styles.enhancedStatusTabIndicator} />}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.enhancedStatusTab, activeTab === "CANCELLED" && styles.enhancedStatusTabActive]}
            onPress={() => setActiveTab("CANCELLED")}
            activeOpacity={0.7}
          >
            <View style={styles.enhancedStatusTabContent}>
              <Text style={[styles.enhancedStatusTabText, activeTab === "CANCELLED" && styles.enhancedStatusTabTextActive]}>
                Cancelled
              </Text>
              {cancelledCount > 0 && (
                <View style={[styles.enhancedStatusBadge, activeTab === "CANCELLED" && styles.enhancedStatusBadgeActive]}>
                  <Text style={[styles.enhancedStatusBadgeText, activeTab === "CANCELLED" && styles.enhancedStatusBadgeTextActive]}>
                    {cancelledCount}
                  </Text>
                </View>
              )}
            </View>
            {activeTab === "CANCELLED" && <View style={styles.enhancedStatusTabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

      {fetching && appointments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={MedicalTheme.colors.medicalBlue} />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MedicalTheme.colors.medicalBlue} />}
        >
          {filteredAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconContainer}>
                  {searchQuery.trim() ? (
                    <SearchIcon width={48} height={48} color={MedicalTheme.colors.dark.textSecondary} />
                  ) : activeTab === "PENDING" ? (
                    <AppointmentIcon width={48} height={48} color={MedicalTheme.colors.dark.textSecondary} />
                  ) : activeTab === "CONFIRMED" ? (
                    <CheckIcon width={48} height={48} color="#22c55e" />
                  ) : (
                    <WarningIcon width={48} height={48} color="#ef4444" />
                  )}
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim() 
                    ? "No Results Found" 
                    : `No ${activeTab === "PENDING" ? "Pending" : activeTab === "CONFIRMED" ? "Confirmed" : "Cancelled"} Appointments`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery.trim()
                    ? `No appointments match "${searchQuery}"`
                    : activeTab === "PENDING" 
                    ? "New appointment requests will appear here" 
                    : activeTab === "CONFIRMED"
                    ? "Confirmed appointments will appear here"
                    : "Cancelled appointments will appear here"}
                </Text>
                {searchQuery.trim() && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    style={styles.clearSearchButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearSearchButtonText}>Clear Search</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            filteredAppointments.map((apt) => {
              const today = new Date().toDateString();
              const isToday = new Date(apt.scheduledAt).toDateString() === today;
              const date = new Date(apt.scheduledAt);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              const monthName = date.toLocaleDateString('en-US', { month: 'short' });
              const day = date.getDate();
              const timeStr = formatFriendlyTime(apt.scheduledAt);
              const dateTimeStr = `- ${dayName}, ${monthName} ${day}, ${timeStr}`;
              
              return (
              <TouchableOpacity
                key={apt._id}
                style={styles.appointmentCard}
                onPress={() => handleAppointmentClick(apt)}
                activeOpacity={0.7}
              >
                <View style={styles.appointmentCardContent}>
                  <View style={styles.avatarContainer}>
                    <View style={styles.patientAvatar}>
                      <UserIcon width={24} height={24} color={MedicalTheme.colors.medicalBlue} />
                    </View>
                  </View>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.patientNameCard}>
                      {apt.patientName || `Patient ${apt.patientId.slice(-8)}`}
                    </Text>
                    <Text style={styles.appointmentDateTime}>{dateTimeStr}</Text>
                  </View>
                </View>

                {/* Action Buttons for PENDING Appointments */}
                {apt.status === "PENDING" && (
                  <View style={styles.appointmentActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAccept(apt._id);
                      }}
                      disabled={loading}
                      activeOpacity={0.8}
                      style={styles.actionButton}
                    >
                      <LinearGradient
                        colors={["#22C55E", "#16A34A"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionButtonGradient}
                      >
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRescheduleClick(apt);
                      }}
                      disabled={loading}
                      activeOpacity={0.8}
                      style={styles.actionButton}
                    >
                      <LinearGradient
                        colors={["#f59e0b", "#d97706"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionButtonGradient}
                      >
                        <Text style={styles.actionButtonText}>Reschedule</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleCancel(apt);
                      }}
                      disabled={loading}
                      activeOpacity={0.8}
                      style={styles.actionButton}
                    >
                      <LinearGradient
                        colors={["#ef4444", "#dc2626"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionButtonGradient}
                      >
                        <Text style={styles.actionButtonText}>Cancel</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {apt.status === "CANCELLED" && (
                  <View style={styles.cancelledCardActions}>
                    <View style={styles.cancelledActionsContainer}>
                      <View style={styles.cancelledInfo}>
                        <View style={styles.cancelledTextRow}>
                          <WarningIcon width={18} height={18} color="#dc2626" />
                          <Text style={styles.cancelledText}>This appointment has been cancelled</Text>
                        </View>
                        {apt.cancellationReason && (
                          <Text style={styles.cancelledReason}>
                            {apt.cancellationReason}
                          </Text>
                        )}
                        {apt.reason && apt.reason.includes("reason:") && !apt.cancellationReason && (
                          <Text style={styles.cancelledReason}>
                            Reason: {apt.reason.split("reason:")[1]?.trim() || "N/A"}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleViewHistory(apt)}
                        activeOpacity={0.8}
                      >
                <LinearGradient
                  colors={MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.historyButton}
                >
                  <View style={styles.historyButtonContent}>
                    <DocumentIcon width={18} height={18} color="#ffffff" />
                    <Text style={styles.historyButtonText}>View Patient History</Text>
                  </View>
                </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
            })
          )}
        </ScrollView>
      )}

      {/* Appointment Details Modal - Enhanced */}
      <Modal
        visible={appointmentDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAppointmentDetailsModal(false);
          setSelectedAppointment(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.enhancedModalContent}>
            <LinearGradient
              colors={MedicalTheme.colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.enhancedModalHeader}
            >
              <View style={styles.enhancedHeaderContent}>
                <View style={styles.enhancedHeaderIcon}>
                  <UserIcon width={24} height={24} color="#ffffff" />
                </View>
                <View style={styles.enhancedHeaderText}>
                  <Text style={styles.enhancedModalTitle}>Patient Details</Text>
                  <Text style={styles.enhancedModalSubtitle}>Review patient information</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAppointmentDetailsModal(false);
                  setSelectedAppointment(null);
                }}
                style={styles.enhancedCloseButton}
              >
                <Text style={styles.enhancedCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            {selectedAppointment && (
              <ScrollView 
                style={styles.enhancedModalBody} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.enhancedModalBodyContent}
              >
                {/* Patient Information Card */}
                <View style={styles.improvedPatientCard}>
                  <View style={styles.improvedPatientAvatarContainer}>
                    <View style={styles.improvedPatientAvatar}>
                      <Text style={styles.improvedPatientAvatarText}>
                        {(selectedAppointment.patientName || "P").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.improvedPatientInfoContainer}>
                    <Text style={styles.improvedPatientName}>
                      {selectedAppointment.patientName || `Patient ${selectedAppointment.patientId.slice(-8)}`}
                    </Text>
                    {selectedAppointment.age && (
                      <Text style={styles.improvedPatientAge}>{selectedAppointment.age} years old</Text>
                    )}
                  </View>
                </View>

                {/* Issue/Reason Detail Card */}
                <View style={styles.improvedDetailCard}>
                  <View style={styles.improvedDetailIconContainer}>
                    <View style={styles.improvedDetailIconWrapper}>
                      <DocumentIcon width={24} height={24} color={MedicalTheme.colors.medicalBlue} />
                    </View>
                  </View>
                  <View style={styles.improvedDetailTextContainer}>
                    <Text style={styles.improvedDetailLabel}>ISSUE / REASON</Text>
                    <Text style={styles.improvedDetailValue}>
                      {selectedAppointment.issue || selectedAppointment.reason || "No issue specified"}
                    </Text>
                  </View>
                </View>

                {/* Appointment Date & Time Detail Card */}
                <View style={styles.improvedDetailCard}>
                  <View style={styles.improvedDetailIconContainer}>
                    <View style={styles.improvedDetailIconWrapper}>
                      <AppointmentIcon width={24} height={24} color={MedicalTheme.colors.medicalBlue} />
                    </View>
                  </View>
                  <View style={styles.improvedDetailTextContainer}>
                    <Text style={styles.improvedDetailLabel}>APPOINTMENT DATE & TIME</Text>
                    <Text style={styles.improvedDetailValue}>
                      {formatFriendlyDate(selectedAppointment.scheduledAt)} at {formatFriendlyTime(selectedAppointment.scheduledAt)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <View style={styles.improvedModalFooter}>
              <TouchableOpacity
                onPress={handleRequestReport}
                activeOpacity={0.8}
                style={styles.improvedActionButton}
              >
                <LinearGradient
                  colors={["#f59e0b", "#d97706"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.improvedActionButtonGradient}
                >
                  <DocumentIcon width={20} height={20} color="#ffffff" />
                  <Text style={styles.improvedActionButtonText}>Request Report</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleProceedToTreatment}
                activeOpacity={0.8}
                style={styles.improvedActionButton}
              >
                <LinearGradient
                  colors={MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.improvedActionButtonGradient}
                >
                  <MedicineIcon width={20} height={20} color="#ffffff" />
                  <Text style={styles.improvedActionButtonText}>Proceed to Treatment</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Request Report Modal - Enhanced */}
      <Modal
        visible={requestReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setRequestReportModal(false);
          setReportRequest("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.enhancedModalContent}>
            <LinearGradient
              colors={["#f59e0b", "#d97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.enhancedModalHeader}
            >
              <View style={styles.enhancedHeaderContent}>
                <View style={styles.enhancedHeaderIcon}>
                  <DocumentIcon width={24} height={24} color="#ffffff" />
                </View>
                <View style={styles.enhancedHeaderText}>
                  <Text style={styles.enhancedModalTitle}>Request Report</Text>
                  <Text style={styles.enhancedModalSubtitle}>Specify what report you need from the patient</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setRequestReportModal(false);
                  setReportRequest("");
                }}
                style={styles.enhancedCloseButton}
              >
                <Text style={styles.enhancedCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.enhancedModalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.enhancedFormSection}>
                <View style={styles.enhancedFormGroup}>
                  <Text style={styles.enhancedFormLabel}>
                    Report Request <Text style={styles.required}>*</Text>
                  </Text>
                  <Text style={styles.enhancedFormHint}>
                    Describe what report or test you need from the patient (e.g., "Blood test", "X-ray", "Lab reports", etc.)
                  </Text>
                  <TextInput
                    placeholder="e.g., Please provide blood test results, X-ray report, or any recent lab reports..."
                    placeholderTextColor="#94a3b8"
                    style={styles.enhancedTextArea}
                    value={reportRequest}
                    onChangeText={setReportRequest}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.enhancedModalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setRequestReportModal(false);
                  setReportRequest("");
                }}
                activeOpacity={0.8}
                style={[styles.enhancedCancelButton, { marginRight: 12 }]}
              >
                <Text style={styles.enhancedCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitReportRequest}
                disabled={!reportRequest.trim() || loading}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={(!reportRequest.trim() || loading) ? ["#cbd5e1", "#94a3b8"] : MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.enhancedSubmitButton}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View style={styles.enhancedSubmitButtonContent}>
                      <CheckIcon width={18} height={18} color="#ffffff" />
                      <Text style={styles.enhancedSubmitButtonText}>Send Request</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal - Government Style */}
      <Modal 
        visible={modalVisible} 
        transparent 
        animationType="slide"
        accessibilityViewIsModal={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.enhancedModalContent}>
            <LinearGradient
              colors={["#f59e0b", "#d97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.enhancedModalHeader}
            >
              <View style={styles.enhancedHeaderContent}>
                <View style={styles.enhancedHeaderIcon}>
                  <RefreshIcon width={24} height={24} color="#ffffff" />
                </View>
                <View style={styles.enhancedHeaderText}>
                  <Text style={styles.enhancedModalTitle}>Reschedule Appointment</Text>
                  <Text style={styles.enhancedModalSubtitle}>Update appointment date, time, and provide reason</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setRescheduleDate("");
                  setRescheduleTime("");
                  setRescheduleReason("");
                  setSelectedAppointment(null);
                }}
                style={styles.enhancedCloseButton}
              >
                <Text style={styles.enhancedCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.enhancedModalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.enhancedFormSection}>
                <View style={styles.enhancedFormGroup}>
                  <Text style={styles.enhancedFormLabel}>
                    New Appointment Date <Text style={styles.required}>*</Text>
                  </Text>
                  <DatePicker
                    value={rescheduleDate}
                    onChange={setRescheduleDate}
                    placeholder="Select new appointment date"
                    minimumDate={new Date()}
                  />
                </View>

                <View style={styles.enhancedFormGroup}>
                  <Text style={styles.enhancedFormLabel}>
                    New Appointment Time <Text style={styles.required}>*</Text>
                  </Text>
                  <TimePicker
                    value={rescheduleTime}
                    onChange={setRescheduleTime}
                    placeholder="Select new appointment time"
                  />
                </View>

                <View style={styles.enhancedFormGroup}>
                  <Text style={styles.enhancedFormLabel}>
                    Reason for Rescheduling <Text style={styles.required}>*</Text>
                  </Text>
                  <Text style={styles.enhancedFormHint}>
                    Explain why you need to reschedule this appointment (e.g., "Emergency case", "Schedule conflict", "Personal emergency")
                  </Text>
                  <TextInput
                    placeholder="Enter reason for rescheduling..."
                    placeholderTextColor="#94a3b8"
                    style={styles.enhancedTextArea}
                    value={rescheduleReason}
                    onChangeText={setRescheduleReason}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.enhancedModalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setRescheduleDate("");
                  setRescheduleTime("");
                  setRescheduleReason("");
                  setSelectedAppointment(null);
                }}
                activeOpacity={0.8}
                style={[styles.enhancedCancelButton, { marginRight: 12 }]}
              >
                <Text style={styles.enhancedCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReschedule}
                disabled={!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || loading}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={(!rescheduleDate || !rescheduleTime || !rescheduleReason.trim() || loading) ? ["#cbd5e1", "#94a3b8"] : MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.enhancedSubmitButton}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View style={styles.enhancedSubmitButtonContent}>
                      <RefreshIcon width={18} height={18} color="#ffffff" />
                      <Text style={styles.enhancedSubmitButtonText}>Reschedule</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Appointment Modal - Government Style */}
      <Modal 
        visible={cancelModalVisible} 
        transparent 
        animationType="slide"
        accessibilityViewIsModal={true}
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.enhancedModalContent}>
            <LinearGradient
              colors={["#ef4444", "#dc2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.enhancedModalHeader}
            >
              <View style={styles.enhancedHeaderContent}>
                <View style={styles.enhancedHeaderIcon}>
                  <WarningIcon width={24} height={24} color="#ffffff" />
                </View>
                <View style={styles.enhancedHeaderText}>
                  <Text style={styles.enhancedModalTitle}>Cancel Appointment</Text>
                  <Text style={styles.enhancedModalSubtitle}>Provide reason for cancellation (required)</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancellationReason("");
                  setSelectedAppointment(null);
                }}
                style={styles.enhancedCloseButton}
              >
                <Text style={styles.enhancedCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.enhancedModalBody} showsVerticalScrollIndicator={false}>
              {selectedAppointment && (
                <View style={styles.enhancedPatientCard}>
                  <View style={styles.enhancedPatientHeader}>
                    <View style={styles.enhancedPatientAvatar}>
                      <Text style={styles.enhancedPatientAvatarText}>
                        {(selectedAppointment.patientName || "P").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.enhancedPatientInfo}>
                      <Text style={styles.enhancedPatientName}>
                        {selectedAppointment.patientName || `Patient ${selectedAppointment.patientId.slice(-8)}`}
                      </Text>
                      <Text style={styles.enhancedPatientAge}>
                        {formatFriendlyDate(selectedAppointment.scheduledAt)} at {formatFriendlyTime(selectedAppointment.scheduledAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.enhancedFormSection}>
                <View style={styles.enhancedFormGroup}>
                  <Text style={styles.enhancedFormLabel}>
                    Cancellation Reason <Text style={styles.required}>*</Text>
                  </Text>
                  <Text style={styles.enhancedFormHint}>
                    Explain why you need to cancel this appointment (e.g., "Emergency case", "Busy with another patient", "Personal emergency")
                  </Text>
                  <TextInput
                    placeholder="Enter cancellation reason..."
                    placeholderTextColor="#94a3b8"
                    style={styles.enhancedTextArea}
                    value={cancellationReason}
                    onChangeText={setCancellationReason}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.enhancedWarningBox}>
                <WarningIcon width={20} height={20} color="#f59e0b" />
                <Text style={styles.enhancedWarningText}>
                  This action cannot be undone. The patient will be notified of the cancellation.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.enhancedModalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancellationReason("");
                  setSelectedAppointment(null);
                }}
                activeOpacity={0.8}
                style={[styles.enhancedCancelButton, { marginRight: 12 }]}
              >
                <Text style={styles.enhancedCancelButtonText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitCancel}
                disabled={!cancellationReason.trim() || loading}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={(!cancellationReason.trim() || loading) ? ["#cbd5e1", "#94a3b8"] : ["#ef4444", "#dc2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.enhancedSubmitButton}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View style={styles.enhancedSubmitButtonContent}>
                      <WarningIcon width={18} height={18} color="#ffffff" />
                      <Text style={styles.enhancedSubmitButtonText}>Confirm Cancellation</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Patient History Modal - For Cancelled Appointments */}
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setHistoryModalVisible(false);
          setPatientHistory(null);
          setSelectedAppointment(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalContent}>
            <View style={styles.historyModalHeader}>
              <View style={styles.historyHeaderLeft}>
                <Text style={styles.historyModalTitle}>📋 Patient History</Text>
                {selectedAppointment && (
                  <Text style={styles.historyModalSubtitle}>
                    {selectedAppointment.patientName || `Patient ${selectedAppointment.patientId.slice(-8)}`}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setHistoryModalVisible(false);
                  setPatientHistory(null);
                  setSelectedAppointment(null);
                }}
                style={styles.historyCloseButton}
              >
                <Text style={styles.historyCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.historyModalBody} showsVerticalScrollIndicator={false}>
              {loadingHistory ? (
                <View style={styles.historyLoadingContainer}>
                  <ActivityIndicator size="large" color={MedicalTheme.colors.medicalBlue} />
                  <Text style={styles.historyLoadingText}>Loading patient history...</Text>
                </View>
              ) : patientHistory ? (
                <>
                  {/* Prescriptions History */}
                  <View style={styles.historySection}>
                    <Text style={styles.historySectionTitle}>
                      💊 Previous Prescriptions {patientHistory.prescriptions?.length > 0 ? `(${patientHistory.prescriptions.length})` : ""}
                    </Text>
                    {patientHistory.prescriptions && patientHistory.prescriptions.length > 0 ? (
                      patientHistory.prescriptions.map((prescription: any, idx: number) => (
                        <View key={prescription._id || idx} style={styles.historyItemCard}>
                          <View style={styles.historyItemHeader}>
                            <Text style={styles.historyItemDate}>
                              {prescription.createdAt 
                                ? formatFriendlyDate(prescription.createdAt) 
                                : "No date"}
                            </Text>
                            <View style={styles.historyCountBadge}>
                              <Text style={styles.historyItemCount}>
                                {prescription.items?.length || 0}
                              </Text>
                            </View>
                          </View>
                          {prescription.items && prescription.items.length > 0 && (
                            <View style={styles.historyItemsList}>
                              {prescription.items.map((item: any, itemIdx: number) => (
                                <View key={itemIdx} style={styles.historyMedicineItem}>
                                  <Text style={styles.historyItemText}>
                                    <Text style={styles.medicineName}>{item.medicineName}</Text>
                                    {"\n"}• {item.dosage} • {item.frequency} • {item.duration}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                          {prescription.notes && (
                            <View style={styles.historyNotesContainer}>
                              <Text style={styles.historyNotesLabel}>Note:</Text>
                              <Text style={styles.historyNotes}>{prescription.notes}</Text>
                            </View>
                          )}
                        </View>
                      ))
                    ) : (
                      <View style={styles.historyEmptyCard}>
                        <Text style={styles.historyEmptyText}>No previous prescriptions found</Text>
                      </View>
                    )}
                  </View>

                  {/* Medical Record */}
                  <View style={styles.historySection}>
                    <Text style={styles.historySectionTitle}>🩺 Medical Records</Text>
                    
                    {patientHistory.medicalRecord ? (
                      <>
                        {patientHistory.medicalRecord.diagnosis && patientHistory.medicalRecord.diagnosis.length > 0 && (
                          <View style={styles.historySubSection}>
                            <Text style={styles.historySubSectionTitle}>Diagnosis</Text>
                            {patientHistory.medicalRecord.diagnosis.map((diag: string, idx: number) => (
                              <View key={idx} style={styles.historyBulletPoint}>
                                <Text style={styles.historyBullet}>•</Text>
                                <Text style={styles.historyItemText}>{diag}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {patientHistory.medicalRecord.allergies && patientHistory.medicalRecord.allergies.length > 0 && (
                          <View style={styles.historySubSection}>
                            <Text style={styles.historySubSectionTitle}>⚠️ Allergies</Text>
                            {patientHistory.medicalRecord.allergies.map((allergy: string, idx: number) => (
                              <View key={idx} style={[styles.historyItemCard, styles.allergyCard]}>
                                <View style={styles.historyBulletPoint}>
                                  <Text style={styles.allergyIcon}>⚠️</Text>
                                  <Text style={styles.allergyText}>{allergy}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {patientHistory.medicalRecord.currentMedications && patientHistory.medicalRecord.currentMedications.length > 0 && (
                          <View style={styles.historySubSection}>
                            <Text style={styles.historySubSectionTitle}>Current Medications</Text>
                            {patientHistory.medicalRecord.currentMedications.map((med: string, idx: number) => (
                              <View key={idx} style={styles.historyBulletPoint}>
                                <Text style={styles.historyBullet}>•</Text>
                                <Text style={styles.historyItemText}>{med}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {patientHistory.medicalRecord.labReports && patientHistory.medicalRecord.labReports.length > 0 && (
                          <View style={styles.historySubSection}>
                            <Text style={styles.historySubSectionTitle}>Lab Reports</Text>
                            {patientHistory.medicalRecord.labReports.map((report: any, idx: number) => (
                              <View key={idx} style={styles.historyItemCard}>
                                <Text style={styles.labReportTitle}>{report.testName}</Text>
                                <Text style={styles.historySubText}>
                                  Date: {report.date ? formatFriendlyDate(report.date) : "N/A"}
                                </Text>
                                <Text style={styles.labReportResults}>
                                  {report.results || "No results"}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {patientHistory.medicalRecord.notes && (
                          <View style={styles.historySubSection}>
                            <Text style={styles.historySubSectionTitle}>Clinical Notes</Text>
                            <View style={styles.historyItemCard}>
                              <Text style={styles.historyItemText}>{patientHistory.medicalRecord.notes}</Text>
                            </View>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.historyEmptyCard}>
                        <Text style={styles.historyEmptyText}>No medical records found</Text>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.historyEmptyContainer}>
                  <Text style={styles.historyEmptyText}>No history data available</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.historyModalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setHistoryModalVisible(false);
                  setPatientHistory(null);
                  setSelectedAppointment(null);
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={MedicalTheme.colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.historyCloseButtonFooter}
                >
                  <Text style={styles.historyCloseButtonText}>Close</Text>
                </LinearGradient>
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
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  tabNavigation: {
    flexDirection: "row",
    backgroundColor: MedicalTheme.colors.dark.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MedicalTheme.colors.dark.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: MedicalTheme.colors.dark.textPrimary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  tabTextActive: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "700",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    letterSpacing: 0.5,
  },
  statusTabContainer: {
    flexDirection: "row",
    backgroundColor: MedicalTheme.colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    gap: 8,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderRadius: 6,
  },
  statusTabActive: {
    backgroundColor: MedicalTheme.colors.borderDark,
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  statusTabTextActive: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "700",
  },
  // Enhanced Section Styles
  enhancedSectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  enhancedSectionHeader: {
    marginBottom: 16,
  },
  enhancedSectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  enhancedSectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#e0f2fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  enhancedSectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  enhancedSectionSubtitle: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    fontWeight: "500",
  },
  enhancedSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  enhancedSearchIconContainer: {
    marginRight: 12,
  },
  enhancedSearchInput: {
    flex: 1,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "500",
    padding: 0,
  },
  enhancedSearchClear: {
    marginLeft: 8,
  },
  enhancedSearchClearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  enhancedSearchClearText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },
  enhancedStatusTabContainer: {
    flexDirection: "row",
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    gap: 4,
  },
  enhancedStatusTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderRadius: 10,
    position: "relative",
    overflow: "hidden",
  },
  enhancedStatusTabActive: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
  },
  enhancedStatusTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  enhancedStatusTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  enhancedStatusTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  enhancedStatusBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: MedicalTheme.colors.dark.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  enhancedStatusBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  enhancedStatusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  enhancedStatusBadgeTextActive: {
    color: "#ffffff",
  },
  enhancedStatusTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#ffffff",
    borderRadius: 2,
  },
  appointmentCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  appointmentCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  appointmentActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonGradient: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  avatarContainer: {
    marginRight: 12,
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: MedicalTheme.colors.borderDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIcon: {
    fontSize: 24,
  },
  appointmentInfo: {
    flex: 1,
  },
  patientNameCard: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  appointmentDateTime: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "400",
  },
  acceptButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyContainer: {
    padding: 20,
  },
  emptyCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 8,
    padding: 40,
    alignItems: "center",
    borderWidth: 2,
    borderColor: MedicalTheme.colors.borderDark,
    borderStyle: "dashed",
  },
  emptyIconContainer: {
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  clearSearchButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: 14,
    fontWeight: "600",
  },
  govCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    margin: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  govCardToday: {
    borderWidth: 2,
    borderColor: "#22C55E",
    backgroundColor: "#2A3A2A",
  },
  govCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  patientInfo: {
    flex: 1,
  },
  patientInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  patientLabel: {
    color: "#CCCCCC",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  todayBadge: {
    backgroundColor: "#0066CC",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  patientName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  patientId: {
    color: "#CCCCCC",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    backgroundColor: MedicalTheme.colors.dark.background,
  },
  loadingText: {
    color: MedicalTheme.colors.dark.textSecondary,
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  govStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  govStatusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  govCardBody: {
    padding: 12,
  },
  govDetailRow: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-start",
  },
  govDetailLabel: {
    color: "#CCCCCC",
    fontSize: 12,
    fontWeight: "600",
    width: 70,
    textTransform: "uppercase",
  },
  govDetailValue: {
    color: "#FFFFFF",
    fontSize: 13,
    flex: 1,
    fontWeight: "500",
  },
  govCardActions: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  viewIssuesContainer: {
    marginBottom: 8,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  cancelledCardActions: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cancelledActionsContainer: {
    width: "100%",
    gap: 10,
  },
  cancelledButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelledInfo: {
    padding: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#fecaca",
    width: "100%",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelledText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  cancelledReason: {
    color: "#991b1b",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 16,
  },
  historyButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 44,
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  historyButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  historyModalContent: {
    backgroundColor: MedicalTheme.colors.surface,
    borderRadius: 12,
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  historyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  historyHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 2,
  },
  historyModalSubtitle: {
    fontSize: 13,
    color: "#E0F2F7",
    fontWeight: "500",
  },
  historyCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  historyCloseText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "700",
    lineHeight: 18,
  },
  historyModalBody: {
    padding: 16,
    maxHeight: 450,
    backgroundColor: MedicalTheme.colors.surface,
  },
  historyLoadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  historyLoadingText: {
    color: "#64748b",
    marginTop: 12,
    fontSize: 13,
    fontWeight: "500",
  },
  historySection: {
    marginBottom: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  historySectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0066CC",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  historySubSection: {
    marginBottom: 12,
    marginTop: 8,
  },
  historySubSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  historyItemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  historyDateContainer: {
    flex: 1,
  },
  historyItemDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0066CC",
  },
  historyCountBadge: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyItemCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0066CC",
  },
  historyItemsList: {
    marginTop: 8,
    gap: 6,
  },
  historyMedicineItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 6,
  },
  medicineName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  historyItemText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "400",
  },
  historyBulletPoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  historyBullet: {
    fontSize: 14,
    color: "#0066CC",
    marginRight: 8,
    fontWeight: "700",
  },
  historyNotesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#f1f5f9",
    padding: 8,
    borderRadius: 6,
  },
  historyNotesLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic",
    lineHeight: 16,
  },
  historyEmptyCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  historySubText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 16,
    fontWeight: "400",
  },
  labReportTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  labReportDetails: {
    marginTop: 6,
    gap: 3,
  },
  labReportResults: {
    fontSize: 11,
    color: "#475569",
    marginTop: 4,
    lineHeight: 16,
    fontWeight: "400",
  },
  allergyCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1.5,
  },
  allergyIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  allergyText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "600",
    lineHeight: 16,
    flex: 1,
  },
  historyEmptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  historyEmptyText: {
    color: "#94a3b8",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    fontWeight: "400",
  },
  historyModalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.border,
    backgroundColor: MedicalTheme.colors.surface,
  },
  historyCloseButtonFooter: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  historyCloseButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  govActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  govViewIssuesButton: {
    marginBottom: 8,
  },
  govAcceptButton: {
    // Gradient applied via LinearGradient component
  },
  govRescheduleButton: {
    // Gradient applied via LinearGradient component
  },
  govCancelButton: {
    // Gradient applied via LinearGradient component
  },
  govDeleteButton: {
    // Gradient applied via LinearGradient component
  },
  govActionButtonDisabled: {
    opacity: 0.6,
  },
  govActionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  govModalContent: {
    backgroundColor: MedicalTheme.colors.surface,
    borderRadius: 8,
    width: "100%",
    maxWidth: 600,
    borderWidth: 2,
    borderColor: MedicalTheme.colors.medicalBlue,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  govModalHeader: {
    backgroundColor: MedicalTheme.colors.medicalBlue,
    padding: 20,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  govHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
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
  govModalTitle: {
    color: MedicalTheme.colors.textInverse,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  govModalSubtitle: {
    color: MedicalTheme.colors.textLight,
    fontSize: 12,
    fontWeight: "500",
  },
  govFormSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  govFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: MedicalTheme.colors.textInverse,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  required: {
    color: "#dc2626",
  },
  govModalButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    padding: 20,
    gap: 12,
  },
  govCancelButtonModal: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  govCancelButtonText: {
    color: MedicalTheme.colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  govSubmitButton: {
    flex: 2,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  govSubmitButtonDisabled: {
    backgroundColor: MedicalTheme.colors.textTertiary,
    opacity: 0.6,
  },
  govSubmitButtonText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  govInput: {
    borderWidth: 1,
    borderColor: MedicalTheme.colors.border,
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: MedicalTheme.colors.surface,
    color: MedicalTheme.colors.textPrimary,
  },
  govTextArea: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  govFieldHelp: {
    fontSize: 12,
    color: MedicalTheme.colors.dark.textSecondary,
    marginTop: 4,
    marginBottom: 8,
    fontStyle: "italic",
  },
  govWarningBox: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 4,
  },
  govWarningText: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  govInfoText: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 6,
    fontWeight: "500",
  },
  statsContainer: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  statsIcon: {
    fontSize: 18,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    letterSpacing: 0.3,
  },
  statsCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: MedicalTheme.colors.borderDark,
    alignItems: "center",
    justifyContent: "center",
  },
  statsClose: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statCardToday: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  statCardPending: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  statCardConfirmed: {
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  statCardUpcoming: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconCirclePending: {
    backgroundColor: "#FEF3C7",
  },
  statIconCircleConfirmed: {
    backgroundColor: "#D1FAE5",
  },
  statIconCircleUpcoming: {
    backgroundColor: "#DBEAFE",
  },
  statIcon: {
    fontSize: 20,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.dark.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  searchIconContainer: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "500",
  },
  searchIcon: {
    fontSize: 18,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  searchClear: {
    marginLeft: 8,
  },
  searchClearCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchClearText: {
    fontSize: 12,
    color: "#CCCCCC",
    fontWeight: "700",
  },
  govCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  govCloseButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "700",
  },
  patientDetailsContainer: {
    gap: 12,
  },
  patientDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  patientDetailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    width: 100,
  },
  patientDetailValue: {
    flex: 1,
    fontSize: 14,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "500",
  },
  actionButtonGradient: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  // Enhanced Modal Styles
  enhancedModalContent: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  enhancedModalHeader: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  enhancedHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  enhancedHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  enhancedHeaderIconText: {
    fontSize: 24,
  },
  enhancedHeaderText: {
    flex: 1,
  },
  enhancedModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  enhancedModalSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },
  enhancedCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  enhancedCloseButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "700",
  },
  enhancedModalBody: {
    maxHeight: 400,
    padding: 20,
  },
  enhancedModalBodyContent: {
    paddingBottom: 8,
  },
  // Improved Patient Card Styles
  improvedPatientCard: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  improvedPatientAvatarContainer: {
    marginBottom: 16,
  },
  improvedPatientAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: MedicalTheme.colors.medicalBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  improvedPatientAvatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
  },
  improvedPatientInfoContainer: {
    alignItems: "center",
  },
  improvedPatientName: {
    fontSize: 22,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  improvedPatientAge: {
    fontSize: 15,
    color: MedicalTheme.colors.dark.textSecondary,
    textAlign: "center",
  },
  // Improved Detail Card Styles
  improvedDetailCard: {
    flexDirection: "row",
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  improvedDetailIconContainer: {
    marginRight: 16,
    justifyContent: "center",
  },
  improvedDetailIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(14, 165, 233, 0.2)",
  },
  improvedDetailTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  improvedDetailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  improvedDetailValue: {
    fontSize: 16,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "600",
    lineHeight: 24,
  },
  // Improved Modal Footer Styles
  improvedModalFooter: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
    flexDirection: "row",
    gap: 12,
    backgroundColor: MedicalTheme.colors.dark.surface,
  },
  improvedActionButton: {
    flex: 1,
  },
  improvedActionButtonGradient: {
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  improvedActionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  enhancedPatientCard: {
    backgroundColor: MedicalTheme.colors.dark.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  enhancedPatientHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  enhancedPatientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  enhancedPatientAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  enhancedPatientInfo: {
    flex: 1,
  },
  enhancedPatientName: {
    fontSize: 20,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  enhancedPatientAge: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
  },
  enhancedDetailSection: {
    gap: 12,
  },
  enhancedDetailItem: {
    flexDirection: "row",
    backgroundColor: MedicalTheme.colors.dark.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  enhancedDetailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0f2fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  enhancedDetailIconText: {
    fontSize: 18,
  },
  enhancedDetailContent: {
    flex: 1,
  },
  enhancedDetailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  enhancedDetailValue: {
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    fontWeight: "500",
    lineHeight: 22,
  },
  enhancedModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
    flexDirection: "row",
  },
  enhancedActionButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  enhancedActionButtonGradient: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  enhancedActionButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  enhancedFormSection: {
    padding: 4,
  },
  enhancedFormGroup: {
    marginBottom: 16,
  },
  enhancedFormLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  enhancedFormHint: {
    fontSize: 12,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  enhancedTextArea: {
    backgroundColor: MedicalTheme.colors.dark.background,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    minHeight: 180,
    textAlignVertical: "top",
  },
  enhancedCancelButton: {
    flex: 1,
    backgroundColor: MedicalTheme.colors.dark.background,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  enhancedCancelButtonText: {
    color: MedicalTheme.colors.dark.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  enhancedSubmitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  enhancedSubmitButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  enhancedSubmitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  historyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelledTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  enhancedWarningBox: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
    gap: 10,
    alignItems: "flex-start",
  },
  enhancedWarningText: {
    flex: 1,
    color: "#92400e",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
});
