import { create as createZustand } from "zustand";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  sendOtp as sendOtpRequest,
  verifyOtp as verifyOtpRequest,
} from "@/lib/client/auth-api";
import { ClientApiError } from "@/lib/client/http";
import type { User } from "../schemas/auth";

interface AuthState {
  user: User | null;
  isHydrating: boolean;
  isSubmitting: boolean;
  error: string | null;

  /** Hydrate session from cookie via /api/auth/me */
  refresh: () => Promise<void>;

  /** Login with username + password */
  login: (username: string, password: string) => Promise<void>;

  /** Request OTP for a username */
  sendOtp: (username: string) => Promise<void>;

  /** Verify OTP code */
  verifyOtp: (username: string, code: string) => Promise<void>;

  /** Logout and clear session */
  logout: () => Promise<void>;

  /** Clear any auth error */
  clearError: () => void;
}

export const useAuthStore = createZustand<AuthState>()((set) => ({
  user: null,
  isHydrating: false,
  isSubmitting: false,
  error: null,

  refresh: async () => {
    try {
      set({ isHydrating: true, error: null });
      const data = await getCurrentUser();
      set({ user: data.user ?? null, isHydrating: false });
    } catch {
      set({ user: null, isHydrating: false });
    }
  },

  login: async (username, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await loginRequest(username, password);
      set({ user: data.user ?? null, isSubmitting: false, error: null });
    } catch (e) {
      if (e instanceof ClientApiError) {
        set({ isSubmitting: false, error: e.message });
      } else {
        set({
          isSubmitting: false,
          error: "Network error. Please try again.",
        });
      }
      throw e;
    }
  },

  sendOtp: async (username) => {
    set({ isSubmitting: true, error: null });
    try {
      await sendOtpRequest(username);
      set({ isSubmitting: false });
    } catch (e) {
      if (e instanceof ClientApiError) {
        set({ isSubmitting: false, error: e.message });
      } else {
        set({
          isSubmitting: false,
          error: "Network error. Please try again.",
        });
      }
      throw e;
    }
  },

  verifyOtp: async (username, code) => {
    set({ isSubmitting: true, error: null });
    try {
      const data = await verifyOtpRequest(username, code);
      set({ user: data.user ?? null, isSubmitting: false, error: null });
    } catch (e) {
      if (e instanceof ClientApiError) {
        set({ isSubmitting: false, error: e.message });
      } else {
        set({
          isSubmitting: false,
          error: "Network error. Please try again.",
        });
      }
      throw e;
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      set({
        user: null,
        isHydrating: false,
        isSubmitting: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
