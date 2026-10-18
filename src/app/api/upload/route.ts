import { route, err, json } from "@/lib/api";
import { readUpload, saveFile } from "@/lib/files";

export const runtime = "nodejs";

/** Agent attachment upload (multipart `file`). */
export const POST = route(async (req, ctx) => {
  const up = await readUpload(req);
  if ("error" in up) return err(up.error!, 400);
  return json(await saveFile(up.buf, up.name, { website: ctx.website.id, uploader: `user:${ctx.user.id}` }), 201);
});
