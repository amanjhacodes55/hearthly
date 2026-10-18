/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { Contact, Conversation, PageView, Trigger, User } from "@/lib/models";
import { publish } from "@/lib/bus";
import { contactChanged, currentConversation, postMessage, startConversation, type Site } from "@/lib/chat";
import { matchTrigger, pendingDelay, renderTemplate, type Condition, type VisitorContext } from "@/lib/triggers";
import { sContact } from "@/lib/serialize";

export type PageInput = { url: string; title?: string; referrer?: string; sessionId?: string };

export function utmFrom(url: string) {
  try {
    const p = new URL(url).searchParams;
    const utm = { source: p.get("utm_source") || "", medium: p.get("utm_medium") || "", campaign: p.get("utm_campaign") || "", term: p.get("utm_term") || "", content: p.get("utm_content") || "" };
    return Object.values(utm).some(Boolean) ? utm : null;
  } catch {
    return null;
  }
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url.slice(0, 200);
  }
}

/** Record a page view (closing the previous one's duration) and update the live "current page". */
export async function recordPageview(site: Site, contact: any, p: PageInput) {
  const now = new Date();
  if (contact.currentPage?.url === p.url && contact.currentPage?.since && now.getTime() - new Date(contact.currentPage.since).getTime() < 5000) return contact; // dedupe reloads
  const last = await PageView.findOne({ contact: contact._id }).sort({ at: -1 }).select("at duration").lean();
  if (last && !last.duration) await PageView.updateOne({ _id: last._id }, { duration: Math.min(3600, Math.round((now.getTime() - new Date(last.at).getTime()) / 1000)) });
  await PageView.create({ website: site._id, contact: contact._id, session: p.sessionId, url: p.url, path: pathOf(p.url), title: p.title || "", referrer: p.referrer || "", at: now });
  const updated = await Contact.findByIdAndUpdate(
    contact._id,
    { $set: { currentPage: { url: p.url, title: p.title || "", since: now }, lastSeenAt: now }, $inc: { pageViews: 1 } },
    { new: true },
  ).lean();
  publish(`site:${site._id}`, "visitor", sContact(updated));
  return updated;
}

export function visitorContext(contact: any, timeOnPage: number): VisitorContext {
  return {
    url: contact.currentPage?.url || "",
    timeOnPage,
    sessions: contact.sessions || 1,
    utmSource: contact.utm?.source || "",
    utmCampaign: contact.utm?.campaign || "",
    referrer: contact.referrer || "",
    country: contact.geo?.country || "",
    language: contact.geo?.locale || "",
    identified: Boolean(contact.email),
    device: contact.device?.type || "",
  };
}

/**
 * Evaluate the website's triggers for this visitor and run the matching actions.
 * Returns whether the widget should open, and when to ping again for time-based rules.
 */
export async function runTriggers(site: Site, contact: any, timeOnPage: number) {
  const rules = await Trigger.find({ website: site._id, enabled: true }).lean();
  const ctx = visitorContext(contact, timeOnPage);
  let open = false;
  let next: number | null = null;
  for (const r of rules) {
    const id = String(r._id);
    if (r.once && contact.firedTriggers?.includes(id)) continue;
    const rule = { enabled: r.enabled, conditions: r.conditions as Condition[] };
    if (!matchTrigger(rule, ctx)) {
      const d = pendingDelay(rule, ctx);
      if (d !== null) next = next === null ? d : Math.min(next, d);
      continue;
    }
    const claimed = await Contact.updateOne({ _id: contact._id, firedTriggers: { $ne: id } }, { $addToSet: { firedTriggers: id } });
    if (r.once && !claimed.modifiedCount) continue;
    await Trigger.updateOne({ _id: r._id }, { $inc: { fired: 1 } });
    for (const a of r.actions as { type: string; text?: string; operator?: string; tag?: string }[]) {
      if (a.type === "open") open = true;
      if (a.type === "tag" && a.tag) await Contact.updateOne({ _id: contact._id }, { $addToSet: { tags: a.tag } });
      if (a.type === "message" && a.text) {
        let conv: any = await currentConversation(site._id, contact._id);
        if (!conv || conv.status === "resolved") conv = await startConversation(site, contact, { subject: r.name || "" });
        const op = await pickOperator(site, a.operator);
        const text = renderTemplate(a.text, { name: contact.name, first_name: (contact.name || "").split(" ")[0], page_title: contact.currentPage?.title, website: site.name, agent: op?.name });
        await postMessage({ site, conv, contact, from: "operator", author: op ? { id: String(op._id), name: op.name, avatar: op.image || "" } : { name: site.name }, text, via: `trigger:${r.name}`, skipAutomations: true });
        open = true;
      }
      if (a.type === "assign" && a.operator) {
        const conv = await currentConversation(site._id, contact._id);
        const op = await pickOperator(site, a.operator);
        if (conv && op) await Conversation.updateOne({ _id: conv._id }, { assignee: op._id });
      }
    }
  }
  return { open, nextCheckSec: next };
}

async function pickOperator(site: Site, nameOrId?: string) {
  const ids = site.members.map((m) => m.user);
  const users = await User.find({ _id: { $in: ids } }).select("name image").lean();
  if (!users.length) return null;
  if (nameOrId) {
    const hit = users.find((u) => String(u._id) === nameOrId || u.name.toLowerCase() === nameOrId.toLowerCase());
    if (hit) return hit;
  }
  const owner = site.members.find((m) => m.role === "owner");
  return users.find((u) => String(u._id) === String(owner?.user)) || users[0];
}

/**
 * Identify a visitor. When `trusted` (server API, or widget identify carrying a valid `user_hash` HMAC), older
 * contacts with the same email are merged into this one. Unverified widget identifies never merge — otherwise
 * anyone could type a customer's email and read their conversation history.
 */
export async function identifyContact(site: Site, contact: any, p: { email?: string; name?: string; phone?: string; company?: string; avatar?: string; data?: Record<string, unknown> }, trusted = false) {
  const set: Record<string, unknown> = {};
  if (p.name) set.name = p.name;
  if (p.phone) set.phone = p.phone;
  if (p.company) set.company = p.company;
  if (p.avatar && /^https:\/\//.test(p.avatar)) set.avatar = p.avatar;
  if (p.data) for (const [k, v] of Object.entries(p.data).slice(0, 50)) if (/^[A-Za-z0-9_\-]{1,60}$/.test(k)) set[`data.${k}`] = typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 500) : v;
  const email = p.email?.toLowerCase().trim();
  const newlyIdentified = Boolean(email && email !== contact.email);
  if (email) set.email = email;
  // Merge on email: older duplicates are folded into this contact (conversations + page views move here).
  if (newlyIdentified && trusted) {
    const dupes = await Contact.find({ website: site._id, email, _id: { $ne: contact._id }, mergedInto: null }).lean();
    for (const d of dupes) {
      await Conversation.updateMany({ contact: d._id }, { contact: contact._id });
      await PageView.updateMany({ contact: d._id }, { contact: contact._id });
      await Contact.updateOne({ _id: d._id }, { mergedInto: contact._id, email: "" });
      set.sessions = (contact.sessions || 1) + (d.sessions || 0);
      if (d.firstSeenAt && new Date(d.firstSeenAt) < new Date(contact.firstSeenAt)) set.firstSeenAt = d.firstSeenAt;
      if (!p.name && d.name) set.name = d.name;
      set.tags = [...new Set([...(contact.tags || []), ...(d.tags || [])])];
    }
  }
  if (!Object.keys(set).length) return contact;
  const updated = await Contact.findByIdAndUpdate(contact._id, { $set: set }, { new: true }).lean();
  contactChanged(String(site._id), updated);
  if (newlyIdentified) {
    const { dispatchWebhooks } = await import("@/lib/webhooks");
    void dispatchWebhooks(String(site._id), "visitor.identified", { contact: sContact(updated) });
  }
  return updated;
}
