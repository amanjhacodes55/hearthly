"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Bot, Check, CheckCheck, ChevronDown, Clock, FileText, Loader2, Lock, Paperclip, PanelRight, RotateCcw, Send, Smile, Star, Tag as TagIcon, UserRound, X, Zap } from "lucide-react";
import { Avatar, Skeleton, Tag, fileSize, flag, shortTime } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, uploadFile } from "@/lib/client";
import { renderTemplate } from "@/lib/triggers";
import type { SConversation, SMessage } from "@/lib/serialize";

export type Member = { id: string; name: string; email: string; image: string; online: boolean };
export type Shortcut = { id: string; shortcut: string; title: string; body: string };
type Att = { id: string; name: string; size: number; type: string };

const EMOJI = "😀 😂 😊 😍 🙏 👍 👋 🎉 🚀 ✅ ❤️ 🔥 💡 🤔 😅 🙌".split(" ");

function dayLabel(d: string) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(Date.now() - 86400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === y.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Attachment({ a, mine, onImage }: { a: Att; mine: boolean; onImage: (src: string) => void }) {
  const src = `/api/files/${a.id}`;
  if (a.type.startsWith("image/"))
    return (
      <button onClick={() => onImage(src)} className="block overflow-hidden rounded-xl border border-border" aria-label={`Open image ${a.name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={a.name} loading="lazy" className="max-h-56 max-w-[260px] object-cover" />
      </button>
    );
  return (
    <a href={`${src}?download=1`} className={clsx("flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm", mine ? "border-white/30 bg-white/10" : "border-border bg-surface")}>
      <FileText className="size-5 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{a.name}</span>
        <span className="text-xs opacity-70">{fileSize(a.size)}</span>
      </span>
    </a>
  );
}

export default function Thread({
  conversation,
  messages,
  loading,
  members,
  shortcuts,
  tags,
  me,
  websiteName,
  publicId,
  visitorTyping,
  onBack,
  onToggleProfile,
  onUpdate,
  onSent,
  composerRef,
}: {
  conversation: SConversation | null;
  messages: SMessage[];
  loading: boolean;
  members: Member[];
  shortcuts: Shortcut[];
  tags: { name: string; color: string }[];
  me: { id: string; name: string };
  websiteName: string;
  publicId: string;
  visitorTyping: { typing: boolean; preview: string } | null;
  onBack: () => void;
  onToggleProfile: () => void;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  onSent: (m: SMessage) => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [atts, setAtts] = useState<(Att & { uploading?: boolean })[]>([]);
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | "assign" | "snooze" | "tags" | "emoji">(null);
  const [slashIdx, setSlashIdx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingSent = useRef(0);
  const convId = conversation?.id;

  useEffect(() => {
    setText(localStorage.getItem(`cc-draft:${convId}`) || "");
    setAtts([]);
    setMode("reply");
    setMenu(null);
  }, [convId]);
  useEffect(() => {
    if (convId) localStorage.setItem(`cc-draft:${convId}`, text);
  }, [text, convId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, convId, visitorTyping?.typing]);

  const contact = conversation?.contact;
  const vars = useMemo(
    () => ({ name: contact?.name || "", first_name: (contact?.name || "").split(" ")[0], email: contact?.email || "", agent: me.name, agent_first_name: me.name.split(" ")[0], website: websiteName, help_url: typeof window !== "undefined" ? `${window.location.origin}/help/${publicId}` : "" }),
    [contact, me.name, websiteName, publicId],
  );

  // "/" command menu for canned replies
  const slash = text.match(/(?:^|\s)\/([\w-]*)$/);
  const matches = slash ? shortcuts.filter((s) => s.shortcut.startsWith(slash[1].toLowerCase()) || s.title.toLowerCase().includes(slash[1].toLowerCase())).slice(0, 6) : [];
  const applyShortcut = (s: Shortcut) => {
    setText((t) => t.replace(/(^|\s)\/[\w-]*$/, (_m, pre) => pre + renderTemplate(s.body, vars)));
    setSlashIdx(0);
    composerRef.current?.focus();
  };

  const addFiles = useCallback(
    (files: File[]) => {
      for (const f of files) {
        if (f.size > 10 * 1024 * 1024) {
          toast(`${f.name} is larger than 10 MB`, "error");
          continue;
        }
        const tmp = { id: `tmp-${Math.random()}`, name: f.name || "pasted.png", size: f.size, type: f.type, uploading: true };
        setAtts((a) => [...a, tmp]);
        uploadFile(f)
          .then((r) => setAtts((a) => a.map((x) => (x.id === tmp.id ? r : x))))
          .catch((e) => {
            setAtts((a) => a.filter((x) => x.id !== tmp.id));
            toast(e.message, "error");
          });
      }
    },
    [toast],
  );

  async function send() {
    if (!conversation || sending) return;
    const body = text.trim();
    const ready = atts.filter((a) => !a.uploading);
    if (!body && !ready.length) return;
    if (atts.some((a) => a.uploading)) return toast("Wait for uploads to finish", "info");
    setSending(true);
    try {
      const m = await api<SMessage>(`/api/conversations/${conversation.id}/messages`, { method: "POST", json: { text: body, note: mode === "note", attachments: ready } });
      onSent(m);
      setText("");
      setAtts([]);
      localStorage.removeItem(`cc-draft:${conversation.id}`);
      void api(`/api/conversations/${conversation.id}/typing`, { method: "POST", json: { typing: false } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to send", "error");
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  if (!conversation)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted">
        {loading ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <>
            <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Send className="size-7" />
            </div>
            <p className="font-semibold text-text">Pick a conversation</p>
            <p className="max-w-xs text-sm">
              Use <span className="kbd">J</span> / <span className="kbd">K</span> to move between conversations and <span className="kbd">?</span> for all shortcuts.
            </p>
          </>
        )}
      </div>
    );

  const assignee = members.find((m) => m.id === conversation.assignee_id);
  const lastVisitorRead = conversation.visitor_read_at ? new Date(conversation.visitor_read_at).getTime() : 0;
  const lastOperatorIdx = messages.map((m) => m.from === "operator" || m.from === "bot").lastIndexOf(true);
  const snooze = (h: number | "tomorrow" | "week") => {
    const d = new Date();
    if (h === "tomorrow") {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else if (h === "week") {
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
      d.setHours(9, 0, 0, 0);
    } else d.setTime(d.getTime() + h * 3600_000);
    setMenu(null);
    void onUpdate({ snoozeUntil: d.toISOString() }).then(() => toast(`Snoozed until ${d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`));
  };

  return (
    <div
      className="relative flex h-full min-w-0 flex-col"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        addFiles([...e.dataTransfer.files]);
      }}
    >
      {drag && <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-brand-soft/80 text-lg font-bold text-brand">Drop files to attach</div>}
      {/* header */}
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5 md:px-4">
        <button className="btn-ghost btn-sm !p-1.5 lg:hidden" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft className="size-4" />
        </button>
        <Avatar name={contact?.name || contact?.email || "Visitor"} size={34} online={contact?.online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{contact?.name || contact?.email || "Anonymous visitor"}</p>
          <p className="truncate text-xs text-muted">
            {flag(contact?.geo.country)} {[contact?.geo.city, contact?.geo.country_name].filter(Boolean).join(", ") || "Unknown"} · {conversation.channel}
            {contact?.online && contact.current_page && <span className="text-success"> · on {contact.current_page.title || contact.current_page.url}</span>}
          </p>
        </div>
        <div className="relative">
          <button className="btn-outline btn-sm" onClick={() => setMenu(menu === "assign" ? null : "assign")} aria-haspopup="menu" aria-expanded={menu === "assign"} title="Assign (A = assign to me)">
            {assignee ? <Avatar name={assignee.name} image={assignee.image} size={18} /> : <UserRound className="size-3.5" />}
            <span className="hidden sm:inline">{assignee ? assignee.name.split(" ")[0] : "Unassigned"}</span>
            <ChevronDown className="size-3" />
          </button>
          {menu === "assign" && (
            <Menu onClose={() => setMenu(null)}>
              {members.map((m) => (
                <button key={m.id} role="menuitem" className="menu-item flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => (setMenu(null), void onUpdate({ assignee: m.id }))}>
                  <Avatar name={m.name} image={m.image} size={22} online={m.online} />
                  <span className="flex-1 truncate">{m.id === me.id ? `${m.name} (me)` : m.name}</span>
                  {m.id === conversation.assignee_id && <Check className="size-4 text-brand" />}
                </button>
              ))}
              <button role="menuitem" className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-muted hover:bg-surface-2" onClick={() => (setMenu(null), void onUpdate({ assignee: null }))}>
                Unassign
              </button>
            </Menu>
          )}
        </div>
        <div className="relative hidden sm:block">
          <button className="btn-outline btn-sm" onClick={() => setMenu(menu === "snooze" ? null : "snooze")} aria-label="Snooze" title="Snooze (S)">
            <Clock className="size-3.5" />
          </button>
          {menu === "snooze" && (
            <Menu onClose={() => setMenu(null)}>
              {(
                [
                  ["1 hour", 1],
                  ["4 hours", 4],
                  ["Tomorrow 9:00", "tomorrow"],
                  ["Next week", "week"],
                ] as const
              ).map(([l, v]) => (
                <button key={l} role="menuitem" className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => snooze(v)}>
                  {l}
                </button>
              ))}
            </Menu>
          )}
        </div>
        {conversation.status === "resolved" ? (
          <button className="btn-outline btn-sm" onClick={() => onUpdate({ status: "open" })} title="Reopen (E)">
            <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Reopen</span>
          </button>
        ) : (
          <button className="btn-primary btn-sm" onClick={() => onUpdate({ status: "resolved" })} title="Resolve (E)">
            <CheckCheck className="size-3.5" /> <span className="hidden sm:inline">Resolve</span>
          </button>
        )}
        <button className="btn-ghost btn-sm !p-1.5" onClick={onToggleProfile} aria-label="Toggle visitor profile" title="Profile (I)">
          <PanelRight className="size-4" />
        </button>
      </header>
      {/* tags bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface/70 px-4 py-1.5">
        {conversation.tags.map((t) => (
          <Tag key={t} name={t} color={tags.find((x) => x.name === t)?.color} onRemove={() => onUpdate({ tags: conversation.tags.filter((x) => x !== t) })} />
        ))}
        <div className="relative">
          <button className="chip hover:text-text" onClick={() => setMenu(menu === "tags" ? null : "tags")} aria-label="Add tag">
            <TagIcon className="size-3" /> Tag
          </button>
          {menu === "tags" && (
            <Menu onClose={() => setMenu(null)} align="left">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = tagInput.trim().toLowerCase();
                  if (t) void onUpdate({ tags: [...new Set([...conversation.tags, t])] });
                  setTagInput("");
                  setMenu(null);
                }}
              >
                <input autoFocus className="input !py-1 text-sm" placeholder="New tag…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
              </form>
              <div className="mt-1 max-h-48 overflow-y-auto">
                {tags
                  .filter((t) => !conversation.tags.includes(t.name) && t.name.includes(tagInput.toLowerCase()))
                  .map((t) => (
                    <button key={t.name} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-2" onClick={() => (setMenu(null), void onUpdate({ tags: [...conversation.tags, t.name] }))}>
                      <span className="size-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
                    </button>
                  ))}
              </div>
            </Menu>
          )}
        </div>
        {conversation.rating && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-warn" title={conversation.rating.comment}>
            <Star className="size-3.5 fill-current" /> {conversation.rating.score}/5 {conversation.rating.comment && <span className="max-w-[200px] truncate font-normal text-muted">“{conversation.rating.comment}”</span>}
          </span>
        )}
        {conversation.snoozed_until && new Date(conversation.snoozed_until) > new Date() && (
          <span className="chip ml-auto">
            <Clock className="size-3" /> Snoozed until {shortTime(conversation.snoozed_until)}
          </span>
        )}
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto bg-bg px-3 py-4 md:px-6" role="log" aria-live="polite" aria-label="Messages">
        {loading && !messages.length ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-16 w-3/5" />
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.created_at!).toDateString() !== new Date(m.created_at!).toDateString();
              const mine = m.from === "operator" || m.from === "bot";
              const grouped = prev && !newDay && prev.from === m.from && prev.author?.name === m.author?.name && new Date(m.created_at!).getTime() - new Date(prev.created_at!).getTime() < 5 * 60_000;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
                      <span className="h-px flex-1 bg-border" />
                      {dayLabel(m.created_at!)}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {m.from === "system" ? (
                    <p className="my-1.5 text-center text-xs text-faint">
                      {m.text} · {shortTime(m.created_at)}
                    </p>
                  ) : (
                    <div className={clsx("group flex gap-2", mine || m.from === "note" ? "flex-row-reverse" : "", grouped ? "mt-0.5" : "mt-3")}>
                      <div className="w-8 shrink-0">{!grouped && (m.from === "bot" ? <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-muted"><Bot className="size-4" /></span> : <Avatar name={m.author?.name || "Visitor"} image={m.author?.avatar} size={32} />)}</div>
                      <div className={clsx("flex max-w-[78%] flex-col gap-1", mine || m.from === "note" ? "items-end" : "items-start")}>
                        {!grouped && (
                          <span className="px-1 text-[11px] text-faint">
                            {m.from === "note" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                                <Lock className="size-3" /> Private note · {m.author?.name}
                              </span>
                            ) : (
                              m.author?.name || (m.from === "visitor" ? "Visitor" : websiteName)
                            )}
                            {m.via && <span className="ml-1 rounded bg-surface-3 px-1 py-px text-[10px]">{m.via}</span>} · {shortTime(m.created_at)}
                          </span>
                        )}
                        {m.text && (
                          <div
                            className={clsx(
                              "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]",
                              m.from === "visitor" && "rounded-tl-md border border-border bg-surface",
                              m.from === "operator" && "rounded-tr-md bg-brand text-brand-fg",
                              m.from === "bot" && "rounded-tr-md bg-surface-3",
                              m.from === "note" && "rounded-tr-md border border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
                            )}
                            title={new Date(m.created_at!).toLocaleString()}
                          >
                            <Linkify text={m.text} />
                          </div>
                        )}
                        {m.attachments.map((a) => (
                          <Attachment key={a.id} a={a} mine={mine} onImage={setLightbox} />
                        ))}
                        {i === lastOperatorIdx && mine && (
                          <span className="px-1 text-[11px] text-faint">{lastVisitorRead >= new Date(m.created_at!).getTime() ? <span className="inline-flex items-center gap-1 text-brand"><CheckCheck className="size-3" /> Seen</span> : <span className="inline-flex items-center gap-1"><Check className="size-3" /> Delivered</span>}</span>
                        )}
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
            {visitorTyping?.typing && (
              <div className="mt-3 flex items-end gap-2">
                <Avatar name={contact?.name || "Visitor"} size={32} />
                <div className="rounded-2xl rounded-tl-md border border-dashed border-border bg-surface px-3.5 py-2 text-sm text-muted">
                  {visitorTyping.preview ? <span className="italic">{visitorTyping.preview}</span> : null}
                  <span className="ml-1 inline-flex gap-0.5 align-middle" aria-label="Visitor is typing">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>
        )}
      </div>

      {/* composer */}
      <div className={clsx("relative border-t border-border p-3", mode === "note" ? "bg-amber-50/70 dark:bg-amber-500/5" : "bg-surface")}>
        {matches.length > 0 && (
          <div className="card animate-pop absolute bottom-full left-3 right-3 z-20 mb-2 overflow-hidden p-1 shadow-pop" role="listbox" aria-label="Canned replies">
            <p className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
              <Zap className="size-3" /> Shortcuts — ↑↓ to pick, Enter to insert
            </p>
            {matches.map((s, i) => (
              <button key={s.id} role="option" aria-selected={i === slashIdx % matches.length} className={clsx("flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left", i === slashIdx % matches.length ? "bg-brand-soft" : "hover:bg-surface-2")} onMouseDown={(e) => (e.preventDefault(), applyShortcut(s))}>
                <span className="text-sm font-semibold">
                  <span className="font-mono text-brand">/{s.shortcut}</span> {s.title}
                </span>
                <span className="truncate text-xs text-muted">{renderTemplate(s.body, vars)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mb-2 flex items-center gap-1">
          {(["reply", "note"] as const).map((k) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={clsx("rounded-lg px-2.5 py-1 text-xs font-semibold", mode === k ? (k === "note" ? "bg-amber-200/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-brand-soft text-brand-strong") : "text-muted hover:bg-surface-2")}>
              {k === "reply" ? "Reply" : "Private note"}
            </button>
          ))}
          <span className="ml-auto hidden text-[11px] text-faint sm:block">
            <span className="kbd">/</span> shortcuts · <span className="kbd">Enter</span> send · <span className="kbd">Shift+Enter</span> newline
          </span>
        </div>
        {atts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {atts.map((a) => (
              <span key={a.id} className="chip !py-1">
                {a.uploading ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />}
                <span className="max-w-[160px] truncate">{a.name}</span>
                <button aria-label={`Remove ${a.name}`} onClick={() => setAtts((x) => x.filter((y) => y.id !== a.id))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            rows={2}
            value={text}
            aria-label={mode === "note" ? "Write a private note" : "Write a reply"}
            placeholder={mode === "note" ? "Only your team sees notes…" : `Reply to ${contact?.name?.split(" ")[0] || "visitor"} — type / for shortcuts`}
            className="input max-h-48 min-h-[44px] flex-1 resize-none"
            onChange={(e) => {
              setText(e.target.value);
              setSlashIdx(0);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(192, e.target.scrollHeight)}px`;
              if (mode === "reply" && Date.now() - typingSent.current > 2000) {
                typingSent.current = Date.now();
                void api(`/api/conversations/${conversation.id}/typing`, { method: "POST", json: { typing: true } }).catch(() => {});
              }
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.length) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (matches.length) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIdx((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  applyShortcut(matches[slashIdx % matches.length]);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
              if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
            }}
          />
          <div className="flex shrink-0 gap-1">
            <div className="relative">
              <button className="btn-ghost !p-2" aria-label="Insert emoji" onClick={() => setMenu(menu === "emoji" ? null : "emoji")}>
                <Smile className="size-4" />
              </button>
              {menu === "emoji" && (
                <Menu onClose={() => setMenu(null)} up>
                  <div className="grid grid-cols-8 gap-0.5">
                    {EMOJI.map((em) => (
                      <button key={em} aria-label={em} className="rounded p-1 text-lg hover:bg-surface-2" onClick={() => (setText((t) => t + em), setMenu(null), composerRef.current?.focus())}>
                        {em}
                      </button>
                    ))}
                  </div>
                </Menu>
              )}
            </div>
            <button className="btn-ghost !p-2" aria-label="Attach files" onClick={() => fileRef.current?.click()}>
              <Paperclip className="size-4" />
            </button>
            <input ref={fileRef} type="file" multiple hidden accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.docx,.xlsx,.zip" onChange={(e) => (addFiles([...(e.target.files || [])]), (e.target.value = ""))} />
            <button className={clsx(mode === "note" ? "btn bg-amber-500 text-white hover:bg-amber-600" : "btn-primary")} disabled={sending || (!text.trim() && !atts.length)} onClick={() => void send()} aria-label={mode === "note" ? "Save note" : "Send reply"}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : mode === "note" ? <Lock className="size-4" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[150] flex cursor-zoom-out items-center justify-center bg-black/85 p-6" onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg" />
          <a href={`${lightbox}?download=1`} onClick={(e) => e.stopPropagation()} className="btn-outline absolute right-4 top-4">
            Download
          </a>
        </div>
      )}
    </div>
  );
}

function Menu({ children, onClose, align = "right", up }: { children: React.ReactNode; onClose: () => void; align?: "left" | "right"; up?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div role="menu" className={clsx("card animate-pop absolute z-50 w-56 p-1.5 shadow-pop", align === "right" ? "right-0" : "left-0", up ? "bottom-full mb-1" : "top-full mt-1")}>
        {children}
      </div>
    </>
  );
}
