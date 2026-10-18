import { CampaignDelivery, Campaign, Conversation } from "@/lib/models";
import { publish } from "@/lib/bus";
import { currentConversation } from "@/lib/chat";
import { options, visitorRoute, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Visitor has seen the operator messages → read receipt for agents + campaign "opened". */
export const POST = visitorRoute(
  async (_req, { site, contact }) => {
    const conv = await currentConversation(site._id, contact._id);
    if (!conv) return wjson({ ok: true });
    const at = new Date();
    await Conversation.updateOne({ _id: conv._id }, { unreadVisitor: 0, visitorReadAt: at });
    publish(`site:${site._id}`, "read", { conversation_id: String(conv._id), who: "visitor", at: at.toISOString() });
    if (conv.campaign) {
      const d = await CampaignDelivery.findOneAndUpdate({ conversation: conv._id, openedAt: null }, { openedAt: at });
      if (d) await Campaign.updateOne({ _id: d.campaign }, { $inc: { "stats.opened": 1 } });
    }
    return wjson({ ok: true });
  },
  { bucket: "read", capacity: 60, perSec: 1 },
);
