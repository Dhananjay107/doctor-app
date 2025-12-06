import { View, Text, StyleSheet } from "react-native";

interface TabIconProps {
  focused: boolean;
  icon: string;
  badge?: number;
}

export default function TabIcon({ focused, icon, badge }: TabIconProps) {
  return (
    <View style={[styles.container, focused && styles.containerActive]}>
      <Text style={[styles.icon, focused && styles.iconActive]}>{icon}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  containerActive: {
    backgroundColor: "#e0f2fe",
  },
  icon: {
    fontSize: 24,
    opacity: 0.5,
  },
  iconActive: {
    fontSize: 26,
    opacity: 1,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});