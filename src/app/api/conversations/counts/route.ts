import { Types } from "mongoose";
import { route, json } from "@/lib/api";
import { Conversation } from "@/lib/models";

export const GET = route(async (_req, ctx) => {
  const website = new Types.ObjectId(ctx.website.id);
  const me = new Types.ObjectId(ctx.user.id);
  const [open, pending, mine, unassigned, unread, snoozed] = await Promise.all([
    Conversation.countDocuments({ website, status: "open" }),
    Conversation.countDocuments({ website, status: "pending" }),
    Conversation.countDocuments({ website, status: "open", assignee: me }),
    Conversation.countDocuments({ website, status: "open", assignee: null }),
    Conversation.countDocuments({ website, status: { $ne: "resolved" }, unreadAgent: { $gt: 0 } }),
    Conversation.countDocuments({ website, snoozedUntil: { $gt: new Date() } }),
  ]);
  return json({ open, pending, mine, unassigned, unread, snoozed });
});
