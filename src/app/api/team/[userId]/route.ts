import { z } from "zod";
import { route, json, body, err } from "@/lib/api";
import { Conversation, Website } from "@/lib/models";

type P = { userId: string };

export const PATCH = route<P>(async (req, ctx, { userId }) => {
  const { role } = await body(req, z.object({ role: z.enum(["admin", "agent"]) }));
  const w = await Website.findById(ctx.website.id).select("members").lean();
  const m = w?.members.find((x) => String(x.user) === userId);
  if (!m) return err("Not a member", 404);
  if (m.role === "owner") return err("The owner's role can't be changed.", 400);
  await Website.updateOne({ _id: ctx.website.id, "members.user": userId }, { $set: { "members.$.role": role } });
  return json({ ok: true });
}, { role: "admin" });

export const DELETE = route<P>(async (_req, ctx, { userId }) => {
  const w = await Website.findById(ctx.website.id).select("members").lean();
  const m = w?.members.find((x) => String(x.user) === userId);
  if (!m) return err("Not a member", 404);
  if (m.role === "owner") return err("The owner can't be removed.", 400);
  const self = userId === ctx.user.id;
  if (!self && ctx.website.role === "agent") return err("Only admins can remove teammates.", 403);
  await Website.updateOne({ _id: ctx.website.id }, { $pull: { members: { user: userId } } });
  await Conversation.updateMany({ website: ctx.website.id, assignee: userId }, { $unset: { assignee: 1 } });
  return json({ ok: true });
});
