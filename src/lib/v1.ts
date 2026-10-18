import "server-only";
import { NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";
import { dbConnect } from "@/lib/db";
import { ApiKey, Installation, OAuthApp, OAuthToken } from "@/lib/models";
import { sha256 } from "@/lib/ids";
import { takeToken } from "@/lib/rateLimit";
import { HttpError, zodMessage } from "@/lib/api";
import type { Scope } from "@/lib/oauth";

/**
 * REST API v1 auth: `Authorization: Bearer <token>` where token is a workspace API key (cc_key_…)
 * or an OAuth access token (cc_at_…). Errors are always `{ "error": { "code", "message" } }`.
 */
export type V1Ctx = { websiteId: string; scopes: string[]; actor: { type: "api_key" | "app"; id: string; name: string } };

export function v1err(code: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}
export const v1json = (data: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(data, { status, headers });

export async function v1body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > 256 * 1024) throw new HttpError(413, "Body too large");
  let raw: unknown = {};
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(422, zodMessage(r.error));
  return r.data;
}

export function paginate(url: URL) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return { limit, page, skip: (page - 1) * limit, meta: (total: number) => ({ page, limit, total, has_more: page * limit < total }) };
}

async function authenticate(raw: string): Promise<V1Ctx | null> {
  if (raw.startsWith("cc_key_")) {
    const k = await ApiKey.findOneAndUpdate({ hash: sha256(raw) }, { lastUsedAt: new Date() }).lean();
    return k ? { websiteId: String(k.website), scopes: k.scopes, actor: { type: "api_key", id: String(k._id), name: k.name || "API key" } } : null;
  }
  if (raw.startsWith("cc_at_")) {
    const t = await OAuthToken.findOne({ accessHash: sha256(raw), revokedAt: null }).lean();
    if (!t || (t.expiresAt && t.expiresAt < new Date())) return null;
    const inst = await Installation.findOneAndUpdate({ _id: t.installation, revokedAt: null }, { lastUsedAt: new Date() }).lean();
    if (!inst) return null;
    const app = await OAuthApp.findById(t.app).select("name").lean();
    return { websiteId: String(t.website), scopes: t.scopes || [], actor: { type: "app", id: String(t.app), name: app?.name || "App" } };
  }
  return null;
}

type H<P> = (req: Request, ctx: V1Ctx, params: P) => Promise<Response>;

export function v1<P = Record<string, string>>(scope: Scope | null, h: H<P>) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    const raw = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!raw) return v1err("unauthorized", "Missing `Authorization: Bearer <token>` header", 401, { "WWW-Authenticate": "Bearer" });
    const rl = takeToken(`v1:${sha256(raw).slice(0, 24)}`, 120, 2);
    const rlHeaders = { "X-RateLimit-Limit": "120", "X-RateLimit-Remaining": String(rl.remaining) };
    if (!rl.ok) return v1err("rate_limited", "Rate limit exceeded (burst 120, 2 req/s sustained)", 429, { ...rlHeaders, "Retry-After": String(rl.retryAfterSec) });
    try {
      await dbConnect();
      const ctx = await authenticate(raw);
      if (!ctx) return v1err("unauthorized", "Invalid, expired or revoked token", 401, { "WWW-Authenticate": 'Bearer error="invalid_token"' });
      if (scope && !ctx.scopes.includes(scope)) return v1err("insufficient_scope", `This token lacks the "${scope}" scope`, 403);
      const res = await h(req, ctx, await params);
      for (const [k, v] of Object.entries(rlHeaders)) res.headers.set(k, v);
      return res;
    } catch (e) {
      if (e instanceof HttpError) return v1err(e.status === 404 ? "not_found" : e.status === 422 ? "validation_failed" : "bad_request", e.message, e.status);
      console.error("[v1]", e);
      return v1err("server_error", "Internal error", 500);
    }
  };
}
