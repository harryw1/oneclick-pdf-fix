import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for rate limiting
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : undefined;

// Rate limiters for different endpoints
export const uploadRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 uploads per minute
      analytics: true,
    })
  : null;

export const processRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 processing requests per minute
      analytics: true,
    })
  : null;

export const subscriptionRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '60 s'), // 3 subscription requests per minute
      analytics: true,
    })
  : null;

// Fallback in-memory rate limiting when Redis is not available
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function memoryRateLimit(identifier: string, limit: number, windowMs: number): { success: boolean; limit: number; remaining: number; reset: Date } {
  const now = Date.now();
  const key = identifier;
  const window = memoryStore.get(key);

  if (!window || now > window.resetTime) {
    // Reset window
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: new Date(now + windowMs)
    };
  }

  if (window.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: new Date(window.resetTime)
    };
  }

  window.count++;
  return {
    success: true,
    limit,
    remaining: limit - window.count,
    reset: new Date(window.resetTime)
  };
}

export async function checkRateLimit(
  rateLimiter: Ratelimit | null,
  identifier: string,
  fallbackLimit = 10,
  fallbackWindowMs = 60000
) {
  if (rateLimiter) {
    return await rateLimiter.limit(identifier);
  } else {
    // Fallback to in-memory rate limiting
    return memoryRateLimit(identifier, fallbackLimit, fallbackWindowMs);
  }
}