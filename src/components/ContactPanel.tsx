"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Activity, Clock, Copy, ExternalLink, Globe, Laptop, Mail, MapPin, MessageSquare, Monitor, Pencil, Phone, Plus, Smartphone, Sparkles, StickyNote, Tablet, Trash2, Building2, GitMerge } from "lucide-react";
import { Avatar, Skeleton, Tag, flag, shortTime, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useRealtimeEvent } from "@/components/Realtime";
import { api, useFetch } from "@/lib/client";
import type { SContact, SConversation } from "@/lib/serialize";

type Profile = {
  contact: SContact;
  notes: { id: string; text: string; author: string; at: string }[];
  pages: { url: string; path: string; title: string; referrer: string; at: string; duration: number }[];
  events: { name: string; props: Record<string, unknown>; at: string }[];
  conversations: SConversation[];
  duplicates: { id: string; name: string; email: string; lastSeenAt: string }[];
};

function localTime(tz: string) {
  try {
    return new Intl.DateTimeFormat([], { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date());
  } catch {
    return "";
  }
}

function Section({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-border px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-faint">
        {icon}
        <span className="flex-1">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ icon, children, title }: { icon: React.ReactNode; children: React.ReactNode; title?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1 text-sm" title={title}>
      <span className="mt-0.5 shrink-0 text-faint">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

function Editable({ value, placeholder, onSave, type = "text" }: { value: string; placeholder: string; onSave: (v: string) => Promise<void>; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (editing)
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(v.trim());
          setEditing(false);
        }}
      >
        <input autoFocus type={type} className="input !py-1 text-sm" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => setEditing(false)} aria-label={placeholder} />
      </form>
    );
  return (
    <button className="group flex w-full items-center gap-1 text-left" onClick={() => setEditing(true)}>
      <span className={clsx("truncate", !value && "text-faint")}>{value || placeholder}</span>
      <Pencil className="size-3 shrink-0 text-faint opacity-0 group-hover:opacity-100" />
    </button>
  );
}

const DeviceIcon = ({ type }: { type: string }) => (type === "mobile" ? <Smartphone className="size-4" /> : type === "tablet" ? <Tablet className="size-4" /> : <Laptop className="size-4" />);

export default function ContactPanel({ contactId, currentConversation, compact }: { contactId: string; currentConversation?: string; compact?: boolean }) {
  const { data, loading, reload, setData } = useFetch<Profile>(`/api/contacts/${contactId}`);
  const toast = useToast();
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  useRealtimeEvent((type, d) => {
    if ((type === "visitor" || type === "contact") && (d as SContact).id === contactId) setData((p) => (p ? { ...p, contact: d as SContact } : p));
    if (type === "visitor" && (d as SContact).id === contactId) void reload();
    if (type === "event" && (d as { contact_id: string }).contact_id === contactId) void reload();
  });

  async function patch(body: Record<string, unknown>) {
    try {
      await api(`/api/contacts/${contactId}`, { method: "PATCH", json: body });
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  if (loading && !data)
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (!data) return <p className="p-4 text-sm text-muted">Contact not found.</p>;
  const c = data.contact;
  const dataEntries = Object.entries(c.data || {});

  return (
    <div className="text-sm">
      <div className="flex flex-col items-center px-4 pb-4 pt-5 text-center">
        <Avatar name={c.name || c.email || "Visitor"} image={c.avatar} size={64} online={c.online} />
        <div className="mt-2 w-full text-base font-bold">
          <Editable value={c.name} placeholder="Add name" onSave={(v) => patch({ name: v })} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          {c.online ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" /> Online now
            </span>
          ) : (
            <span>Last seen {timeAgo(c.last_seen_at)}</span>
          )}
        </div>
        {!compact && (
          <Link href={`/app/contacts/${c.id}`} className="mt-2 text-xs font-semibold text-brand hover:underline">
            Open full profile →
          </Link>
        )}
      </div>

      <Section title="Contact" icon={<Mail className="size-3.5" />}>
        <Row icon={<Mail className="size-4" />}>
          <Editable value={c.email} placeholder="Add email" type="email" onSave={(v) => patch({ email: v })} />
        </Row>
        <Row icon={<Phone className="size-4" />}>
          <Editable value={c.phone} placeholder="Add phone" onSave={(v) => patch({ phone: v })} />
        </Row>
        <Row icon={<Building2 className="size-4" />}>
          <Editable value={c.company} placeholder="Add company" onSave={(v) => patch({ company: v })} />
        </Row>
        {data.duplicates.length > 0 && (
          <div className="mt-2 rounded-xl border border-warn/40 bg-warn/10 p-2.5 text-xs">
            <p className="font-semibold">{data.duplicates.length} other contact(s) share this email.</p>
            <button
              className="btn-outline btn-sm mt-2"
              onClick={async () => {
                await api(`/api/contacts/${c.id}/merge`, { method: "POST", json: {} });
                toast("Contacts merged");
                void reload();
              }}
            >
              <GitMerge className="size-3.5" /> Merge into this contact
            </button>
          </div>
        )}
      </Section>

      <Section title="Location & device" icon={<MapPin className="size-3.5" />}>
        <Row icon={<span className="text-base leading-none">{flag(c.geo.country)}</span>}>
          {[c.geo.city, c.geo.country_name].filter(Boolean).join(", ") || "Unknown location"}
          {c.geo.timezone && <span className="block text-xs text-faint">Local time {localTime(c.geo.timezone)} · {c.geo.timezone}</span>}
        </Row>
        {c.geo.locale && <Row icon={<Globe className="size-4" />}>Language: {c.geo.locale}</Row>}
        {c.device.browser && (
          <Row icon={<DeviceIcon type={c.device.type} />}>
            {c.device.browser} {c.device.browser_version} on {c.device.os} {c.device.os_version}
            <span className="block text-xs capitalize text-faint">{c.device.type}</span>
          </Row>
        )}
      </Section>

      {(c.current_page || c.referrer || c.utm.source) && (
        <Section title="Traffic" icon={<Monitor className="size-3.5" />}>
          {c.current_page && (
            <Row icon={<span className={clsx("mt-1 block size-2 rounded-full", c.online ? "animate-pulse bg-success" : "bg-faint")} />}>
              <span className="text-xs text-faint">{c.online ? "Viewing now" : "Last page"}</span>
              <a href={c.current_page.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-brand hover:underline">
                <span className="truncate">{c.current_page.title || c.current_page.url}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            </Row>
          )}
          {c.referrer && <Row icon={<ExternalLink className="size-4" />}>From {safeHost(c.referrer)}</Row>}
          {c.utm.source && (
            <Row icon={<Sparkles className="size-4" />}>
              utm: {[c.utm.source, c.utm.medium, c.utm.campaign].filter(Boolean).join(" / ")}
            </Row>
          )}
        </Section>
      )}

      <Section title="Activity" icon={<Activity className="size-3.5" />}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Sessions", c.sessions],
            ["Pages", c.page_views],
            ["Chats", data.conversations.length],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-surface-2 py-2">
              <div className="text-base font-bold">{v}</div>
              <div className="text-[10px] uppercase tracking-wide text-faint">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>First seen {timeAgo(c.first_seen_at)}</span>
          <span>Last seen {timeAgo(c.last_seen_at)}</span>
        </div>
      </Section>

      <Section title="Tags" icon={<span>#</span>}>
        <div className="flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <Tag key={t} name={t} onRemove={() => patch({ tags: c.tags.filter((x) => x !== t) })} />
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tag.trim()) void patch({ tags: [...new Set([...c.tags, tag.trim().toLowerCase()])] });
              setTag("");
            }}
          >
            <input className="w-24 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-[11px] outline-none focus:border-brand" placeholder="+ add tag" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Add tag" />
          </form>
        </div>
      </Section>

      {dataEntries.length > 0 && (
        <Section title="Custom data" icon={<span>{"{}"}</span>}>
          <dl className="space-y-1">
            {dataEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-xs">
                <dt className="font-mono text-faint">{k}</dt>
                <dd className="truncate font-medium">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {data.events.length > 0 && (
        <Section title="Events" icon={<Sparkles className="size-3.5" />}>
          <ul className="space-y-1.5">
            {data.events.slice(0, 8).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono font-semibold text-brand-strong">{e.name}</span>
                <span className="text-faint">{timeAgo(e.at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Pages visited" icon={<Clock className="size-3.5" />}>
        {data.pages.length ? (
          <ol className="relative space-y-2.5 border-l border-border pl-4">
            {data.pages.slice(0, compact ? 60 : 12).map((p, i) => (
              <li key={i} className="relative">
                <span className={clsx("absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-surface", i === 0 && c.online ? "bg-success" : "bg-surface-3")} />
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium hover:text-brand" title={p.url}>
                  {p.title || p.path}
                </a>
                <span className="block text-[11px] text-faint">
                  {p.path} · {shortTime(p.at)}
                  {p.duration ? ` · ${p.duration}s` : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-faint">No page views recorded.</p>
        )}
      </Section>

      <Section title="Conversations" icon={<MessageSquare className="size-3.5" />}>
        <ul className="space-y-1">
          {data.conversations.map((cv) => (
            <li key={cv.id}>
              <Link href={`/app/inbox?c=${cv.id}&status=all`} className={clsx("block rounded-lg px-2 py-1.5 text-xs hover:bg-surface-2", cv.id === currentConversation && "bg-brand-soft")}>
                <span className="flex items-center justify-between">
                  <span className="font-semibold capitalize">{cv.status}</span>
                  <span className="text-faint">{shortTime(cv.updated_at)}</span>
                </span>
                <span className="block truncate text-muted">{cv.last_message?.text || "—"}</span>
              </Link>
            </li>
          ))}
          {!data.conversations.length && <li className="text-xs text-faint">No conversations yet.</li>}
        </ul>
      </Section>

      <Section title="Notes" icon={<StickyNote className="size-3.5" />}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            void patch({ addNote: note.trim() });
            setNote("");
          }}
          className="flex gap-1.5"
        >
          <input className="input !py-1.5 text-xs" placeholder="Add a private note…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Add note" />
          <button className="btn-outline btn-sm" aria-label="Save note">
            <Plus className="size-3.5" />
          </button>
        </form>
        <ul className="mt-2 space-y-2">
          {data.notes
            .slice()
            .reverse()
            .map((n) => (
              <li key={n.id} className="group rounded-xl bg-amber-50 p-2.5 text-xs text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="whitespace-pre-wrap">{n.text}</p>
                <p className="mt-1 flex items-center justify-between text-[10px] opacity-70">
                  {n.author} · {timeAgo(n.at)}
                  <button aria-label="Delete note" className="opacity-0 group-hover:opacity-100" onClick={() => patch({ removeNote: n.id })}>
                    <Trash2 className="size-3" />
                  </button>
                </p>
              </li>
            ))}
        </ul>
      </Section>
      <div className="flex justify-center border-t border-border p-3">
        <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(c.id).then(() => toast("Contact id copied"))}>
          <Copy className="size-3.5" /> {c.id}
        </button>
      </div>
    </div>
  );
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
