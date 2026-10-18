import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Installation, OAuthCode, OAuthToken } from "@/lib/models";
import { sha256 } from "@/lib/ids";
import { validateCodeExchange } from "@/lib/oauth";
import { authenticateClient, issueTokens, readForm } from "@/lib/oauthServer";
import { takeToken } from "@/lib/rateLimit";
import { clientIp } from "@/lib/api";

const oerr = (error: string, status = 400, description?: string) => NextResponse.json({ error, ...(description ? { error_description: description } : {}) }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * OAuth 2.0 token endpoint.
 *  - grant_type=authorization_code: code, redirect_uri, client_id, (client_secret | code_verifier for PKCE public clients)
 *  - grant_type=refresh_token: refresh_token, client_id (+ client_secret for confidential clients). Refresh tokens rotate.
 */
export async function POST(req: Request) {
  if (!takeToken(`token:${clientIp(req)}`, 30, 0.5).ok) return oerr("slow_down", 429);
  try {
    await dbConnect();
    const b = await readForm(req);
    const { app, authenticated, bad } = (await authenticateClient(req, b)) as Awaited<ReturnType<typeof authenticateClient>> & { bad?: boolean };
    if (!app || bad) return oerr("invalid_client", 401, "Unknown client or bad client_secret");

    if (b.grant_type === "authorization_code") {
      const code = await OAuthCode.findOne({ codeHash: sha256(b.code || "") }).lean();
      const problem = validateCodeExchange(
        code ? { clientId: code.clientId || "", redirectUri: code.redirectUri || "", expiresAt: code.expiresAt, used: code.used, codeChallenge: code.codeChallenge || undefined, codeChallengeMethod: code.codeChallengeMethod || undefined } : null,
        { clientId: app.clientId, redirectUri: b.redirect_uri, codeVerifier: b.code_verifier, clientAuthenticated: authenticated },
      );
      if (problem) return oerr(problem, problem === "invalid_client" ? 401 : 400);
      // single use: atomically flip `used`
      const claimed = await OAuthCode.findOneAndUpdate({ _id: code!._id, used: false }, { used: true });
      if (!claimed) return oerr("invalid_grant");
      const inst = await Installation.findOne({ _id: code!.installation, revokedAt: null }).lean();
      if (!inst) return oerr("invalid_grant", 400, "Installation was revoked");
      return NextResponse.json(await issueTokens({ installation: inst._id, app: app._id, website: inst.website, scopes: code!.scopes || [] }), { headers: { "Cache-Control": "no-store" } });
    }

    if (b.grant_type === "refresh_token") {
      const t = await OAuthToken.findOne({ refreshHash: sha256(b.refresh_token || ""), app: app._id }).lean();
      if (!t || t.revokedAt || (t.refreshExpiresAt && t.refreshExpiresAt < new Date())) return oerr("invalid_grant");
      const inst = await Installation.findOne({ _id: t.installation, revokedAt: null }).lean();
      if (!inst) return oerr("invalid_grant", 400, "Installation was revoked");
      await OAuthToken.updateOne({ _id: t._id }, { revokedAt: new Date() }); // rotation
      return NextResponse.json(await issueTokens({ installation: inst._id, app: app._id, website: inst.website, scopes: t.scopes || [] }), { headers: { "Cache-Control": "no-store" } });
    }
    return oerr("unsupported_grant_type");
  } catch (e) {
    console.error(e);
    return oerr("server_error", 500);
  }
}
