import { route } from "@/lib/api";
import { Article, Campaign, Category, Contact, Conversation, Message, Segment, Shortcut, Trigger, Website } from "@/lib/models";
import { sContact, sConversation, sMessage } from "@/lib/serialize";

/** Full JSON export of the website's data (GDPR-style portability). Admins only. */
export const GET = route(async (_req, ctx) => {
  const w = ctx.website.id;
  const [site, contacts, convs, msgs, articles, cats, segs, shorts, trigs, camps] = await Promise.all([
    Website.findById(w).select("-identitySecret -members").lean(),
    Contact.find({ website: w }).lean(),
    Conversation.find({ website: w }).lean(),
    Message.find({ website: w }).sort({ createdAt: 1 }).limit(200_000).lean(),
    Article.find({ website: w }).lean(),
    Category.find({ website: w }).lean(),
    Segment.find({ website: w }).lean(),
    Shortcut.find({ website: w }).lean(),
    Trigger.find({ website: w }).lean(),
    Campaign.find({ website: w }).lean(),
  ]);
  const strip = <T extends object>(d: T) => JSON.parse(JSON.stringify(d, (k, v) => (k === "website" || k === "__v" ? undefined : v)));
  const out = {
    exported_at: new Date().toISOString(),
    website: strip(site!),
    contacts: contacts.map(sContact),
    conversations: convs.map((c) => sConversation(c)),
    messages: msgs.map(sMessage),
    knowledge_base: { categories: cats.map(strip), articles: articles.map(strip) },
    segments: segs.map(strip),
    shortcuts: shorts.map(strip),
    triggers: trigs.map(strip),
    campaigns: camps.map(strip),
  };
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="chatcrip-export-${new Date().toISOString().slice(0, 10)}.json"` } });
}, { role: "admin" });
