import { createHash } from "node:crypto";
import { safeEqual } from "./ids";

export const OAUTH_SCOPES = {
  "conversations:read": "Read conversations and messages",
  "conversations:write": "Update conversations (assign, resolve, tag)",
  "messages:write": "Send messages as an operator or bot, and post inbound visitor messages",
  "contacts:read": "Read contacts and their activity",
  "contacts:write": "Create and update contacts",
  "webhooks:manage": "Create and delete webhooks",
  "website:read": "Read basic website information",
} as const;
export type Scope = keyof typeof OAUTH_SCOPES;
export const ALL_SCOPES = Object.keys(OAUTH_SCOPES) as Scope[];

export function isScope(s: string): s is Scope {
  return s in OAUTH_SCOPES;
}
export function parseScopes(raw: string | undefined | null, allowed: readonly string[]) {
  const req = (raw || "").split(/[\s,+]+/).filter(Boolean);
  const list = req.length ? req : [...allowed];
  if (list.some((s) => !allowed.includes(s))) return null;
  return [...new Set(list)];
}

/** RFC 7636: S256 challenge = BASE64URL(SHA256(verifier)). */
export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function verifyPkce(verifier: string | undefined, challenge: string | undefined, method: string | undefined) {
  if (!challenge) return true; // PKCE not used for this code (confidential client with secret)
  if (!verifier || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  if ((method || "plain") === "S256") return safeEqual(pkceChallenge(verifier), challenge);
  if (method === "plain") return safeEqual(verifier, challenge);
  return false;
}

export type StoredCode = {
  clientId: string;
  redirectUri: string;
  expiresAt: Date;
  used: boolean;
  codeChallenge?: string;
  codeChallengeMethod?: string;
};
export type ExchangeParams = { clientId: string; redirectUri?: string; codeVerifier?: string; clientAuthenticated: boolean };

/** Validate an authorization_code exchange. Returns an OAuth error code, or null if valid. */
export function validateCodeExchange(code: StoredCode | null, p: ExchangeParams, now = new Date()): string | null {
  if (!code) return "invalid_grant";
  if (code.used) return "invalid_grant";
  if (code.expiresAt.getTime() < now.getTime()) return "invalid_grant";
  if (code.clientId !== p.clientId) return "invalid_grant";
  if (p.redirectUri !== undefined && p.redirectUri !== code.redirectUri) return "invalid_grant";
  if (p.redirectUri === undefined) return "invalid_request";
  // Public clients (no secret) MUST use PKCE.
  if (!p.clientAuthenticated && !code.codeChallenge) return "invalid_client";
  if (!verifyPkce(p.codeVerifier, code.codeChallenge, code.codeChallengeMethod)) return "invalid_grant";
  return null;
}

export function validRedirect(registered: string[], uri: string | undefined | null) {
  return !!uri && registered.includes(uri);
}
