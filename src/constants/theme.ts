export const MedicalTheme = {
  colors: {
    // Enhanced Blue Palette
    primary: "#0066FF",
    primaryDark: "#0052CC",
    primaryLight: "#00BFFF",
    primaryLighter: "#4DA6FF",
    primaryGradient: ["#0066FF", "#00BFFF", "#4DA6FF"],
    
    // Enhanced Green Palette
    secondary: "#00C853",
    secondaryDark: "#00A844",
    secondaryLight: "#00E676",
    secondaryLighter: "#4DFF9F",
    secondaryGradient: ["#00C853", "#00E676", "#4DFF9F"],
    
    // Combined Gradients
    blueGreenGradient: ["#0066FF", "#00C853", "#00BFFF"],
    greenBlueGradient: ["#00C853", "#0066FF", "#00E676"],
    
    // Background & Surface
    background: "#F0F7FF",
    backgroundDark: "#0A1929",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    surfaceDark: "#1A2332",
    border: "#E0EFFF",
    borderLight: "#F0F7FF",
    borderDark: "#2A3441",
    
    // Text Colors
    textPrimary: "#1A1A1A",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    textInverse: "#FFFFFF",
    textLight: "#E5E7EB",
    
    // Status Colors
    success: "#00C853",
    successLight: "#00E676",
    successBg: "#E8F5E9",
    warning: "#FFB300",
    warningLight: "#FFC107",
    warningBg: "#FFF8E1",
    error: "#F44336",
    errorLight: "#EF5350",
    errorBg: "#FFEBEE",
    info: "#0066FF",
    infoLight: "#00BFFF",
    infoBg: "#E3F2FD",
    
    // Medical Specific
    medicalBlue: "#0066FF",
    medicalBlueLight: "#00BFFF",
    medicalGreen: "#00C853",
    medicalGreenLight: "#00E676",
    medicalTeal: "#00BCD4",
    medicalTealLight: "#4DD0E1",
    
    // Accent Colors
    accentBlue: "#2196F3",
    accentGreen: "#4CAF50",
    accentPurple: "#9C27B0",
    accentOrange: "#FF9800",
    dark: {
      background: "#0F172A",
      surface: "#1E293B",
      textPrimary: "#F1F5F9",
      textSecondary: "#CBD5E1",
    },
  },
  typography: {
    fontFamily: {
      regular: "System",
      medium: "System",
      bold: "System",
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
    },
    fontWeight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    "2xl": 32,
    "3xl": 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
} as const;
