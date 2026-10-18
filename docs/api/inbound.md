# Inbound channel API

The Inbound API lets you connect Hearthly to any messaging channel it doesn't support natively — Telegram, Slack, WhatsApp, SMS, an email gateway, an in-app chat, a terminal. You run a small **bridge** service: it posts each message your user sends on that channel to `POST /api/v1/inbound` as a *visitor* message, and it relays operator replies back to the channel by listening to the `message.sent` webhook. In the inbox, these conversations look like any other conversation, labelled with the channel name.

See [Authentication](README.md#authentication), [Errors](README.md#errors) and [Rate limits](README.md#rate-limits).

**Contents**

- [How it works](#how-it-works)
- [POST /api/v1/inbound](#post-apiv1inbound)
- [Contact matching](#contact-matching)
- [Conversation selection](#conversation-selection)
- [Receiving replies: the message.sent webhook](#receiving-replies-the-messagesent-webhook)
- [Example bridge flow](#example-bridge-flow)

---

## How it works

```
 user on channel ──► your bridge ──POST /api/v1/inbound──► Hearthly inbox
                          ▲                                     │ operator replies
                          └──── message.sent webhook ◄──────────┘
```

1. Create an API key (Settings → API) with `messages:write` (and `webhooks:manage` if the bridge registers its own webhook), or use an OAuth app token with those scopes.
2. Subscribe a webhook URL on your bridge to `message.sent` (dashboard, or [`POST /api/v1/webhooks`](../openapi.yaml)).
3. When a user writes on your channel, call `POST /api/v1/inbound` with the channel name, your stable user ID and the text.
4. When `message.sent` arrives for a conversation whose `channel` is yours, deliver the text to the user identified by the contact's `external_id`.

---

## POST /api/v1/inbound

> **Public · stable** — part of REST API v1.

**Purpose.** Post a message **from a visitor/end user** into Hearthly. Finds or creates the contact and conversation, stores the message, and fans it out exactly like a widget message: the inbox updates in realtime, the conversation's unread count increases, a resolved or snoozed conversation is reopened, the `message.received` webhook fires (plus `contact.created` / `conversation.created` when something new was created), and the website's automations run (offline auto-reply and help-center article suggestions, at most once per 30 minutes per conversation — these bot replies are delivered back to you through `message.sent` too).

**Auth.** Bearer token with scope `messages:write`.

**Path params.** None. **Query params.** None.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `channel` | string | no | Channel name, trimmed and lower-cased, must match `^[a-z0-9_-]{2,30}$`. Default `api`. Becomes the conversation's `channel`, a tag on new contacts, and their `source` (`channel:<name>`). |
| `conversation_id` | string | no | 24-hex ID of an existing conversation to post into. When given, the conversation's contact is used and `contact` is ignored. |
| `contact` | object | no* | Who sent the message. Default `{}`. |
| `contact.external_id` | string | no* | The user's ID on your channel (e.g. Telegram chat ID), max 100. Stored namespaced as `<channel>:<external_id>`. |
| `contact.email` | string | no* | Valid email, max 200, lower-cased. |
| `contact.name` | string | no | Max 100. Used when creating the contact and as the message author name. |
| `contact.phone` | string | no | Max 40. Used only when creating the contact. |
| `text` | string | yes | 1–5000 characters after trimming. |

\* Unless `conversation_id` is given, at least one of `contact.external_id` or `contact.email` is required.

Attachments aren't supported on this endpoint.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/v1/inbound" \
  -H "Authorization: Bearer $HEARTHLY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "contact": { "external_id": "518822034", "name": "Maya Fischer" },
    "text": "Hi! Is the oak desk still in stock?"
  }'
```

**Example response** — `201 Created`

```json
{
  "data": {
    "message": {
      "id": "66f3c4d5e6f7a8b9c0d1e201",
      "conversation_id": "66f3c4d5e6f7a8b9c0d1e101",
      "from": "visitor",
      "author": { "id": "66f3c4d5e6f7a8b9c0d1e001", "name": "Maya Fischer", "avatar": "" },
      "text": "Hi! Is the oak desk still in stock?",
      "attachments": [],
      "actions": [],
      "via": "telegram (Telegram bridge)",
      "created_at": "2026-10-14T14:00:00.000Z"
    },
    "conversation": {
      "id": "66f3c4d5e6f7a8b9c0d1e101",
      "status": "open",
      "unread": 0,
      "rating": null,
      "created_at": "2026-10-14T14:00:00.000Z"
    },
    "conversation_id": "66f3c4d5e6f7a8b9c0d1e101",
    "contact_id": "66f3c4d5e6f7a8b9c0d1e001"
  }
}
```

`data.conversation` is the reduced, visitor-facing view of the conversation (`unread` = messages the *visitor* hasn't read). It reflects the conversation as it was **before** this message was stored, so e.g. a resolved conversation that this message reopened still shows `"status": "resolved"` here. Use `GET /api/v1/conversations/{conversation_id}` for the current state. Store `conversation_id` if you want to pin follow-up messages to the same thread.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Body isn't valid JSON. |
| 401 | `unauthorized` | Missing or invalid token. |
| 403 | `insufficient_scope` | Token lacks `messages:write`. |
| 404 | `not_found` | `Conversation not found` — `conversation_id` doesn't exist on this website. `Website not found` — the website was deleted. |
| 413 | `bad_request` | Body over 256 KB. |
| 422 | `validation_failed` | Schema validation failed (e.g. `channel: Invalid`, `text: String must contain at least 1 character(s)`), or `Provide contact.external_id or contact.email (or conversation_id)`. |
| 429 | `rate_limited` | Over 120 burst / 2 requests per second for this token. |

## Contact matching

Unless `conversation_id` is given, the contact is resolved in this order:

1. **Channel + external ID.** If `contact.external_id` is given, look for a contact whose `external_id` is exactly `<channel>:<external_id>` (e.g. `telegram:518822034`). The same external ID on two different channels therefore means two different contacts.
2. **Email.** Otherwise (or if no match), look for a non-merged contact with `contact.email`. This lets a channel user land on the profile of an existing widget visitor or customer with the same email.
3. **Create.** If nothing matches, a new contact is created with `external_id` = `<channel>:<external_id>` (or empty), the given email/name/phone, `source: "channel:<channel>"`, `tags: ["<channel>"]` and `sessions: 0`, and `contact.created` fires.

Existing contacts are **not updated** from the `contact` object — to change a name, email or custom data, use [`PATCH /api/v1/contacts/{id}`](contacts.md#patch-apiv1contactsid). Note that a contact matched by email (step 2) does not get the namespaced external ID attached, so the next message with the same external ID will again fall through to email matching; if your bridge relies on external IDs, set `external_id` yourself with `PATCH /api/v1/contacts/{id}` using the `<channel>:<id>` form.

## Conversation selection

- If `conversation_id` is given, the message goes into that conversation, whatever its status or channel (a resolved or snoozed conversation is reopened).
- Otherwise Hearthly takes the contact's current conversation (the most recently updated unresolved one, or else the most recent one). It's reused only if it is **not resolved** and its `channel` equals the request's `channel`.
- In every other case a new conversation is started on that channel (auto-assigned if round-robin assignment is enabled), and `conversation.created` fires.

So a conversation that an operator resolves is closed for good on the bridge side: the user's next message starts a fresh conversation.

## Receiving replies: the message.sent webhook

Operator and bot messages are delivered to your bridge through the `message.sent` webhook. Private notes and system messages are never sent. The event fires for **every** conversation on the website, so filter on `data.conversation.channel`.

Payload:

```json
{
  "id": "evt_5f0c8f7b2a9e4d61b3c2a7e90d4f1c22",
  "event": "message.sent",
  "website_id": "6650a1b2c3d4e5f6a7b8c9d0",
  "created_at": "2026-10-14T14:01:12.000Z",
  "data": {
    "message": {
      "id": "66f3c4d5e6f7a8b9c0d1e202",
      "conversation_id": "66f3c4d5e6f7a8b9c0d1e101",
      "from": "operator",
      "author": { "id": "66e0aa11bb22cc33dd44ee55", "name": "Jonas Weber", "avatar": "" },
      "text": "Hi Maya! Yes, we have two left. Want me to reserve one?",
      "attachments": [],
      "actions": [],
      "via": "",
      "created_at": "2026-10-14T14:01:12.000Z"
    },
    "conversation": {
      "id": "66f3c4d5e6f7a8b9c0d1e101",
      "status": "open",
      "channel": "telegram",
      "contact_id": "66f3c4d5e6f7a8b9c0d1e001",
      "contact": { "id": "66f3c4d5e6f7a8b9c0d1e001", "name": "Maya Fischer", "external_id": "telegram:518822034", "…": "full Contact object" },
      "…": "full Conversation object"
    }
  }
}
```

To route the reply, strip the `<channel>:` prefix from `data.conversation.contact.external_id` (here `518822034`). Operator messages may include `attachments` (`{ id, name, size, type }`) — forward a link or a note to the user, since the bridge can't post attachments back.

Each delivery is a `POST` with `Content-Type: application/json` and these headers:

| Header | Value |
|---|---|
| `Hearthly-Signature` | `t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>` |
| `Hearthly-Event` | `message.sent` |
| `Hearthly-Delivery` | Delivery ID (stable across retries — use it to deduplicate). |
| `Hearthly-Timestamp` | Same `t` as in the signature. |
| `User-Agent` | `Hearthly-Webhooks/1.0` |

Verify the signature with the secret returned when you created the webhook and reject timestamps older than ~5 minutes. Respond with any 2xx within 10 seconds; failed deliveries are retried with exponential backoff (30 s, 2 min, 8 min, 32 min, …) for up to 7 attempts. See `examples/webhook-receiver/` for verification code in Node and Python.

The `message.received` event fires for the inbound messages you post yourself — ignore it in the bridge to avoid echo loops.

> Email notifications: when SMTP is configured and a contact with an email address hasn't been seen for 2 minutes, operator replies are also emailed to them. Contacts created by a bridge are "seen" only at creation time, so a bridge contact with an email will usually receive replies both on the channel and by email.

## Example bridge flow

The repository ships a minimal bridge at [`examples/inbound-bridge/bridge.mjs`](../../examples/inbound-bridge/bridge.mjs): it lets you chat into Hearthly from your terminal as user `cli-user-1` on channel `terminal`.

```bash
HEARTHLY_URL=http://localhost:3005 HEARTHLY_KEY=hly_key_... node examples/inbound-bridge/bridge.mjs
# optional: EXTERNAL_ID=alice NAME="Alice Example"
```

What it does:

1. Each line you type is sent as
   `POST /api/v1/inbound` `{ "channel": "terminal", "contact": { "external_id": "cli-user-1", "name": "Terminal User" }, "text": "…" }`.
   It remembers `data.conversation_id` and the message ID it just sent.
2. Every 2 seconds it polls `GET /api/v1/conversations/{conversation_id}/messages?limit=20` and prints any new message whose `from` is `operator` or `bot`.

Polling keeps the example dependency-free (it needs `messages:write` + `conversations:read`). A production bridge should use the webhook instead:

```js
// Sketch of a webhook-driven bridge (Node 18+, no framework)
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const { HEARTHLY_URL, HEARTHLY_KEY, WEBHOOK_SECRET } = process.env;
const CHANNEL = "telegram";

// 1) user → Hearthly
export async function onChannelMessage(userId, name, text) {
  const r = await fetch(`${HEARTHLY_URL}/api/v1/inbound`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HEARTHLY_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: CHANNEL, contact: { external_id: String(userId), name }, text }),
  });
  if (!r.ok) console.error("inbound failed", r.status, (await r.json()).error);
}

// 2) Hearthly → user
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const sig = Object.fromEntries((req.headers["hearthly-signature"] || "").split(",").map((p) => p.split("=")));
    const expected = createHmac("sha256", WEBHOOK_SECRET).update(`${sig.t}.${body}`).digest("hex");
    const fresh = Math.abs(Date.now() / 1000 - Number(sig.t)) < 300;
    if (!fresh || !sig.v1 || sig.v1.length !== expected.length || !timingSafeEqual(Buffer.from(sig.v1), Buffer.from(expected))) {
      res.writeHead(401).end();
      return;
    }
    res.writeHead(200).end(); // ack fast
    const evt = JSON.parse(body);
    if (evt.event !== "message.sent" || evt.data.conversation.channel !== CHANNEL) return;
    const ext = evt.data.conversation.contact?.external_id || "";
    if (!ext.startsWith(`${CHANNEL}:`)) return;
    sendToChannel(ext.slice(CHANNEL.length + 1), evt.data.message.text); // your channel's send API
  });
}).listen(8080);
```

Register the webhook once:

```bash
curl -X POST "$HEARTHLY_URL/api/v1/webhooks" \
  -H "Authorization: Bearer $HEARTHLY_KEY" -H "Content-Type: application/json" \
  -d '{ "url": "https://bridge.example.test/hearthly", "events": ["message.sent"], "description": "Telegram bridge" }'
# → 201 { "data": { "id": "…", … }, "secret": "whsec_…" }   (the secret is shown only once)
```

In production, webhook URLs that resolve to private/internal network addresses (e.g. `localhost`, `10.x`, `192.168.x`) are rejected at creation and delivery time unless the server sets `ALLOW_PRIVATE_URLS=true`; outside production they're allowed by default. A website can have at most 25 webhooks.
