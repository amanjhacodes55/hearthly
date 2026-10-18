import { z } from "zod";
import { Message } from "@/lib/models";
import { currentConversation } from "@/lib/chat";
import { sendMail } from "@/lib/mail";
import { options, visitorRoute, werr, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;
const schema = z.object({ email: z.string().email().max(200) });

/** Email the visitor a transcript of their conversation (logged to the server console when SMTP isn't set). */
export const POST = visitorRoute(
  async (req, { site, contact }) => {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return werr("Enter a valid email");
    const conv = await currentConversation(site._id, contact._id);
    if (!conv) return werr("No conversation yet", 404);
    const msgs = await Message.find({ conversation: conv._id, from: { $in: ["visitor", "operator", "bot"] } }).sort({ createdAt: 1 }).limit(500).lean();
    const lines = msgs.map((m) => {
      const who = m.from === "visitor" ? "You" : m.author?.name || site.name;
      const att = (m.attachments || []).map((a) => ` [attachment: ${a.name}]`).join("");
      return `[${new Date(m.createdAt!).toISOString().slice(0, 16).replace("T", " ")}] ${who}: ${m.text}${att}`;
    });
    const r = await sendMail({ to: p.data.email, subject: `Your conversation with ${site.name}`, text: `Here is a copy of your conversation with ${site.name}:\n\n${lines.join("\n")}\n` });
    return wjson({ ok: true, delivery: "sent" in r ? "email" : "logged" });
  },
  { bucket: "transcript", capacity: 3, perSec: 0.01 },
);
