import { z } from "zod";

/** Segment filters → MongoDB query over the Contact collection. Pure & unit tested. */
export const SEGMENT_FIELDS = {
  email: { label: "Email", type: "string", path: "email" },
  name: { label: "Name", type: "string", path: "name" },
  phone: { label: "Phone", type: "string", path: "phone" },
  country: { label: "Country code", type: "string", path: "geo.country" },
  city: { label: "City", type: "string", path: "geo.city" },
  locale: { label: "Language", type: "string", path: "geo.locale" },
  browser: { label: "Browser", type: "string", path: "device.browser" },
  os: { label: "OS", type: "string", path: "device.os" },
  device: { label: "Device type", type: "string", path: "device.type" },
  utm_source: { label: "UTM source", type: "string", path: "utm.source" },
  utm_campaign: { label: "UTM campaign", type: "string", path: "utm.campaign" },
  referrer: { label: "Referrer", type: "string", path: "referrer" },
  tag: { label: "Tag", type: "tag", path: "tags" },
  event: { label: "Performed event", type: "event", path: "eventNames" },
  sessions: { label: "Sessions", type: "number", path: "sessions" },
  last_seen: { label: "Last seen", type: "date", path: "lastSeenAt" },
  first_seen: { label: "First seen", type: "date", path: "firstSeenAt" },
  data: { label: "Custom data", type: "data", path: "data" },
} as const;
export type SegmentField = keyof typeof SEGMENT_FIELDS;

export const OPS = {
  string: ["eq", "neq", "contains", "not_contains", "starts_with", "exists", "not_exists"],
  tag: ["has", "not_has"],
  event: ["has", "not_has"],
  number: ["eq", "gt", "lt"],
  date: ["within_days", "older_than_days"],
  data: ["eq", "neq", "contains", "exists", "not_exists", "gt", "lt"],
} as const;

export const filterSchema = z.object({
  field: z.enum(Object.keys(SEGMENT_FIELDS) as [SegmentField, ...SegmentField[]]),
  op: z.string().max(20),
  value: z.string().max(200).optional().default(""),
  key: z.string().max(60).regex(/^[A-Za-z0-9_\-]*$/).optional().default(""), // custom data key
});
export type SegmentFilter = z.infer<typeof filterSchema>;
export const segmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  match: z.enum(["all", "any"]).default("all"),
  filters: z.array(filterSchema).max(20),
});

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function filterToQuery(f: SegmentFilter, now = Date.now()): Record<string, unknown> {
  const def = SEGMENT_FIELDS[f.field];
  if (!def) throw new Error(`Unknown field ${f.field}`);
  const allowed = OPS[def.type] as readonly string[];
  if (!allowed.includes(f.op)) throw new Error(`Operator ${f.op} not valid for ${f.field}`);
  let path: string = def.path;
  if (def.type === "data") {
    if (!f.key) throw new Error("Custom data filters need a key");
    path = `data.${f.key}`;
  }
  const v = f.value ?? "";
  const num = Number(v);
  switch (f.op) {
    case "eq":
      return def.type === "number" ? { [path]: num } : { [path]: def.type === "data" && v !== "" && !isNaN(num) ? { $in: [v, num] } : v };
    case "neq":
      return { [path]: { $ne: v } };
    case "contains":
      return { [path]: { $regex: esc(v), $options: "i" } };
    case "not_contains":
      return { [path]: { $not: new RegExp(esc(v), "i") } };
    case "starts_with":
      return { [path]: { $regex: `^${esc(v)}`, $options: "i" } };
    case "exists":
      return { [path]: { $exists: true, $nin: ["", null] } };
    case "not_exists":
      return { $or: [{ [path]: { $exists: false } }, { [path]: { $in: ["", null] } }] };
    case "gt":
      return { [path]: { $gt: num } };
    case "lt":
      return { [path]: { $lt: num } };
    case "has":
      return { [path]: v };
    case "not_has":
      return { [path]: { $ne: v } };
    case "within_days":
      return { [path]: { $gte: new Date(now - num * 86400_000) } };
    case "older_than_days":
      return { [path]: { $lt: new Date(now - num * 86400_000) } };
  }
  throw new Error(`Unsupported operator ${f.op}`);
}

export function segmentToQuery(seg: { match?: "all" | "any"; filters: SegmentFilter[] }, now = Date.now()) {
  const parts = seg.filters.map((f) => filterToQuery(f, now));
  if (!parts.length) return {};
  return seg.match === "any" ? { $or: parts } : { $and: parts };
}
