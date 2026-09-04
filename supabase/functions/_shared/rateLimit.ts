/**
 * In-Memory Sliding-Window Rate Limiter for Supabase Edge Functions
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitStores = new Map<string, Map<string, number[]>>();

/**
 * Checks whether a request under a specific namespace and client key is allowed.
 */
export function checkRateLimit(
  namespace: string,
  key: string,
  config: RateLimitConfig = { maxRequests: 30, windowMs: 60 * 1000 }
): { allowed: boolean; remaining: number; resetInSec: number } {
  if (!rateLimitStores.has(namespace)) {
    rateLimitStores.set(namespace, new Map());
  }
  const store = rateLimitStores.get(namespace)!;

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const timestamps = (store.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= config.maxRequests) {
    const oldest = timestamps[0];
    const resetInSec = Math.ceil((oldest + config.windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetInSec };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, remaining: config.maxRequests - timestamps.length, resetInSec: 0 };
}

/**
 * Extracts a unique client identifier (User ID or client IP)
 */
export function getClientIdentifier(req: Request, userId?: string | null): string {
  if (userId) return `user_${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return `ip_${forwarded.split(",")[0].trim()}`;
  return "ip_anonymous";
}

/**
 * Checks rate limit against PostgreSQL database for globally synchronized limits across all edge instances.
 * Falls back automatically to in-memory check if database is unreachable or table not yet migrated.
 */
export async function checkGlobalRateLimitAsync(
  supabaseClient: any,
  namespace: string,
  key: string,
  config: RateLimitConfig = { maxRequests: 30, windowMs: 60 * 1000 }
): Promise<{ allowed: boolean; remaining: number; resetInSec: number }> {
  const compositeKey = `${namespace}:${key}`;
  const windowSec = Math.max(1, Math.ceil(config.windowMs / 1000));

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.rpc("check_global_rate_limit", {
        p_key: compositeKey,
        p_max_requests: config.maxRequests,
        p_window_seconds: windowSec,
      });

      if (!error && data && typeof data.allowed === "boolean") {
        return {
          allowed: data.allowed,
          remaining: Number(data.remaining) || 0,
          resetInSec: Number(data.reset_in_sec) || 0,
        };
      }
    }
  } catch (e) {
    console.warn("Global rate limit check fallback to local:", e);
  }

  // Graceful fallback to local in-memory sliding window
  return checkRateLimit(namespace, key, config);
}
