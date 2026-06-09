/**
 * Simple in-memory rate limiter for API routes.
 * Tracks requests per user within a sliding window.
 *
 * Note: This is process-local. For multi-instance deployments,
 * replace with Redis-based rate limiting (e.g., @upstash/ratelimit).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 3600_000);
      if (entry.timestamps.length === 0) store.delete(key);
    });
  }, 5 * 60 * 1000);
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSecs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSecs?: number;
}

export function checkRateLimit(
  userId: string,
  action: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowMs = config.windowSecs * 1000;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterSecs = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSecs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
  };
}

// Preset configs for different endpoint types
export const RATE_LIMITS = {
  /** AI generation endpoints (Gemini calls) - 10 requests per 5 minutes */
  generation: { maxRequests: 10, windowSecs: 300 } as RateLimitConfig,
  /** Image generation - 5 requests per 5 minutes */
  imageGeneration: { maxRequests: 5, windowSecs: 300 } as RateLimitConfig,
  /** LinkedIn posting - 5 per hour */
  linkedinPost: { maxRequests: 5, windowSecs: 3600 } as RateLimitConfig,
  /** File upload - 10 per 10 minutes */
  upload: { maxRequests: 10, windowSecs: 600 } as RateLimitConfig,
};
