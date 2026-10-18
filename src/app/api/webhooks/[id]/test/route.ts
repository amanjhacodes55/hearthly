import { route, json, err, oid } from "@/lib/api";
import { Webhook, WebhookDelivery } from "@/lib/models";
import { attemptDelivery } from "@/lib/webhooks";
import { randomUUID } from "node:crypto";

/** Send a signed `ping` event to this endpoint right now. */
export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const w = await Webhook.findOne({ _id: oid(id), website: ctx.website.id }).select("_id").lean();
  if (!w) return err("Not found", 404);
  const eventId = `evt_${randomUUID().replace(/-/g, "")}`;
  const payload = JSON.stringify({ id: eventId, event: "ping", website_id: ctx.website.id, created_at: new Date().toISOString(), data: { message: "Hello from Hearthly 👋" } });
  const d = await WebhookDelivery.create({ webhook: w._id, website: ctx.website.id, event: "ping", eventId, payload });
  await attemptDelivery(String(d._id));
  const fresh = await WebhookDelivery.findById(d._id).lean();
  return json({ id: String(d._id), status: fresh?.status, log: fresh?.log });
}, { role: "admin" });
