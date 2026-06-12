import { create as createZustand } from "zustand";
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
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isHydrating: false });
      } else {
        set({ user: null, isHydrating: false });
      }
    } catch {
      set({ user: null, isHydrating: false });
    }
  },

  login: async (username, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await readJson(res);
      if (!res.ok) {
        const message = data.error || "Login failed";
        set({ isSubmitting: false, error: message });
        throw new AuthRequestError(message);
      }
      set({ user: data.user, isSubmitting: false, error: null });
    } catch (e) {
      if (!(e instanceof AuthRequestError)) {
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
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const message = data.error || "Failed to send OTP";
        set({ isSubmitting: false, error: message });
        throw new AuthRequestError(message);
      }
      set({ isSubmitting: false });
    } catch (e) {
      if (!(e instanceof AuthRequestError)) {
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
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code }),
        credentials: "include",
      });
      const data = await readJson(res);
      if (!res.ok) {
        const message = data.error || "Verification failed";
        set({ isSubmitting: false, error: message });
        throw new AuthRequestError(message);
      }
      set({ user: data.user, isSubmitting: false, error: null });
    } catch (e) {
      if (!(e instanceof AuthRequestError)) {
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
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
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

class AuthRequestError extends Error {}

interface AuthResponseBody {
  error?: string;
  user?: User;
}

async function readJson(response: Response): Promise<AuthResponseBody> {
  try {
    return (await response.json()) as AuthResponseBody;
  } catch {
    return {};
  }
}
