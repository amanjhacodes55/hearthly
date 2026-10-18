import { z } from "zod";
import { Conversation, DEFAULT_WIDGET, Message } from "@/lib/models";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";
import { currentConversation, postMessage, startConversation } from "@/lib/chat";
import { sMessage, visitorConv } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Polling fallback: messages of the visitor's current conversation newer than ?since= */
export const GET = visitorRoute(
  async (req, { site, contact }) => {
    const since = new URL(req.url).searchParams.get("since");
    const conv = await currentConversation(site._id, contact._id);
    if (!conv) return wjson({ conversation: null, messages: [] });
    const q: Record<string, unknown> = { conversation: conv._id, from: { $in: ["visitor", "operator", "bot"] } };
    if (since && !isNaN(Date.parse(since))) q.createdAt = { $gt: new Date(since) };
    const msgs = await Message.find(q).sort({ createdAt: -1 }).limit(100).lean();
    return wjson({ conversation: visitorConv(conv), messages: msgs.reverse().map(sMessage) });
  },
  { bucket: "poll", capacity: 40, perSec: 0.5 },
);

const att = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), name: z.string().max(200), size: z.number().max(10 * 1024 * 1024), type: z.string().max(120) });
const schema = z.object({ text: z.string().max(5000).default(""), attachments: z.array(att).max(5).default([]), quickReply: z.number().int().min(0).max(10).optional() });

export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Invalid message");
    const text = p.data.text.trim();
    if (!text && !p.data.attachments.length) return werr("Empty message");
    let conv = await currentConversation(site._id, contact._id);
    if (!conv) conv = await startConversation(site, contact);
    // Attachments must have been uploaded by this visitor (ids come from /api/widget/upload).
    const { findFile } = await import("@/lib/files");
    for (const a of p.data.attachments) {
      const f = await findFile(a.id);
      if (!f || f.file.metadata?.uploader !== `visitor:${contact._id}`) return werr("Unknown attachment", 400);
    }
    const quick = p.data.quickReply !== undefined ? ({ ...DEFAULT_WIDGET, ...(site.widget || {}) }.quickReplies || [])[p.data.quickReply] : undefined;
    const r = await postMessage({ site, conv, contact, from: "visitor", author: { id: String(contact._id), name: contact.name || "Visitor" }, text, attachments: p.data.attachments, skipAutomations: Boolean(quick) });
    if (quick) {
      // Routing bot: a welcome quick-reply tags the conversation and answers instantly.
      if (quick.tag) await Conversation.updateOne({ _id: conv._id }, { $addToSet: { tags: quick.tag } });
      if (quick.reply) await postMessage({ site, conv, contact, from: "bot", author: { name: `${site.name} bot` }, text: quick.reply, skipAutomations: true });
    }
    return wjson({ message: r.message, conversation: visitorConv(conv) });
  },
  { bucket: "send", capacity: 20, perSec: 0.5 },
);
