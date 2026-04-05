import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy initialize so it doesn't crash if env vars are missing
let rateLimitInstance: Ratelimit | null = null;

export const getRateLimiter = () => {
  if (!rateLimitInstance && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    rateLimitInstance = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "10 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/cvzzer",
    });
  }
  return rateLimitInstance;
};
