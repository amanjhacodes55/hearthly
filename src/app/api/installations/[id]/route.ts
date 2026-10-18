import { route, json, err, oid } from "@/lib/api";
import { Installation, OAuthToken, Webhook } from "@/lib/models";

/** Uninstall: revoke all tokens and remove the webhooks the app created. */
export const DELETE = route<{ id: string }>(async (_req, ctx, { id }) => {
  const i = await Installation.findOneAndUpdate({ _id: oid(id), website: ctx.website.id, revokedAt: null }, { revokedAt: new Date() });
  if (!i) return err("Not found", 404);
  await OAuthToken.updateMany({ installation: i._id }, { revokedAt: new Date() });
  await Webhook.deleteMany({ installation: i._id });
  return json({ ok: true });
}, { role: "admin" });
