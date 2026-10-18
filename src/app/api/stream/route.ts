import { dbConnect } from "@/lib/db";
import { getCtx } from "@/lib/context";
import { agentOnline, onlineAgents } from "@/lib/bus";
import { sseResponse } from "@/lib/sse";
import { err } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Agent realtime stream for the current website (cookie session). Also drives agent presence. */
export async function GET(req: Request) {
  await dbConnect();
  const ctx = await getCtx();
  if (!ctx?.website.id) return err("Please sign in.", 401);
  const site = ctx.website.id;
  return sseResponse(req, [`site:${site}`], {
    initial: [{ type: "hello", data: { user: ctx.user.id, website: site, online: onlineAgents(site) } }],
    onOpen: () => agentOnline(site, ctx.user.id, 1),
    onClose: () => agentOnline(site, ctx.user.id, -1),
  });
}
