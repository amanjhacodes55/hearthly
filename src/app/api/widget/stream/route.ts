import { CORS, visitorRoute } from "@/lib/widgetApi";
import { sseResponse } from "@/lib/sse";
import { Contact } from "@/lib/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Visitor realtime stream (EventSource, token in ?token=). Subscribes to the visitor's own topic, so operator replies, typing and status changes arrive instantly.
 */
export const GET = visitorRoute(
  async (req, { contact }) => {
    const topics = [`visitor:${contact._id}`];
    await Contact.updateOne({ _id: contact._id }, { lastSeenAt: new Date() });
    return sseResponse(req, topics, { headers: CORS });
  },
  { bucket: "stream", capacity: 20, perSec: 0.2 },
);
