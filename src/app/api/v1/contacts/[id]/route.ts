import { v1, v1json, v1body, v1err } from "@/lib/v1";
import { Contact } from "@/lib/models";
import { sContact } from "@/lib/serialize";
import { contactChanged } from "@/lib/chat";
import { contactSchema } from "@/lib/v1contacts";

type P = { id: string };
const valid = (id: string) => /^[a-f0-9]{24}$/.test(id);

export const GET = v1<P>("contacts:read", async (_req, ctx, { id }) => {
  const c = valid(id) ? await Contact.findOne({ _id: id, website: ctx.websiteId }).lean() : null;
  return c ? v1json({ data: sContact(c) }) : v1err("not_found", "Contact not found", 404);
});

export const PATCH = v1<P>("contacts:write", async (req, ctx, { id }) => {
  const b = await v1body(req, contactSchema);
  const set: Record<string, unknown> = {};
  for (const k of ["email", "name", "phone", "company"] as const) if (b[k] !== undefined) set[k] = b[k];
  if (b.external_id !== undefined) set.externalId = b.external_id;
  if (b.tags) set.tags = b.tags;
  for (const [k, v] of Object.entries(b.data || {})) if (/^[A-Za-z0-9_\-]{1,60}$/.test(k)) set[`data.${k}`] = v;
  const d = valid(id) ? await Contact.findOneAndUpdate({ _id: id, website: ctx.websiteId }, { $set: set }, { new: true }).lean() : null;
  if (!d) return v1err("not_found", "Contact not found", 404);
  contactChanged(ctx.websiteId, d);
  return v1json({ data: sContact(d) });
});
