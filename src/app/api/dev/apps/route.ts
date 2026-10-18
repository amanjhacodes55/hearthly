import { route, json, body, err } from "@/lib/api";
import { OAuthApp, Installation } from "@/lib/models";
import { rand, sha256, shortId } from "@/lib/ids";
import { appInput } from "@/lib/devplatform";

export const GET = route(async (_req, ctx) => {
  const apps = await OAuthApp.find({ owner: ctx.user.id }).sort({ createdAt: -1 }).lean();
  const counts = await Installation.aggregate([{ $match: { app: { $in: apps.map((a) => a._id) }, revokedAt: null } }, { $group: { _id: "$app", n: { $sum: 1 } } }]);
  return json(apps.map((a) => ({ id: String(a._id), name: a.name, description: a.description, homepage: a.homepage, logo: a.logo, clientId: a.clientId, redirectUris: a.redirectUris, scopes: a.scopes, installs: counts.find((c) => String(c._id) === String(a._id))?.n || 0, createdAt: a.createdAt })));
}, { noWebsite: true });

/** Register an OAuth app. The client secret is shown once. */
export const POST = route(async (req, ctx) => {
  const b = await body(req, appInput);
  if ((await OAuthApp.countDocuments({ owner: ctx.user.id })) >= 20) return err("Limit of 20 apps per developer");
  const clientSecret = `hly_cs_${rand(32)}`;
  const app = await OAuthApp.create({ ...b, owner: ctx.user.id, clientId: `hly_app_${shortId(16)}`, clientSecretHash: sha256(clientSecret) });
  return json({ id: String(app._id), clientId: app.clientId, clientSecret }, 201);
}, { noWebsite: true });
