import { route, json, body, err, pageParams } from "@/lib/api";
import { Contact } from "@/lib/models";
import { contactInput, contactQuery } from "@/lib/contacts";
import { sContact } from "@/lib/serialize";
import { contactChanged } from "@/lib/chat";

export const GET = route(async (req, ctx) => {
  const url = new URL(req.url);
  const { limit, skip } = pageParams(url, 50, 200);
  let q;
  try {
    q = await contactQuery(ctx.website.id, url.searchParams);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Invalid filters");
  }
  const sortKey = url.searchParams.get("sort") || "lastSeenAt";
  const sort = { [["lastSeenAt", "firstSeenAt", "name", "email", "sessions"].includes(sortKey) ? sortKey : "lastSeenAt"]: url.searchParams.get("dir") === "asc" ? 1 : -1 } as Record<string, 1 | -1>;
  const [list, total] = await Promise.all([Contact.find(q).sort(sort).skip(skip).limit(limit).lean(), Contact.countDocuments(q)]);
  return json({ data: list.map(sContact), total, hasMore: skip + list.length < total });
});

/** Create a contact; merges into the existing contact when the email already exists. */
export const POST = route(async (req, ctx) => {
  const b = await body(req, contactInput);
  if (!b.email && !b.name) return err("Provide at least a name or an email");
  const existing = b.email ? await Contact.findOne({ website: ctx.website.id, email: b.email, mergedInto: null }) : null;
  if (existing) {
    const set: Record<string, unknown> = {};
    for (const k of ["name", "phone", "company"] as const) if (b[k]) set[k] = b[k];
    for (const [k, v] of Object.entries(b.data)) set[`data.${k}`] = v;
    const d = await Contact.findByIdAndUpdate(existing._id, { $set: set, $addToSet: { tags: { $each: b.tags } } }, { new: true }).lean();
    contactChanged(ctx.website.id, d);
    return json({ ...sContact(d), merged: true });
  }
  const d = (await Contact.create({ ...b, website: ctx.website.id, source: "manual", sessions: 0 })).toObject();
  contactChanged(ctx.website.id, d, true);
  return json(sContact(d), 201);
});
