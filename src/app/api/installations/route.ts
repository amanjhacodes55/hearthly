import { route, json } from "@/lib/api";
import { Installation, OAuthApp, User } from "@/lib/models";

/** Third-party apps authorized on the current website. */
export const GET = route(async (_req, ctx) => {
  const list = await Installation.find({ website: ctx.website.id, revokedAt: null }).sort({ createdAt: -1 }).lean();
  const apps = await OAuthApp.find({ _id: { $in: list.map((i) => i.app) } }).select("name description homepage logo").lean();
  const users = await User.find({ _id: { $in: list.map((i) => i.installedBy) } }).select("name").lean();
  return json(
    list.map((i) => {
      const a = apps.find((x) => String(x._id) === String(i.app));
      return { id: String(i._id), app: a ? { name: a.name, description: a.description, homepage: a.homepage, logo: a.logo } : null, scopes: i.scopes, installedBy: users.find((u) => String(u._id) === String(i.installedBy))?.name || "", createdAt: i.createdAt, lastUsedAt: i.lastUsedAt };
    }),
  );
});
