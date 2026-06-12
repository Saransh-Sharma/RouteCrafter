import { create as createZustand } from "zustand";
import type { User } from "../schemas/auth";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  /** Hydrate session from cookie via /api/auth/me */
  refresh: () => Promise<void>;

  /** Login with username + password */
  login: (username: string, password: string) => Promise<void>;

  /** Request OTP for email */
  sendOtp: (email: string) => Promise<void>;

  /** Verify OTP code */
  verifyOtp: (email: string, code: string) => Promise<void>;

  /** Logout and clear session */
  logout: () => Promise<void>;

  /** Clear any auth error */
  clearError: () => void;
}

export const useAuthStore = createZustand<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  error: null,

  refresh: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false, error: data.error || "Login failed" });
        throw new Error(data.error);
      }
      set({ user: data.user, isLoading: false, error: null });
    } catch (e) {
      if (e instanceof Error && !e.message.includes("Login failed")) {
        set({ isLoading: false, error: "Network error. Please try again." });
      } else {
        set((s) => ({ ...s, isLoading: false }));
      }
      throw e;
    }
  },

  sendOtp: async (email) => {
    set({ error: null });
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error || "Failed to send OTP" });
        throw new Error(data.error);
      }
    } catch (e) {
      if (e instanceof Error && !e.message.includes("Failed")) {
        set({ error: "Network error. Please try again." });
      }
      throw e;
    }
  },

  verifyOtp: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        set({ isLoading: false, error: data.error || "Verification failed" });
        throw new Error(data.error);
      }
      set({ user: data.user, isLoading: false, error: null });
    } catch (e) {
      if (e instanceof Error && !e.message.includes("failed")) {
        set({ isLoading: false, error: "Network error. Please try again." });
      } else {
        set((s) => ({ ...s, isLoading: false }));
      }
      throw e;
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      set({ user: null, isLoading: false, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
