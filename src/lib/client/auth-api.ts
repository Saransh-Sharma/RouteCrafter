import type { User } from "@/lib/schemas/auth";
import { requestJson } from "./http";

export interface AuthResponseBody {
  error?: string;
  user?: User | null;
  ok?: boolean;
}

export function getCurrentUser(): Promise<AuthResponseBody> {
  return requestJson<AuthResponseBody>(
    "/api/auth/me",
    undefined,
    "Could not load the current session.",
  );
}

export function login(
  username: string,
  password: string,
): Promise<AuthResponseBody> {
  return requestJson<AuthResponseBody>(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    "Login failed",
  );
}

export function sendOtp(username: string): Promise<AuthResponseBody> {
  return requestJson<AuthResponseBody>(
    "/api/auth/otp/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    },
    "Failed to send OTP",
  );
}

export function verifyOtp(
  username: string,
  code: string,
): Promise<AuthResponseBody> {
  return requestJson<AuthResponseBody>(
    "/api/auth/otp/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, code }),
    },
    "Verification failed",
  );
}

export function logout(): Promise<AuthResponseBody> {
  return requestJson<AuthResponseBody>(
    "/api/auth/logout",
    { method: "POST" },
    "Logout failed",
  );
}
