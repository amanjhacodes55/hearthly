"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { Field, Skeleton } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { CodeBlock } from "@/components/settings/WebsiteSettings";
import { SCOPES } from "./DevApps";

type App = { id: string; name: string; description: string; homepage: string; logo: string; clientId: string; redirectUris: string[]; scopes: string[] };

export default function AppDetail({ id }: { id: string }) {
  const toast = useToast();
  const router = useRouter();
  const { data } = useFetch<App>(`/api/dev/apps/${id}`);
  const [f, setF] = useState<(App & { uris: string }) | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (data) setF({ ...data, uris: data.redirectUris.join("\n") });
  }, [data]);
  if (!f) return <Skeleton className="m-8 h-96" />;
  const authUrl = `${origin}/oauth/authorize?response_type=code&client_id=${f.clientId}&redirect_uri=${encodeURIComponent(f.redirectUris[0] || "")}&scope=${encodeURIComponent(f.scopes.join(" "))}&state=xyz&code_challenge=<S256(verifier)>&code_challenge_method=S256`;
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-5 md:p-8">
      <Link href="/developers" className="btn-ghost btn-sm">
        <ArrowLeft className="size-4" /> Developers
      </Link>
      <div className="card p-5">
        <h1 className="h-display text-2xl font-bold">{f.name}</h1>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CodeBlock label="client_id" code={f.clientId} />
          <div>
            <p className="label">client_secret</p>
            {secret ? <CodeBlock code={secret} /> : <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">Hidden (stored hashed)</p>}
            <button className="btn-outline btn-sm mt-2" onClick={async () => { if (!confirm("Rotate the client secret? The old one stops working immediately.")) return; const r = await api<{ clientSecret: string }>(`/api/dev/apps/${id}/secret`, { method: "POST" }); setSecret(r.clientSecret); }}>
              <RefreshCw className="size-3.5" /> Rotate secret
            </button>
          </div>
        </div>
      </div>
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Homepage">
            <input className="input" value={f.homepage} onChange={(e) => setF({ ...f, homepage: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Redirect URIs (one per line)">
              <textarea className="input font-mono text-sm" value={f.uris} onChange={(e) => setF({ ...f, uris: e.target.value })} />
            </Field>
          </div>
        </div>
        <fieldset>
          <legend className="label">Scopes</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {Object.keys(SCOPES).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.scopes.includes(s)} onChange={(e) => setF({ ...f, scopes: e.target.checked ? [...f.scopes, s] : f.scopes.filter((x) => x !== s) })} />
                <code className="font-mono text-xs">{s}</code>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={async () => { try { await api(`/api/dev/apps/${id}`, { method: "PATCH", json: { name: f.name, description: f.description, homepage: f.homepage, redirectUris: f.uris.split(/\s+/).filter(Boolean), scopes: f.scopes } }); toast("Saved"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
            Save
          </button>
          <button className="btn-outline ml-auto text-danger" onClick={async () => { if (!confirm("Delete this app? All installations are revoked.")) return; await api(`/api/dev/apps/${id}`, { method: "DELETE" }); router.push("/developers"); }}>
            <Trash2 className="size-4" /> Delete app
          </button>
        </div>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="font-bold">Authorization flow</h2>
        <CodeBlock label="1 · Send the user to" code={authUrl} />
        <CodeBlock
          label="2 · Exchange the code (server-side)"
          code={`curl -X POST ${origin}/api/oauth/token \\
  -d grant_type=authorization_code -d code=$CODE \\
  -d redirect_uri=${f.redirectUris[0] || "<redirect_uri>"} \\
  -d client_id=${f.clientId} -d client_secret=$CLIENT_SECRET   # or code_verifier=… for PKCE public clients`}
        />
        <CodeBlock label="3 · Call the API" code={`curl ${origin}/api/v1/website -H "Authorization: Bearer $ACCESS_TOKEN"`} />
        <p className="text-sm text-muted">
          A full runnable example lives in <code className="kbd">examples/oauth-node</code> in the repository.
        </p>
      </div>
    </div>
  );
}
