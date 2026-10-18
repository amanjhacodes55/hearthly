import { afterEach, describe, expect, it } from "vitest";
import { assertPublicUrl } from "@/lib/outbound";

describe("SSRF guard", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  it("blocks private, loopback, link-local and non-http targets in production", async () => {
    process.env.ALLOW_PRIVATE_URLS = "false";
    for (const u of ["http://127.0.0.1/x", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://172.16.0.1/", "http://100.64.0.1/"]) await expect(assertPublicUrl(u)).rejects.toThrow(/private/);
    await expect(assertPublicUrl("ftp://example.com/")).rejects.toThrow(/http/);
  });
  it("allows public IPs and can be relaxed for local testing", async () => {
    process.env.ALLOW_PRIVATE_URLS = "false";
    await expect(assertPublicUrl("http://93.184.216.34/")).resolves.toBeUndefined();
    process.env.ALLOW_PRIVATE_URLS = "true";
    await expect(assertPublicUrl("http://127.0.0.1:4555/hook")).resolves.toBeUndefined();
  });
});
