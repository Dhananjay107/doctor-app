import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { getAuth, clearAuth, saveAuth } from '../utils/storage';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: 'DOCTOR' | 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'PATIENT' | 'DISTRIBUTOR' | 'PHARMACY_STAFF';
  phone?: string;
  hospitalId?: string;
  pharmacyId?: string;
  isActive?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setAuth: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    clearAuth: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const { setAuth, clearAuth: clearAuthState, setLoading } = authSlice.actions;

// Async thunks
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { dispatch }) => {
    try {
      const auth = await getAuth();
      if (auth?.token && auth?.user && auth.user.role === 'DOCTOR') {
        dispatch(setAuth({ token: auth.token, user: auth.user }));
        return { success: true };
      } else {
        dispatch(clearAuthState());
        return { success: false };
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      dispatch(clearAuthState());
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }
);

interface LoginResponse {
  token: string;
  user: User;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface ErrorResponse {
  message?: string;
  error?: string;
}

export const login = createAsyncThunk<{ success: boolean }, LoginCredentials, { rejectValue: string }>(
  'auth/login',
  async ({ email, password }: LoginCredentials, { dispatch, rejectWithValue }) => {
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        const errorData = data as ErrorResponse;
        const errorMessage = errorData.message || errorData.error || 'Login failed';
        return rejectWithValue(errorMessage);
      }

      const loginData = data as LoginResponse;
      
      if (loginData.user.role !== 'DOCTOR') {
        return rejectWithValue('This app is only for doctors');
      }

      await saveAuth(loginData.token, loginData.user);
      dispatch(setAuth({ token: loginData.token, user: loginData.user }));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection.';
      return rejectWithValue(errorMessage);
    }
  }
);

export const logout = createAsyncThunk<{ success: boolean }, void>(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      console.log("🔐 Doctor app - Logout initiated...");
      
      // Clear storage first
      const cleared = await clearAuth();
      console.log("✅ Storage cleared:", cleared);
      
      // Clear Redux state
      dispatch(clearAuthState());
      console.log("✅ Redux state cleared");
      
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if clear fails, clear the state
      dispatch(clearAuthState());
      return { success: true };
    }
  }
);

export default authSlice.reducer;

