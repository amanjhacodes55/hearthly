"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Code2, KeyRound, Plus, Webhook } from "lucide-react";
import { Avatar, Empty, Field, Modal, PageHeader, Skeleton, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { CodeBlock } from "@/components/settings/WebsiteSettings";

type App = { id: string; name: string; description: string; logo: string; clientId: string; redirectUris: string[]; scopes: string[]; installs: number; createdAt: string };
export const SCOPES: Record<string, string> = {
  "conversations:read": "Read conversations and messages",
  "conversations:write": "Update conversations",
  "messages:write": "Send messages / inbound channel",
  "contacts:read": "Read contacts",
  "contacts:write": "Create & update contacts",
  "webhooks:manage": "Manage webhooks",
  "website:read": "Read website info",
};

export default function DevApps() {
  const toast = useToast();
  const { data, reload } = useFetch<App[]>("/api/dev/apps");
  const [form, setForm] = useState<{ name: string; description: string; homepage: string; redirectUris: string; scopes: string[] } | null>(null);
  const [creds, setCreds] = useState<{ clientId: string; clientSecret: string; id: string } | null>(null);
  return (
    <div>
      <PageHeader
        icon={<Code2 className="size-5" />}
        title="Developers"
        subtitle="Build integrations: REST API, signed webhooks and OAuth apps other teams can install."
        actions={
          <>
            <Link href="/developers/docs" className="btn-outline btn-sm">
              <BookOpen className="size-3.5" /> API docs
            </Link>
            <button className="btn-primary btn-sm" onClick={() => (setForm({ name: "", description: "", homepage: "", redirectUris: "http://localhost:4000/callback", scopes: ["conversations:read", "messages:write"] }), setCreds(null))}>
              <Plus className="size-3.5" /> New OAuth app
            </button>
          </>
        }
      />
      <div className="space-y-6 p-5 md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: KeyRound, t: "API keys", d: "For your own backend scripts.", href: "/app/settings/api-keys" },
            { icon: Webhook, t: "Webhooks", d: "Signed events with retries + logs.", href: "/app/settings/webhooks" },
            { icon: BookOpen, t: "Docs & examples", d: "curl, Node & Python snippets.", href: "/developers/docs" },
          ].map((c) => (
            <Link key={c.t} href={c.href} className="card flex items-start gap-3 p-4 transition hover:border-brand/50">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <c.icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{c.t}</span>
                <span className="text-sm text-muted">{c.d}</span>
              </span>
            </Link>
          ))}
        </div>
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-faint">Your OAuth apps</h2>
          <div className="card">
            {!data ? (
              <Skeleton className="m-4 h-20" />
            ) : !data.length ? (
              <Empty icon={<Code2 className="size-6" />} title="No apps yet">Register an app to let any Hearthly workspace install your integration via OAuth 2.0 (authorization code + PKCE).</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {data.map((a) => (
                  <li key={a.id}>
                    <Link href={`/developers/apps/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                      <Avatar name={a.name} image={a.logo} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{a.name}</span>
                        <span className="block truncate text-xs text-muted">
                          <code className="font-mono">{a.clientId}</code> · {a.installs} install{a.installs === 1 ? "" : "s"} · created {timeAgo(a.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={creds ? "App created" : "Register an OAuth app"}
        wide
        footer={
          creds ? (
            <Link className="btn-primary" href={`/developers/apps/${creds.id}`}>
              Open app
            </Link>
          ) : (
            <button
              className="btn-primary"
              disabled={!form?.name || !form.scopes.length}
              onClick={async () => {
                try {
                  const r = await api<{ id: string; clientId: string; clientSecret: string }>("/api/dev/apps", { method: "POST", json: { ...form, redirectUris: form!.redirectUris.split(/\s+/).filter(Boolean) } });
                  setCreds(r);
                  void reload();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Failed", "error");
                }
              }}
            >
              Create app
            </button>
          )
        }
      >
        {creds ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-warn/10 p-3 text-sm">Copy the client secret now — it&apos;s stored hashed and won&apos;t be shown again (you can rotate it).</p>
            <CodeBlock label="client_id" code={creds.clientId} />
            <CodeBlock label="client_secret" code={creds.clientSecret} />
          </div>
        ) : (
          form && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="App name">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Slack Bridge" />
              </Field>
              <Field label="Homepage">
                <input className="input" value={form.homepage} onChange={(e) => setForm({ ...form, homepage: e.target.value })} placeholder="https://…" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Description">
                  <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Redirect URIs (one per line)" hint="Exact match. https required, except http://localhost for development.">
                  <textarea className="input font-mono text-sm" value={form.redirectUris} onChange={(e) => setForm({ ...form, redirectUris: e.target.value })} />
                </Field>
              </div>
              <fieldset className="md:col-span-2">
                <legend className="label">Scopes the app may request</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(SCOPES).map(([s, d]) => (
                    <label key={s} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={form.scopes.includes(s)} onChange={(e) => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, s] : form.scopes.filter((x) => x !== s) })} />
                      <span>
                        <code className="font-mono text-xs">{s}</code>
                        <span className="block text-xs text-faint">{d}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
