import "server-only";
import { z } from "zod";
import { Webhook } from "@/lib/models";
import { encrypt } from "@/lib/secrets";
import { assertPublicUrl } from "@/lib/outbound";
import { rand } from "@/lib/ids";
import { HttpError } from "@/lib/api";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks";
import { ALL_SCOPES, type Scope } from "@/lib/oauth";

export const API_KEY_SCOPES = ["conversations:read", "conversations:write", "messages:write", "contacts:read", "contacts:write", "webhooks:manage", "website:read"] as const;

const events = Object.keys(WEBHOOK_EVENTS) as [WebhookEvent, ...WebhookEvent[]];
export const webhookInput = z.object({
  url: z.string().trim().url().max(1000).refine((u) => /^https?:\/\//.test(u), "Must be http(s)"),
  events: z.array(z.enum(events)).min(1),
  description: z.string().trim().max(200).default(""),
});

export function serializeWebhook(w: { _id: unknown; url: string; events?: string[]; description?: string | null; active?: boolean | null; secretHint?: string | null; createdVia?: string | null; failures?: number | null; createdAt?: Date | null }) {
  return { id: String(w._id), url: w.url, events: w.events || [], description: w.description || "", active: w.active !== false, secret_hint: w.secretHint || "", created_via: w.createdVia || "dashboard", failures: w.failures || 0, created_at: w.createdAt };
}

export async function createWebhook(websiteId: string, input: z.infer<typeof webhookInput>, via = "dashboard", installation?: string) {
  try {
    await assertPublicUrl(input.url);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Invalid URL");
  }
  if ((await Webhook.countDocuments({ website: websiteId })) >= 25) throw new HttpError(400, "Limit of 25 webhooks per website");
  const secret = `whsec_${rand(24)}`;
  const w = await Webhook.create({ website: websiteId, ...input, secretEnc: encrypt(secret), secretHint: `${secret.slice(0, 10)}…`, createdVia: via, installation });
  return { webhook: serializeWebhook(w.toObject()), secret };
}

export const appInput = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).default(""),
  homepage: z.string().url().max(300).or(z.literal("")).default(""),
  logo: z.string().url().max(500).or(z.literal("")).default(""),
  redirectUris: z
    .array(z.string().trim().url().max(500).refine((u) => /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u), "Redirect URIs must be https (http only for localhost)"))
    .min(1)
    .max(10),
  scopes: z.array(z.enum(ALL_SCOPES as [Scope, ...Scope[]])).min(1),
});

