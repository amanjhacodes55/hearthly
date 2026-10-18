/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { Article, CampaignDelivery, Campaign, Contact, Conversation, Message, Website } from "@/lib/models";
import { onlineAgents, publish } from "@/lib/bus";
import { dispatchWebhooks } from "@/lib/webhooks";
import { sContact, sConversation, sMessage } from "@/lib/serialize";
import { sendMail, smtpEnabled } from "@/lib/mail";

export type Site = NonNullable<Awaited<ReturnType<typeof loadSite>>>;
export const loadSite = (id: string) => Website.findById(id).lean();
export const loadSiteByPublicId = (publicId: string) => Website.findOne({ publicId }).lean();

const DAY_MIN = 24 * 60;
/** Is `now` inside the website's availability hours (in its timezone)? Always true when the schedule is off. */
export function withinHours(av: { enabled?: boolean; timezone?: string; hours?: { day?: number | null; start?: string | null; end?: string | null }[] } | undefined, now = new Date()) {
  if (!av?.enabled) return true;
  let day = now.getUTCDay();
  let minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: av.timezone || "UTC", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  } catch {
    /* invalid timezone → UTC */
  }
  const toMin = (s?: string | null) => {
    const [h, m] = (s || "0:0").split(":").map(Number);
    return Math.min(DAY_MIN, (h || 0) * 60 + (m || 0));
  };
  return (av.hours || []).some((h) => h.day === day && minutes >= toMin(h.start) && minutes < toMin(h.end));
}

export function siteStatus(site: Pick<Site, "_id" | "availability">) {
  const agents = onlineAgents(String(site._id));
  const hours = withinHours(site.availability as any);
  return { online: hours && agents.length > 0, withinHours: hours, agentsOnline: agents.length };
}

function snippet(text: string, attachments: { name?: string | null }[] = []) {
  return (text || (attachments.length ? `📎 ${attachments[0].name}` : "")).slice(0, 140);
}

/** Pick the next agent (round-robin, preferring agents currently online). */
async function nextAssignee(site: Site) {
  const members = site.members.map((m) => String(m.user));
  if (!members.length) return null;
  const online = onlineAgents(String(site._id)).filter((u) => members.includes(u));
  const pool = online.length ? online : members;
  const idx = (site.rules?.rrIndex || 0) % pool.length;
  await Website.updateOne({ _id: site._id }, { $inc: { "rules.rrIndex": 1 } });
  return pool[idx];
}

export async function startConversation(site: Site, contact: any, o: { channel?: string; subject?: string; campaign?: string } = {}) {
  const assignee = site.rules?.autoAssign ? await nextAssignee(site) : null;
  const conv = await Conversation.create({ website: site._id, contact: contact._id, channel: o.channel || "widget", subject: o.subject || "", assignee, campaign: o.campaign });
  const data = sConversation(conv.toObject(), contact);
  publish(`site:${site._id}`, "conversation", data);
  void dispatchWebhooks(String(site._id), "conversation.created", data);
  return conv.toObject();
}

/** Latest non-resolved conversation for this contact, or the latest one at all. */
export async function currentConversation(siteId: unknown, contactId: unknown) {
  return (
    (await Conversation.findOne({ website: siteId, contact: contactId, status: { $ne: "resolved" } }).sort({ updatedAt: -1 }).lean()) ||
    (await Conversation.findOne({ website: siteId, contact: contactId }).sort({ updatedAt: -1 }).lean())
  );
}

type PostOpts = {
  site: Site;
  conv: any;
  contact?: any;
  from: "visitor" | "operator" | "bot" | "system" | "note";
  author?: { id?: string; name?: string; avatar?: string } | null;
  text: string;
  attachments?: { id: string; name: string; size: number; type: string }[];
  via?: string;
  actions?: { label: string; reply: string; tag: string }[];
  campaign?: string;
  skipAutomations?: boolean;
};

/** Create a message and fan it out: DB counters, SSE (agents + visitor), webhooks and automations. */
export async function postMessage(o: PostOpts) {
  const { site, from } = o;
  const msg = await Message.create({
    website: site._id,
    conversation: o.conv._id,
    from,
    author: o.author || undefined,
    text: o.text,
    attachments: o.attachments || [],
    via: o.via || "",
    actions: o.actions || [],
    campaign: o.campaign,
  });
  const now = new Date();
  const set: Record<string, unknown> = {};
  const inc: Record<string, number> = {};
  if (from !== "note" && from !== "system") set.lastMessage = { text: snippet(o.text, o.attachments), from, at: now };
  if (from === "visitor") {
    inc.unreadAgent = 1;
    set.lastVisitorAt = now;
    if (o.conv.status === "resolved" || o.conv.snoozedUntil) Object.assign(set, { status: "open", snoozedUntil: null, resolvedAt: null });
  } else if (from === "operator" || from === "bot") {
    inc.unreadVisitor = 1;
    if (from === "operator" && !o.conv.firstResponseAt && !o.campaign) set.firstResponseAt = now;
    if (from === "operator" && o.conv.status === "pending") set.status = "open";
  }
  const conv = await Conversation.findByIdAndUpdate(o.conv._id, { $set: set, ...(Object.keys(inc).length ? { $inc: inc } : {}) }, { new: true }).lean();
  const contact = o.contact ?? (await Contact.findById(o.conv.contact).lean());
  const m = sMessage(msg.toObject());
  const c = sConversation(conv, contact);
  publish(`site:${site._id}`, "message", { conversation: c, message: m });
  if (from !== "note" && from !== "system") publish(`visitor:${conv!.contact}`, "message", m);

  if (from === "visitor") {
    void dispatchWebhooks(String(site._id), "message.received", { message: m, conversation: c });
    if (conv!.campaign) {
      const d = await CampaignDelivery.findOneAndUpdate({ conversation: conv!._id, repliedAt: null }, { repliedAt: now });
      if (d) await Campaign.updateOne({ _id: d.campaign }, { $inc: { "stats.replied": 1 } });
    }
    if (!o.skipAutomations) void visitorAutomations(site, conv, contact, o.text).catch((e) => console.error("[automation]", e));
  } else if (from === "operator" || from === "bot") {
    void dispatchWebhooks(String(site._id), "message.sent", { message: m, conversation: c });
    if (from === "operator" && smtpEnabled() && contact?.email && Date.now() - new Date(contact.lastSeenAt || 0).getTime() > 120_000 && o.text)
      void sendMail({ to: contact.email, subject: `New reply from ${site.name}`, text: `${o.author?.name || site.name} replied:\n\n${o.text}\n\nReply on our website to continue the conversation.` }).catch(() => {});
  }
  return { message: m, conversation: c, raw: msg };
}

/** Offline auto-reply + help-center answer bot, at most once every 30 minutes per conversation. */
async function visitorAutomations(site: Site, conv: any, contact: any, text: string) {
  const status = siteStatus(site);
  const recentBot = await Message.exists({ conversation: conv._id, from: "bot", createdAt: { $gt: new Date(Date.now() - 30 * 60_000) } });
  if (recentBot) return;
  const lines: string[] = [];
  if (!status.online && site.rules?.offlineAutoReply !== false) {
    lines.push(site.availability?.offlineMessage || "We're away right now — leave your email and we'll get back to you.");
  }
  if (site.rules?.botEnabled !== false && text.trim().length > 3 && !status.online) {
    const arts = await Article.find({ website: site._id, published: true, $text: { $search: text.slice(0, 200) } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .limit(2)
      .select("title slug")
      .lean()
      .catch(() => []);
    if (arts.length) {
      const base = process.env.NEXTAUTH_URL || "";
      lines.push(`These help articles might answer it:\n${arts.map((a) => `• ${a.title} — ${base}/help/${site.publicId}/${a.slug}`).join("\n")}`);
    }
  }
  if (!lines.length) return;
  if (!contact?.email) lines.push("Leave your email below so we can reply even if you leave the site.");
  await postMessage({ site, conv, contact, from: "bot", author: { name: `${site.name} bot` }, text: lines.join("\n\n"), skipAutomations: true });
}

export async function setConversationStatus(site: Site, convId: string, status: "open" | "pending" | "resolved", actor?: string) {
  const conv = await Conversation.findOneAndUpdate(
    { _id: convId, website: site._id },
    { status, resolvedAt: status === "resolved" ? new Date() : null, ...(status !== "pending" ? { snoozedUntil: null } : {}) },
    { new: true },
  ).lean();
  if (!conv) return null;
  const contact = await Contact.findById(conv.contact).lean();
  const c = sConversation(conv, contact);
  publish(`site:${site._id}`, "conversation", c);
  publish(`visitor:${conv.contact}`, "status", { status, conversation_id: String(conv._id) });
  if (status === "resolved") void dispatchWebhooks(String(site._id), "conversation.resolved", { conversation: c, resolved_by: actor || null });
  return c;
}

export function contactChanged(siteId: string, contact: any, created = false) {
  const c = sContact(contact);
  publish(`site:${siteId}`, "contact", c);
  void dispatchWebhooks(siteId, created ? "contact.created" : "contact.updated", { contact: c });
}
