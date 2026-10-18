import { route, json, err, oid } from "@/lib/api";
import { OAuthApp } from "@/lib/models";
import { rand, sha256 } from "@/lib/ids";

/** Rotate the client secret (old one stops working immediately). */
export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const clientSecret = `hly_cs_${rand(32)}`;
  const a = await OAuthApp.findOneAndUpdate({ _id: oid(id), owner: ctx.user.id }, { clientSecretHash: sha256(clientSecret) });
  return a ? json({ clientSecret }) : err("App not found", 404);
}, { noWebsite: true });
