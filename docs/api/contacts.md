# Contacts

A contact is a person known to your Hearthly website: an anonymous widget visitor, someone who identified themselves, a contact created through the API, imported from CSV, or created by a [channel bridge](inbound.md). This page covers the public REST v1 contacts endpoints and the internal endpoints behind the dashboard's Contacts page (profile, notes, merge, CSV import/export).

See [Authentication](README.md#authentication), [Errors](README.md#errors), [Pagination](README.md#pagination) and [Rate limits](README.md#rate-limits).

**Contents**

- [The Contact object](#the-contact-object)
- REST v1 (public)
  - [GET /api/v1/contacts](#get-apiv1contacts)
  - [POST /api/v1/contacts](#post-apiv1contacts)
  - [GET /api/v1/contacts/{id}](#get-apiv1contactsid)
  - [PATCH /api/v1/contacts/{id}](#patch-apiv1contactsid)
- Dashboard (internal)
  - [GET /api/contacts](#get-apicontacts)
  - [POST /api/contacts](#post-apicontacts)
  - [GET /api/contacts/{id}](#get-apicontactsid)
  - [PATCH /api/contacts/{id}](#patch-apicontactsid)
  - [DELETE /api/contacts/{id}](#delete-apicontactsid)
  - [POST /api/contacts/{id}/merge](#post-apicontactsidmerge)
  - [POST /api/contacts/import](#post-apicontactsimport)
  - [GET /api/contacts/export](#get-apicontactsexport)

---

## The Contact object

Shared by REST v1, the dashboard API, the realtime stream and webhooks (`contact.created`, `contact.updated`, `visitor.identified`). Every string field is `""` rather than `null` when unknown.

| Field | Type | Notes |
|---|---|---|
| `id` | string | 24-hex ObjectId. |
| `email` | string | Lower-cased. |
| `name` | string | |
| `phone` | string | |
| `company` | string | |
| `avatar` | string | Avatar URL (set by verified widget identify). |
| `tags` | string[] | |
| `data` | object | Custom attributes: string, number, boolean or null values. |
| `geo` | object | `{ country, country_name, city, timezone, locale }` — `country` is an ISO country code. |
| `device` | object | `{ browser, browser_version, os, os_version, type }` — `type` is `desktop`, `mobile`, `tablet` or `bot`. |
| `referrer` | string | First referrer seen. |
| `utm` | object | `{ source, medium, campaign, term, content }`. |
| `current_page` | object \| null | `{ url, title, since }` while the visitor is browsing. |
| `sessions` | integer | Number of widget sessions (`0` for contacts created by API/import/bridge). |
| `page_views` | integer | |
| `events` | string[] | Names of tracked events the contact has performed. |
| `source` | string | `widget`, `api`, `manual` (dashboard), `import`, or `channel:<name>` (inbound bridge). |
| `external_id` | string | Your own ID for the contact. Contacts created by the Inbound API store it as `<channel>:<external_id>`. |
| `first_seen_at` | string \| null | ISO 8601. |
| `last_seen_at` | string \| null | ISO 8601. |
| `online` | boolean | `true` if `last_seen_at` is less than 75 seconds ago. |
| `created_at` | string | ISO 8601. |

Example:

```json
{
  "id": "66f1a2b3c4d5e6f7a8b9c0c1",
  "email": "maya.fischer@example.test",
  "name": "Maya Fischer",
  "phone": "+49 30 5550 1234",
  "company": "Fischer Design",
  "avatar": "",
  "tags": ["vip", "newsletter"],
  "data": { "plan": "pro", "seats": 5, "trial": false },
  "geo": { "country": "DE", "country_name": "Germany", "city": "Berlin", "timezone": "Europe/Berlin", "locale": "de-DE" },
  "device": { "browser": "Firefox", "browser_version": "131.0", "os": "Linux", "os_version": "", "type": "desktop" },
  "referrer": "https://news.example.test/",
  "utm": { "source": "newsletter", "medium": "email", "campaign": "october-launch", "term": "", "content": "" },
  "current_page": { "url": "https://shop.example.test/pricing", "title": "Pricing", "since": "2026-10-14T09:10:02.000Z" },
  "sessions": 4,
  "page_views": 23,
  "events": ["signed_up", "upgraded"],
  "source": "widget",
  "external_id": "",
  "first_seen_at": "2026-09-30T15:02:11.000Z",
  "last_seen_at": "2026-10-14T09:13:05.000Z",
  "online": true,
  "created_at": "2026-09-30T15:02:11.000Z"
}
```

---

## GET /api/v1/contacts

> **Public · stable** — part of REST API v1.

**Purpose.** List or search contacts, most recently seen first. Contacts that were merged into another contact are excluded.

**Auth.** Bearer token with scope `contacts:read`.

**Path params.** None.

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `email` | string | no | Exact email match (case-insensitive). |
| `q` | string | no | Case-insensitive substring match on name or email (first 100 characters used). |
| `tag` | string | no | Only contacts with this tag. |
| `page` | integer | no | Default `1`. |
| `limit` | integer | no | Default `20`, min `1`, max `100`. |

**Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/contacts?email=maya.fischer@example.test" \
  -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** — `200 OK`

```json
{
  "data": [
    { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "email": "maya.fischer@example.test", "name": "Maya Fischer", "…": "full Contact object" }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "has_more": false }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | Missing or invalid token. |
| 403 | `insufficient_scope` | Token lacks `contacts:read`. |
| 429 | `rate_limited` | Rate limit exceeded. |

## POST /api/v1/contacts

> **Public · stable** — part of REST API v1.

**Purpose.** Create a contact, or update ("upsert") an existing one. Matching:

1. If `email` is given, the existing non-merged contact with that email is updated.
2. Otherwise, if `external_id` is given, the contact with exactly that `external_id` is updated.
3. Otherwise a new contact is created with `source: "api"`.

On update, given fields overwrite stored ones, `tags` are **added** to the existing tags, and `data` keys are merged in (other keys are kept). Responds `201` for a new contact and `200` with `"merged": true` for an update. Fires `contact.created` or `contact.updated`.

**Auth.** Bearer token with scope `contacts:write`.

**Path params.** None. **Query params.** None.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `email` | string | no* | Valid email, max 200, lower-cased. |
| `name` | string | no* | Max 100. |
| `phone` | string | no | Max 40. |
| `company` | string | no | Max 100. |
| `tags` | string[] | no | Max 30 tags, each 1–40 characters. |
| `data` | object | no | Custom attributes; values are string (max 500), number, boolean or null. Keys not matching `^[A-Za-z0-9_-]{1,60}$` are silently dropped on update; on create the object is stored as given. |
| `external_id` | string | no* | Max 100. |

\* At least one of `email`, `name` or `external_id` is required.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/v1/contacts" \
  -H "Authorization: Bearer $HEARTHLY_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "email": "maya.fischer@example.test", "name": "Maya Fischer", "tags": ["customer"], "data": { "plan": "pro", "seats": 5 }, "external_id": "cus_8842" }'
```

**Example response** — `201 Created`

```json
{
  "data": {
    "id": "66f1a2b3c4d5e6f7a8b9c0c7",
    "email": "maya.fischer@example.test",
    "name": "Maya Fischer",
    "phone": "",
    "company": "",
    "avatar": "",
    "tags": ["customer"],
    "data": { "plan": "pro", "seats": 5 },
    "geo": { "country": "", "country_name": "", "city": "", "timezone": "", "locale": "" },
    "device": { "browser": "", "browser_version": "", "os": "", "os_version": "", "type": "" },
    "referrer": "",
    "utm": { "source": "", "medium": "", "campaign": "", "term": "", "content": "" },
    "current_page": null,
    "sessions": 0,
    "page_views": 0,
    "events": [],
    "source": "api",
    "external_id": "cus_8842",
    "first_seen_at": "2026-10-14T12:00:00.000Z",
    "last_seen_at": "2026-10-14T12:00:00.000Z",
    "online": true,
    "created_at": "2026-10-14T12:00:00.000Z"
  }
}
```

When the email already existed: `200 OK` with `{ "data": { …Contact }, "merged": true }`.

Note: a freshly created contact has `last_seen_at` set to the creation time, so `online` is `true` for the first 75 seconds.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Body isn't valid JSON. |
| 403 | `insufficient_scope` | Token lacks `contacts:write`. |
| 422 | `validation_failed` | Schema validation failed (e.g. `email: Invalid email`), or `Provide email, name or external_id`. |

## GET /api/v1/contacts/{id}

> **Public · stable** — part of REST API v1.

**Purpose.** Fetch one contact.

**Auth.** Bearer token with scope `contacts:read`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex contact ID. |

**Query params.** None. **Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/v1/contacts/66f1a2b3c4d5e6f7a8b9c0c1" -H "Authorization: Bearer $HEARTHLY_KEY"
```

**Example response** — `200 OK`

```json
{ "data": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "email": "maya.fischer@example.test", "name": "Maya Fischer", "…": "full Contact object" } }
```

Unlike the list endpoint, this also returns contacts that have been merged into another contact (their `email` is empty after a merge).

**Errors**

| Status | Code | When |
|---|---|---|
| 403 | `insufficient_scope` | Token lacks `contacts:read`. |
| 404 | `not_found` | `Contact not found`. |

## PATCH /api/v1/contacts/{id}

> **Public · stable** — part of REST API v1.

**Purpose.** Update a contact. Fires `contact.updated`.

**Auth.** Bearer token with scope `contacts:write`.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex contact ID. |

**Body params** (JSON; all optional — same schema as POST)

| Name | Type | Required | Notes |
|---|---|---|---|
| `email` | string | no | Valid email, max 200. Not checked for uniqueness. |
| `name` | string | no | Max 100. |
| `phone` | string | no | Max 40. |
| `company` | string | no | Max 100. |
| `tags` | string[] | no | **Replaces** the tag list. Max 30, each 1–40 characters. |
| `data` | object | no | **Merged** per key into existing custom data; keys must match `^[A-Za-z0-9_-]{1,60}$` (others are dropped). Set a key to `null` to blank it. |
| `external_id` | string | no | Max 100; `""` clears it. |

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/v1/contacts/66f1a2b3c4d5e6f7a8b9c0c1" \
  -H "Authorization: Bearer $HEARTHLY_KEY" -H "Content-Type: application/json" \
  -d '{ "company": "Fischer Design GmbH", "data": { "plan": "business" } }'
```

**Example response** — `200 OK`

```json
{ "data": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "company": "Fischer Design GmbH", "data": { "plan": "business", "seats": 5, "trial": false }, "…": "full Contact object" } }
```

**Errors**

| Status | Code | When |
|---|---|---|
| 403 | `insufficient_scope` | Token lacks `contacts:write`. |
| 404 | `not_found` | `Contact not found`. |
| 422 | `validation_failed` | Schema validation failed. |

---

## GET /api/contacts

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** The Contacts page list, with search, tag, saved-segment and ad-hoc filter support. Merged contacts are excluded.

**Auth.** Any member (agent, admin or owner).

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `q` | string | no | Substring match on name, email, phone or company (max 100 characters). |
| `tag` | string | no | Contact tag. |
| `identified` | string | no | `1` → only contacts with an email. |
| `segment` | string | no | 24-hex ID of a saved [segment](segments.md). |
| `filters` | string | no | URL-encoded JSON array of [filter conditions](segments.md#filter-conditions) (max 20), for ad-hoc filtering without saving a segment. |
| `match` | string | no | `any` to OR the `filters`; anything else ANDs them. Applies to `filters` only (a saved segment uses its own `match`). |
| `sort` | string | no | `lastSeenAt` (default), `firstSeenAt`, `name`, `email` or `sessions`. |
| `dir` | string | no | `asc`; anything else is descending. |
| `page` | integer | no | Default `1`. |
| `limit` | integer | no | Default `50`, min `1`, max `200`. |

All given filters are combined with AND.

**Example request**

```bash
curl -G "$HEARTHLY_URL/api/contacts" -H "Cookie: $HEARTHLY_SESSION_COOKIE" \
  --data-urlencode 'filters=[{"field":"country","op":"eq","value":"DE"},{"field":"sessions","op":"gt","value":"3"}]' \
  --data-urlencode 'sort=sessions'
```

**Example response** — `200 OK`

```json
{ "data": [ { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "…": "full Contact object" } ], "total": 1, "hasMore": false }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Invalid filters` | `filters` isn't a valid filter array. |
| 400 | *(JSON parser message)* | `filters` isn't valid JSON. |
| 400 | e.g. `Operator gt not valid for country`, `Custom data filters need a key` | A filter (ad-hoc or in the saved segment) uses an operator not allowed for its field. |

## POST /api/contacts

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Create a contact manually (`source: "manual"`). If a non-merged contact with the same email exists it's updated instead: non-empty `name`/`phone`/`company` overwrite, tags are added, `data` keys merged.

**Auth.** Any member.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `email` | string | no* | Valid email or `""`, max 200. Default `""`. |
| `name` | string | no* | Max 100. Default `""`. |
| `phone` | string | no | Max 40. |
| `company` | string | no | Max 100. |
| `tags` | string[] | no | Max 30, each 1–40. |
| `data` | object | no | Values string (max 500), number, boolean or null. |

\* At least a name or an email.

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/contacts" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "name": "Lukas Brandt", "email": "lukas.brandt@example.test", "tags": ["lead"] }'
```

**Example response** — `201 Created` with the Contact object (unwrapped). For an existing email: `200 OK` with the Contact fields plus `"merged": true`.

```json
{ "id": "66f1a2b3c4d5e6f7a8b9c0c8", "email": "lukas.brandt@example.test", "name": "Lukas Brandt", "tags": ["lead"], "source": "manual", "…": "full Contact object" }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `Provide at least a name or an email` | Both empty. |
| 400 | `email: Invalid email` etc. | Validation failed. |

## GET /api/contacts/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Full visitor profile: the contact, internal notes, the last 60 page views, last 40 events, last 20 conversations, and possible duplicates (other non-merged contacts with the same email).

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex contact ID. |

**Example request**

```bash
curl "$HEARTHLY_URL/api/contacts/66f1a2b3c4d5e6f7a8b9c0c1" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{
  "contact": { "id": "66f1a2b3c4d5e6f7a8b9c0c1", "…": "full Contact object" },
  "notes": [ { "id": "66f1a2b3c4d5e6f7a8b9c3a1", "text": "Prefers email over chat.", "author": "Jonas Weber", "at": "2026-10-02T10:00:00.000Z" } ],
  "pages": [ { "url": "https://shop.example.test/pricing", "path": "/pricing", "title": "Pricing", "referrer": "https://news.example.test/", "at": "2026-10-14T09:10:02.000Z", "duration": 42 } ],
  "events": [ { "name": "upgraded", "props": { "plan": "pro" }, "at": "2026-10-10T16:45:00.000Z" } ],
  "conversations": [ { "id": "66f1a2b3c4d5e6f7a8b9c0d1", "status": "open", "contact_id": "66f1a2b3c4d5e6f7a8b9c0c1", "…": "Conversation object without the embedded contact" } ],
  "duplicates": [ { "id": "66f1a2b3c4d5e6f7a8b9c0c9", "name": "", "email": "maya.fischer@example.test", "lastSeenAt": "2026-08-01T12:00:00.000Z" } ]
}
```

**Errors.** `404 Contact not found` (or `Not found` for a malformed ID).

## PATCH /api/contacts/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Edit a contact and add or remove internal notes. Fires `contact.updated`.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex contact ID. |

**Body params** (JSON; all optional)

| Name | Type | Required | Notes |
|---|---|---|---|
| `name` | string | no | Max 100. |
| `email` | string | no | Valid email or `""`, max 200. |
| `phone` | string | no | Max 40. |
| `company` | string | no | Max 100. |
| `tags` | string[] | no | **Replaces** tags. Max 30, each 1–40. |
| `data` | object | no | **Replaces** the whole custom-data object (unlike v1, which merges). |
| `addNote` | string | no | 1–2000 characters; appended as a note authored by the signed-in user. |
| `removeNote` | string | no | 24-hex note ID to delete. |

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/contacts/66f1a2b3c4d5e6f7a8b9c0c1" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "tags": ["vip"], "addNote": "Renewal call booked for November." }'
```

**Example response** — `200 OK` with the Contact object (unwrapped; notes aren't part of it).

**Errors.** `400` validation message; `404 Contact not found`.

## DELETE /api/contacts/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Permanently delete a contact with all its conversations, messages, page views and events.

**Auth.** Dashboard role admin or owner.

**Example request**

```bash
curl -X DELETE "$HEARTHLY_URL/api/contacts/66f1a2b3c4d5e6f7a8b9c0c1" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors.** `403 Only admins can do that.`; `404 Contact not found`.

## POST /api/contacts/{id}/merge

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Fold every other non-merged contact that shares this contact's email into this one: their conversations and page views move over, tags are combined, the earliest first-seen date and session counts are carried over, and the duplicates are marked as merged (their email is cleared and they disappear from lists). Fires `contact.updated` and `visitor.identified`.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex ID of the contact to keep. |

**Body params.** None required; send `{}` (any JSON object is accepted and ignored).

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/contacts/66f1a2b3c4d5e6f7a8b9c0c1/merge" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" -d '{}'
```

**Example response** — `200 OK` with the merged Contact object (unwrapped).

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `This contact has no email to merge on` | The contact has no email. |
| 404 | `Contact not found` | Unknown contact. |

## POST /api/contacts/import

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Bulk-import contacts from CSV. Rows are merged on email: an existing non-merged contact with the same email is updated, otherwise a new contact is created with `source: "import"`. Imports don't fire webhooks.

**Auth.** Dashboard role admin or owner.

**Request body.** Either the raw CSV as the request body (e.g. `Content-Type: text/csv`), or `multipart/form-data` with the CSV in a field named `file`. Max 5 MB; at most 10,000 data rows are read (plus the header).

**CSV format**

- RFC 4180: comma-separated, `"` quoting with `""` escapes, LF or CRLF line endings, optional UTF-8 BOM. Blank lines are skipped.
- The first row is the header. Header names are trimmed and case-insensitive.
- Recognised columns:

| Header | Maps to |
|---|---|
| `email`, `e-mail` | email (must look like `x@y.z`, lower-cased) |
| `name`, `full name` | name |
| `phone` | phone |
| `company` | company |
| `tags` | tags, separated by `;` or `\|` (max 20) |

- Any other header made of `a–z 0–9 _ - space` (1–40 characters) becomes a custom `data` key, with spaces and hyphens turned into `_` (e.g. `Plan Tier` → `plan_tier`). Values are stored as strings. Other headers are ignored.
- Each cell is trimmed and truncated to 500 characters; empty cells are ignored (they don't blank existing values).
- A row is **skipped** if its email is malformed, or it has neither email nor name.
- On update: non-empty name/phone/company overwrite, tags are added, data keys are merged.

```csv
email,name,company,tags,Plan Tier
maya.fischer@example.test,Maya Fischer,Fischer Design,vip;customer,pro
lukas.brandt@example.test,Lukas Brandt,,lead,
,Anonymous Row,,,
not-an-email,Broken Row,,,
```

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/contacts/import" -H "Cookie: $HEARTHLY_SESSION_COOKIE" \
  -F "file=@contacts.csv;type=text/csv"
```

**Example response** — `200 OK`

```json
{ "created": 2, "updated": 1, "skipped": 1 }
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | `No file` | Multipart request without a `file` field. |
| 400 | `CSV must be under 5 MB` | File too large. |
| 400 | `CSV needs a header row and at least one contact` | Fewer than two non-empty rows. |
| 403 | `Only admins can do that.` | Caller is an agent. |

## GET /api/contacts/export

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Download contacts as CSV. Accepts the same filter params as [GET /api/contacts](#get-apicontacts) (`q`, `tag`, `identified`, `segment`, `filters`, `match`); sorting and paging params are ignored — rows are ordered by last seen, newest first, up to 50,000 contacts.

**Auth.** Any member.

**Response.** `200 OK`, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="contacts-YYYY-MM-DD.csv"`, CRLF line endings. Columns:

`email, name, phone, company, tags (;-joined), country, city, browser, os, sessions, first_seen, last_seen` followed by one column per custom `data` key found in the exported contacts (up to 30 keys). Cells beginning with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` to prevent spreadsheet formula injection.

**Example request**

```bash
curl -G "$HEARTHLY_URL/api/contacts/export" -H "Cookie: $HEARTHLY_SESSION_COOKIE" \
  --data-urlencode "tag=vip" -o contacts.csv
```

**Example response**

```csv
email,name,phone,company,tags,country,city,browser,os,sessions,first_seen,last_seen,plan,seats
maya.fischer@example.test,Maya Fischer,'+49 30 5550 1234,Fischer Design,vip;newsletter,DE,Berlin,Firefox,Linux,4,2026-09-30T15:02:11.000Z,2026-10-14T09:13:05.000Z,pro,5
```

**Errors.** `400 Invalid filters` when `filters` (or a saved segment) can't be turned into a query.
