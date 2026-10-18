import { describe, expect, it } from "vitest";
import { parseUA } from "@/lib/ua";
import { deriveGeo, flag } from "@/lib/geo";

describe("UA parsing", () => {
  it("parses desktop Chrome on macOS", () => {
    expect(parseUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")).toEqual({ browser: "Chrome", browserVersion: "126", os: "macOS", osVersion: "10.15.7", device: "desktop" });
  });
  it("parses Safari on iPhone", () => {
    const r = parseUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
    expect(r).toMatchObject({ browser: "Safari", browserVersion: "17", os: "iOS", osVersion: "17.5", device: "mobile" });
  });
  it("parses Edge on Windows, Firefox on Linux, Android tablet, bots", () => {
    expect(parseUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.2535.67")).toMatchObject({ browser: "Edge", os: "Windows", osVersion: "10/11" });
    expect(parseUA("Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0")).toMatchObject({ browser: "Firefox", os: "Linux", device: "desktop" });
    expect(parseUA("Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")).toMatchObject({ os: "Android", device: "tablet" });
    expect(parseUA("Googlebot/2.1 (+http://www.google.com/bot.html)").device).toBe("bot");
    expect(parseUA("")).toMatchObject({ browser: "Unknown", os: "Unknown" });
  });
});

describe("geo", () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  it("prefers edge headers, then timezone, then language", () => {
    expect(deriveGeo({ headers: headers({ "cf-ipcountry": "de" }), timezone: "Europe/Paris" }).country).toBe("DE");
    expect(deriveGeo({ headers: headers({}), timezone: "Europe/Paris" })).toMatchObject({ country: "FR", city: "Paris", countryName: "France" });
    expect(deriveGeo({ headers: headers({ "accept-language": "en-GB,en;q=0.9" }) }).country).toBe("GB");
    expect(deriveGeo({ timezone: "America/New_York" }).city).toBe("New York");
    expect(flag("FR")).toBe("🇫🇷");
  });
});
