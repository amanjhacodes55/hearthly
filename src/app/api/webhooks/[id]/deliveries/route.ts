import { route, json, err, oid } from "@/lib/api";
import { Webhook, WebhookDelivery } from "@/lib/models";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const w = await Webhook.findOne({ _id: oid(id), website: ctx.website.id }).select("_id").lean();
  if (!w) return err("Not found", 404);
  const list = await WebhookDelivery.find({ webhook: w._id }).sort({ createdAt: -1 }).limit(50).lean();
  return json(
    list.map((d) => ({ id: String(d._id), event: d.event, eventId: d.eventId, status: d.status, attempts: d.attempts, nextAttemptAt: d.status === "pending" ? d.nextAttemptAt : null, createdAt: d.createdAt, payload: d.payload, log: d.log })),
  );
}, { role: "admin" });
