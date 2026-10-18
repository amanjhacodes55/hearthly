import { v1, v1json, v1err } from "@/lib/v1";
import { Webhook, WebhookDelivery } from "@/lib/models";

export const DELETE = v1<{ id: string }>("webhooks:manage", async (_req, ctx, { id }) => {
  const w = /^[a-f0-9]{24}$/.test(id) ? await Webhook.findOneAndDelete({ _id: id, website: ctx.websiteId }) : null;
  if (!w) return v1err("not_found", "Webhook not found", 404);
  await WebhookDelivery.deleteMany({ webhook: w._id });
  return v1json({ deleted: true });
});
