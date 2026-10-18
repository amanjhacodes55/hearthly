# Websites

A website (also called a workspace) is the top-level container in Hearthly: it has its own widget, team, contacts, conversations, settings and API keys. A user can belong to several websites and switches between them in the dashboard; every dashboard API call acts on the user's *current* website. This page covers the public REST v1 website endpoint, the internal website-management endpoints (including the complete widget settings schema), and the full workspace JSON export.

See [Authentication](README.md#authentication), [Errors](README.md#errors) and [Versioning and stability](README.md#versioning-and-stability).

**Contents**

- REST v1 (public)
  - [GET /api/v1/website](#get-apiv1website)
- Dashboard (internal)
  - [GET /api/websites](#get-apiwebsites)
  - [POST /api/websites](#post-apiwebsites)
  - [GET /api/websites/current](#get-apiwebsitescurrent)
  - [PATCH /api/websites/current](#patch-apiwebsitescurrent) — includes the [widget settings schema](#widget-settings)
  - [DELETE /api/websites/current](#delete-apiwebsitescurrent)
  - [POST /api/websites/switch](#post-apiwebsitesswitch)
  - [POST /api/websites/join](#post-apiwebsitesjoin)
  - [GET /api/export](#get-apiexport)

Two IDs identify a website: the **internal ID** (24-hex ObjectId, used by the API and in webhook payloads as `website_id`) and the **public ID** (12-character code such as `k7m2p9xq4ram`, embedded in the widget snippet and help-center URLs).

---

## GET /api/v1/website

> **Public · stable** — part of REST API v1.

**Purpose.** Return the website the token belongs to, plus information about the token itself. Useful as a "who am I" / connectivity check after installing an API key or completing OAuth.

**Auth.** Any valid Bearer token (API key or OAuth access token). No specific scope is enforced — the `website:read` scope exists but this endpoint doesn't require it.

**Path params.** None. **Query params.** None. **Body params.** None.

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `data.id` | string | Public website ID (as used in the widget snippet). |
| `data.internal_id` | string | 24-hex internal ID (equals `website_id` in webhooks and the OAuth token response). |
| `data.name` | string | |
| `data.domain` | string | |
| `data.members` | integer | Number of team members. |
| `data.online` | boolean | `true` when inside availability hours **and** at least one agent is connected to the dashboard. |
| `data.within_hours` | boolean | Inside the configured availability hours (always `true` if hours are disabled). |
| `data.created_at` | string | ISO 8601. |
| `token.type` | string | `api_key` or `app` (OAuth). |
| `token.name` | string | API key name or OAuth app name. |
| `token.scopes` | string[] | Scopes granted to this token. |

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/website" -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** — `200 OK`

```json
{
  "data": {
    "id": "k7m2p9xq4ram",
    "internal_id": "6650a1b2c3d4e5f6a7b8c9d0",
    "name": "Fischer Design Shop",
    "domain": "shop.example.test",
    "members": 3,
    "online": true,
    "within_hours": true,
    "created_at": "2026-05-04T10:00:00.000Z"
  },
  "token": {
    "type": "api_key",
    "name": "Shop backend",
    "scopes": ["conversations:read", "messages:write", "contacts:read", "contacts:write"]
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | Missing, invalid, expired or revoked token. |
| 404 | `not_found` | `Website not found` (the website was deleted). |
| 429 | `rate_limited` | Rate limit exceeded. |

---

## GET /api/websites

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** List every website the signed-in user is a member of (for the website switcher).

**Auth.** Signed-in user; works even when the user has no current website.

**Params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/websites" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK` (bare array)

```json
[
  { "id": "6650a1b2c3d4e5f6a7b8c9d0", "name": "Fischer Design Shop", "publicId": "k7m2p9xq4ram", "domain": "shop.example.test", "role": "owner", "current": true },
  { "id": "6650a1b2c3d4e5f6a7b8c9e1", "name": "Fischer Blog", "publicId": "q3w8e5r2t9yu", "domain": "blog.example.test", "role": "agent", "current": false }
]
```

`role` is `owner`, `admin` or `agent`.

**Errors.** `401 Please sign in.`

## POST /api/websites

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Create a new website owned by the signed-in user and make it their current website. A random public ID and identity secret are generated; the widget title defaults to `Chat with <name>`.

**Auth.** Signed-in user; works without a current website.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | 1–80 characters after trimming. |
| `domain` | string | no | Max 200. Default `""`. |
| `sample` | boolean | no | Default `true`: seeds the website with sample contacts, conversations and content. Pass `false` for an empty website. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/websites" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "name": "Fischer Blog", "domain": "blog.example.test", "sample": false }'
```

**Example response** — `201 Created`

```json
{ "id": "6650a1b2c3d4e5f6a7b8c9e1", "publicId": "q3w8e5r2t9yu" }
```

**Errors.** `400` validation message (e.g. `name: String must contain at least 1 character(s)`); `401 Please sign in.`

## GET /api/websites/current

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Load the current website's settings.

**Auth.** Any member. `identitySecret` is only included for admins and owners.

**Params.** None.

**Response fields**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Internal ID. |
| `publicId` | string | Public ID. |
| `name`, `domain`, `logo` | string | |
| `widget` | object | Full [widget settings](#widget-settings): stored values merged over the defaults. |
| `availability` | object | `{ enabled, timezone, hours: [{ day, start, end }], offlineMessage }`. |
| `rules` | object | `{ autoAssign, rrIndex, offlineAutoReply, autoResolveDays, botEnabled }` (`rrIndex` is the internal round-robin cursor). |
| `tags` | object[] | Website tag palette `{ name, color }`. |
| `identitySecret` | string | HMAC key for verified widget identification (`user_hash`). Admin/owner only; omitted otherwise. |
| `role` | string | Caller's role on this website. |

**Example request**

```bash
curl "$HEARTHLY_URL/api/websites/current" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{
  "id": "6650a1b2c3d4e5f6a7b8c9d0",
  "publicId": "k7m2p9xq4ram",
  "name": "Fischer Design Shop",
  "domain": "shop.example.test",
  "logo": "",
  "widget": {
    "color": "#c2410c",
    "accent": "#8e2c5a",
    "gradient": true,
    "theme": "auto",
    "position": "right",
    "launcherIcon": "hearth",
    "launcherText": "",
    "radius": 18,
    "title": "Chat with Fischer Design Shop",
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
    "quickReplies": []
  },
  "availability": {
    "enabled": false,
    "timezone": "UTC",
    "hours": [
      { "day": 1, "start": "09:00", "end": "18:00" },
      { "day": 2, "start": "09:00", "end": "18:00" },
      { "day": 3, "start": "09:00", "end": "18:00" },
      { "day": 4, "start": "09:00", "end": "18:00" },
      { "day": 5, "start": "09:00", "end": "18:00" }
    ],
    "offlineMessage": "We're away right now — leave a message and we'll reply by email."
  },
  "rules": { "autoAssign": false, "rrIndex": 0, "offlineAutoReply": true, "autoResolveDays": 0, "botEnabled": true },
  "tags": [{ "name": "billing", "color": "#0ea5e9" }],
  "identitySecret": "q9Zs3kV1m0r8XcT2bYw7nL4pHf6dJa5e",
  "role": "owner"
}
```

**Errors.** `401 Please sign in.`; `400 Create a website first.`; `404 Not found`.

## PATCH /api/websites/current

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Update website settings. Every top-level field is optional. Connected dashboards are notified of the change in realtime; widgets pick up new settings the next time they load their config.

**Auth.** Dashboard role admin or owner.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `name` | string | no | 1–80 characters. |
| `domain` | string | no | Max 200. |
| `logo` | string | no | URL (max 500) or `""`. |
| `widget` | object | no | Partial [widget settings](#widget-settings). Only the keys you send are changed. |
| `availability` | object | no | Replaces the whole availability block — all four sub-fields are required (see below). |
| `rules` | object | no | Partial; only the keys you send are changed (see below). |
| `tags` | object[] | no | Replaces the tag palette. Max 100 items `{ name, color }`: `name` 1–40 characters, `color` `#rrggbb`. |
| `rotateIdentitySecret` | boolean | no | `true` generates a new identity secret. Existing `user_hash` values stop verifying. |

**`availability`** (all required when the object is sent)

| Name | Type | Notes |
|---|---|---|
| `enabled` | boolean | `false` = always within hours. |
| `timezone` | string | IANA time zone, max 64, e.g. `Europe/Berlin`. Rejected if unknown. |
| `hours` | object[] | Max 21 entries `{ day, start, end }`: `day` 0 (Sunday) – 6 (Saturday); `start`/`end` `HH:MM` 24-hour (`00:00`–`23:59`, or `24:00`). A time is inside hours if `start <= time < end` for an entry of that weekday. |
| `offlineMessage` | string | Max 500. Sent as the offline auto-reply. |

**`rules`** (all optional)

| Name | Type | Notes |
|---|---|---|
| `autoAssign` | boolean | Round-robin new conversations to members (preferring agents online). |
| `offlineAutoReply` | boolean | Send `offlineMessage` when a visitor writes outside hours / with nobody online. |
| `autoResolveDays` | integer | 0–90. Auto-resolve inactive conversations after N days; `0` disables. |
| `botEnabled` | boolean | Suggest help-center articles to visitors while offline. |

### Widget settings

All keys are optional in a PATCH. Defaults are what a new website starts with.

| Key | Type | Limits / enum | Default |
|---|---|---|---|
| `color` | string | `#rrggbb` | `#c2410c` |
| `accent` | string | `#rrggbb` | `#8e2c5a` |
| `gradient` | boolean | | `true` |
| `theme` | string | `light`, `dark`, `auto` | `auto` |
| `position` | string | `left`, `right` | `right` |
| `launcherIcon` | string | `hearth`, `bubble`, `wave`, `spark`, `help` | `hearth` |
| `launcherText` | string | max 30 | `""` |
| `radius` | integer | 0–28 (corner radius, px) | `18` |
| `title` | string | max 60 | `Chat with <website name>` (new websites) |
| `welcome` | string | max 300 | `Hi there 👋 How can we help today?` |
| `teamName` | string | max 60 | `""` |
| `showTeam` | boolean | | `true` |
| `showBranding` | boolean | | `true` |
| `sound` | boolean | | `true` |
| `hideOnMobile` | boolean | | `false` |
| `hideOnUrls` | string[] | max 20 items, each max 200 | `[]` |
| `autoOpenAfterSec` | integer | 0–600; `0` disables | `0` |
| `autoOpenOnUrls` | string[] | max 20 items, each max 200 | `[]` |
| `preChat` | object | `{ enabled: boolean, fields: Field[] }` — both keys required when sent; max 6 fields | `{ "enabled": false, "fields": [] }` |
| `strings` | object | Map of UI-string overrides, values max 200, max 40 keys | `{}` |
| `locale` | string | max 10 | `en` |
| `allowAttachments` | boolean | | `true` |
| `allowRating` | boolean | | `true` |
| `allowTranscript` | boolean | | `true` |
| `kbSearch` | boolean | Help-center search in the widget | `true` |
| `quickReplies` | object[] | max 6 `{ label (max 60), reply (max 500), tag (max 40) }` — all three required | `[]` |

Pre-chat `Field`:

| Key | Type | Notes |
|---|---|---|
| `key` | string | `^[a-z0-9_]{1,30}$` (case-insensitive). |
| `label` | string | Max 60. |
| `type` | string | `text`, `email`, `tel` or `textarea`. |
| `required` | boolean | |

Each widget key is replaced as a whole: sending `preChat` or `quickReplies` replaces the entire object/array.

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/websites/current" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{
    "widget": {
      "color": "#0f766e",
      "position": "left",
      "preChat": { "enabled": true, "fields": [ { "key": "email", "label": "Your email", "type": "email", "required": true } ] },
      "quickReplies": [ { "label": "Track my order", "reply": "Where is my order?", "tag": "orders" } ]
    },
    "availability": {
      "enabled": true,
      "timezone": "Europe/Berlin",
      "hours": [ { "day": 1, "start": "09:00", "end": "17:00" }, { "day": 5, "start": "09:00", "end": "13:00" } ],
      "offlineMessage": "We are offline — leave your email and we will get back to you."
    },
    "rules": { "autoAssign": true }
  }'
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

The response doesn't echo the settings; re-fetch `GET /api/websites/current` if you need them.

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | e.g. `widget.color: Invalid`, `availability.hours.0.start: Invalid` | Validation failed. |
| 400 | `Unknown time zone` | `availability.timezone` isn't a valid IANA zone. |
| 403 | `Only admins can do that.` | Caller is an agent. |

## DELETE /api/websites/current

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Permanently delete the current website and everything in it: contacts, conversations, messages, page views, events, segments, shortcuts, triggers, campaigns, help-center content, webhooks, app installations, API keys and invites. Users whose current website it was are left without a current website.

**Auth.** Dashboard role **owner**.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `confirm` | string | yes | Must equal the website's name exactly. |

**Example request**

```bash
curl -X DELETE "$HEARTHLY_URL/api/websites/current" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "confirm": "Fischer Blog" }'
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Type the website name to confirm.` | `confirm` doesn't match. |
| 400 | `confirm: Required` | Missing body field. |
| 403 | `Only the owner can do that.` | Caller isn't the owner. |

## POST /api/websites/switch

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Change the signed-in user's current website. Subsequent dashboard API calls act on it.

**Auth.** Signed-in user who is a member of the target website.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex internal website ID. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/websites/switch" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "id": "6650a1b2c3d4e5f6a7b8c9e1" }'
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `id: Invalid` | Not a 24-hex ID. |
| 403 | `Not a member of that website` | The user isn't a member. |

## POST /api/websites/join

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Accept a team invite: adds the signed-in user to the invite's website with the invite's role (`admin` or `agent`), counts one use of the invite, and switches the user to that website. If the user is already a member, nothing changes except the switch (and the invite use isn't counted).

**Auth.** Signed-in user; works without a current website.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `code` | string | yes | Invite code from the invite link, max 64. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/websites/join" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "code": "Xk2vR9pQ7mWz4tLc" }'
```

**Example response** — `200 OK`

```json
{ "ok": true, "website": "6650a1b2c3d4e5f6a7b8c9d0" }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 404 | `This invite link is invalid or expired.` | Unknown code, expired, or used up. |
| 403 | `This invite was issued for a different email address.` | The invite is bound to another email. |

## GET /api/export

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Download a full JSON export of the current website (data portability / backups).

**Auth.** Dashboard role admin or owner.

**Params.** None.

**Response.** `200 OK`, `Content-Type: application/json`, `Content-Disposition: attachment; filename="hearthly-export-YYYY-MM-DD.json"`, pretty-printed. Top-level keys:

| Key | Contents |
|---|---|
| `exported_at` | ISO 8601 timestamp. |
| `website` | The website document as stored (`_id`, `name`, `publicId`, `domain`, `logo`, `widget`, `availability`, `rules`, `tags`, `demo`, `createdAt`, `updatedAt`). **Excludes** `identitySecret` and the member list. |
| `contacts` | All contacts (including merged ones) as [Contact objects](contacts.md#the-contact-object). Contact notes, page views and events aren't included. |
| `conversations` | All conversations as [Conversation objects](conversations.md#the-conversation-object) (without embedded contact). |
| `messages` | All messages as [Message objects](conversations.md#the-message-object), oldest first, capped at 200,000. |
| `knowledge_base` | `{ categories: [...], articles: [...] }` as stored (`_id`, timestamps; `website`/`__v` removed). |
| `segments` | Segments as stored. |
| `shortcuts` | Saved replies as stored. |
| `triggers` | Automation triggers as stored. |
| `campaigns` | Campaigns as stored. |

API keys, webhooks, team members and app installations are not exported. Raw-document sections use MongoDB field names (`_id`, `createdAt`), unlike the serialized sections (`id`, `created_at`).

**Example request**

```bash
curl "$HEARTHLY_URL/api/export" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -o hearthly-export.json
```

**Example response** (abridged)

```json
{
  "exported_at": "2026-10-18T08:00:00.000Z",
  "website": {
    "_id": "6650a1b2c3d4e5f6a7b8c9d0",
    "name": "Fischer Design Shop",
    "publicId": "k7m2p9xq4ram",
    "domain": "shop.example.test",
    "logo": "",
    "widget": { "color": "#c2410c", "…": "…" },
    "availability": { "enabled": false, "timezone": "UTC", "hours": [], "offlineMessage": "…" },
    "rules": { "autoAssign": false, "rrIndex": 0, "offlineAutoReply": true, "autoResolveDays": 0, "botEnabled": true },
    "tags": [],
    "demo": false,
    "createdAt": "2026-05-04T10:00:00.000Z",
    "updatedAt": "2026-10-14T13:05:00.000Z"
  },
  "contacts": [ { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "email": "maya.fischer@example.test", "…": "Contact" } ],
  "conversations": [ { "id": "66f1a2b3c4d5e6f7a8b9c0d1", "status": "open", "…": "Conversation" } ],
  "messages": [ { "id": "66f1a2b3c4d5e6f7a8b9c101", "conversation_id": "66f1a2b3c4d5e6f7a8b9c0d1", "from": "visitor", "…": "Message" } ],
  "knowledge_base": { "categories": [], "articles": [] },
  "segments": [ { "_id": "66f2b0c1d2e3f4a5b6c7d801", "name": "Active German pro customers", "match": "all", "filters": [], "createdAt": "2026-10-01T08:30:00.000Z", "updatedAt": "2026-10-01T08:30:00.000Z" } ],
  "shortcuts": [],
  "triggers": [],
  "campaigns": []
}
```

**Errors.** `401 Please sign in.`; `403 Only admins can do that.`
