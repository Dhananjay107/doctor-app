import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { User } from '../store/authSlice';

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

interface AuthData {
  token: string;
  user: User;
}

interface StorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const getStorage = (): StorageInterface => {
  // React Native - use AsyncStorage
  if (Platform.OS !== 'web') {
    return AsyncStorage;
  }
  
  // Web platform fallback
  if (Platform.OS === 'web' && typeof window !== "undefined" && window.localStorage) {
    return {
      getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
  }
  
  // Fallback to AsyncStorage if web localStorage not available
  return AsyncStorage;
};

export async function saveAuth(token: string, user: User): Promise<void> {
  try {
    const storage = getStorage();
    await storage.setItem(TOKEN_KEY, token);
    await storage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to save auth:", error);
    throw error;
  }
}

export async function getAuth(): Promise<AuthData | null> {
  try {
    const storage = getStorage();
    const token = await storage.getItem(TOKEN_KEY);
    const userStr = await storage.getItem(USER_KEY);
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        return {
          token,
          user,
        };
      } catch (parseError) {
        console.error("Failed to parse user data:", parseError);
        // Clean up corrupted data
        await storage.removeItem(TOKEN_KEY);
        await storage.removeItem(USER_KEY);
        return null;
      }
    }
  } catch (error) {
    console.error("Failed to get auth:", error);
  }
  return null;
}

export async function clearAuth(): Promise<boolean> {
  console.log("🗑️ Doctor app - Clearing auth from storage...");
  
  try {
    const storage = getStorage();

    // Remove items
    await Promise.all([
      storage.removeItem(TOKEN_KEY),
      storage.removeItem(USER_KEY),
    ]);
    console.log("✅ Removed items from storage");

    // Additional cleanup for web
    if (Platform.OS === 'web' && typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        console.log("✅ Cleared web localStorage");
      } catch (error) {
        console.error("Failed to clear web localStorage:", error);
      }
    }

    // Verify it's cleared
    const [token, user] = await Promise.all([
      storage.getItem(TOKEN_KEY),
      storage.getItem(USER_KEY),
    ]);

    if (token || user) {
      console.warn("⚠️ Auth still exists after clear, retrying...");
      // Retry once
      await Promise.all([
        storage.removeItem(TOKEN_KEY),
        storage.removeItem(USER_KEY),
      ]);
      
      if (Platform.OS === 'web' && typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
      }
    }

    console.log("✅ Auth cleared successfully");
    return true;
  } catch (error) {
    console.error("❌ Error clearing auth:", error);
    // Try one more time
    try {
      const storage = getStorage();
      await Promise.all([
        storage.removeItem(TOKEN_KEY),
        storage.removeItem(USER_KEY),
      ]);
      if (Platform.OS === 'web' && typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
      }
      return true;
    } catch (retryError) {
      console.error("❌ Failed to clear auth on retry:", retryError);
      return false;
    }
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const auth = await getAuth();
    return auth?.token || null;
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
}
