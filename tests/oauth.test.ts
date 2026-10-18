import { describe, expect, it } from "vitest";
import { parseScopes, pkceChallenge, validateCodeExchange, verifyPkce, validRedirect } from "@/lib/oauth";

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
describe("PKCE", () => {
  it("matches the RFC 7636 appendix B vector", () => {
    expect(pkceChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("verifies S256 and plain, rejects bad verifiers", () => {
    expect(verifyPkce(verifier, pkceChallenge(verifier), "S256")).toBe(true);
    expect(verifyPkce(verifier + "x", pkceChallenge(verifier), "S256")).toBe(false);
    expect(verifyPkce("short", "short", "plain")).toBe(false);
    expect(verifyPkce(verifier, verifier, "plain")).toBe(true);
    expect(verifyPkce(undefined, pkceChallenge(verifier), "S256")).toBe(false);
    expect(verifyPkce(undefined, undefined, undefined)).toBe(true);
  });
});

describe("authorization code exchange", () => {
  const base = { clientId: "app_1", redirectUri: "https://x.example.test/cb", expiresAt: new Date(Date.now() + 60_000), used: false };
  it("accepts a valid confidential exchange", () => {
    expect(validateCodeExchange(base, { clientId: "app_1", redirectUri: base.redirectUri, clientAuthenticated: true })).toBeNull();
  });
  it("accepts a valid public PKCE exchange", () => {
    const code = { ...base, codeChallenge: pkceChallenge(verifier), codeChallengeMethod: "S256" };
    expect(validateCodeExchange(code, { clientId: "app_1", redirectUri: base.redirectUri, codeVerifier: verifier, clientAuthenticated: false })).toBeNull();
  });
  it("rejects reuse, expiry, wrong client, wrong redirect, missing PKCE", () => {
    const p = { clientId: "app_1", redirectUri: base.redirectUri, clientAuthenticated: true };
    expect(validateCodeExchange(null, p)).toBe("invalid_grant");
    expect(validateCodeExchange({ ...base, used: true }, p)).toBe("invalid_grant");
    expect(validateCodeExchange({ ...base, expiresAt: new Date(Date.now() - 1) }, p)).toBe("invalid_grant");
    expect(validateCodeExchange(base, { ...p, clientId: "app_2" })).toBe("invalid_grant");
    expect(validateCodeExchange(base, { ...p, redirectUri: "https://evil.example.test/cb" })).toBe("invalid_grant");
    expect(validateCodeExchange(base, { ...p, clientAuthenticated: false })).toBe("invalid_client");
    const code = { ...base, codeChallenge: pkceChallenge(verifier), codeChallengeMethod: "S256" };
    expect(validateCodeExchange(code, { ...p, codeVerifier: "x".repeat(43) })).toBe("invalid_grant");
  });
  it("validates scopes and redirect URIs", () => {
    expect(parseScopes("contacts:read messages:write", ["contacts:read", "messages:write"])).toEqual(["contacts:read", "messages:write"]);
    expect(parseScopes("", ["a"])).toEqual(["a"]);
    expect(parseScopes("admin", ["a"])).toBeNull();
    expect(validRedirect(["https://a.example.test/cb"], "https://a.example.test/cb")).toBe(true);
    expect(validRedirect(["https://a.example.test/cb"], "https://a.example.test/cb/../x")).toBe(false);
  });
});
