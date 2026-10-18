import { dbConnect } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness check for Render / uptime monitors: ALWAYS 200 while the server is up, so a database
 * outage never blocks a deploy. DB status is reported in the body; use ?strict=1 for a 503 when it's down.
 */
export async function GET(req: Request) {
  const strict = new URL(req.url).searchParams.has("strict");
  const started = Date.now();
  try {
    const conn = await dbConnect();
    await conn.connection.db!.admin().ping();
    return Response.json({ ok: true, db: "up", latencyMs: Date.now() - started, uptime: Math.round(process.uptime()) });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[health] database unreachable:", error);
    return Response.json({ ok: !strict, db: "down", error }, { status: strict ? 503 : 200 });
  }
}
