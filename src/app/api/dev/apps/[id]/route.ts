import { route, json, body, err, oid } from "@/lib/api";
import { Installation, OAuthApp, OAuthToken, Webhook } from "@/lib/models";
import { appInput } from "@/lib/devplatform";

type P = { id: string };
const own = (id: string, user: string) => OAuthApp.findOne({ _id: oid(id), owner: user });

export const GET = route<P>(async (_req, ctx, { id }) => {
  const a = await own(id, ctx.user.id).lean();
  if (!a) return err("App not found", 404);
  return json({ id: String(a._id), name: a.name, description: a.description, homepage: a.homepage, logo: a.logo, clientId: a.clientId, redirectUris: a.redirectUris, scopes: a.scopes, createdAt: a.createdAt });
}, { noWebsite: true });

export const PATCH = route<P>(async (req, ctx, { id }) => {
  const b = await body(req, appInput.partial());
  const a = await OAuthApp.findOneAndUpdate({ _id: oid(id), owner: ctx.user.id }, b, { new: true }).lean();
  return a ? json({ ok: true }) : err("App not found", 404);
}, { noWebsite: true });

export const DELETE = route<P>(async (_req, ctx, { id }) => {
  const a = await OAuthApp.findOneAndDelete({ _id: oid(id), owner: ctx.user.id });
  if (!a) return err("App not found", 404);
  const inst = await Installation.find({ app: a._id }).select("_id").lean();
  await Promise.all([Installation.updateMany({ app: a._id }, { revokedAt: new Date() }), OAuthToken.updateMany({ app: a._id }, { revokedAt: new Date() }), Webhook.deleteMany({ installation: { $in: inst.map((i) => i._id) } })]);
  return json({ ok: true });
}, { noWebsite: true });
