import { z } from "zod";
import { route, json, body, err } from "@/lib/api";
import { ApiKey } from "@/lib/models";
import { rand, sha256 } from "@/lib/ids";
import { API_KEY_SCOPES } from "@/lib/devplatform";

export const GET = route(async (_req, ctx) => {
  const keys = await ApiKey.find({ website: ctx.website.id }).sort({ createdAt: -1 }).lean();
  return json(keys.map((k) => ({ id: String(k._id), name: k.name, prefix: k.prefix, scopes: k.scopes, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })));
}, { role: "admin" });

/** Creates a key; the plaintext is returned exactly once and only its SHA-256 is stored. */
export const POST = route(async (req, ctx) => {
  const b = await body(req, z.object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.enum(API_KEY_SCOPES)).min(1) }));
  if ((await ApiKey.countDocuments({ website: ctx.website.id })) >= 50) return err("Limit of 50 API keys");
  const key = `hly_key_${rand(28)}`;
  const k = await ApiKey.create({ website: ctx.website.id, name: b.name, scopes: b.scopes, prefix: key.slice(0, 14), hash: sha256(key), createdBy: ctx.user.id });
  return json({ id: String(k._id), name: k.name, scopes: k.scopes, prefix: k.prefix, key }, 201);
}, { role: "admin" });
