# Conversations & messages

Conversations are the threads in the Hearthly inbox: one contact talking to your team over a channel (the website widget, a campaign, or a custom channel bridged in through the [Inbound API](inbound.md)). Each conversation holds an ordered list of messages. This page documents the public REST v1 endpoints for reading conversations and sending messages, and the internal endpoints the Hearthly dashboard uses for its inbox.

See [Authentication](README.md#authentication), [Errors](README.md#errors), [Pagination](README.md#pagination) and [Rate limits](README.md#rate-limits) for the conventions shared by every endpoint.

**Contents**

- [The Conversation object](#the-conversation-object)
- [The Message object](#the-message-object)
- REST v1 (public)
  - [GET /api/v1/conversations](#get-apiv1conversations)
  - [GET /api/v1/conversations/{id}](#get-apiv1conversationsid)
  - [PATCH /api/v1/conversations/{id}](#patch-apiv1conversationsid)
  - [GET /api/v1/conversations/{id}/messages](#get-apiv1conversationsidmessages)
  - [POST /api/v1/conversations/{id}/messages](#post-apiv1conversationsidmessages)
- Dashboard (internal)
  - [GET /api/conversations](#get-apiconversations)
  - [POST /api/conversations](#post-apiconversations)
  - [GET /api/conversations/counts](#get-apiconversationscounts)
  - [GET /api/conversations/{id}](#get-apiconversationsid)
  - [PATCH /api/conversations/{id}](#patch-apiconversationsid)
  - [DELETE /api/conversations/{id}](#delete-apiconversationsid)
  - [POST /api/conversations/{id}/messages](#post-apiconversationsidmessages)
  - [POST /api/conversations/{id}/read](#post-apiconversationsidread)
  - [POST /api/conversations/{id}/typing](#post-apiconversationsidtyping)

---

## The Conversation object

The same shape is used by REST v1, the dashboard API, the realtime stream and webhook payloads.

| Field | Type | Notes |
|---|---|---|
| `id` | string | 24-hex ObjectId. |
| `status` | string | `open`, `pending` or `resolved`. A snoozed conversation is `pending` with a future `snoozed_until`. |
| `snoozed_until` | string \| null | ISO 8601 timestamp, or `null`. |
| `assignee_id` | string \| null | User ID of the assigned team member, or `null`. |
| `tags` | string[] | Conversation tags. |
| `subject` | string | Empty string unless set (campaign conversations use the campaign name). |
| `channel` | string | `widget` (default), `campaign`, or a custom channel name from the Inbound API (e.g. `telegram`). |
| `last_message` | object \| null | `{ text, from, at }` for the latest non-note, non-system message. `text` is truncated to 140 characters; an attachment-only message shows `📎 <file name>`. |
| `unread` | integer | Visitor messages not yet read by the team. |
| `visitor_unread` | integer | Operator/bot messages not yet read by the visitor. |
| `visitor_read_at` | string \| null | When the visitor last read the conversation. |
| `rating` | object \| null | `{ score, comment, at }` once the visitor has rated the conversation. |
| `first_response_at` | string \| null | Time of the first operator reply (campaign messages don't count). |
| `resolved_at` | string \| null | Set when the conversation is resolved, cleared when it's reopened. |
| `created_at` | string | ISO 8601. |
| `updated_at` | string | ISO 8601. Lists are sorted by this field. |
| `contact_id` | string | ID of the contact. |
| `contact` | [Contact](contacts.md#the-contact-object) | The embedded contact. Present on every endpoint documented here except where noted; omitted from the JSON when the contact wasn't loaded. |

## The Message object

| Field | Type | Notes |
|---|---|---|
| `id` | string | 24-hex ObjectId. |
| `conversation_id` | string | Parent conversation. |
| `from` | string | `visitor`, `operator`, `bot`, `system` (automatic activity lines such as "Maya marked as resolved") or `note` (private note, never shown to the visitor). |
| `author` | object \| null | `{ id, name, avatar }`, or `null` when the message has no author name (e.g. system messages). For messages sent through REST v1, `id` is `api_key:<key id>` or `app:<app id>`. |
| `text` | string | Message body (may be empty when the message only carries attachments). |
| `attachments` | object[] | `{ id, name, size, type }` — `size` in bytes, `type` is the MIME type. |
| `actions` | object[] | Quick-reply buttons offered with bot messages: `{ label }`. |
| `via` | string | How the message arrived: the API key or app name, or `<channel> (<key name>)` for inbound messages. Empty for widget and dashboard messages. |
| `created_at` | string | ISO 8601. |

---

## GET /api/v1/conversations

> **Public · stable** — part of REST API v1.

**Purpose.** List the conversations of the website the token belongs to, most recently updated first.

**Auth.** Bearer token with scope `conversations:read`.

**Path params.** None.

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | `open`, `pending` or `resolved`. Any other value is ignored (all statuses are returned). |
| `contact_id` | string | no | 24-hex contact ID. Ignored if it isn't a valid ID. |
| `page` | integer | no | Default `1`. |
| `limit` | integer | no | Default `20`, min `1`, max `100`. |

**Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/conversations?status=open&limit=2" \
  -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** — `200 OK`

```json
{
  "data": [
    {
      "id": "66f1a2b3c4d5e6f7a8b9c0d1",
      "status": "open",
      "snoozed_until": null,
      "assignee_id": "66e0aa11bb22cc33dd44ee55",
      "tags": ["billing"],
      "subject": "",
      "channel": "widget",
      "last_message": { "text": "Can I switch to annual billing?", "from": "visitor", "at": "2026-10-14T09:12:40.000Z" },
      "unread": 1,
      "visitor_unread": 0,
      "visitor_read_at": "2026-10-14T09:12:41.000Z",
      "rating": null,
      "first_response_at": null,
      "resolved_at": null,
      "created_at": "2026-10-14T09:12:40.000Z",
      "updated_at": "2026-10-14T09:12:40.000Z",
      "contact_id": "66f1a2b3c4d5e6f7a8b9c0c1",
      "contact": {
        "id": "66f1a2b3c4d5e6f7a8b9c0c1",
        "email": "maya.fischer@example.test",
        "name": "Maya Fischer",
        "phone": "",
        "company": "Fischer Design",
        "avatar": "",
        "tags": ["vip"],
        "data": { "plan": "pro" },
        "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
        "device": { "browser": "Firefox", "browser_version": "131.0", "os": "Linux", "os_version": "", "type": "desktop" },
        "referrer": "",
        "utm": { "source": "", "medium": "", "campaign": "", "term": "", "content": "" },
        "current_page": null,
        "sessions": 4,
        "page_views": 23,
        "events": ["signed_up"],
        "source": "widget",
        "external_id": "",
        "first_seen_at": "2026-09-30T15:02:11.000Z",
        "last_seen_at": "2026-10-14T09:13:05.000Z",
        "online": false,
        "created_at": "2026-09-30T15:02:11.000Z"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 1, "has_more": false }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | Missing, invalid, expired or revoked token. |
| 403 | `insufficient_scope` | Token lacks `conversations:read`. |
| 429 | `rate_limited` | Rate limit exceeded; see `Retry-After`. |

## GET /api/v1/conversations/{id}

> **Public · stable** — part of REST API v1.

**Purpose.** Fetch one conversation, including its embedded contact.

**Auth.** Bearer token with scope `conversations:read`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Query params.** None. **Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/conversations/66f1a2b3c4d5e6f7a8b9c0d1" \
  -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** — `200 OK`

```json
{
  "data": {
    "id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "status": "open",
    "snoozed_until": null,
    "assignee_id": "66e0aa11bb22cc33dd44ee55",
    "tags": ["billing"],
    "subject": "",
    "channel": "widget",
    "last_message": { "text": "Can I switch to annual billing?", "from": "visitor", "at": "2026-10-14T09:12:40.000Z" },
    "unread": 1,
    "visitor_unread": 0,
    "visitor_read_at": null,
    "rating": null,
    "first_response_at": null,
    "resolved_at": null,
    "created_at": "2026-10-14T09:12:40.000Z",
    "updated_at": "2026-10-14T09:12:40.000Z",
    "contact_id": "66f1a2b3c4d5e6f7a8b9c0c1",
    "contact": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "email": "maya.fischer@example.test", "name": "Maya Fischer", "…": "full Contact object" }
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | Missing or invalid token. |
| 403 | `insufficient_scope` | Token lacks `conversations:read`. |
| 404 | `not_found` | `Conversation not found` — unknown ID, malformed ID, or a conversation of another website. |

## PATCH /api/v1/conversations/{id}

> **Public · stable** — part of REST API v1.

**Purpose.** Change a conversation's status, tags or assignee. Resolving a conversation fires the `conversation.resolved` webhook (with `resolved_by` set to `api_key:<key name>` or `app:<app name>`) and notifies the visitor's widget.

**Auth.** Bearer token with scope `conversations:write`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Query params.** None.

**Body params** (JSON; all optional)

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | `open`, `pending` or `resolved`. Setting `open` or `resolved` also clears any snooze. |
| `tags` | string[] | no | Replaces the tag list. Max 20 tags, each max 40 characters. |
| `assignee_id` | string \| null | no | 24-hex user ID of a team member of the website, or `null` to unassign. |

An empty body is accepted and simply returns the conversation.

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/v1/conversations/66f1a2b3c4d5e6f7a8b9c0d1" \
  -H "Authorization: Bearer $HEARTHLY_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "resolved", "tags": ["billing", "annual-plan"] }'
```

**Example response** — `200 OK`

```json
{
  "data": {
    "id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "status": "resolved",
    "snoozed_until": null,
    "assignee_id": "66e0aa11bb22cc33dd44ee55",
    "tags": ["billing", "annual-plan"],
    "subject": "",
    "channel": "widget",
    "last_message": { "text": "Done — you're on annual billing now.", "from": "operator", "at": "2026-10-14T09:20:02.000Z" },
    "unread": 0,
    "visitor_unread": 1,
    "visitor_read_at": "2026-10-14T09:12:41.000Z",
    "rating": null,
    "first_response_at": "2026-10-14T09:15:30.000Z",
    "resolved_at": "2026-10-14T09:21:00.000Z",
    "created_at": "2026-10-14T09:12:40.000Z",
    "updated_at": "2026-10-14T09:21:00.000Z",
    "contact_id": "66f1a2b3c4d5e6f7a8b9c0c1",
    "contact": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "…": "full Contact object" }
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Body isn't valid JSON. |
| 403 | `insufficient_scope` | Token lacks `conversations:write`. |
| 404 | `not_found` | Unknown conversation. |
| 422 | `validation_failed` | Body fails validation, or `assignee_id is not a member`. |

## GET /api/v1/conversations/{id}/messages

> **Public · stable** — part of REST API v1.

**Purpose.** List the messages of a conversation. Page 1 holds the **most recent** messages; within a page, messages are ordered oldest → newest. Private notes are included (`from: "note"`), as are `system` activity lines.

**Auth.** Bearer token with scope `conversations:read`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `page` | integer | no | Default `1` (newest messages). Increase to go back in time. |
| `limit` | integer | no | Default `20`, min `1`, max `100`. |

**Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/conversations/66f1a2b3c4d5e6f7a8b9c0d1/messages?limit=3" \
  -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** — `200 OK`

```json
{
  "data": [
    {
      "id": "66f1a2b3c4d5e6f7a8b9c101",
      "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1",
      "from": "visitor",
      "author": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "name": "Maya Fischer", "avatar": "" },
      "text": "Can I switch to annual billing?",
      "attachments": [],
      "actions": [],
      "via": "",
      "created_at": "2026-10-14T09:12:40.000Z"
    },
    {
      "id": "66f1a2b3c4d5e6f7a8b9c102",
      "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1",
      "from": "note",
      "author": { "id": "66e0aa11bb22cc33dd44ee55", "name": "Jonas Weber", "avatar": "" },
      "text": "Check whether she still has the launch discount.",
      "attachments": [],
      "actions": [],
      "via": "",
      "created_at": "2026-10-14T09:14:02.000Z"
    },
    {
      "id": "66f1a2b3c4d5e6f7a8b9c103",
      "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1",
      "from": "operator",
      "author": { "id": "66e0aa11bb22cc33dd44ee55", "name": "Jonas Weber", "avatar": "" },
      "text": "Yes! I've switched you over, the invoice follows by email.",
      "attachments": [{ "id": "66f1a2b3c4d5e6f7a8b9c2f0", "name": "invoice-2026-10.pdf", "size": 48213, "type": "application/pdf" }],
      "actions": [],
      "via": "",
      "created_at": "2026-10-14T09:15:30.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 3, "has_more": false }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 403 | `insufficient_scope` | Token lacks `conversations:read`. |
| 404 | `not_found` | Unknown conversation. |

## POST /api/v1/conversations/{id}/messages

> **Public · stable** — part of REST API v1.

**Purpose.** Post a message into an existing conversation as an operator, a bot, or as a private note. The message is pushed to the dashboard in realtime and (except for notes) to the visitor's widget.

Side effects by `from`:

- `operator` — increments the visitor's unread count, sets `first_response_at` if not yet set, moves a `pending` conversation back to `open`, fires the `message.sent` webhook, and sends the contact an email notification if SMTP is configured, the contact has an email, and they haven't been seen in the last 2 minutes.
- `bot` — increments the visitor's unread count and fires `message.sent`.
- `note` — internal only: no webhook, not shown to the visitor, doesn't change `last_message`.

To post a message **as the visitor** (e.g. from a channel bridge), use [POST /api/v1/inbound](inbound.md) instead.

**Auth.** Bearer token with scope `messages:write`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Query params.** None.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `text` | string | yes | 1–5000 characters after trimming. |
| `from` | string | no | `operator` (default), `bot` or `note`. |
| `author_name` | string | no | Display name, max 60 characters. Defaults to the API key name or OAuth app name. |
| `author_avatar` | string | no | Avatar URL, max 500 characters. |

Attachments can't be sent through this endpoint.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/v1/conversations/66f1a2b3c4d5e6f7a8b9c0d1/messages" \
  -H "Authorization: Bearer $HEARTHLY_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "text": "Your order #4821 has shipped 📦", "from": "bot", "author_name": "Order bot" }'
```

**Example response** — `201 Created`

```json
{
  "data": {
    "id": "66f1a2b3c4d5e6f7a8b9c104",
    "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "from": "bot",
    "author": { "id": "api_key:66f0d3a1b2c3d4e5f6a7b801", "name": "Order bot", "avatar": "" },
    "text": "Your order #4821 has shipped 📦",
    "attachments": [],
    "actions": [],
    "via": "Shop backend",
    "created_at": "2026-10-14T10:02:17.000Z"
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Body isn't valid JSON. |
| 403 | `insufficient_scope` | Token lacks `messages:write`. |
| 404 | `not_found` | Unknown conversation. |
| 413 | `bad_request` | Body larger than 256 KB. |
| 422 | `validation_failed` | e.g. `text: String must contain at least 1 character(s)`, invalid `from`, `author_avatar` not a URL. |

---

## GET /api/conversations

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** The inbox list, with filters.

**Auth.** Any member of the current website (agent, admin or owner).

**Path params.** None.

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | Default `open`. `open`, `pending`, `resolved`, `snoozed` (any status with `snoozed_until` in the future) or `all`. Other values are matched literally and return nothing. |
| `assigned` | string | no | `me` (assigned to the signed-in user) or `unassigned`. |
| `unread` | string | no | `1` → only conversations with unread visitor messages. |
| `tag` | string | no | Conversation tag. |
| `contact` | string | no | 24-hex contact ID. |
| `segment` | string | no | 24-hex [segment](segments.md) ID: only conversations whose contact matches the segment (evaluated over at most 5,000 matching contacts). |
| `q` | string | no | Search, max 100 characters: matches contact name/email/phone/company (first 500 contacts) or message text (first 1,000 conversations). Case-insensitive. |
| `sort` | string | no | `oldest` sorts by `updated_at` ascending; default newest first. |
| `page` | integer | no | Default `1`. |
| `limit` | integer | no | Default `40`, min `1`, max `100`. |

**Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/conversations?status=open&assigned=me&limit=20" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{
  "data": [
    { "id": "66f1a2b3c4d5e6f7a8b9c0d1", "status": "open", "assignee_id": "66e0aa11bb22cc33dd44ee55", "contact_id": "66f1a2b3c4d5e6f7a8b9c0c1", "contact": { "…": "Contact" }, "…": "full Conversation object" }
  ],
  "total": 1,
  "hasMore": false
}
```

Note the dashboard list uses `total` / `hasMore` rather than the v1 `pagination` object.

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 400 | `Create a website first.` | The user has no current website. |
| 500 | `Something went wrong` | The saved segment has an invalid filter (see [segments](segments.md#validation-caveat)). |

## POST /api/conversations

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Proactively message a contact (e.g. from Live visitors). Reuses the contact's current unresolved conversation or starts a new `widget` conversation, assigns it to the signed-in user, and posts the text as an operator message.

**Auth.** Any member.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `contactId` | string | yes | 24-hex contact ID. |
| `text` | string | yes | 1–5000 characters after trimming. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/conversations" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "contactId": "66f1a2b3c4d5e6f7a8b9c0c1", "text": "Hi Maya, need a hand with the pricing page?" }'
```

**Example response** — `201 Created`

```json
{
  "conversation": { "id": "66f1a2b3c4d5e6f7a8b9c0d2", "status": "open", "channel": "widget", "assignee_id": "66e0aa11bb22cc33dd44ee55", "contact": { "…": "Contact" }, "…": "full Conversation object" },
  "message": { "id": "66f1a2b3c4d5e6f7a8b9c110", "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d2", "from": "operator", "author": { "id": "66e0aa11bb22cc33dd44ee55", "name": "Jonas Weber", "avatar": "" }, "text": "Hi Maya, need a hand with the pricing page?", "attachments": [], "actions": [], "via": "", "created_at": "2026-10-14T11:00:00.000Z" }
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `contactId: Invalid` / `text: …` | Validation failed. |
| 404 | `Contact not found` | Unknown contact. |

## GET /api/conversations/counts

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Sidebar badge counts.

**Auth.** Any member. **Params.** None.

| Field | Meaning |
|---|---|
| `open` | Conversations with status `open`. |
| `pending` | Status `pending`. |
| `mine` | `open` and assigned to the signed-in user. |
| `unassigned` | `open` and unassigned. |
| `unread` | Not resolved and with unread visitor messages. |
| `snoozed` | `snoozed_until` in the future. |

**Example request**

```bash
curl "$HEARTHLY_URL/api/conversations/counts" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{ "open": 12, "pending": 3, "mine": 4, "unassigned": 2, "unread": 5, "snoozed": 1 }
```

**Errors.** `401 Please sign in.`

## GET /api/conversations/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Open a conversation: the conversation (with contact) plus its latest 300 messages, oldest first.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Example request**

```bash
curl "$HEARTHLY_URL/api/conversations/66f1a2b3c4d5e6f7a8b9c0d1" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{
  "conversation": { "id": "66f1a2b3c4d5e6f7a8b9c0d1", "status": "open", "contact": { "…": "Contact" }, "…": "full Conversation object" },
  "messages": [
    { "id": "66f1a2b3c4d5e6f7a8b9c101", "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1", "from": "visitor", "author": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "name": "Maya Fischer", "avatar": "" }, "text": "Can I switch to annual billing?", "attachments": [], "actions": [], "via": "", "created_at": "2026-10-14T09:12:40.000Z" }
  ]
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 404 | `Not found` | Malformed ID. |
| 404 | `Conversation not found` | Unknown ID or another website's conversation. |

## PATCH /api/conversations/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Update status, assignee, tags, snooze or subject. Each assignment, snooze and status change also posts a `system` message into the conversation (e.g. "Jonas Weber took this conversation", "Jonas Weber marked as resolved"). New tags are added to the website's tag list with color `#64748b`.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Body params** (JSON; all optional)

| Name | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | `open`, `pending` or `resolved`. |
| `assignee` | string \| null | no | 24-hex user ID of a team member, or `null` to unassign. |
| `tags` | string[] | no | Replaces the tags (deduplicated). Max 20, each 1–40 characters. |
| `snoozeUntil` | string \| null | no | ISO 8601 datetime (UTC, e.g. `2026-10-15T08:00:00Z`). Setting it also sets status `pending`; `null` clears the snooze. |
| `subject` | string | no | Max 200 characters. |

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/conversations/66f1a2b3c4d5e6f7a8b9c0d1" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "assignee": "66e0aa11bb22cc33dd44ee55", "snoozeUntil": "2026-10-15T08:00:00Z" }'
```

**Example response** — `200 OK` (the Conversation object, not wrapped)

```json
{ "id": "66f1a2b3c4d5e6f7a8b9c0d1", "status": "pending", "snoozed_until": "2026-10-15T08:00:00.000Z", "assignee_id": "66e0aa11bb22cc33dd44ee55", "contact": { "…": "Contact" }, "…": "full Conversation object" }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Assignee must be a team member` | `assignee` isn't a member of the website. |
| 400 | `snoozeUntil: Invalid datetime` etc. | Validation failed. |
| 404 | `Conversation not found` | Unknown conversation. |

## DELETE /api/conversations/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Permanently delete a conversation and all its messages.

**Auth.** Dashboard role admin or owner.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Example request**

```bash
curl -X DELETE "$HEARTHLY_URL/api/conversations/66f1a2b3c4d5e6f7a8b9c0d1" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 403 | `Only admins can do that.` | Caller is an agent. |
| 404 | `Conversation not found` | Unknown conversation. |

## POST /api/conversations/{id}/messages

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Send an operator reply, or a private note. A reply (not a note) to an unassigned conversation assigns it to the sender.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex conversation ID. |

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `text` | string | no* | Max 5000 characters. Default `""`. |
| `note` | boolean | no | Default `false`. `true` posts a private note (`from: "note"`). |
| `attachments` | object[] | no* | Max 5. Each `{ id, name, size, type }`: `id` 24-hex file ID from the upload endpoint (must belong to this website), `name` max 200, `size` number, `type` max 120. |

\* At least one of non-blank `text` or `attachments` is required.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/conversations/66f1a2b3c4d5e6f7a8b9c0d1/messages" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "text": "Yes! I have switched you over." }'
```

**Example response** — `201 Created` (the Message object, not wrapped)

```json
{ "id": "66f1a2b3c4d5e6f7a8b9c103", "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1", "from": "operator", "author": { "id": "66e0aa11bb22cc33dd44ee55", "name": "Jonas Weber", "avatar": "" }, "text": "Yes! I have switched you over.", "attachments": [], "actions": [], "via": "", "created_at": "2026-10-14T09:15:30.000Z" }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Message is empty` | No text and no attachments. |
| 400 | `Unknown attachment` | An attachment ID doesn't exist or belongs to another website. |
| 404 | `Conversation not found` | Unknown conversation. |

## POST /api/conversations/{id}/read

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Mark the conversation as read by the team: resets `unread` to 0 and sends a read receipt to the visitor's widget.

**Auth.** Any member. **Body.** None (ignored).

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/conversations/66f1a2b3c4d5e6f7a8b9c0d1/read" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors.** `404 Not found` for a malformed ID. An unknown but well-formed ID still returns `{ "ok": true }` and does nothing.

## POST /api/conversations/{id}/typing

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Broadcast an operator typing indicator. It goes to teammates and, unless `note` is truthy, to the visitor (showing the operator's first name).

**Auth.** Any member.

**Body params** (JSON, parsed leniently — invalid JSON is treated as `{}`)

| Name | Type | Required | Notes |
|---|---|---|---|
| `typing` | boolean | no | Truthy = typing started, falsy = stopped. |
| `note` | boolean | no | Truthy when typing a private note: the visitor isn't notified. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/conversations/66f1a2b3c4d5e6f7a8b9c0d1/typing" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" -d '{ "typing": true }'
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors.** `404 Not found` for a malformed ID; unknown well-formed IDs return `{ "ok": true }`.
