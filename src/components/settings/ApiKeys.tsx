"use client";
import { useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Empty, Field, Modal, Skeleton, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card } from "./SettingsSection";
import { CodeBlock } from "./WebsiteSettings";

const SCOPES = ["conversations:read", "conversations:write", "messages:write", "contacts:read", "contacts:write", "webhooks:manage", "website:read"];
type K = { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt?: string; createdAt: string };

export default function ApiKeys() {
  const toast = useToast();
  const { data, reload } = useFetch<K[]>("/api/apikeys");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["conversations:read", "messages:write", "contacts:read"]);
  const [created, setCreated] = useState<string | null>(null);
  if (!data) return <Skeleton className="h-48" />;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <>
      <Card
        title="API keys"
        description={<>Server-side keys for the REST API v1. Stored hashed — you see each key once. <Link href="/developers/docs" className="text-brand hover:underline">Read the docs →</Link></>}
        footer={
          <button className="btn-primary" onClick={() => (setOpen(true), setCreated(null), setName(""))}>
            <Plus className="size-4" /> Create key
          </button>
        }
      >
        {!data.length ? (
          <Empty icon={<KeyRound className="size-6" />} title="No API keys yet" />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{k.name}</span>
                  <span className="block text-xs text-muted">
                    <code className="font-mono">{k.prefix}…</code> · created {timeAgo(k.createdAt)} · {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : "never used"}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="chip font-mono !text-[10px]">
                        {s}
                      </span>
                    ))}
                  </span>
                </span>
                <button className="btn-ghost btn-sm text-danger" onClick={async () => confirm(`Revoke “${k.name}”? Apps using it stop working immediately.`) && (await api(`/api/apikeys/${k.id}`, { method: "DELETE" }), reload(), toast("Key revoked"))}>
                  <Trash2 className="size-4" /> Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={created ? "Your new API key" : "Create API key"} footer={created ? <button className="btn-primary" onClick={() => setOpen(false)}>Done</button> : <button className="btn-primary" disabled={!name.trim() || !scopes.length} onClick={async () => { try { const r = await api<{ key: string }>("/api/apikeys", { method: "POST", json: { name, scopes } }); setCreated(r.key); void reload(); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>Create</button>}>
        {created ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-warn/10 p-3 text-sm">Copy it now — it won&apos;t be shown again.</p>
            <CodeBlock code={created} />
            <CodeBlock label="Try it" code={`curl ${origin}/api/v1/conversations -H "Authorization: Bearer ${created}"`} />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier, internal CRM…" />
            </Field>
            <fieldset>
              <legend className="label">Scopes</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={scopes.includes(s)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
                    <code className="font-mono text-xs">{s}</code>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </Modal>
    </>
  );
}
