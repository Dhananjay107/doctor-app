// Helper functions for fetching readable names from IDs

import { getAuth } from "./storage";
import { User } from "../store/authSlice";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

// Cache for doctor/pharmacy names to avoid repeated API calls
const nameCache: Record<string, string> = {};

interface UserResponse {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role?: string;
}

interface MasterEntityResponse {
  _id?: string;
  id?: string;
  name: string;
}

/**
 * Fetch doctor name by ID
 */
export async function getDoctorName(doctorId: string, token?: string): Promise<string> {
  if (!doctorId) return "Unknown Doctor";
  
  // Check cache first
  if (nameCache[`doctor_${doctorId}`]) {
    return nameCache[`doctor_${doctorId}`];
  }

  // Auto-fetch token if not provided - REQUIRED for authentication
  let authToken = token;
  if (!authToken) {
    const auth = await getAuth();
    authToken = auth?.token;
  }

  // If still no token, return fallback immediately
  if (!authToken) {
    console.warn("No auth token available for fetching doctor name");
    return `Dr. ${doctorId.slice(-8)}`;
  }

  try {
    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    };
    const res = await fetch(`${API_BASE}/api/users/${doctorId}`, { headers });
    if (res.ok) {
      const data = await res.json() as UserResponse;
      const name = data.name || data.email || "Unknown Doctor";
      nameCache[`doctor_${doctorId}`] = name;
      return name;
    } else if (res.status === 401 || res.status === 403) {
      // Token invalid/expired - will be handled by App.tsx polling
      console.warn("Authentication error fetching doctor name");
      return `Dr. ${doctorId.slice(-8)}`;
    }
  } catch (e) {
    console.error("Failed to fetch doctor name", e);
  }
  
  // Fallback: try fetching from doctors list
  if (authToken) {
    try {
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      };
      const res = await fetch(`${API_BASE}/api/users/by-role/DOCTOR`, { headers });
      if (res.ok) {
        const doctors = (await res.json()) as UserResponse[];
        const doctor = doctors.find((d) => (d._id === doctorId || d.id === doctorId));
        if (doctor) {
          const name = doctor.name || doctor.email || "Unknown Doctor";
          nameCache[`doctor_${doctorId}`] = name;
          return name;
        }
      }
    } catch (e) {
      console.error("Failed to fetch from doctors list", e);
    }
  }

  return `Dr. ${doctorId.slice(-8)}`;
}

/**
 * Fetch pharmacy name by ID
 */
export async function getPharmacyName(pharmacyId: string, token?: string): Promise<string> {
  if (!pharmacyId || pharmacyId.trim().length === 0 || pharmacyId.length < 3) {
    return "Unknown Pharmacy";
  }
  
  // Check cache first
  if (nameCache[`pharmacy_${pharmacyId}`]) {
    return nameCache[`pharmacy_${pharmacyId}`];
  }

  // Auto-fetch token if not provided - REQUIRED for authentication
  let authToken = token;
  if (!authToken) {
    const auth = await getAuth();
    authToken = auth?.token;
  }

  // If no token, return fallback (pharmacy endpoint might not require auth)
  if (!authToken) {
    console.warn("No auth token available for fetching pharmacy name");
    return "Pharmacy";
  }

  try {
    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    };
    const res = await fetch(`${API_BASE}/api/master/pharmacies/${pharmacyId}`, { headers });
    if (res.ok) {
      const data = await res.json() as MasterEntityResponse;
      const name = data.name || "Unknown Pharmacy";
      nameCache[`pharmacy_${pharmacyId}`] = name;
      return name;
    } else if (res.status === 404) {
      // Pharmacy not found, cache as unknown to avoid repeated requests
      nameCache[`pharmacy_${pharmacyId}`] = "Unknown Pharmacy";
      return "Unknown Pharmacy";
    }
  } catch (e) {
    console.error("Failed to fetch pharmacy name for ID:", pharmacyId, e);
  }

  return "Pharmacy";
}

/**
 * Fetch hospital name by ID
 */
export async function getHospitalName(hospitalId: string, token?: string): Promise<string> {
  if (!hospitalId || hospitalId.trim().length === 0 || hospitalId.length < 3) {
    return "Hospital";
  }
  
  // Check cache first
  if (nameCache[`hospital_${hospitalId}`]) {
    return nameCache[`hospital_${hospitalId}`];
  }

  // Auto-fetch token if not provided - REQUIRED for authentication
  let authToken = token;
  if (!authToken) {
    const auth = await getAuth();
    authToken = auth?.token;
  }

  // If no token, return fallback (hospital endpoint might not require auth)
  if (!authToken) {
    console.warn("No auth token available for fetching hospital name");
    return "Hospital";
  }

  try {
    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    };
    const res = await fetch(`${API_BASE}/api/master/hospitals/${hospitalId}`, { headers });
    if (res.ok) {
      const data = await res.json() as MasterEntityResponse;
      const name = data.name || "Hospital";
      nameCache[`hospital_${hospitalId}`] = name;
      return name;
    } else if (res.status === 404) {
      // Hospital not found, cache as unknown to avoid repeated requests
      nameCache[`hospital_${hospitalId}`] = "Hospital";
      return "Hospital";
    }
  } catch (e) {
    console.error("Failed to fetch hospital name for ID:", hospitalId, e);
  }

  return "Hospital";
}

/**
 * Fetch patient name by ID
 */
export async function getPatientName(patientId: string, token?: string): Promise<string> {
  if (!patientId) return "Unknown Patient";
  
  // Check cache first
  if (nameCache[`patient_${patientId}`]) {
    return nameCache[`patient_${patientId}`];
  }

  // Auto-fetch token if not provided - REQUIRED for authentication
  let authToken = token;
  if (!authToken) {
    const auth = await getAuth();
    authToken = auth?.token;
  }

  // If still no token, return fallback immediately
  if (!authToken) {
    console.warn("No auth token available for fetching patient name");
    return `Patient ${patientId.slice(-8)}`;
  }

  try {
    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    };
    const res = await fetch(`${API_BASE}/api/users/${patientId}`, { headers });
    if (res.ok) {
      const data = await res.json() as UserResponse;
      const name = data.name || data.email || "Unknown Patient";
      nameCache[`patient_${patientId}`] = name;
      return name;
    }
  } catch (e) {
    console.error("Failed to fetch patient name", e);
  }

  // Fallback: try fetching from patients list
  if (authToken) {
    try {
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      };
      const res = await fetch(`${API_BASE}/api/users/by-role/PATIENT`, { headers });
      if (res.ok) {
        const patients = (await res.json()) as UserResponse[];
        const patient = patients.find((p) => (p._id === patientId || p.id === patientId));
        if (patient) {
          const name = patient.name || patient.email || "Unknown Patient";
          nameCache[`patient_${patientId}`] = name;
          return name;
        }
      }
    } catch (e) {
      console.error("Failed to fetch from patients list", e);
    }
  }

  return `Patient ${patientId.slice(-8)}`;
}

/**
 * Format date in a friendly way
 */
export function formatFriendlyDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString("en-US", { 
        weekday: "short", 
        month: "short", 
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined
      });
    }
  } catch (e) {
    return dateString;
  }
}

/**
 * Format time in a friendly way
 */
export function formatFriendlyTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit",
      hour12: true 
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Get status badge text in friendly format
 */
export function getFriendlyStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: "Order Placed",
    ORDER_RECEIVED: "Order Confirmed",
    MEDICINE_RECEIVED: "Medicine Ready",
    SENT_TO_PHARMACY: "Going to Pharmacy",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
    COMPLETED: "Completed",
    ACCEPTED: "At Pharmacy",
    PACKED: "Packed",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
  };
  return statusMap[status] || status.replace(/_/g, " ");
}

