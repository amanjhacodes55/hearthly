import { route, json } from "@/lib/api";
import { Invite, User, Website } from "@/lib/models";
import { onlineAgents } from "@/lib/bus";

export const GET = route(async (_req, ctx) => {
  const w = await Website.findById(ctx.website.id).select("members").lean();
  const users = await User.find({ _id: { $in: w!.members.map((m) => m.user) } }).select("name email image").lean();
  const online = onlineAgents(ctx.website.id);
  const invites = await Invite.find({ website: ctx.website.id, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  return json({
    me: ctx.user.id,
    role: ctx.website.role,
    members: w!.members.map((m) => {
      const u = users.find((x) => String(x._id) === String(m.user));
      return { id: String(m.user), name: u?.name || "Unknown", email: u?.email || "", image: u?.image || "", role: m.role, online: online.includes(String(m.user)), joinedAt: m.joinedAt };
    }),
    invites: invites.map((i) => ({ id: String(i._id), code: i.code, role: i.role, email: i.email, uses: i.uses, maxUses: i.maxUses, expiresAt: i.expiresAt })),
  });
});
