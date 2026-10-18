import { z } from "zod";
import { route, json, body, err } from "@/lib/api";
import { Installation, OAuthApp, OAuthCode, Website } from "@/lib/models";
import { parseScopes, validRedirect } from "@/lib/oauth";
import { rand, sha256 } from "@/lib/ids";

const schema = z.object({
  client_id: z.string().max(100),
  redirect_uri: z.string().max(500),
  scope: z.string().max(500).default(""),
  state: z.string().max(500).default(""),
  code_challenge: z.string().max(128).default(""),
  code_challenge_method: z.enum(["S256", "plain", ""]).default(""),
  website_id: z.string().regex(/^[a-f0-9]{24}$/),
  decision: z.enum(["allow", "deny"]),
});

/** Consent screen submit → issues a one-time authorization code (10 min) and returns the redirect URL. */
export const POST = route(async (req, ctx) => {
  const b = await body(req, schema);
  const app = await OAuthApp.findOne({ clientId: b.client_id }).lean();
  if (!app) return err("Unknown client_id", 400);
  if (!validRedirect(app.redirectUris, b.redirect_uri)) return err("redirect_uri is not registered for this app", 400);
  const back = new URL(b.redirect_uri);
  if (b.state) back.searchParams.set("state", b.state);
  if (b.decision === "deny") {
    back.searchParams.set("error", "access_denied");
    return json({ redirect: back.toString() });
  }
  const scopes = parseScopes(b.scope, app.scopes);
  if (!scopes) {
    back.searchParams.set("error", "invalid_scope");
    return json({ redirect: back.toString() });
  }
  const site = await Website.findOne({ _id: b.website_id, members: { $elemMatch: { user: ctx.user.id, role: { $in: ["owner", "admin"] } } } }).select("_id").lean();
  if (!site) return err("You must be an owner or admin of that website to install apps", 403);
  if (b.code_challenge && !/^[A-Za-z0-9\-._~]{43,128}$/.test(b.code_challenge)) return err("Invalid code_challenge");
  let inst = await Installation.findOne({ app: app._id, website: site._id, revokedAt: null });
  if (inst) {
    inst.scopes = [...new Set([...inst.scopes, ...scopes])];
    await inst.save();
  } else inst = await Installation.create({ app: app._id, website: site._id, installedBy: ctx.user.id, scopes });
  const code = `cc_code_${rand(24)}`;
  await OAuthCode.create({
    codeHash: sha256(code),
    app: app._id,
    clientId: app.clientId,
    installation: inst._id,
    redirectUri: b.redirect_uri,
    scopes,
    codeChallenge: b.code_challenge || undefined,
    codeChallengeMethod: b.code_challenge ? b.code_challenge_method || "plain" : undefined,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  back.searchParams.set("code", code);
  return json({ redirect: back.toString() });
});
