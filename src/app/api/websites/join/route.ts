import { z } from "zod";
import { route, json, body, err } from "@/lib/api";
import { Invite, User, Website } from "@/lib/models";
import { publish } from "@/lib/bus";

export const POST = route(async (req, ctx) => {
  const { code } = await body(req, z.object({ code: z.string().max(64) }));
  const inv = await Invite.findOne({ code, expiresAt: { $gt: new Date() } }).lean();
  if (!inv || inv.uses >= inv.maxUses) return err("This invite link is invalid or expired.", 404);
  if (inv.email && inv.email !== ctx.user.email) return err("This invite was issued for a different email address.", 403);
  const already = await Website.exists({ _id: inv.website, "members.user": ctx.user.id });
  if (!already) {
    await Website.updateOne({ _id: inv.website }, { $push: { members: { user: ctx.user.id, role: inv.role } } });
    await Invite.updateOne({ _id: inv._id }, { $inc: { uses: 1 } });
    publish(`site:${inv.website}`, "team", { joined: ctx.user.id });
  }
  await User.updateOne({ _id: ctx.user.id }, { currentWebsite: inv.website });
  return json({ ok: true, website: String(inv.website) });
}, { noWebsite: true });
