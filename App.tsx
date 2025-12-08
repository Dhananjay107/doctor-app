import React, { useEffect, useRef, useCallback } from "react";
import { NavigationContainer, NavigationContainerRef, CommonActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { Provider } from "react-redux";
import Toast from "react-native-toast-message";
import { store } from "./src/store/store";
import { useAppDispatch, useAppSelector } from "./src/store/hooks";
import { initializeAuth } from "./src/store/authSlice";
import { setNavigationRef, RootStackParamList } from "./src/utils/navigation";
import { AppointmentProvider } from "./src/context/AppointmentContext";
import { initializeSocket, disconnectSocket } from "./src/services/socket";
import { MedicalTheme } from "./src/constants/theme";
import AuthScreen from "./src/screens/AuthScreen";
import DoctorTabs from "./src/screens/DoctorTabs";
import ConsultationScreen from "./src/screens/ConsultationScreen";
import EPrescriptionsScreen from "./src/screens/EPrescriptionsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, token } = useAppSelector((state) => state.auth);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Initialize Socket.IO when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log("🔌 App.tsx - Initializing socket with token...");
      const socket = initializeSocket(token);
      
      // Verify socket connection
      if (socket) {
        socket.on("connect", () => {
          console.log("✅ App.tsx - Socket connected successfully!");
        });
        
        socket.on("connect_error", (error) => {
          console.error("❌ App.tsx - Socket connection error:", error);
        });
      }
    } else {
      console.log("🔌 App.tsx - Disconnecting socket (not authenticated)");
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, token]);

  // Handle navigation when auth state changes
  useEffect(() => {
    if (!isLoading && navigationRef.current?.isReady()) {
      if (!isAuthenticated) {
        // User logged out or not authenticated - navigate to Auth
        try {
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Auth" }],
            })
          );
        } catch (error) {
          console.error("Failed to navigate to Auth on logout:", error);
        }
      }
    }
  }, [isAuthenticated, isLoading]);

  const handleNavigationReady = useCallback(() => {
    if (navigationRef.current?.isReady()) {
      setNavigationRef(navigationRef.current);
    }
  }, []);

  useEffect(() => {
    handleNavigationReady();
  }, [handleNavigationReady]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MedicalTheme.colors.success} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={isAuthenticated ? "Doctor" : "Auth"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Doctor" component={DoctorTabs} />
        <Stack.Screen 
          name="Consultation" 
          component={ConsultationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="E-Prescriptions" 
          component={EPrescriptionsScreen}
          options={{ 
            headerShown: false,
            presentation: "card",
            animation: "slide_from_right"
          }}
        />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppointmentProvider>
        <AppNavigator />
      </AppointmentProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: MedicalTheme.colors.primary,
  },
  loadingText: {
    color: MedicalTheme.colors.textInverse,
    marginTop: MedicalTheme.spacing.base,
    fontSize: MedicalTheme.typography.fontSize.base,
  },
});

