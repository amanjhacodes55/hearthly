import { route, err } from "@/lib/api";
import { Contact } from "@/lib/models";
import { toCsv } from "@/lib/csv";
import { contactQuery } from "@/lib/contacts";

/** CSV export of contacts (honours the same filters as the list). */
export const GET = route(async (req, ctx) => {
  let q;
  try {
    q = await contactQuery(ctx.website.id, new URL(req.url).searchParams);
  } catch {
    return err("Invalid filters");
  }
  const list = await Contact.find(q).sort({ lastSeenAt: -1 }).limit(50_000).lean();
  const keys = [...new Set(list.flatMap((c) => Object.keys(c.data || {})))].slice(0, 30);
  const rows: unknown[][] = [["email", "name", "phone", "company", "tags", "country", "city", "browser", "os", "sessions", "first_seen", "last_seen", ...keys]];
  for (const c of list)
    rows.push([c.email, c.name, c.phone, c.company, (c.tags || []).join(";"), c.geo?.country, c.geo?.city, c.device?.browser, c.device?.os, c.sessions, c.firstSeenAt?.toISOString(), c.lastSeenAt?.toISOString(), ...keys.map((k) => (c.data as Record<string, unknown>)?.[k] ?? "")]);
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
