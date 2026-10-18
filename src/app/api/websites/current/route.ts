import { z } from "zod";
import { route, json, body, err } from "@/lib/api";
import { Article, Campaign, CampaignDelivery, Category, Contact, Conversation, DEFAULT_WIDGET, Installation, Message, PageView, Segment, Shortcut, TrackedEvent, Trigger, User, Webhook, Website, ApiKey, Invite } from "@/lib/models";
import { publish } from "@/lib/bus";
import { rand } from "@/lib/ids";
import { canAdmin } from "@/lib/context";

export const GET = route(async (_req, ctx) => {
  const w = await Website.findById(ctx.website.id).lean();
  if (!w) return err("Not found", 404);
  return json({
    id: String(w._id),
    publicId: w.publicId,
    name: w.name,
    domain: w.domain,
    logo: w.logo,
    widget: { ...DEFAULT_WIDGET, ...(w.widget || {}) },
    availability: w.availability,
    rules: w.rules,
    tags: w.tags,
    identitySecret: canAdmin(ctx.website.role) ? w.identitySecret : undefined,
    role: ctx.website.role,
  });
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const field = z.object({ key: z.string().regex(/^[a-z0-9_]{1,30}$/i), label: z.string().max(60), type: z.enum(["text", "email", "tel", "textarea"]), required: z.boolean() });
const widgetSchema = z
  .object({
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    gradient: z.boolean(),
    theme: z.enum(["light", "dark", "auto"]),
    position: z.enum(["left", "right"]),
    launcherIcon: z.enum(["bubble", "wave", "spark", "help"]),
    launcherText: z.string().max(30),
    radius: z.number().int().min(0).max(28),
    title: z.string().max(60),
    welcome: z.string().max(300),
    teamName: z.string().max(60),
    showTeam: z.boolean(),
    showBranding: z.boolean(),
    sound: z.boolean(),
    hideOnMobile: z.boolean(),
    hideOnUrls: z.array(z.string().max(200)).max(20),
    autoOpenAfterSec: z.number().int().min(0).max(600),
    autoOpenOnUrls: z.array(z.string().max(200)).max(20),
    preChat: z.object({ enabled: z.boolean(), fields: z.array(field).max(6) }),
    strings: z.record(z.string().max(200)).refine((r) => Object.keys(r).length <= 40),
    locale: z.string().max(10),
    allowAttachments: z.boolean(),
    allowRating: z.boolean(),
    allowTranscript: z.boolean(),
    kbSearch: z.boolean(),
    quickReplies: z.array(z.object({ label: z.string().max(60), reply: z.string().max(500), tag: z.string().max(40) })).max(6),
  })
  .partial();

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  domain: z.string().trim().max(200).optional(),
  logo: z.string().url().max(500).or(z.literal("")).optional(),
  widget: widgetSchema.optional(),
  availability: z.object({ enabled: z.boolean(), timezone: z.string().max(64), hours: z.array(z.object({ day: z.number().int().min(0).max(6), start: hhmm, end: hhmm })).max(21), offlineMessage: z.string().max(500) }).optional(),
  rules: z.object({ autoAssign: z.boolean(), offlineAutoReply: z.boolean(), autoResolveDays: z.number().int().min(0).max(90), botEnabled: z.boolean() }).partial().optional(),
  tags: z.array(z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-f]{6}$/i) })).max(100).optional(),
  rotateIdentitySecret: z.boolean().optional(),
});

export const PATCH = route(async (req, ctx) => {
  const b = await body(req, schema);
  const set: Record<string, unknown> = {};
  if (b.name !== undefined) set.name = b.name;
  if (b.domain !== undefined) set.domain = b.domain;
  if (b.logo !== undefined) set.logo = b.logo;
  if (b.widget) for (const [k, v] of Object.entries(b.widget)) set[`widget.${k}`] = v;
  if (b.availability) set.availability = b.availability;
  if (b.rules) for (const [k, v] of Object.entries(b.rules)) set[`rules.${k}`] = v;
  if (b.tags) set.tags = b.tags;
  if (b.rotateIdentitySecret) set.identitySecret = rand(24);
  if (b.availability?.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: b.availability.timezone });
    } catch {
      return err("Unknown time zone");
    }
  }
  await Website.updateOne({ _id: ctx.website.id }, { $set: set });
  publish(`site:${ctx.website.id}`, "settings", { changed: Object.keys(b) });
  return json({ ok: true });
}, { role: "admin" });

/** Delete the website and everything in it (owner only). */
export const DELETE = route(async (req, ctx) => {
  const { confirm } = await body(req, z.object({ confirm: z.string() }));
  if (confirm !== ctx.website.name) return err("Type the website name to confirm.");
  const w = ctx.website.id;
  await Promise.all([Article, Campaign, CampaignDelivery, Category, Contact, Conversation, Message, PageView, Segment, Shortcut, TrackedEvent, Trigger, Webhook, Installation, ApiKey, Invite].map((M) => (M as unknown as { deleteMany: (q: object) => Promise<unknown> }).deleteMany({ website: w })));
  await Website.deleteOne({ _id: w });
  await User.updateMany({ currentWebsite: w }, { $unset: { currentWebsite: 1 } });
  return json({ ok: true });
}, { role: "owner" });
