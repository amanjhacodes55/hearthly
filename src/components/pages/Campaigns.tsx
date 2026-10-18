"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Empty, Field, ListSkeleton, Modal, PageHeader, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";

type Camp = { id: string; name: string; segment: string | null; channel: "chat" | "email" | "both"; subject: string; body: string; status: "draft" | "sending" | "sent"; stats: { sent: number; emailed: number; opened: number; replied: number }; sentAt?: string; createdAt: string };
type Seg = { id: string; name: string };
const blank = { name: "", segment: null as string | null, channel: "chat" as Camp["channel"], subject: "", body: "Hi {{first_name | there}} 👋 " };

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "—";
}

export default function Campaigns() {
  const toast = useToast();
  const { data, loading, reload } = useFetch<Camp[]>("/api/campaigns");
  const { data: segs } = useFetch<Seg[]>("/api/segments");
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const [sendTarget, setSendTarget] = useState<Camp | null>(null);
  const [preview, setPreview] = useState<{ total: number; withEmail: number; smtp: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPreview(null);
    if (sendTarget) void api<typeof preview>(`/api/campaigns/${sendTarget.id}/send`).then(setPreview);
  }, [sendTarget]);

  return (
    <div>
      <PageHeader
        icon={<Megaphone className="size-5" />}
        title="Campaigns"
        subtitle="Message a whole segment — in the chat widget, by email, or both."
        actions={
          <button className="btn-primary btn-sm" onClick={() => setEdit({ ...blank })}>
            <Plus className="size-3.5" /> New campaign
          </button>
        }
      />
      <div className="p-5 md:p-8">
        <div className="card overflow-hidden">
          {loading && !data ? (
            <ListSkeleton rows={3} />
          ) : !data?.length ? (
            <Empty icon={<Megaphone className="size-6" />} title="No campaigns yet" action={<button className="btn-primary btn-sm" onClick={() => setEdit({ ...blank })}>Create one</button>}>
              Announce a feature, nudge trials or follow up with VIPs. Replies land in your inbox as normal conversations.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2.5">Campaign</th>
                    <th className="px-4 py-2.5">Audience</th>
                    <th className="px-4 py-2.5 text-right">Sent</th>
                    <th className="px-4 py-2.5 text-right">Opened</th>
                    <th className="px-4 py-2.5 text-right">Replied</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted">
                          <span className={clsx("chip mr-1.5", c.status === "sent" && "!bg-brand-soft !text-brand-strong")}>{c.status}</span>
                          {c.channel === "both" ? "chat + email" : c.channel} · {c.sentAt ? `sent ${timeAgo(c.sentAt)}` : `created ${timeAgo(c.createdAt)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted">{segs?.find((s) => s.id === c.segment)?.name || "All contacts"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{c.stats.sent}</td>
                      <td className="px-4 py-3 text-right">
                        {c.stats.opened} <span className="text-xs text-faint">{pct(c.stats.opened, c.stats.sent)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.stats.replied} <span className="text-xs text-faint">{pct(c.stats.replied, c.stats.sent)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {c.status === "draft" && (
                            <>
                              <button className="btn-primary btn-sm" onClick={() => setSendTarget(c)}>
                                <Send className="size-3.5" /> Send
                              </button>
                              <button className="btn-ghost btn-sm !p-1.5" aria-label="Edit" onClick={() => setEdit({ id: c.id, name: c.name, segment: c.segment, channel: c.channel, subject: c.subject, body: c.body })}>
                                <Pencil className="size-4" />
                              </button>
                            </>
                          )}
                          <button className="btn-ghost btn-sm !p-1.5 text-danger" aria-label="Delete" onClick={async () => confirm(`Delete “${c.name}”?`) && (await api(`/api/campaigns/${c.id}`, { method: "DELETE" }), reload())}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit campaign" : "New campaign"}
        wide
        footer={
          <button
            className="btn-primary"
            disabled={!edit?.name.trim() || !edit?.body.trim()}
            onClick={async () => {
              const { id, ...b } = edit!;
              try {
                await api(id ? `/api/campaigns/${id}` : "/api/campaigns", { method: id ? "PATCH" : "POST", json: b });
                toast("Draft saved");
                setEdit(null);
                void reload();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Failed", "error");
              }
            }}
          >
            Save draft
          </button>
        }
      >
        {edit && (
          <div className="grid gap-4 md:grid-cols-[1fr_260px]">
            <div className="space-y-3">
              <Field label="Name (internal)">
                <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Audience">
                  <select className="input" value={edit.segment || ""} onChange={(e) => setEdit({ ...edit, segment: e.target.value || null })}>
                    <option value="">All contacts</option>
                    {(segs || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Channel">
                  <select className="input" value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value as Camp["channel"] })}>
                    <option value="chat">In-widget chat</option>
                    <option value="email">Email</option>
                    <option value="both">Chat + email</option>
                  </select>
                </Field>
              </div>
              {edit.channel !== "chat" && (
                <Field label="Email subject">
                  <input className="input" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
                </Field>
              )}
              <Field label="Message" hint="Variables: {{first_name | fallback}}, {{name}}, {{email}}, {{website}}, {{agent}}">
                <textarea className="input min-h-36" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
              </Field>
            </div>
            <div>
              <p className="label">Preview</p>
              <div className="rounded-2xl border border-border bg-surface-2 p-3">
                <div className="rounded-xl bg-gradient-to-br from-ember-500 to-ember-700 px-3 py-2 text-xs font-semibold text-white">Chat with us</div>
                <p className="mt-3 whitespace-pre-wrap rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-sm">{edit.body.replace(/\{\{\s*first_name\s*\|\s*([^}]*)\}\}/g, "Maya").replace(/\{\{\s*\w+\s*(\|[^}]*)?\}\}/g, "…")}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(sendTarget)}
        onClose={() => setSendTarget(null)}
        title={`Send “${sendTarget?.name}”?`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setSendTarget(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || !preview?.total}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api<{ sent: number; emailed: number; emailMode: string }>(`/api/campaigns/${sendTarget!.id}/send`, { method: "POST" });
                  toast(`Sent to ${r.sent} contact(s)${r.emailed ? ` · ${r.emailed} emails ${r.emailMode === "smtp" ? "sent" : "logged (no SMTP)"}` : ""}`);
                  setSendTarget(null);
                  void reload();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Failed", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Send className="size-4" /> {busy ? "Sending…" : "Send now"}
            </button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-2 text-sm">
            <p>
              This will reach <b>{preview.total}</b> contact(s){sendTarget?.channel !== "chat" && <> — {preview.withEmail} have an email address</>}.
            </p>
            {sendTarget?.channel !== "chat" && !preview.smtp && <p className="rounded-xl bg-warn/10 p-3 text-xs">SMTP isn&apos;t configured (set SMTP_URL) — emails will be logged to the server console instead of sent.</p>}
            <p className="text-xs text-muted">In-widget messages appear the next time each contact visits; replies become conversations in your inbox.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Counting recipients…</p>
        )}
      </Modal>
    </div>
  );
}
