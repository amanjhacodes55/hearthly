import { Types } from "mongoose";
import { route, json } from "@/lib/api";
import { Contact, Conversation, Message, PageView } from "@/lib/models";

const DAY = 86400_000;

/** Dashboard analytics for the last N days (default 30), bucketed in the caller's time zone. */
export const GET = route(async (req, ctx) => {
  const sp = new URL(req.url).searchParams;
  const days = Math.min(180, Math.max(7, Number(sp.get("days")) || 30));
  let tz = sp.get("tz") || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    tz = "UTC";
  }
  const website = new Types.ObjectId(ctx.website.id);
  const since = new Date(Date.now() - days * DAY);
  const day = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } };

  const [convDays, convStats, ratingDist, heat, topPages, visitorDays, sources, newContacts, msgCount] = await Promise.all([
    Conversation.aggregate([{ $match: { website, createdAt: { $gte: since } } }, { $group: { _id: day, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Conversation.aggregate([
      { $match: { website, createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          frt: { $avg: { $cond: [{ $gt: ["$firstResponseAt", null] }, { $subtract: ["$firstResponseAt", "$createdAt"] }, null] } },
          res: { $avg: { $cond: [{ $gt: ["$resolvedAt", null] }, { $subtract: ["$resolvedAt", "$createdAt"] }, null] } },
          csat: { $avg: "$rating.score" },
          rated: { $sum: { $cond: [{ $gt: ["$rating.score", 0] }, 1, 0] } },
        },
      },
    ]),
    Conversation.aggregate([{ $match: { website, "rating.score": { $gte: 1 }, createdAt: { $gte: since } } }, { $group: { _id: "$rating.score", n: { $sum: 1 } } }]),
    Message.aggregate([
      { $match: { website, from: "visitor", createdAt: { $gte: since } } },
      { $project: { p: { $dateToParts: { date: "$createdAt", timezone: tz } }, dow: { $dayOfWeek: { date: "$createdAt", timezone: tz } } } },
      { $group: { _id: { d: "$dow", h: "$p.hour" }, n: { $sum: 1 } } },
    ]),
    PageView.aggregate([{ $match: { website, at: { $gte: since } } }, { $group: { _id: "$path", n: { $sum: 1 }, avg: { $avg: "$duration" } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
    PageView.aggregate([
      { $match: { website, at: { $gte: since } } },
      { $group: { _id: { d: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: tz } }, c: "$contact" } } },
      { $group: { _id: "$_id.d", n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Contact.aggregate([{ $match: { website, lastSeenAt: { $gte: since } } }, { $group: { _id: { r: "$referrer", u: "$utm.source" }, n: { $sum: 1 } } }]),
    Contact.countDocuments({ website, createdAt: { $gte: since } }),
    Message.countDocuments({ website, createdAt: { $gte: since }, from: { $in: ["visitor", "operator"] } }),
  ]);

  const fill = (rows: { _id: string; n: number }[]) => {
    const map = new Map(rows.map((r) => [r._id, r.n]));
    const out: { date: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - i * DAY));
      out.push({ date: d, value: map.get(d) || 0 });
    }
    return out;
  };
  const srcMap = new Map<string, number>();
  for (const s of sources as { _id: { r?: string; u?: string }; n: number }[]) {
    let key = "Direct";
    if (s._id.u) key = `utm: ${s._id.u}`;
    else if (s._id.r) {
      try {
        key = new URL(s._id.r).hostname.replace(/^www\./, "");
      } catch {
        key = "Other";
      }
    }
    srcMap.set(key, (srcMap.get(key) || 0) + s.n);
  }
  const st = convStats[0] || {};
  return json({
    days,
    totals: { conversations: st.total || 0, resolved: st.resolved || 0, newContacts, messages: msgCount, rated: st.rated || 0 },
    firstResponseMs: st.frt ?? null,
    resolutionMs: st.res ?? null,
    csat: st.csat ?? null,
    ratings: [1, 2, 3, 4, 5].map((s) => ratingDist.find((r) => r._id === s)?.n || 0),
    conversationsPerDay: fill(convDays),
    visitorsPerDay: fill(visitorDays),
    heatmap: (heat as { _id: { d: number; h: number }; n: number }[]).map((h) => ({ day: h._id.d - 1, hour: h._id.h, value: h.n })),
    topPages: (topPages as { _id: string; n: number; avg: number }[]).map((p) => ({ path: p._id || "/", views: p.n, avgSeconds: Math.round(p.avg || 0) })),
    sources: [...srcMap.entries()].map(([source, visitors]) => ({ source, visitors })).sort((a, b) => b.visitors - a.visitors).slice(0, 8),
  });
});
