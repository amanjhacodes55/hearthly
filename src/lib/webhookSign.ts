import { createHmac } from "node:crypto";
import { safeEqual } from "./ids";

/**
 * Webhook signatures — header `Hearthly-Signature: t=<unix seconds>,v1=<hex hmac>`
 * where hmac = HMAC-SHA256(secret, `${t}.${rawBody}`).
 */
export const SIGNATURE_HEADER = "Hearthly-Signature";

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { timestamp, signature: v1, header: `t=${timestamp},v1=${v1}` };
}

export function verifySignature(secret: string, body: string, header: string | null | undefined, toleranceSec = 300, now = Math.floor(Date.now() / 1000)) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(now - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return safeEqual(expected, parts.v1);
}

/** Exponential backoff schedule for retries: 30s, 2m, 8m, 32m, ~2h, ~8.5h (attempt is 1-based). */
export const MAX_ATTEMPTS = 7;
export function nextRetryDelayMs(attempt: number) {
  return Math.min(30_000 * 4 ** (attempt - 1), 12 * 3600_000);
}
