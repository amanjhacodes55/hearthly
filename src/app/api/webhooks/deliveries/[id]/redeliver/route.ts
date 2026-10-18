import { route, json, err, oid } from "@/lib/api";
import { WebhookDelivery } from "@/lib/models";
import { attemptDelivery } from "@/lib/webhooks";

/** Manually redeliver: re-queues the same payload (same event id, fresh signature) and attempts it now. */
export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const d = await WebhookDelivery.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  if (!d) return err("Not found", 404);
  const copy = await WebhookDelivery.create({ webhook: d.webhook, website: d.website, event: d.event, eventId: d.eventId, payload: d.payload });
  await attemptDelivery(String(copy._id));
  const fresh = await WebhookDelivery.findById(copy._id).lean();
  return json({ id: String(copy._id), status: fresh?.status, log: fresh?.log });
}, { role: "admin" });
