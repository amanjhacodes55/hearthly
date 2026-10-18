import { v1, v1json, v1body } from "@/lib/v1";
import { Webhook } from "@/lib/models";
import { createWebhook, serializeWebhook, webhookInput } from "@/lib/devplatform";
import { Installation } from "@/lib/models";

export const GET = v1("webhooks:manage", async (_req, ctx) => {
  const list = await Webhook.find({ website: ctx.websiteId }).sort({ createdAt: -1 }).lean();
  return v1json({ data: list.map(serializeWebhook) });
});

/** Subscribe a URL to events. The signing secret is returned once in `secret`. */
export const POST = v1("webhooks:manage", async (req, ctx) => {
  const b = await v1body(req, webhookInput);
  let installation: string | undefined;
  if (ctx.actor.type === "app") {
    const inst = await Installation.findOne({ app: ctx.actor.id, website: ctx.websiteId, revokedAt: null }).select("_id").lean();
    installation = inst ? String(inst._id) : undefined;
  }
  const r = await createWebhook(ctx.websiteId, b, ctx.actor.type === "app" ? `app:${ctx.actor.name}` : `api:${ctx.actor.name}`, installation);
  return v1json({ data: r.webhook, secret: r.secret }, 201);
});
