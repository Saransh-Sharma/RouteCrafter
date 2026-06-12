import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

export type RateLimitKind = "password" | "otp-send" | "otp-verify";

interface RateLimitRule {
  limit: number;
  windowMs: number;
  window: `${number} m`;
}

const RULES: Record<RateLimitKind, RateLimitRule> = {
  password: { limit: 5, windowMs: 15 * 60_000, window: "15 m" },
  "otp-send": { limit: 3, windowMs: 15 * 60_000, window: "15 m" },
  "otp-verify": { limit: 10, windowMs: 15 * 60_000, window: "15 m" },
};

export interface RateLimitResult {
  success: boolean;
  reset: number;
}

const memoryWindows = new Map<string, number[]>();
const upstashLimiters = new Map<RateLimitKind, Ratelimit>();

export async function checkRateLimit(
  kind: RateLimitKind,
  identifier: string,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const rule = RULES[kind];

  if (redis) {
    let limiter = upstashLimiters.get(kind);
    if (!limiter) {
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
        prefix: `routecrafter:ratelimit:${kind}`,
        analytics: false,
      });
      upstashLimiters.set(kind, limiter);
    }
    const result = await limiter.limit(identifier);
    return { success: result.success, reset: result.reset };
  }

  const now = Date.now();
  const key = `${kind}:${identifier}`;
  const recent = (memoryWindows.get(key) ?? []).filter(
    (timestamp) => timestamp > now - rule.windowMs,
  );
  if (recent.length >= rule.limit) {
    return { success: false, reset: recent[0] + rule.windowMs };
  }
  recent.push(now);
  memoryWindows.set(key, recent);
  return { success: true, reset: now + rule.windowMs };
}

export function rateLimitHeaders(reset: number): HeadersInit {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
  };
}

export function resetRateLimitsForTests(): void {
  memoryWindows.clear();
  upstashLimiters.clear();
}
