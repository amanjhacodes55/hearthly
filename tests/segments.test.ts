import { describe, expect, it } from "vitest";
import { filterToQuery, segmentToQuery } from "@/lib/segments";

const NOW = Date.UTC(2026, 0, 31);
describe("segment → mongo query", () => {
  it("builds string operators with escaped regexes", () => {
    expect(filterToQuery({ field: "email", op: "eq", value: "a@x.test", key: "" })).toEqual({ email: "a@x.test" });
    expect(filterToQuery({ field: "email", op: "contains", value: "a.b+", key: "" })).toEqual({ email: { $regex: "a\\.b\\+", $options: "i" } });
    expect(filterToQuery({ field: "country", op: "starts_with", value: "U", key: "" })).toEqual({ "geo.country": { $regex: "^U", $options: "i" } });
    expect(filterToQuery({ field: "phone", op: "exists", value: "", key: "" })).toEqual({ phone: { $exists: true, $nin: ["", null] } });
  });
  it("handles tags, events, numbers, dates and custom data", () => {
    expect(filterToQuery({ field: "tag", op: "has", value: "vip", key: "" })).toEqual({ tags: "vip" });
    expect(filterToQuery({ field: "event", op: "not_has", value: "signup", key: "" })).toEqual({ eventNames: { $ne: "signup" } });
    expect(filterToQuery({ field: "sessions", op: "gt", value: "3", key: "" })).toEqual({ sessions: { $gt: 3 } });
    expect(filterToQuery({ field: "last_seen", op: "within_days", value: "7", key: "" }, NOW)).toEqual({ lastSeenAt: { $gte: new Date(NOW - 7 * 86400_000) } });
    expect(filterToQuery({ field: "data", op: "eq", value: "pro", key: "plan" })).toEqual({ "data.plan": "pro" });
    expect(filterToQuery({ field: "data", op: "eq", value: "5", key: "seats" })).toEqual({ "data.seats": { $in: ["5", 5] } });
  });
  it("rejects invalid operator/field combos and keyless data filters", () => {
    expect(() => filterToQuery({ field: "tag", op: "gt", value: "1", key: "" })).toThrow();
    expect(() => filterToQuery({ field: "data", op: "eq", value: "1", key: "" })).toThrow();
  });
  it("combines with all / any", () => {
    const f = [{ field: "tag" as const, op: "has", value: "vip", key: "" }, { field: "country" as const, op: "eq", value: "FR", key: "" }];
    expect(segmentToQuery({ match: "all", filters: f })).toEqual({ $and: [{ tags: "vip" }, { "geo.country": "FR" }] });
    expect(segmentToQuery({ match: "any", filters: f })).toEqual({ $or: [{ tags: "vip" }, { "geo.country": "FR" }] });
    expect(segmentToQuery({ filters: [] })).toEqual({});
  });
});

import { parseCsv, toCsv } from "@/lib/csv";
describe("csv", () => {
  it("parses quotes, commas, CRLF and escapes formulas on export", () => {
    expect(parseCsv('email,name\r\na@x.test,"Doe, Jane"\r\nb@x.test,"say ""hi"""\n')).toEqual([["email", "name"], ["a@x.test", "Doe, Jane"], ["b@x.test", 'say "hi"']]);
    expect(toCsv([["=SUM(A1)", "ok"]])).toBe("'=SUM(A1),ok\r\n");
  });
});
