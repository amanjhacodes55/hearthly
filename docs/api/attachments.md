# Attachments

Agents and visitors can attach files to messages. A file is uploaded first and stored in MongoDB GridFS
(bucket `attachments`, no S3 needed). The upload returns an attachment object `{ id, name, size, type }`, which
you then include in a message's `attachments` array. Downloads go through `GET /api/files/{id}`, which checks
that the caller may see the file.

Source: `src/lib/files.ts`, `src/app/api/upload/route.ts`, `src/app/api/widget/upload/route.ts`,
`src/app/api/files/[id]/route.ts`.

## Contents

- [Upload rules (both endpoints)](#upload-rules-both-endpoints)
- [POST /api/upload](#post-apiupload) (dashboard)
- [POST /api/widget/upload](#post-apiwidgetupload) (visitor)
- [GET /api/files/{id}](#get-apifilesid) (download)
- [Sending a file in a message](#sending-a-file-in-a-message)

---

## Upload rules (both endpoints)

- **Format:** `multipart/form-data` with exactly one file in the field named **`file`**. Other fields are ignored.
- **Size:** at most **10 MB** (10 485 760 bytes). Requests with `Content-Length` above 10 MB + 64 KB are rejected
  before the body is read. Empty files are rejected. The 256 KB JSON body limit doesn't apply to uploads.
- **Allowed types**, decided by the file **extension**:

  | MIME type | Extensions | Content check (magic bytes) |
  | --- | --- | --- |
  | `image/png` | `png` | starts with `89 50 4E 47` |
  | `image/jpeg` | `jpg`, `jpeg` | starts with `FF D8 FF` |
  | `image/gif` | `gif` | starts with `GIF8` |
  | `image/webp` | `webp` | `RIFF` … `WEBP` |
  | `application/pdf` | `pdf` | starts with `%PDF-` |
  | `text/plain` | `txt`, `log`, `md` | no NUL byte in the first 4 KB |
  | `text/csv` | `csv` | no NUL byte in the first 4 KB |
  | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `docx` | ZIP header `PK\x03\x04` / `PK\x05\x06` |
  | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `xlsx` | ZIP header |
  | `application/zip`, `application/x-zip-compressed` | `zip` | ZIP header |

  SVG, HTML and executables aren't allowed (script-injection risk).
- **Declared type:** if the browser sends a part `Content-Type` other than `application/octet-stream`, it must
  be one of the MIME types allowed for that extension (any `*zip*` type is accepted for `.zip`).
- **Content sniffing:** the first bytes must match the type implied by the extension (table above). A renamed
  executable therefore can't pass as a PNG.
- **Stored metadata:** the file name is sanitised (characters `\ / : * ? " < > |` and control characters become
  `_`, and only the last 120 characters are kept; an empty result becomes `file`). The stored content type always
  comes from the extension, never from the client. The uploader is recorded as `user:<userId>` or
  `visitor:<contactId>`, together with the website.
- Uploaded files are **not** linked to a conversation until they are sent in a message. Files that are never
  sent stay in GridFS; there's no clean-up job.

Upload validation errors (status `400`, body `{ "error": "…" }`):

| `error` | Cause |
| --- | --- |
| `No file uploaded (field name: file)` | Not multipart, or no `file` field, or `file` is a plain string |
| `File is empty` | 0 bytes |
| `File is larger than 10 MB` | Over the limit |
| `.exe files aren't allowed` | Extension not in the allowlist. The message names the extension; a name without a dot is reported as `.<whole name>`. |
| `File type doesn't match its extension` | Declared MIME type conflicts with the extension |
| `File contents don't match its type` | Magic-byte check failed |

---

## POST /api/upload

> **Internal — may change.** Used by the Hearthly dashboard; authenticated with the session cookie.

**Purpose.** An agent uploads an attachment for a reply or a private note.

**Auth / role.** Session cookie, any member (`agent`, `admin`, `owner`) of the current website. Not rate limited.

**Body.** `multipart/form-data`, field `file` (see [rules](#upload-rules-both-endpoints)).

**Example request**

```bash
curl -s -X POST "$HEARTHLY_URL/api/upload" -H "Cookie: next-auth.session-token=…" -F "file=@screenshot.png"
```

**Example response** `201`

```json
{ "id": "6701a52ac4e5d60012ab34f1", "name": "screenshot.png", "size": 183224, "type": "image/png" }
```

**Errors**

| Status | `error` |
| --- | --- |
| 400 | Any [upload validation error](#upload-rules-both-endpoints) |
| 400 | `Create a website first.` |
| 401 | `Please sign in.` |
| 500 | `Something went wrong` / `Database unavailable — please retry shortly.` |

Send the returned object in `POST /api/conversations/{id}/messages` → `attachments` (up to 5). That endpoint
only accepts files stored for the same website. See [conversations.md](conversations.md).

---

## POST /api/widget/upload

> **Public (widget) — used by widget.js; stable for custom widgets but may gain fields.**

**Purpose.** A visitor uploads an attachment from the widget (file picker, paste or drag & drop).

**Auth.** Visitor token in the `Hearthly-Token` header (see [widget.md](widget.md#widget-http-api-conventions)).
CORS-open.

**Rate limit.** Bucket `upload` per client IP: capacity 10, refill 0.1/s.

**Body.** `multipart/form-data`, field `file`.

**Example request**

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
| 400 | Any [upload validation error](#upload-rules-both-endpoints) |
| 401 | `Invalid visitor token`, `Visitor not found` |
| 403 | `Attachments are disabled` (widget setting `allowAttachments` is `false`) |
| 404 | `Unknown website` |
| 429 | `Too many requests` (`Retry-After` header) |
| 500 | `Something went wrong` / `Database unavailable — please retry shortly.` |

Send the object in `POST /api/widget/messages` → `attachments` (up to 5). That endpoint only accepts files whose
uploader is the same visitor. Otherwise it returns `400 Unknown attachment`.

---

## GET /api/files/{id}

> **Internal — may change.** Used by the Hearthly dashboard (session cookie) and by `widget.js` (visitor token in the query string).

**Purpose.** Streams an attachment's bytes.

**Auth.** Two modes, chosen by whether the `token` query parameter is present:

| Mode | How | Allowed when |
| --- | --- | --- |
| Visitor | `?token=<visitor token>` (query only; the `Hearthly-Token` header is **not** read here) | The token's website owns the file **and** either the visitor uploaded it, or it is attached to a non-note message in one of that visitor's conversations |
| Dashboard | Session cookie, **no** `token` param | The signed-in user is a member of the website that owns the file. That doesn't need to be their current website. |

If `token` is present but invalid, the request is denied. It doesn't fall back to the cookie. Every denial
returns `404 Not found`, so the existence of a file is never revealed. Not rate limited.

**Path params**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | 24-hex attachment id |

**Query params**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | visitor mode | Visitor token |
| `download` | any | no | If present (any value, e.g. `download=1`), the file is sent as `attachment`. Without it, PNG/JPEG/GIF/WebP/PDF are shown `inline` and every other type is always sent as `attachment`. |

**Response headers**

```
Content-Type: <type derived from the extension at upload>
Content-Length: <bytes>
Content-Disposition: inline|attachment; filename="<name>"; filename*=UTF-8''<url-encoded name>
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox
Cache-Control: private, max-age=86400
Access-Control-Allow-Origin: *
```

The locked-down CSP and `sandbox` stop an uploaded PDF or text file from running script in your origin.

**Example requests**

```bash
# visitor (what widget.js uses for <img src> and download links)
curl -s -o invoice.pdf "$HEARTHLY_URL/api/files/6701a45ec4e5d60012ab34e7?token=$TOKEN&download=1"

# dashboard
curl -s -o screenshot.png "$HEARTHLY_URL/api/files/6701a52ac4e5d60012ab34f1" -H "Cookie: next-auth.session-token=…"
```

**Example response** `200`: the raw file bytes with the headers above.

**Errors**

| Status | Body | Cause |
| --- | --- | --- |
| 404 | `{ "error": "Not found" }` | Unknown or malformed id, invalid token, not your file, or not signed in |
| 500 | — | Database or GridFS error. This route has no error wrapper, so it's Next.js's default error response. |

---

## Sending a file in a message

```bash
# 1. upload (visitor)
ATT=$(curl -s -X POST "$HEARTHLY_URL/api/widget/upload" -H "Hearthly-Token: $TOKEN" -F "file=@invoice.pdf")
# 2. send it
curl -s -X POST "$HEARTHLY_URL/api/widget/messages" -H "Hearthly-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"text\":\"Here is the invoice\",\"attachments\":[$ATT]}"
```

Both the visitor and agents then see the attachment in the message's `attachments` array and can download it
via `GET /api/files/{id}`.
