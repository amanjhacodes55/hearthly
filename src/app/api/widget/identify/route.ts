import { z } from "zod";
import { createHmac } from "node:crypto";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";
import { identifyContact } from "@/lib/visitor";
import { safeEqual } from "@/lib/ids";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({
  email: z.string().email().max(200).optional().or(z.literal("")),
  name: z.string().max(100).optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(100).optional(),
  avatar: z.string().url().max(500).optional().or(z.literal("")),
  data: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
  user_hash: z.string().max(128).optional(),
});

/**
 * Visitor identification from the widget (pre-chat form or ChatCrip.identify()).
 * If the website has identity verification enabled, pass user_hash = HMAC-SHA256(identitySecret, email)
 * to mark the identity as trusted (enables merging with existing contacts of that email).
 */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Invalid identity: " + p.error.issues[0]?.message);
    const { user_hash, ...rest } = p.data;
    const trusted = Boolean(site.identitySecret && rest.email && user_hash && safeEqual(createHmac("sha256", site.identitySecret).update(rest.email.toLowerCase()).digest("hex"), user_hash));
    const updated = await identifyContact(site, contact, { ...rest, email: rest.email || undefined }, trusted);
    return wjson({ ok: true, verified: trusted, visitor: { name: updated?.name || "", email: updated?.email || "", phone: updated?.phone || "" } });
  },
  { bucket: "identify", capacity: 20, perSec: 0.2 },
);
