# Webhooks

Hearthly webhooks push signed JSON events (new messages, conversations, contacts, ratings, campaigns) to an HTTPS endpoint you control. You can manage endpoints in two ways:

- **REST API v1** (`/api/v1/webhooks`). This is the public, stable interface for integrations and OAuth apps. It needs the `webhooks:manage` scope.
- **Dashboard API** (`/api/webhooks/**`). This internal API powers **Settings → Webhooks** and also covers editing, secret rotation, test pings, delivery logs and redelivery.

The second half of this page, [Receiving webhooks](#receiving-webhooks), describes the payload format, every event, signature verification, retries and security. Treat it as the **public, stable** contract.

For shared conventions, see [Authentication](README.md#authentication), [Errors](README.md#errors), [Rate limits](README.md#rate-limits) and [Versioning and stability](README.md#versioning-and-stability).

## Contents

**Managing webhooks: REST API v1 (public)**

- [GET /api/v1/webhooks](#get-apiv1webhooks): list webhooks
- [POST /api/v1/webhooks](#post-apiv1webhooks): create a webhook
- [DELETE /api/v1/webhooks/{id}](#delete-apiv1webhooksid): delete a webhook

**Managing webhooks: dashboard API (internal)**

- [GET /api/webhooks](#get-apiwebhooks): list webhooks with 7-day delivery stats
- [POST /api/webhooks](#post-apiwebhooks): create a webhook
- [GET /api/webhooks/{id}](#get-apiwebhooksid): get one webhook (optionally reveal its secret)
- [PATCH /api/webhooks/{id}](#patch-apiwebhooksid): update, enable/disable, rotate the secret
- [DELETE /api/webhooks/{id}](#delete-apiwebhooksid): delete a webhook
- [POST /api/webhooks/{id}/test](#post-apiwebhooksidtest): send a `ping`
- [GET /api/webhooks/{id}/deliveries](#get-apiwebhooksiddeliveries): recent deliveries and their attempt logs
- [POST /api/webhooks/deliveries/{id}/redeliver](#post-apiwebhooksdeliveriesidredeliver): redeliver an event

**[Receiving webhooks](#receiving-webhooks)**

- [The webhook object](#the-webhook-object)
- [Envelope](#envelope)
- [HTTP request and headers](#http-request-and-headers)
- [Event types](#event-types) and [sample payloads](#event-payloads)
- [Verifying signatures](#verifying-signatures) (Node.js and Python)
- [Responding, timeouts and retries](#responding-timeouts-and-retries)
- [Idempotency and ordering](#idempotency-and-ordering)
- [Signing secrets](#signing-secrets)
- [Endpoint URL rules and SSRF protection](#endpoint-url-rules-and-ssrf-protection)
- [Disabling, failures and deletion](#disabling-failures-and-deletion)

---

## The webhook object

The REST API and the dashboard API both return webhooks in this shape. The dashboard list endpoint adds a `stats` field.

| Field | Type | Notes |
|---|---|---|
| `id` | string | 24-hex ObjectId. |
| `url` | string | The endpoint that receives deliveries. |
| `events` | string[] | The [event types](#event-types) this endpoint subscribes to. |
| `description` | string | Free text. Empty string if not set. |
| `active` | boolean | Inactive webhooks get no new deliveries. |
| `secret_hint` | string | The first 10 characters of the signing secret followed by `…`, for example `whsec_GZ6S…`. |
| `created_via` | string | `dashboard`, `api:<API key name>` or `app:<OAuth app name>`. |
| `failures` | integer | Failed delivery attempts since the last successful one. A success resets it to `0`. It is informational only and never disables the webhook ([details](#disabling-failures-and-deletion)). |
| `created_at` | string | ISO 8601 timestamp. |

---

## GET /api/v1/webhooks

> **Public · stable.** Part of REST API v1.

**Purpose:** Lists every webhook on the website the token belongs to, newest first. The list includes webhooks created in the dashboard, by API keys and by apps.

**Auth:** `Authorization: Bearer hly_key_…` or `Bearer hly_at_…`. Scope: `webhooks:manage`.

**Path params:** None.
**Query params:** None. The list is not paginated. A website can have at most 25 webhooks.
**Body:** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/webhooks" \
  -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** `200 OK`

```json
{
  "data": [
    {
      "id": "749afa1aa026458bc31ebad5",
      "url": "https://hooks.example.test/hearthly",
      "events": ["message.received", "conversation.created"],
      "description": "Sync to CRM",
      "active": true,
      "secret_hint": "whsec_GZ6S…",
      "created_via": "api:CRM sync",
      "failures": 0,
      "created_at": "2026-10-12T09:41:07.512Z"
    }
  ]
}
```

**Errors** (format: `{ "error": { "code", "message" } }`)

| Status | `code` | When |
|---|---|---|
| 401 | `unauthorized` | Missing, invalid, expired or revoked token. |
| 403 | `insufficient_scope` | The token lacks `webhooks:manage`. |
| 429 | `rate_limited` | More than 120 requests in a burst or 2 req/s sustained. See `Retry-After`. |
| 500 | `server_error` | Unexpected error. |

---

## POST /api/v1/webhooks

> **Public · stable.** Part of REST API v1.

**Purpose:** Subscribes a URL to one or more events. The response includes the **signing secret in `secret` exactly once**. Store it right away. The v1 API cannot return it again. A dashboard admin can reveal it later.

If the caller is an OAuth app, the webhook is linked to the app's installation. When the app is uninstalled or deleted, the webhook is deleted too ([details](oauth.md#installations-and-uninstalling)).

**Auth:** API key or OAuth access token. Scope: `webhooks:manage`.

**Path params:** None.
**Query params:** None.

**Body** (`application/json`, at most 256 KB)

| Name | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | Must be an absolute `http://` or `https://` URL, at most 1000 characters (trimmed). In production it must resolve to a public IP ([SSRF rules](#endpoint-url-rules-and-ssrf-protection)). |
| `events` | string[] | yes | At least one value from the [event types](#event-types). `ping` is not subscribable. |
| `description` | string | no | At most 200 characters. Default `""`. |

New webhooks are always created active.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/v1/webhooks" \
  -H "Authorization: Bearer $HEARTHLY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.example.test/hearthly",
    "events": ["message.received", "conversation.created"],
    "description": "Sync to CRM"
  }'
```

**Example response** `201 Created`

```json
{
  "data": {
    "id": "749afa1aa026458bc31ebad5",
    "url": "https://hooks.example.test/hearthly",
    "events": ["message.received", "conversation.created"],
    "description": "Sync to CRM",
    "active": true,
    "secret_hint": "whsec_GZ6S…",
    "created_via": "api:CRM sync",
    "failures": 0,
    "created_at": "2026-10-12T09:41:07.512Z"
  },
  "secret": "whsec_GZ6SdH6bWsqJduCwQM3RzUgOG178zK0b"
}
```

**Errors**

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | Invalid JSON body. Also when the URL fails the SSRF check (`"URL points to a private network address, which is not allowed"`, `"Only http(s) URLs are allowed"`, or a DNS lookup error), or the website already has 25 webhooks (`"Limit of 25 webhooks per website"`). |
| 401 | `unauthorized` | Missing, invalid, expired or revoked token. |
| 403 | `insufficient_scope` | The token lacks `webhooks:manage`. |
| 413 | `bad_request` | Body larger than 256 KB (`"Body too large"`). |
| 422 | `validation_failed` | Schema validation failed, for example `"events: Array must contain at least 1 element(s)"` or an unknown event name. |
| 429 | `rate_limited` | Rate limit exceeded. |
| 500 | `server_error` | Unexpected error. |

---

## DELETE /api/v1/webhooks/{id}

> **Public · stable.** Part of REST API v1.

**Purpose:** Deletes a webhook on the token's website, together with its whole delivery history, including deliveries still waiting for a retry. Any webhook on the website can be deleted, not only ones the caller created.

**Auth:** API key or OAuth access token. Scope: `webhooks:manage`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-character lowercase hex webhook id. |

**Query params:** None.
**Body:** None.

**Example request**

```bash
curl -X DELETE "$HEARTHLY_URL/api/v1/webhooks/749afa1aa026458bc31ebad5" \
  -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** `200 OK`

```json
{ "deleted": true }
```

**Errors**

| Status | `code` | When |
|---|---|---|
| 401 | `unauthorized` | Missing, invalid, expired or revoked token. |
| 403 | `insufficient_scope` | The token lacks `webhooks:manage`. |
| 404 | `not_found` | Malformed id, or no such webhook on this website (`"Webhook not found"`). |
| 429 | `rate_limited` | Rate limit exceeded. |
| 500 | `server_error` | Unexpected error. |

---

## GET /api/webhooks

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Lists the current website's webhooks, newest first. It also returns the catalog of subscribable events and per-webhook delivery counts for the last 7 days.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params:** None.
**Query params:** None.
**Body:** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/webhooks" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** `200 OK`

`stats` maps a delivery status (`pending`, `success`, `failed`) to the number of deliveries created in the last 7 days. Statuses with no deliveries are left out, so a quiet webhook has `stats: {}`.

```json
{
  "events": {
    "message.received": "A visitor sent a message",
    "message.sent": "An operator, bot or app sent a message",
    "conversation.created": "A new conversation started",
    "conversation.resolved": "A conversation was resolved",
    "contact.created": "A new contact/visitor was created",
    "contact.updated": "A contact's profile changed",
    "visitor.identified": "A visitor was identified (email set)",
    "rating.submitted": "A visitor rated a conversation",
    "campaign.sent": "A campaign finished sending"
  },
  "data": [
    {
      "id": "749afa1aa026458bc31ebad5",
      "url": "https://hooks.example.test/hearthly",
      "events": ["message.received", "conversation.created"],
      "description": "Sync to CRM",
      "active": true,
      "secret_hint": "whsec_GZ6S…",
      "created_via": "dashboard",
      "failures": 0,
      "created_at": "2026-10-12T09:41:07.512Z",
      "stats": { "success": 128, "failed": 2 }
    }
  ]
}
```

**Errors** (format: `{ "error": "message" }`)

| Status | Message | When |
|---|---|---|
| 400 | `Create a website first.` | The signed-in user has no website. |
| 401 | `Please sign in.` | No valid session. |
| 403 | `Only admins can do that.` | The user's role is `agent`. |
| 500 | `Something went wrong` / `Database unavailable — please retry shortly.` | Server or database error. |

---

## POST /api/webhooks

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Creates a webhook on the current website. Validation and limits match [POST /api/v1/webhooks](#post-apiv1webhooks). `created_via` is always `dashboard`.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params:** None.
**Query params:** None.

**Body** (`application/json`, at most 256 KB)

| Name | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | `http(s)` URL, at most 1000 characters, must pass the [SSRF check](#endpoint-url-rules-and-ssrf-protection). |
| `events` | string[] | yes | At least 1 [event type](#event-types). |
| `description` | string | no | At most 200 characters. Default `""`. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/webhooks" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://hooks.example.test/hearthly","events":["message.received"]}'
```

**Example response** `201 Created`

Unlike v1, this response has no `data` wrapper. It has `webhook` and `secret` keys.

```json
{
  "webhook": {
    "id": "33f60c36bb8a3e64f9ab370f",
    "url": "https://hooks.example.test/hearthly",
    "events": ["message.received"],
    "description": "",
    "active": true,
    "secret_hint": "whsec_lpIZ…",
    "created_via": "dashboard",
    "failures": 0,
    "created_at": "2026-10-14T16:02:55.090Z"
  },
  "secret": "whsec_lpIZsrZ82HehKN9BcGSeBQLvBqlkOWrh"
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Invalid JSON body` | Body is not JSON. |
| 400 | `url: Invalid url`, `events: Array must contain at least 1 element(s)`, … | Validation failed. The `field: message` pairs are joined with `; `. |
| 400 | `URL points to a private network address, which is not allowed` / `Only http(s) URLs are allowed` | SSRF check failed. |
| 400 | `Limit of 25 webhooks per website` | Already 25 webhooks. |
| 400 | `Create a website first.` | No website. |
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 413 | `Request body too large` | Body larger than 256 KB. |

---

## GET /api/webhooks/{id}

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Returns one webhook. With `?reveal=1` the response also includes the decrypted signing secret. The dashboard uses this for its **Reveal secret** button.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex webhook id. |

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `reveal` | string | no | Exactly `1` adds `secret` to the response. Any other value is ignored. |

**Body:** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/webhooks/749afa1aa026458bc31ebad5?reveal=1" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** `200 OK`

```json
{
  "id": "749afa1aa026458bc31ebad5",
  "url": "https://hooks.example.test/hearthly",
  "events": ["message.received", "conversation.created"],
  "description": "Sync to CRM",
  "active": true,
  "secret_hint": "whsec_GZ6S…",
  "created_via": "dashboard",
  "failures": 0,
  "created_at": "2026-10-12T09:41:07.512Z",
  "secret": "whsec_GZ6SdH6bWsqJduCwQM3RzUgOG178zK0b"
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 404 | `Not found` | Malformed id, or the webhook is not on the current website. |

---

## PATCH /api/webhooks/{id}

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Partially updates a webhook. It can change the URL, events or description, enable or disable the webhook, and rotate the signing secret.

- Setting `active: true` also resets `failures` to `0`.
- When `rotateSecret` is `true`, a new `whsec_…` secret is generated and returned once in `secret`. The old secret **stops working immediately**. Every later delivery attempt, including retries of events created before the rotation, is signed with the new secret.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex webhook id. |

**Query params:** None.

**Body** (`application/json`). All fields are optional. Fields you leave out are not changed.

| Name | Type | Required | Notes |
|---|---|---|---|
| `url` | string | no | `http(s)` URL, at most 1000 characters. Re-checked against the [SSRF rules](#endpoint-url-rules-and-ssrf-protection). |
| `events` | string[] | no | If present, it needs at least 1 [event type](#event-types) and replaces the whole list. |
| `description` | string | no | At most 200 characters. |
| `active` | boolean | no | `false` stops new deliveries and makes pending retries fail. `true` re-enables the webhook and resets `failures`. |
| `rotateSecret` | boolean | no | `true` generates a new signing secret. |

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/webhooks/749afa1aa026458bc31ebad5" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"rotateSecret": true}'
```

**Example response** `200 OK`

This is the updated webhook. `secret` appears only when `rotateSecret` was `true`.

```json
{
  "id": "749afa1aa026458bc31ebad5",
  "url": "https://hooks.example.test/hearthly",
  "events": ["message.received", "conversation.created"],
  "description": "Sync to CRM",
  "active": true,
  "secret_hint": "whsec_ZKvv…",
  "created_via": "dashboard",
  "failures": 0,
  "created_at": "2026-10-12T09:41:07.512Z",
  "secret": "whsec_ZKvv6jtt6DgJLVUZU51B7fT5wEPhEZ9R"
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Invalid JSON body` / validation message | Bad body. |
| 400 | `URL points to a private network address, which is not allowed` / `Only http(s) URLs are allowed` | New URL fails the SSRF check. |
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 404 | `Not found` | Malformed id, or not on the current website. |
| 413 | `Request body too large` | Body larger than 256 KB. |

---

## DELETE /api/webhooks/{id}

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Deletes the webhook and all its deliveries, including pending retries.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex webhook id. |

**Query params:** None.
**Body:** None.

**Example request**

```bash
curl -X DELETE "$HEARTHLY_URL/api/webhooks/749afa1aa026458bc31ebad5" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** `200 OK`

```json
{ "ok": true }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 404 | `Not found` | Malformed id, or not on the current website. |

---

## POST /api/webhooks/{id}/test

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Builds a signed [`ping`](#ping) event and delivers it to the endpoint right away. The request waits for the attempt to finish, so it can take up to the 10-second delivery timeout. The test is a normal delivery:

- it appears in the [delivery log](#get-apiwebhooksiddeliveries)
- it changes `failures`
- if it fails, it is **retried on the normal schedule**

If the webhook is disabled, the delivery is marked `failed` with the error `Webhook deleted or disabled` and nothing is sent.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex webhook id. |

**Query params:** None.
**Body:** None.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/webhooks/749afa1aa026458bc31ebad5/test" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** `200 OK`

`id` is the delivery id. `status` is `success`, `pending` (failed, retry scheduled) or `failed`. `log` holds the attempt entries ([format](#delivery-log-entry)).

```json
{
  "id": "d48da639ac47373a0338534b",
  "status": "success",
  "log": [
    {
      "at": "2026-10-14T16:05:12.418Z",
      "status": 200,
      "durationMs": 184,
      "error": "",
      "response": "ok",
      "requestHeaders": {
        "Content-Type": "application/json",
        "User-Agent": "Hearthly-Webhooks/1.0",
        "Hearthly-Signature": "t=1791993912,v1=3c1f0d8e2b7a49e5c6d1f08a7b2e93c4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        "Hearthly-Event": "ping",
        "Hearthly-Delivery": "d48da639ac47373a0338534b",
        "Hearthly-Timestamp": "1791993912"
      }
    }
  ]
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 404 | `Not found` | Malformed id, or not on the current website. |

---

## GET /api/webhooks/{id}/deliveries

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Returns the **50 most recent** deliveries for a webhook, newest first, each with its full payload and attempt log. There is no pagination.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex webhook id. |

**Query params:** None.
**Body:** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/webhooks/749afa1aa026458bc31ebad5/deliveries" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** `200 OK`

This is a bare array, and its fields are camelCase. `payload` is the exact request body as a **string**. `nextAttemptAt` is set only while `status` is `pending`.

```json
[
  {
    "id": "2b1efe062bd302f9a5e72392",
    "event": "message.received",
    "eventId": "evt_21098872229e4e7ea4e97a3e4f5f8c05",
    "status": "pending",
    "attempts": 2,
    "nextAttemptAt": "2026-10-14T16:09:40.002Z",
    "createdAt": "2026-10-14T16:07:09.871Z",
    "payload": "{\"id\":\"evt_21098872229e4e7ea4e97a3e4f5f8c05\",\"event\":\"message.received\",\"website_id\":\"3553592859d1362a59419b18\",\"created_at\":\"2026-10-14T16:07:09.866Z\",\"data\":{…}}",
    "log": [
      {
        "at": "2026-10-14T16:07:19.880Z",
        "status": 0,
        "durationMs": 10004,
        "error": "The operation was aborted due to timeout",
        "response": "",
        "requestHeaders": { "Content-Type": "application/json", "User-Agent": "Hearthly-Webhooks/1.0", "Hearthly-Signature": "t=1791994029,v1=…", "Hearthly-Event": "message.received", "Hearthly-Delivery": "2b1efe062bd302f9a5e72392", "Hearthly-Timestamp": "1791994029" }
      },
      {
        "at": "2026-10-14T16:07:50.031Z",
        "status": 503,
        "durationMs": 92,
        "error": "HTTP 503",
        "response": "Service Unavailable",
        "requestHeaders": { "Content-Type": "application/json", "User-Agent": "Hearthly-Webhooks/1.0", "Hearthly-Signature": "t=1791994070,v1=…", "Hearthly-Event": "message.received", "Hearthly-Delivery": "2b1efe062bd302f9a5e72392", "Hearthly-Timestamp": "1791994070" }
      }
    ]
  }
]
```

### Delivery log entry

| Field | Type | Notes |
|---|---|---|
| `at` | string | When the attempt finished. |
| `status` | integer | HTTP status from your endpoint. `0` means no HTTP response: timeout, network or DNS error, or a blocked URL. |
| `durationMs` | integer | Round-trip time. |
| `error` | string | `""` on success. Otherwise `HTTP <status>` or the network error message. |
| `response` | string | The first 2000 characters of your response body. |
| `requestHeaders` | object | The headers sent on that attempt, including the signature. |

Each delivery keeps only its **last 20** attempt entries.

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 404 | `Not found` | Malformed id, or not on the current website. |

---

## POST /api/webhooks/deliveries/{id}/redeliver

> **Internal. May change.** Used by the Hearthly dashboard. Authenticated with the session cookie.

**Purpose:** Manually redelivers a past delivery, whatever its status. This creates a **new delivery**: it has a new delivery id and a fresh attempt counter, and it sends the **same payload with the same event id** under a fresh signature and timestamp. The handler attempts it right away and waits for the result. If that attempt fails, the new delivery is retried on the normal schedule.

**Auth:** Session cookie. Role: **admin** or **owner**.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex **delivery** id (from the deliveries list). It must belong to the current website. |

**Query params:** None.
**Body:** None.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/webhooks/deliveries/2b1efe062bd302f9a5e72392/redeliver" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** `200 OK`

```json
{
  "id": "67780c750ac4c76964f6e5c3",
  "status": "success",
  "log": [
    {
      "at": "2026-10-14T16:20:03.311Z",
      "status": 204,
      "durationMs": 77,
      "error": "",
      "response": "",
      "requestHeaders": { "Content-Type": "application/json", "User-Agent": "Hearthly-Webhooks/1.0", "Hearthly-Signature": "t=1791994803,v1=…", "Hearthly-Event": "message.received", "Hearthly-Delivery": "67780c750ac4c76964f6e5c3", "Hearthly-Timestamp": "1791994803" }
    }
  ]
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 403 | `Only admins can do that.` | Role is `agent`. |
| 404 | `Not found` | Malformed id, or the delivery is not on the current website. |

---

# Receiving webhooks

> **Public · stable.** The envelope, headers, signature scheme, event names and `data` shapes below are part of the public contract.

## Envelope

Every delivery is an HTTP `POST` with a JSON body in this envelope:

```json
{
  "id": "evt_21098872229e4e7ea4e97a3e4f5f8c05",
  "event": "message.received",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:07:09.866Z",
  "data": { }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Event id: `evt_` followed by 32 hex characters. It is the same for every endpoint that receives this event, and for every retry and redelivery. **Use it to dedupe.** |
| `event` | string | One of the [event types](#event-types), or `ping`. |
| `website_id` | string | The website (workspace) that produced the event. |
| `created_at` | string | When the event was generated (ISO 8601, UTC). The value does not change on retries. |
| `data` | object | Event-specific payload. See [Event payloads](#event-payloads). |

Objects inside `data` use the same serializers as REST API v1, so a `message`, `conversation` or `contact` in a webhook has the same shape you get from `/api/v1/**`.

## HTTP request and headers

| Header | Example | Notes |
|---|---|---|
| `Content-Type` | `application/json` | |
| `User-Agent` | `Hearthly-Webhooks/1.0` | |
| `Hearthly-Event` | `message.received` | Same as `event` in the body. |
| `Hearthly-Delivery` | `2b1efe062bd302f9a5e72392` | Delivery id: one per (event, endpoint). It stays the same across automatic retries of that delivery. A manual redelivery gets a new one. |
| `Hearthly-Timestamp` | `1791994029` | Unix seconds when this attempt was signed. It equals `t` in the signature. |
| `Hearthly-Signature` | `t=1791994029,v1=5f2c…` | HMAC-SHA256 signature. See [Verifying signatures](#verifying-signatures). |

Every attempt is signed again, so retries carry a new `Hearthly-Timestamp` and `Hearthly-Signature` with a byte-identical body.

## Event types

These are all the subscribable events (`WEBHOOK_EVENTS` in `src/lib/webhooks.ts`), plus the test-only `ping`:

| Event | Description | Fired when | `data` |
|---|---|---|---|
| [`message.received`](#messagereceived) | A visitor sent a message | A message with `from: "visitor"` is created: from the widget, or via `POST /api/v1/inbound` (channel bridges). | `{ message, conversation }` |
| [`message.sent`](#messagesent) | An operator, bot or app sent a message | A message with `from: "operator"` or `"bot"` is created. Sources include dashboard replies, `POST /api/v1/conversations/{id}/messages`, auto-message triggers, the offline auto-reply and help-center bot, and **every message a chat campaign sends**. Internal notes and system messages do **not** fire it. | `{ message, conversation }` |
| [`conversation.created`](#conversationcreated) | A new conversation started | A conversation is created: a visitor's first widget message, an agent starting a conversation from the dashboard, an inbound bridge message, or a campaign opening a conversation. | the conversation object itself (**not** wrapped) |
| [`conversation.resolved`](#conversationresolved) | A conversation was resolved | Status is set to `resolved` from the dashboard, through `PATCH /api/v1/conversations/{id}`, or by the auto-resolve job. | `{ conversation, resolved_by }` |
| [`contact.created`](#contactcreated) | A new contact/visitor was created | A new widget visitor session, a contact created in the dashboard or by `POST /api/v1/contacts`, or a new contact from `POST /api/v1/inbound`. | `{ contact }` |
| [`contact.updated`](#contactupdated) | A contact's profile changed | A contact is edited in the dashboard or the v1 contacts API, a contact is merged, or a visitor is identified from the widget (name, email, phone, company, custom data). | `{ contact }` |
| [`visitor.identified`](#visitoridentified) | A visitor was identified (email set) | Widget identify sets an email that differs from the contact's current one. It also fires when contacts are merged in the dashboard. A `contact.updated` is **also** sent for the same change. | `{ contact }` |
| [`rating.submitted`](#ratingsubmitted) | A visitor rated a conversation | The visitor submits a 1–5 rating in the widget. | `{ conversation, rating }` |
| [`campaign.sent`](#campaignsent) | A campaign finished sending | An admin sends a campaign and all recipients have been processed. | `{ campaign }` |
| [`ping`](#ping) | Test event | Only from the dashboard's **Send test** button ([POST /api/webhooks/{id}/test](#post-apiwebhooksidtest)). You can't subscribe to it. | `{ message }` |

Your endpoint receives only the events it subscribed to. `ping` is sent to whichever endpoint is being tested.

## Event payloads

### Shared objects

**Message** (`data.message`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `conversation_id` | string | |
| `from` | string | `visitor`, `operator`, `bot`, `system` or `note`. Webhooks only carry `visitor`, `operator` and `bot`. |
| `author` | object \| null | `{ id, name, avatar }`. `id` is a contact id for visitor messages, a user id for agents, `api_key:<id>` or `app:<id>` for REST API senders, or `null` for bots. |
| `text` | string | |
| `attachments` | array | `{ id, name, size, type }` |
| `actions` | array | Quick-reply buttons `{ label }` (bot messages). |
| `via` | string | Origin hint, for example `""` (widget or dashboard), the API key or app name, `campaign:<name>`, `trigger:<name>`, or `<channel> (<actor>)` for inbound. |
| `created_at` | string | |

**Conversation** (`data.conversation`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `status` | string | `open`, `pending` or `resolved`. |
| `snoozed_until` | string \| null | |
| `assignee_id` | string \| null | User id. |
| `tags` | string[] | |
| `subject` | string | |
| `channel` | string | `widget` (default), `campaign`, or an inbound channel name. |
| `last_message` | object \| null | `{ text, from, at }` |
| `unread` | integer | Messages unread by agents. |
| `visitor_unread` | integer | Messages unread by the visitor. |
| `visitor_read_at` | string \| null | |
| `rating` | object \| null | `{ score, comment, at }` |
| `first_response_at` | string \| null | |
| `resolved_at` | string \| null | |
| `created_at`, `updated_at` | string | |
| `contact_id` | string | |
| `contact` | object | The full contact object. It is included in every webhook that carries a conversation. |

**Contact** (`data.contact`, `conversation.contact`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `email`, `name`, `phone`, `company`, `avatar` | string | `""` when unknown. |
| `tags` | string[] | |
| `data` | object | Custom attributes. |
| `geo` | object | `{ country, country_name, city, timezone, locale }` |
| `device` | object | `{ browser, browser_version, os, os_version, type }` |
| `referrer` | string | |
| `utm` | object | `{ source, medium, campaign, term, content }` |
| `current_page` | object \| null | `{ url, title, since }` |
| `sessions`, `page_views` | integer | |
| `events` | string[] | Names of tracked events. |
| `source` | string | `widget`, `manual`, `api`, `channel:<name>`, … |
| `external_id` | string | |
| `first_seen_at`, `last_seen_at`, `created_at` | string \| null | |
| `online` | boolean | `true` if seen in the last 75 seconds. |

### message.received

```json
{
  "id": "evt_21098872229e4e7ea4e97a3e4f5f8c05",
  "event": "message.received",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:07:09.866Z",
  "data": {
    "message": {
      "id": "04279426943db3146b050561",
      "conversation_id": "52edf12594943b86b2104b44",
      "from": "visitor",
      "author": { "id": "6749c5324c9aed5c63e73951", "name": "Maya Chen", "avatar": "" },
      "text": "Hi! Can I upgrade to the annual plan mid-cycle?",
      "attachments": [],
      "actions": [],
      "via": "",
      "created_at": "2026-10-14T16:07:09.841Z"
    },
    "conversation": {
      "id": "52edf12594943b86b2104b44",
      "status": "open",
      "snoozed_until": null,
      "assignee_id": "a749af532d5294ae6fe480ac",
      "tags": [],
      "subject": "",
      "channel": "widget",
      "last_message": { "text": "Hi! Can I upgrade to the annual plan mid-cycle?", "from": "visitor", "at": "2026-10-14T16:07:09.848Z" },
      "unread": 1,
      "visitor_unread": 0,
      "visitor_read_at": null,
      "rating": null,
      "first_response_at": null,
      "resolved_at": null,
      "created_at": "2026-10-14T16:07:09.512Z",
      "updated_at": "2026-10-14T16:07:09.848Z",
      "contact_id": "6749c5324c9aed5c63e73951",
      "contact": {
        "id": "6749c5324c9aed5c63e73951",
        "email": "maya.chen@example.test",
        "name": "Maya Chen",
        "phone": "",
        "company": "Lumen Labs",
        "avatar": "",
        "tags": ["trial"],
        "data": { "plan": "starter" },
        "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
        "device": { "browser": "Chrome", "browser_version": "129.0", "os": "macOS", "os_version": "14.6", "type": "desktop" },
        "referrer": "https://www.google.com/",
        "utm": { "source": "newsletter", "medium": "email", "campaign": "october", "term": "", "content": "" },
        "current_page": { "url": "https://shop.example.test/pricing", "title": "Pricing", "since": "2026-10-14T16:05:31.000Z" },
        "sessions": 3,
        "page_views": 14,
        "events": ["signup"],
        "source": "widget",
        "external_id": "",
        "first_seen_at": "2026-10-02T08:12:44.000Z",
        "last_seen_at": "2026-10-14T16:07:05.000Z",
        "online": true,
        "created_at": "2026-10-02T08:12:44.120Z"
      }
    }
  }
}
```

### message.sent

The `data` shape is the same as `message.received`. `from` is `operator` or `bot`, and `author` is set.

```json
{
  "id": "evt_b0c8c99c6f9b4607bd03a5a8abf80418",
  "event": "message.sent",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:08:41.203Z",
  "data": {
    "message": {
      "id": "191a2bcbe31fd1ff0b19637e",
      "conversation_id": "52edf12594943b86b2104b44",
      "from": "operator",
      "author": { "id": "a749af532d5294ae6fe480ac", "name": "Priya Raman", "avatar": "" },
      "text": "Yes — you'll only pay the prorated difference. Want me to switch it now?",
      "attachments": [],
      "actions": [],
      "via": "",
      "created_at": "2026-10-14T16:08:41.180Z"
    },
    "conversation": {
      "id": "52edf12594943b86b2104b44",
      "status": "open",
      "snoozed_until": null,
      "assignee_id": "a749af532d5294ae6fe480ac",
      "tags": ["billing"],
      "subject": "",
      "channel": "widget",
      "last_message": { "text": "Yes — you'll only pay the prorated difference. Want me to switch it now?", "from": "operator", "at": "2026-10-14T16:08:41.185Z" },
      "unread": 0,
      "visitor_unread": 1,
      "visitor_read_at": null,
      "rating": null,
      "first_response_at": "2026-10-14T16:08:41.185Z",
      "resolved_at": null,
      "created_at": "2026-10-14T16:07:09.512Z",
      "updated_at": "2026-10-14T16:08:41.190Z",
      "contact_id": "6749c5324c9aed5c63e73951",
      "contact": { "id": "6749c5324c9aed5c63e73951", "email": "maya.chen@example.test", "name": "Maya Chen", "…": "full contact object, as above" }
    }
  }
}
```

### conversation.created

Unlike the other events, `data` **is the conversation object itself**, with its `contact` embedded. It is not wrapped in `{ "conversation": … }`. At creation time `last_message` is normally `null` and counters are `0`. The message that started the conversation arrives separately as `message.received`, or as `message.sent` for campaigns.

```json
{
  "id": "evt_7163cdb29e1a4f7aa62a5f7c8a4368e5",
  "event": "conversation.created",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:07:09.530Z",
  "data": {
    "id": "52edf12594943b86b2104b44",
    "status": "open",
    "snoozed_until": null,
    "assignee_id": "a749af532d5294ae6fe480ac",
    "tags": [],
    "subject": "",
    "channel": "widget",
    "last_message": null,
    "unread": 0,
    "visitor_unread": 0,
    "visitor_read_at": null,
    "rating": null,
    "first_response_at": null,
    "resolved_at": null,
    "created_at": "2026-10-14T16:07:09.512Z",
    "updated_at": "2026-10-14T16:07:09.512Z",
    "contact_id": "6749c5324c9aed5c63e73951",
    "contact": {
      "id": "6749c5324c9aed5c63e73951",
      "email": "maya.chen@example.test",
      "name": "Maya Chen",
      "phone": "",
      "company": "Lumen Labs",
      "avatar": "",
      "tags": ["trial"],
      "data": { "plan": "starter" },
      "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
      "device": { "browser": "Chrome", "browser_version": "129.0", "os": "macOS", "os_version": "14.6", "type": "desktop" },
      "referrer": "https://www.google.com/",
      "utm": { "source": "newsletter", "medium": "email", "campaign": "october", "term": "", "content": "" },
      "current_page": { "url": "https://shop.example.test/pricing", "title": "Pricing", "since": "2026-10-14T16:05:31.000Z" },
      "sessions": 3,
      "page_views": 14,
      "events": ["signup"],
      "source": "widget",
      "external_id": "",
      "first_seen_at": "2026-10-02T08:12:44.000Z",
      "last_seen_at": "2026-10-14T16:07:05.000Z",
      "online": true,
      "created_at": "2026-10-02T08:12:44.120Z"
    }
  }
}
```

### conversation.resolved

`resolved_by` identifies who resolved the conversation:

| Value | Meaning |
|---|---|
| a 24-hex user id | A dashboard user. |
| `api_key:<key name>` | REST API v1 with an API key. |
| `app:<app name>` | REST API v1 with an OAuth access token. |
| `auto-resolve` | The website's auto-resolve rule (inactive for N days). |
| `null` | Unknown actor. |

```json
{
  "id": "evt_96f536ba63004e87a9b013b0e00505e1",
  "event": "conversation.resolved",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:31:58.017Z",
  "data": {
    "conversation": {
      "id": "52edf12594943b86b2104b44",
      "status": "resolved",
      "snoozed_until": null,
      "assignee_id": "a749af532d5294ae6fe480ac",
      "tags": ["billing"],
      "subject": "",
      "channel": "widget",
      "last_message": { "text": "Done — you're on annual now. 🎉", "from": "operator", "at": "2026-10-14T16:30:12.004Z" },
      "unread": 0,
      "visitor_unread": 0,
      "visitor_read_at": "2026-10-14T16:30:40.000Z",
      "rating": null,
      "first_response_at": "2026-10-14T16:08:41.185Z",
      "resolved_at": "2026-10-14T16:31:58.002Z",
      "created_at": "2026-10-14T16:07:09.512Z",
      "updated_at": "2026-10-14T16:31:58.003Z",
      "contact_id": "6749c5324c9aed5c63e73951",
      "contact": { "id": "6749c5324c9aed5c63e73951", "email": "maya.chen@example.test", "name": "Maya Chen", "…": "full contact object" }
    },
    "resolved_by": "a749af532d5294ae6fe480ac"
  }
}
```

### contact.created

```json
{
  "id": "evt_25d9045e54f740c385bdece9f1c3a4fa",
  "event": "contact.created",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T15:58:02.441Z",
  "data": {
    "contact": {
      "id": "6749c5324c9aed5c63e73951",
      "email": "",
      "name": "",
      "phone": "",
      "company": "",
      "avatar": "",
      "tags": [],
      "data": {},
      "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
      "device": { "browser": "Chrome", "browser_version": "129.0", "os": "macOS", "os_version": "14.6", "type": "desktop" },
      "referrer": "https://www.google.com/",
      "utm": { "source": "newsletter", "medium": "email", "campaign": "october", "term": "", "content": "" },
      "current_page": { "url": "https://shop.example.test/", "title": "Lumen Shop", "since": "2026-10-14T15:58:02.000Z" },
      "sessions": 1,
      "page_views": 1,
      "events": [],
      "source": "widget",
      "external_id": "",
      "first_seen_at": "2026-10-14T15:58:02.000Z",
      "last_seen_at": "2026-10-14T15:58:02.000Z",
      "online": true,
      "created_at": "2026-10-14T15:58:02.430Z"
    }
  }
}
```

### contact.updated

`data` contains the whole contact as it is after the change. Hearthly does not send a diff.

```json
{
  "id": "evt_f329ff0ae1b9477f93030ba84c032824",
  "event": "contact.updated",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:02:17.660Z",
  "data": {
    "contact": {
      "id": "6749c5324c9aed5c63e73951",
      "email": "maya.chen@example.test",
      "name": "Maya Chen",
      "phone": "+49 30 1234567",
      "company": "Lumen Labs",
      "avatar": "",
      "tags": ["trial", "vip"],
      "data": { "plan": "starter", "seats": 5 },
      "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
      "device": { "browser": "Chrome", "browser_version": "129.0", "os": "macOS", "os_version": "14.6", "type": "desktop" },
      "referrer": "https://www.google.com/",
      "utm": { "source": "newsletter", "medium": "email", "campaign": "october", "term": "", "content": "" },
      "current_page": { "url": "https://shop.example.test/account", "title": "Account", "since": "2026-10-14T16:01:50.000Z" },
      "sessions": 3,
      "page_views": 12,
      "events": ["signup"],
      "source": "widget",
      "external_id": "",
      "first_seen_at": "2026-10-02T08:12:44.000Z",
      "last_seen_at": "2026-10-14T16:02:10.000Z",
      "online": true,
      "created_at": "2026-10-02T08:12:44.120Z"
    }
  }
}
```

### visitor.identified

This fires once, when identify sets a **new** email on a contact. The same change also produces a `contact.updated`.

```json
{
  "id": "evt_8b1d6e0c2f9a4c7e9d3b5a1f0e2c4d6b",
  "event": "visitor.identified",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:02:17.664Z",
  "data": {
    "contact": {
      "id": "6749c5324c9aed5c63e73951",
      "email": "maya.chen@example.test",
      "name": "Maya Chen",
      "phone": "",
      "company": "Lumen Labs",
      "avatar": "",
      "tags": ["trial"],
      "data": { "plan": "starter" },
      "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
      "device": { "browser": "Chrome", "browser_version": "129.0", "os": "macOS", "os_version": "14.6", "type": "desktop" },
      "referrer": "https://www.google.com/",
      "utm": { "source": "newsletter", "medium": "email", "campaign": "october", "term": "", "content": "" },
      "current_page": { "url": "https://shop.example.test/signup", "title": "Sign up", "since": "2026-10-14T16:01:12.000Z" },
      "sessions": 3,
      "page_views": 11,
      "events": ["signup"],
      "source": "widget",
      "external_id": "",
      "first_seen_at": "2026-10-02T08:12:44.000Z",
      "last_seen_at": "2026-10-14T16:02:10.000Z",
      "online": true,
      "created_at": "2026-10-02T08:12:44.120Z"
    }
  }
}
```

### rating.submitted

`data.rating` is the same object as `data.conversation.rating`. `score` is an integer from 1 to 5 and `comment` can be `""`. A visitor can rate again, and each submission fires a new event with the latest rating.

```json
{
  "id": "evt_4e2a9c7b1d3f4a8e8c6b0d2f1a3e5c7d",
  "event": "rating.submitted",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:33:20.118Z",
  "data": {
    "conversation": {
      "id": "52edf12594943b86b2104b44",
      "status": "resolved",
      "snoozed_until": null,
      "assignee_id": "a749af532d5294ae6fe480ac",
      "tags": ["billing"],
      "subject": "",
      "channel": "widget",
      "last_message": { "text": "Done — you're on annual now. 🎉", "from": "operator", "at": "2026-10-14T16:30:12.004Z" },
      "unread": 0,
      "visitor_unread": 0,
      "visitor_read_at": "2026-10-14T16:30:40.000Z",
      "rating": { "score": 5, "comment": "Super quick, thanks!", "at": "2026-10-14T16:33:20.101Z" },
      "first_response_at": "2026-10-14T16:08:41.185Z",
      "resolved_at": "2026-10-14T16:31:58.002Z",
      "created_at": "2026-10-14T16:07:09.512Z",
      "updated_at": "2026-10-14T16:33:20.104Z",
      "contact_id": "6749c5324c9aed5c63e73951",
      "contact": { "id": "6749c5324c9aed5c63e73951", "email": "maya.chen@example.test", "name": "Maya Chen", "…": "full contact object" }
    },
    "rating": { "score": 5, "comment": "Super quick, thanks!", "at": "2026-10-14T16:33:20.101Z" }
  }
}
```

### campaign.sent

This fires once, after every recipient has been processed. Each in-chat campaign message has already fired its own `message.sent`, and `conversation.created` too when the campaign opened a new conversation.

| Field | Type | Notes |
|---|---|---|
| `campaign.id` | string | |
| `campaign.name` | string | |
| `campaign.channel` | string | `chat`, `email` or `both`. |
| `campaign.recipients` | integer | Contacts reached. For `chat`/`both` this counts in-chat messages posted. For `email` it counts emails sent. |
| `campaign.emailed` | integer | Contacts emailed (`email`/`both` only, contacts with an email address). |

```json
{
  "id": "evt_0a7c3e5b9d1f4b2a8e6c4d2b0f8a6e4c",
  "event": "campaign.sent",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-15T10:00:42.905Z",
  "data": {
    "campaign": {
      "id": "1769024270af9f4f9b7630e5",
      "name": "October product update",
      "channel": "both",
      "recipients": 412,
      "emailed": 371
    }
  }
}
```

### ping

The dashboard's **Send test** button sends this event. It is signed exactly like a real event.

```json
{
  "id": "evt_d3f1b7a95c2e4e0b9a8d6c4f2e0b1a3c",
  "event": "ping",
  "website_id": "3553592859d1362a59419b18",
  "created_at": "2026-10-14T16:05:12.230Z",
  "data": { "message": "Hello from Hearthly 👋" }
}
```

## Verifying signatures

Every request carries:

```
Hearthly-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
```

where

```
v1 = hex( HMAC_SHA256( key = <signing secret, the full "whsec_…" string as UTF-8>,
                       message = "<t>.<raw request body>" ) )
```

To verify a request:

1. Read the **raw** request body bytes **before** any JSON parsing. Re-serializing the parsed JSON changes the bytes and breaks the signature.
2. Parse `t` and `v1` from the header.
3. Reject the request if `|now − t| > 300` seconds (5-minute tolerance). This blocks replays.
4. Compute the expected HMAC over `` `${t}.${rawBody}` `` and compare it to `v1` with a **constant-time** comparison.
5. Only then parse the JSON and act on it.

### Node.js (Express)

```js
import crypto from "node:crypto";
import express from "express";

const SECRET = process.env.HEARTHLY_WEBHOOK_SECRET; // whsec_…
const TOLERANCE_SEC = 300;

export function verifyHearthlySignature(secret, rawBody, header, now = Math.floor(Date.now() / 1000)) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(now - t) > TOLERANCE_SEC) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.`).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const app = express();
const seen = new Set(); // use a persistent store (DB/Redis) in production

// express.raw keeps the body as a Buffer — don't use express.json() on this route.
app.post("/webhooks/hearthly", express.raw({ type: "application/json" }), (req, res) => {
  if (!verifyHearthlySignature(SECRET, req.body, req.get("Hearthly-Signature"))) {
    return res.status(400).send("bad signature");
  }
  const evt = JSON.parse(req.body.toString("utf8"));
  if (!seen.has(evt.id)) {
    seen.add(evt.id);
    // enqueue for async processing, e.g. queue.add(evt)
    console.log("received", evt.event, evt.id);
  }
  res.sendStatus(204); // respond fast (< 10 s)
});

app.listen(4100);
```

A zero-dependency version built on `node:http` is in [`examples/webhook-receiver/server.mjs`](../../examples/webhook-receiver/server.mjs).

### Python

```python
import hashlib
import hmac
import json
import time


def verify_hearthly_signature(secret: str, raw_body: bytes, header: str, tolerance: int = 300) -> bool:
    if not header:
        return False
    parts = dict(p.strip().split("=", 1) for p in header.split(",") if "=" in p)
    try:
        t = int(parts.get("t", ""))
    except ValueError:
        return False
    v1 = parts.get("v1", "")
    if not v1 or abs(time.time() - t) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)


# Flask example
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = "whsec_..."  # load from env


@app.post("/webhooks/hearthly")
def hearthly_webhook():
    raw = request.get_data()  # raw bytes, before JSON parsing
    if not verify_hearthly_signature(SECRET, raw, request.headers.get("Hearthly-Signature", "")):
        abort(400)
    evt = json.loads(raw)
    # dedupe on evt["id"], then process asynchronously
    return "", 204
```

See also [`examples/webhook-receiver/verify.py`](../../examples/webhook-receiver/verify.py).

### Test vector

| Input | Value |
|---|---|
| secret | `whsec_ZKvv6jtt6DgJLVUZU51B7fT5wEPhEZ9R` |
| t | `1792310400` |
| raw body | `{"id":"evt_x"}` |
| signed string | `1792310400.{"id":"evt_x"}` |
| expected `v1` | `f53987c755ed7194b7e1d28f92e364dcdba48334e49127bd4f58320f36db69c6` |

Your implementation is correct if it produces the same `v1` for these inputs, with the timestamp check disabled.

## Responding, timeouts and retries

- **Success:** any `2xx` status within **10 seconds**. The response body is ignored, but its first 2000 characters are stored in the delivery log.
- **Failure:** everything else:
  - any non-`2xx` status, **including `3xx`** (Hearthly does not follow redirects)
  - a timeout after 10 s
  - connection, TLS or DNS errors
  - a URL that fails the [SSRF check](#endpoint-url-rules-and-ssrf-protection) at send time
- Hearthly attempts the first delivery as soon as the event happens. Failed deliveries are retried with exponential backoff: `delay = min(30 s × 4^(attempt − 1), 12 h)`. The total is **at most 7 attempts**. After the 7th failure the delivery is marked `failed` and is not retried again, though you can still [redeliver it manually](#post-apiwebhooksdeliveriesidredeliver).

| Attempt | Delay after the previous failed attempt | Approx. time after the event |
|---|---|---|
| 1 | n/a (immediate) | 0 |
| 2 | 30 s | 30 s |
| 3 | 2 min | 2 min 30 s |
| 4 | 8 min | 10 min 30 s |
| 5 | 32 min | 42 min 30 s |
| 6 | 2 h 8 min | ~2 h 51 min |
| 7 (last) | 8 h 32 min | ~11 h 22 min |

Retries are picked up by an in-process scheduler that runs every **15 seconds** and processes up to 50 due deliveries per tick. Each retry can therefore run up to about 15 s later than the table shows. The 12-hour cap in the formula is never reached with 7 attempts. Retries depend on the scheduler running: a self-hosted instance started with `HEARTHLY_DISABLE_SCHEDULER=1`, or a runtime where the Node.js scheduler doesn't run, only makes the immediate first attempt, and you have to redeliver failures manually.

**Best practice:** verify the signature, store or enqueue the event, return `2xx` right away, and do slow work asynchronously.

## Idempotency and ordering

- **Dedupe on the envelope `id`** (`evt_…`). Automatic retries and manual redeliveries carry the same `id` and an identical body. Each endpoint subscribed to an event gets its own delivery, but every endpoint sees the same event `id`.
- `Hearthly-Delivery` identifies one (event, endpoint) delivery. It stays the same across automatic retries. A manual redelivery creates a new delivery id with the same event `id`.
- Hearthly sends events concurrently and doesn't guarantee their **order**. For example, a `message.received` can arrive before the `conversation.created` for the same conversation, and a retried event can arrive after newer events. Use `created_at` and the timestamps inside `data` (for example `conversation.updated_at`) to discard stale updates.
- Some actions fire several events. For example, identifying a visitor with a new email fires both `contact.updated` and `visitor.identified`.

## Signing secrets

- Format: `whsec_` followed by 32 base64url characters (24 random bytes).
- Every webhook has its own secret, generated by Hearthly. You can't choose it.
- Hearthly returns the secret once when the webhook is created, through `POST /api/v1/webhooks` or `POST /api/webhooks`. Only `secret_hint` (the first 10 characters) appears in lists.
- The secret is stored **encrypted**, not hashed, because Hearthly needs it to sign deliveries. Admins can reveal it in the dashboard ([GET /api/webhooks/{id}?reveal=1](#get-apiwebhooksid)).
- **Rotation** is available from the dashboard ([PATCH /api/webhooks/{id}](#patch-apiwebhooksid) with `rotateSecret: true`). It replaces the secret at once, with no overlap period. Deploy the new secret to your receiver right after rotating, or accept both the old and new secrets for a short time. The v1 API cannot rotate a secret. To get a new secret through v1, delete the webhook and create it again.

## Endpoint URL rules and SSRF protection

- The URL must be `http://` or `https://`, at most 1000 characters. Use `https://` in production.
- In **production** (`NODE_ENV=production`), Hearthly resolves the hostname and rejects it if **any** resolved address is private, loopback or link-local:
  - IPv4: `10.0.0.0/8`, `127.0.0.0/8`, `0.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` (CGNAT)
  - IPv6: `::1`, `::`, `fc00::/7` (`fc…`/`fd…`), `fe80::/10` (`fe80…`), and IPv4-mapped (`::ffff:a.b.c.d`) forms of the IPv4 ranges above
- The check runs when you create the webhook, when you change its URL, and **again before every delivery attempt**. This defends against DNS rebinding. A delivery blocked at send time is logged as a failed attempt and retried.
- Redirects are never followed (`redirect: "manual"`), so a public URL cannot bounce a delivery to an internal host. A `3xx` response counts as a failure.
- **`ALLOW_PRIVATE_URLS`** (server environment variable):
  - `ALLOW_PRIVATE_URLS=true` disables the private-address check everywhere, including production. Use it only for self-hosted, trusted setups.
  - Outside production the check is **off by default**, so `http://localhost:4100/webhook` works in local development. Set `ALLOW_PRIVATE_URLS=false` to enforce it in development too.
  - The `http(s)`-only rule always applies.

## Disabling, failures and deletion

- Disabling a webhook (`active: false` in [PATCH /api/webhooks/{id}](#patch-apiwebhooksid), or the **Active** switch in the dashboard) stops new deliveries. Deliveries that are still pending fail on their next attempt with `Webhook deleted or disabled`.
- `failures` counts consecutive failed attempts. Every failed attempt increments it, including test pings and each retry. Any success resets it to `0`, and so does re-enabling the webhook. The dashboard shows a red status dot when `failures > 2`. **Hearthly never disables a webhook automatically**, however many deliveries fail.
- Deleting a webhook (v1 or dashboard) also deletes its delivery history and cancels pending retries.
- Webhooks created by an OAuth app are deleted when the app is uninstalled from the website or when the developer deletes the app. Webhooks created with API keys or in the dashboard are not affected by app uninstalls, and deleting an API key does **not** delete the webhooks it created.
- A website can have at most **25** webhooks.
