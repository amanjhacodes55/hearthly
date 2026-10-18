import { route, json, oid } from "@/lib/api";
import { Conversation } from "@/lib/models";
import { publish } from "@/lib/bus";

export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const b = await req.json().catch(() => ({}));
  const conv = await Conversation.findOne({ _id: oid(id), website: ctx.website.id }).select("contact").lean();
  if (conv) {
    const typing = Boolean(b.typing);
    if (!b.note) publish(`visitor:${conv.contact}`, "typing", { typing, name: ctx.user.name.split(" ")[0] });
    publish(`site:${ctx.website.id}`, "typing", { conversation_id: id, who: "agent", user: ctx.user.id, name: ctx.user.name, typing });
  }
  return json({ ok: true });
});
