import { Readable } from "node:stream";
import { dbConnect } from "@/lib/db";
import { findFile } from "@/lib/files";
import { getCtx } from "@/lib/context";
import { Conversation, Message, Website } from "@/lib/models";
import { verifyVisitorToken } from "@/lib/widgetToken";
import { tokenKey, CORS } from "@/lib/widgetApi";
import { err } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

/**
 * Download an attachment. Allowed for members of the owning website (session cookie) or for the visitor
 * whose conversation contains it (?token=<visitor token>). Served with nosniff + a locked-down CSP.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();
  const f = await findFile(id);
  if (!f) return err("Not found", 404);
  const meta = (f.file.metadata || {}) as { website?: string; uploader?: string; contentType?: string };
  let allowed = false;
  const token = new URL(req.url).searchParams.get("token");
  if (token) {
    const t = verifyVisitorToken(tokenKey(), token);
    if (t) {
      const site = await Website.findOne({ publicId: t.websiteId }).select("_id").lean();
      if (site && String(site._id) === meta.website) {
        if (meta.uploader === `visitor:${t.contactId}`) allowed = true;
        else {
          const convs = await Conversation.find({ website: site._id, contact: t.contactId }).select("_id").lean();
          allowed = Boolean(await Message.exists({ conversation: { $in: convs.map((c) => c._id) }, "attachments.id": id, from: { $ne: "note" } }));
        }
      }
    }
  } else {
    const ctx = await getCtx();
    if (ctx) allowed = Boolean(await Website.exists({ _id: meta.website, "members.user": ctx.user.id }));
  }
  if (!allowed) return err("Not found", 404);
  const type = meta.contentType || "application/octet-stream";
  const download = new URL(req.url).searchParams.has("download") || !INLINE.has(type);
  const name = f.file.filename.replace(/["\\\r\n]/g, "_");
  const stream = Readable.toWeb(f.stream()) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      ...CORS,
      "Content-Type": type,
      "Content-Length": String(f.file.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(f.file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
