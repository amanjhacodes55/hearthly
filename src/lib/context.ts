import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { sessionUserId } from "@/lib/auth";
import { User, Website, type Role } from "@/lib/models";

export type Ctx = {
  user: { id: string; name: string; email: string; image: string; theme: string };
  website: { id: string; publicId: string; name: string; role: Role };
};

/** Signed-in user + their current website (website.id is "" if they have none yet). Memoized per request, so layout + page share one lookup. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const uid = await sessionUserId();
  if (!uid) return null;
  await dbConnect();
  const u = await User.findById(uid).lean();
  if (!u) return null;
  let ws = u.currentWebsite ? await Website.findOne({ _id: u.currentWebsite, "members.user": u._id }).select("name publicId members").lean() : null;
  if (!ws) {
    ws = await Website.findOne({ "members.user": u._id }).sort({ createdAt: 1 }).select("name publicId members").lean();
    if (ws) await User.updateOne({ _id: u._id }, { currentWebsite: ws._id });
  }
  const user = { id: String(u._id), name: u.name, email: u.email, image: u.image || "", theme: u.theme || "system" };
  if (!ws) return { user, website: { id: "", publicId: "", name: "", role: "agent" } };
  const role = (ws.members.find((m) => String(m.user) === user.id)?.role || "agent") as Role;
  return { user, website: { id: String(ws._id), publicId: ws.publicId, name: ws.name, role } };
});

export async function requireCtx(next = "/app"): Promise<Ctx> {
  const c = await getCtx();
  if (!c) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!c.website.id) redirect("/onboarding");
  return c;
}

export const canAdmin = (r: Role) => r === "owner" || r === "admin";
