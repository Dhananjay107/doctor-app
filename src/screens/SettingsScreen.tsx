import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, ActivityIndicator, Linking, Platform, BackHandler } from "react-native";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { logout, clearAuthState } from "../store/authSlice";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { navigateToAuth, navigationRef } from "../utils/navigation";
import { disconnectSocket } from "../services/socket";
import { MedicalTheme } from "../constants/theme";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

export default function SettingsScreen() {
  const { user, token } = useAppSelector((state: any) => state.auth);
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [privacyPolicyModal, setPrivacyPolicyModal] = useState(false);
  const [helpCenterModal, setHelpCenterModal] = useState(false);
  const [contactSupportModal, setContactSupportModal] = useState(false);
  const [logoutConfirmModal, setLogoutConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Contact Support State
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  
  // Edit Profile State
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  
  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoutClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (logoutClickTimeoutRef.current) {
        clearTimeout(logoutClickTimeoutRef.current);
      }
    };
  }, []);

  // Load preferences from storage
  useEffect(() => {
    loadPreferences();
    if (user) {
      setEditName(user.name || "");
      setEditEmail(user.email || "");
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const notifications = await AsyncStorage.getItem("notificationsEnabled");
      const autoRefresh = await AsyncStorage.getItem("autoRefreshEnabled");
      if (notifications !== null) {
        setNotificationsEnabled(notifications === "true");
      }
      if (autoRefresh !== null) {
        setAutoRefreshEnabled(autoRefresh === "true");
      }
    } catch (e) {
      console.error("Failed to load preferences", e);
    }
  };

  const saveNotificationPreference = useCallback(async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem("notificationsEnabled", value.toString());
      Toast.show({
        type: "success",
        text1: value ? "Notifications enabled" : "Notifications disabled",
        visibilityTime: 2000,
      });
    } catch (e) {
      console.error("Failed to save preference", e);
    }
  }, []);

  const saveAutoRefreshPreference = useCallback(async (value: boolean) => {
    setAutoRefreshEnabled(value);
    try {
      await AsyncStorage.setItem("autoRefreshEnabled", value.toString());
      Toast.show({
        type: "success",
        text1: value ? "Auto refresh enabled" : "Auto refresh disabled",
        visibilityTime: 2000,
      });
    } catch (e) {
      console.error("Failed to save preference", e);
    }
  }, []);

  const handleEditProfile = useCallback(async () => {
    if (!editName.trim() || !editEmail.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setIsUpdating(true);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Profile Updated",
          text2: "Your profile has been updated successfully",
          visibilityTime: 3000,
        });
        setEditProfileModal(false);
        // Note: In React Native, we don't reload like web
        // User will need to refresh manually or navigate
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to update profile");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  }, [editName, editEmail, token, user?.id]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    try {
      setIsUpdating(true);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(`${API_BASE}/api/users/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        Toast.show({
          type: "success",
          text1: "Password Changed",
          text2: "Your password has been updated successfully",
          visibilityTime: 3000,
        });
        setChangePasswordModal(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to change password");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to change password");
    } finally {
      setIsUpdating(false);
    }
  }, [currentPassword, newPassword, token]);

  const performLogout = async () => {
    console.log("🚀🚀🚀🚀🚀 Doctor App - performLogout FUNCTION CALLED! 🚀🚀🚀🚀🚀");
    
    if (isLoggingOut) {
      console.log("⚠️ Already logging out, ignoring...");
      return;
    }
    
    // Clear timeout if it exists
    if (logoutClickTimeoutRef.current) {
      clearTimeout(logoutClickTimeoutRef.current);
      logoutClickTimeoutRef.current = null;
    }
    
    console.log("🔄 Setting isLoggingOut to true...");
    setIsLoggingOut(true);
    
    try {
      console.log("🔄 Step 1: Disconnecting socket...");
      
      // Disconnect socket first
      try {
        disconnectSocket();
        console.log("✅ Socket disconnected");
      } catch (socketError) {
        console.warn("⚠️ Error disconnecting socket:", socketError);
      }
      
      console.log("🔄 Step 2: Calling logout thunk...");
      
      // Use the logout thunk which handles everything
      try {
        const result = await dispatch(logout()).unwrap();
        console.log("✅ Logout thunk completed:", result);
      } catch (thunkError: any) {
        console.error("❌ Logout thunk error:", thunkError);
        // Continue anyway - clear state manually
        dispatch(clearAuthState());
      }
      
      console.log("🔄 Step 3: Clearing preferences...");
      
      // Clear any additional storage (preferences, etc.)
      try {
        await AsyncStorage.multiRemove([
          "notificationsEnabled",
          "autoRefreshEnabled",
        ]);
        console.log("✅ Preferences cleared");
      } catch (storageError) {
        console.warn("⚠️ Error clearing preferences:", storageError);
      }
      
      console.log("🔄 Step 4: Navigating to Auth screen...");
      
      // Navigate to auth screen - try multiple methods
      let navigationSuccess = false;
      
      // Method 1: Use navigateToAuth (most reliable)
      try {
        console.log("🔄 Method 1: Trying navigateToAuth...");
        navigateToAuth();
        navigationSuccess = true;
        console.log("✅✅✅ Navigation via navigateToAuth successful!");
      } catch (navError3) {
        console.warn("⚠️ navigateToAuth failed:", navError3);
      }
      
      // Method 2: Use navigationRef
      if (!navigationSuccess) {
        try {
          console.log("🔄 Method 2: Trying navigationRef...");
          if (navigationRef) {
            if (navigationRef.isReady && navigationRef.isReady()) {
              navigationRef.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: "Auth" }],
                })
              );
              navigationSuccess = true;
              console.log("✅✅✅ Navigation via navigationRef successful!");
            } else {
              console.warn("⚠️ navigationRef exists but not ready");
              // Try anyway
              navigationRef.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: "Auth" }],
                })
              );
              navigationSuccess = true;
            }
          } else {
            console.warn("⚠️ navigationRef is null/undefined");
          }
        } catch (navError1) {
          console.warn("⚠️ NavigationRef failed:", navError1);
        }
      }
      
      // Method 3: Use local navigation
      if (!navigationSuccess) {
        try {
          console.log("🔄 Method 3: Trying local navigation...");
          const nav = navigation as any;
          if (nav && nav.dispatch) {
            nav.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Auth" }],
              })
            );
            navigationSuccess = true;
            console.log("✅✅✅ Navigation via local navigation successful!");
          } else {
            console.warn("⚠️ Local navigation not available");
          }
        } catch (navError2) {
          console.warn("⚠️ Local navigation failed:", navError2);
        }
      }
      
      if (!navigationSuccess) {
        console.error("❌❌❌ All navigation methods failed! State cleared but navigation didn't work.");
        // Show error to user
        Toast.show({
          type: "error",
          text1: "Navigation Error",
          text2: "Please restart the app",
          visibilityTime: 3000,
        });
      } else {
        console.log("✅✅✅ Navigation successful - user should see login screen now!");
      }
      
      console.log("🔄 Step 5: Showing success message...");
      
      Toast.show({
        type: "success",
        text1: "Logged out successfully",
        text2: Platform.OS === "android" ? "App will close in 2 seconds" : "Redirecting to login...",
        visibilityTime: 2000,
      });
      
      // Close app on Android after a short delay
      if (Platform.OS === "android") {
        console.log("🔄 Step 6: Scheduling app close (Android)...");
        setTimeout(() => {
          try {
            console.log("🔄 Closing Android app...");
            BackHandler.exitApp();
          } catch (exitError) {
            console.error("❌ Error closing app:", exitError);
          }
        }, 2000);
      }
      
      // For web, reload after a short delay
      if (Platform.OS === "web" && typeof window !== "undefined") {
        console.log("🔄 Step 6: Reloading web page...");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
      console.log("✅ Logout process completed successfully!");
      
    } catch (e: any) {
      console.error("❌ Logout error caught:", e);
      console.error("❌ Error stack:", e.stack);
      
      // Even if there's an error, try to clear state and navigate
      try {
        console.log("🔄 Attempting fallback logout...");
        dispatch(clearAuthState());
        
        // Try to navigate anyway
        try {
          if (navigationRef?.isReady && navigationRef.isReady()) {
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Auth" }],
              })
            );
          } else {
            navigateToAuth();
          }
        } catch (navErr) {
          console.error("❌ Fallback navigation also failed:", navErr);
        }
      } catch (fallbackError) {
        console.error("❌ Fallback logout error:", fallbackError);
      }
      
      Toast.show({
        type: "error",
        text1: "Logout failed",
        text2: e?.message || "Please try again",
        visibilityTime: 3000,
      });
    } finally {
      console.log("🔄 Resetting isLoggingOut state...");
      setIsLoggingOut(false);
    }
  };

  const handleLogout = useCallback(() => {
    console.log("🔴 Doctor App - Logout button clicked!");
    
    if (isLoggingOut) {
      console.log("⚠️ Already logging out, ignoring...");
      Toast.show({
        type: "info",
        text1: "Logout in progress",
        text2: "Please wait...",
      });
      return;
    }

    // Clear any existing timeout
    if (logoutClickTimeoutRef.current) {
      clearTimeout(logoutClickTimeoutRef.current);
      logoutClickTimeoutRef.current = null;
    }

    console.log("📱 Showing logout confirmation modal...");
    setLogoutConfirmModal(true);
  }, [isLoggingOut]);

  const handleLogoutConfirm = useCallback(() => {
    console.log("✅✅✅✅✅✅✅ Logout CONFIRMED - User clicked Yes!");
    setLogoutConfirmModal(false);
    
    // Clear timeout
    if (logoutClickTimeoutRef.current) {
      clearTimeout(logoutClickTimeoutRef.current);
      logoutClickTimeoutRef.current = null;
    }
    
    // Call performLogout immediately
    performLogout();
  }, []);

  const handleLogoutCancel = useCallback(() => {
    console.log("❌ Logout CANCELLED by user - User clicked No");
    setLogoutConfirmModal(false);
    
    if (logoutClickTimeoutRef.current) {
      clearTimeout(logoutClickTimeoutRef.current);
      logoutClickTimeoutRef.current = null;
    }
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0)?.toUpperCase() || "D"}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Dr. {user?.name || "Doctor"}</Text>
                <Text style={styles.profileEmail}>{user?.email || ""}</Text>
                <Text style={styles.profileRole}>Doctor</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive notifications about new appointments and patient requests
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={saveNotificationPreference}
                trackColor={{ false: "#e5e7eb", true: "#0ea5e9" }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Auto Refresh</Text>
                <Text style={styles.settingDescription}>
                  Automatically update appointment status and patient records
                </Text>
              </View>
              <Switch
                value={autoRefreshEnabled}
                onValueChange={saveAutoRefreshPreference}
                trackColor={{ false: "#e5e7eb", true: "#0ea5e9" }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                setEditName(user?.name || "");
                setEditEmail(user?.email || "");
                setEditProfileModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.settingTitle}>Edit Profile</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setChangePasswordModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.settingTitle}>Change Password</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setPrivacyPolicyModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.settingTitle}>Privacy Policy</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setHelpCenterModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.settingTitle}>Help Center</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                setSupportSubject("");
                setSupportMessage("");
                setContactSupportModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.settingTitle}>Contact Support</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                Alert.alert(
                  "About",
                  `HealthCare Doctor App\nVersion 1.0.0\n\nA modern healthcare management system for doctors.`,
                  [{ text: "OK" }]
                );
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.settingTitle}>About</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
              onPress={handleLogout}
              disabled={isLoggingOut}
              activeOpacity={0.7}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.logoutText}>Logout</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Modals - Similar to patient app but customized for doctors */}
      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditProfileModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.formField}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditProfileModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, isUpdating && styles.modalSubmitButtonDisabled]}
                onPress={handleEditProfile}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.formField}>
                <Text style={styles.label}>Current Password *</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.label}>New Password *</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 6 characters)"
                  secureTextEntry
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.label}>Confirm New Password *</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setChangePasswordModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, isUpdating && styles.modalSubmitButtonDisabled]}
                onPress={handleChangePassword}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal - Doctor specific */}
      <Modal
        visible={privacyPolicyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyPolicyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setPrivacyPolicyModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.policySection}>
                <Text style={styles.policyTitle}>1. Doctor Privacy & Data Protection</Text>
                <Text style={styles.policyText}>
                  As a healthcare provider using our platform, your professional information and patient interaction data are protected with the highest security standards.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policyTitle}>2. Patient Data Access</Text>
                <Text style={styles.policyText}>
                  You have access to patient medical records only for authorized medical purposes. All patient data access is logged and monitored for compliance.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policyTitle}>3. Your Rights</Text>
                <Text style={styles.policyText}>
                  You have the right to access, modify, or delete your professional profile information at any time through the Settings section.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { flex: 1 }]}
                onPress={() => setPrivacyPolicyModal(false)}
              >
                <Text style={styles.modalSubmitText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Help Center Modal - Doctor specific */}
      <Modal
        visible={helpCenterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpCenterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help Center</Text>
              <TouchableOpacity onPress={() => setHelpCenterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.helpSection}>
                <Text style={styles.helpQuestion}>Q: How do I accept or reschedule appointments?</Text>
                <Text style={styles.helpAnswer}>
                  A: Go to the Appointments tab. Tap on any pending appointment to accept it, or use the Reschedule button to change the date/time.
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpQuestion}>Q: How do I view patient records and reports?</Text>
                <Text style={styles.helpAnswer}>
                  A: Go to the Patients tab. Select a patient to view their medical records, uploaded reports, and clinical history.
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpQuestion}>Q: How do I create an e-prescription?</Text>
                <Text style={styles.helpAnswer}>
                  A: Go to the Prescriptions tab. Select an appointment, add medicines manually or using voice input, then submit to pharmacy.
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpQuestion}>Q: Can patients see my prescriptions in real-time?</Text>
                <Text style={styles.helpAnswer}>
                  A: Yes! Patients receive real-time updates when you create or update prescriptions. They can view them immediately in their app.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { flex: 1 }]}
                onPress={() => setHelpCenterModal(false)}
              >
                <Text style={styles.modalSubmitText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Support Modal */}
      <Modal
        visible={contactSupportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setContactSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity onPress={() => setContactSupportModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.supportInfo}>
                <Text style={styles.supportTitle}>Get in Touch</Text>
                <Text style={styles.supportText}>
                  Our support team is here to help you with any questions or technical issues.
                </Text>
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>Subject *</Text>
                <TextInput
                  style={styles.input}
                  value={supportSubject}
                  onChangeText={setSupportSubject}
                  placeholder="e.g., Technical issue, Feature request"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>Message *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={supportMessage}
                  onChangeText={setSupportMessage}
                  placeholder="Describe your issue or question in detail..."
                  multiline
                  numberOfLines={6}
                  placeholderTextColor="#94a3b8"
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.supportContactInfo}>
                <Text style={styles.supportContactTitle}>Or contact us directly:</Text>
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => {
                    Linking.openURL("mailto:support@healthcare.com").catch((err) => {
                      console.error("Failed to open email", err);
                      Toast.show({
                        type: "error",
                        text1: "Unable to open email",
                        text2: "Please contact support@healthcare.com manually",
                        visibilityTime: 3000,
                      });
                    });
                  }}
                >
                  <Text style={styles.contactIcon}>📧</Text>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactLabel}>Email</Text>
                    <Text style={styles.contactValue}>support@healthcare.com</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => {
                    Linking.openURL("tel:+15551234567").catch((err) => {
                      console.error("Failed to open phone", err);
                      Toast.show({
                        type: "error",
                        text1: "Unable to make call",
                        text2: "Please call +1 (555) 123-4567 manually",
                        visibilityTime: 3000,
                      });
                    });
                  }}
                >
                  <Text style={styles.contactIcon}>📞</Text>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactLabel}>Phone</Text>
                    <Text style={styles.contactValue}>+1 (555) 123-4567</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.contactItem}>
                  <Text style={styles.contactIcon}>🕐</Text>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactLabel}>Hours</Text>
                    <Text style={styles.contactValue}>Mon-Fri, 9 AM - 6 PM EST</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setContactSupportModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, (!supportSubject.trim() || !supportMessage.trim() || isSendingSupport) && styles.modalSubmitButtonDisabled]}
                onPress={async () => {
                  if (!supportSubject.trim() || !supportMessage.trim()) {
                    Alert.alert("Error", "Please fill all fields");
                    return;
                  }
                  
                  try {
                    setIsSendingSupport(true);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    Toast.show({
                      type: "success",
                      text1: "Message Sent",
                      text2: "Our support team will get back to you soon",
                      visibilityTime: 3000,
                    });
                    
                    setSupportSubject("");
                    setSupportMessage("");
                    setContactSupportModal(false);
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to send message");
                  } finally {
                    setIsSendingSupport(false);
                  }
                }}
                disabled={!supportSubject.trim() || !supportMessage.trim() || isSendingSupport}
              >
                {isSendingSupport ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Send Message</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleLogoutCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModalContent}>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonNo]}
                onPress={handleLogoutCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutModalButtonTextNo}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonYes]}
                onPress={handleLogoutConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutModalButtonTextYes}>Yes</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 12,
    color: MedicalTheme.colors.medicalBlue,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: MedicalTheme.colors.dark.textSecondary,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 24,
    color: MedicalTheme.colors.dark.textSecondary,
    fontWeight: "300",
  },
  divider: {
    height: 1,
    backgroundColor: MedicalTheme.colors.borderDark,
    marginVertical: 4,
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutModalContent: {
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 12,
  },
  logoutModalMessage: {
    fontSize: 16,
    color: MedicalTheme.colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  logoutModalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutModalButtonNo: {
    backgroundColor: MedicalTheme.colors.borderDark,
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
  },
  logoutModalButtonYes: {
    backgroundColor: "#ef4444",
  },
  logoutModalButtonTextNo: {
    fontSize: 16,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  logoutModalButtonTextYes: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
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
    width: "100%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: MedicalTheme.colors.borderDark,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  modalClose: {
    fontSize: 24,
    color: MedicalTheme.colors.dark.textSecondary,
    fontWeight: "300",
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  formField: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: MedicalTheme.colors.borderDark,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: MedicalTheme.colors.dark.textPrimary,
    backgroundColor: MedicalTheme.colors.dark.surface,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: MedicalTheme.colors.borderDark,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: MedicalTheme.colors.borderDark,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textSecondary,
  },
  modalSubmitButton: {
    flex: 2,
    padding: 14,
    borderRadius: 8,
    backgroundColor: MedicalTheme.colors.medicalBlue,
    alignItems: "center",
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  policySection: {
    marginBottom: 24,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  policyText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 8,
  },
  helpSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  helpQuestion: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  helpAnswer: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  supportInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: MedicalTheme.colors.dark.textPrimary,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: MedicalTheme.colors.dark.textSecondary,
    lineHeight: 20,
  },
  supportContactInfo: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  supportContactTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: MedicalTheme.colors.dark.surface,
    borderRadius: 8,
    marginBottom: 12,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: MedicalTheme.colors.dark.textSecondary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: "600",
    color: MedicalTheme.colors.dark.textPrimary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
});

