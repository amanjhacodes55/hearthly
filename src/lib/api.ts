import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError, type ZodTypeAny } from "zod";
import { canAdmin, getCtx, type Ctx } from "@/lib/context";
import { dbConnect } from "@/lib/db";
import { isValidObjectId } from "mongoose";

export const json = (data: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(data, { status, headers });
export const err = (message: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error: message, ...extra }, { status });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export function zodMessage(e: ZodError) {
  return e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

const MAX_BODY = 256 * 1024;
/** Parse + validate a JSON body with a zod schema (rejects bodies > 256 KB). */
export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > MAX_BODY) fail(413, "Request body too large");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    fail(400, "Invalid JSON body");
  }
  const r = schema.safeParse(raw);
  if (!r.success) fail(400, zodMessage(r.error));
  return r.data;
}

export const oid = (id: string | undefined | null) => (id && isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(id) ? id : fail(404, "Not found"));

export function handleError(e: unknown) {
  if (e instanceof HttpError) return err(e.message, e.status);
  if (e instanceof ZodError) return err(zodMessage(e), 400);
  console.error(e);
  const msg = e instanceof Error ? e.message : "Something went wrong";
  return err(/ECONNREFUSED|MongoServerSelection|buffering timed out/i.test(msg) ? "Database unavailable — please retry shortly." : "Something went wrong", 500);
}

type H<P> = (req: Request, ctx: Ctx, params: P) => Promise<Response>;

/** Route wrapper for dashboard APIs: signed-in member of the current website (optionally admin+ / owner). */
export function route<P = Record<string, string>>(h: H<P>, o: { role?: "admin" | "owner"; noWebsite?: boolean } = {}) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      await dbConnect();
      const ctx = await getCtx();
      if (!ctx) return err("Please sign in.", 401);
      if (!o.noWebsite && !ctx.website.id) return err("Create a website first.", 400);
      if (o.role === "admin" && !canAdmin(ctx.website.role)) return err("Only admins can do that.", 403);
      if (o.role === "owner" && ctx.website.role !== "owner") return err("Only the owner can do that.", 403);
      return await h(req, ctx, await params);
    } catch (e) {
      return handleError(e);
    }
  };
}

export function pageParams(url: URL, def = 30, max = 100) {
  const limit = Math.min(max, Math.max(1, Number(url.searchParams.get("limit")) || def));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return { limit, page, skip: (page - 1) * limit };
}

export function clientIp(req: Request) {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}
