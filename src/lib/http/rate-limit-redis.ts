import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitResult = { limited: boolean };

let redisClient: Redis | null = null;
const limiterCache = new Map<string, Ratelimit>();

function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return redisClient;
}

function getLimiter(max: number, windowMs: number) {
  const cacheKey = `${max}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const limiter = new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(max, `${windowMs}ms`),
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

export async function rateLimitRedis(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { limited: false };
  }

  const limiter = getLimiter(max, windowMs);
  const result = await limiter.limit(key);
  return { limited: !result.success };
}
