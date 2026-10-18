import { z } from "zod";
import { route, json, body } from "@/lib/api";
import { Invite } from "@/lib/models";
import { rand } from "@/lib/ids";
import { sendMail } from "@/lib/mail";

export const POST = route(async (req, ctx) => {
  const b = await body(req, z.object({ role: z.enum(["admin", "agent"]).default("agent"), email: z.string().email().max(200).or(z.literal("")).default("") }));
  const inv = await Invite.create({ website: ctx.website.id, code: rand(18), role: b.role, email: b.email.toLowerCase(), createdBy: ctx.user.id, expiresAt: new Date(Date.now() + 7 * 86400_000), maxUses: b.email ? 1 : 10 });
  const url = `${process.env.NEXTAUTH_URL || new URL(req.url).origin}/join/${inv.code}`;
  if (b.email) void sendMail({ to: b.email, subject: `${ctx.user.name} invited you to ${ctx.website.name} on ChatCrip`, text: `Join the team inbox: ${url}\n\nThis link expires in 7 days.` }).catch(() => {});
  return json({ id: String(inv._id), code: inv.code, url }, 201);
}, { role: "admin" });

export const DELETE = route(async (req, ctx) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  await Invite.deleteOne({ _id: /^[a-f0-9]{24}$/.test(id) ? id : null, website: ctx.website.id });
  return json({ ok: true });
}, { role: "admin" });
