"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Inbox as InboxIcon, Keyboard, Search, SlidersHorizontal, X } from "lucide-react";
import { Avatar, Empty, ListSkeleton, Modal, Tag, flag, shortTime } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useRealtime, useRealtimeEvent } from "@/components/Realtime";
import ContactPanel from "@/components/ContactPanel";
import Thread, { type Member, type Shortcut } from "@/components/inbox/Thread";
import { api, useFetch } from "@/lib/client";
import type { SContact, SConversation, SMessage } from "@/lib/serialize";

type Counts = { open: number; pending: number; mine: number; unassigned: number; unread: number; snoozed: number };
type Filters = { status: string; assigned: string; unread: boolean; tag: string; segment: string; q: string };

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "snoozed", label: "Snoozed" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

/** Does a live-updated conversation belong in the current list? `strict` also rejects server-only filters (search/segment) for items not already listed. */
function matchesFilter(c: SConversation, f: Filters, me: string, strict = true) {
  if (f.status === "snoozed") return Boolean(c.snoozed_until && new Date(c.snoozed_until) > new Date());
  if (f.status !== "all" && c.status !== f.status) return false;
  if (f.assigned === "me" && c.assignee_id !== me) return false;
  if (f.assigned === "unassigned" && c.assignee_id) return false;
  if (f.unread && !c.unread) return false;
  if (f.tag && !c.tags.includes(f.tag)) return false;
  if (strict && (f.segment || f.q)) return false; // server-side only filters: don't inject live items we can't verify
  return true;
}

export default function Inbox({ me, website }: { me: { id: string; name: string }; website: { id: string; name: string; publicId: string } }) {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const { connected } = useRealtime();
  const selected = sp.get("c");
  const [filters, setFilters] = useState<Filters>({ status: sp.get("status") || "open", assigned: "", unread: false, tag: "", segment: "", q: "" });
  const [q, setQ] = useState("");
  const [list, setList] = useState<SConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [conv, setConv] = useState<SConversation | null>(null);
  const [messages, setMessages] = useState<SMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [typing, setTyping] = useState<Record<string, { typing: boolean; preview: string; at: number }>>({});
  const [showProfile, setShowProfile] = useState(true);
  const [mobilePane, setMobilePane] = useState<"list" | "thread" | "profile">(selected ? "thread" : "list");
  const [help, setHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: counts, reload: reloadCounts } = useFetch<Counts>("/api/conversations/counts");
  const { data: team } = useFetch<{ members: Member[] }>("/api/team");
  const { data: shortcuts } = useFetch<Shortcut[]>("/api/shortcuts");
  const { data: site } = useFetch<{ tags: { name: string; color: string }[] }>("/api/websites/current");
  const { data: segments } = useFetch<{ id: string; name: string }[]>("/api/segments");
  const { online } = useRealtime();
  const members = useMemo(() => (team?.members || []).map((m) => ({ ...m, online: online.includes(m.id) })), [team, online]);
  const tags = site?.tags || [];

  const query = useMemo(() => {
    const p = new URLSearchParams({ status: filters.status, page: String(page) });
    if (filters.assigned) p.set("assigned", filters.assigned);
    if (filters.unread) p.set("unread", "1");
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.segment) p.set("segment", filters.segment);
    if (filters.q) p.set("q", filters.q);
    return p.toString();
  }, [filters, page]);

  const loadList = useCallback(async () => {
    try {
      const r = await api<{ data: SConversation[]; hasMore: boolean }>(`/api/conversations?${query}`);
      setList((prev) => (page === 1 ? r.data : [...prev.filter((p) => !r.data.some((d) => d.id === p.id)), ...r.data]));
      setHasMore(r.hasMore);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setListLoading(false);
    }
  }, [query, page, toast]);
  useEffect(() => {
    setListLoading(true);
    void loadList();
  }, [loadList]);
  useEffect(() => setPage(1), [filters]);
  // polling fallback when SSE is down
  useEffect(() => {
    if (connected) return;
    const t = setInterval(() => {
      void loadList();
      if (selected) void loadThread(selected, true);
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, loadList, selected]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === q ? f : { ...f, q })), 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadThread = useCallback(async (id: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      const r = await api<{ conversation: SConversation; messages: SMessage[] }>(`/api/conversations/${id}`);
      setConv(r.conversation);
      setMessages(r.messages);
      if (r.conversation.unread) {
        void api(`/api/conversations/${id}/read`, { method: "POST" }).then(() => reloadCounts());
        setList((l) => l.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      }
    } catch {
      setConv(null);
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, [reloadCounts]);
  useEffect(() => {
    if (selected) {
      setConv((c) => (c?.id === selected ? c : null));
      void loadThread(selected);
    } else {
      setConv(null);
      setMessages([]);
    }
  }, [selected, loadThread]);

  const open = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(sp.toString());
      if (id) p.set("c", id);
      else p.delete("c");
      router.replace(`/app/inbox?${p.toString()}`, { scroll: false });
      setMobilePane(id ? "thread" : "list");
    },
    [router, sp],
  );

  // realtime
  useRealtimeEvent((type, data) => {
    if (type === "message") {
      const { message, conversation } = data as { message: SMessage; conversation: SConversation };
      setList((l) => {
        const exists = l.some((c) => c.id === conversation.id);
        const merged = { ...conversation, unread: conversation.id === selected && !document.hidden ? 0 : conversation.unread };
        if (exists) return [merged, ...l.filter((c) => c.id !== conversation.id)].filter((c) => c.id === selected || c.id !== conversation.id || matchesFilter(c, filters, me.id, false));
        return matchesFilter(merged, filters, me.id) ? [merged, ...l] : l;
      });
      if (conversation.id === selected) {
        setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
        setConv((c) => (c ? { ...conversation, contact: conversation.contact || c.contact } : conversation));
        if (message.from === "visitor") {
          setTyping((t) => ({ ...t, [conversation.id]: { typing: false, preview: "", at: Date.now() } }));
          if (!document.hidden) void api(`/api/conversations/${conversation.id}/read`, { method: "POST" });
        }
      }
    }
    if (type === "conversation") {
      const c = data as SConversation;
      setList((l) => {
        const exists = l.some((x) => x.id === c.id);
        if (exists) return l.map((x) => (x.id === c.id ? { ...x, ...c, contact: c.contact || x.contact } : x)).filter((x) => x.id === selected || matchesFilter(x, filters, me.id, false));
        return matchesFilter(c, filters, me.id) && c.last_message ? [c, ...l] : l;
      });
      if (c.id === selected) setConv((x) => (x ? { ...x, ...c, contact: c.contact || x.contact } : c));
      reloadCounts();
    }
    if (type === "conversation.deleted") {
      const { id } = data as { id: string };
      setList((l) => l.filter((c) => c.id !== id));
      if (id === selected) open(null);
    }
    if (type === "conversation.woke") void loadList();
    if (type === "typing") {
      const d = data as { conversation_id: string; who: string; typing: boolean; preview?: string };
      if (d.who === "visitor") setTyping((t) => ({ ...t, [d.conversation_id]: { typing: d.typing, preview: d.preview || "", at: Date.now() } }));
    }
    if (type === "read") {
      const d = data as { conversation_id: string; who: string; at: string };
      if (d.who === "visitor" && d.conversation_id === selected) setConv((c) => (c ? { ...c, visitor_read_at: d.at, visitor_unread: 0 } : c));
    }
    if (type === "visitor" || type === "contact") {
      const ct = data as SContact;
      setList((l) => l.map((c) => (c.contact_id === ct.id ? { ...c, contact: ct } : c)));
      setConv((c) => (c && c.contact_id === ct.id ? { ...c, contact: ct } : c));
    }
  });
  // expire stale typing indicators
  useEffect(() => {
    const t = setInterval(() => setTyping((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v.typing && Date.now() - v.at < 7000))), 3000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!conv) return;
      try {
        const c = await api<SConversation>(`/api/conversations/${conv.id}`, { method: "PATCH", json: patch });
        setConv((x) => (x ? { ...x, ...c } : c));
        setList((l) => l.map((x) => (x.id === c.id ? { ...x, ...c, contact: x.contact } : x)).filter((x) => x.id === conv.id || matchesFilter(x, filters, me.id, false)));
        if (patch.status === "resolved") toast("Conversation resolved 🎉");
        void loadThread(conv.id, true);
        reloadCounts();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed", "error");
      }
    },
    [conv, filters, me.id, toast, loadThread, reloadCounts],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = list.findIndex((c) => c.id === selected);
      const k = e.key.toLowerCase();
      if (k === "j" || k === "arrowdown") {
        const n = list[Math.min(list.length - 1, idx + 1)];
        if (n) open(n.id);
      } else if (k === "k" || k === "arrowup") {
        const n = list[Math.max(0, idx - 1)];
        if (n) open(n.id);
      } else if (k === "r" && conv) {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (k === "e" && conv) void update({ status: conv.status === "resolved" ? "open" : "resolved" });
      else if (k === "a" && conv) void update({ assignee: me.id });
      else if (k === "i") setShowProfile((s) => !s);
      else if (k === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "?") setHelp(true);
      else if (k === "escape") open(null);
      else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, selected, conv, open, update, me.id]);

  const quick = [
    { key: "", label: "All", count: counts?.open },
    { key: "me", label: "Mine", count: counts?.mine },
    { key: "unassigned", label: "Unassigned", count: counts?.unassigned },
  ];
  const activeExtra = Boolean(filters.tag || filters.segment || filters.unread);

  return (
    <div className="flex h-full overflow-hidden">
      {/* list */}
      <section className={clsx("flex w-full shrink-0 flex-col border-r border-border bg-surface lg:w-[340px]", mobilePane !== "list" && "hidden lg:flex")} aria-label="Conversations">
        <div className="space-y-2.5 border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h1 className="h-display text-lg font-bold">Inbox</h1>
            <div className="flex items-center gap-1">
              <button className="btn-ghost btn-sm !p-1.5" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts">
                <Keyboard className="size-4" />
              </button>
              <button className={clsx("btn-ghost btn-sm !p-1.5", (showFilters || activeExtra) && "text-brand")} onClick={() => setShowFilters((s) => !s)} aria-label="Filters" aria-expanded={showFilters}>
                <SlidersHorizontal className="size-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input ref={searchRef} className="input !py-1.5 pl-9 pr-8" placeholder="Search people & messages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" />
            {q && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-faint" onClick={() => setQ("")} aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s.key} role="tab" aria-selected={filters.status === s.key} onClick={() => setFilters((f) => ({ ...f, status: s.key }))} className={clsx("shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold", filters.status === s.key ? "bg-text text-bg" : "text-muted hover:bg-surface-2")}>
                {s.label}
                {s.key === "open" && counts ? <span className="ml-1 opacity-70">{counts.open}</span> : s.key === "pending" && counts?.pending ? <span className="ml-1 opacity-70">{counts.pending}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {quick.map((x) => (
              <button key={x.key} onClick={() => setFilters((f) => ({ ...f, assigned: x.key }))} aria-pressed={filters.assigned === x.key} className={clsx("flex-1 rounded-lg border px-2 py-1 text-xs font-medium", filters.assigned === x.key ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted hover:bg-surface-2")}>
                {x.label} {x.count !== undefined && filters.status === "open" && <span className="opacity-60">{x.count}</span>}
              </button>
            ))}
          </div>
          {showFilters && (
            <div className="animate-pop grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface-2 p-2">
              <select className="input !py-1 text-xs" value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))} aria-label="Filter by tag">
                <option value="">Any tag</option>
                {tags.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </select>
              <select className="input !py-1 text-xs" value={filters.segment} onChange={(e) => setFilters((f) => ({ ...f, segment: e.target.value }))} aria-label="Filter by segment">
                <option value="">Any segment</option>
                {(segments || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <label className="col-span-2 flex items-center gap-2 px-1 text-xs font-medium">
                <input type="checkbox" checked={filters.unread} onChange={(e) => setFilters((f) => ({ ...f, unread: e.target.checked }))} /> Unread only {counts ? `(${counts.unread})` : ""}
              </label>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {listLoading && !list.length ? (
            <ListSkeleton rows={7} />
          ) : !list.length ? (
            <Empty icon={<InboxIcon className="size-6" />} title={filters.q ? "No matches" : "Inbox zero ✨"}>
              {filters.q ? "Try another search." : "New chats from your website widget land here in realtime."}
            </Empty>
          ) : (
            <ul>
              {list.map((c) => {
                const ct = c.contact;
                const name = ct?.name || ct?.email || `Visitor ${c.contact_id.slice(-4)}`;
                const t = typing[c.id];
                const assignee = members.find((m) => m.id === c.assignee_id);
                return (
                  <li key={c.id}>
                    <button onClick={() => open(c.id)} aria-current={c.id === selected ? "true" : undefined} className={clsx("flex w-full gap-3 border-b border-border px-3 py-3 text-left transition", c.id === selected ? "bg-brand-soft/70" : "hover:bg-surface-2")}>
                      <Avatar name={name} image={ct?.avatar} size={38} online={ct?.online} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={clsx("truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{name}</span>
                          <span className="shrink-0 text-xs">{flag(ct?.geo.country)}</span>
                          <span className="ml-auto shrink-0 text-[11px] text-faint">{shortTime(c.last_message?.at || c.updated_at)}</span>
                        </span>
                        <span className={clsx("mt-0.5 flex items-center gap-1 text-xs", c.unread ? "text-text" : "text-muted")}>
                          {t?.typing ? (
                            <span className="italic text-brand">typing…</span>
                          ) : (
                            <span className="truncate">
                              {c.last_message?.from !== "visitor" && c.last_message && <span className="text-faint">{c.last_message.from === "bot" ? "Bot: " : "You: "}</span>}
                              {c.last_message?.text || "No messages yet"}
                            </span>
                          )}
                          {c.unread > 0 && <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                        </span>
                        {(c.tags.length > 0 || assignee || c.status !== "open") && (
                          <span className="mt-1.5 flex items-center gap-1 overflow-hidden">
                            {c.status !== "open" && <span className="chip !text-[10px] capitalize">{c.status}</span>}
                            {c.tags.slice(0, 2).map((tg) => (
                              <Tag key={tg} name={tg} color={tags.find((x) => x.name === tg)?.color} />
                            ))}
                            {assignee && <Avatar name={assignee.name} image={assignee.image} size={16} className="ml-auto" />}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {hasMore && (
                <li className="p-3">
                  <button className="btn-outline w-full" onClick={() => setPage((p) => p + 1)}>
                    Load more
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* thread */}
      <section className={clsx("min-w-0 flex-1", mobilePane !== "thread" && "hidden lg:block")} aria-label="Conversation">
        <Thread
          conversation={conv}
          messages={messages}
          loading={threadLoading}
          members={members}
          shortcuts={shortcuts || []}
          tags={tags}
          me={me}
          websiteName={website.name}
          publicId={website.publicId}
          visitorTyping={conv ? typing[conv.id] || null : null}
          onBack={() => open(null)}
          onToggleProfile={() => {
            setShowProfile((s) => !s);
            setMobilePane((p) => (p === "profile" ? "thread" : "profile"));
          }}
          onUpdate={update}
          onSent={(m) => setMessages((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]))}
          composerRef={composerRef}
        />
      </section>

      {/* profile */}
      {conv && (showProfile || mobilePane === "profile") && (
        <aside className={clsx("w-full shrink-0 overflow-y-auto border-l border-border bg-surface xl:w-[320px]", mobilePane === "profile" ? "block" : "hidden xl:block")} aria-label="Visitor profile">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-2 xl:hidden">
            <span className="text-sm font-semibold">Visitor profile</span>
            <button className="btn-ghost btn-sm" onClick={() => setMobilePane("thread")}>
              Back to chat
            </button>
          </div>
          <ContactPanel key={conv.contact_id} contactId={conv.contact_id} currentConversation={conv.id} />
        </aside>
      )}

      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
          {[
            ["J / ↓", "Next conversation"],
            ["K / ↑", "Previous conversation"],
            ["R", "Reply (focus composer)"],
            ["E", "Resolve / reopen"],
            ["A", "Assign to me"],
            ["I", "Toggle visitor profile"],
            ["/", "Search (in list) · canned replies (in composer)"],
            ["Enter", "Send · Shift+Enter for a new line"],
            ["Esc", "Close conversation"],
            ["?", "This help"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <span className="kbd text-xs">{k}</span>
              </dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
