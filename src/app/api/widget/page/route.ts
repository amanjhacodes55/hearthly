import { z } from "zod";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";
import { recordPageview, runTriggers } from "@/lib/visitor";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({ url: z.string().max(2000), title: z.string().max(300).default(""), referrer: z.string().max(2000).default(""), sessionId: z.string().max(64).default("") });

/** SPA navigation (pushState / popstate) → page view. */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Invalid body");
    const updated = await recordPageview(site, contact, p.data);
    const trig = await runTriggers(site, updated, 0);
    return wjson({ ok: true, open: trig.open, nextCheckSec: trig.nextCheckSec });
  },
  { bucket: "page", capacity: 60, perSec: 1 },
);
