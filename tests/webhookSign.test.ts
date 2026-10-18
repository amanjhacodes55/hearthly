import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { nextRetryDelayMs, signPayload, verifySignature } from "@/lib/webhookSign";

describe("webhook signatures", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ event: "message.received", data: { text: "hi" } });
  it("signs with HMAC-SHA256 over `t.body`", () => {
    const s = signPayload(secret, body, 1700000000);
    expect(s.signature).toBe(createHmac("sha256", secret).update(`1700000000.${body}`).digest("hex"));
    expect(s.header).toBe(`t=1700000000,v1=${s.signature}`);
  });
  it("verifies a valid signature", () => {
    const s = signPayload(secret, body, 1700000000);
    expect(verifySignature(secret, body, s.header, 300, 1700000100)).toBe(true);
  });
  it("rejects tampered body, wrong secret, stale timestamp, garbage", () => {
    const s = signPayload(secret, body, 1700000000);
    expect(verifySignature(secret, body + " ", s.header, 300, 1700000000)).toBe(false);
    expect(verifySignature("other", body, s.header, 300, 1700000000)).toBe(false);
    expect(verifySignature(secret, body, s.header, 300, 1700000000 + 301)).toBe(false);
    expect(verifySignature(secret, body, "nonsense", 300, 1700000000)).toBe(false);
    expect(verifySignature(secret, body, undefined)).toBe(false);
  });
  it("backs off exponentially with a cap", () => {
    expect(nextRetryDelayMs(1)).toBe(30_000);
    expect(nextRetryDelayMs(2)).toBe(120_000);
    expect(nextRetryDelayMs(3)).toBe(480_000);
    expect(nextRetryDelayMs(20)).toBe(12 * 3600_000);
  });
});
