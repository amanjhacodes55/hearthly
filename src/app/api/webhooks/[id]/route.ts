import { z } from "zod";
import { route, json, body, err, oid } from "@/lib/api";
import { Webhook, WebhookDelivery } from "@/lib/models";
import { decrypt, encrypt } from "@/lib/secrets";
import { serializeWebhook, webhookInput } from "@/lib/devplatform";
import { assertPublicUrl } from "@/lib/outbound";
import { rand } from "@/lib/ids";

type P = { id: string };

/** ?reveal=1 returns the signing secret (admins only). */
export const GET = route<P>(async (req, ctx, { id }) => {
  const w = await Webhook.findOne({ _id: oid(id), website: ctx.website.id }).select("+secretEnc").lean();
  if (!w) return err("Not found", 404);
  const reveal = new URL(req.url).searchParams.get("reveal") === "1";
  return json({ ...serializeWebhook(w), ...(reveal ? { secret: decrypt(w.secretEnc) } : {}) });
}, { role: "admin" });

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const b = await body(req, webhookInput.partial().extend({ active: z.boolean().optional(), rotateSecret: z.boolean().optional() }));
  const { rotateSecret, ...set } = b;
  if (set.url) {
    try {
      await assertPublicUrl(set.url);
    } catch (e) {
      return err(e instanceof Error ? e.message : "Invalid URL");
    }
  }
  let secret: string | undefined;
  const upd: Record<string, unknown> = { ...set };
  if (rotateSecret) {
    secret = `whsec_${rand(24)}`;
    upd.secretEnc = encrypt(secret);
    upd.secretHint = `${secret.slice(0, 10)}…`;
  }
  if (set.active) upd.failures = 0;
  const w = await Webhook.findOneAndUpdate({ _id: oid(id), website: ctx.website.id }, upd, { new: true }).lean();
  if (!w) return err("Not found", 404);
  return json({ ...serializeWebhook(w), ...(secret ? { secret } : {}) });
}, { role: "admin" });

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  const w = await Webhook.findOneAndDelete({ _id: oid(id), website: ctx.website.id });
  if (!w) return err("Not found", 404);
  await WebhookDelivery.deleteMany({ webhook: w._id });
  return json({ ok: true });
}, { role: "admin" });
