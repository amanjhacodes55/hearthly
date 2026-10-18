"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { BarChart3, BookOpen, Check, ChevronsUpDown, Code2, LogOut, Megaphone, MessagesSquare, Moon, Plus, Radar, Settings, Sun, Users, Zap, Monitor, Bell, BellOff } from "lucide-react";
import { Avatar, LogoMark } from "@/components/ui";
import { RealtimeProvider, chime, useRealtime, useRealtimeEvent } from "@/components/Realtime";
import { api } from "@/lib/client";
import type { SConversation, SMessage } from "@/lib/serialize";

export type ShellCtx = { user: { id: string; name: string; email: string; image: string; theme: string }; website: { id: string; publicId: string; name: string; role: string } };

const NAV = [
  { href: "/app/inbox", label: "Inbox", icon: MessagesSquare, key: "inbox" },
  { href: "/app/visitors", label: "Live visitors", icon: Radar, key: "visitors" },
  { href: "/app/contacts", label: "Contacts", icon: Users, key: "contacts" },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone, key: "campaigns" },
  { href: "/app/automations", label: "Automations", icon: Zap, key: "automations" },
  { href: "/app/kb", label: "Help center", icon: BookOpen, key: "kb" },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3, key: "analytics" },
  { href: "/developers", label: "Developers", icon: Code2, key: "dev" },
  { href: "/app/settings", label: "Settings", icon: Settings, key: "settings" },
];

export function setTheme(t: "light" | "dark" | "system") {
  try {
    localStorage.setItem("cc-theme", t);
  } catch {}
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function WebsiteSwitcher({ ctx }: { ctx: ShellCtx }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<{ id: string; name: string; publicId: string; role: string; current: boolean }[]>([]);
  const router = useRouter();
  useEffect(() => {
    if (open) void api<typeof list>("/api/websites").then(setList);
  }, [open]);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-left hover:bg-surface-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-white">{ctx.website.name.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{ctx.website.name}</span>
          <span className="block truncate text-[11px] capitalize text-faint">{ctx.website.role}</span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="card animate-pop absolute left-0 right-0 top-full z-50 mt-1 p-1.5 shadow-pop">
            {list.map((w) => (
              <button
                role="menuitem"
                key={w.id}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2"
                onClick={async () => {
                  await api("/api/websites/switch", { method: "POST", json: { id: w.id } });
                  setOpen(false);
                  router.refresh();
                  window.location.reload();
                }}
              >
                <span className="flex-1 truncate">{w.name}</span>
                {w.current && <Check className="size-4 text-brand" />}
              </button>
            ))}
            <Link role="menuitem" href="/onboarding?new=1" className="mt-1 flex items-center gap-2 rounded-lg border-t border-border px-2.5 py-2 text-sm font-medium text-brand hover:bg-surface-2">
              <Plus className="size-4" /> Add website
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Notifier({ ctx, setUnread }: { ctx: ShellCtx; setUnread: (n: number) => void }) {
  const pathname = usePathname();
  const refresh = useCallback(() => void api<{ unread: number }>("/api/conversations/counts").then((c) => setUnread(c.unread)).catch(() => {}), [setUnread]);
  useEffect(refresh, [refresh]);
  const { connected } = useRealtime();
  useEffect(() => {
    if (connected) return;
    const t = setInterval(refresh, 20_000); // polling fallback while SSE is down
    return () => clearInterval(t);
  }, [connected, refresh]);
  useRealtimeEvent((type, data) => {
    if (type === "read" || type === "conversation") refresh();
    if (type !== "message") return;
    const { message, conversation } = data as { message: SMessage; conversation: SConversation };
    refresh();
    if (message.from !== "visitor") return;
    const viewing = pathname.startsWith("/app/inbox") && new URLSearchParams(window.location.search).get("c") === conversation.id && !document.hidden;
    if (viewing) return;
    if (localStorage.getItem("cc-sound") !== "off") chime();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && (document.hidden || !pathname.startsWith("/app/inbox"))) {
      const n = new Notification(`${conversation.contact?.name || conversation.contact?.email || "Visitor"} · ${ctx.website.name}`, { body: message.text || "📎 Attachment", tag: conversation.id, icon: "/logo.svg" });
      n.onclick = () => {
        window.focus();
        window.location.href = `/app/inbox?c=${conversation.id}`;
      };
    }
  });
  return null;
}

function Shell({ ctx, children }: { ctx: ShellCtx; children: React.ReactNode }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const [theme, setThemeState] = useState("system");
  const [sound, setSound] = useState(true);
  const { connected } = useRealtime();
  const baseTitle = useRef<string>("");
  useEffect(() => {
    setThemeState(localStorage.getItem("cc-theme") || "system");
    setSound(localStorage.getItem("cc-sound") !== "off");
  }, []);
  useEffect(() => {
    if (!baseTitle.current || !document.title.startsWith("(")) baseTitle.current = document.title;
    const clean = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread ? `(${unread}) ${clean}` : clean;
  }, [unread, pathname]);
  const active = (href: string) => (href === "/app/settings" ? pathname.startsWith("/app/settings") : pathname.startsWith(href));
  return (
    <div className="flex h-dvh overflow-hidden">
      <Notifier ctx={ctx} setUnread={setUnread} />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex" aria-label="Main navigation">
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <LogoMark size={28} />
          <span className="h-display text-lg font-extrabold">
            Chat<span className="text-brand">Crip</span>
          </span>
          <span className={clsx("ml-auto size-2 rounded-full", connected ? "bg-success" : "bg-warn")} title={connected ? "Realtime connected" : "Reconnecting… (polling)"} aria-label={connected ? "Realtime connected" : "Realtime reconnecting"} />
        </div>
        <div className="px-3">
          <WebsiteSwitcher ctx={ctx} />
        </div>
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className="nav-item" aria-current={active(n.href) ? "page" : undefined}>
              <n.icon className="size-[18px]" />
              <span className="flex-1">{n.label}</span>
              {n.key === "inbox" && unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{unread}</span>}
            </Link>
          ))}
        </nav>
        <div className="relative border-t border-border p-3">
          <button onClick={() => setMenu(!menu)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-2" aria-haspopup="menu" aria-expanded={menu}>
            <Avatar name={ctx.user.name} image={ctx.user.image} size={30} online={connected} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold">{ctx.user.name}</span>
              <span className="block truncate text-[11px] text-faint">{ctx.user.email}</span>
            </span>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div role="menu" className="card animate-pop absolute bottom-full left-3 right-3 z-50 mb-1 p-1.5 shadow-pop">
                <div className="flex gap-1 p-1" role="group" aria-label="Theme">
                  {(
                    [
                      ["light", Sun],
                      ["dark", Moon],
                      ["system", Monitor],
                    ] as const
                  ).map(([t, I]) => (
                    <button key={t} aria-label={`${t} theme`} aria-pressed={theme === t} onClick={() => (setTheme(t), setThemeState(t))} className={clsx("flex flex-1 items-center justify-center rounded-lg py-1.5", theme === t ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2")}>
                      <I className="size-4" />
                    </button>
                  ))}
                </div>
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2"
                  onClick={() => {
                    const next = !sound;
                    setSound(next);
                    localStorage.setItem("cc-sound", next ? "on" : "off");
                    if (next && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
                  }}
                >
                  {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />} Sound & notifications: {sound ? "on" : "off"}
                </button>
                <Link role="menuitem" href="/app/settings/profile" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-2" onClick={() => setMenu(false)}>
                  <Settings className="size-4" /> Profile
                </Link>
                <button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger hover:bg-surface-2" onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 backdrop-blur md:hidden" aria-label="Mobile navigation">
          {NAV.filter((n) => ["inbox", "visitors", "contacts", "analytics", "settings"].includes(n.key)).map((n) => (
            <Link key={n.key} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={clsx("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium", active(n.href) ? "text-brand" : "text-muted")}>
              <n.icon className="size-5" />
              {n.key === "visitors" ? "Visitors" : n.label.split(" ").pop()}
              {n.key === "inbox" && unread > 0 && <span className="absolute right-[22%] top-1 rounded-full bg-accent px-1 text-[9px] font-bold text-white">{unread}</span>}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function AppShell({ ctx, children }: { ctx: ShellCtx; children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <Shell ctx={ctx}>{children}</Shell>
    </RealtimeProvider>
  );
}
