"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Plus, Save, Trash2 } from "lucide-react";
import { Field, Skeleton, Switch } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card, type SettingsCtx } from "./SettingsSection";

type PreField = { key: string; label: string; type: "text" | "email" | "tel" | "textarea"; required: boolean };
type W = {
  color: string; accent: string; gradient: boolean; theme: "light" | "dark" | "auto"; position: "left" | "right"; launcherIcon: string; launcherText: string; radius: number;
  title: string; welcome: string; teamName: string; showTeam: boolean; showBranding: boolean; sound: boolean; hideOnMobile: boolean; hideOnUrls: string[];
  autoOpenAfterSec: number; autoOpenOnUrls: string[]; preChat: { enabled: boolean; fields: PreField[] }; strings: Record<string, string>; locale: string;
  allowAttachments: boolean; allowRating: boolean; allowTranscript: boolean; kbSearch: boolean; quickReplies: { label: string; reply: string; tag: string }[];
};
const PRESETS = [
  ["#c2410c", "#8e2c5a"],
  ["#0d9488", "#0f766e"],
  ["#4f46e5", "#ec4899"],
  ["#0f172a", "#38bdf8"],
  ["#ea580c", "#facc15"],
  ["#16a34a", "#84cc16"],
  ["#be123c", "#fb7185"],
];
const STRING_KEYS = ["placeholder", "online", "away", "offline", "rateTitle", "prechatTitle", "start", "poweredBy", "leaveEmail"];

export default function WidgetSettings({ ctx }: { ctx: SettingsCtx }) {
  const toast = useToast();
  const { data } = useFetch<{ widget: W; name: string }>("/api/websites/current");
  const { data: team } = useFetch<{ members: { name: string; image: string }[] }>("/api/team");
  const [w, setW] = useState<W | null>(null);
  const [dirty, setDirty] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (data && !w) setW(data.widget);
  }, [data, w]);
  const set = (patch: Partial<W>) => {
    setW((x) => (x ? { ...x, ...patch } : x));
    setDirty(true);
  };
  const push = useCallback(() => {
    if (!w || !frame.current?.contentWindow) return;
    frame.current.contentWindow.postMessage(
      { type: "hearthly:preview", config: { website: { id: "preview", name: data?.name || ctx.website.name, logo: "" }, widget: w, team: w.showTeam ? (team?.members || []).slice(0, 3).map((m) => ({ name: m.name.split(" ")[0], avatar: m.image })) : [], status: { online: true, withinHours: true }, help: `/help/${ctx.website.publicId}` } },
      window.location.origin,
    );
  }, [w, team, data, ctx.website]);
  useEffect(() => {
    const t = setTimeout(push, 120);
    return () => clearTimeout(t);
  }, [push]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.origin === window.location.origin && e.data?.type === "hearthly:preview-ready" && push();
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [push]);

  if (!w) return <Skeleton className="h-96" />;
  const lines = (a: string[]) => a.join("\n");
  const unlines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
      <div>
        <Card title="Appearance">
          <div className="space-y-4">
            <div>
              <p className="label">Presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(([c, a]) => (
                  <button key={c} aria-label={`Preset ${c}`} onClick={() => set({ color: c, accent: a })} className={clsx("size-9 rounded-full ring-offset-2 ring-offset-surface", w.color === c && "ring-2 ring-brand")} style={{ background: `linear-gradient(135deg, ${c}, ${a})` }} />
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Brand color">
                <span className="flex gap-2">
                  <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-border" value={w.color} onChange={(e) => set({ color: e.target.value })} aria-label="Brand color picker" />
                  <input className="input font-mono" value={w.color} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set({ color: e.target.value })} />
                </span>
              </Field>
              <Field label="Accent (gradient end)">
                <span className="flex gap-2">
                  <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-border" value={w.accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Accent color picker" />
                  <input className="input font-mono" value={w.accent} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set({ accent: e.target.value })} />
                </span>
              </Field>
              <Field label={`Corner radius: ${w.radius}px`}>
                <input type="range" min={0} max={28} value={w.radius} onChange={(e) => set({ radius: Number(e.target.value) })} className="w-full accent-[var(--brand)]" />
              </Field>
            </div>
            <Switch checked={w.gradient} onChange={(v) => set({ gradient: v })} label="Use gradient" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Theme">
                <select className="input" value={w.theme} onChange={(e) => set({ theme: e.target.value as W["theme"] })}>
                  <option value="auto">Auto (follow visitor)</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </Field>
              <Field label="Position">
                <select className="input" value={w.position} onChange={(e) => set({ position: e.target.value as W["position"] })}>
                  <option value="right">Bottom right</option>
                  <option value="left">Bottom left</option>
                </select>
              </Field>
              <Field label="Launcher icon">
                <select className="input" value={w.launcherIcon} onChange={(e) => set({ launcherIcon: e.target.value })}>
                  <option value="hearth">Hearth (default)</option>
                  <option value="bubble">Bubble</option>
                  <option value="wave">Wave</option>
                  <option value="spark">Spark</option>
                  <option value="help">Help</option>
                </select>
              </Field>
            </div>
            <Field label="Launcher text (optional)">
              <input className="input" maxLength={30} value={w.launcherText} onChange={(e) => set({ launcherText: e.target.value })} placeholder="Chat with us" />
            </Field>
          </div>
        </Card>
        <Card title="Content">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Header title">
              <input className="input" maxLength={60} value={w.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Team name (overrides title)">
              <input className="input" maxLength={60} value={w.teamName} onChange={(e) => set({ teamName: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Welcome message">
                <textarea className="input" maxLength={300} value={w.welcome} onChange={(e) => set({ welcome: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
            <Switch checked={w.showTeam} onChange={(v) => set({ showTeam: v })} label="Show team avatars" />
            <Switch checked={w.showBranding} onChange={(v) => set({ showBranding: v })} label="Show “Chat by Hearthly”" />
            <Switch checked={w.allowAttachments} onChange={(v) => set({ allowAttachments: v })} label="Allow file attachments" />
            <Switch checked={w.allowRating} onChange={(v) => set({ allowRating: v })} label="Ask for a rating when resolved" />
            <Switch checked={w.allowTranscript} onChange={(v) => set({ allowTranscript: v })} label="Offer email transcript" />
            <Switch checked={w.kbSearch} onChange={(v) => set({ kbSearch: v })} label="Help center tab" />
            <Switch checked={w.sound} onChange={(v) => set({ sound: v })} label="Sound on new message" />
          </div>
        </Card>
        <Card title="Welcome quick replies (routing bot)" description="Buttons shown before the first message. Clicking one tags the conversation and sends an instant answer.">
          <div className="space-y-2">
            {w.quickReplies.map((q, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-border p-2.5 sm:grid-cols-[1fr_1.5fr_110px_auto]">
                <input className="input !py-1.5 text-sm" placeholder="Button label" value={q.label} onChange={(e) => set({ quickReplies: w.quickReplies.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input className="input !py-1.5 text-sm" placeholder="Instant bot answer" value={q.reply} onChange={(e) => set({ quickReplies: w.quickReplies.map((x, j) => (j === i ? { ...x, reply: e.target.value } : x)) })} />
                <input className="input !py-1.5 text-sm" placeholder="tag" value={q.tag} onChange={(e) => set({ quickReplies: w.quickReplies.map((x, j) => (j === i ? { ...x, tag: e.target.value } : x)) })} />
                <button className="btn-ghost btn-sm" aria-label="Remove quick reply" onClick={() => set({ quickReplies: w.quickReplies.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {w.quickReplies.length < 6 && (
              <button className="btn-ghost btn-sm text-brand" onClick={() => set({ quickReplies: [...w.quickReplies, { label: "", reply: "", tag: "" }] })}>
                <Plus className="size-3.5" /> Add quick reply
              </button>
            )}
          </div>
        </Card>
        <Card title="Pre-chat form" description="Ask for details before the first message.">
          <Switch checked={w.preChat.enabled} onChange={(v) => set({ preChat: { ...w.preChat, enabled: v, fields: w.preChat.fields.length ? w.preChat.fields : [{ key: "name", label: "Your name", type: "text", required: true }, { key: "email", label: "Email", type: "email", required: true }] } })} label="Enable pre-chat form" />
          {w.preChat.enabled && (
            <div className="mt-3 space-y-2">
              {w.preChat.fields.map((f, i) => (
                <div key={i} className="grid items-center gap-2 sm:grid-cols-[110px_1fr_110px_auto_auto]">
                  <input className="input !py-1.5 font-mono text-xs" placeholder="key" value={f.key} onChange={(e) => set({ preChat: { ...w.preChat, fields: w.preChat.fields.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^a-z0-9_]/gi, "") } : x)) } })} aria-label="Field key" />
                  <input className="input !py-1.5 text-sm" placeholder="Label" value={f.label} onChange={(e) => set({ preChat: { ...w.preChat, fields: w.preChat.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} aria-label="Field label" />
                  <select className="input !py-1.5 text-sm" value={f.type} onChange={(e) => set({ preChat: { ...w.preChat, fields: w.preChat.fields.map((x, j) => (j === i ? { ...x, type: e.target.value as PreField["type"] } : x)) } })} aria-label="Field type">
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="textarea">Long text</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={f.required} onChange={(e) => set({ preChat: { ...w.preChat, fields: w.preChat.fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) } })} /> Required
                  </label>
                  <button className="btn-ghost btn-sm" aria-label="Remove field" onClick={() => set({ preChat: { ...w.preChat, fields: w.preChat.fields.filter((_, j) => j !== i) } })}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {w.preChat.fields.length < 6 && (
                <button className="btn-ghost btn-sm text-brand" onClick={() => set({ preChat: { ...w.preChat, fields: [...w.preChat.fields, { key: "phone", label: "Phone", type: "tel", required: false }] } })}>
                  <Plus className="size-3.5" /> Add field
                </button>
              )}
              <p className="text-xs text-faint">Keys name, email and phone fill the contact profile; any other key is saved as custom data.</p>
            </div>
          )}
        </Card>
        <Card title="Behavior">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Auto-open after (seconds, 0 = never)">
              <input type="number" min={0} max={600} className="input" value={w.autoOpenAfterSec} onChange={(e) => set({ autoOpenAfterSec: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} />
            </Field>
            <Field label="…only on URLs matching (one per line, * wildcard)">
              <textarea className="input min-h-[42px] font-mono text-xs" value={lines(w.autoOpenOnUrls)} onChange={(e) => set({ autoOpenOnUrls: unlines(e.target.value) })} />
            </Field>
            <Field label="Hide on URLs matching (one per line)">
              <textarea className="input font-mono text-xs" value={lines(w.hideOnUrls)} onChange={(e) => set({ hideOnUrls: unlines(e.target.value) })} placeholder="*/checkout*" />
            </Field>
            <div className="pt-5">
              <Switch checked={w.hideOnMobile} onChange={(v) => set({ hideOnMobile: v })} label="Hide on mobile" />
            </div>
          </div>
        </Card>
        <Card title="Language & text overrides" description="Translate or reword any widget text. Leave blank for defaults.">
          <div className="grid gap-3 sm:grid-cols-2">
            {STRING_KEYS.map((k) => (
              <Field key={k} label={k}>
                <input className="input !py-1.5 text-sm" value={w.strings[k] || ""} onChange={(e) => set({ strings: Object.fromEntries(Object.entries({ ...w.strings, [k]: e.target.value }).filter(([, v]) => v)) })} />
              </Field>
            ))}
          </div>
        </Card>
      </div>
      <div className="xl:sticky xl:top-4 xl:self-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Live preview</span>
            <button
              className="btn-primary btn-sm"
              disabled={!dirty}
              onClick={async () => {
                try {
                  await api("/api/websites/current", { method: "PATCH", json: { widget: w } });
                  setDirty(false);
                  toast("Widget saved — live on your site now");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Failed", "error");
                }
              }}
            >
              <Save className="size-3.5" /> {dirty ? "Save changes" : "Saved"}
            </button>
          </div>
          <iframe ref={frame} src="/widget-preview" title="Widget preview" className="h-[680px] w-full" onLoad={() => setTimeout(push, 200)} />
        </div>
      </div>
    </div>
  );
}
