# Widget & JS API

The Hearthly chat widget is a single script, `widget.js`, that you embed on your website. It renders the
launcher and chat panel inside a Shadow DOM, exposes a small JavaScript API on `window.Hearthly`, and talks to
the Hearthly server through the `/api/widget/*` endpoints documented below. Those endpoints are CORS-open,
authenticated with a signed **visitor token**, and rate limited per client IP. You can use them to build a
fully custom widget (for example a native mobile chat screen).

Source of truth: `src/widget/widget.js` (the embed), `src/app/api/widget/*/route.ts` (the endpoints),
`src/lib/widgetApi.ts` (CORS, token auth, rate limits) and `src/lib/widgetToken.ts` (token format).

## Contents

- [Embedding the widget](#embedding-the-widget)
- [The `window.Hearthly` JS API](#the-windowhearthly-js-api)
  - [Methods](#methods)
  - [Events](#events)
  - [Command queue: `Hearthly.push([...])`](#command-queue-hearthlypush)
  - [Identity verification (`user_hash`)](#identity-verification-user_hash)
  - [Data the widget stores in the browser](#data-the-widget-stores-in-the-browser)
  - [Widget preview protocol (`hearthly:preview`)](#widget-preview-protocol-hearthlypreview)
- [Widget HTTP API conventions](#widget-http-api-conventions)
- Endpoints
  - [POST /api/widget/session](#post-apiwidgetsession)
  - [GET /api/widget/config](#get-apiwidgetconfig)
  - [GET /api/widget/messages](#get-apiwidgetmessages)
  - [POST /api/widget/messages](#post-apiwidgetmessages)
  - [POST /api/widget/upload](#post-apiwidgetupload)
  - [POST /api/widget/typing](#post-apiwidgettyping)
  - [POST /api/widget/read](#post-apiwidgetread)
  - [POST /api/widget/rate](#post-apiwidgetrate)
  - [POST /api/widget/transcript](#post-apiwidgettranscript)
  - [POST /api/widget/identify](#post-apiwidgetidentify)
  - [POST /api/widget/event](#post-apiwidgetevent)
  - [POST /api/widget/page](#post-apiwidgetpage)
  - [POST /api/widget/ping](#post-apiwidgetping)
  - [POST /api/widget/action](#post-apiwidgetaction)
  - [GET /api/widget/kb](#get-apiwidgetkb)
  - [GET /api/widget/stream](#get-apiwidgetstream)
- [Rate limit summary](#rate-limit-summary)

---

## Embedding the widget

> **Public · stable** — the embed snippet and its attributes are a stable contract.

Paste this once on every page, ideally just before `</body>`:

```html
<script src="https://YOUR-HOST/widget.js" data-website="YOUR_WEBSITE_ID" async></script>
```

Your website id (a short public id such as `k7m2q9xh4tpa`) is shown in **Settings → Website** together with a
ready-to-copy snippet.

| Attribute | Required | Notes |
| --- | --- | --- |
| `src` | yes | Must point at your Hearthly deployment. The widget derives the API origin from this URL, so all API calls go to the host that served `widget.js`. |
| `data-website` | yes | Public website id. If it's unknown, the widget logs `[Hearthly] Unknown website` to the console and renders nothing. |
| `data-preview` | no | `"1"` switches to preview mode, used internally by the dashboard settings page (see [preview protocol](#widget-preview-protocol-hearthlypreview)). Don't set it on real sites. |

How it behaves:

- `widget.js` is served with `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.
- The script only loads once per page (`window.__hearthlyLoaded` guard). It mounts `<div id="hearthly-root">`
  on `document.body` and renders inside an open Shadow DOM, so your CSS never leaks in or out.
- Start-up: `GET /api/widget/config` → mount → `POST /api/widget/session` → connect to
  `GET /api/widget/stream` (SSE). If the SSE stream errors 3 times in a row, the widget switches to polling
  `GET /api/widget/messages` every 5 s and tries SSE again after 30 s.
- While the tab is visible it sends `POST /api/widget/ping` every 30 s, or sooner when a time-based
  [trigger](triggers.md) is about to fire. History API navigation (`pushState`, `replaceState`, `popstate`,
  `hashchange`) is reported with `POST /api/widget/page`, so single-page apps get page views without extra code.
- Widget settings from the dashboard are applied at load: colors, position, launcher icon/text, `hideOnMobile`
  (≤ 640 px), `hideOnUrls` and `autoOpenOnUrls` (glob patterns matched against the full URL), `autoOpenAfterSec`
  (only once per browser), pre-chat form, quick replies, attachments, rating, transcript and help-center search.

---

## The `window.Hearthly` JS API

> **Public · stable** — `window.Hearthly` methods, events and queue commands are a stable contract; new
> methods/events may be added.

As soon as `widget.js` executes, `window.Hearthly` is replaced with the API object below (an alias
`window.$hearthly = { push }` is also defined). Most methods do nothing useful until the widget has finished
booting. Calls that need the visitor session (`identify`, `track`) are queued until then. To be safe, use the
[`ready` event](#events) or the [command queue](#command-queue-hearthlypush).

### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `Hearthly.open()` | `undefined` | Opens the chat panel. Emits `open` if the panel was closed. Opening also marks operator messages as read (`POST /api/widget/read`). |
| `Hearthly.close()` | `undefined` | Closes the panel. Emits `close` if it was open. |
| `Hearthly.toggle()` | `undefined` | Opens if closed, closes if open. |
| `Hearthly.isOpen()` | `boolean` | Whether the panel is currently open. |
| `Hearthly.show()` | `undefined` | Shows the widget (launcher + panel) if it was hidden. |
| `Hearthly.hide()` | `undefined` | Hides the whole widget (`display: none` on the host element). The conversation keeps running in the background. Note: an SPA navigation re-applies `hideOnUrls`, which can show the widget again. |
| `Hearthly.on(event, fn)` | `Hearthly` | Subscribes to an [event](#events). Chainable. |
| `Hearthly.off(event, fn)` | `Hearthly` | Removes a handler previously passed to `on`. Chainable. |
| `Hearthly.identify(profile)` | `Promise` | Sets visitor details. See below. Resolves with the [`/api/widget/identify`](#post-apiwidgetidentify) response (`{ ok, verified, visitor }`). If called before the session exists, the call is queued and the promise resolves immediately with `undefined`. Rejects with an `Error` (server message) on validation errors. |
| `Hearthly.track(name, props?)` | `Promise` (or queued) | Records a custom event (see [`/api/widget/event`](#post-apiwidgetevent)). Errors are swallowed. Before the session exists the call is queued (and the return value is not a promise). |
| `Hearthly.send(text)` | `undefined` | Sends `text` as a visitor message, exactly as if the visitor typed it. Ignored if `text` is empty or the session isn't ready yet. |
| `Hearthly.reset()` | `undefined` | Forgets the visitor: clears the stored token and pre-chat flag, closes the SSE stream and starts a new anonymous session. Use this on logout. (`ready` is not emitted again.) |
| `Hearthly.push(command)` | `undefined` | Runs a [queue command](#command-queue-hearthlypush). |

`identify(profile)` accepts:

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Valid email, ≤ 200 chars. Stored lowercase. `""` is ignored. |
| `name` | string | ≤ 100 chars. |
| `phone` | string | ≤ 40 chars. |
| `company` | string | ≤ 100 chars. |
| `avatar` | string | URL ≤ 500 chars. Only stored if it starts with `https://`. |
| `data` | object | Custom attributes. Values must be string (≤ 500), number, boolean or `null`. Up to 50 keys are kept, and keys must match `^[A-Za-z0-9_-]{1,60}$` (others are silently dropped). Merged into the contact's `data`. |
| `user_hash` | string | Optional HMAC for [identity verification](#identity-verification-user_hash). |

```js
Hearthly.on("ready", ({ visitor }) => {
  if (!visitor.email) {
    Hearthly.identify({ email: "ada@example.test", name: "Ada Lovelace", data: { plan: "pro", seats: 5 } });
  }
});
Hearthly.track("checkout:started", { cart_value: 129.5, currency: "EUR" });
document.querySelector("#help").addEventListener("click", () => Hearthly.open());
```

### Events

Subscribe with `Hearthly.on(name, fn)` or the queue command `["on", name, fn]`. Exceptions thrown inside your
handler are caught and logged, so they never break the widget.

| Event | Payload | When |
| --- | --- | --- |
| `ready` | `{ visitor: { id, name, email, phone } }` | Once, after the first successful `POST /api/widget/session`. |
| `open` | none (`undefined`) | The panel opened (launcher click, `open()`, a trigger, auto-open or an incoming operator message). |
| `close` | none (`undefined`) | The panel closed. |
| `message:sent` | [Message](#message-object) | The server accepted a visitor message (typed, `send()`, or a welcome quick reply). |
| `message:received` | [Message](#message-object) | An operator or bot message arrived (via SSE or polling). See the note below. |
| `rating:submitted` | `{ score }` (1–5) | The visitor submitted the end-of-conversation rating card. |

> **Note:** When the panel is closed and an **operator** message arrives on a screen wider than 640 px, the
> widget pops itself open and emits `open`, but in the current code it returns before emitting
> `message:received` for that message. Listen to `open` as well if you need to catch proactive messages.

```js
Hearthly.on("message:received", (m) => analytics.track("support_reply", { from: m.from }))
        .on("rating:submitted", ({ score }) => console.log("CSAT", score));
```

### Command queue: `Hearthly.push([...])`

Use the queue when your code may run **before** `widget.js` has loaded. Define `window.Hearthly` as an array
and push commands into it. When the widget loads, it replays them after config and session boot. If loading
fails, it replays them anyway. Once the widget is loaded, `Hearthly.push(cmd)` runs a command immediately.

```html
<script>
  window.Hearthly = window.Hearthly || [];
  Hearthly.push(["set", "user:email", ["ada@example.test"]]);
  Hearthly.push(["set", "user:nickname", ["Ada Lovelace"]]);
  Hearthly.push(["set", "session:data", [["plan", "pro"], ["seats", 5]]]);
  Hearthly.push(["set", "session:event", [["signed_up", { source: "pricing" }]]]);
  Hearthly.push(["on", "message:received", function (m) { console.log(m.text); }]);
  Hearthly.push(["do", "chat:open"]);
</script>
<script src="https://YOUR-HOST/widget.js" data-website="YOUR_WEBSITE_ID" async></script>
```

A command is an array `[verb, key, value]`. Every supported command:

| Command | Equivalent | Value format |
| --- | --- | --- |
| `["set", "user:email", v]` | `identify({ email })` | `"x"` or `["x"]` (first element used) |
| `["set", "user:nickname", v]` | `identify({ name })` | same |
| `["set", "user:name", v]` | `identify({ name })` | same |
| `["set", "user:phone", v]` | `identify({ phone })` | same |
| `["set", "user:company", v]` | `identify({ company })` | same |
| `["set", "user:avatar", v]` | `identify({ avatar })` | same (`https://` URL) |
| `["set", "session:data", v]` | `identify({ data })` | `[["key", value], …]`, a single pair `["key", value]`, or an object `{ key: value }` |
| `["set", "session:event", v]` | `track(name, props)` per event | `[["name", { props }], …]` or a single `["name", { props }]` |
| `["do", "chat:open"]` | `open()` | — |
| `["do", "chat:close"]` | `close()` | — |
| `["do", "chat:toggle"]` | `toggle()` | — |
| `["do", "chat:show"]` | `show()` | — |
| `["do", "chat:hide"]` | `hide()` | — |
| `["do", "message:send", v]` | `send(text)` | `"Hello"`, `["Hello"]`, or `["text", "Hello"]` (the second element wins when present) |
| `["do", "session:reset"]` | `reset()` | — |
| `["on", event, fn]` | `on(event, fn)` | function |
| `["off", event, fn]` | `off(event, fn)` | function |

Unknown verbs/keys and non-array commands are ignored silently. The `set user:*` commands cannot carry a
`user_hash`, so identities set through the queue are always **unverified**. Use `Hearthly.identify({ …, user_hash })`
for verified identities.

### Identity verification (`user_hash`)

By default, an identity set from the browser is **unverified**. Hearthly stores the email on the current
visitor but never merges them into an existing contact with the same email. Without this rule, anyone could
type a customer's email and read that customer's conversation history.

To link a logged-in user's sessions safely, compute a `user_hash` **on your server** and pass it with the
email:

- Algorithm: HMAC-SHA256, hex-encoded (64 lowercase hex chars).
- Key: your website's **identity secret**, as the UTF-8 string shown in **Settings → Website** (admins only;
  also returned to admins as `identitySecret` by `GET /api/websites/current`). Every website gets a random
  secret when it is created. **Rotate secret** issues a new one, and hashes made with the old secret stop
  verifying.
- Message: the email address lowercased (`email.toLowerCase()`), exactly as you send it. Don't add whitespace,
  because the server lowercases but does not trim before hashing.

```js
// Node.js (server side)
const crypto = require("crypto");
const user_hash = crypto.createHmac("sha256", process.env.HEARTHLY_IDENTITY_SECRET)
  .update(user.email.toLowerCase())
  .digest("hex");
```

```python
# Python (server side)
import hmac, hashlib
user_hash = hmac.new(HEARTHLY_IDENTITY_SECRET.encode(), user.email.lower().encode(), hashlib.sha256).hexdigest()
```

```js
// In the page
Hearthly.identify({ email: "ada@example.test", name: "Ada Lovelace", user_hash: "<from your server>" });
```

When the hash matches (constant-time comparison), `/api/widget/identify` returns `"verified": true`. If the
email is **new for this visitor**, older contacts with the same email are merged into the current one: their
conversations and page views move over, session counts are added, tags are unioned, and the older contacts
are marked as merged. Merging only happens when the email changes on the current contact, so a visitor who
already set the same email without a hash is not merged retroactively.

### Data the widget stores in the browser

| Storage | Key | Content |
| --- | --- | --- |
| `localStorage` | `hearthly:<websiteId>:token` | The visitor token (reused on every page and visit) |
| `localStorage` | `hearthly:<websiteId>:prechat` | `"1"` once the pre-chat form was submitted |
| `localStorage` | `hearthly:<websiteId>:autoopened` | `"1"` once the auto-open timer fired (auto-open happens once per browser) |
| `sessionStorage` | `hearthly:<websiteId>:sid` | Random per-tab session id. A new value counts as a new **session** (see [visitors.md](visitors.md)). |

### Widget preview protocol (`hearthly:preview`)

> **Internal — may change.** Used by the dashboard's widget settings page to render a live preview. It is
> restricted to the Hearthly origin, so it cannot drive a widget embedded on a third-party site.

The settings page embeds `/widget-preview` in an iframe. That page loads
`<script src="/widget.js" data-website="preview" data-preview="1">`. In preview mode the widget makes **no
API calls**: no config fetch, no session, no SSE.

1. The widget, when framed, posts `{ type: "hearthly:preview-ready" }` to `window.parent`, with the Hearthly
   origin as the target origin.
2. The parent answers (and re-sends on every settings change) with:

   ```js
   iframe.contentWindow.postMessage({
     type: "hearthly:preview",
     config: {                       // same shape as GET /api/widget/config
       website: { id: "preview", name: "Acme", logo: "" },
       widget: { /* widget settings object */ },
       team: [{ name: "Maya", avatar: "" }],
       status: { online: true, withinHours: true },
       help: "/help/k7m2q9xh4tpa"
     }
   }, location.origin);
   ```

3. The widget accepts the message only if `event.origin` equals the widget's own origin. It then renders the
   panel open with two sample messages and re-renders on each new config.

---

## Widget HTTP API conventions

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

- **Base URL**: `https://YOUR-HOST/api/widget/…` (locally `http://localhost:3005`). Examples use
  `$HEARTHLY_URL` and `$TOKEN` (a visitor token from `POST /api/widget/session`).
- **CORS**: every response carries `Access-Control-Allow-Origin: *`,
  `Access-Control-Allow-Methods: GET,POST,OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Hearthly-Token`,
  `Access-Control-Max-Age: 86400`. Preflight `OPTIONS` returns `204`. No cookies are used. JSON responses
  are `Cache-Control: no-store`.
- **Visitor token**: send it in the `Hearthly-Token` header. Where you can't set headers (`EventSource`,
  `<img src>`), use the `?token=` query parameter. The format is
  `v1.<websiteId>.<contactId>.<issuedAtSec>.<signature>`. Tokens are HMAC-SHA256 signed with a server secret
  (`WIDGET_TOKEN_SECRET`, falling back to `NEXTAUTH_SECRET`) and valid for **400 days** from issue. A token
  only grants access to its own visitor (contact) and that visitor's conversations. Treat it as opaque.
- **Errors**: `{ "error": "message" }`. Errors shared by all token-authenticated endpoints:

  | Status | `error` | Cause |
  | --- | --- | --- |
  | 401 | `Invalid visitor token` | Missing, malformed, expired or forged token |
  | 401 | `Visitor not found` | The token's contact no longer exists in that website |
  | 404 | `Unknown website` | The token's website no longer exists |
  | 429 | `Too many requests` | Rate limit hit. `Retry-After` header in seconds. |
  | 500 | `Something went wrong` / `Database unavailable — please retry shortly.` | Server error |

- **Rate limits**: in-memory token buckets keyed by **client IP + endpoint bucket**, checked before the
  token. *Capacity* is the burst size and *refill* is how many requests per second are restored. Because the
  buckets live in memory, they are per server instance and reset on restart. See the
  [summary table](#rate-limit-summary) and [README.md#rate-limits](README.md#rate-limits).
- Unlike dashboard endpoints, widget JSON bodies are parsed leniently. Invalid JSON is treated as `{}` and then
  fails validation with the endpoint's own message.

### Message object

Messages use the shared serializer (`sMessage`), the same shape as in REST v1, webhooks and SSE:

```json
{
  "id": "6701a40bc4e5d60012ab34d9",
  "conversation_id": "6701a3f9c4e5d60012ab34d2",
  "from": "operator",
  "author": { "id": "66ff12aa9b3c4d0011ef5678", "name": "Maya Chen", "avatar": "" },
  "text": "Hi Ada! Yes, you can switch plans at any time.",
  "attachments": [],
  "actions": [],
  "via": "",
  "created_at": "2026-10-11T09:42:17.204Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | 24-hex id |
| `conversation_id` | string | |
| `from` | `"visitor"` \| `"operator"` \| `"bot"` | Visitors never see `note` or `system` messages |
| `author` | object \| null | `{ id, name, avatar }`. `id` is `null` for bots. |
| `text` | string | Plain text (the widget auto-links `http(s)` URLs) |
| `attachments` | array | `{ id, name, size, type }`. Download via [`GET /api/files/{id}?token=`](attachments.md#get-apifilesid) |
| `actions` | array | Quick-reply buttons `{ label }`. Click one with [`/api/widget/action`](#post-apiwidgetaction). |
| `via` | string | Origin hint, e.g. `"trigger:Pricing nudge"`, `"campaign:October update"`, an API app name |
| `created_at` | string | ISO 8601 |

### Visitor conversation object

The visitor sees only a slice of the conversation:

```json
{ "id": "6701a3f9c4e5d60012ab34d2", "status": "open", "unread": 1, "rating": null, "created_at": "2026-10-11T09:40:02.511Z" }
```

`status` is `open`, `pending` or `resolved`. `unread` is the number of operator/bot messages the visitor
hasn't read. `rating` is `null` or `{ score, comment, at }`.

### Site status object

Returned by `session` and `ping`:

```json
{ "online": true, "withinHours": true, "agentsOnline": 2 }
```

`withinHours` is `true` when availability hours are disabled or the current time (in the website's timezone)
is inside a configured slot. `agentsOnline` counts team members with the dashboard open (an open
`/api/stream` connection). `online` = `withinHours && agentsOnline > 0`.

---

## POST /api/widget/session

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Starts or resumes a visitor session. Returns the visitor token, the visitor's current
conversation with its latest messages, and the live status. It also records a page view (when `url` is given)
and evaluates [triggers](triggers.md). This is the only way to obtain a visitor token. There is no `GET`
variant.

On resume (valid `token` for this website whose contact still exists and wasn't merged), the **same token** is
returned. Otherwise a new contact is created and a new token issued. A `sessionId` different from the one last
stored increments the contact's `sessions` count and refreshes its referrer/UTM attribution.

**Auth.** None (the website id is public). **Rate limit:** bucket `session`, capacity 30, refill 0.5/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `website` | string | yes | Public website id, `^[a-z0-9_-]{3,40}$` (case-insensitive) |
| `token` | string \| null | no | Previously issued visitor token (≤ 200 chars). Invalid tokens are ignored and a new visitor is created. |
| `sessionId` | string | no | ≤ 64 chars, default `""`. Per-tab session id. |
| `url` | string | no | ≤ 2000, default `""`. Current page URL. UTM parameters are read from it. |
| `title` | string | no | ≤ 300, default `""` |
| `referrer` | string | no | ≤ 2000, default `""`. Only stored as the contact's referrer when its host differs from `url`'s host. |
| `timezone` | string | no | ≤ 64, IANA zone such as `Europe/Berlin`. Used for country/city. |
| `language` | string | no | ≤ 32, e.g. `en-GB` |

Country is taken from `cf-ipcountry` / `x-vercel-ip-country` headers when present. Otherwise it is derived from
the timezone or the language region. Browser, OS and device type come from the `User-Agent`.

**Example request**

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/session" \
  -H 'Content-Type: application/json' \
  -d '{"website":"k7m2q9xh4tpa","sessionId":"q8z1k3m0lx9a","url":"https://shop.example.test/pricing?utm_source=newsletter","title":"Pricing","referrer":"https://news.example.test/","timezone":"Europe/Berlin","language":"de-DE"}'
```

**Example response** `200`

```json
{
  "token": "v1.k7m2q9xh4tpa.6701a3f2c4e5d60012ab34cd.1791800000.Wm4cQ0b1v7kL2pXn9eRtYz3aHs5dFg8J",
  "visitor": { "id": "6701a3f2c4e5d60012ab34cd", "name": "", "email": "", "phone": "" },
  "conversation": null,
  "messages": [],
  "status": { "online": true, "withinHours": true, "agentsOnline": 2 },
  "open": false,
  "nextCheckSec": 25
}
```

| Field | Notes |
| --- | --- |
| `token` | Visitor token. Store it and send it back as `token` on later visits. |
| `visitor` | `{ id, name, email, phone }` |
| `conversation` | [Visitor conversation](#visitor-conversation-object): the latest non-resolved one, else the latest one, else `null` |
| `messages` | Up to the latest 100 `visitor`/`operator`/`bot` [messages](#message-object), oldest first |
| `status` | [Site status](#site-status-object) |
| `open` | `true` if a trigger asked to open the widget (an `open` or `message` action fired) |
| `nextCheckSec` | Seconds until a `time_on_page` trigger could fire, or `null`. Ping again around then. |

**Errors**

| Status | `error` |
| --- | --- |
| 400 | Validation message, e.g. `website: Invalid` |
| 404 | `Unknown website` |
| 429 | `Too many requests` |
| 500 | `Something went wrong` / `Database unavailable — please retry shortly.` |

---

## GET /api/widget/config

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Public appearance and behaviour settings for a website. It contains no secrets and needs no
token.

**Auth.** None. **Rate limit:** bucket `config`, capacity 60, refill 2/s.

**Query**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `website` | string | yes | Public website id, `^[a-z0-9_-]{3,40}$` |

**Example request**

```bash
curl -s "$HEARTHLY_URL/api/widget/config?website=k7m2q9xh4tpa"
```

**Example response** `200`

```json
{
  "website": { "id": "k7m2q9xh4tpa", "name": "Acme Shop", "logo": "" },
  "widget": {
    "color": "#c2410c",
    "accent": "#8e2c5a",
    "gradient": true,
    "theme": "auto",
    "position": "right",
    "launcherIcon": "hearth",
    "launcherText": "",
    "radius": 18,
    "title": "Chat with Acme Shop",
    "welcome": "Hi there 👋 How can we help today?",
    "teamName": "",
    "showTeam": true,
    "showBranding": true,
    "sound": true,
    "hideOnMobile": false,
    "hideOnUrls": [],
    "autoOpenAfterSec": 0,
    "autoOpenOnUrls": [],
    "preChat": { "enabled": false, "fields": [] },
    "strings": {},
    "locale": "en",
    "allowAttachments": true,
    "allowRating": true,
    "allowTranscript": true,
    "kbSearch": true,
    "quickReplies": [
      { "label": "Billing question", "reply": "Our billing team will be with you shortly.", "tag": "billing" }
    ]
  },
  "team": [{ "name": "Maya", "avatar": "" }, { "name": "Jon", "avatar": "https://cdn.example.test/jon.png" }],
  "status": { "online": true, "withinHours": true, "offlineMessage": "We're away right now — leave a message and we'll reply by email." },
  "help": "/help/k7m2q9xh4tpa"
}
```

| Field | Notes |
| --- | --- |
| `widget` | The website's widget settings merged over defaults (the fields above). `strings` overrides UI labels (keys such as `title`, `placeholder`, `send`, `online`, `away`, `offline`, `help`, `rateTitle`, `transcript`, `leaveEmail`, `poweredBy`, …). `preChat.fields[]` = `{ key, label, type: "text"\|"email"\|"tel"\|"textarea", required }`. `quickReplies[]` = `{ label, reply, tag }` shown as buttons before the first message. Settings are edited via `PATCH /api/websites/current` (see [websites.md](websites.md)). |
| `team` | Up to 5 members' first names and avatars, or `[]` when `showTeam` is off |
| `status` | `online`, `withinHours` (as in [site status](#site-status-object)) and the configured `offlineMessage` |
| `help` | Path of the public [help center](knowledge-base.md#public-help-center-pages) |

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid website id` |
| 404 | `Unknown website` |
| 429 | `Too many requests` |
| 500 | `Something went wrong` / `Database unavailable — please retry shortly.` |

---

## GET /api/widget/messages

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** The polling fallback. Returns messages of the visitor's current conversation newer than `since`.
The widget uses it when SSE is unavailable and to catch up after (re)connecting the stream.

**Auth.** Visitor token. **Rate limit:** bucket `poll`, capacity 40, refill 0.5/s (sustained polling every
2 s or slower).

**Query**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `since` | ISO 8601 string | no | Only messages with `created_at` strictly after this. Invalid or empty values are ignored, so the latest messages are returned. |

The response contains at most the **newest 100** matching messages, in chronological order. Only `visitor`,
`operator` and `bot` messages are included.

**Example request**

```bash
curl -s "$HEARTHLY_URL/api/widget/messages?since=2026-10-11T09:40:00.000Z" -H "Hearthly-Token: $TOKEN"
```

**Example response** `200`

```json
{
  "conversation": { "id": "6701a3f9c4e5d60012ab34d2", "status": "open", "unread": 1, "rating": null, "created_at": "2026-10-11T09:40:02.511Z" },
  "messages": [
    {
      "id": "6701a40bc4e5d60012ab34d9",
      "conversation_id": "6701a3f9c4e5d60012ab34d2",
      "from": "operator",
      "author": { "id": "66ff12aa9b3c4d0011ef5678", "name": "Maya Chen", "avatar": "" },
      "text": "Hi Ada! Yes, you can switch plans at any time.",
      "attachments": [],
      "actions": [],
      "via": "",
      "created_at": "2026-10-11T09:42:17.204Z"
    }
  ]
}
```

With no conversation yet: `{ "conversation": null, "messages": [] }`.

**Errors**: common token errors only (see [conventions](#widget-http-api-conventions)).

---

## POST /api/widget/messages

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Sends a visitor message. If the visitor has no conversation yet, one is created (and
auto-assigned if round-robin is on). Sending into a resolved or snoozed conversation re-opens it.

Visitor messages run the website's automations unless a quick reply was used. While no agent is online, these
are the offline auto-reply and help-center article suggestions, at most once per 30 minutes per conversation.
They also trigger the `message.received` [webhook](webhooks.md) and are pushed to agents over SSE.

**Auth.** Visitor token. **Rate limit:** bucket `send`, capacity 20, refill 0.5/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | string | no* | ≤ 5000 chars, default `""`. Trimmed. |
| `attachments` | array | no* | ≤ 5 items, default `[]`. Each `{ id, name, size, type }`: `id` 24-hex from [`/api/widget/upload`](#post-apiwidgetupload) (must have been uploaded **by this visitor**), `name` ≤ 200, `size` ≤ 10 485 760, `type` ≤ 120. |
| `quickReply` | integer | no | 0–10. Index into the config's `widget.quickReplies`. When it matches, the conversation is tagged with the quick reply's `tag`, its `reply` is posted instantly as a bot message, and automations are skipped. Out-of-range indexes are ignored. |

\* At least one of `text` (non-blank) or `attachments` is required.

**Example request**

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/messages" \
  -H "Hearthly-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"Hi! Can I change my plan later?","attachments":[{"id":"6701a45ec4e5d60012ab34e7","name":"invoice.pdf","size":48213,"type":"application/pdf"}]}'
```

**Example response** `200`

```json
{
  "message": {
    "id": "6701a3fac4e5d60012ab34d4",
    "conversation_id": "6701a3f9c4e5d60012ab34d2",
    "from": "visitor",
    "author": { "id": "6701a3f2c4e5d60012ab34cd", "name": "Visitor", "avatar": "" },
    "text": "Hi! Can I change my plan later?",
    "attachments": [{ "id": "6701a45ec4e5d60012ab34e7", "name": "invoice.pdf", "size": 48213, "type": "application/pdf" }],
    "actions": [],
    "via": "",
    "created_at": "2026-10-11T09:40:02.630Z"
  },
  "conversation": { "id": "6701a3f9c4e5d60012ab34d2", "status": "open", "unread": 0, "rating": null, "created_at": "2026-10-11T09:40:02.511Z" }
}
```

`conversation` reflects the state **before** this message was stored. For example, a resolved conversation
still shows `"resolved"` here even though the message re-opened it.

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid message` (schema), `Empty message`, `Unknown attachment` |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/upload

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Uploads a visitor attachment. The response is the attachment object to pass in
`POST /api/widget/messages`. Full rules (allowed types, sniffing, size) are in
[attachments.md](attachments.md#post-apiwidgetupload).

**Auth.** Visitor token (header). **Rate limit:** bucket `upload`, capacity 10, refill 0.1/s (one every 10 s
sustained).

**Body.** `multipart/form-data` with one file in field **`file`**, ≤ 10 MB.

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/upload" -H "Hearthly-Token: $TOKEN" -F "file=@invoice.pdf"
```

**Example response** `201`

```json
{ "id": "6701a45ec4e5d60012ab34e7", "name": "invoice.pdf", "size": 48213, "type": "application/pdf" }
```

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `No file uploaded (field name: file)`, `File is empty`, `File is larger than 10 MB`, `.exe files aren't allowed`, `File type doesn't match its extension`, `File contents don't match its type` |
| 403 | `Attachments are disabled` (widget setting `allowAttachments: false`) |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/typing

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Tells agents the visitor is typing and includes a live preview of the draft ("message peek").
Nothing is stored. The update is published as a `typing` [SSE event](realtime.md#typing) to the dashboard,
and only when the visitor already has a conversation. The widget sends `typing: true` at most every 1.5 s
while typing and `typing: false` after 3 s idle.

**Auth.** Visitor token. **Rate limit:** bucket `typing`, capacity 60, refill 2/s.

**Body** (JSON, not validated)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `typing` | boolean | no | Truthy = typing. Default `false`. |
| `preview` | string | no | Current draft. Truncated to 200 chars. |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/typing" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"typing":true,"preview":"Can I change my pl"}'
```

**Example response** `200`

```json
{ "ok": true }
```

**Errors**: common token errors only.

---

## POST /api/widget/read

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Marks the visitor's current conversation as read by the visitor. It resets the visitor unread
count, sets `visitor_read_at`, and publishes a `read` SSE event to agents (read receipt). If the conversation
came from a [campaign](campaigns.md), the delivery is marked opened (`stats.opened` +1, once per delivery).
The widget calls it when the panel is open and the tab visible.

**Auth.** Visitor token. **Rate limit:** bucket `read`, capacity 60, refill 1/s.

**Body.** None (send `{}`).

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/read" -H "Hearthly-Token: $TOKEN" -H 'Content-Type: application/json' -d '{}'
```

**Example response** `200`. The same response is returned when there is no conversation.

```json
{ "ok": true }
```

**Errors**: common token errors only.

---

## POST /api/widget/rate

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Rates the visitor's current conversation (CSAT). Rating again overwrites the previous rating.
Publishes a `conversation` SSE event and the `rating.submitted` [webhook](webhooks.md). The widget shows the
rating card when the conversation is `resolved` and `allowRating` is on, but the endpoint accepts a rating in
any status.

**Auth.** Visitor token. **Rate limit:** bucket `rate`, capacity 10, refill 0.1/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `score` | integer | yes | 1–5 |
| `comment` | string | no | ≤ 1000, default `""` |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/rate" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"score":5,"comment":"Super quick, thanks!"}'
```

**Example response** `200`

```json
{ "ok": true, "rating": { "score": 5, "comment": "Super quick, thanks!", "at": "2026-10-11T10:05:44.118Z" } }
```

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Score must be 1–5` (any validation failure) |
| 404 | `No conversation to rate` |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/transcript

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Emails the visitor a plain-text transcript of their current conversation: up to 500
visitor/operator/bot messages, with attachments listed by name. Emails go out through `SMTP_URL`. When SMTP
isn't configured, the email is written to the server log instead and `delivery` is `"logged"`.

**Auth.** Visitor token. **Rate limit:** bucket `transcript`, capacity **3**, refill 0.01/s (about one per
100 s after the burst).

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | yes | Valid email, ≤ 200. It doesn't need to match the visitor's stored email. |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/transcript" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"email":"ada@example.test"}'
```

**Example response** `200`

```json
{ "ok": true, "delivery": "email" }
```

`delivery` is `"email"` (sent via SMTP) or `"logged"` (SMTP not configured).

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Enter a valid email` |
| 404 | `No conversation yet` |
| 401/404/429/500 | Common token errors. An SMTP failure surfaces as `500`. |

---

## POST /api/widget/identify

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Sets visitor identity and custom data. It is used by `Hearthly.identify()`, the pre-chat form and
the "get notified by email" card. See [identity verification](#identity-verification-user_hash) for
`user_hash`. Publishes a `contact` SSE event and the `contact.updated` webhook. The first time an email is
set, it also fires `visitor.identified`.

**Auth.** Visitor token. **Rate limit:** bucket `identify`, capacity 20, refill 0.2/s.

**Body** (JSON). All fields are optional. Omitted or empty fields leave the stored value unchanged.

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | no | Valid email ≤ 200, or `""`. Stored lowercased and trimmed. |
| `name` | string | no | ≤ 100 |
| `phone` | string | no | ≤ 40 |
| `company` | string | no | ≤ 100 |
| `avatar` | string | no | URL ≤ 500, or `""`. Ignored unless it starts with `https://`. |
| `data` | object | no | Values: string ≤ 500, number, boolean or `null`. The first 50 keys matching `^[A-Za-z0-9_-]{1,60}$` are stored under `data.<key>`. |
| `user_hash` | string | no | ≤ 128. Hex HMAC-SHA256 of the lowercased email. |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/identify" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.test","name":"Ada Lovelace","data":{"plan":"pro","seats":5},"user_hash":"3b9f0c2e6a1d4f8b7c5e2a9d0f1b3c4e5a6d7f8091a2b3c4d5e6f708192a3b4c"}'
```

**Example response** `200`

```json
{ "ok": true, "verified": true, "visitor": { "name": "Ada Lovelace", "email": "ada@example.test", "phone": "" } }
```

`verified` is `true` only when the website has an identity secret, `email` is present, and `user_hash`
matches.

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid identity: <first validation message>`, e.g. `Invalid identity: Invalid email` |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/event

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Records a custom event (`Hearthly.track(name, props)`). The event is stored, its name is added to
the contact's `events` list (usable in [segments](segments.md) as "Performed event"), the visitor's
`lastSeenAt` is updated, and an `event` SSE event is published to agents.

**Auth.** Visitor token. **Rate limit:** bucket `event`, capacity 60, refill 1/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | 1–60 chars, trimmed. Allowed characters: letters, digits, `_`, space, `.`, `:`, `-`, `/` (`^[\w .:\-/]+$`). |
| `props` | object | no | Default `{}`. Values: string ≤ 300, number, boolean or `null`. Only the first 30 keys are kept. |
| `url` | string | no | ≤ 2000, default `""`. The widget sends `location.href`. |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/event" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"checkout:started","props":{"cart_value":129.5,"currency":"EUR"},"url":"https://shop.example.test/cart"}'
```

**Example response** `200`

```json
{ "ok": true }
```

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid event` |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/page

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Records a page view for single-page-app navigation and re-evaluates [triggers](triggers.md) with
`timeOnPage = 0`. The first page of a visit is recorded by `/api/widget/session` instead. The previous page view
gets its duration filled in (capped at 3600 s). The same URL reported again within 5 s is ignored (reload
dedupe). Publishes a `visitor` SSE event. See [visitors.md](visitors.md) for the tracking model.

**Auth.** Visitor token. **Rate limit:** bucket `page`, capacity 60, refill 1/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `url` | string | yes | ≤ 2000 |
| `title` | string | no | ≤ 300, default `""` |
| `referrer` | string | no | ≤ 2000, default `""`. The widget sends the previous URL. |
| `sessionId` | string | no | ≤ 64, default `""` |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/page" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://shop.example.test/checkout","title":"Checkout","referrer":"https://shop.example.test/cart","sessionId":"q8z1k3m0lx9a"}'
```

**Example response** `200`

```json
{ "ok": true, "open": false, "nextCheckSec": 30 }
```

`open` and `nextCheckSec` have the same meaning as in [`session`](#post-apiwidgetsession).

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid body` |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/ping

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Heartbeat. It keeps the visitor in the [live visitors](visitors.md) list (online = seen in the
last 75 s), evaluates time-based [triggers](triggers.md) with the current time on page, and returns the
current site status. The widget pings every 30 s while the tab is visible. When `nextCheckSec` is set, it pings
after `nextCheckSec + 0.5` s instead, clamped to 2–30 s. It also pings when the tab becomes visible again.

**Auth.** Visitor token. **Rate limit:** bucket `ping`, capacity 30, refill 0.5/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `timeOnPage` | number | no | Seconds on the current page, 0–86400, default `0` |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/ping" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"timeOnPage":42}'
```

**Example response** `200`

```json
{ "ok": true, "open": true, "nextCheckSec": null, "status": { "online": true, "withinHours": true, "agentsOnline": 2 } }
```

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid body` |
| 401/404/429/500 | Common token errors |

---

## POST /api/widget/action

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** The visitor clicked a quick-reply button attached to a message (`message.actions[index]`). The
button's label is posted as a visitor message. If the button defines a tag, the conversation is tagged, and
its canned reply (if any) is posted as a bot message. Automations are skipped.

**Auth.** Visitor token. **Rate limit:** bucket `action`, capacity 10, refill 0.2/s.

**Body** (JSON)

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `messageId` | string | yes | 24-hex id of a message in the visitor's **current** conversation |
| `index` | integer | yes | 0–10, index into that message's `actions` |

```bash
curl -s -X POST "$HEARTHLY_URL/api/widget/action" -H "Hearthly-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"messageId":"6701a40bc4e5d60012ab34d9","index":0}'
```

**Example response** `200`

```json
{ "ok": true }
```

**Errors**

| Status | `error` |
| --- | --- |
| 400 | `Invalid action` |
| 404 | `No conversation`, `Unknown action` |
| 401/404/429/500 | Common token errors |

---

## GET /api/widget/kb

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** Help-center search for the widget's **Help** tab. With `q`, it returns up to 6 published
articles whose title or body contains `q` (case-insensitive substring). Without `q`, it returns the 5 most
viewed published articles. More in [knowledge-base.md](knowledge-base.md#get-apiwidgetkb).

**Auth.** None. **Rate limit:** bucket `kb`, capacity 30, refill 1/s.

**Query**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `website` | string | yes | Public website id |
| `q` | string | no | Search text, trimmed, first 100 chars used |

```bash
curl -s "$HEARTHLY_URL/api/widget/kb?website=k7m2q9xh4tpa&q=refund"
```

**Example response** `200`

```json
{
  "articles": [
    { "title": "How refunds work", "excerpt": "Refunds are issued to the original payment method within 5 business days…", "url": "/help/k7m2q9xh4tpa/how-refunds-work" }
  ]
}
```

`url` is a path on the Hearthly host. Prefix it with your Hearthly origin.

**Errors**

| Status | `error` |
| --- | --- |
| 404 | `Unknown website` |
| 429 | `Too many requests` |

---

## GET /api/widget/stream

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** A Server-Sent Events stream of the visitor's own realtime events: operator/bot replies, agent
typing, read receipts and conversation status changes. Opening it also bumps the visitor's `lastSeenAt`.
Event names and payloads are documented in [realtime.md](realtime.md#get-apiwidgetstream).

**Auth.** Visitor token, normally as `?token=` (EventSource can't send headers). The `Hearthly-Token` header also
works. **Rate limit:** bucket `stream`, capacity 20, refill 0.2/s (new connections).

```bash
curl -N "$HEARTHLY_URL/api/widget/stream?token=$TOKEN"
```

```js
const es = new EventSource(`${HEARTHLY_URL}/api/widget/stream?token=${encodeURIComponent(token)}`);
es.addEventListener("message", (e) => console.log("new message", JSON.parse(e.data)));
```

**Errors.** Authentication and rate-limit failures return a normal JSON error (`401`, `404`, `429`) instead of
a stream, which `EventSource` reports as an error.

---

## Rate limit summary

All widget buckets are keyed by client IP (`cf-connecting-ip`, else the right-most `X-Forwarded-For` entry,
else `x-real-ip`) plus the bucket name.

| Endpoint | Bucket | Capacity (burst) | Refill per second |
| --- | --- | --- | --- |
| `POST /api/widget/session` | `session` | 30 | 0.5 |
| `GET /api/widget/config` | `config` | 60 | 2 |
| `GET /api/widget/messages` | `poll` | 40 | 0.5 |
| `POST /api/widget/messages` | `send` | 20 | 0.5 |
| `POST /api/widget/upload` | `upload` | 10 | 0.1 |
| `POST /api/widget/typing` | `typing` | 60 | 2 |
| `POST /api/widget/read` | `read` | 60 | 1 |
| `POST /api/widget/rate` | `rate` | 10 | 0.1 |
| `POST /api/widget/transcript` | `transcript` | 3 | 0.01 |
| `POST /api/widget/identify` | `identify` | 20 | 0.2 |
| `POST /api/widget/event` | `event` | 60 | 1 |
| `POST /api/widget/page` | `page` | 60 | 1 |
| `POST /api/widget/ping` | `ping` | 30 | 0.5 |
| `POST /api/widget/action` | `action` | 10 | 0.2 |
| `GET /api/widget/kb` | `kb` | 30 | 1 |
| `GET /api/widget/stream` | `stream` | 20 | 0.2 |

`GET /api/files/{id}` (attachment download) is **not** rate limited. See [attachments.md](attachments.md).
