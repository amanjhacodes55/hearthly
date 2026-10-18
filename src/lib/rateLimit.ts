/** In-memory token bucket (single instance deployment). capacity tokens, refilled at refillPerSec. */
type Bucket = { tokens: number; at: number };
const g = globalThis as unknown as { _ccBuckets?: Map<string, Bucket> };
const buckets = (g._ccBuckets ??= new Map());

export function takeToken(key: string, capacity: number, refillPerSec: number, now = Date.now()) {
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  b.at = now;
  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 50_000) for (const [k, v] of buckets) if (now - v.at > 600_000) buckets.delete(k);
  return { ok, remaining: Math.floor(b.tokens), retryAfterSec: ok ? 0 : Math.ceil((1 - b.tokens) / refillPerSec) };
}
