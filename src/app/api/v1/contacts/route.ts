import { contactSchema } from "@/lib/v1contacts";
import { v1, v1json, v1body, paginate } from "@/lib/v1";
import { Contact } from "@/lib/models";
import { sContact } from "@/lib/serialize";
import { contactChanged } from "@/lib/chat";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** GET /api/v1/contacts?email=&q=&tag=&page=&limit= */
export const GET = v1("contacts:read", async (req, ctx) => {
  const url = new URL(req.url);
  const p = paginate(url);
  const q: Record<string, unknown> = { website: ctx.websiteId, mergedInto: null };
  const email = url.searchParams.get("email");
  if (email) q.email = email.toLowerCase();
  const term = url.searchParams.get("q");
  if (term) q.$or = [{ name: { $regex: esc(term.slice(0, 100)), $options: "i" } }, { email: { $regex: esc(term.slice(0, 100)), $options: "i" } }];
  const tag = url.searchParams.get("tag");
  if (tag) q.tags = tag;
  const [list, total] = await Promise.all([Contact.find(q).sort({ lastSeenAt: -1 }).skip(p.skip).limit(p.limit).lean(), Contact.countDocuments(q)]);
  return v1json({ data: list.map(sContact), pagination: p.meta(total) });
});

/** Create a contact — upserts on email (merge), returning 200 for an update and 201 for a new contact. */
export const POST = v1("contacts:write", async (req, ctx) => {
  const b = await v1body(req, contactSchema);
  if (!b.email && !b.name && !b.external_id) return v1json({ error: { code: "validation_failed", message: "Provide email, name or external_id" } }, 422);
  const existing = b.email ? await Contact.findOne({ website: ctx.websiteId, email: b.email, mergedInto: null }) : b.external_id ? await Contact.findOne({ website: ctx.websiteId, externalId: b.external_id }) : null;
  const set: Record<string, unknown> = {};
  for (const k of ["email", "name", "phone", "company"] as const) if (b[k] !== undefined) set[k] = b[k];
  if (b.external_id) set.externalId = b.external_id;
  for (const [k, v] of Object.entries(b.data || {})) if (/^[A-Za-z0-9_\-]{1,60}$/.test(k)) set[`data.${k}`] = v;
  if (existing) {
    const d = await Contact.findByIdAndUpdate(existing._id, { $set: set, ...(b.tags ? { $addToSet: { tags: { $each: b.tags } } } : {}) }, { new: true }).lean();
    contactChanged(ctx.websiteId, d);
    return v1json({ data: sContact(d), merged: true });
  }
  const created = (await Contact.create({ website: ctx.websiteId, ...set, data: b.data || {}, tags: b.tags || [], source: "api", sessions: 0 })).toObject();
  contactChanged(ctx.websiteId, created, true);
  return v1json({ data: sContact(created) }, 201);
});
