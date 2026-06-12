import { Redis } from "@upstash/redis";
import { readRedisConfig } from "./config";

let redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const config = readRedisConfig();
  if (config) {
    redis = new Redis({
      url: config.url,
      token: config.token,
      enableTelemetry: false,
    });
    return redis;
  }

  redis = null;
  return redis;
}

export function resetRedisForTests(): void {
  redis = undefined;
}
