"use client";
import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Avatar, LogoMark } from "@/components/ui";
import { api } from "@/lib/client";

export default function OAuthConsent({ app, scopes, websites, current, params, user }: { app: { name: string; description: string; homepage: string; logo: string }; scopes: { id: string; label: string }[]; websites: { id: string; name: string }[]; current: string; params: Record<string, string>; user: string }) {
  const [site, setSite] = useState(websites.some((w) => w.id === current) ? current : websites[0]?.id || "");
  const [busy, setBusy] = useState<"" | "allow" | "deny">("");
  const [error, setError] = useState("");
  async function decide(decision: "allow" | "deny") {
    setBusy(decision);
    setError("");
    try {
      const r = await api<{ redirect: string }>("/api/oauth/authorize", { method: "POST", json: { ...params, website_id: site, decision } });
      window.location.href = r.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy("");
    }
  }
  return (
    <div className="card animate-pop w-full max-w-md p-7">
      <div className="flex items-center justify-center gap-3">
        <Avatar name={app.name} image={app.logo} size={52} />
        <span className="text-2xl text-faint">⇄</span>
        <LogoMark size={52} />
      </div>
      <h1 className="h-display mt-5 text-center text-xl font-bold">
        {app.name} wants access to your Hearthly workspace
      </h1>
      {app.description && <p className="mt-1 text-center text-sm text-muted">{app.description}</p>}
      {!websites.length ? (
        <p className="mt-6 rounded-xl bg-warn/10 p-3 text-sm">You need to be an owner or admin of a website to install apps.</p>
      ) : (
        <>
          <label className="mt-6 block">
            <span className="label">Install on website</span>
            <select className="input" value={site} onChange={(e) => setSite(e.target.value)}>
              {websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <p className="label mt-5">This app will be able to:</p>
          <ul className="space-y-2">
            {scopes.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>
                  {s.label} <code className="ml-1 font-mono text-[10px] text-faint">{s.id}</code>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-7 flex gap-2">
        <button className="btn-outline flex-1" disabled={Boolean(busy)} onClick={() => decide("deny")}>
          {busy === "deny" && <Loader2 className="size-4 animate-spin" />} Cancel
        </button>
        <button className="btn-primary flex-1" disabled={Boolean(busy) || !site} onClick={() => decide("allow")}>
          {busy === "allow" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Authorize
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-faint">
        Signed in as {user}. You&apos;ll be redirected to {new URL(params.redirect_uri).host}. Revoke any time in Settings → Installed apps.
      </p>
    </div>
  );
}
