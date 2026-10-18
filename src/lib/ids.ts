import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const rand = (bytes = 24) => randomBytes(bytes).toString("base64url");
/** Short, URL-safe, unambiguous id (no 0/O/1/l). */
export function shortId(len = 10) {
  const abc = "23456789abcdefghijkmnpqrstuvwxyz";
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += abc[b[i] % abc.length];
  return s;
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function secret(name: "widget" | "webhook" | "oauth") {
  const base =
    (name === "widget" && process.env.WIDGET_TOKEN_SECRET) ||
    (name === "webhook" && process.env.WEBHOOK_SIGNING_SECRET) ||
    process.env.NEXTAUTH_SECRET ||
    "chatcrip-dev-secret-change-me";
  return createHash("sha256").update(`${name}:${base}`).digest();
}
