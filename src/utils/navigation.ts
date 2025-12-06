import { NavigationContainerRef, CommonActions } from "@react-navigation/native";

export type RootStackParamList = {
  Auth: undefined;
  Doctor: undefined;
  PrescriptionFlow: {
    appointmentId: string;
    patientId: string;
    patientName: string;
    age: number;
    issue: string;
  };
};

export let navigationRef: NavigationContainerRef<RootStackParamList> | null = null;

export function setNavigationRef(ref: NavigationContainerRef<RootStackParamList> | null): void {
  navigationRef = ref;
}

export function navigateToAuth(): void {
  if (!navigationRef) {
    console.warn("Navigation ref not available");
    return;
  }

  try {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Auth" }],
        })
      );
      return;
    }

    // Try dispatching even if not ready (might still work)
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Auth" }],
      })
    );
  } catch (error) {
    console.error("Failed to navigate to auth:", error);
  }
}

