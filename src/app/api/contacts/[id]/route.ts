import { z } from "zod";
import { route, json, body, err, oid } from "@/lib/api";
import { Contact, Conversation, Message, PageView, TrackedEvent } from "@/lib/models";
import { sContact, sConversation } from "@/lib/serialize";
import { contactChanged } from "@/lib/chat";

type P = { id: string };

/** Full visitor profile: contact + page timeline + events + past conversations + possible duplicates. */
export const GET = route<P>(async (_req, ctx, { id }) => {
  const c = await Contact.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  if (!c) return err("Contact not found", 404);
  const [pages, events, convs, dupes] = await Promise.all([
    PageView.find({ contact: c._id }).sort({ at: -1 }).limit(60).lean(),
    TrackedEvent.find({ contact: c._id }).sort({ at: -1 }).limit(40).lean(),
    Conversation.find({ contact: c._id }).sort({ updatedAt: -1 }).limit(20).lean(),
    c.email ? Contact.find({ website: ctx.website.id, email: c.email, _id: { $ne: c._id }, mergedInto: null }).select("name email lastSeenAt").lean() : [],
  ]);
  return json({
    contact: sContact(c),
    notes: (c.notes || []).map((n) => ({ id: String(n._id), text: n.text, author: n.author, at: n.at })),
    pages: pages.map((p) => ({ url: p.url, path: p.path, title: p.title, referrer: p.referrer, at: p.at, duration: p.duration })),
    events: events.map((e) => ({ name: e.name, props: e.props, at: e.at })),
    conversations: convs.map((x) => sConversation(x)),
    duplicates: dupes.map((d) => ({ id: String(d._id), name: d.name, email: d.email, lastSeenAt: d.lastSeenAt })),
  });
});

const schema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email().max(200).or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  data: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
  addNote: z.string().trim().min(1).max(2000).optional(),
  removeNote: z.string().regex(/^[a-f0-9]{24}$/).optional(),
});

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const b = await body(req, schema);
  const { addNote, removeNote, ...rest } = b;
  const update: Record<string, unknown> = { $set: rest };
  if (addNote) update.$push = { notes: { text: addNote, author: ctx.user.name, at: new Date() } };
  if (removeNote) update.$pull = { notes: { _id: removeNote } };
  const d = await Contact.findOneAndUpdate({ _id: oid(id), website: ctx.website.id }, update, { new: true }).lean();
  if (!d) return err("Contact not found", 404);
  contactChanged(ctx.website.id, d);
  return json(sContact(d));
});

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  const c = await Contact.findOneAndDelete({ _id: oid(id), website: ctx.website.id });
  if (!c) return err("Contact not found", 404);
  const convs = await Conversation.find({ contact: c._id }).select("_id").lean();
  await Promise.all([Message.deleteMany({ conversation: { $in: convs.map((x) => x._id) } }), Conversation.deleteMany({ contact: c._id }), PageView.deleteMany({ contact: c._id }), TrackedEvent.deleteMany({ contact: c._id })]);
  return json({ ok: true });
}, { role: "admin" });
