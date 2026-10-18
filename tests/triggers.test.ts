import { describe, expect, it } from "vitest";
import { globMatch, matchTrigger, pendingDelay, renderTemplate } from "@/lib/triggers";

const ctx = { url: "https://shop.example.test/pricing?x=1", timeOnPage: 12, sessions: 3, utmSource: "newsletter", country: "FR", language: "fr-FR", identified: false, device: "desktop" };
describe("trigger matching", () => {
  it("glob matches URLs", () => {
    expect(globMatch("*/pricing*", ctx.url)).toBe(true);
    expect(globMatch("https://shop.example.test/*", ctx.url)).toBe(true);
    expect(globMatch("*/checkout", ctx.url)).toBe(false);
    expect(globMatch("pricing", ctx.url)).toBe(true);
  });
  it("matches 'on pricing for 10s'", () => {
    const rule = { conditions: [{ type: "url" as const, op: "matches" as const, value: "*/pricing*" }, { type: "time_on_page" as const, op: "gte" as const, value: "10" }] };
    expect(matchTrigger(rule, ctx)).toBe(true);
    expect(matchTrigger(rule, { ...ctx, timeOnPage: 4 })).toBe(false);
    expect(pendingDelay(rule, { ...ctx, timeOnPage: 4 })).toBe(6);
    expect(matchTrigger({ ...rule, enabled: false }, ctx)).toBe(false);
  });
  it("matches returning visitor, utm, country, language, identified", () => {
    expect(matchTrigger({ conditions: [{ type: "returning", op: "is_true", value: "" }] }, ctx)).toBe(true);
    expect(matchTrigger({ conditions: [{ type: "returning", op: "is_true", value: "" }] }, { ...ctx, sessions: 1 })).toBe(false);
    expect(matchTrigger({ conditions: [{ type: "utm_source", op: "eq", value: "Newsletter" }] }, ctx)).toBe(true);
    expect(matchTrigger({ conditions: [{ type: "country", op: "neq", value: "FR" }] }, ctx)).toBe(false);
    expect(matchTrigger({ conditions: [{ type: "language", op: "eq", value: "fr" }] }, ctx)).toBe(true);
    expect(matchTrigger({ conditions: [{ type: "identified", op: "is_false", value: "" }] }, ctx)).toBe(true);
    expect(matchTrigger({ conditions: [{ type: "visits", op: "gte", value: "5" }] }, ctx)).toBe(false);
  });
  it("renders template variables with fallbacks", () => {
    expect(renderTemplate("Hi {{name | there}}, from {{agent}}", { name: "", agent: "Sam" })).toBe("Hi there, from Sam");
    expect(renderTemplate("Hi {{ name }}", { name: "Ada" })).toBe("Hi Ada");
  });
});
