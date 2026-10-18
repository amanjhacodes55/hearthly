import { z } from "zod";
import { Contact } from "@/lib/models";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";
import { runTriggers } from "@/lib/visitor";
import { siteStatus } from "@/lib/chat";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({ timeOnPage: z.number().min(0).max(86400).default(0) });

/** Heartbeat (every ~30s, or when a time-based trigger is due): keeps the visitor "live" and evaluates triggers. */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Invalid body");
    await Contact.updateOne({ _id: contact._id }, { lastSeenAt: new Date() });
    const trig = await runTriggers(site, contact, p.data.timeOnPage);
    return wjson({ ok: true, open: trig.open, nextCheckSec: trig.nextCheckSec, status: siteStatus(site) });
  },
  { bucket: "ping", capacity: 30, perSec: 0.5 },
);
