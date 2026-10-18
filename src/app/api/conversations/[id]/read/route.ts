import { route, json, oid } from "@/lib/api";
import { Conversation } from "@/lib/models";
import { publish } from "@/lib/bus";

/** Agent opened the conversation → clear unread + read receipt for the visitor. */
export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const at = new Date();
  const conv = await Conversation.findOneAndUpdate({ _id: oid(id), website: ctx.website.id }, { unreadAgent: 0, agentReadAt: at }, { new: true }).select("contact").lean();
  if (conv) {
    publish(`visitor:${conv.contact}`, "read", { at: at.toISOString() });
    publish(`site:${ctx.website.id}`, "read", { conversation_id: id, who: "agent", at: at.toISOString() });
  }
  return json({ ok: true });
});
