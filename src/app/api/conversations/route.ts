import { z } from "zod";
import { Types } from "mongoose";
import { route, json, body, err, pageParams } from "@/lib/api";
import { Contact, Conversation, Message, Segment } from "@/lib/models";
import { segmentToQuery, type SegmentFilter } from "@/lib/segments";
import { sConversation } from "@/lib/serialize";
import { currentConversation, loadSite, postMessage, startConversation } from "@/lib/chat";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Inbox list with filters: status, assigned (me|unassigned), unread, tag, segment, q (contact or message text). */
export const GET = route(async (req, ctx) => {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const { limit, skip } = pageParams(url, 40, 100);
  const site = new Types.ObjectId(ctx.website.id);
  const q: Record<string, unknown> = { website: site };
  const status = sp.get("status") || "open";
  if (status === "snoozed") q.snoozedUntil = { $gt: new Date() };
  else if (status !== "all") q.status = status;
  if (sp.get("assigned") === "me") q.assignee = new Types.ObjectId(ctx.user.id);
  if (sp.get("assigned") === "unassigned") q.assignee = null;
  if (sp.get("unread") === "1") q.unreadAgent = { $gt: 0 };
  if (sp.get("tag")) q.tags = sp.get("tag");
  if (sp.get("contact") && /^[a-f0-9]{24}$/.test(sp.get("contact")!)) q.contact = new Types.ObjectId(sp.get("contact")!);
  const and: Record<string, unknown>[] = [];
  const segId = sp.get("segment");
  if (segId && /^[a-f0-9]{24}$/.test(segId)) {
    const seg = await Segment.findOne({ _id: segId, website: site }).lean();
    if (seg) {
      const ids = await Contact.find({ website: site, ...segmentToQuery({ match: seg.match as "all" | "any", filters: seg.filters as SegmentFilter[] }) }).select("_id").limit(5000).lean();
      and.push({ contact: { $in: ids.map((c) => c._id) } });
    }
  }
  const term = (sp.get("q") || "").trim().slice(0, 100);
  if (term) {
    const rx = { $regex: esc(term), $options: "i" };
    const [cids, convIds] = await Promise.all([
      Contact.find({ website: site, $or: [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }] }).select("_id").limit(500).lean(),
      Message.distinct("conversation", { website: site, text: rx }),
    ]);
    and.push({ $or: [{ contact: { $in: cids.map((c) => c._id) } }, { _id: { $in: convIds.slice(0, 1000) } }] });
  }
  if (and.length) q.$and = and;
  const sort: Record<string, 1 | -1> = sp.get("sort") === "oldest" ? { updatedAt: 1 } : { updatedAt: -1 };
  const [list, total] = await Promise.all([Conversation.find(q).sort(sort).skip(skip).limit(limit).populate("contact").lean(), Conversation.countDocuments(q)]);
  return json({ data: list.map((c) => sConversation(c)), total, hasMore: skip + list.length < total });
});

/** Start a conversation with a contact proactively (e.g. from Live visitors). */
export const POST = route(async (req, ctx) => {
  const b = await body(req, z.object({ contactId: z.string().regex(/^[a-f0-9]{24}$/), text: z.string().trim().min(1).max(5000) }));
  const site = await loadSite(ctx.website.id);
  const contact = await Contact.findOne({ _id: b.contactId, website: ctx.website.id }).lean();
  if (!site || !contact) return err("Contact not found", 404);
  let conv = await currentConversation(site._id, contact._id);
  if (!conv || conv.status === "resolved") conv = await startConversation(site, contact, { channel: "widget" });
  await Conversation.updateOne({ _id: conv._id }, { assignee: ctx.user.id });
  const r = await postMessage({ site, conv, contact, from: "operator", author: { id: ctx.user.id, name: ctx.user.name, avatar: ctx.user.image }, text: b.text });
  return json({ conversation: r.conversation, message: r.message }, 201);
});
