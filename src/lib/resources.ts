import "server-only";
import { z } from "zod";
import { crud } from "@/lib/crud";
import { Article, Campaign, Category, Segment, Shortcut, Trigger } from "@/lib/models";
import { segmentSchema } from "@/lib/segments";
import { triggerSchema } from "@/lib/triggers";
import { slug } from "@/lib/sample";
import { HttpError } from "@/lib/api";

export const segments = crud(Segment, segmentSchema, { sort: { name: 1 } });

export const shortcuts = crud(
  Shortcut,
  z.object({ shortcut: z.string().trim().toLowerCase().regex(/^[a-z0-9_\-]{1,30}$/, "Use letters, numbers, - or _"), title: z.string().trim().max(80).default(""), body: z.string().trim().min(1).max(4000) }),
  { sort: { shortcut: 1 } },
);

export const triggers = crud(Trigger, triggerSchema, { role: "admin" });

export const categories = crud(
  Category,
  z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(300).default(""), icon: z.string().max(8).default("📘"), order: z.number().int().default(0) }),
  { role: "admin", sort: { order: 1 }, before: (d) => (d.name ? { ...d, slug: slug(d.name) } : d) },
);

const articleSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().max(50_000).default(""),
  category: z.string().regex(/^[a-f0-9]{24}$/).nullable().default(null),
  published: z.boolean().default(true),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,80}$/).optional(),
});
export const articles = crud(Article, articleSchema, {
  role: "admin",
  sort: { updatedAt: -1 },
  before: async (d, ctx, existing) => {
    const out = { ...d };
    if (d.title && !d.slug && !existing) out.slug = slug(d.title) || `article-${Date.now()}`;
    if (d.body !== undefined) out.excerpt = String(d.body).replace(/```[\s\S]*?```/g, "").replace(/[#*`>_\[\]()!-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    if (out.slug) {
      const clash = await Article.exists({ website: ctx.website.id, slug: out.slug, ...(existing ? { _id: { $ne: existing._id } } : {}) });
      if (clash) {
        if (d.slug) throw new HttpError(409, "Another article already uses this slug");
        out.slug = `${out.slug}-${Date.now().toString(36)}`;
      }
    }
    return out;
  },
});

export const campaignSchema = z.object({
  name: z.string().trim().min(1).max(100),
  segment: z.string().regex(/^[a-f0-9]{24}$/).nullable().default(null),
  channel: z.enum(["chat", "email", "both"]).default("chat"),
  subject: z.string().max(200).default(""),
  body: z.string().trim().min(1).max(5000),
});
export const campaigns = crud(Campaign, campaignSchema, {
  role: "admin",
  before: (d, ctx, existing) => {
    if (existing && existing.status !== "draft") throw new HttpError(400, "Sent campaigns can't be edited");
    return existing ? d : { ...d, sender: ctx.user.id };
  },
});
