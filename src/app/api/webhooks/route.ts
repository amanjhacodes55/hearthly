import { route, json, body } from "@/lib/api";
import { Webhook, WebhookDelivery } from "@/lib/models";
import { createWebhook, serializeWebhook, webhookInput } from "@/lib/devplatform";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

export const GET = route(async (_req, ctx) => {
  const hooks = await Webhook.find({ website: ctx.website.id }).sort({ createdAt: -1 }).lean();
  const stats = await WebhookDelivery.aggregate([{ $match: { webhook: { $in: hooks.map((h) => h._id) }, createdAt: { $gt: new Date(Date.now() - 7 * 86400_000) } } }, { $group: { _id: { w: "$webhook", s: "$status" }, n: { $sum: 1 } } }]);
  return json({
    events: WEBHOOK_EVENTS,
    data: hooks.map((h) => ({ ...serializeWebhook(h), stats: Object.fromEntries(stats.filter((s) => String(s._id.w) === String(h._id)).map((s) => [s._id.s, s.n])) })),
  });
}, { role: "admin" });

export const POST = route(async (req, ctx) => json(await createWebhook(ctx.website.id, await body(req, webhookInput)), 201), { role: "admin" });
