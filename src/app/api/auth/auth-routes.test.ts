// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "./login/route";
import { POST as sendOtp } from "./otp/send/route";
import { POST as verifyOtp } from "./otp/verify/route";
import { resetOtpForTests, storeOtpChallenge } from "@/lib/auth/otp";
import { resetRateLimitsForTests } from "@/lib/auth/rate-limit";
import { resetRedisForTests } from "@/lib/auth/redis";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("authentication routes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "route-test-secret-long-enough");
    vi.stubEnv("USER_ADMIN_PASSWORD", "admin-password");
    vi.stubEnv("USER_SARANSH_PASSWORD", "saransh-password");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRedisForTests();
    resetOtpForTests();
    resetRateLimitsForTests();
  });

  it("rejects malformed and oversized login bodies with 4xx responses", async () => {
    const malformed = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    const oversized = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "10001",
        },
        body: "{}",
      }),
    );

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Invalid JSON body" });
    expect(oversized.status).toBe(413);
  });

  it("sets a hardened session cookie after valid password login", async () => {
    const response = await login(
      jsonRequest("http://localhost/api/auth/login", {
        username: "admin",
        password: "admin-password",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: "user_admin", role: "admin" },
    });
    expect(response.headers.get("set-cookie")).toContain("rc-session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("rate limits repeated password failures", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(
        jsonRequest("http://localhost/api/auth/login", {
          username: "admin",
          password: "wrong",
        }),
      );
      expect(response.status).toBe(401);
    }

    const blocked = await login(
      jsonRequest("http://localhost/api/auth/login", {
        username: "admin",
        password: "wrong",
      }),
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("authenticates the username tied to the OTP despite duplicate emails", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const sent = await sendOtp(
      jsonRequest("http://localhost/api/auth/otp/send", {
        username: "saransh",
      }),
    );
    const code = log.mock.calls[0]?.[0].match(/\d{6}$/)?.[0];
    if (!code) throw new Error("Expected development OTP log");

    const response = await verifyOtp(
      jsonRequest("http://localhost/api/auth/otp/verify", {
        username: "saransh",
        code,
      }),
    );

    expect(sent.status).toBe(200);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { id: "user_saransh", username: "saransh", role: "editor" },
    });
  });

  it("does not reveal unknown usernames and enforces resend cooldown", async () => {
    const unknown = await sendOtp(
      jsonRequest("http://localhost/api/auth/otp/send", {
        username: "nobody",
      }),
    );
    const first = await sendOtp(
      jsonRequest("http://localhost/api/auth/otp/send", {
        username: "admin",
      }),
    );
    const second = await sendOtp(
      jsonRequest("http://localhost/api/auth/otp/send", {
        username: "admin",
      }),
    );

    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual({ ok: true });
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");
  });

  it("rejects OTP replay and invalidates after five wrong codes", async () => {
    await storeOtpChallenge("saumya", "123456");
    const valid = await verifyOtp(
      jsonRequest("http://localhost/api/auth/otp/verify", {
        username: "saumya",
        code: "123456",
      }),
    );
    const replay = await verifyOtp(
      jsonRequest("http://localhost/api/auth/otp/verify", {
        username: "saumya",
        code: "123456",
      }),
    );
    expect(valid.status).toBe(200);
    expect(replay.status).toBe(400);

    resetRateLimitsForTests();
    await storeOtpChallenge("saumya", "654321");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await verifyOtp(
        jsonRequest("http://localhost/api/auth/otp/verify", {
          username: "saumya",
          code: "000000",
        }),
      );
      expect(response.status).toBe(401);
    }
    const exhausted = await verifyOtp(
      jsonRequest("http://localhost/api/auth/otp/verify", {
        username: "saumya",
        code: "000000",
      }),
    );
    expect(exhausted.status).toBe(401);
    expect(await exhausted.json()).toEqual({
      error: "Too many invalid attempts. Please request a new code.",
    });
  });
});
