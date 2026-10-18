import "server-only";
import { randomUUID } from "node:crypto";
import { Webhook, WebhookDelivery } from "@/lib/models";
import { decrypt } from "@/lib/secrets";
import { outboundFetch } from "@/lib/outbound";
import { MAX_ATTEMPTS, nextRetryDelayMs, SIGNATURE_HEADER, signPayload } from "@/lib/webhookSign";

export const WEBHOOK_EVENTS = {
  "message.received": "A visitor sent a message",
  "message.sent": "An operator, bot or app sent a message",
  "conversation.created": "A new conversation started",
  "conversation.resolved": "A conversation was resolved",
  "contact.created": "A new contact/visitor was created",
  "contact.updated": "A contact's profile changed",
  "visitor.identified": "A visitor was identified (email set)",
  "rating.submitted": "A visitor rated a conversation",
  "campaign.sent": "A campaign finished sending",
} as const;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

/** Queue a signed delivery for every active webhook subscribed to `event`, then try delivering right away. */
export async function dispatchWebhooks(websiteId: string, event: WebhookEvent, data: unknown) {
  const hooks = await Webhook.find({ website: websiteId, active: true, events: event }).select("_id").lean();
  if (!hooks.length) return;
  const eventId = `evt_${randomUUID().replace(/-/g, "")}`;
  const payload = JSON.stringify({ id: eventId, event, website_id: websiteId, created_at: new Date().toISOString(), data });
  const docs = await WebhookDelivery.insertMany(hooks.map((h) => ({ webhook: h._id, website: websiteId, event, eventId, payload })));
  for (const d of docs) void attemptDelivery(String(d._id));
}

/** One delivery attempt; on failure schedules the next retry with exponential backoff. */
export async function attemptDelivery(id: string) {
  const d = await WebhookDelivery.findOneAndUpdate(
    { _id: id, status: "pending", $or: [{ locked: null }, { locked: { $lt: new Date(Date.now() - 60_000) } }] },
    { locked: new Date() },
    { new: true },
  );
  if (!d) return;
  const hook = await Webhook.findById(d.webhook).select("+secretEnc").lean();
  if (!hook || !hook.active) {
    await WebhookDelivery.updateOne({ _id: id }, { status: "failed", locked: null, $push: { log: { at: new Date(), status: 0, error: "Webhook deleted or disabled" } } });
    return;
  }
  const body = d.payload || "{}";
  const sig = signPayload(decrypt(hook.secretEnc), body);
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Hearthly-Webhooks/1.0",
    [SIGNATURE_HEADER]: sig.header,
    "Hearthly-Event": d.event || "",
    "Hearthly-Delivery": String(d._id),
    "Hearthly-Timestamp": String(sig.timestamp),
  };
  const started = Date.now();
  let status = 0;
  let error = "";
  let response = "";
  try {
    const r = await outboundFetch(hook.url, { method: "POST", headers, body, timeoutMs: 10_000 });
    status = r.status;
    response = (await r.text().catch(() => "")).slice(0, 2000);
    if (status < 200 || status >= 300) error = `HTTP ${status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const attempts = d.attempts + 1;
  const ok = !error;
  const entry = { at: new Date(), status, durationMs: Date.now() - started, error, response, requestHeaders: { ...headers } };
  await WebhookDelivery.updateOne(
    { _id: id },
    {
      attempts,
      locked: null,
      status: ok ? "success" : attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      nextAttemptAt: ok ? null : new Date(Date.now() + nextRetryDelayMs(attempts)),
      $push: { log: { $each: [entry], $slice: -20 } },
    },
  );
  await Webhook.updateOne({ _id: hook._id }, ok ? { failures: 0 } : { $inc: { failures: 1 } });
}

let running = false;
/** Called by the in-app scheduler: retry every due pending delivery. */
export async function processDueDeliveries() {
  if (running) return;
  running = true;
  try {
    const due = await WebhookDelivery.find({ status: "pending", nextAttemptAt: { $lte: new Date() } }).select("_id").limit(50).lean();
    await Promise.all(due.map((d) => attemptDelivery(String(d._id))));
  } finally {
    running = false;
  }
}
