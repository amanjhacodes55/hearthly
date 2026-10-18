"use client";
import { useState } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import { Avatar, Field, Skeleton, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card, type SettingsCtx } from "./SettingsSection";

type Team = { me: string; role: string; members: { id: string; name: string; email: string; image: string; role: string; online: boolean; joinedAt: string }[]; invites: { id: string; code: string; role: string; email: string; uses: number; maxUses: number; expiresAt: string }[] };

export default function TeamSettings({ ctx }: { ctx: SettingsCtx }) {
  const toast = useToast();
  const { data, reload } = useFetch<Team>("/api/team");
  const [role, setRole] = useState("agent");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  if (!data) return <Skeleton className="h-64" />;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <>
      <Card title={`Team (${data.members.length})`} description="Owners and admins manage settings and developer tools; agents answer conversations.">
        <ul className="divide-y divide-border">
          {data.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Avatar name={m.name} image={m.image} size={36} online={m.online} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {m.name} {m.id === data.me && <span className="text-xs font-normal text-faint">(you)</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {m.email} · joined {timeAgo(m.joinedAt)}
                </span>
              </span>
              {m.role === "owner" || !ctx.admin ? (
                <span className="chip capitalize">{m.role}</span>
              ) : (
                <select className="input !w-auto !py-1 text-sm" value={m.role} aria-label={`Role of ${m.name}`} onChange={async (e) => { await api(`/api/team/${m.id}`, { method: "PATCH", json: { role: e.target.value } }); toast("Role updated"); void reload(); }}>
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                </select>
              )}
              {m.role !== "owner" && (ctx.admin || m.id === data.me) && (
                <button className="btn-ghost btn-sm !p-1.5 text-danger" aria-label={`Remove ${m.name}`} onClick={async () => { if (!confirm(m.id === data.me ? "Leave this website?" : `Remove ${m.name}?`)) return; await api(`/api/team/${m.id}`, { method: "DELETE" }); if (m.id === data.me) window.location.href = "/app"; else void reload(); }}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {ctx.admin && (
        <Card title="Invite teammates" description="Create a link (valid 7 days). Add an email to restrict it to that person — we'll email it if SMTP is configured.">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <Field label="Email (optional)">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
            </Field>
            <Field label="Role">
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <div className="flex items-end">
              <button className="btn-primary w-full" onClick={async () => { try { const r = await api<{ url: string }>("/api/invites", { method: "POST", json: { role, email } }); setLink(r.url); setEmail(""); void reload(); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
                <Link2 className="size-4" /> Create link
              </button>
            </div>
          </div>
          {link && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-soft p-3 text-sm">
              <code className="flex-1 truncate">{link}</code>
              <button className="btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Copied"))}>
                <Copy className="size-3.5" /> Copy
              </button>
            </div>
          )}
          {data.invites.length > 0 && (
            <ul className="mt-4 divide-y divide-border text-sm">
              {data.invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2 py-2">
                  <span className="chip capitalize">{i.role}</span>
                  <span className="flex-1 truncate text-muted">{i.email || `${origin}/join/${i.code}`}</span>
                  <span className="text-xs text-faint">
                    {i.uses}/{i.maxUses} used · expires {new Date(i.expiresAt).toLocaleDateString()}
                  </span>
                  <button className="btn-ghost btn-sm !p-1" aria-label="Revoke invite" onClick={async () => (await api(`/api/invites?id=${i.id}`, { method: "DELETE" }), reload())}>
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
