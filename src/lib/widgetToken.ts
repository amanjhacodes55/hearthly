import { createHmac } from "node:crypto";
import { safeEqual } from "./ids";

/**
 * Visitor tokens: `v1.<websiteId>.<contactId>.<issuedAtSec>.<hmac>`.
 * Signed with a server secret, so a visitor can only ever act as (and read) their own contact.
 */
const TTL_SEC = 400 * 86400;

function mac(key: Buffer | string, payload: string) {
  return createHmac("sha256", key).update(payload).digest("base64url").slice(0, 32);
}

export function signVisitorToken(key: Buffer | string, websiteId: string, contactId: string, now = Date.now()) {
  const payload = `v1.${websiteId}.${contactId}.${Math.floor(now / 1000)}`;
  return `${payload}.${mac(key, payload)}`;
}

export function verifyVisitorToken(key: Buffer | string, token: string | null | undefined, websiteId?: string, now = Date.now()) {
  if (!token || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return null;
  const [, ws, contact, iat, sig] = parts;
  const payload = `v1.${ws}.${contact}.${iat}`;
  if (!safeEqual(sig, mac(key, payload))) return null;
  if (websiteId && ws !== websiteId) return null;
  const issued = Number(iat);
  if (!Number.isFinite(issued) || now / 1000 - issued > TTL_SEC || issued - now / 1000 > 300) return null;
  if (!/^[a-f0-9]{24}$/.test(contact)) return null;
  return { websiteId: ws, contactId: contact, issuedAt: issued };
}
