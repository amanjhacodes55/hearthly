import { z } from "zod";
import { Conversation, Message } from "@/lib/models";
import { currentConversation, postMessage } from "@/lib/chat";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({ messageId: z.string().regex(/^[a-f0-9]{24}$/), index: z.number().int().min(0).max(10) });

/** Visitor clicked a quick-reply button (routing bot): posts their choice, tags the conversation, sends the canned answer. */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Invalid action");
    const conv = await currentConversation(site._id, contact._id);
    if (!conv) return werr("No conversation", 404);
    const m = await Message.findOne({ _id: p.data.messageId, conversation: conv._id }).lean();
    const a = m?.actions?.[p.data.index];
    if (!a) return werr("Unknown action", 404);
    await postMessage({ site, conv, contact, from: "visitor", author: { id: String(contact._id), name: contact.name || "Visitor" }, text: a.label || "", skipAutomations: true });
    if (a.tag) await Conversation.updateOne({ _id: conv._id }, { $addToSet: { tags: a.tag } });
    if (a.reply) await postMessage({ site, conv, contact, from: "bot", author: { name: `${site.name} bot` }, text: a.reply, skipAutomations: true });
    return wjson({ ok: true });
  },
  { bucket: "action", capacity: 10, perSec: 0.2 },
);
