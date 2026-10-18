import { z } from "zod";
import { v1, v1json, v1body, v1err, paginate } from "@/lib/v1";
import { Conversation, Message } from "@/lib/models";
import { sMessage } from "@/lib/serialize";
import { loadSite, postMessage } from "@/lib/chat";

type P = { id: string };
const valid = (id: string) => /^[a-f0-9]{24}$/.test(id);

/** GET messages (oldest → newest within the page; page 1 = most recent). Private notes included with from="note". */
export const GET = v1<P>("conversations:read", async (req, ctx, { id }) => {
  const conv = valid(id) ? await Conversation.findOne({ _id: id, website: ctx.websiteId }).select("_id").lean() : null;
  if (!conv) return v1err("not_found", "Conversation not found", 404);
  const p = paginate(new URL(req.url));
  const [list, total] = await Promise.all([Message.find({ conversation: conv._id }).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Message.countDocuments({ conversation: conv._id })]);
  return v1json({ data: list.reverse().map(sMessage), pagination: p.meta(total) });
});

const schema = z.object({
  text: z.string().trim().min(1).max(5000),
  from: z.enum(["operator", "bot", "note"]).default("operator"),
  author_name: z.string().trim().max(60).optional(),
  author_avatar: z.string().url().max(500).optional(),
});

/** Send a message into a conversation as an operator, a bot, or a private note. */
export const POST = v1<P>("messages:write", async (req, ctx, { id }) => {
  const b = await v1body(req, schema);
  const site = await loadSite(ctx.websiteId);
  const conv = valid(id) ? await Conversation.findOne({ _id: id, website: ctx.websiteId }).lean() : null;
  if (!conv || !site) return v1err("not_found", "Conversation not found", 404);
  const r = await postMessage({ site, conv, from: b.from, author: { id: `${ctx.actor.type}:${ctx.actor.id}`, name: b.author_name || ctx.actor.name, avatar: b.author_avatar || "" }, text: b.text, via: ctx.actor.name });
  return v1json({ data: r.message }, 201);
});
