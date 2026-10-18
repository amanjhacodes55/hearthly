"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, Eye, Plus, RefreshCw, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { Empty, Field, Modal, Skeleton, Switch, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card } from "./SettingsSection";
import { CodeBlock } from "./WebsiteSettings";

type Hook = { id: string; url: string; events: string[]; description: string; active: boolean; secret_hint: string; created_via: string; failures: number; stats: Record<string, number> };
type Delivery = { id: string; event: string; status: string; attempts: number; nextAttemptAt: string | null; createdAt: string; payload: string; log: { at: string; status: number; durationMs: number; error: string; response: string; requestHeaders: Record<string, string> }[] };

export default function Webhooks() {
  const toast = useToast();
  const { data, reload } = useFetch<{ events: Record<string, string>; data: Hook[] }>("/api/webhooks");
  const [form, setForm] = useState<{ url: string; description: string; events: string[] } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [view, setView] = useState<Hook | null>(null);
  if (!data) return <Skeleton className="h-48" />;
  return (
    <>
      <Card
        title="Webhooks"
        description={<>Get an HTTPS POST for every event, signed with HMAC-SHA256 (<code className="kbd">Hearthly-Signature</code>). Failed deliveries retry with exponential backoff for ~12 hours. <Link className="text-brand hover:underline" href="/developers/docs#webhooks">Verification guide →</Link></>}
        footer={
          <button className="btn-primary" onClick={() => (setForm({ url: "", description: "", events: ["message.received", "conversation.created"] }), setSecret(null))}>
            <Plus className="size-4" /> Add endpoint
          </button>
        }
      >
        {!data.data.length ? (
          <Empty icon={<WebhookIcon className="size-6" />} title="No endpoints yet">Pipe chats into Slack, your CRM or a data warehouse.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((h) => (
              <li key={h.id}>
                <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => setView(h)}>
                  <span className={clsx("size-2.5 shrink-0 rounded-full", !h.active ? "bg-faint" : h.failures > 2 ? "bg-danger" : "bg-success")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm font-semibold">{h.url}</span>
                    <span className="block text-xs text-muted">
                      {h.events.length} event{h.events.length === 1 ? "" : "s"} · 7d: {h.stats.success || 0} ok, {h.stats.failed || 0} failed, {h.stats.pending || 0} retrying {h.created_via !== "dashboard" && `· via ${h.created_via}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={secret ? "Endpoint created" : "Add webhook endpoint"}
        footer={
          secret ? (
            <button className="btn-primary" onClick={() => setForm(null)}>Done</button>
          ) : (
            <button className="btn-primary" disabled={!form?.url || !form.events.length} onClick={async () => { try { const r = await api<{ secret: string }>("/api/webhooks", { method: "POST", json: form }); setSecret(r.secret); void reload(); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
              Create
            </button>
          )
        }
      >
        {secret ? (
          <div className="space-y-3">
            <p className="text-sm">Signing secret — store it in your receiver. You can reveal it again from the endpoint page.</p>
            <CodeBlock code={secret} />
          </div>
        ) : (
          form && (
            <div className="space-y-4">
              <Field label="Endpoint URL" hint="Public http(s) URL. Private/internal addresses are blocked (SSRF protection).">
                <input className="input font-mono" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/hearthly/webhook" />
              </Field>
              <Field label="Description">
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <fieldset>
                <legend className="label">Events</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(data.events).map(([e, d]) => (
                    <label key={e} className="flex items-start gap-2 text-sm" title={d}>
                      <input type="checkbox" className="mt-1" checked={form.events.includes(e)} onChange={(x) => setForm({ ...form, events: x.target.checked ? [...form.events, e] : form.events.filter((y) => y !== e) })} />
                      <span>
                        <code className="font-mono text-xs">{e}</code>
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
      {view && <HookDetail hook={view} events={data.events} onClose={() => (setView(null), reload())} />}
    </>
  );
}

function HookDetail({ hook, events, onClose }: { hook: Hook; events: Record<string, string>; onClose: () => void }) {
  const toast = useToast();
  const { data: deliveries, reload } = useFetch<Delivery[]>(`/api/webhooks/${hook.id}/deliveries`, { refreshMs: 5000 });
  const [h, setH] = useState(hook);
  const [secret, setSecret] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const patch = async (b: Record<string, unknown>) => {
    try {
      const r = await api<Hook & { secret?: string }>(`/api/webhooks/${hook.id}`, { method: "PATCH", json: b });
      setH({ ...h, ...r });
      if (r.secret) setSecret(r.secret);
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  };
  return (
    <Modal open onClose={onClose} title="Webhook endpoint" wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{h.url}</code>
          <button className="btn-outline btn-sm" onClick={async () => { const r = await api<{ status: string; log: Delivery["log"] }>(`/api/webhooks/${hook.id}/test`, { method: "POST" }); toast(r.status === "success" ? "Ping delivered ✓" : `Ping failed: ${r.log?.at(-1)?.error || "error"}`, r.status === "success" ? "success" : "error"); void reload(); }}>
            <Send className="size-3.5" /> Send test
          </button>
          <button className="btn-outline btn-sm" onClick={async () => { const r = await api<{ secret: string }>(`/api/webhooks/${hook.id}?reveal=1`); setSecret(r.secret); }}>
            <Eye className="size-3.5" /> Reveal secret
          </button>
          <button className="btn-outline btn-sm" onClick={() => confirm("Rotate the signing secret?") && patch({ rotateSecret: true })}>
            <RefreshCw className="size-3.5" /> Rotate
          </button>
          <button className="btn-outline btn-sm text-danger" onClick={async () => { if (!confirm("Delete this endpoint?")) return; await api(`/api/webhooks/${hook.id}`, { method: "DELETE" }); onClose(); }}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
        {secret && <CodeBlock code={secret} label="Signing secret" />}
        <Switch checked={h.active} onChange={(v) => patch({ active: v })} label="Active" />
        <div>
          <p className="label">Subscribed events</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(events).map((e) => (
              <button key={e} onClick={() => patch({ events: h.events.includes(e) ? h.events.filter((x) => x !== e) : [...h.events, e] })} className={clsx("chip font-mono", h.events.includes(e) && "!border-brand !bg-brand-soft !text-brand-strong")}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Recent deliveries (auto-refreshing)</p>
          <div className="divide-y divide-border rounded-xl border border-border">
            {!deliveries?.length && <p className="p-4 text-sm text-faint">No deliveries yet. Send a test or wait for an event.</p>}
            {deliveries?.map((d) => {
              const last = d.log.at(-1);
              return (
                <div key={d.id}>
                  <button className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                    <span className={clsx("rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase", d.status === "success" ? "bg-success/15 text-success" : d.status === "failed" ? "bg-danger/15 text-danger" : "bg-warn/15 text-warn")}>{d.status}</span>
                    <code className="font-mono text-xs">{d.event}</code>
                    <span className="ml-auto text-xs text-faint">
                      {last ? `HTTP ${last.status || "—"} · ${last.durationMs}ms · ` : ""}
                      {d.attempts} attempt{d.attempts === 1 ? "" : "s"} · {timeAgo(d.createdAt)}
                      {d.nextAttemptAt && ` · retry ${timeAgo(d.nextAttemptAt).replace(" ago", "")}`}
                    </span>
                  </button>
                  {open === d.id && (
                    <div className="space-y-2 bg-surface-2/60 p-3">
                      <button className="btn-outline btn-sm" onClick={async () => { const r = await api<{ status: string }>(`/api/webhooks/deliveries/${d.id}/redeliver`, { method: "POST" }); toast(`Redelivered: ${r.status}`); void reload(); }}>
                        <RefreshCw className="size-3.5" /> Redeliver
                      </button>
                      <CodeBlock label="Request body" code={JSON.stringify(JSON.parse(d.payload || "{}"), null, 2)} />
                      {d.log.map((l, i) => (
                        <div key={i} className="rounded-lg border border-border bg-surface p-2 text-xs">
                          <p className="font-semibold">
                            Attempt {i + 1} · {new Date(l.at).toLocaleString()} · HTTP {l.status || "—"} · {l.durationMs}ms {l.error && <span className="text-danger">· {l.error}</span>}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-muted">{Object.entries(l.requestHeaders || {}).map(([k, v]) => `${k}: ${v}`).join("\n")}</p>
                          {l.response && <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[11px]">{l.response}</pre>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
