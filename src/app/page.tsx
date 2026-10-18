import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Bot, Check, Code2, Globe2, Keyboard, Megaphone, MessagesSquare, Paperclip, Radar, ShieldCheck, Sparkles, Users, Webhook, X, Zap } from "lucide-react";
import { Logo, LogoMark } from "@/components/ui";
import { getCtx } from "@/lib/context";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: MessagesSquare, title: "Shared inbox", body: "A calm three-pane inbox with assignments, snooze, tags, private notes, read receipts and a live preview of what visitors are typing." },
  { icon: Sparkles, title: "A widget you fully own", body: "Colors, gradients, dark mode, launcher, pre-chat form, office hours, strings — with a live preview. ~11 KB gzipped, Shadow-DOM isolated." },
  { icon: Radar, title: "Live visitors", body: "See who is on your site right now, the page they're reading, where they came from — and start the conversation yourself." },
  { icon: Users, title: "Contacts & segments", body: "Every visitor becomes a profile: pages, sessions, device, UTM, custom data and events. Save segments, import and export CSV." },
  { icon: Zap, title: "Triggers & routing", body: "“On /pricing for 15s → send a message.” Auto-assign round-robin, offline replies, auto-resolve and a quick-reply routing bot." },
  { icon: Megaphone, title: "Campaigns", body: "Send an in-widget message (and email) to any segment. Track sent, opened and replied without a single tracking pixel." },
  { icon: BookOpen, title: "Help center", body: "Markdown articles in categories, a public help site per website, searchable from inside the widget and suggested by the bot." },
  { icon: BarChart3, title: "Analytics", body: "First response & resolution time, CSAT, busiest hours heatmap, top pages and traffic sources — no heavy chart libraries." },
  { icon: Code2, title: "Developer platform", body: "REST API, signed webhooks with retries & delivery logs, OAuth 2.0 + PKCE apps and an inbound channel API for any bridge." },
];

const COMPARE: [string, boolean | string, boolean | string][] = [
  ["Open source, self-hostable", true, false],
  ["Widget customization with live preview", true, "Partial"],
  ["Live “visitor is typing…” preview", true, "Paid"],
  ["Visitor tracking & live visitors", true, "Paid"],
  ["Segments, triggers & campaigns", true, "Paid"],
  ["Signed webhooks with retries + redelivery log", true, "Partial"],
  ["OAuth 2.0 (PKCE) for third-party apps", true, false],
  ["Inbound API for custom channels", true, false],
  ["Per-seat pricing", "Never", "Yes"],
];

function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(20,184,166,.35),transparent)] blur-2xl" />
      <div className="card overflow-hidden shadow-pop">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff6159]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#28c941]" />
          <span className="ml-3 rounded-md bg-surface px-2 py-0.5 text-[11px] text-faint">your-host/app/inbox</span>
        </div>
        <div className="grid grid-cols-[150px_1fr] text-[12px] sm:grid-cols-[170px_1fr_150px]">
          <div className="border-r border-border bg-surface">
            {[
              ["Maya Fischer", "Can we add 5 seats?", "🇩🇪", 2],
              ["Lucas Moreau", "Export button on iPhone…", "🇫🇷", 0],
              ["Priya Raman", "typing…", "🇮🇳", 1],
              ["Kenji W.", "Thanks, that worked!", "🇯🇵", 0],
            ].map(([n, m, f, u], i) => (
              <div key={i} className={`flex gap-2 border-b border-border px-2.5 py-2.5 ${i === 0 ? "bg-brand-soft/70" : ""}`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-[10px] font-bold text-white">{String(n)[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="truncate">{n}</span> {f}
                  </span>
                  <span className={`block truncate ${m === "typing…" ? "italic text-brand" : "text-muted"}`}>{m}</span>
                </span>
                {Number(u) > 0 && <span className="h-fit rounded-full bg-accent px-1.5 text-[9px] font-bold text-white">{u}</span>}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 bg-bg p-3">
            <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-surface px-3 py-2">Hi! We&apos;d like to add 5 more seats — is that prorated?</div>
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-brand px-3 py-2 text-brand-fg">Yes, prorated to the day 🙌 Want me to add them now?</div>
            <div className="ml-auto w-fit rounded-2xl rounded-tr-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-900">🔒 Note: VIP — loop in finance</div>
            <div className="w-fit rounded-2xl rounded-tl-md border border-dashed border-border bg-surface px-3 py-2 italic text-muted">Yes please, and send the invoice to…</div>
            <div className="mt-auto rounded-xl border border-border bg-surface px-3 py-2 text-faint">
              <span className="font-mono text-brand">/refund</span> Refund policy…
            </div>
          </div>
          <div className="hidden border-l border-border bg-surface p-3 sm:block">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-rose-500 font-bold text-white">M</div>
            <p className="text-center font-semibold">Maya Fischer</p>
            <p className="text-center text-[10px] text-success">● on /pricing</p>
            <div className="mt-3 space-y-1.5 text-[11px] text-muted">
              <p>🇩🇪 Berlin · 14:02</p>
              <p>💻 Chrome on macOS</p>
              <p>↗ google.com</p>
              <p>🔁 7 sessions</p>
              <p className="font-mono text-brand">plan: pro</p>
            </div>
          </div>
        </div>
      </div>
      <div className="animate-floaty absolute -bottom-6 -right-2 hidden w-56 rounded-2xl border border-border bg-surface p-3 text-xs shadow-pop sm:block">
        <div className="mb-2 rounded-xl bg-gradient-to-br from-teal-500 to-[#f97362] p-2.5 text-white">
          <p className="font-bold">Chat with Acme</p>
          <p className="opacity-90">● We reply in minutes</p>
        </div>
        <p className="rounded-xl bg-surface-2 px-2.5 py-1.5">Comparing plans? I can help you pick in 30s 🙂</p>
        <div className="mt-2 flex items-center gap-1.5 text-faint">
          <Paperclip className="size-3" /> Drop files · 😀
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const ctx = await getCtx().catch(() => null);
  const authed = Boolean(ctx);
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <Link href="/" aria-label="ChatCrip home">
            <Logo />
          </Link>
          <nav className="hidden gap-5 text-sm font-medium text-muted md:flex">
            <a href="#features" className="hover:text-text">Features</a>
            <a href="#developers" className="hover:text-text">Developers</a>
            <a href="#compare" className="hover:text-text">Compare</a>
            <Link href="/developers/docs" className="hover:text-text">API docs</Link>
            <Link href="/demo" className="hover:text-text">Live demo</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {authed ? (
              <Link href="/app" className="btn-primary">
                Open inbox <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">Sign in</Link>
                <Link href="/register" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_15%_0%,var(--brand-soft),transparent),radial-gradient(700px_360px_at_95%_20%,var(--accent-soft),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted">
              <span className="size-1.5 rounded-full bg-success" /> Free &amp; open source · MIT
            </span>
            <h1 className="h-display mt-5 text-5xl font-extrabold leading-[1.03] sm:text-6xl">
              Customer chat that feels <span className="bg-gradient-to-r from-teal-500 via-teal-600 to-[#f97362] bg-clip-text text-transparent">instant</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              ChatCrip puts a beautiful chat widget on your site and every conversation in one shared inbox — with live visitor tracking, automations, a help center and an API-first platform your developers will love.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={authed ? "/app" : "/register"} className="btn-primary px-5 py-3 text-base">
                Start free <ArrowRight className="size-4" />
              </Link>
              <Link href="/demo" className="btn-outline px-5 py-3 text-base">
                Try the live widget
              </Link>
            </div>
            <ul className="mt-8 grid max-w-md grid-cols-2 gap-2 text-sm text-muted">
              {["Realtime (SSE) inbox", "~11 KB gzipped widget", "Signed webhooks", "OAuth 2.0 + PKCE"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-brand" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <ProductMock />
        </div>
      </section>

      <section id="features" className="border-t border-border bg-surface py-24">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Everything in one place</p>
          <h2 className="h-display mt-2 max-w-2xl text-4xl font-bold">The whole support stack — without the per-seat tax.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="group rounded-2xl border border-border bg-bg p-6 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card">
                <div className={`mb-4 flex size-11 items-center justify-center rounded-xl ${i % 3 === 1 ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand"}`}>
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-3">
          {[
            { icon: Keyboard, t: "Built for speed", b: "J/K to move, R to reply, E to resolve, “/” for canned replies with {{variables}}. Drafts are saved per conversation." },
            { icon: Globe2, t: "Context on every chat", b: "Country, local time, device, current page, referrer, UTM, custom data and tracked events — next to every message." },
            { icon: ShieldCheck, t: "Secure by default", b: "Signed visitor tokens, hashed API keys & OAuth tokens, SSRF-safe webhooks, sniffed upload types and strict headers." },
          ].map((x) => (
            <div key={x.t}>
              <x.icon className="size-6 text-accent" />
              <h3 className="h-display mt-3 text-2xl font-bold">{x.t}</h3>
              <p className="mt-2 text-muted">{x.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="developers" className="relative overflow-hidden bg-[#0b1114] py-24 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_80%_10%,rgba(20,184,166,.25),transparent),radial-gradient(500px_300px_at_10%_90%,rgba(249,115,98,.18),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-teal-300">Developer platform</p>
            <h2 className="h-display mt-2 text-4xl font-bold">Talk to your customers from anywhere.</h2>
            <p className="mt-4 text-white/70">Everything the dashboard does is an API. Pipe conversations into Slack, answer from your CRM, or build a Telegram bridge with the inbound channel API — then ship it to other teams as an OAuth app.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {(
                [
                  [Code2, "REST API v1 — scoped API keys or OAuth tokens, pagination, rate limits"],
                  [Webhook, "Webhooks — HMAC-SHA256 signed, exponential retries, delivery log & redeliver"],
                  [ShieldCheck, "OAuth 2.0 authorization code + PKCE, refresh rotation, per-website installs"],
                  [Bot, "Inbound API — post visitor messages from any channel; replies come back by webhook"],
                ] as const
              ).map(([Icon, t], i) => (
                <li key={i} className="flex gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-teal-300" /> <span className="text-white/85">{t}</span>
                </li>
              ))}
            </ul>
            <Link href="/developers/docs" className="btn mt-8 bg-white text-[#0b1114] hover:bg-white/90">
              Read the API docs <ArrowRight className="size-4" />
            </Link>
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[.04] p-5 text-[12.5px] leading-relaxed text-teal-50 shadow-2xl">
            <code>
              <span className="text-white/40"># reply to a conversation from your own tool</span>
              {"\n"}curl -X POST https://your-host/api/v1/conversations/$ID/messages \{"\n"}
              {"  "}-H <span className="text-[#ffb4a8]">&quot;Authorization: Bearer cc_key_…&quot;</span> \{"\n"}
              {"  "}-H <span className="text-[#ffb4a8]">&quot;Content-Type: application/json&quot;</span> \{"\n"}
              {"  "}-d <span className="text-[#ffb4a8]">{`'{"text":"Shipped! 📦","from":"operator"}'`}</span>
              {"\n\n"}
              <span className="text-white/40">{"// verify a webhook in Node"}</span>
              {"\n"}
              <span className="text-teal-300">const</span>
              {' [t, v1] = header.split(",").map(p => p.split("=")[1]);\n'}
              <span className="text-teal-300">const</span>
              {" mac = hmac("}
              <span className="text-[#ffb4a8]">&quot;sha256&quot;</span>
              {", secret).update(`${t}.${body}`);\nok = timingSafeEqual(mac.digest(\"hex\"), v1);"}
            </code>
          </pre>
        </div>
      </section>

      <section id="compare" className="py-24">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="h-display text-center text-4xl font-bold">ChatCrip vs. typical chat tools</h2>
          <p className="mt-3 text-center text-muted">The features most tools put behind “Contact sales” — included and open.</p>
          <div className="card mt-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Capability</th>
                  <th className="px-5 py-3 text-center">ChatCrip</th>
                  <th className="px-5 py-3 text-center">Typical chat tool</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([f, a, b]) => (
                  <tr key={f} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">{f}</td>
                    {[a, b].map((v, i) => (
                      <td key={i} className="px-5 py-3 text-center">
                        {v === true ? <Check className="mx-auto size-5 text-success" aria-label="Yes" /> : v === false ? <X className="mx-auto size-5 text-faint" aria-label="No" /> : <span className={i === 0 ? "font-semibold text-brand" : "text-muted"}>{v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-600 via-teal-700 to-[#0b3b37] p-10 text-white md:p-14">
            <div className="absolute -right-10 -top-10 size-64 rounded-full bg-[#f97362]/30 blur-3xl" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-teal-200">Pricing</p>
                <h2 className="h-display mt-2 text-4xl font-bold">Free &amp; open source. Forever.</h2>
                <p className="mt-3 max-w-lg text-white/80">Unlimited agents, websites, conversations and API calls. Deploy to Render + MongoDB Atlas free tiers in about five minutes, or run it anywhere Docker runs.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                <p className="text-5xl font-extrabold">
                  $0<span className="text-lg font-medium text-white/70"> / seat / forever</span>
                </p>
                <Link href={authed ? "/app" : "/register"} className="btn mt-5 w-full bg-white py-3 text-base text-teal-800 hover:bg-white/90">
                  Create your inbox <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 text-sm text-muted">
          <LogoMark size={22} />
          <span>© {new Date().getFullYear()} ChatCrip · MIT licensed</span>
          <span className="ml-auto flex gap-4">
            <Link href="/developers/docs" className="hover:text-text">API docs</Link>
            <Link href="/demo" className="hover:text-text">Demo</Link>
            <Link href="/login" className="hover:text-text">Sign in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
