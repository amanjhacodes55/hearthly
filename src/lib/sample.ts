import "server-only";
import { Article, Campaign, Category, Contact, Conversation, Message, PageView, Segment, Shortcut, TrackedEvent, Trigger, Website } from "@/lib/models";
import { shortId, rand } from "@/lib/ids";

const DAY = 86400_000;

const PEOPLE = [
  { name: "Maya Fischer", email: "maya@northwind.example.test", country: "DE", countryName: "Germany", city: "Berlin", tz: "Europe/Berlin", locale: "de-DE", browser: "Chrome", os: "macOS", type: "desktop", tags: ["vip", "pro-plan"], data: { plan: "pro", seats: 12 }, company: "Northwind" },
  { name: "Lucas Moreau", email: "lucas@atelier.example.test", country: "FR", countryName: "France", city: "Paris", tz: "Europe/Paris", locale: "fr-FR", browser: "Safari", os: "iOS", type: "mobile", tags: ["trial"], data: { plan: "trial" }, company: "Atelier Lumière" },
  { name: "Priya Raman", email: "priya@kitebase.example.test", country: "IN", countryName: "India", city: "Kolkata", tz: "Asia/Kolkata", locale: "en-IN", browser: "Chrome", os: "Windows", type: "desktop", tags: ["lead"], data: { plan: "free" }, company: "Kitebase" },
  { name: "Diego Alvarez", email: "diego@solsticio.example.test", country: "MX", countryName: "Mexico", city: "Mexico City", tz: "America/Mexico_City", locale: "es-MX", browser: "Firefox", os: "Linux", type: "desktop", tags: ["pro-plan"], data: { plan: "pro", seats: 4 }, company: "Solsticio" },
  { name: "Hannah Lee", email: "hannah@brightloop.example.test", country: "US", countryName: "United States", city: "New York", tz: "America/New_York", locale: "en-US", browser: "Edge", os: "Windows", type: "desktop", tags: ["churn-risk"], data: { plan: "pro", seats: 30 }, company: "Brightloop" },
  { name: "", email: "", country: "GB", countryName: "United Kingdom", city: "London", tz: "Europe/London", locale: "en-GB", browser: "Chrome", os: "Android", type: "mobile", tags: [], data: {}, company: "" },
  { name: "Kenji Watanabe", email: "kenji@harbor.example.test", country: "JP", countryName: "Japan", city: "Tokyo", tz: "Asia/Tokyo", locale: "ja-JP", browser: "Chrome", os: "macOS", type: "desktop", tags: ["lead"], data: { plan: "free" }, company: "Harbor KK" },
  { name: "Amara Okafor", email: "amara@lumen.example.test", country: "NG", countryName: "Nigeria", city: "Lagos", tz: "Africa/Lagos", locale: "en-NG", browser: "Samsung Internet", os: "Android", type: "mobile", tags: ["trial"], data: { plan: "trial" }, company: "Lumen" },
];

const THREADS: { status: "open" | "pending" | "resolved"; tags: string[]; rating?: number; msgs: [string, string][] }[] = [
  { status: "open", tags: ["billing"], msgs: [["v", "Hi! We'd like to add 5 more seats to our plan — is that prorated?"], ["o", "Hey Maya 👋 Yes, seats are prorated to the day. Want me to add them now?"], ["v", "Yes please, and can the invoice go to finance@northwind.example.test?"]] },
  { status: "open", tags: ["bug"], msgs: [["v", "Bonjour — the export button does nothing on my iPhone."], ["n", "Repro'd on iOS 17 Safari. Linked to the popup-blocker issue."], ["o", "Thanks Lucas! We reproduced it and a fix ships tomorrow. Meanwhile, desktop export works."]] },
  { status: "pending", tags: ["sales"], msgs: [["v", "Do you offer discounts for non-profits?"], ["o", "We do — 50% off for registered non-profits. Could you share your registration number?"]] },
  { status: "resolved", tags: ["how-to"], rating: 5, msgs: [["v", "How do I connect my custom domain?"], ["o", "Go to Settings → Domains, add your domain and create the CNAME we show. It verifies in a few minutes."], ["v", "Worked perfectly, thanks!"]] },
  { status: "open", tags: ["churn-risk"], msgs: [["v", "We're evaluating alternatives — what's on your roadmap for SSO?"]] },
  { status: "open", tags: [], msgs: [["v", "hello? is anyone there"]] },
  { status: "resolved", tags: ["how-to"], rating: 4, msgs: [["v", "Can I change the widget color?"], ["o", "Absolutely — Settings → Chat widget lets you pick colors, position and more, with a live preview."]] },
];

const KB: { cat: string; icon: string; desc: string; articles: { title: string; body: string }[] }[] = [
  {
    cat: "Getting started",
    icon: "🚀",
    desc: "Install the widget and invite your team",
    articles: [
      { title: "Install the chat widget on your website", body: "## Copy the snippet\n\nGo to **Settings → Chat widget** and copy the one-line script. Paste it before `</body>` on every page.\n\n```html\n<script src=\"https://YOUR-HOST/widget.js\" data-website=\"YOUR_ID\" async></script>\n```\n\n## Verify\n\nOpen your site — the launcher appears in the corner. Send a test message and watch it land in your inbox." },
      { title: "Invite teammates", body: "Open **Settings → Team**, create an invite link and pick a role:\n\n- **Admin** — manage settings, API keys and webhooks\n- **Agent** — answer conversations\n\nLinks expire after 7 days." },
    ],
  },
  {
    cat: "Billing & plans",
    icon: "💳",
    desc: "Seats, invoices and refunds",
    articles: [
      { title: "How seat billing works", body: "Seats are **prorated to the day**. Adding a seat mid-cycle charges only the remaining days; removing one credits your next invoice." },
      { title: "Request a refund", body: "We offer a 14-day no-questions refund. Start a chat with us and include your invoice number." },
    ],
  },
  {
    cat: "Troubleshooting",
    icon: "🛠️",
    desc: "Fix common issues fast",
    articles: [
      { title: "Export button not working on mobile", body: "Some mobile browsers block pop-ups. Allow pop-ups for our domain, or use the desktop app for large exports." },
      { title: "Reset your password", body: "Click **Forgot password** on the login page. The reset link is valid for 30 minutes." },
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/** Populate a website with realistic demo data so the dashboard looks alive. */
export async function seedSample(siteId: string, ownerId: string, ownerName: string) {
  const now = Date.now();
  const pages = ["/", "/pricing", "/features", "/docs/getting-started", "/blog/launch", "/signup", "/integrations"];
  const refs = ["https://www.google.com/", "https://news.ycombinator.com/", "https://twitter.com/", "", "https://www.producthunt.com/"];
  const contacts = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const firstSeen = new Date(now - (20 - i * 2) * DAY);
    const lastSeen = new Date(now - (i < 2 ? 20_000 : i * 3 * 3600_000));
    const current = pages[i % pages.length];
    const c = await Contact.create({
      website: siteId,
      email: p.email,
      name: p.name,
      company: p.company,
      tags: p.tags,
      data: p.data,
      geo: { country: p.country, countryName: p.countryName, city: p.city, timezone: p.tz, locale: p.locale },
      device: { browser: p.browser, browserVersion: "126", os: p.os, osVersion: "", type: p.type },
      referrer: refs[i % refs.length],
      utm: i % 3 === 0 ? { source: "newsletter", medium: "email", campaign: "spring-launch" } : undefined,
      firstSeenAt: firstSeen,
      lastSeenAt: lastSeen,
      sessions: 1 + ((i * 3) % 7),
      pageViews: 4 + i,
      currentPage: { url: `https://demo.chatcrip.example.test${current}`, title: current === "/" ? "Home" : current.slice(1), since: lastSeen },
      eventNames: i % 2 === 0 ? ["signed_up", "viewed_pricing"] : ["viewed_pricing"],
      source: "widget",
      sessionId: rand(8),
    });
    contacts.push(c);
    const views = [];
    for (let k = 0; k < 4 + i; k++) {
      const path = pages[(i + k) % pages.length];
      views.push({ website: siteId, contact: c._id, url: `https://demo.chatcrip.example.test${path}`, path, title: path === "/" ? "Home" : path.slice(1), referrer: k === 0 ? refs[i % refs.length] : "", at: new Date(lastSeen.getTime() - (4 + i - k) * 95_000 - k * DAY * (i % 2)), duration: 20 + ((k * 37) % 180) });
    }
    await PageView.insertMany(views);
    await TrackedEvent.insertMany((c.eventNames || []).map((n, k) => ({ website: siteId, contact: c._id, name: n, props: n === "signed_up" ? { plan: p.data.plan || "free" } : {}, at: new Date(lastSeen.getTime() - k * 3600_000) })));
  }

  for (let i = 0; i < THREADS.length; i++) {
    const t = THREADS[i];
    const contact = contacts[i];
    const start = new Date(now - (i * 7 + 2) * 3600_000 - (i > 3 ? 3 * DAY : 0));
    const conv = await Conversation.create({ website: siteId, contact: contact._id, status: t.status, tags: t.tags, assignee: i % 2 === 0 ? ownerId : undefined, createdAt: start, updatedAt: start });
    let at = start.getTime();
    let firstResponseAt: Date | undefined;
    let last: { text: string; from: string; at: Date } | null = null;
    for (const [who, text] of t.msgs) {
      at += 60_000 * (2 + ((text.length * 7) % 9));
      const from = who === "v" ? "visitor" : who === "n" ? "note" : "operator";
      if (from === "operator" && !firstResponseAt) firstResponseAt = new Date(at);
      await Message.create({ website: siteId, conversation: conv._id, from, text, author: from === "visitor" ? { id: String(contact._id), name: contact.name || "Visitor" } : { id: ownerId, name: ownerName }, createdAt: new Date(at) });
      if (from !== "note") last = { text, from, at: new Date(at) };
    }
    const lastIsVisitor = last?.from === "visitor";
    await Conversation.updateOne(
      { _id: conv._id },
      {
        lastMessage: last,
        lastVisitorAt: last?.at,
        unreadAgent: lastIsVisitor && t.status === "open" ? 1 : 0,
        firstResponseAt,
        resolvedAt: t.status === "resolved" ? new Date(at + 600_000) : undefined,
        rating: t.rating ? { score: t.rating, comment: t.rating === 5 ? "Super quick, thank you!" : "", at: new Date(at + 700_000) } : undefined,
        updatedAt: new Date(at),
      },
      { timestamps: false },
    );
  }

  let order = 0;
  for (const c of KB) {
    const cat = await Category.create({ website: siteId, name: c.cat, slug: slug(c.cat), description: c.desc, icon: c.icon, order: order++ });
    for (const a of c.articles)
      await Article.create({ website: siteId, category: cat._id, title: a.title, slug: slug(a.title), body: a.body, excerpt: a.body.replace(/[#*`>\-\n]+/g, " ").trim().slice(0, 140), views: 10 + ((a.title.length * 13) % 200) });
  }

  await Shortcut.insertMany([
    { website: siteId, shortcut: "hi", title: "Greeting", body: "Hi {{first_name | there}} 👋 thanks for reaching out! How can I help?" },
    { website: siteId, shortcut: "thanks", title: "Thanks & close", body: "Glad I could help, {{first_name | friend}}! Anything else before I close this chat?" },
    { website: siteId, shortcut: "refund", title: "Refund policy", body: "We offer a 14-day no-questions refund — just reply with your invoice number and I'll process it." },
    { website: siteId, shortcut: "email", title: "Ask for email", body: "Could you share your email so we can follow up if you leave the page?" },
    { website: siteId, shortcut: "docs", title: "Link to docs", body: "You'll find a step-by-step guide in our help center: {{help_url}}" },
  ]);

  await Trigger.create({
    website: siteId,
    name: "Pricing page nudge",
    conditions: [
      { type: "url", op: "matches", value: "*/pricing*" },
      { type: "time_on_page", op: "gte", value: "15" },
    ],
    actions: [{ type: "message", text: "Hey {{first_name | there}} — comparing plans? I can help you pick the right one in 30 seconds 🙂" }],
    once: true,
  });
  await Trigger.create({
    website: siteId,
    name: "Welcome back returning visitors",
    enabled: false,
    conditions: [{ type: "returning", op: "is_true", value: "" }],
    actions: [{ type: "tag", tag: "returning" }],
  });
  const vip = await Segment.create({ website: siteId, name: "VIP customers", match: "all", filters: [{ field: "tag", op: "has", value: "vip", key: "" }] });
  await Segment.create({ website: siteId, name: "Trials active this week", match: "all", filters: [{ field: "tag", op: "has", value: "trial", key: "" }, { field: "last_seen", op: "within_days", value: "7", key: "" }] });
  await Campaign.create({ website: siteId, name: "VIP early access", segment: vip._id, channel: "chat", body: "Hi {{first_name | there}}! You're invited to try our new analytics dashboard before anyone else 🎉 Reply here to get access.", sender: ownerId });
  await Website.updateOne(
    { _id: siteId },
    {
      tags: [
        { name: "billing", color: "#f59e0b" },
        { name: "bug", color: "#ef4444" },
        { name: "sales", color: "#10b981" },
        { name: "how-to", color: "#3b82f6" },
        { name: "churn-risk", color: "#a855f7" },
        { name: "vip", color: "#eab308" },
      ],
      "widget.quickReplies": [
        { label: "💳 Billing question", reply: "Got it — a billing specialist will reply shortly. Meanwhile: seats are prorated to the day.", tag: "billing" },
        { label: "🐞 Report a bug", reply: "Sorry about that! Tell us what happened and, if you can, attach a screenshot 📎", tag: "bug" },
        { label: "🤝 Talk to sales", reply: "Great! What's your team size and use case?", tag: "sales" },
      ],
    },
  );
}

export function newPublicId() {
  return shortId(12);
}
export { slug };
