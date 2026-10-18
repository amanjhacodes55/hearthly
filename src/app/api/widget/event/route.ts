import { z } from "zod";
import { Contact, TrackedEvent } from "@/lib/models";
import { publish } from "@/lib/bus";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({ name: z.string().trim().min(1).max(60).regex(/^[\w .:\-/]+$/), props: z.record(z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).default({}), url: z.string().max(2000).default("") });

/** Hearthly.track(name, props) */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Invalid event");
    const props = Object.fromEntries(Object.entries(p.data.props).slice(0, 30));
    await TrackedEvent.create({ website: site._id, contact: contact._id, name: p.data.name, props, url: p.data.url });
    await Contact.updateOne({ _id: contact._id }, { $addToSet: { eventNames: p.data.name }, lastSeenAt: new Date() });
    publish(`site:${site._id}`, "event", { contact_id: String(contact._id), name: p.data.name, props, at: new Date().toISOString() });
    return wjson({ ok: true });
  },
  { bucket: "event", capacity: 60, perSec: 1 },
);
