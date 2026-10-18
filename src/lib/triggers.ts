import { z } from "zod";

/** Visitor-side automation rules ("triggers"). Pure matching logic, evaluated server-side on pageview/ping. */
export const CONDITION_TYPES = {
  url: "Current page URL",
  time_on_page: "Seconds on current page",
  returning: "Returning visitor",
  visits: "Number of sessions",
  utm_source: "UTM source",
  utm_campaign: "UTM campaign",
  referrer: "Referrer",
  country: "Country code",
  language: "Browser language",
  identified: "Visitor is identified (has email)",
  device: "Device type",
} as const;
export type ConditionType = keyof typeof CONDITION_TYPES;

export const conditionSchema = z.object({
  type: z.enum(Object.keys(CONDITION_TYPES) as [ConditionType, ...ConditionType[]]),
  op: z.enum(["matches", "not_matches", "eq", "neq", "contains", "gte", "lte", "is_true", "is_false"]),
  value: z.string().max(300).default(""),
});
export const actionSchema = z.object({
  type: z.enum(["message", "open", "tag", "assign"]),
  text: z.string().max(2000).optional().default(""),
  operator: z.string().max(40).optional().default(""),
  tag: z.string().max(40).optional().default(""),
});
export const triggerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  conditions: z.array(conditionSchema).min(1).max(10),
  actions: z.array(actionSchema).min(1).max(5),
  once: z.boolean().default(true),
  delaySec: z.number().int().min(0).max(3600).default(0),
});
export type Condition = z.infer<typeof conditionSchema>;
export type TriggerRule = z.infer<typeof triggerSchema>;

export type VisitorContext = {
  url: string;
  timeOnPage: number;
  sessions: number;
  utmSource?: string;
  utmCampaign?: string;
  referrer?: string;
  country?: string;
  language?: string;
  identified?: boolean;
  device?: string;
};

/** Glob match where `*` = any run of characters; case-insensitive. No user regexes (ReDoS-safe). */
export function globMatch(pattern: string, input: string) {
  const p = pattern.toLowerCase();
  const s = (input || "").toLowerCase();
  if (!p.includes("*")) return s === p || s.includes(p);
  const parts = p.split("*");
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const idx = s.indexOf(part, pos);
    if (idx < 0 || (i === 0 && idx !== 0)) return false;
    pos = idx + part.length;
  }
  const last = parts[parts.length - 1];
  return last === "" || s.endsWith(last);
}

function cmpString(op: Condition["op"], actual: string, expected: string) {
  const a = (actual || "").toLowerCase();
  const e = expected.toLowerCase();
  switch (op) {
    case "matches": return globMatch(expected, actual);
    case "not_matches": return !globMatch(expected, actual);
    case "eq": return a === e;
    case "neq": return a !== e;
    case "contains": return a.includes(e);
    default: return false;
  }
}
function cmpNumber(op: Condition["op"], actual: number, expected: number) {
  switch (op) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gte": return actual >= expected;
    case "lte": return actual <= expected;
    default: return false;
  }
}

export function matchCondition(c: Condition, ctx: VisitorContext) {
  switch (c.type) {
    case "url": return cmpString(c.op, ctx.url, c.value);
    case "time_on_page": return cmpNumber(c.op === "eq" ? "gte" : c.op, ctx.timeOnPage, Number(c.value) || 0);
    case "visits": return cmpNumber(c.op, ctx.sessions, Number(c.value) || 0);
    case "returning": return c.op === "is_false" ? ctx.sessions <= 1 : ctx.sessions > 1;
    case "identified": return c.op === "is_false" ? !ctx.identified : !!ctx.identified;
    case "utm_source": return cmpString(c.op, ctx.utmSource || "", c.value);
    case "utm_campaign": return cmpString(c.op, ctx.utmCampaign || "", c.value);
    case "referrer": return cmpString(c.op, ctx.referrer || "", c.value);
    case "country": return cmpString(c.op, ctx.country || "", c.value);
    case "language": return cmpString(c.op, (ctx.language || "").slice(0, 2), c.value.slice(0, 2));
    case "device": return cmpString(c.op, ctx.device || "", c.value);
  }
  return false;
}

/** All conditions must match. */
export function matchTrigger(rule: { enabled?: boolean; conditions: Condition[] }, ctx: VisitorContext) {
  if (rule.enabled === false || !rule.conditions.length) return false;
  return rule.conditions.every((c) => matchCondition(c, ctx));
}

/** Smallest time_on_page threshold that could still make this rule fire (used to tell the widget when to ping). */
export function pendingDelay(rule: { conditions: Condition[] }, ctx: VisitorContext) {
  const t = rule.conditions.find((c) => c.type === "time_on_page");
  if (!t) return null;
  const others = rule.conditions.filter((c) => c !== t).every((c) => matchCondition(c, ctx));
  const need = Number(t.value) || 0;
  return others && ctx.timeOnPage < need ? need - ctx.timeOnPage : null;
}

export function renderTemplate(text: string, vars: Record<string, string | undefined>) {
  return text.replace(/\{\{\s*([a-z_.]+)\s*(?:\|\s*([^}]*))?\}\}/gi, (_, k: string, fb?: string) => vars[k.toLowerCase()] || (fb ?? "").trim());
}
