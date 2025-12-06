import { clearAuth } from "./storage";
import { navigateToAuth } from "./navigation";
import { CommonActions, NavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./navigation";

let globalLogoutHandler: (() => Promise<void>) | null = null;
let navigationRef: NavigationContainerRef<RootStackParamList> | null = null;

export function registerLogoutHandler(handler: () => Promise<void>) {
  globalLogoutHandler = handler;
}

export function registerNavigationRef(ref: NavigationContainerRef<RootStackParamList> | null) {
  navigationRef = ref;
}

export async function triggerLogout() {
  try {
    await clearAuth();

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    if (globalLogoutHandler) {
      try {
        await globalLogoutHandler();
      } catch (error) {
        console.error("Logout handler error:", error);
      }
    }

    navigateToAuth();

    if (navigationRef?.isReady()) {
      try {
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Auth" }],
          })
        );
      } catch (error) {
        console.error("Navigation dispatch error:", error);
      }
    }
  } catch (error) {
    console.error("Logout error:", error);
    // Still try to navigate to auth even if clear fails
    navigateToAuth();
  }
}

