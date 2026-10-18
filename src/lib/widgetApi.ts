/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Contact } from "@/lib/models";
import { loadSiteByPublicId, type Site } from "@/lib/chat";
import { verifyVisitorToken } from "@/lib/widgetToken";
import { secret } from "@/lib/ids";
import { takeToken } from "@/lib/rateLimit";
import { clientIp, handleError } from "@/lib/api";

/** Widget endpoints are called cross-origin from customers' websites: open CORS, token auth (no cookies). */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Hearthly-Token",
  "Access-Control-Max-Age": "86400",
};
export const wjson = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
export const werr = (message: string, status = 400) => wjson({ error: message }, status);
export const options = () => new Response(null, { status: 204, headers: CORS });

export const tokenKey = () => secret("widget");

export function rateLimited(req: Request, bucket: string, capacity = 60, perSec = 1) {
  const r = takeToken(`w:${bucket}:${clientIp(req)}`, capacity, perSec);
  return r.ok ? null : NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...CORS, "Retry-After": String(r.retryAfterSec) } });
}

export type VisitorCtx = { site: Site; contact: any; token: string };

/** Authenticate a visitor by their signed token (header Hearthly-Token, or ?token= for EventSource/img). */
export function visitorRoute(h: (req: Request, v: VisitorCtx) => Promise<Response>, o: { bucket: string; capacity?: number; perSec?: number }) {
  return async (req: Request) => {
    const limited = rateLimited(req, o.bucket, o.capacity, o.perSec);
    if (limited) return limited;
    try {
      const token = req.headers.get("hearthly-token") || new URL(req.url).searchParams.get("token") || "";
      const t = verifyVisitorToken(tokenKey(), token);
      if (!t) return werr("Invalid visitor token", 401);
      await dbConnect();
      const site = await loadSiteByPublicId(t.websiteId);
      if (!site) return werr("Unknown website", 404);
      const contact = await Contact.findOne({ _id: t.contactId, website: site._id }).lean();
      if (!contact) return werr("Visitor not found", 401);
      return await h(req, { site, contact, token });
    } catch (e) {
      const r = handleError(e);
      return new NextResponse(r.body, { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  };
}
