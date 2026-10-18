import { z } from "zod";
import { route, json, body, err, oid } from "@/lib/api";
import { Contact, Conversation, Message, Website } from "@/lib/models";
import { sConversation, sMessage } from "@/lib/serialize";
import { loadSite, postMessage, setConversationStatus } from "@/lib/chat";
import { publish } from "@/lib/bus";

type P = { id: string };

export const GET = route<P>(async (_req, ctx, { id }) => {
  const conv = await Conversation.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  if (!conv) return err("Conversation not found", 404);
  const [contact, msgs] = await Promise.all([Contact.findById(conv.contact).lean(), Message.find({ conversation: conv._id }).sort({ createdAt: -1 }).limit(300).lean()]);
  return json({ conversation: sConversation(conv, contact), messages: msgs.reverse().map(sMessage) });
});

const schema = z.object({
  status: z.enum(["open", "pending", "resolved"]).optional(),
  assignee: z.string().regex(/^[a-f0-9]{24}$/).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  snoozeUntil: z.string().datetime().nullable().optional(),
  subject: z.string().max(200).optional(),
});

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const b = await body(req, schema);
  const site = await loadSite(ctx.website.id);
  const conv = await Conversation.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  if (!conv || !site) return err("Conversation not found", 404);
  const set: Record<string, unknown> = {};
  const notes: string[] = [];
  if (b.assignee !== undefined) {
    if (b.assignee && !site.members.some((m) => String(m.user) === b.assignee)) return err("Assignee must be a team member");
    set.assignee = b.assignee;
    notes.push(b.assignee ? (b.assignee === ctx.user.id ? `${ctx.user.name} took this conversation` : `${ctx.user.name} assigned this conversation`) : `${ctx.user.name} unassigned this conversation`);
  }
  if (b.tags) {
    set.tags = [...new Set(b.tags)];
    const known = new Set((site.tags || []).map((t) => t.name));
    const fresh = set.tags as string[];
    const add = fresh.filter((t) => !known.has(t)).map((name) => ({ name, color: "#64748b" }));
    if (add.length) await Website.updateOne({ _id: site._id }, { $push: { tags: { $each: add } } });
  }
  if (b.subject !== undefined) set.subject = b.subject;
  if (b.snoozeUntil !== undefined) {
    set.snoozedUntil = b.snoozeUntil ? new Date(b.snoozeUntil) : null;
    if (b.snoozeUntil) {
      set.status = "pending";
      notes.push(`${ctx.user.name} snoozed until ${new Date(b.snoozeUntil).toUTCString().slice(0, 22)}`);
    }
  }
  if (Object.keys(set).length) {
    const updated = await Conversation.findByIdAndUpdate(conv._id, set, { new: true }).lean();
    publish(`site:${ctx.website.id}`, "conversation", sConversation(updated, await Contact.findById(conv.contact).lean()));
  }
  if (b.status && b.status !== conv.status) {
    await setConversationStatus(site, String(conv._id), b.status, ctx.user.id);
    notes.push(`${ctx.user.name} marked as ${b.status}`);
  }
  for (const text of notes) await postMessage({ site, conv: { ...conv, status: b.status || conv.status }, from: "system", text });
  const fresh = await Conversation.findById(conv._id).lean();
  return json(sConversation(fresh, await Contact.findById(conv.contact).lean()));
});

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  const conv = await Conversation.findOneAndDelete({ _id: oid(id), website: ctx.website.id });
  if (!conv) return err("Conversation not found", 404);
  await Message.deleteMany({ conversation: conv._id });
  publish(`site:${ctx.website.id}`, "conversation.deleted", { id });
  return json({ ok: true });
}, { role: "admin" });
