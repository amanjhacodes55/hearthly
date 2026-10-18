import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import { dbConnect } from "@/lib/db";
import { OAuthApp, Website } from "@/lib/models";
import { OAUTH_SCOPES, parseScopes, validRedirect } from "@/lib/oauth";
import { Logo } from "@/components/ui";
import OAuthConsent from "@/components/dev/OAuthConsent";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authorize app" };

export default async function Authorize({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(sp).toString();
  const ctx = await getCtx();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  await dbConnect();
  const app = sp.client_id ? await OAuthApp.findOne({ clientId: sp.client_id }).lean() : null;
  const fail = (msg: string) => (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md p-6 text-center">
        <Logo className="justify-center" />
        <p className="mt-4 font-semibold text-danger">{msg}</p>
        <p className="mt-2 text-sm text-muted">For safety we can&apos;t redirect you back to the app.</p>
      </div>
    </div>
  );
  if (!app) return fail("Unknown client_id.");
  // Never redirect to an unregistered URI (open-redirect protection).
  if (!validRedirect(app.redirectUris, sp.redirect_uri)) return fail("redirect_uri is not registered for this app.");
  const back = new URL(sp.redirect_uri);
  if (sp.state) back.searchParams.set("state", sp.state);
  if (sp.response_type && sp.response_type !== "code") {
    back.searchParams.set("error", "unsupported_response_type");
    redirect(back.toString());
  }
  const scopes = parseScopes(sp.scope, app.scopes);
  if (!scopes) {
    back.searchParams.set("error", "invalid_scope");
    redirect(back.toString());
  }
  if (sp.code_challenge_method && !["S256", "plain"].includes(sp.code_challenge_method)) {
    back.searchParams.set("error", "invalid_request");
    redirect(back.toString());
  }
  const sites = await Website.find({ members: { $elemMatch: { user: ctx.user.id, role: { $in: ["owner", "admin"] } } } }).select("name publicId").lean();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(800px_400px_at_50%_-10%,var(--brand-soft),transparent)] p-4">
      <OAuthConsent
        app={{ name: app.name, description: app.description, homepage: app.homepage, logo: app.logo }}
        scopes={scopes!.map((s) => ({ id: s, label: OAUTH_SCOPES[s as keyof typeof OAUTH_SCOPES] || s }))}
        websites={sites.map((w) => ({ id: String(w._id), name: w.name }))}
        current={ctx.website.id}
        params={{ client_id: sp.client_id, redirect_uri: sp.redirect_uri, scope: scopes!.join(" "), state: sp.state || "", code_challenge: sp.code_challenge || "", code_challenge_method: sp.code_challenge ? sp.code_challenge_method || "plain" : "" }}
        user={ctx.user.email}
      />
    </div>
  );
}
