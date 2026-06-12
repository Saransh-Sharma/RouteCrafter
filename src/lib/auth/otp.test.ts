import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireOtpCooldown,
  generateOtp,
  hashOtp,
  resetOtpForTests,
  storeOtpChallenge,
  verifyOtpChallenge,
} from "./otp";
import { resetRedisForTests } from "./redis";

describe("OTP challenges", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "otp-test-secret-long-enough");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRedisForTests();
    resetOtpForTests();
  });

  it("generates six-digit cryptographic codes", () => {
    for (let index = 0; index < 100; index += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("binds hashes to both username and code", () => {
    expect(hashOtp("admin", "123456")).not.toBe(
      hashOtp("saransh", "123456"),
    );
    expect(hashOtp("admin", "123456")).not.toBe(
      hashOtp("admin", "654321"),
    );
  });

  it("consumes a valid challenge exactly once", async () => {
    await storeOtpChallenge("saransh", "123456");

    await expect(verifyOtpChallenge("saransh", "123456")).resolves.toBe(
      "valid",
    );
    await expect(verifyOtpChallenge("saransh", "123456")).resolves.toBe(
      "missing",
    );
  });

  it("invalidates a challenge after five failures", async () => {
    await storeOtpChallenge("saumya", "123456");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(verifyOtpChallenge("saumya", "000000")).resolves.toBe(
        "invalid",
      );
    }
    await expect(verifyOtpChallenge("saumya", "000000")).resolves.toBe(
      "attempts-exhausted",
    );
    await expect(verifyOtpChallenge("saumya", "123456")).resolves.toBe(
      "missing",
    );
  });

  it("enforces a one-minute resend cooldown", async () => {
    await expect(acquireOtpCooldown("admin")).resolves.toBe(true);
    await expect(acquireOtpCooldown("ADMIN")).resolves.toBe(false);
  });
});
