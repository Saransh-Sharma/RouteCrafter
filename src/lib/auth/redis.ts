import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token, enableTelemetry: false });
    return redis;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Upstash Redis is required in production");
  }

  redis = null;
  return redis;
}

export function resetRedisForTests(): void {
  redis = undefined;
}
