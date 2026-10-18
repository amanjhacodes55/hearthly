# Hearthly API reference

Everything the Hearthly dashboard does goes through HTTP endpoints in this repository (`src/app/api/**`).
This reference documents **every** route handler, grouped by resource. It is written against the code — if
you find a mismatch, the code wins and a PR to fix the docs is very welcome.

- Machine-readable spec for the public API: [`../openapi.yaml`](../openapi.yaml) (OpenAPI 3.1)
- In-app quick reference: `https://YOUR-HOST/developers/docs`
- Runnable examples: [`../../examples`](../../examples)

## Contents

| Page | What's inside | Stability |
| --- | --- | --- |
| [Conversations & messages](conversations.md) | REST v1 conversations/messages + dashboard inbox endpoints | v1 public · dashboard internal |
| [Contacts](contacts.md) | REST v1 contacts + dashboard CRUD, merge, CSV import/export | v1 public · dashboard internal |
| [Inbound channels](inbound.md) | `POST /api/v1/inbound` — bridge Slack, Telegram, SMS, email… | public |
| [Webhooks](webhooks.md) | Subscriptions, every event with payloads, signatures, retries, delivery log | v1 + payload format public |
| [OAuth 2.0 + PKCE](oauth.md) | Authorization-code flow, token, refresh, revoke, scopes | public |
| [Widget & JS API](widget.md) | Embed snippet, `window.Hearthly`, all `/api/widget/*` endpoints | public |
| [Realtime (SSE)](realtime.md) | `/api/stream` and `/api/widget/stream` event streams | widget stream public · dashboard internal |
| [Websites](websites.md) | REST v1 website, workspaces, widget settings, data export | v1 public · dashboard internal |
| [Segments](segments.md) | Saved contact filters and the condition language | internal |
| [Campaigns](campaigns.md) | In-widget / email campaigns to segments | internal |
| [Triggers](triggers.md) | Automations: conditions and actions | internal |
| [Knowledge base](knowledge-base.md) | Articles, categories, widget search, public help center | internal (+ public widget search) |
| [Attachments](attachments.md) | Uploads (dashboard + widget) and file downloads | internal / widget |
| [Visitors & tracking](visitors.md) | Live visitors, page views, presence model | internal |
| [Analytics](analytics.md) | Response times, CSAT, volume, heatmap, sources | internal |
| [Developer apps](apps.md) | Register OAuth apps, rotate secrets, installations | internal |
| [API keys](api-keys.md) | Create / list / revoke scoped keys | internal |
| [Account & team](team.md) | Register, profile, members, invites, shortcuts, `/api/health` | internal (+ public health) |

## Base URL

All paths are relative to your deployment's origin, e.g. `https://chat.example.com` (or
`http://localhost:3005` in development). There is no separate API host. Examples use two shell variables:

```bash
export HEARTHLY_URL=http://localhost:3005
export HEARTHLY_KEY=hly_key_...        # Settings → API keys
```

## Authentication

Hearthly has four kinds of callers, each with its own credential:

| Caller | Credential | Used by | Error shape |
| --- | --- | --- | --- |
| **Your servers** | API key `Authorization: Bearer hly_key_…` with explicit scopes | `/api/v1/**` | `{ "error": { "code", "message" } }` |
| **Third-party apps** | OAuth access token `Authorization: Bearer hly_at_…` (1 hour; refreshable) | `/api/v1/**` | `{ "error": { "code", "message" } }` |
| **The dashboard** | NextAuth session cookie (email + password, optional Google) | internal `/api/*` | `{ "error": "message" }` |
| **Website visitors** | Signed visitor token in the `Hearthly-Token` header (or `?token=` for EventSource / `<img>`) | `/api/widget/*`, `/api/files/*` | `{ "error": "message" }` |

API keys and OAuth tokens are stored only as SHA-256 hashes; the plaintext is shown once at creation.
Scopes (shared by API keys and OAuth apps):

| Scope | Grants |
| --- | --- |
| `conversations:read` | Read conversations and messages |
| `conversations:write` | Update conversations (assign, resolve, tag) |
| `messages:write` | Send messages as an operator or bot, and post inbound visitor messages |
| `contacts:read` | Read contacts and their activity |
| `contacts:write` | Create and update contacts |
| `webhooks:manage` | Create and delete webhooks |
| `website:read` | Read basic website information |

Dashboard endpoints additionally check the member's **role** in the current website: `member`
(default), `admin` (settings, webhooks, keys, team) or `owner` (delete website, transfer). Each endpoint
lists the minimum role it needs. The "current website" is stored on the user (`POST /api/websites/switch`).

## Errors

**REST v1 / OAuth-token callers** always get a JSON envelope with a stable machine-readable code:

```json
{ "error": { "code": "insufficient_scope", "message": "This token lacks the \"contacts:write\" scope" } }
```

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `bad_request` | Malformed request (e.g. invalid JSON) |
| 401 | `unauthorized` | Missing, invalid, expired or revoked token (`WWW-Authenticate: Bearer` is set) |
| 403 | `insufficient_scope` | Token is valid but lacks the endpoint's scope |
| 404 | `not_found` | Resource doesn't exist in the token's website (IDs from other websites are also 404) |
| 413 | `bad_request` | Body larger than 256 KB |
| 422 | `validation_failed` | Body failed schema validation; `message` lists `path: problem` pairs |
| 429 | `rate_limited` | Rate limit exceeded — see `Retry-After` |
| 500 | `server_error` | Unexpected error (logged server-side) |

The OAuth token/revoke endpoints follow RFC 6749 instead: `{ "error": "invalid_grant", "error_description": "…" }`
(see [oauth.md](oauth.md)).

**Dashboard and widget endpoints** return `{ "error": "Human readable message" }` with the usual status
codes (400 validation — message lists `path: problem` pairs, 401 not signed in / bad visitor token, 403 role
too low, 404 not found or not in your website, 413 body > 256 KB, 429 rate limited, 500 — a database outage is
reported as `"Database unavailable — please retry shortly."`).

## Pagination

REST v1 list endpoints use page-based pagination:

```
GET /api/v1/contacts?page=2&limit=50
```

| Param | Default | Limits |
| --- | --- | --- |
| `page` | `1` | ≥ 1 |
| `limit` | `20` | 1–100 |

```json
{ "data": [ … ], "pagination": { "page": 2, "limit": 50, "total": 342, "has_more": true } }
```

Lists are sorted newest-activity first (conversations by `updated_at`, contacts by last seen); message lists
return page 1 = newest. Dashboard list endpoints accept the same `page` / `limit` params (default 30, max 100)
unless stated otherwise on their page.

## Rate limits

All limits are in-memory token buckets (Hearthly is designed to run as a single instance):

| Surface | Key | Limit |
| --- | --- | --- |
| REST v1 | per token | burst **120**, refills **2 req/s**; every response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining` |
| Widget (`/api/widget/*`) | per client IP and endpoint bucket | documented per endpoint in [widget.md](widget.md) |
| `POST /api/register` | per IP | 5 per hour |
| Credentials sign-in | per email | 10 attempts per 10 minutes |
| `POST /api/oauth/token` | per IP | burst 30, refills 0.5 req/s (`429 slow_down`) |

A `429` always includes `Retry-After` (seconds).

## Request format

- JSON bodies (`Content-Type: application/json`), max **256 KB**; uploads are `multipart/form-data`
  (see [attachments.md](attachments.md)); the OAuth token endpoints accept form-encoded bodies.
- IDs are 24-character hex strings (MongoDB ObjectIds), except the public **website id** used by the widget
  (`data-website`), which is a short public id.
- Timestamps are ISO 8601 UTC strings; objects use `snake_case` fields in the public API.

## Versioning and stability

| Label | Meaning |
| --- | --- |
| **Public · stable** | `/api/v1/**`, the OAuth endpoints, the inbound API, webhook payloads and the widget JS API (`window.Hearthly`). Breaking changes only in a new version (`/api/v2`); new optional fields and new event types may be added at any time — ignore what you don't know. |
| **Public (widget)** | `/api/widget/*`: used by `widget.js`. Usable for custom widgets; may gain fields. |
| **Internal — may change** | Every other `/api/*` endpoint. They're documented so you can understand and extend Hearthly, but they follow the dashboard and can change in any release. Prefer v1 for integrations. |

## Endpoint index

**Public (stable)**

| Method | Path | Scope |
| --- | --- | --- |
| GET | `/api/v1/website` | any valid token |
| GET | `/api/v1/conversations` | `conversations:read` |
| GET, PATCH | `/api/v1/conversations/{id}` | `conversations:read` / `conversations:write` |
| GET, POST | `/api/v1/conversations/{id}/messages` | `conversations:read` / `messages:write` |
| GET, POST | `/api/v1/contacts` | `contacts:read` / `contacts:write` |
| GET, PATCH | `/api/v1/contacts/{id}` | `contacts:read` / `contacts:write` |
| GET, POST | `/api/v1/webhooks` | `webhooks:manage` |
| DELETE | `/api/v1/webhooks/{id}` | `webhooks:manage` |
| POST | `/api/v1/inbound` | `messages:write` |
| GET (page) | `/oauth/authorize` | — |
| POST | `/api/oauth/token` | client credentials |
| POST | `/api/oauth/revoke` | client credentials |
| GET | `/api/health` | none |

**Widget (public, visitor token)** — `/api/widget/session`, `config`, `messages`, `upload`, `typing`, `read`,
`rate`, `transcript`, `identify`, `event`, `page`, `ping`, `action`, `kb`, `stream`, plus `GET /api/files/{id}`.
See [widget.md](widget.md).

**Internal (dashboard)** — `/api/conversations*`, `/api/contacts*`, `/api/segments*`, `/api/websites*`,
`/api/export`, `/api/team*`, `/api/invites`, `/api/me`, `/api/register`, `/api/auth/*`, `/api/shortcuts*`,
`/api/triggers*`, `/api/campaigns*`, `/api/kb/*`, `/api/analytics`, `/api/visitors/live`, `/api/upload`,
`/api/stream`, `/api/webhooks*`, `/api/apikeys*`, `/api/dev/apps*`, `/api/installations*`.
