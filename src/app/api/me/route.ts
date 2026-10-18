import { z } from "zod";
import bcrypt from "bcryptjs";
import { route, json, body, err } from "@/lib/api";
import { User } from "@/lib/models";

export const GET = route(async (_req, ctx) => json({ ...ctx.user, website: ctx.website }), { noWebsite: true });

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  image: z.string().url().max(500).or(z.literal("")).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifySound: z.boolean().optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
});
export const PATCH = route(async (req, ctx) => {
  const b = await body(req, schema);
  const set: Record<string, unknown> = {};
  for (const k of ["name", "image", "theme", "notifySound"] as const) if (b[k] !== undefined) set[k] = b[k];
  if (b.newPassword) {
    const u = await User.findById(ctx.user.id).select("+passwordHash");
    if (u?.passwordHash && !(await bcrypt.compare(b.currentPassword || "", u.passwordHash))) return err("Current password is incorrect.", 400);
    set.passwordHash = await bcrypt.hash(b.newPassword, 10);
  }
  await User.updateOne({ _id: ctx.user.id }, set);
  return json({ ok: true });
}, { noWebsite: true });
