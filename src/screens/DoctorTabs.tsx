import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";
import AppointmentsScreen from "./AppointmentsScreen";
import PatientHistoryScreen from "./PatientHistoryScreen";
import SettingsScreen from "./SettingsScreen";
import DoctorNavbar from "../components/DoctorNavbar";
import CustomTabBar from "../components/CustomTabBar";
import TabIcon from "../components/TabIcon";
import { useAppointmentContext } from "../context/AppointmentContext";
import AppointmentIcon from "../components/icons/AppointmentIcon";
import PatientsIcon from "../components/icons/PatientsIcon";
import SettingsIcon from "../components/icons/SettingsIcon";

const Tab = createBottomTabNavigator();

export default function DoctorTabs() {
  const { pendingCount } = useAppointmentContext();
  
  return (
    <View style={styles.container}>
      <DoctorNavbar />
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0F172A",
            borderTopColor: "#2A3441",
            borderTopWidth: 1,
            height: 65,
            paddingBottom: 8,
            paddingTop: 8,
            shadowOffset: { width: 0, height: -2 },
          },
          tabBarActiveTintColor: "#F1F5F9",
          tabBarInactiveTintColor: "#CBD5E1",
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
            marginTop: 4,
          },
          tabBarIconStyle: {
            marginTop: 0,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
        }}
      >
        <Tab.Screen
          name="Appointments"
          component={AppointmentsScreen}
          options={{
            tabBarLabel: "Appointments",
            tabBarIcon: ({ focused, color }) => (
              <View style={{ position: "relative" }}>
                <AppointmentIcon width={24} height={24} color={color} />
                {pendingCount > 0 && (
                  <View style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#ef4444",
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Patients"
          component={PatientHistoryScreen}
          options={{
            tabBarLabel: "History",
            tabBarIcon: ({ color }) => <PatientsIcon width={24} height={24} color={color} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: "Settings",
            tabBarIcon: ({ color }) => <SettingsIcon width={24} height={24} color={color} />,
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
