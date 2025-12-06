import { useRef, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, Platform } from "react-native";
import { useNavigation, useRoute, CommonActions } from "@react-navigation/native";
import { useAppSelector } from "../store/hooks";
import { navigationRef } from "../utils/navigation";

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAppSelector((state) => state.auth);
  const slideAnim = useRef(new Animated.Value(-320)).current;

  useEffect(() => {
    // Native driver not supported on web
    const useNative = Platform.OS !== 'web';
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -320,
      duration: 300,
      useNativeDriver: useNative,
    }).start();
  }, [visible, slideAnim]);

  const menuItems = useMemo(
    () => [
      { id: "appointments", label: "Appointments", screen: "Appointments", icon: "📅" },
      { id: "patients", label: "Patients", screen: "Patients", icon: "👥" },
      { id: "prescriptions", label: "Prescriptions", screen: "E-Prescriptions", icon: "💊" },
      { id: "settings", label: "Settings", screen: "Settings", icon: "⚙️" },
    ],
    []
  );

  const handleNavigate = (screenName: string) => {
    onClose();
    setTimeout(() => {
      if (navigationRef?.isReady()) {
        navigationRef.dispatch(
          CommonActions.navigate({
            name: "Doctor",
            params: { screen: screenName },
          })
        );
      } else {
        const tabNavigator = navigation.getParent();
        if (tabNavigator) {
          (tabNavigator as { navigate: (name: string) => void }).navigate(screenName);
        }
      }
    }, 300);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.drawerContainer}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerHeaderTop}>
                  <View style={styles.drawerLogo}>
                    <Text style={styles.drawerLogoText}>❤️</Text>
                  </View>
                  <View style={styles.drawerHeaderInfo}>
                    <Text style={styles.drawerTitle}>MediConnect</Text>
                    <Text style={styles.drawerSubtitle}>Doctor Portal</Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
                {user?.name && (
                  <View style={styles.drawerUserInfo}>
                    <View style={styles.drawerUserAvatar}>
                      <Text style={styles.drawerUserAvatarText}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.drawerUserDetails}>
                      <Text style={styles.drawerUserName}>Dr. {user.name}</Text>
                      <Text style={styles.drawerUserEmail}>{user.email}</Text>
                    </View>
                  </View>
                )}
              </View>

              <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false}>
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>Navigation</Text>
                  {menuItems.map((item) => {
                    const isActive = route.name === item.screen;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.menuItem,
                          isActive && styles.menuItemActive,
                        ]}
                        onPress={() => handleNavigate(item.screen)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.menuItemIcon}>{item.icon}</Text>
                        <Text style={[
                          styles.menuItemLabel,
                          isActive && styles.menuItemLabelActive,
                        ]}>
                          {item.label}
                        </Text>
                        <Text style={[
                          styles.menuItemArrow,
                          isActive && styles.menuItemArrowActive,
                        ]}>
                          →
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.drawerFooter}>
                <Text style={styles.drawerFooterText}>MediConnect v1.0</Text>
                <Text style={styles.drawerFooterSubtext}>© 2024 All rights reserved</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  drawerContainer: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    justifyContent: "flex-start",
  },
  drawer: {
    width: 320,
    backgroundColor: "#1A1A1A",
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  drawerHeader: {
    backgroundColor: "#2A2A2A",
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  drawerHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  drawerLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  drawerLogoText: {
    fontSize: 24,
  },
  drawerHeaderInfo: {
    flex: 1,
  },
  drawerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  drawerSubtitle: {
    color: "#CCCCCC",
    fontSize: 13,
    fontWeight: "500",
  },
  drawerUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A3A3A",
    padding: 12,
    borderRadius: 12,
  },
  drawerUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  drawerUserAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  drawerUserDetails: {
    flex: 1,
  },
  drawerUserName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  drawerUserEmail: {
    color: "#CCCCCC",
    fontSize: 12,
  },
  drawerContent: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  menuSection: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#3A3A3A",
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#CCCCCC",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#1A1A1A",
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  menuItemActive: {
    backgroundColor: "#2A2A2A",
    borderLeftColor: "#22C55E",
  },
  menuItemIcon: {
    fontSize: 22,
    marginRight: 16,
    width: 28,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  menuItemLabelActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  menuItemArrow: {
    fontSize: 18,
    color: "#CCCCCC",
  },
  menuItemArrowActive: {
    color: "#22C55E",
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#3A3A3A",
    backgroundColor: "#2A2A2A",
  },
  drawerFooterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CCCCCC",
    textAlign: "center",
    marginBottom: 4,
  },
  drawerFooterSubtext: {
    fontSize: 11,
    color: "#999999",
    textAlign: "center",
  },
});