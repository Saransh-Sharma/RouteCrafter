// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.20",
    },
    body: JSON.stringify(body),
  });
}

function stubProductionEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXTAUTH_SECRET", "production-test-secret-long-enough");
  vi.stubEnv("USER_ADMIN_PASSWORD", "admin-password");
  vi.stubEnv("USER_SARANSH_PASSWORD", "saransh-password");
  vi.stubEnv("USER_SAUMYA_PASSWORD", "saumya-password");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("AUTH_EMAIL_FROM", "");
}

function mockRateLimitSuccess() {
  vi.doMock("@/lib/auth/rate-limit", () => ({
    checkRateLimit: vi.fn(async () => ({
      success: true,
      reset: Date.now() + 60_000,
    })),
    rateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
  }));
}

function mockOtpStorageSuccess() {
  vi.doMock("@/lib/auth/otp", () => ({
    acquireOtpCooldown: vi.fn(async () => true),
    generateOtp: vi.fn(() => "123456"),
    storeOtpChallenge: vi.fn(async () => undefined),
  }));
}

describe("production auth configuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("@/lib/auth/rate-limit");
    vi.doUnmock("@/lib/auth/otp");
  });

  it("returns a controlled password-login error when Redis config is missing", async () => {
    stubProductionEnv();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("./login/route");

    const response = await POST(
      jsonRequest("https://route-crafter.vercel.app/api/auth/login", {
        username: "admin",
        password: "admin-password",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Authentication is not configured correctly. Please contact the administrator.",
    });
    expect(log).toHaveBeenCalledWith(
      "Password login configuration error:",
      expect.stringContaining("UPSTASH_REDIS_REST_URL"),
    );
  });

  it("returns a controlled password-login error when a user password is missing", async () => {
    stubProductionEnv();
    vi.stubEnv("USER_ADMIN_PASSWORD", "");
    mockRateLimitSuccess();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("./login/route");

    const response = await POST(
      jsonRequest("https://route-crafter.vercel.app/api/auth/login", {
        username: "admin",
        password: "admin-password",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Authentication is not configured correctly. Please contact the administrator.",
    });
    expect(log).toHaveBeenCalledWith(
      "Password login configuration error:",
      expect.stringContaining("USER_ADMIN_PASSWORD"),
    );
  });

  it("returns a controlled OTP-send error when Redis config is missing", async () => {
    stubProductionEnv();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("./otp/send/route");

    const response = await POST(
      jsonRequest("https://route-crafter.vercel.app/api/auth/otp/send", {
        username: "admin",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Email sign-in is not configured correctly. Please contact the administrator.",
    });
    expect(log).toHaveBeenCalledWith(
      "OTP send configuration error:",
      expect.stringContaining("UPSTASH_REDIS_REST_URL"),
    );
  });

  it("returns a controlled OTP-send error when Resend config is missing", async () => {
    stubProductionEnv();
    mockRateLimitSuccess();
    mockOtpStorageSuccess();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("./otp/send/route");

    const response = await POST(
      jsonRequest("https://route-crafter.vercel.app/api/auth/otp/send", {
        username: "admin",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Email sign-in is not configured correctly. Please contact the administrator.",
    });
    expect(log).toHaveBeenCalledWith(
      "OTP send configuration error:",
      expect.stringContaining("RESEND_API_KEY"),
    );
  });

  it("sets a secure session cookie when password auth is configured", async () => {
    stubProductionEnv();
    mockRateLimitSuccess();
    const { POST } = await import("./login/route");

    const response = await POST(
      jsonRequest("https://route-crafter.vercel.app/api/auth/login", {
        username: "admin",
        password: "admin-password",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: "user_admin", role: "admin" },
    });
    expect(response.headers.get("set-cookie")).toContain("rc-session=");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
