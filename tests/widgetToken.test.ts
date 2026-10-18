import { describe, expect, it } from "vitest";
import { signVisitorToken, verifyVisitorToken } from "@/lib/widgetToken";
import { takeToken } from "@/lib/rateLimit";

const KEY = "k".repeat(32);
const contact = "65f0c0ffee0000000000abcd";
describe("visitor tokens", () => {
  it("round-trips", () => {
    const t = signVisitorToken(KEY, "site123", contact);
    expect(verifyVisitorToken(KEY, t, "site123")).toMatchObject({ websiteId: "site123", contactId: contact });
  });
  it("rejects tampering, other websites, other keys, expiry", () => {
    const t = signVisitorToken(KEY, "site123", contact);
    expect(verifyVisitorToken(KEY, t.replace(contact, "65f0c0ffee0000000000abce"), "site123")).toBeNull();
    expect(verifyVisitorToken(KEY, t, "other")).toBeNull();
    expect(verifyVisitorToken("x".repeat(32), t, "site123")).toBeNull();
    const old = signVisitorToken(KEY, "site123", contact, Date.now() - 500 * 86400_000);
    expect(verifyVisitorToken(KEY, old, "site123")).toBeNull();
    expect(verifyVisitorToken(KEY, "v1.a.b.c", "site123")).toBeNull();
    expect(verifyVisitorToken(KEY, null)).toBeNull();
  });
});

describe("token bucket", () => {
  it("allows a burst then throttles and refills", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(takeToken("t", 3, 1, now).ok).toBe(true);
    expect(takeToken("t", 3, 1, now).ok).toBe(false);
    expect(takeToken("t", 3, 1, now + 1000).ok).toBe(true);
  });
});
