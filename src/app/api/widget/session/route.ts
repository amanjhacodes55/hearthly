import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Contact, Message } from "@/lib/models";
import { contactChanged, currentConversation, loadSiteByPublicId, siteStatus } from "@/lib/chat";
import { CORS, options, rateLimited, tokenKey, werr, wjson } from "@/lib/widgetApi";
import { signVisitorToken, verifyVisitorToken } from "@/lib/widgetToken";
import { parseUA } from "@/lib/ua";
import { deriveGeo } from "@/lib/geo";
import { recordPageview, runTriggers, utmFrom } from "@/lib/visitor";
import { sMessage, visitorConv } from "@/lib/serialize";
import { handleError, zodMessage } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

const schema = z.object({
  website: z.string().regex(/^[a-z0-9_-]{3,40}$/i),
  token: z.string().max(200).optional().nullable(),
  sessionId: z.string().max(64).default(""),
  url: z.string().max(2000).default(""),
  title: z.string().max(300).default(""),
  referrer: z.string().max(2000).default(""),
  timezone: z.string().max(64).default(""),
  language: z.string().max(32).default(""),
});

/** Start / resume a visitor session: returns a signed visitor token, the open conversation and its messages. */
export async function POST(req: Request) {
  const limited = rateLimited(req, "session", 30, 0.5);
  if (limited) return limited;
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return werr(zodMessage(parsed.error));
    const b = parsed.data;
    await dbConnect();
    const site = await loadSiteByPublicId(b.website);
    if (!site) return werr("Unknown website", 404);

    const ua = parseUA(req.headers.get("user-agent"));
    const geo = deriveGeo({ headers: req.headers, timezone: b.timezone, language: b.language });
    const t = verifyVisitorToken(tokenKey(), b.token, site.publicId);
    let contact = t ? await Contact.findOne({ _id: t.contactId, website: site._id }).lean() : null;
    if (contact?.mergedInto) contact = null;
    const utm = utmFrom(b.url);
    const externalRef = b.referrer && !sameHost(b.referrer, b.url) ? b.referrer : "";
    let created = false;
    if (!contact) {
      created = true;
      contact = (
        await Contact.create({
          website: site._id,
          geo,
          device: { browser: ua.browser, browserVersion: ua.browserVersion, os: ua.os, osVersion: ua.osVersion, type: ua.device },
          referrer: externalRef,
          utm: utm || undefined,
          sessionId: b.sessionId,
          sessions: 1,
        })
      ).toObject();
    } else {
      const newSession = b.sessionId && b.sessionId !== contact.sessionId;
      const set: Record<string, unknown> = {
        geo: { ...geo, country: geo.country || contact.geo?.country, countryName: geo.countryName || contact.geo?.countryName },
        device: { browser: ua.browser, browserVersion: ua.browserVersion, os: ua.os, osVersion: ua.osVersion, type: ua.device },
        lastSeenAt: new Date(),
      };
      if (newSession) {
        set.sessionId = b.sessionId;
        if (externalRef) set.referrer = externalRef;
        if (utm) set.utm = utm;
      }
      contact = await Contact.findByIdAndUpdate(contact._id, { $set: set, ...(newSession ? { $inc: { sessions: 1 } } : {}) }, { new: true }).lean();
    }
    if (created) contactChanged(String(site._id), contact, true);
    if (b.url) contact = (await recordPageview(site, contact, { url: b.url, title: b.title, referrer: b.referrer, sessionId: b.sessionId })) || contact;
    const trig = await runTriggers(site, contact, 0);
    const conv = await currentConversation(site._id, contact!._id);
    const messages = conv ? await Message.find({ conversation: conv._id, from: { $in: ["visitor", "operator", "bot"] } }).sort({ createdAt: -1 }).limit(100).lean() : [];
    const token = t && !created ? b.token! : signVisitorToken(tokenKey(), site.publicId, String(contact!._id));
    return wjson({
      token,
      visitor: { id: String(contact!._id), name: contact!.name || "", email: contact!.email || "", phone: contact!.phone || "" },
      conversation: conv ? visitorConv(conv) : null,
      messages: messages.reverse().map(sMessage),
      status: siteStatus(site),
      open: trig.open,
      nextCheckSec: trig.nextCheckSec,
    });
  } catch (e) {
    const r = handleError(e);
    return new Response(r.body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}

function sameHost(a: string, b: string) {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

