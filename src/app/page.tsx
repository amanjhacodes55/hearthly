import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Bot, Check, Code2, Github, Globe2, Keyboard, Megaphone, MessagesSquare, Paperclip, Radar, ShieldCheck, Sparkles, Users, Webhook, X, Zap } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/ui";
import { getCtx } from "@/lib/context";
import { SOURCE_URL } from "@/lib/brand";

export const dynamic = "force-dynamic";

const BENTO = [
  { icon: MessagesSquare, title: "One warm, shared inbox", body: "Three calm panes, assignments, snooze, tags, private notes, read receipts and a live preview of what visitors are typing — before they hit send.", span: "lg:col-span-2" },
  { icon: Sparkles, title: "A widget that's yours", body: "Colors, gradients, dark mode, launcher, pre-chat form, office hours and every string — with a live preview. ~11 KB gzipped, Shadow-DOM isolated.", span: "lg:col-span-2" },
  { icon: Radar, title: "See who's at the door", body: "Live visitors, the page they're reading, where they came from — start the conversation yourself.", span: "" },
  { icon: Users, title: "People, not tickets", body: "Every visitor becomes a profile: pages, sessions, device, UTM, custom data and events. Saved segments, CSV import and export.", span: "" },
  { icon: Zap, title: "Gentle automations", body: "“On /pricing for 15s → say hello.” Round-robin assignment, offline replies, auto-resolve and a quick-reply routing bot.", span: "" },
  { icon: Megaphone, title: "Campaigns", body: "In-widget and email messages to any segment, with sent, opened and replied — no tracking pixels.", span: "" },
  { icon: BookOpen, title: "Help center", body: "Markdown articles in categories, a public help site per website, searchable from the widget and suggested by the bot.", span: "lg:col-span-2" },
  { icon: BarChart3, title: "Honest analytics", body: "First response & resolution time, CSAT, busiest-hours heatmap, top pages and traffic sources — no heavy chart libraries.", span: "lg:col-span-2" },
];

const COMPARE: [string, boolean | string, boolean | string][] = [
  ["Open source (AGPL-3.0), self-hostable", true, false],
  ["Widget customization with live preview", true, "Partial"],
  ["Live “visitor is typing…” preview", true, "Paid"],
  ["Visitor tracking & live visitors", true, "Paid"],
  ["Segments, triggers & campaigns", true, "Paid"],
  ["Signed webhooks with retries + redelivery log", true, "Partial"],
  ["OAuth 2.0 (PKCE) for third-party apps", true, false],
  ["Inbound API for custom channels", true, false],
  ["Per-seat pricing", "Never", "Yes"],
];

const EMBERS = [
  { l: "8%", t: "22%", s: 5, d: "0s" },
  { l: "18%", t: "48%", s: 3, d: "1.2s" },
  { l: "31%", t: "12%", s: 4, d: "2.4s" },
  { l: "47%", t: "6%", s: 3, d: "0.6s" },
  { l: "68%", t: "18%", s: 5, d: "1.8s" },
  { l: "83%", t: "42%", s: 4, d: "3s" },
  { l: "93%", t: "16%", s: 3, d: "2.1s" },
];

function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-5xl text-text">
      <div className="card overflow-hidden shadow-pop ring-1 ring-black/5">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff6159]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#28c941]" />
          <span className="ml-3 rounded-md bg-surface px-2 py-0.5 text-[11px] text-muted">your-host/app/inbox</span>
        </div>
        <div className="grid grid-cols-[150px_1fr] text-left text-[12.5px] sm:grid-cols-[210px_1fr_190px]">
          <div className="border-r border-border bg-surface">
            {[
              ["Maya Fischer", "Can we add 5 seats?", "🇩🇪", 2],
              ["Lucas Moreau", "Export button on iPhone…", "🇫🇷", 0],
              ["Priya Raman", "typing…", "🇮🇳", 1],
              ["Kenji Watanabe", "Thanks, that worked!", "🇯🇵", 0],
              ["Sofia Rossi", "Is there a Slack bridge?", "🇮🇹", 0],
            ].map(([n, m, f, u], i) => (
              <div key={i} className={`flex gap-2 border-b border-border px-3 py-3 ${i === 0 ? "bg-brand-soft/80" : ""}`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ember-400 to-plum-700 text-[11px] font-bold text-white">{String(n)[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="truncate">{n}</span> {f}
                  </span>
                  <span className={`block truncate ${m === "typing…" ? "italic text-brand" : "text-muted"}`}>{m}</span>
                </span>
                {Number(u) > 0 && <span className="h-fit rounded-full bg-accent px-1.5 text-[9px] font-bold text-accent-fg">{u}</span>}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 bg-bg p-4">
            <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-surface px-3.5 py-2.5">Hi! We&apos;d like to add 5 more seats — is that prorated?</div>
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-brand px-3.5 py-2.5 text-brand-fg">Yes, prorated to the day 🙌 Want me to add them now?</div>
            <div className="ml-auto w-fit rounded-2xl rounded-tr-md border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-amber-900">🔒 Note: VIP — loop in finance</div>
            <div className="w-fit rounded-2xl rounded-tl-md border border-dashed border-border bg-surface px-3.5 py-2.5 italic text-muted">Yes please, and send the invoice to…</div>
            <div className="mt-auto rounded-xl border border-border bg-surface px-3 py-2.5 text-muted">
              <span className="font-mono text-brand">/refund</span> Refund policy…
            </div>
          </div>
          <div className="hidden border-l border-border bg-surface p-4 sm:block">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-glow to-ember-600 text-lg font-bold text-white">M</div>
            <p className="text-center font-semibold">Maya Fischer</p>
            <p className="text-center text-[11px] text-success">● on /pricing</p>
            <div className="mt-4 space-y-2 text-[11.5px] text-muted">
              <p>🇩🇪 Berlin · 14:02 local</p>
              <p>💻 Chrome on macOS</p>
              <p>↗ google.com · utm: spring</p>
              <p>🔁 7 sessions · 23 pages</p>
              <p className="font-mono text-brand">plan: pro · seats: 12</p>
            </div>
          </div>
        </div>
      </div>
      <div className="animate-floaty absolute -right-3 -top-12 hidden w-60 rounded-2xl border border-border bg-surface p-3 text-left text-xs shadow-pop md:block">
        <div className="mb-2 rounded-xl bg-gradient-to-br from-ember-700 to-[#8e2c5a] p-2.5 text-white">
          <p className="font-bold">Chat with Acme</p>
          <p className="opacity-90">● We reply in minutes</p>
        </div>
        <p className="rounded-xl bg-surface-2 px-2.5 py-1.5">Comparing plans? I can help you pick in 30s 🙂</p>
        <div className="mt-2 flex items-center gap-1.5 text-muted">
          <Paperclip className="size-3" /> Drop files · 😀
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const ctx = await getCtx().catch(() => null);
  const authed = Boolean(ctx);
  const cta = authed ? "/app" : "/register";
  return (
    <div className="min-h-screen overflow-x-hidden bg-bg">
      {/* ---------------- Hero: gather around the hearth ---------------- */}
      <section className="relative isolate bg-plum-900 text-cream">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_100%,rgba(255,107,61,.55),rgba(142,44,90,.25)_45%,transparent_75%),radial-gradient(40%_40%_at_85%_10%,rgba(255,181,71,.12),transparent)]" />
          <div className="absolute inset-0 opacity-[.07] [background-image:radial-gradient(#fff6ea_1px,transparent_1px)] [background-size:22px_22px]" />
          {EMBERS.map((e, i) => (
            <span key={i} aria-hidden className="animate-floaty absolute rounded-full bg-amber-glow/70" style={{ left: e.l, top: e.t, width: e.s, height: e.s, animationDelay: e.d }} />
          ))}
        </div>
        <header className="relative z-40">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
            <Link href="/" aria-label="Hearthly home" className="flex items-center gap-2">
              <LogoMark size={32} />
              <Wordmark className="text-2xl text-cream" />
            </Link>
            <nav className="hidden gap-6 text-sm font-medium text-plum-200 md:flex">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#developers" className="hover:text-white">Developers</a>
              <a href="#compare" className="hover:text-white">Compare</a>
              <Link href="/developers/docs" className="hover:text-white">API docs</Link>
              <Link href="/demo" className="hover:text-white">Live demo</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {authed ? (
                <Link href="/app" className="btn bg-cream text-plum-900 hover:bg-white">
                  Open inbox <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn text-plum-200 hover:bg-white/10 hover:text-white">Sign in</Link>
                  <Link href="/register" className="btn bg-cream text-plum-900 hover:bg-white">Get started</Link>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-plum-200">
            <span className="size-1.5 rounded-full bg-amber-glow shadow-[0_0_10px_2px_rgba(255,181,71,.8)]" /> Free &amp; open source · AGPL-3.0
          </span>
          <h1 className="h-display mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
            Conversations that feel like <span className="bg-gradient-to-r from-amber-glow via-ember-400 to-ember-500 bg-clip-text italic text-transparent">home</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-plum-200">
            Hearthly gathers every visitor, customer and teammate around one warm, realtime inbox — with a chat widget you fully own, live visitor context, gentle automations and an API your developers will love.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href={cta} className="btn bg-gradient-to-r from-ember-500 to-amber-glow px-6 py-3 text-base text-plum-900 shadow-[0_10px_40px_-8px_rgba(255,107,61,.7)] hover:brightness-105">
              Light up your inbox <ArrowRight className="size-4" />
            </Link>
            <Link href="/demo" className="btn border border-white/20 px-6 py-3 text-base text-cream hover:bg-white/10">
              Try the live widget
            </Link>
          </div>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-plum-200">
            {["Realtime (SSE) inbox", "~11 KB widget", "Signed webhooks", "OAuth 2.0 + PKCE", "Self-host in 5 minutes"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-amber-glow" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative px-5">
          <div className="translate-y-16">
            <ProductMock />
          </div>
        </div>
      </section>

      {/* ---------------- Principles ---------------- */}
      <section className="pb-20 pt-36">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-3">
          {[
            { n: "01", t: "Welcome", b: "A widget that matches your brand and greets people by the page they're on — with office hours, a pre-chat form and answers from your help center." },
            { n: "02", t: "Gather", b: "Every channel lands in one shared inbox. Teammates see who's typing, who's assigned and the whole story of each customer — in realtime." },
            { n: "03", t: "Build", b: "Everything is an API: REST v1, signed webhooks, OAuth apps and an inbound channel API for Slack, Telegram, SMS or email bridges." },
          ].map((x) => (
            <div key={x.n} className="relative">
              <span aria-hidden className="h-display block text-6xl font-semibold text-ember-200 dark:text-plum-700">{x.n}</span>
              <h2 className="h-display -mt-5 ml-1 text-3xl font-semibold">{x.t}</h2>
              <p className="mt-3 leading-relaxed text-muted">{x.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Bento features ---------------- */}
      <section id="features" className="border-t border-border bg-surface py-24">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Everything around one fire</p>
          <h2 className="h-display mt-2 max-w-2xl text-4xl font-semibold sm:text-5xl">The whole support stack — without the per-seat tax.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENTO.map((f, i) => (
              <div key={f.title} className={`group relative overflow-hidden rounded-3xl border border-border bg-bg p-6 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card ${f.span}`}>
                <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-ember-500/10 blur-2xl transition group-hover:bg-ember-500/20" />
                <div className={`mb-4 flex size-11 items-center justify-center rounded-2xl ${i % 3 === 1 ? "bg-accent-soft text-[#9a5b00] dark:text-accent" : "bg-brand-soft text-brand"}`}>
                  <f.icon className="size-5" />
                </div>
                <h3 className="h-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 grid gap-10 lg:grid-cols-3">
            {[
              { icon: Keyboard, t: "Built for flow", b: "J/K to move, R to reply, E to resolve, “/” for canned replies with {{variables}}. Drafts are saved per conversation." },
              { icon: Globe2, t: "Context on every chat", b: "Country, local time, device, current page, referrer, UTM, custom data and tracked events — next to every message." },
              { icon: ShieldCheck, t: "Secure by default", b: "Signed visitor tokens, hashed API keys & OAuth tokens, SSRF-safe webhooks, sniffed upload types and strict headers." },
            ].map((x) => (
              <div key={x.t} className="flex gap-4">
                <x.icon className="mt-1 size-6 shrink-0 text-brand" />
                <div>
                  <h3 className="font-bold">{x.t}</h3>
                  <p className="mt-1 text-sm text-muted">{x.b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Developers ---------------- */}
      <section id="developers" className="relative overflow-hidden bg-plum-950 py-24 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_80%_10%,rgba(255,107,61,.22),transparent),radial-gradient(500px_300px_at_10%_90%,rgba(255,181,71,.12),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-ember-300">Developer platform</p>
            <h2 className="h-display mt-2 text-4xl font-semibold sm:text-5xl">Talk to your customers from anywhere.</h2>
            <p className="mt-4 text-white/75">Everything the dashboard does is an API. Pipe conversations into Slack, answer from your CRM, or build a Telegram bridge with the inbound channel API — then share it with other teams as an OAuth app.</p>
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
                  <Icon className="mt-0.5 size-4 shrink-0 text-ember-300" /> <span className="text-white/85">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/developers/docs" className="btn bg-cream text-plum-900 hover:bg-white">
                Read the API docs <ArrowRight className="size-4" />
              </Link>
              <a href={SOURCE_URL} className="btn border border-white/20 text-cream hover:bg-white/10">
                <Github className="size-4" /> Source on GitHub
              </a>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[.04] p-6 text-[12.5px] leading-relaxed text-ember-50 shadow-2xl">
            <code>
              <span className="text-white/50"># reply to a conversation from your own tool</span>
              {"\n"}curl -X POST https://your-host/api/v1/conversations/$ID/messages \{"\n"}
              {"  "}-H <span className="text-ember-200">&quot;Authorization: Bearer hly_key_…&quot;</span> \{"\n"}
              {"  "}-H <span className="text-ember-200">&quot;Content-Type: application/json&quot;</span> \{"\n"}
              {"  "}-d <span className="text-ember-200">{`'{"text":"Shipped! 📦","from":"operator"}'`}</span>
              {"\n\n"}
              <span className="text-white/50">{"// verify a webhook in Node"}</span>
              {"\n"}
              <span className="text-amber-glow">const</span>
              {' { t, v1 } = parse(req.headers["hearthly-signature"]);\n'}
              <span className="text-amber-glow">const</span>
              {" mac = hmac("}
              <span className="text-ember-200">&quot;sha256&quot;</span>
              {", secret).update(`${t}.${rawBody}`);\nok = timingSafeEqual(mac.digest(\"hex\"), v1);"}
            </code>
          </pre>
        </div>
      </section>

      {/* ---------------- Compare ---------------- */}
      <section id="compare" className="py-24">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="h-display text-center text-4xl font-semibold sm:text-5xl">Why Hearthly?</h2>
          <p className="mt-3 text-center text-muted">The features most tools put behind “Contact sales” — included, open and yours to change.</p>
          <div className="card mt-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Capability</th>
                  <th className="px-5 py-3 text-center">Hearthly</th>
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

      {/* ---------------- CTA ---------------- */}
      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-plum-900 p-10 text-cream md:p-14">
            <div className="pointer-events-none absolute -bottom-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,107,61,.5),rgba(142,44,90,.2),transparent)]" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-ember-300">Pricing</p>
                <h2 className="h-display mt-2 text-4xl font-semibold sm:text-5xl">Free &amp; open source. Forever.</h2>
                <p className="mt-3 max-w-lg text-white/80">Unlimited teammates, websites, conversations and API calls. Deploy to Render + MongoDB Atlas free tiers in about five minutes, or run it anywhere Docker runs.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[.06] p-6 backdrop-blur">
                <p className="h-display text-5xl font-semibold">
                  $0<span className="font-sans text-lg font-medium text-white/75"> / seat / forever</span>
                </p>
                <Link href={cta} className="btn mt-5 w-full bg-gradient-to-r from-ember-500 to-amber-glow py-3 text-base text-plum-900 hover:brightness-105">
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
          <span>© 2026 Aman Jha · Hearthly is free software under the AGPL-3.0-or-later</span>
          <span className="ml-auto flex flex-wrap gap-4">
            <a href={SOURCE_URL} className="hover:text-text">Source code</a>
            <Link href="/developers/docs" className="hover:text-text">API docs</Link>
            <Link href="/demo" className="hover:text-text">Demo</Link>
            <Link href="/login" className="hover:text-text">Sign in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
