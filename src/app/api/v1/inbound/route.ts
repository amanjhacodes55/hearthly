import { z } from "zod";
import { v1, v1json, v1body, v1err } from "@/lib/v1";
import { Contact, Conversation } from "@/lib/models";
import { contactChanged, currentConversation, loadSite, postMessage, startConversation } from "@/lib/chat";
import { visitorConv } from "@/lib/serialize";

const schema = z.object({
  channel: z.string().trim().toLowerCase().regex(/^[a-z0-9_\-]{2,30}$/).default("api"),
  conversation_id: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  contact: z
    .object({
      external_id: z.string().trim().max(100).optional(),
      email: z.string().trim().toLowerCase().email().max(200).optional(),
      name: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .default({}),
  text: z.string().trim().min(1).max(5000),
});

/**
 * Inbound channel API — lets a bridge (Slack, Telegram, WhatsApp, SMS, email…) post a *visitor* message into
 * Hearthly. The contact is matched by `channel + external_id`, then email; operator replies come back to your
 * bridge through the `message.sent` webhook (check `data.conversation.channel`).
 */
export const POST = v1("messages:write", async (req, ctx) => {
  const b = await v1body(req, schema);
  const site = await loadSite(ctx.websiteId);
  if (!site) return v1err("not_found", "Website not found", 404);
  let conv = b.conversation_id ? await Conversation.findOne({ _id: b.conversation_id, website: ctx.websiteId }).lean() : null;
  if (b.conversation_id && !conv) return v1err("not_found", "Conversation not found", 404);
  let contact = conv ? await Contact.findById(conv.contact).lean() : null;
  if (!contact) {
    const ext = b.contact.external_id ? `${b.channel}:${b.contact.external_id}` : "";
    if (!ext && !b.contact.email) return v1err("validation_failed", "Provide contact.external_id or contact.email (or conversation_id)", 422);
    contact = (ext ? await Contact.findOne({ website: ctx.websiteId, externalId: ext }).lean() : null) || (b.contact.email ? await Contact.findOne({ website: ctx.websiteId, email: b.contact.email, mergedInto: null }).lean() : null);
    if (!contact) {
      contact = (await Contact.create({ website: ctx.websiteId, externalId: ext, email: b.contact.email || "", name: b.contact.name || "", phone: b.contact.phone || "", source: `channel:${b.channel}`, sessions: 0, tags: [b.channel] })).toObject();
      contactChanged(ctx.websiteId, contact, true);
    }
  }
  if (!conv) {
    const cur = await currentConversation(site._id, contact._id);
    conv = cur && cur.status !== "resolved" && cur.channel === b.channel ? cur : await startConversation(site, contact, { channel: b.channel });
  }
  const r = await postMessage({ site, conv, contact, from: "visitor", author: { id: String(contact._id), name: contact.name || b.contact.name || "Visitor" }, text: b.text, via: `${b.channel} (${ctx.actor.name})` });
  return v1json({ data: { message: r.message, conversation: visitorConv(r.conversation ? { ...conv, _id: conv._id } : conv), conversation_id: String(conv._id), contact_id: String(contact._id) } }, 201);
});
