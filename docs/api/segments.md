# Segments

A segment is a saved, named set of conditions over your contacts — "visitors from Germany seen in the last 7 days", "customers on the pro plan who haven't signed up for the webinar". Segments are evaluated live every time they're used, so membership is always current. They power the contact list filter, the inbox segment filter and campaign audiences. Segments are only available through the internal dashboard API; there is no REST v1 endpoint for them yet.

See [Authentication](README.md#authentication) and [Errors](README.md#errors).

**Contents**

- [The Segment object](#the-segment-object)
- [Filter conditions](#filter-conditions)
- [Where segments are used](#where-segments-are-used)
- [GET /api/segments](#get-apisegments)
- [POST /api/segments](#post-apisegments)
- [GET /api/segments/{id}](#get-apisegmentsid)
- [PATCH /api/segments/{id}](#patch-apisegmentsid)
- [DELETE /api/segments/{id}](#delete-apisegmentsid)

---

## The Segment object

Segments are returned as stored (no special serializer): the database `_id` becomes `id`; the internal `website` and `__v` fields are removed.

| Field | Type | Notes |
|---|---|---|
| `id` | string | 24-hex ObjectId. |
| `name` | string | 1–80 characters. |
| `match` | string | `all` (every filter must match — AND) or `any` (at least one — OR). |
| `filters` | object[] | Up to 20 [filter conditions](#filter-conditions). An empty list matches every contact. |
| `createdAt` | string | ISO 8601. |
| `updatedAt` | string | ISO 8601. |

```json
{
  "id": "66f2b0c1d2e3f4a5b6c7d801",
  "name": "Active German pro customers",
  "match": "all",
  "filters": [
    { "field": "country", "op": "eq", "value": "DE", "key": "" },
    { "field": "last_seen", "op": "within_days", "value": "7", "key": "" },
    { "field": "data", "op": "eq", "value": "pro", "key": "plan" }
  ],
  "createdAt": "2026-10-01T08:30:00.000Z",
  "updatedAt": "2026-10-01T08:30:00.000Z"
}
```

## Filter conditions

Each filter is an object:

| Name | Type | Required | Notes |
|---|---|---|---|
| `field` | string | yes | One of the fields below. |
| `op` | string | yes | Operator, max 20 characters; must be valid for the field's type (see below). |
| `value` | string | no | Max 200 characters, default `""`. Always a **string**, even for numbers and day counts (e.g. `"3"`). |
| `key` | string | no | Only for `field: "data"`: the custom-data key, max 60 characters, `^[A-Za-z0-9_-]*$`. Default `""`. |

### Fields

| `field` | Label in the UI | Type | Contact attribute |
|---|---|---|---|
| `email` | Email | string | `email` |
| `name` | Name | string | `name` |
| `phone` | Phone | string | `phone` |
| `country` | Country code | string | `geo.country` (ISO code, e.g. `DE`) |
| `city` | City | string | `geo.city` |
| `locale` | Language | string | `geo.locale` (e.g. `de-DE`) |
| `browser` | Browser | string | `device.browser` |
| `os` | OS | string | `device.os` |
| `device` | Device type | string | `device.type` (`desktop`, `mobile`, `tablet`, `bot`) |
| `utm_source` | UTM source | string | `utm.source` |
| `utm_campaign` | UTM campaign | string | `utm.campaign` |
| `referrer` | Referrer | string | `referrer` |
| `tag` | Tag | tag | `tags` |
| `event` | Performed event | event | names of tracked events |
| `sessions` | Sessions | number | `sessions` |
| `last_seen` | Last seen | date | `last_seen_at` |
| `first_seen` | First seen | date | `first_seen_at` |
| `data` | Custom data | data | `data.<key>` — requires `key` |

### Operators by type

| Type | Operators |
|---|---|
| string | `eq`, `neq`, `contains`, `not_contains`, `starts_with`, `exists`, `not_exists` |
| tag | `has`, `not_has` |
| event | `has`, `not_has` |
| number | `eq`, `gt`, `lt` |
| date | `within_days`, `older_than_days` |
| data | `eq`, `neq`, `contains`, `exists`, `not_exists`, `gt`, `lt` |

### Operator semantics

| `op` | Meaning |
|---|---|
| `eq` | Exact, **case-sensitive** equality with `value`. For `number` fields `value` is converted to a number. For `data`, a numeric-looking `value` matches either the string or the number (`"5"` matches `5` and `"5"`). |
| `neq` | Not equal to `value` (string comparison; also matches contacts where the attribute is missing). |
| `contains` | Case-insensitive substring match. |
| `not_contains` | Case-insensitive: does not contain `value`. |
| `starts_with` | Case-insensitive prefix match. |
| `exists` | Attribute is set and not empty (`""`/`null` count as empty). `value` is ignored. |
| `not_exists` | Attribute is missing, `""` or `null`. `value` is ignored. |
| `gt` / `lt` | Greater / less than `Number(value)` (strict). For `data`, only matches values stored as numbers. |
| `has` / `not_has` | Contact has / doesn't have the tag or performed event named `value` (exact). |
| `within_days` | Date is within the last `value` days (`>= now − value × 24h`). |
| `older_than_days` | Date is more than `value` days ago. |

Filters are combined with AND when `match` is `all` and with OR when it is `any`. Merged contacts are excluded wherever segments are evaluated against the contact list or campaign audience.

### Validation caveat

When a segment is **saved**, Hearthly checks the field name, lengths and the 20-filter limit, but it does **not** check that `op` is valid for the field, that `value` is numeric for number/date operators, or that a `data` filter has a `key`. An invalid combination is only detected when the segment is used:

- Contacts list / export: `400` with a message such as `Operator gt not valid for country` or `Custom data filters need a key`.
- Inbox list (`GET /api/conversations?segment=…`) and campaign send/preview: `500 Something went wrong`.

Validate your filters against the tables above before saving.

## Where segments are used

| Where | How |
|---|---|
| Contacts list | `GET /api/contacts?segment=<id>` (and `GET /api/contacts/export?segment=<id>`). The same condition language can be used ad hoc, without saving, via `?filters=<JSON array>&match=all|any`. See [contacts](contacts.md#get-apicontacts). |
| Inbox | `GET /api/conversations?segment=<id>` returns conversations whose contact is in the segment (up to 5,000 matching contacts are considered). See [conversations](conversations.md#get-apiconversations). |
| Campaigns | A campaign's `segment` field (24-hex ID or `null` for all contacts) defines its audience. `GET /api/campaigns/{id}/send` previews the recipient count (`{ total, withEmail, smtp }`); `POST /api/campaigns/{id}/send` messages up to 5,000 matching contacts. |

An unknown or deleted segment ID is silently ignored by the contacts list and inbox (no segment filter is applied), and a campaign whose segment was deleted targets all contacts.

---

## GET /api/segments

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** List the website's segments, sorted by name (max 500).

**Auth.** Any member (agent, admin or owner).

**Path params.** None. **Query params.** None. **Body params.** None.

**Example request**

```bash
curl "$HEARTHLY_URL/api/segments" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK` (a bare array)

```json
[
  {
    "id": "66f2b0c1d2e3f4a5b6c7d801",
    "name": "Active German pro customers",
    "match": "all",
    "filters": [
      { "field": "country", "op": "eq", "value": "DE", "key": "" },
      { "field": "last_seen", "op": "within_days", "value": "7", "key": "" },
      { "field": "data", "op": "eq", "value": "pro", "key": "plan" }
    ],
    "createdAt": "2026-10-01T08:30:00.000Z",
    "updatedAt": "2026-10-01T08:30:00.000Z"
  }
]
```

**Errors**

| Status | Message | When |
|---|---|---|
| 401 | `Please sign in.` | No session. |
| 400 | `Create a website first.` | No current website. |

## POST /api/segments

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Create a segment.

**Auth.** Any member.

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | 1–80 characters after trimming. |
| `match` | string | no | `all` (default) or `any`. |
| `filters` | object[] | yes | 0–20 [filter conditions](#filter-conditions). |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/segments" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{
    "name": "Webinar no-shows",
    "match": "all",
    "filters": [
      { "field": "tag", "op": "has", "value": "webinar-registered" },
      { "field": "event", "op": "not_has", "value": "webinar_joined" },
      { "field": "email", "op": "exists" }
    ]
  }'
```

**Example response** — `201 Created`

```json
{
  "id": "66f2b0c1d2e3f4a5b6c7d802",
  "name": "Webinar no-shows",
  "match": "all",
  "filters": [
    { "field": "tag", "op": "has", "value": "webinar-registered", "key": "" },
    { "field": "event", "op": "not_has", "value": "webinar_joined", "key": "" },
    { "field": "email", "op": "exists", "value": "", "key": "" }
  ],
  "createdAt": "2026-10-14T13:00:00.000Z",
  "updatedAt": "2026-10-14T13:00:00.000Z"
}
```

**Errors**

| Status | Message | When |
|---|---|---|
| 400 | e.g. `name: String must contain at least 1 character(s)`, `filters: Required`, `filters.0.field: Invalid enum value…` | Validation failed. |
| 400 | `Invalid JSON body` | Malformed JSON. |
| 413 | `Request body too large` | Body over 256 KB. |

## GET /api/segments/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Fetch one segment.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex segment ID. |

**Example request**

```bash
curl "$HEARTHLY_URL/api/segments/66f2b0c1d2e3f4a5b6c7d801" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`: the Segment object.

**Errors.** `404 Not found`.

## PATCH /api/segments/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Update a segment. All fields are optional; `filters`, when given, replaces the whole list.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex segment ID. |

**Body params** (JSON)

| Name | Type | Required | Notes |
|---|---|---|---|
| `name` | string | no | 1–80 characters. |
| `match` | string | no | `all` or `any`. |
| `filters` | object[] | no | 0–20 filter conditions. |

**Example request**

```bash
curl -X PATCH "$HEARTHLY_URL/api/segments/66f2b0c1d2e3f4a5b6c7d801" -H "Cookie: $HEARTHLY_SESSION_COOKIE" -H "Content-Type: application/json" \
  -d '{ "match": "any" }'
```

**Example response** — `200 OK`: the updated Segment object.

**Errors.** `400` validation message; `404 Not found`.

## DELETE /api/segments/{id}

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** Delete a segment. Campaigns that referenced it keep the dangling ID and will target all contacts.

**Auth.** Any member.

**Path params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | 24-hex segment ID. |

**Example request**

```bash
curl -X DELETE "$HEARTHLY_URL/api/segments/66f2b0c1d2e3f4a5b6c7d801" -H "Cookie: $HEARTHLY_SESSION_COOKIE"
```

**Example response** — `200 OK`

```json
{ "ok": true }
```

**Errors.** `404 Not found`.
