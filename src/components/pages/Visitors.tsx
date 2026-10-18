"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, MessageCircle, Radar, Smartphone, Tablet } from "lucide-react";
import { Avatar, Empty, ListSkeleton, Modal, PageHeader, flag } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useRealtimeEvent } from "@/components/Realtime";
import { api, useFetch } from "@/lib/client";
import type { SContact } from "@/lib/serialize";

type Live = SContact & { chatting: boolean };

function since(d: string | null | undefined) {
  if (!d) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function Visitors() {
  const { data, loading, setData, reload } = useFetch<Live[]>("/api/visitors/live", { refreshMs: 15_000 });
  const [, tick] = useState(0);
  const [target, setTarget] = useState<Live | null>(null);
  const [text, setText] = useState("");
  const toast = useToast();
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useRealtimeEvent((type, d) => {
    if (type !== "visitor") return;
    const v = d as SContact;
    setData((list) => {
      const l = list || [];
      const i = l.findIndex((x) => x.id === v.id);
      if (i >= 0) return l.map((x) => (x.id === v.id ? { ...x, ...v } : x));
      return [{ ...v, chatting: false }, ...l];
    });
  });
  const visitors = (data || []).filter((v) => Date.now() - new Date(v.last_seen_at || 0).getTime() < 90_000);
  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    visitors.forEach((v) => m.set(v.geo.country || "??", (m.get(v.geo.country || "??") || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visitors]);

  return (
    <div>
      <PageHeader
        icon={<Radar className="size-5" />}
        title="Live visitors"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {visitors.length} on your site right now
          </span>
        }
        actions={
          <button className="btn-outline btn-sm" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />
      <div className="p-5 md:p-8">
        {byCountry.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {byCountry.map(([c, n]) => (
              <span key={c} className="chip !px-3 !py-1 text-xs">
                {flag(c)} {c === "??" ? "Unknown" : c} · <b>{n}</b>
              </span>
            ))}
          </div>
        )}
        {loading && !data ? (
          <div className="card">
            <ListSkeleton />
          </div>
        ) : !visitors.length ? (
          <div className="card">
            <Empty icon={<Radar className="size-6" />} title="Nobody here right now">
              Install the widget on your site (Settings → Chat widget) — visitors show up here within seconds, with the page they&apos;re on.
            </Empty>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visitors.map((v) => (
              <div key={v.id} className="card animate-pop flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={v.name || v.email || "Visitor"} size={40} online />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.name || v.email || `Visitor #${v.id.slice(-5)}`}</p>
                    <p className="truncate text-xs text-muted">
                      {flag(v.geo.country)} {[v.geo.city, v.geo.country_name].filter(Boolean).join(", ") || "Unknown location"}
                    </p>
                  </div>
                  {v.device.type === "mobile" ? <Smartphone className="size-4 text-faint" /> : v.device.type === "tablet" ? <Tablet className="size-4 text-faint" /> : <Laptop className="size-4 text-faint" />}
                </div>
                <div className="rounded-xl bg-surface-2 px-3 py-2 text-xs">
                  <p className="text-faint">Viewing · {since(v.current_page?.since)}</p>
                  <p className="truncate font-medium" title={v.current_page?.url}>
                    {v.current_page?.title || v.current_page?.url || "—"}
                  </p>
                  <p className="truncate text-faint">{v.current_page?.url}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{v.device.browser} · {v.device.os}</span>
                  <span>· {v.sessions} visit{v.sessions === 1 ? "" : "s"}</span>
                  {v.referrer && <span className="truncate">· from {safeHost(v.referrer)}</span>}
                </div>
                <div className="mt-auto flex gap-2">
                  <button className="btn-primary btn-sm flex-1" onClick={() => (setTarget(v), setText(`Hi${v.name ? ` ${v.name.split(" ")[0]}` : ""} 👋 anything I can help you with on this page?`))}>
                    <MessageCircle className="size-3.5" /> {v.chatting ? "Message" : "Start chat"}
                  </button>
                  <button className="btn-outline btn-sm" onClick={() => router.push(`/app/contacts/${v.id}`)}>
                    Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`Message ${target?.name || "this visitor"}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setTarget(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!text.trim()}
              onClick={async () => {
                try {
                  const r = await api<{ conversation: { id: string } }>("/api/conversations", { method: "POST", json: { contactId: target!.id, text } });
                  toast("Message sent — it pops up in their widget");
                  router.push(`/app/inbox?c=${r.conversation.id}`);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Failed", "error");
                }
              }}
            >
              Send
            </button>
          </>
        }
      >
        <textarea className="input min-h-28" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
        <p className="mt-2 text-xs text-muted">The widget opens on their screen with your message.</p>
      </Modal>
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
