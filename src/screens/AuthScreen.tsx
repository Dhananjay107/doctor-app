import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAppDispatch } from "../store/hooks";
import { login, setAuth } from "../store/authSlice";
import { RootStackParamList } from "../utils/navigation";
import { MedicalTheme } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import AnimatedLogo from "../components/AnimatedLogo";

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

export default function AuthScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Animate on mount
    // Native driver not supported on web
    const useNative = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: useNative,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: useNative,
      }),
    ]).start();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fadeAnim, slideAnim]);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }

      // Check if MFA is required
      if (data.requiresMFA && data.mfaToken) {
        setMfaToken(data.mfaToken);
        setShowMFA(true);
        setLoading(false);
        Toast.show({
          type: "info",
          text1: "MFA Required",
          text2: "Please enter the 6-digit code sent to your email",
          visibilityTime: 3000,
        });
        return;
      }

      // If no MFA, proceed with normal login
      await dispatch(login({ email, password })).unwrap();

      Toast.show({
        type: "success",
        text1: "Login Successful!",
        text2: "Welcome to MediConnect",
        visibilityTime: 2000,
      });

      timeoutRef.current = setTimeout(() => {
        navigation.replace("Doctor");
      }, 500);
    } catch (e: any) {
      const errorMessage = e?.message || "Login failed. Please check your credentials";
      setError(errorMessage);
      setLoading(false);
      Toast.show({
        type: "error",
        text1: "Login Failed",
        text2: errorMessage,
        visibilityTime: 3000,
      });
    }
  }, [email, password, dispatch, navigation]);

  const handleMFAVerify = useCallback(async () => {
    if (!mfaCode.trim() || mfaCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/users/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, mfaCode: mfaCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'MFA verification failed');
      }

      // MFA verified, save auth and set state
      if (data.token && data.user) {
        const { saveAuth } = await import('../utils/storage');
        await saveAuth(data.token, data.user);
        dispatch(setAuth({ token: data.token, user: data.user }));
      } else {
        throw new Error('Invalid response from server');
      }

      Toast.show({
        type: "success",
        text1: "Login Successful!",
        text2: "Welcome to MediConnect",
        visibilityTime: 2000,
      });

      timeoutRef.current = setTimeout(() => {
        navigation.replace("Doctor");
      }, 500);
    } catch (e: any) {
      const errorMessage = e?.message || "MFA verification failed. Please check your code";
      setError(errorMessage);
      setLoading(false);
      Toast.show({
        type: "error",
        text1: "Verification Failed",
        text2: errorMessage,
        visibilityTime: 3000,
      });
    }
  }, [mfaCode, mfaToken, email, password, dispatch, navigation]);

  return (
    <LinearGradient
      colors={['#0066FF', '#00C853', '#00BFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.headerSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <AnimatedLogo size={140} animated={true} />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>MediCare</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitle}>Doctor Portal</Text>
            <Text style={styles.tagline}>Advanced Healthcare Management</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.form,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🔐 Sign in to access your doctor dashboard</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              placeholder="Enter your email"
              placeholderTextColor={MedicalTheme.colors.textTertiary}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              placeholder="Enter your password"
              placeholderTextColor={MedicalTheme.colors.textTertiary}
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              autoCorrect={false}
              editable={!loading && !showMFA}
            />
          </View>

          {showMFA && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>MFA Code (6 digits)</Text>
              <TextInput
                placeholder="Enter 6-digit code"
                placeholderTextColor={MedicalTheme.colors.textTertiary}
                style={styles.input}
                value={mfaCode}
                onChangeText={(text) => {
                  // Only allow numbers and limit to 6 digits
                  const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setMfaCode(numericText);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => {
                  setShowMFA(false);
                  setMfaCode("");
                  setMfaToken(null);
                  handleLogin();
                }}
              >
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <Animated.View style={styles.errorContainer}>
              <Text style={styles.error}>⚠️ {error}</Text>
            </Animated.View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={showMFA ? handleMFAVerify : handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[MedicalTheme.colors.primary, MedicalTheme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color={MedicalTheme.colors.textInverse} />
              ) : (
                <Text style={styles.submitText}>{showMFA ? "Verify Code →" : "Sign In →"}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotPasswordButton}>
            <Text style={styles.footerText}>Forgot Password?</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: MedicalTheme.spacing.xl,
    paddingTop: MedicalTheme.spacing["3xl"] + 20,
    paddingBottom: MedicalTheme.spacing.xl * 1.5,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: MedicalTheme.spacing["3xl"],
  },
  titleContainer: {
    alignItems: "center",
    marginTop: MedicalTheme.spacing.xl,
  },
  title: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize["4xl"] + 4,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    textAlign: "center",
    marginBottom: MedicalTheme.spacing.sm,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  divider: {
    width: 80,
    height: 3,
    backgroundColor: "#FFFFFF",
    marginVertical: MedicalTheme.spacing.md,
    borderRadius: 2,
    opacity: 0.9,
  },
  subtitle: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.lg,
    textAlign: "center",
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    marginBottom: MedicalTheme.spacing.xs,
    letterSpacing: 0.5,
    opacity: 0.95,
  },
  tagline: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    textAlign: "center",
    fontWeight: MedicalTheme.typography.fontWeight.medium,
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  form: {
    marginTop: MedicalTheme.spacing.sm,
    marginBottom: MedicalTheme.spacing.xl,
  },
  infoBox: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: 1,
    borderRadius: MedicalTheme.borderRadius.md,
    padding: MedicalTheme.spacing.md,
    marginBottom: MedicalTheme.spacing.lg,
    backdropFilter: 'blur(10px)',
  },
  infoText: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    textAlign: "center",
    fontWeight: MedicalTheme.typography.fontWeight.medium,
  },
  inputContainer: {
    marginBottom: MedicalTheme.spacing.base,
  },
  inputLabel: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    fontWeight: MedicalTheme.typography.fontWeight.semibold,
    marginBottom: MedicalTheme.spacing.xs,
    opacity: 0.9,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 2,
    borderRadius: MedicalTheme.borderRadius.md,
    paddingHorizontal: MedicalTheme.spacing.base,
    paddingVertical: MedicalTheme.spacing.base,
    color: MedicalTheme.colors.textPrimary,
    fontSize: MedicalTheme.typography.fontSize.base,
    minHeight: 56,
    ...MedicalTheme.shadows.md,
  },
  submitButton: {
    borderRadius: MedicalTheme.borderRadius.md,
    marginTop: MedicalTheme.spacing.lg,
    marginBottom: MedicalTheme.spacing.base,
    minHeight: 56,
    overflow: 'hidden',
    ...MedicalTheme.shadows.lg,
  },
  submitButtonGradient: {
    paddingVertical: MedicalTheme.spacing.lg,
    paddingHorizontal: MedicalTheme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: MedicalTheme.colors.textInverse,
    fontSize: MedicalTheme.typography.fontSize.base + 2,
    fontWeight: MedicalTheme.typography.fontWeight.bold,
    letterSpacing: 1,
  },
  forgotPasswordButton: {
    marginTop: MedicalTheme.spacing.md,
    alignItems: 'center',
  },
  footerText: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    textAlign: "center",
    fontWeight: MedicalTheme.typography.fontWeight.medium,
    opacity: 0.9,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    borderColor: MedicalTheme.colors.error,
    borderWidth: 1,
    borderRadius: MedicalTheme.borderRadius.md,
    padding: MedicalTheme.spacing.md,
    marginBottom: MedicalTheme.spacing.base,
    marginTop: MedicalTheme.spacing.sm,
  },
  error: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.sm,
    textAlign: "center",
    fontWeight: MedicalTheme.typography.fontWeight.medium,
  },
  resendButton: {
    marginTop: MedicalTheme.spacing.xs,
    alignSelf: 'flex-end',
  },
  resendText: {
    color: "#FFFFFF",
    fontSize: MedicalTheme.typography.fontSize.xs,
    fontWeight: MedicalTheme.typography.fontWeight.medium,
    opacity: 0.9,
    textDecorationLine: 'underline',
  },
});