import { z } from "zod";
import { route, json, body } from "@/lib/api";
import { Website } from "@/lib/models";
import { createWebsite } from "@/lib/website";

export const GET = route(async (_req, ctx) => {
  const list = await Website.find({ "members.user": ctx.user.id }).select("name publicId domain members").lean();
  return json(list.map((w) => ({ id: String(w._id), name: w.name, publicId: w.publicId, domain: w.domain, role: w.members.find((m) => String(m.user) === ctx.user.id)?.role, current: String(w._id) === ctx.website.id })));
}, { noWebsite: true });

const schema = z.object({ name: z.string().trim().min(1).max(80), domain: z.string().trim().max(200).default(""), sample: z.boolean().default(true) });
export const POST = route(async (req, ctx) => {
  const b = await body(req, schema);
  const site = await createWebsite(ctx.user.id, b);
  return json({ id: String(site._id), publicId: site.publicId }, 201);
}, { noWebsite: true });
