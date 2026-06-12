import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getRedis } from "./redis";

const OTP_TTL_SECONDS = 5 * 60;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

interface OtpChallenge {
  digest: string;
  attempts: number;
  expiresAt: number;
}

export type OtpVerificationResult =
  | "valid"
  | "invalid"
  | "expired"
  | "missing"
  | "attempts-exhausted";

const memoryChallenges = new Map<string, OtpChallenge>();
const memoryCooldowns = new Map<string, number>();

function normalizedUsername(username: string): string {
  return username.trim().toLowerCase();
}

function challengeKey(username: string): string {
  return `routecrafter:otp:${normalizedUsername(username)}`;
}

function cooldownKey(username: string): string {
  return `routecrafter:otp-cooldown:${normalizedUsername(username)}`;
}

function getOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET environment variable is not set");
  return secret;
}

export function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function hashOtp(username: string, code: string): string {
  return createHmac("sha256", getOtpSecret())
    .update(`${normalizedUsername(username)}:${code}`)
    .digest("hex");
}

export async function acquireOtpCooldown(username: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const result = await redis.set(cooldownKey(username), "1", {
      nx: true,
      ex: OTP_COOLDOWN_SECONDS,
    });
    return result === "OK";
  }

  const key = cooldownKey(username);
  const now = Date.now();
  const expiresAt = memoryCooldowns.get(key) ?? 0;
  if (expiresAt > now) return false;
  memoryCooldowns.set(key, now + OTP_COOLDOWN_SECONDS * 1000);
  return true;
}

export async function storeOtpChallenge(
  username: string,
  code: string,
): Promise<void> {
  const challenge: OtpChallenge = {
    digest: hashOtp(username, code),
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  const redis = getRedis();

  if (redis) {
    await redis.set(challengeKey(username), JSON.stringify(challenge), {
      ex: OTP_TTL_SECONDS,
    });
    return;
  }

  memoryChallenges.set(challengeKey(username), challenge);
}

export async function verifyOtpChallenge(
  username: string,
  code: string,
): Promise<OtpVerificationResult> {
  const expectedDigest = hashOtp(username, code);
  const redis = getRedis();
  if (redis) {
    const result = await redis.eval<string[], string>(
      `
        local value = redis.call("GET", KEYS[1])
        if not value then return "missing" end
        local challenge = cjson.decode(value)
        if tonumber(ARGV[2]) > challenge.expiresAt then
          redis.call("DEL", KEYS[1])
          return "expired"
        end
        if challenge.digest == ARGV[1] then
          redis.call("DEL", KEYS[1])
          return "valid"
        end
        challenge.attempts = challenge.attempts + 1
        if challenge.attempts >= tonumber(ARGV[3]) then
          redis.call("DEL", KEYS[1])
          return "attempts-exhausted"
        end
        local ttl = redis.call("TTL", KEYS[1])
        if ttl > 0 then
          redis.call("SET", KEYS[1], cjson.encode(challenge), "EX", ttl)
        else
          redis.call("DEL", KEYS[1])
        end
        return "invalid"
      `,
      [challengeKey(username)],
      [expectedDigest, Date.now().toString(), OTP_MAX_ATTEMPTS.toString()],
    );
    return result as OtpVerificationResult;
  }

  const key = challengeKey(username);
  const challenge = memoryChallenges.get(key);
  if (!challenge) return "missing";
  if (Date.now() > challenge.expiresAt) {
    memoryChallenges.delete(key);
    return "expired";
  }

  const actual = Buffer.from(challenge.digest, "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
    memoryChallenges.delete(key);
    return "valid";
  }

  challenge.attempts += 1;
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    memoryChallenges.delete(key);
    return "attempts-exhausted";
  }
  memoryChallenges.set(key, challenge);
  return "invalid";
}

export function resetOtpForTests(): void {
  memoryChallenges.clear();
  memoryCooldowns.clear();
}
