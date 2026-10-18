import { z } from "zod";
import { Contact, Conversation } from "@/lib/models";
import { publish } from "@/lib/bus";
import { currentConversation } from "@/lib/chat";
import { dispatchWebhooks } from "@/lib/webhooks";
import { sConversation } from "@/lib/serialize";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({ score: z.number().int().min(1).max(5), comment: z.string().max(1000).default("") });

export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Score must be 1–5");
    const cur = await currentConversation(site._id, contact._id);
    if (!cur) return werr("No conversation to rate", 404);
    const conv = await Conversation.findByIdAndUpdate(cur._id, { rating: { score: p.data.score, comment: p.data.comment, at: new Date() } }, { new: true }).lean();
    const c = sConversation(conv, await Contact.findById(contact._id).lean());
    publish(`site:${site._id}`, "conversation", c);
    void dispatchWebhooks(String(site._id), "rating.submitted", { conversation: c, rating: c.rating });
    return wjson({ ok: true, rating: c.rating });
  },
  { bucket: "rate", capacity: 10, perSec: 0.1 },
);
