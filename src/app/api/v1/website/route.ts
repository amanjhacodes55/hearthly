import { v1, v1json } from "@/lib/v1";
import { Website } from "@/lib/models";
import { siteStatus } from "@/lib/chat";

export const GET = v1(null, async (_req, ctx) => {
  const w = await Website.findById(ctx.websiteId).lean();
  if (!w) return v1json({ error: { code: "not_found", message: "Website not found" } }, 404);
  const s = siteStatus(w);
  return v1json({ data: { id: w.publicId, internal_id: String(w._id), name: w.name, domain: w.domain, members: w.members.length, online: s.online, within_hours: s.withinHours, created_at: w.createdAt }, token: { type: ctx.actor.type, name: ctx.actor.name, scopes: ctx.scopes } });
});
