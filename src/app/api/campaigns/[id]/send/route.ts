import { route, json, err, oid } from "@/lib/api";
import { Campaign, CampaignDelivery, Contact, Conversation, Segment, User } from "@/lib/models";
import { segmentToQuery, type SegmentFilter } from "@/lib/segments";
import { currentConversation, loadSite, postMessage, startConversation } from "@/lib/chat";
import { renderTemplate } from "@/lib/triggers";
import { sendMail, smtpEnabled } from "@/lib/mail";
import { dispatchWebhooks } from "@/lib/webhooks";

type P = { id: string };

async function audience(websiteId: string, segmentId: unknown) {
  const seg = segmentId ? await Segment.findOne({ _id: segmentId, website: websiteId }).lean() : null;
  const q = { website: websiteId, mergedInto: null, ...(seg ? segmentToQuery({ match: seg.match as "all" | "any", filters: seg.filters as SegmentFilter[] }) : {}) };
  return q;
}

/** Recipient count preview. */
export const GET = route<P>(async (_req, ctx, { id }) => {
  const c = await Campaign.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  if (!c) return err("Campaign not found", 404);
  const q = await audience(ctx.website.id, c.segment);
  const [total, withEmail] = await Promise.all([Contact.countDocuments(q), Contact.countDocuments({ ...q, email: { $nin: ["", null] } })]);
  return json({ total, withEmail, smtp: smtpEnabled() });
});

/** Send a campaign: in-widget message to every contact in the segment (+ email when configured). */
export const POST = route<P>(async (_req, ctx, { id }) => {
  const c = await Campaign.findOneAndUpdate({ _id: oid(id), website: ctx.website.id, status: "draft" }, { status: "sending" }, { new: true }).lean();
  if (!c) return err("Campaign not found or already sent", 400);
  const site = await loadSite(ctx.website.id);
  const sender = await User.findById(c.sender || ctx.user.id).select("name image").lean();
  const contacts = await Contact.find(await audience(ctx.website.id, c.segment)).limit(5000).lean();
  let sent = 0;
  let emailed = 0;
  for (const contact of contacts) {
    const text = renderTemplate(c.body || "", { name: contact.name, first_name: (contact.name || "").split(" ")[0], email: contact.email, website: site!.name, agent: sender?.name });
    if (c.channel !== "email") {
      let conv = await currentConversation(site!._id, contact._id);
      if (!conv || conv.status === "resolved") conv = await startConversation(site!, contact, { channel: "campaign", subject: c.name || "", campaign: String(c._id) });
      else await Conversation.updateOne({ _id: conv._id }, { campaign: c._id });
      await postMessage({ site: site!, conv, contact, from: "operator", author: { id: String(sender?._id || ctx.user.id), name: sender?.name || ctx.user.name, avatar: sender?.image || "" }, text, campaign: String(c._id), via: `campaign:${c.name}`, skipAutomations: true });
      await CampaignDelivery.create({ campaign: c._id, website: ctx.website.id, contact: contact._id, conversation: conv._id });
      sent++;
    }
    if (c.channel !== "chat" && contact.email) {
      await sendMail({ to: contact.email, subject: renderTemplate(c.subject || c.name || "", { name: contact.name, first_name: (contact.name || "").split(" ")[0] }), text: `${text}\n\n— ${sender?.name || site!.name}, ${site!.name}` }).catch((e) => console.error("[campaign] email failed", e));
      emailed++;
      if (c.channel === "email") sent++;
    }
  }
  await Campaign.updateOne({ _id: c._id }, { status: "sent", sentAt: new Date(), "stats.sent": sent, "stats.emailed": emailed });
  void dispatchWebhooks(ctx.website.id, "campaign.sent", { campaign: { id: String(c._id), name: c.name, channel: c.channel, recipients: sent, emailed } });
  return json({ ok: true, sent, emailed, emailMode: smtpEnabled() ? "smtp" : "logged" });
}, { role: "admin" });
