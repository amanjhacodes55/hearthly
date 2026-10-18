import { publish } from "@/lib/bus";
import { currentConversation } from "@/lib/chat";
import { options, visitorRoute, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Visitor typing indicator (+ a live preview of what they're typing, like a "message peek"). */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const b = await req.json().catch(() => ({}));
    const conv = await currentConversation(site._id, contact._id);
    if (conv) publish(`site:${site._id}`, "typing", { conversation_id: String(conv._id), who: "visitor", typing: Boolean(b.typing), preview: String(b.preview || "").slice(0, 200) });
    return wjson({ ok: true });
  },
  { bucket: "typing", capacity: 60, perSec: 2 },
);
