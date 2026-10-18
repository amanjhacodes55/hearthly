# Realtime (Server-Sent Events)

Hearthly pushes live updates over [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
(SSE). There are two streams. The **dashboard stream** carries everything that happens in a website (new
messages, conversation changes, typing, visitors, presence, …). The **visitor stream** carries only what one
visitor's widget needs. Both streams are fed by the same in-process event bus (`src/lib/bus.ts`) and written by
`src/lib/sse.ts`.

## Contents

- [How the streams work](#how-the-streams-work)
- [GET /api/stream](#get-apistream) (dashboard)
- [GET /api/widget/stream](#get-apiwidgetstream) (visitor)
- [Dashboard event reference](#dashboard-event-reference)
- [Visitor event reference](#visitor-event-reference)
- [Client example (EventSource)](#client-example-eventsource)
- [Deployment: single instance](#deployment-single-instance)

---

## How the streams work

Both endpoints respond with:

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

Wire format:

```
retry: 3000
: connected

event: message
data: {"id":"6701a40bc4e5d60012ab34d9", ...}

: ping 1791800020000
```

- **Connect.** The first chunk is `retry: 3000` (tells `EventSource` to wait 3 s before reconnecting) followed
  by the comment `: connected`.
- **Events.** Every event has an `event:` name and a single-line JSON `data:` payload. No `id:` field is sent,
  so there is **no replay**: events published while a client is disconnected are lost. After reconnecting,
  clients should re-fetch state. The widget calls `GET /api/widget/messages?since=…` on every `open`, and the
  dashboard falls back to polling while disconnected.
- **Heartbeat.** The comment line `: ping <epoch-ms>` is sent every **20 s** to keep proxies from closing idle
  connections. `EventSource` ignores comments.
- **Close.** When the client disconnects (request abort) or a write fails, the server unsubscribes and closes the
  stream. On the dashboard stream, closing also updates agent presence.
- **Reconnection.** Native `EventSource` reconnects automatically after `retry` ms. The bundled clients add
  their own logic. The dashboard (`src/components/Realtime.tsx`) reconnects with exponential backoff from 1 s
  up to 30 s once the connection is `CLOSED`. The widget gives up on SSE after 3 consecutive errors, polls every
  5 s, and retries SSE 30 s later.

---

## GET /api/stream

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** The agent's realtime feed for their **current website**. It subscribes to the website topic
`site:<websiteId>`. While at least one stream is open, the agent counts as **online**: that drives
`presence` events, the widget's online/away status, and round-robin assignment preferring online agents.

**Auth / role.** Dashboard session cookie, any member role. The user must have a current website.

**Params.** None.

**Example request**

```bash
# with a browser session cookie copied from devtools
curl -N "$HEARTHLY_URL/api/stream" -H "Cookie: next-auth.session-token=…"
```

**Example stream**

```
retry: 3000
: connected

event: hello
data: {"user":"66ff12aa9b3c4d0011ef5678","website":"66ff12b09b3c4d0011ef5680","online":["66ff12c19b3c4d0011ef5690"]}

event: presence
data: {"online":["66ff12c19b3c4d0011ef5690","66ff12aa9b3c4d0011ef5678"]}

: ping 1791800020000
```

`hello` is computed just before this connection registers itself as online. A `presence` event that includes
the new connection follows immediately.

**Errors**

| Status | Body | Cause |
| --- | --- | --- |
| 401 | `{ "error": "Please sign in." }` | No valid session, **or** the user has no website yet |

Not rate limited.

---

## GET /api/widget/stream

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** One visitor's realtime feed. It subscribes to the topic `visitor:<contactId>`. Opening the stream
updates the visitor's `lastSeenAt` once. It does not keep the visitor "live" by itself, which is
[`/api/widget/ping`](widget.md#post-apiwidgetping)'s job.

**Auth.** Visitor token, as `?token=<token>` (EventSource can't set headers) or the `Hearthly-Token` header.
Response carries the widget CORS headers (`Access-Control-Allow-Origin: *`).

**Rate limit.** Bucket `stream` per client IP: capacity 20, refill 0.2/s (connection attempts).

**Query**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | yes (unless header) | Visitor token from [`POST /api/widget/session`](widget.md#post-apiwidgetsession) |

**Example request**

```bash
curl -N "$HEARTHLY_URL/api/widget/stream?token=$TOKEN"
```

**Example stream**

```
retry: 3000
: connected

event: typing
data: {"typing":true,"name":"Maya"}

event: message
data: {"id":"6701a40bc4e5d60012ab34d9","conversation_id":"6701a3f9c4e5d60012ab34d2","from":"operator","author":{"id":"66ff12aa9b3c4d0011ef5678","name":"Maya Chen","avatar":""},"text":"Hi Ada! Yes, you can switch plans at any time.","attachments":[],"actions":[],"via":"","created_at":"2026-10-11T09:42:17.204Z"}
```

**Errors.** Returned as JSON before any stream starts. `EventSource` surfaces them as `error` events.

| Status | `error` |
| --- | --- |
| 401 | `Invalid visitor token`, `Visitor not found` |
| 404 | `Unknown website` |
| 429 | `Too many requests` (with `Retry-After`) |
| 500 | `Something went wrong` / `Database unavailable — please retry shortly.` |

---

## Dashboard event reference

Events on `GET /api/stream` (topic `site:<websiteId>`). Object shapes `Conversation`, `Contact` and `Message`
are the shared serializers (`src/lib/serialize.ts`), the same as REST v1 and webhooks. See
[conversations.md](conversations.md) and [contacts.md](contacts.md) for every field.

| Event | Payload | Published when |
| --- | --- | --- |
| [`hello`](#hello) | `{ user, website, online }` | Once, at connect (this stream only) |
| [`presence`](#presence) | `{ online }` | Any agent's dashboard stream opens or closes |
| [`message`](#message) | `{ conversation, message }` | Any message is created, including private notes and system messages |
| [`conversation`](#conversation) | `Conversation` (with embedded `contact`) | A conversation is created, its status/assignee/tags/subject/snooze changes, or it is rated |
| [`conversation.deleted`](#conversationdeleted) | `{ id }` | An admin deletes a conversation |
| [`conversation.woke`](#conversationwoke) | `{ id }` | The scheduler wakes a snoozed conversation |
| [`typing`](#typing) | visitor or agent typing object | A visitor or an agent types |
| [`read`](#read) | `{ conversation_id, who, at }` | A visitor or an agent reads a conversation |
| [`visitor`](#visitor) | `Contact` | A visitor views a page (session start or SPA navigation) |
| [`contact`](#contact) | `Contact` | A contact is created or updated (widget, identify, dashboard, REST v1, inbound API) |
| [`event`](#event) | `{ contact_id, name, props, at }` | A visitor tracks a custom event |
| [`settings`](#settings) | `{ changed }` | An admin saves website settings |
| [`team`](#team) | `{ joined }` | A user joins the website via an invite |

The dashboard client subscribes to exactly these 13 names.

### hello

```json
{ "user": "66ff12aa9b3c4d0011ef5678", "website": "66ff12b09b3c4d0011ef5680", "online": ["66ff12c19b3c4d0011ef5690"] }
```

`user` is the connected user's id, `website` is the internal website id (24-hex, not the public widget id), and
`online` lists user ids of agents online before this connection.

### presence

```json
{ "online": ["66ff12aa9b3c4d0011ef5678", "66ff12c19b3c4d0011ef5690"] }
```

User ids with at least one open dashboard stream. It is sent on every stream open/close, even if the set didn't
change (for example a second tab).

### message

```json
{
  "conversation": {
    "id": "6701a3f9c4e5d60012ab34d2",
    "status": "open",
    "snoozed_until": null,
    "assignee_id": "66ff12aa9b3c4d0011ef5678",
    "tags": ["billing"],
    "subject": "",
    "channel": "widget",
    "last_message": { "text": "Hi! Can I change my plan later?", "from": "visitor", "at": "2026-10-11T09:40:02.630Z" },
    "unread": 1,
    "visitor_unread": 0,
    "visitor_read_at": null,
    "rating": null,
    "first_response_at": null,
    "resolved_at": null,
    "created_at": "2026-10-11T09:40:02.511Z",
    "updated_at": "2026-10-11T09:40:02.645Z",
    "contact_id": "6701a3f2c4e5d60012ab34cd",
    "contact": { "id": "6701a3f2c4e5d60012ab34cd", "email": "ada@example.test", "name": "Ada Lovelace", "online": true, "…": "full Contact object" }
  },
  "message": {
    "id": "6701a3fac4e5d60012ab34d4",
    "conversation_id": "6701a3f9c4e5d60012ab34d2",
    "from": "visitor",
    "author": { "id": "6701a3f2c4e5d60012ab34cd", "name": "Ada Lovelace", "avatar": "" },
    "text": "Hi! Can I change my plan later?",
    "attachments": [],
    "actions": [],
    "via": "",
    "created_at": "2026-10-11T09:40:02.630Z"
  }
}
```

`message.from` can be `visitor`, `operator`, `bot`, `note` (private note) or `system` (e.g. "Maya marked as
resolved"). `conversation` is the state after the message, so it has updated `last_message` and unread counters.

### conversation

A full `Conversation` object with `contact` embedded (same shape as `message.conversation` above). Emitted when
a conversation is created (widget, trigger, campaign or inbound API), when its status changes (dashboard, REST v1,
or auto-resolve), when it is assigned, tagged, re-subjected or snoozed in the dashboard, and when a visitor rates it.

### conversation.deleted

```json
{ "id": "6701a3f9c4e5d60012ab34d2" }
```

### conversation.woke

```json
{ "id": "6701a3f9c4e5d60012ab34d2" }
```

The scheduler checks every 2 minutes for conversations whose snooze has expired, sets them back to `open` and
increments their unread count. Only this event is published. No `conversation` event follows, so re-fetch
the conversation if you need its new state.

### typing

Two shapes, distinguished by `who`:

```json
{ "conversation_id": "6701a3f9c4e5d60012ab34d2", "who": "visitor", "typing": true, "preview": "Can I change my pl" }
```

```json
{ "conversation_id": "6701a3f9c4e5d60012ab34d2", "who": "agent", "user": "66ff12aa9b3c4d0011ef5678", "name": "Maya Chen", "typing": true }
```

Visitor typing includes a live `preview` of the draft (≤ 200 chars). Agent typing is broadcast to other agents
even while the agent is writing a private note. The visitor isn't told in that case.

### read

```json
{ "conversation_id": "6701a3f9c4e5d60012ab34d2", "who": "visitor", "at": "2026-10-11T09:42:30.010Z" }
```

`who` is `"visitor"` (the widget called `/api/widget/read`) or `"agent"` (an agent opened the conversation,
`POST /api/conversations/{id}/read`).

### visitor

A full `Contact` object, published after each recorded page view, so `current_page`, `page_views` and
`last_seen_at` are fresh:

```json
{
  "id": "6701a3f2c4e5d60012ab34cd",
  "email": "",
  "name": "",
  "phone": "",
  "company": "",
  "avatar": "",
  "tags": [],
  "data": {},
  "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
  "device": { "browser": "Firefox", "browser_version": "131", "os": "macOS", "os_version": "14.6", "type": "desktop" },
  "referrer": "https://news.example.test/",
  "utm": { "source": "newsletter", "medium": "", "campaign": "", "term": "", "content": "" },
  "current_page": { "url": "https://shop.example.test/pricing", "title": "Pricing", "since": "2026-10-11T09:39:58.002Z" },
  "sessions": 1,
  "page_views": 1,
  "events": [],
  "source": "widget",
  "external_id": "",
  "first_seen_at": "2026-10-11T09:39:57.880Z",
  "last_seen_at": "2026-10-11T09:39:58.002Z",
  "online": true,
  "created_at": "2026-10-11T09:39:57.880Z"
}
```

### contact

A full `Contact` object (same shape as `visitor`). Published when a contact is created (new widget visitor,
dashboard, REST v1, inbound API) or updated (widget identify, dashboard edit, REST v1 update).

### event

```json
{ "contact_id": "6701a3f2c4e5d60012ab34cd", "name": "checkout:started", "props": { "cart_value": 129.5, "currency": "EUR" }, "at": "2026-10-11T09:45:12.331Z" }
```

### settings

```json
{ "changed": ["widget", "availability"] }
```

The top-level keys of the `PATCH /api/websites/current` body. Re-fetch settings when you receive it.

### team

```json
{ "joined": "66ff12d29b3c4d0011ef56a0" }
```

The id of the user who just joined through an invite (`POST /api/websites/join`). Role changes and removals
don't publish an event.

---

## Visitor event reference

Events on `GET /api/widget/stream` (topic `visitor:<contactId>`).

| Event | Payload | Published when |
| --- | --- | --- |
| `message` | `Message` | A `visitor`, `operator` or `bot` message is added to any of this visitor's conversations. It includes the visitor's own messages (dedupe by `id`). Notes and system messages are never sent. |
| `typing` | `{ typing, name }` | An agent types a reply (not a private note). `name` is the agent's first name. |
| `read` | `{ at }` | An agent opened the conversation (read receipt for the visitor's messages) |
| `status` | `{ status, conversation_id }` | The conversation's status was set to `open`, `pending` or `resolved` by an agent, REST v1, or auto-resolve |

```json
// message
{ "id": "6701a40bc4e5d60012ab34d9", "conversation_id": "6701a3f9c4e5d60012ab34d2", "from": "operator", "author": { "id": "66ff12aa9b3c4d0011ef5678", "name": "Maya Chen", "avatar": "" }, "text": "Hi Ada! Yes, you can switch plans at any time.", "attachments": [], "actions": [], "via": "", "created_at": "2026-10-11T09:42:17.204Z" }

// typing
{ "typing": true, "name": "Maya" }

// read
{ "at": "2026-10-11T09:42:05.770Z" }

// status
{ "status": "resolved", "conversation_id": "6701a3f9c4e5d60012ab34d2" }
```

Typing indicators don't auto-expire on the server. The widget hides one after 6 s without an update, or when
the agent's message arrives. Snoozing (status `pending` via snooze) and the scheduler's wake-up don't emit
`status` to the visitor. A visitor message that re-opens a resolved conversation doesn't either.

---

## Client example (EventSource)

Visitor stream from a custom widget, with catch-up after reconnects:

```js
const HEARTHLY_URL = "https://YOUR-HOST";
let lastSync = null;

async function catchUp(token) {
  const url = `${HEARTHLY_URL}/api/widget/messages?since=${encodeURIComponent(lastSync || "")}`;
  const r = await fetch(url, { headers: { "Hearthly-Token": token } });
  const { messages } = await r.json();
  messages.forEach(render);
}

function render(m) {
  lastSync = m.created_at;
  console.log(`[${m.from}] ${m.text}`);
}

function connect(token) {
  const es = new EventSource(`${HEARTHLY_URL}/api/widget/stream?token=${encodeURIComponent(token)}`);
  es.addEventListener("open", () => catchUp(token));           // fill any gap after a reconnect
  es.addEventListener("message", (e) => render(JSON.parse(e.data)));
  es.addEventListener("typing", (e) => {
    const { typing, name } = JSON.parse(e.data);
    console.log(typing ? `${name} is typing…` : "");
  });
  es.addEventListener("read", (e) => console.log("seen at", JSON.parse(e.data).at));
  es.addEventListener("status", (e) => console.log("status:", JSON.parse(e.data).status));
  es.onerror = () => console.warn("stream interrupted, EventSource will retry in 3 s");
  return es;
}
```

Dashboard stream (same-origin, cookie sent automatically):

```js
const es = new EventSource("/api/stream");
for (const type of ["hello", "presence", "message", "conversation", "conversation.deleted", "conversation.woke",
                    "typing", "read", "visitor", "contact", "event", "settings", "team"]) {
  es.addEventListener(type, (e) => console.log(type, JSON.parse(e.data)));
}
```

Every event is sent with an explicit `event:` name, and some names contain dots (`conversation.deleted`). Subscribe
with `addEventListener(name, …)`. `onmessage` only fires for events named `message`, which is the default
type, so it would miss everything else.

---

## Deployment: single instance

The bus is an in-process Node `EventEmitter` (`globalThis._hlyBus`). Agent presence and the widget rate-limit
buckets also live in process memory. As a result:

- Hearthly must run as **one long-lived Node.js process** for realtime to be correct. With several
  instances, an event published on instance A only reaches streams connected to instance A. Agents and visitors
  on other instances miss it (they still catch up through polling or re-fetching), and presence and online
  status are per instance.
- Serverless or edge runtimes that don't keep a single long-lived process can't hold streams open reliably and
  don't share the bus between invocations. Both SSE routes declare `runtime = "nodejs"`.
- To scale horizontally, replace `publish`/`subscribe` in `src/lib/bus.ts` with Redis pub/sub (or similar), and
  move presence to a shared store.
- Reverse proxies must not buffer `text/event-stream`. Hearthly sends `X-Accel-Buffering: no` for nginx and
  `Cache-Control: no-transform`. Make sure idle timeouts are longer than the 20 s heartbeat.
