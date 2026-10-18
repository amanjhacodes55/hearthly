import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";
import { readUpload, saveFile } from "@/lib/files";
import { DEFAULT_WIDGET } from "@/lib/models";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Visitor attachment upload (multipart field `file`, ≤ 10 MB, allowlisted types). */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    if ({ ...DEFAULT_WIDGET, ...(site.widget || {}) }.allowAttachments === false) return werr("Attachments are disabled", 403);
    const up = await readUpload(req);
    if ("error" in up) return werr(up.error!, 400);
    const f = await saveFile(up.buf, up.name, { website: String(site._id), uploader: `visitor:${contact._id}` });
    return wjson(f, 201);
  },
  { bucket: "upload", capacity: 10, perSec: 0.1 },
);
