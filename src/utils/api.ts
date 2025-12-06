// API utility with automatic error handling and token refresh
import { clearAuth } from "./storage";
import { navigateToAuth } from "./navigation";
import Toast from "react-native-toast-message";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

interface ErrorResponse {
  message?: string;
  error?: string;
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const { getAuth } = await import("./storage");
  const auth = await getAuth();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      console.log("Authentication error (401/403), clearing auth and redirecting");
      
      // Clear auth
      await clearAuth();
      
      // Redirect to login
      navigateToAuth();
      
      // Show error toast
      Toast.show({
        type: "error",
        text1: "Session Expired",
        text2: "Please login again",
        visibilityTime: 3000,
      });
      
      // Return a rejected promise
      throw new Error("Authentication failed");
    }

    return response;
  } catch (error) {
    // If it's a network error, just throw it
    if (error instanceof Error && error.message === "Authentication failed") {
      throw error;
    }
    
    // For other errors, log and rethrow
    console.error("API fetch error:", error);
    throw error;
  }
}

export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, { method: "GET" });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(errorData.message || errorData.error || `Failed to fetch: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T = unknown>(endpoint: string, data: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(errorData.message || errorData.error || `Failed to post: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPut<T = unknown>(endpoint: string, data: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(errorData.message || errorData.error || `Failed to update: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, { method: "DELETE" });
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ErrorResponse;
    throw new Error(errorData.message || errorData.error || `Failed to delete: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

