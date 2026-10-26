<p align="center">
  <img src="public/logo.svg" width="72" alt="Hearthly logo" />
</p>

<h1 align="center">Hearthly</h1>

<p align="center"><b>Open-source customer messaging: a beautiful chat widget, a realtime shared inbox, visitor CRM, automations, a help center — and a developer platform that lets you talk to customers from anywhere.</b></p>

<p align="center">
  Next.js 15 · TypeScript · MongoDB · Server-Sent Events · OAuth 2.0 + PKCE · MIT
</p>

**Live demo:** _coming soon_

![Hearthly inbox](docs/screenshots/inbox.png)

---

## Why Hearthly?

Most chat tools put the useful parts — visitor tracking, triggers, webhooks, an API — behind per-seat plans.
Hearthly ships all of it in one MIT-licensed app you can deploy for free (Render + MongoDB Atlas free tiers)
in about five minutes. It is inspired by tools like Crisp, Intercom and Chatwoot, with its own design and a
focus on two things: **an inbox that is a joy to use**, and **a first-class developer platform**.

See the honest [feature matrix vs Crisp](docs/feature-matrix.md) — what's on par, what's better, what's not there yet.

## Screenshots

| | |
|---|---|
| ![Widget](docs/screenshots/widget.png) **Chat widget** — Shadow-DOM isolated, attachments, ratings, help search | ![Widget settings](docs/screenshots/widget-settings.png) **Widget customization** with a live preview of the real widget |
| ![Canned replies](docs/screenshots/shortcut-menu.png) **`/` canned replies** with `{{variables}}` | ![Live visitors](docs/screenshots/visitors.png) **Live visitors** — who's on the site, which page, start a chat |
| ![Contacts](docs/screenshots/contacts.png) **Contacts & segments** — filter builder, CSV import/export | ![Analytics](docs/screenshots/analytics.png) **Analytics** — FRT, resolution, CSAT, busiest hours, sources |
| ![Automations](docs/screenshots/automations.png) **Triggers & conversation rules** | ![Webhooks](docs/screenshots/webhook-deliveries.png) **Webhooks** — signed deliveries, retries, per-attempt log, redeliver |
| ![Developers](docs/screenshots/developers.png) **Developers** — OAuth apps, API keys | ![API docs](docs/screenshots/api-docs.png) **In-app API docs** with curl / Node / Python |
| ![OAuth consent](docs/screenshots/oauth-consent.png) **OAuth 2.0 consent** for third-party apps (PKCE) | ![Campaigns](docs/screenshots/campaigns.png) **Campaigns** to segments with open/reply tracking |
| ![Help center](docs/screenshots/help-center.png) **Public help center** per website | ![Help center editor](docs/screenshots/help-center-admin.png) **Markdown article editor** with categories |
| ![Dark mode](docs/screenshots/inbox-dark.png) **Dark mode** | ![Demo](docs/screenshots/demo.png) **`/demo`** — try the widget on a fake product site |
| ![Landing](docs/screenshots/landing.png) **Landing page** | ![Mobile](docs/screenshots/mobile-inbox.png) **Responsive** inbox on mobile |

## Features

**Inbox** — three-pane shared inbox (list · thread · visitor profile); open / pending / snoozed / resolved; assign
(round-robin auto-assign optional), tags, snooze with automatic wake-up, private notes, read receipts, live
"visitor is typing…" preview, attachments with image lightbox, drag-and-drop & paste upload, `/` canned replies with
`{{first_name | there}}` templating, per-conversation drafts, keyboard shortcuts (J/K/R/E/A/I, `?`), search across
people and message text, segment & tag filters, browser notifications + sound + unread count in the tab title,
SSE realtime with automatic reconnect and polling fallback, light/dark theme, mobile layout.

**Chat widget** — one `<script>` tag, vanilla JS, Shadow DOM, ~11 KB gzipped. Brand color + gradient, light/dark/auto,
left/right, launcher icon & text, corner radius, welcome message, team avatars, office hours & offline message,
pre-chat form with custom fields, string overrides, branding toggle, sound, auto-open rules, hide on mobile/URLs,
welcome quick replies (routing bot). Visitors can send text, emoji and files, see typing indicators and read receipts,
rate the conversation, email themselves a transcript and search the help center.

**Visitor tracking & CRM** — sessions, SPA-aware page views with time on page, referrer, UTM, device/browser/OS
(handwritten UA parser), location from `cf-ipcountry` / `x-vercel-ip-country` / time zone / `Accept-Language`
(no paid geo-IP), custom data, tracked events. Live visitors page with proactive chat. Contacts list with search,
filter builder, saved segments, CSV import (merge on email) and export, notes, duplicate merge.

**Automations** — visitor triggers (URL glob, time on page, returning, sessions, UTM, referrer, country, language,
device, identified) → send a message, open the widget, tag, assign. Conversation rules: round-robin auto-assign,
offline auto-reply, help-center answer bot, auto-resolve after N days.

**Campaigns** — message a segment in the widget and/or by email; track sent, opened (seen in widget) and replied.

**Help center** — Markdown articles with categories, public site at `/help/<websiteId>`, searchable from the widget,
suggested automatically by the answer bot.

**Analytics** — conversations & unique visitors per day, average first response and resolution time, CSAT with
distribution, busiest-hours heatmap, top pages, traffic sources — hand-rolled SVG/CSS charts with tooltips and table views.

**Developer platform** — REST API v1 (scoped API keys *and* OAuth tokens), signed webhooks with retries and a delivery
log, OAuth 2.0 authorization-code + PKCE for third-party apps, an inbound channel API for custom bridges, and
docs at `/developers/docs`.

**Teams** — multiple websites per account, owner/admin/agent roles, invite links (optionally email-locked).

## Architecture

```mermaid
flowchart LR
  subgraph Customer site
    W["widget.js<br/>(Shadow DOM)"]
  end
  subgraph Browser
    D["Dashboard<br/>(Next.js / React)"]
  end
  subgraph Hearthly ["Hearthly (single Node process)"]
    WA["/api/widget/*<br/>token auth, CORS *"]
    DA["/api/*<br/>NextAuth session"]
    V1["/api/v1/*<br/>API key / OAuth token"]
    OA["/oauth/authorize<br/>/api/oauth/token"]
    BUS(("in-process<br/>event bus"))
    SSE["SSE streams<br/>/api/stream · /api/widget/stream"]
    SCH["scheduler loop<br/>webhook retries · snooze · auto-resolve"]
    WH["webhook sender<br/>HMAC + SSRF guard"]
  end
  DB[("MongoDB<br/>+ GridFS attachments")]
  EXT["3rd-party apps<br/>& channel bridges"]
  RCV["your webhook<br/>endpoints"]

  W -- "REST + EventSource" --> WA
  D -- "fetch + EventSource" --> DA
  EXT -- "Bearer token" --> V1
  EXT -- "authorization code + PKCE" --> OA
  WA & DA & V1 --> DB
  WA & DA & V1 -- publish --> BUS
  BUS --> SSE
  SSE --> W & D
  WA & DA & V1 -- enqueue --> WH
  SCH --> WH
  WH -- "signed POST" --> RCV
```

- **Realtime:** route handlers publish to an in-process `EventEmitter`; SSE endpoints subscribe per website (agents)
  or per contact (visitors). Clients reconnect automatically and fall back to polling. Designed for a single
  instance (Render free tier) — swap the bus for Redis pub/sub to scale horizontally.
- **Background work:** `instrumentation.ts` starts an in-app scheduler (webhook retries every 15 s, snooze wake-ups and
  auto-resolve every 2 min). Deliveries are claimed with an atomic lock so retries never double-send.
- **Attachments** live in MongoDB GridFS — no S3 needed.

## Tech stack

Next.js 15.5 (App Router, standalone output) · React 19 · TypeScript · Tailwind CSS v4 · Mongoose 8 / MongoDB ·
NextAuth v4 (email + password with bcrypt, optional Google) · zod on every input · nodemailer (optional SMTP) ·
lucide icons · Vitest · esbuild (widget bundle). No chart, state or UI-kit libraries.

## Quick start (local)

Requirements: Node 20+, MongoDB 6+ running locally (or an Atlas URI).

```bash
git clone <your-fork-url> hearthly && cd hearthly
npm install
cp .env.example .env.local        # set NEXTAUTH_SECRET; MONGODB_URI defaults to mongodb://127.0.0.1:27017/hearthly_dev
npm run dev                       # http://localhost:3005
```

Register, create a website with **sample data** on, and you'll land in a populated inbox. Open
<http://localhost:3005/demo> (a fake product site running the real widget against an auto-created demo workspace),
or paste your own widget snippet from **Settings → Website & install** into any page.

```bash
npm test            # unit tests (vitest)
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # bundles widget.js with esbuild, then next build
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | **yes** | MongoDB connection string **including the database name**, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/hearthly` |
| `NEXTAUTH_SECRET` | yes (prod) | Session encryption secret (`openssl rand -base64 32`). Render generates it. |
| `NEXTAUTH_URL` | recommended | Public URL. The Docker image falls back to Render's `RENDER_EXTERNAL_URL`. |
| `WIDGET_TOKEN_SECRET` | optional | HMAC key for visitor tokens (defaults to a key derived from `NEXTAUTH_SECRET`). |
| `WEBHOOK_SIGNING_SECRET` | optional | Key used to encrypt webhook signing secrets at rest (defaults to derived). |
| `SMTP_URL` / `SMTP_FROM` | optional | e.g. `smtps://user:pass@smtp.example.com:465`. Without it, emails are logged to the console. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google". |
| `ALLOW_PRIVATE_URLS` | dev only | `true` lets webhooks target localhost/private IPs. **Never enable in production.** |
| `DEMO_WEBSITE_ID` | optional | Public id of the `/demo` workspace (default `demo`). |
| `HEARTHLY_DISABLE_SCHEDULER` | optional | `1` disables the in-app job loop. |

> Rotating `NEXTAUTH_SECRET` / `WIDGET_TOKEN_SECRET` signs everyone out and resets visitor identities;
> rotating `WEBHOOK_SIGNING_SECRET` makes stored webhook secrets unreadable (re-create or rotate them).

## Deploy to Render + MongoDB Atlas (free)

**1. MongoDB Atlas**

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access → Add New Database User** — username + generated password (role: *Read and write to any database*).
3. **Network Access → Add IP Address → `0.0.0.0/0`** (Render's free tier has no static outbound IPs).
4. **Connect → Drivers** — copy the URI and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/hearthly?retryWrites=true&w=majority`
   (URL-encode special characters in the password.)

**2. Render**

1. Push this repo to your GitHub.
2. Render dashboard → **New → Blueprint** → pick the repo. `render.yaml` defines one free Docker web service
   `hearthly` with health check `/api/health` and auto-generated `NEXTAUTH_SECRET`, `WIDGET_TOKEN_SECRET`
   and `WEBHOOK_SIGNING_SECRET`.
3. Paste your **`MONGODB_URI`** when prompted (SMTP / Google are optional) → **Apply**.
4. When the deploy is live, open the URL, register, and paste the widget snippet into your site.

`/api/health` is a **liveness** probe: it always returns `200` and reports `{"db":"up"|"down"}` in the body, so a
database hiccup never blocks a deploy (use `/api/health?strict=1` for a readiness check that returns `503`).
The free tier sleeps after inactivity; the first request wakes it in ~30 s. Hearthly assumes a **single instance**
(in-memory event bus and rate limits).

**Docker anywhere**

```bash
docker build -t hearthly .
docker run -p 10000:10000 -e MONGODB_URI="mongodb+srv://…/hearthly" -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXTAUTH_URL="https://chat.example.com" hearthly
```

## Embedding the widget

```html
<script src="https://YOUR-HOST/widget.js" data-website="YOUR_WEBSITE_ID" async></script>
```

```html
<script>
  // Queue commands before the widget loads…
  window.Hearthly = window.Hearthly || [];
  Hearthly.push(["set", "user:email", "ada@example.com"]);
  Hearthly.push(["set", "user:nickname", "Ada Lovelace"]);
  Hearthly.push(["set", "session:data", [["plan", "pro"], ["seats", 12]]]);
  Hearthly.push(["on", "message:received", (m) => console.log("reply", m.text)]);
</script>
```

After load: `Hearthly.open()`, `.close()`, `.toggle()`, `.show()`, `.hide()`,
`.identify({ email, name, phone, company, avatar, data, user_hash })`, `.track("checkout", { total: 49 })`,
`.send("Hi")`, `.on(event, fn)` / `.off(event, fn)` (`ready`, `open`, `close`, `message:sent`, `message:received`,
`rating:submitted`), `.reset()`.

**Identity verification:** widget identities are unverified, so Hearthly never merges a visitor into an existing
contact just because they typed an email. Pass `user_hash = HMAC-SHA256(identitySecret, lowercase(email))`
(computed server-side; secret in **Settings → Website & install**) to mark an identity as verified and merge history.

## REST API

Create a key in **Settings → API keys** (scopes: `conversations:read`, `conversations:write`, `messages:write`,
`contacts:read`, `contacts:write`, `webhooks:manage`, `website:read`). Keys are shown once and stored as SHA-256 hashes.

```bash
curl https://YOUR-HOST/api/v1/conversations?status=open -H "Authorization: Bearer hly_key_…"

curl -X POST https://YOUR-HOST/api/v1/conversations/$ID/messages \
  -H "Authorization: Bearer hly_key_…" -H "Content-Type: application/json" \
  -d '{"text":"Your order shipped 📦","from":"operator","author_name":"Ops bot"}'

curl -X POST https://YOUR-HOST/api/v1/contacts -H "Authorization: Bearer hly_key_…" -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","tags":["vip"],"data":{"plan":"pro"}}'   # upserts / merges on email
```

| Method | Path | Scope |
|---|---|---|
| GET | `/api/v1/website` | — |
| GET | `/api/v1/conversations` · `/api/v1/conversations/:id` | `conversations:read` |
| PATCH | `/api/v1/conversations/:id` (status, tags, assignee) | `conversations:write` |
| GET | `/api/v1/conversations/:id/messages` | `conversations:read` |
| POST | `/api/v1/conversations/:id/messages` (operator / bot / note) | `messages:write` |
| POST | `/api/v1/inbound` (visitor message from an external channel) | `messages:write` |
| GET / POST | `/api/v1/contacts` · GET / PATCH `/api/v1/contacts/:id` | `contacts:read` / `contacts:write` |
| GET / POST / DELETE | `/api/v1/webhooks` · `/api/v1/webhooks/:id` | `webhooks:manage` |

Errors are always `{"error":{"code","message"}}` (`unauthorized`, `insufficient_scope`, `not_found`,
`validation_failed`, `rate_limited`, …). Lists return `{"data":[…],"pagination":{"page","limit","total","has_more"}}`.
Rate limit: token bucket per token, burst 120, 2 req/s sustained (`X-RateLimit-Remaining`, `Retry-After`).
Full reference with payload samples: **`/developers/docs`** in your deployment.

## Webhooks

Events: `message.received`, `message.sent`, `conversation.created`, `conversation.resolved`, `contact.created`,
`contact.updated`, `visitor.identified`, `rating.submitted`, `campaign.sent` (plus `ping` from the *Send test* button).

Each delivery is a JSON `POST` with `Hearthly-Event`, `Hearthly-Delivery`, `Hearthly-Timestamp` and
`Hearthly-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`. Non-2xx responses are retried with
exponential backoff (30 s, 2 m, 8 m, 32 m, ~2 h, ~8.5 h); every attempt's headers, status, latency and response are
logged in the dashboard with one-click **redeliver**. The body's `id` is stable across retries — use it to dedupe.
Webhook URLs resolving to private / loopback / link-local addresses are rejected (SSRF protection).

```js
// Node — verify against the RAW body
import crypto from "node:crypto";
function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return v1?.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

```python
# Python
import hashlib, hmac, time
def verify(secret: str, raw_body: bytes, header: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    if abs(time.time() - int(parts["t"])) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{parts['t']}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))
```

## OAuth 2.0 apps — talk to customers from other platforms

1. **Register** an app in **Developers** → get `client_id` + `client_secret` (shown once, stored hashed), set
   exact redirect URIs (https, or `http://localhost` for development) and the scopes it may request.
2. **Authorize:** send a workspace owner/admin to
   `/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&scope=conversations:read%20messages:write&state=…&code_challenge=BASE64URL(SHA256(verifier))&code_challenge_method=S256`.
   They pick a website on the consent screen.
3. **Exchange** the single-use code (10 min) at `POST /api/oauth/token` with `grant_type=authorization_code`,
   `code`, `redirect_uri`, `client_id` and either `client_secret` or the PKCE `code_verifier` (public clients must use PKCE).
4. **Call the API** with `Authorization: Bearer hly_at_…` (1 h). Refresh with `grant_type=refresh_token` — refresh
   tokens rotate. Revoke with `POST /api/oauth/revoke`.
5. Admins see the app under **Settings → Installed apps**; uninstalling revokes its tokens and deletes webhooks it created.

Combined with the **inbound API** (`POST /api/v1/inbound`) and the `message.sent` webhook, an app can bridge any
messaging platform into Hearthly. Runnable, dependency-free examples live in [`examples/`](examples):
[`oauth-node`](examples/oauth-node) (full PKCE flow + posting a message), [`webhook-receiver`](examples/webhook-receiver)
(Node + Python signature verification) and [`inbound-bridge`](examples/inbound-bridge) (chat in from your terminal).

## Security notes

- **AuthZ everywhere:** dashboard routes require a NextAuth session *and* membership of the current website; admin-only
  routes check the role. REST routes check token scopes. All inputs validated with zod; JSON bodies capped at 256 KB.
- **Widget isolation:** each visitor gets an HMAC-signed token bound to `website + contact`; widget endpoints only ever
  read/write that visitor's own conversation. CORS `*` is enabled **only** on widget endpoints (token auth, no cookies).
- **Secrets at rest:** API keys, OAuth client secrets, codes and tokens are stored as SHA-256 hashes; webhook signing
  secrets are AES-256-GCM encrypted. Passwords use bcrypt.
- **Uploads:** 10 MB max, extension + MIME allowlist (images, PDF, TXT/CSV, DOCX/XLSX, ZIP — no SVG/HTML), magic-byte
  sniffing, served with the stored `Content-Type`, `Content-Disposition`, `X-Content-Type-Options: nosniff` and a
  sandboxing CSP. Only website members or the owning visitor can download.
- **XSS:** no `dangerouslySetInnerHTML` with user content; Markdown is rendered to React elements with a link-protocol
  allowlist; the widget builds DOM with text nodes.
- **SSRF:** outbound webhook requests resolve DNS and refuse private, loopback, link-local and CGNAT ranges, with no
  redirect following.
- **Abuse:** token-bucket rate limits on login, registration, every public widget endpoint, the token endpoint and the
  REST API. Trigger URL patterns are globs (no user-supplied regex → no ReDoS).
- **Headers:** `X-Frame-Options: DENY` on the dashboard, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Known trade-offs: single-instance in-memory rate limits/event bus; DNS-rebinding between the SSRF check and the
  request is not fully prevented.

## Testing

- `npm test` — unit tests: webhook HMAC signing & verification, OAuth PKCE + code-exchange validation, segment → Mongo
  query builder, trigger matching, UA parsing & geo, visitor-token signing, token bucket, CSV, SSRF guard.
- End-to-end runs (scripted with `fetch` and headless Chrome) cover: register → website → widget visitor with
  attachment → realtime inbox via SSE → canned reply → visitor receives it → resolve → rating; REST with scopes and
  errors; signed webhooks with automatic retry and redelivery; OAuth code + PKCE + refresh rotation + revoke; inbound API.

## Roadmap

- Native email channel (IMAP/inbound parse) and first-party Slack / Telegram / WhatsApp bridges
- Visual chatbot flow builder and optional AI-drafted replies
- Multilingual help center with custom domains; status page
- WebSocket realtime API for third parties; Redis bus for multi-instance deployments
- Scheduled campaigns with an email designer
- Native mobile apps (push notifications)

## ☕ Buy me a coffee

I build Hearthly on my own time and keep it free for everyone. If it saved you time, taught you something, or powers
something you're building, a coffee is the kindest way to say thanks, and every one buys me more hours to build
and improve Hearthly and my other open-source projects.

<img src="https://raw.githubusercontent.com/amanjhacodes55/wick/main/docs/media/upi-qr.png" alt="UPI QR code for 8941951465@axl" width="180" align="right" />

**UPI ID: `8941951465@axl`** (or **+91 8941951465**). Scan the code with Google Pay, PhonePe, Paytm, BHIM or
any UPI app; international payments are welcome too.

However small, every coffee keeps the work going. Thank you!

## License

[MIT](LICENSE)
