import { v1, v1json, paginate } from "@/lib/v1";
import { Conversation } from "@/lib/models";
import { sConversation } from "@/lib/serialize";

/** GET /api/v1/conversations?status=open|pending|resolved&contact_id=&page=&limit= */
export const GET = v1("conversations:read", async (req, ctx) => {
  const url = new URL(req.url);
  const p = paginate(url);
  const q: Record<string, unknown> = { website: ctx.websiteId };
  const st = url.searchParams.get("status");
  if (st && ["open", "pending", "resolved"].includes(st)) q.status = st;
  const cid = url.searchParams.get("contact_id");
  if (cid && /^[a-f0-9]{24}$/.test(cid)) q.contact = cid;
  const [list, total] = await Promise.all([Conversation.find(q).sort({ updatedAt: -1 }).skip(p.skip).limit(p.limit).populate("contact").lean(), Conversation.countDocuments(q)]);
  return v1json({ data: list.map((c) => sConversation(c)), pagination: p.meta(total) });
});
