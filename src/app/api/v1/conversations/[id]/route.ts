import { z } from "zod";
import { v1, v1json, v1body, v1err } from "@/lib/v1";
import { Contact, Conversation } from "@/lib/models";
import { sConversation } from "@/lib/serialize";
import { loadSite, setConversationStatus } from "@/lib/chat";
import { publish } from "@/lib/bus";

type P = { id: string };
const valid = (id: string) => /^[a-f0-9]{24}$/.test(id);

export const GET = v1<P>("conversations:read", async (_req, ctx, { id }) => {
  const c = valid(id) ? await Conversation.findOne({ _id: id, website: ctx.websiteId }).populate("contact").lean() : null;
  return c ? v1json({ data: sConversation(c) }) : v1err("not_found", "Conversation not found", 404);
});

const schema = z.object({ status: z.enum(["open", "pending", "resolved"]).optional(), tags: z.array(z.string().max(40)).max(20).optional(), assignee_id: z.string().regex(/^[a-f0-9]{24}$/).nullable().optional() });

export const PATCH = v1<P>("conversations:write", async (req, ctx, { id }) => {
  const b = await v1body(req, schema);
  const site = await loadSite(ctx.websiteId);
  const conv = valid(id) ? await Conversation.findOne({ _id: id, website: ctx.websiteId }).lean() : null;
  if (!conv || !site) return v1err("not_found", "Conversation not found", 404);
  const set: Record<string, unknown> = {};
  if (b.tags) set.tags = b.tags;
  if (b.assignee_id !== undefined) {
    if (b.assignee_id && !site.members.some((m) => String(m.user) === b.assignee_id)) return v1err("validation_failed", "assignee_id is not a member", 422);
    set.assignee = b.assignee_id;
  }
  if (Object.keys(set).length) {
    const u = await Conversation.findByIdAndUpdate(conv._id, set, { new: true }).lean();
    publish(`site:${ctx.websiteId}`, "conversation", sConversation(u, await Contact.findById(conv.contact).lean()));
  }
  if (b.status && b.status !== conv.status) await setConversationStatus(site, id, b.status, `${ctx.actor.type}:${ctx.actor.name}`);
  const fresh = await Conversation.findById(conv._id).populate("contact").lean();
  return v1json({ data: sConversation(fresh) });
});
