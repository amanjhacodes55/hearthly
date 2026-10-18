import { route, json, err } from "@/lib/api";
import { Contact } from "@/lib/models";
import { parseCsv } from "@/lib/csv";

const MAP: Record<string, string> = { email: "email", "e-mail": "email", name: "name", "full name": "name", phone: "phone", company: "company", tags: "tags" };

/** CSV import (text/csv body or multipart `file`). Columns: email,name,phone,company,tags(;-separated), anything else → custom data. Merges on email. */
export const POST = route(async (req, ctx) => {
  let text = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart")) {
    const f = (await req.formData()).get("file");
    if (!f || typeof f === "string") return err("No file");
    if (f.size > 5 * 1024 * 1024) return err("CSV must be under 5 MB");
    text = await f.text();
  } else {
    text = await req.text();
    if (text.length > 5 * 1024 * 1024) return err("CSV must be under 5 MB");
  }
  const rows = parseCsv(text, 10_001);
  if (rows.length < 2) return err("CSV needs a header row and at least one contact");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const rec: Record<string, string> = {};
    const data: Record<string, string> = {};
    header.forEach((h, i) => {
      const v = (r[i] || "").trim().slice(0, 500);
      if (!v) return;
      if (MAP[h]) rec[MAP[h]] = v;
      else if (/^[a-z0-9_\- ]{1,40}$/.test(h)) data[h.replace(/[ -]/g, "_")] = v;
    });
    const email = (rec.email || "").toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped++;
      continue;
    }
    if (!email && !rec.name) {
      skipped++;
      continue;
    }
    const tags = (rec.tags || "").split(/[;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const set: Record<string, unknown> = {};
    for (const k of ["name", "phone", "company"]) if (rec[k]) set[k] = rec[k];
    for (const [k, v] of Object.entries(data)) set[`data.${k}`] = v;
    const existing = email ? await Contact.findOne({ website: ctx.website.id, email, mergedInto: null }).select("_id").lean() : null;
    if (existing) {
      await Contact.updateOne({ _id: existing._id }, { $set: set, $addToSet: { tags: { $each: tags } } });
      updated++;
    } else {
      await Contact.create({ website: ctx.website.id, email, name: rec.name || "", phone: rec.phone || "", company: rec.company || "", tags, data, source: "import", sessions: 0 });
      created++;
    }
  }
  return json({ created, updated, skipped });
}, { role: "admin" });
