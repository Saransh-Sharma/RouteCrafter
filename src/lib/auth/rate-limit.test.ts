import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  resetRateLimitsForTests,
} from "./rate-limit";
import { resetRedisForTests } from "./redis";

describe("authentication rate limits", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRedisForTests();
    resetRateLimitsForTests();
  });

  it("blocks the sixth password attempt in a 15-minute window", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(checkRateLimit("password", "ip:admin")).resolves.toMatchObject({
        success: true,
      });
    }
    await expect(checkRateLimit("password", "ip:admin")).resolves.toMatchObject({
      success: false,
    });
  });

  it("keeps independent identifiers and limit kinds separate", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await checkRateLimit("otp-send", "ip:admin");
    }

    await expect(checkRateLimit("otp-send", "ip:admin")).resolves.toMatchObject({
      success: false,
    });
    await expect(checkRateLimit("otp-send", "ip:saumya")).resolves.toMatchObject({
      success: true,
    });
    await expect(checkRateLimit("otp-verify", "ip:admin")).resolves.toMatchObject({
      success: true,
    });
  });
});
