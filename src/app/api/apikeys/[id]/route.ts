import { route, json, err, oid } from "@/lib/api";
import { ApiKey } from "@/lib/models";

export const DELETE = route<{ id: string }>(async (_req, ctx, { id }) => {
  const r = await ApiKey.deleteOne({ _id: oid(id), website: ctx.website.id });
  return r.deletedCount ? json({ ok: true }) : err("Not found", 404);
}, { role: "admin" });
