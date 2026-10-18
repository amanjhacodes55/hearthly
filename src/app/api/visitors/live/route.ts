import { route, json } from "@/lib/api";
import { Contact, Conversation } from "@/lib/models";
import { sContact } from "@/lib/serialize";

/** Visitors seen in the last 75 seconds (widget heartbeats every 30s). */
export const GET = route(async (_req, ctx) => {
  const list = await Contact.find({ website: ctx.website.id, lastSeenAt: { $gt: new Date(Date.now() - 75_000) }, mergedInto: null }).sort({ lastSeenAt: -1 }).limit(200).lean();
  const convs = await Conversation.find({ contact: { $in: list.map((c) => c._id) }, status: { $ne: "resolved" } }).select("contact").lean();
  const chatting = new Set(convs.map((c) => String(c.contact)));
  return json(list.map((c) => ({ ...sContact(c), chatting: chatting.has(String(c._id)) })));
});
