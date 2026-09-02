import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitWindow = "3/minute" | "1/hour";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redisConfigured = Boolean(redisUrl && redisToken);

const limiters: Partial<Record<RateLimitWindow, Ratelimit>> = {};

const getLimiter = (window: RateLimitWindow) => {
  if (!redisConfigured) return null;
  if (!limiters[window]) {
    limiters[window] = new Ratelimit({
      redis: new Redis({ url: redisUrl!, token: redisToken! }),
      limiter: window === "3/minute" ? Ratelimit.slidingWindow(3, "1 m") : Ratelimit.slidingWindow(1, "1 h"),
      analytics: true,
      prefix: "hy88:ratelimit",
    });
  }
  return limiters[window];
};

export const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
};

export async function checkRateLimit(request: Request, window: RateLimitWindow) {
  const limiter = getLimiter(window);
  if (!limiter) {
    return { success: true, retryAfter: 0 };
  }

  try {
    const result = await limiter.limit(`${window}:${getClientIp(request)}`);
    return { success: result.success, retryAfter: result.reset - Date.now() };
  } catch (error) {
    console.error("Rate limit error:", error);
    return { success: true, retryAfter: 0 };
  }
}

export const rateLimitResponse = (retryAfter: number, message: string) =>
  Response.json({ error: message }, {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfter / 1000))) },
  });