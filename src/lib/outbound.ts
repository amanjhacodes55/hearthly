import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/**
 * Guard for server-side requests to user-supplied URLs (webhooks, automation HTTP steps, app actions).
 * Blocks private / loopback / link-local targets in production to prevent SSRF.
 * Set ALLOW_PRIVATE_URLS=true for local development.
 */
function privateIp(ip: string) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) URLs are allowed");
  const allowPrivate = process.env.ALLOW_PRIVATE_URLS === "true" || (process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_URLS !== "false");
  if (allowPrivate) return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [host] : (await lookup(host, { all: true })).map((x) => x.address);
  if (!addrs.length || addrs.some(privateIp)) throw new Error("URL points to a private network address, which is not allowed");
}

/** fetch() a user-supplied URL with the SSRF guard and no redirects to internal hosts. */
export async function outboundFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  await assertPublicUrl(url);
  const { timeoutMs = 8000, ...rest } = init;
  return fetch(url, { ...rest, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
}
