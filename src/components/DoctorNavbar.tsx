import { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useAppSelector } from "../store/hooks";
import DrawerMenu from "./DrawerMenu";

const SCREEN_TITLES: Record<string, string> = {
  Appointments: "Appointments",
  Patients: "Patients",
  "E-Prescriptions": "Prescriptions",
  Availability: "Availability",
  Settings: "Settings",
};

import { MedicalTheme } from "../constants/theme";

const COLORS = {
  darkBackground: MedicalTheme.colors.dark.background,
  darkSurface: MedicalTheme.colors.dark.surface,
  white: MedicalTheme.colors.dark.textPrimary,
  lightGray: MedicalTheme.colors.dark.textSecondary,
  green: MedicalTheme.colors.success,
  shadow: "#000",
};

export default function DoctorNavbar() {
  const route = useRoute();
  const { user } = useAppSelector((state: any) => state.auth);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const screenTitle = useMemo(
    () => SCREEN_TITLES[route.name as string] || "Doctor Portal",
    [route.name]
  );

  const doctorName = useMemo(() => {
    if (!user?.name) return null;
    const firstName = user.name.split(" ")[0];
    return `Dr. ${firstName}`;
  }, [user?.name]);

  const handleMenuPress = () => setDrawerVisible(true);
  const handleCloseDrawer = () => setDrawerVisible(false);

  return (
    <>
      <View style={styles.navbar}>
        <View style={styles.navbarContent}>
          <View style={styles.navbarLeft}>
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.menuButton}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Doctor Portal</Text>
          </View>
          <View style={styles.navbarRight}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Text style={styles.bellIcon}>🔔</Text>
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👨‍⚕️</Text>
              </View>
          </View>
        </View>
      </View>
      <DrawerMenu visible={drawerVisible} onClose={handleCloseDrawer} />
    </>
  );
}

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: COLORS.darkBackground,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  navbarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  menuIcon: {
    fontSize: 24,
    color: COLORS.white,
    fontWeight: "700",
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  navbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: {
    fontSize: 22,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.darkSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    fontSize: 20,
  },
});