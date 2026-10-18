import "server-only";
import { OAuthApp, OAuthToken } from "@/lib/models";
import { rand, safeEqual, sha256 } from "@/lib/ids";

export const ACCESS_TTL = 3600;
export const REFRESH_TTL = 90 * 86400;

/** Client authentication: HTTP Basic or client_id/client_secret in the body. */
export async function authenticateClient(req: Request, b: Record<string, string>) {
  let clientId = b.client_id;
  let clientSecret = b.client_secret;
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    const [id, sec] = Buffer.from(auth.slice(6), "base64").toString().split(":");
    clientId = decodeURIComponent(id || "");
    clientSecret = decodeURIComponent(sec || "");
  }
  if (!clientId) return { app: null, authenticated: false };
  const app = await OAuthApp.findOne({ clientId }).select("+clientSecretHash").lean();
  if (!app) return { app: null, authenticated: false };
  if (clientSecret) {
    if (!app.clientSecretHash || !safeEqual(app.clientSecretHash, sha256(clientSecret))) return { app: null, authenticated: false, bad: true };
    return { app, authenticated: true };
  }
  return { app, authenticated: false };
}

export async function issueTokens(o: { installation: unknown; app: unknown; website: unknown; scopes: string[] }) {
  const access = `hly_at_${rand(32)}`;
  const refresh = `hly_rt_${rand(32)}`;
  await OAuthToken.create({
    installation: o.installation,
    app: o.app,
    website: o.website,
    accessHash: sha256(access),
    refreshHash: sha256(refresh),
    scopes: o.scopes,
    expiresAt: new Date(Date.now() + ACCESS_TTL * 1000),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope: o.scopes.join(" "), website_id: String(o.website) };
}

/** Parse a token endpoint body (form-encoded per spec, JSON accepted too). */
export async function readForm(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  const text = (await req.text()).slice(0, 10_000);
  if (ct.includes("json")) {
    try {
      const j = JSON.parse(text);
      return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}
