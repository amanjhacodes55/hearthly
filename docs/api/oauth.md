# OAuth 2.0

Hearthly is an OAuth 2.0 authorization server. Third-party apps can be installed on any Hearthly website (workspace) and then call [REST API v1](README.md#authentication) on its behalf. Hearthly supports the **authorization code** grant, with **PKCE** ([RFC 7636](https://www.rfc-editor.org/rfc/rfc7636)), and **refresh tokens** with rotation and token revocation ([RFC 7009](https://www.rfc-editor.org/rfc/rfc7009)).

Use OAuth when **other teams** will install your integration. To call the API from your own backend, an [API key](api-keys.md) is simpler.

## Contents

- [Overview of the flow](#overview-of-the-flow)
- [1. Register an app](#1-register-an-app)
- [2. Send the user to the authorize URL](#2-send-the-user-to-the-authorize-url) ([GET /oauth/authorize](#get-oauthauthorize))
- [3. Consent screen](#3-consent-screen) ([POST /api/oauth/authorize](#post-apioauthauthorize), internal)
- [4. Handle the redirect](#4-handle-the-redirect)
- [5. Exchange the code for tokens](#5-exchange-the-code-for-tokens) ([POST /api/oauth/token](#post-apioauthtoken))
- [6. Call the API](#6-call-the-api)
- [7. Refresh the access token](#7-refresh-the-access-token)
- [8. Revoke tokens](#8-revoke-tokens) ([POST /api/oauth/revoke](#post-apioauthrevoke))
- [Scopes](#scopes)
- [Tokens, prefixes and lifetimes](#tokens-prefixes-and-lifetimes)
- [Installations and uninstalling](#installations-and-uninstalling)
- [Error reference](#error-reference)
- [Node.js example](#nodejs-example)

---

## Overview of the flow

```mermaid
sequenceDiagram
    autonumber
    actor U as User (admin/owner)
    participant App as Your app (client)
    participant B as Browser
    participant H as Hearthly
    participant API as Hearthly REST API v1

    App->>App: Generate state + PKCE code_verifier,<br/>code_challenge = BASE64URL(SHA256(verifier))
    App->>B: 302 to HOST/oauth/authorize?response_type=code&client_id&redirect_uri&scope&state&code_challenge&code_challenge_method=S256
    B->>H: GET /oauth/authorize
    alt not signed in
        H->>B: 302 /login?next=/oauth/authorize?...
        U->>H: Sign in
    end
    H->>H: Validate client_id + exact redirect_uri, scopes, PKCE method
    H->>B: Consent screen (pick website, list scopes)
    U->>H: Authorize (POST /api/oauth/authorize, session cookie)
    H->>H: Create/update Installation, issue one-time code (10 min)
    H->>B: { redirect } → redirect_uri?state=…&code=hly_code_…
    B->>App: GET redirect_uri?state=…&code=…
    App->>App: Check state
    App->>H: POST /api/oauth/token<br/>grant_type=authorization_code, code, redirect_uri, client_id, client_secret and/or code_verifier
    H->>App: { access_token: hly_at_…, refresh_token: hly_rt_…, expires_in: 3600, scope, website_id }
    App->>API: GET /api/v1/... with Authorization: Bearer hly_at_…
    API->>App: 200 data
    Note over App,H: When the access token expires (1 h)
    App->>H: POST /api/oauth/token grant_type=refresh_token
    H->>App: New access + refresh token (old pair revoked)
```

---

## 1. Register an app

Open **Developers** (`/developers` in the dashboard) and click **New OAuth app**. Any signed-in user can register up to **20** apps. Apps belong to the developer's user account, not to a website. The [Apps API](apps.md) documents the endpoints behind this page.

| Field | Rules |
|---|---|
| Name | 1–60 characters. Shown on the consent screen. |
| Description | At most 300 characters. Shown on the consent screen. |
| Homepage | URL (at most 300 characters) or empty. |
| Logo | URL (at most 500 characters) or empty. Shown on the consent screen. Settable through the API only. |
| Redirect URIs | 1–10 absolute URLs, each at most 500 characters. Each must be `https://…`. `http://` is accepted only for `localhost` or `127.0.0.1` (with an optional port), for example `http://localhost:4000/callback`. At authorize and token time `redirect_uri` must **exactly match** one of them. |
| Scopes | At least 1 of the [scopes](#scopes). This is the **maximum** your app can request. |

After you create the app you get:

- **Client ID**: `hly_app_` followed by 16 characters, for example `hly_app_hkygbqnzb85h6hig`. It is public.
- **Client secret**: `hly_cs_` followed by 43 characters. It is **shown once**. Hearthly stores only its SHA-256 hash. You can rotate it from the app page, and the old secret stops working immediately.

Every app has a client secret. If your app can keep the secret confidential (a server), send it at the token endpoint. If it can't (a SPA, mobile or desktop app, or CLI), leave the secret out and use **PKCE**. Hearthly then treats the request as a public client. See [client authentication](#client-authentication).

---

## 2. Send the user to the authorize URL

## GET /oauth/authorize

> **Public · stable.** The OAuth authorization endpoint. This is a browser page, not a JSON API.

**Purpose:** Starts the flow. Redirect the user's browser here. Hearthly signs the user in if needed, validates the request and shows the consent screen.

**Auth:** Browser session. A user who isn't signed in is redirected to `/login?next=<this URL>` and returned here afterwards.

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `client_id` | string | yes | Your app's `hly_app_…` client ID. |
| `redirect_uri` | string | yes | Must exactly match a registered redirect URI. Existing query parameters on it are kept. |
| `response_type` | string | recommended | Must be `code` if present. Any other value redirects with `error=unsupported_response_type`. If you leave it out, `code` is assumed. |
| `scope` | string | no | Scopes separated by spaces, commas or `+`. Every scope must be one the app registered, otherwise the request redirects with `error=invalid_scope`. **If you leave it out, every scope registered on the app is requested.** Duplicates are removed. |
| `state` | string | recommended | Opaque value, at most 500 characters, returned unchanged on the redirect. Use it for CSRF protection and to match the callback to the PKCE verifier. |
| `code_challenge` | string | required for public clients | PKCE challenge, 43–128 characters from `[A-Za-z0-9-._~]`. |
| `code_challenge_method` | string | no | `S256` (recommended) or `plain`. If `code_challenge` is present and this is left out, it defaults to **`plain`**. Any other value redirects with `error=invalid_request`. |

**Validation and error handling**

| Problem | Result |
|---|---|
| Unknown `client_id` | Hearthly shows an error page ("Unknown client_id.") and does **not** redirect. |
| `redirect_uri` missing or not registered | Error page ("redirect_uri is not registered for this app."). No redirect, which protects against open redirects. |
| `response_type` present and not `code` | Redirects to `redirect_uri?state=…&error=unsupported_response_type`. |
| Requested scope not registered on the app | Redirects with `error=invalid_scope`. |
| `code_challenge_method` not `S256`/`plain` | Redirects with `error=invalid_request`. |

**Example**

```
https://YOUR-HOST/oauth/authorize?response_type=code
  &client_id=hly_app_hkygbqnzb85h6hig
  &redirect_uri=https%3A%2F%2Fapp.example.test%2Foauth%2Fcallback
  &scope=conversations%3Aread%20messages%3Awrite%20website%3Aread
  &state=GQbeT8mZo22z9atUQIlVEw
  &code_challenge=To1-S6H5dCWgHbMproVieBGa1AXj241_DpqgZBNh5Cs
  &code_challenge_method=S256
```

Generating PKCE values (Node.js):

```js
import crypto from "node:crypto";
const verifier = crypto.randomBytes(32).toString("base64url");                          // 43 chars
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");    // S256
const state = crypto.randomBytes(16).toString("base64url");
```

---

## 3. Consent screen

The consent screen shows:

- your app's name, logo and description
- the scopes being requested
- a **website picker** listing every website where the signed-in user is an **owner or admin**

Members with the `agent` role can't install apps. A user who isn't an owner or admin of any website sees a notice, and **Authorize** is disabled. Clicking **Authorize** or **Cancel** calls the endpoint below, and the browser then goes to the returned `redirect` URL.

## POST /api/oauth/authorize

> **Internal. May change.** Used by the Hearthly consent screen. Authenticated with the session cookie. Integrations should never call it directly. Send users to [GET /oauth/authorize](#get-oauthauthorize) instead.

**Purpose:** Records the user's decision. On `allow` it creates the [installation](#installations-and-uninstalling), or adds scopes to an existing one, issues a one-time authorization code, and returns the URL to redirect to.

**Auth:** Session cookie. The user must be an owner or admin of the chosen `website_id`. The user also needs a current website, as with every dashboard endpoint.

**Body** (`application/json`)

| Name | Type | Required | Notes |
|---|---|---|---|
| `client_id` | string | yes | At most 100 characters. |
| `redirect_uri` | string | yes | At most 500 characters. Must be registered. |
| `scope` | string | no | At most 500 characters. Default `""`, which means all of the app's scopes. |
| `state` | string | no | At most 500 characters. Default `""`. |
| `code_challenge` | string | no | At most 128 characters. If set, it must match `^[A-Za-z0-9\-._~]{43,128}$`. |
| `code_challenge_method` | string | no | `S256`, `plain` or `""`. Default `""`. Stored as `plain` when a challenge is present and no method is given. |
| `website_id` | string | yes | 24-hex id of the website to install on. Required even for `deny`. |
| `decision` | string | yes | `allow` or `deny`. |

**Example request**

```bash
curl -X POST "$HEARTHLY_URL/api/oauth/authorize" \
  -H "Cookie: $HEARTHLY_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "hly_app_hkygbqnzb85h6hig",
    "redirect_uri": "https://app.example.test/oauth/callback",
    "scope": "conversations:read messages:write website:read",
    "state": "GQbeT8mZo22z9atUQIlVEw",
    "code_challenge": "To1-S6H5dCWgHbMproVieBGa1AXj241_DpqgZBNh5Cs",
    "code_challenge_method": "S256",
    "website_id": "3553592859d1362a59419b18",
    "decision": "allow"
  }'
```

**Example response** `200 OK`

```json
{ "redirect": "https://app.example.test/oauth/callback?state=GQbeT8mZo22z9atUQIlVEw&code=hly_code_dsEWI7XoblkWpFyzWFTRMbSPsGHpT1p1" }
```

On `deny`: `{ "redirect": "https://app.example.test/oauth/callback?state=GQbeT8mZo22z9atUQIlVEw&error=access_denied" }`. If a scope is not allowed: `…&error=invalid_scope`.

**Errors** (format: `{ "error": "message" }`)

| Status | Message | When |
|---|---|---|
| 400 | `Unknown client_id` | No app with that client ID. |
| 400 | `redirect_uri is not registered for this app` | Redirect URI not registered. |
| 400 | `Invalid code_challenge` | Challenge doesn't match the PKCE character set or length. |
| 400 | `website_id: Invalid`, `decision: Invalid enum value…`, … | Body validation failed. |
| 400 | `Create a website first.` | The user has no website. |
| 401 | `Please sign in.` | No session. |
| 403 | `You must be an owner or admin of that website to install apps` | Wrong role, or not a member of `website_id`. |

---

## 4. Handle the redirect

The browser lands on your `redirect_uri` with one of these query strings.

**Success**

```
https://app.example.test/oauth/callback?state=GQbeT8mZo22z9atUQIlVEw&code=hly_code_dsEWI7XoblkWpFyzWFTRMbSPsGHpT1p1
```

**Error**

```
https://app.example.test/oauth/callback?state=GQbeT8mZo22z9atUQIlVEw&error=access_denied
```

| `error` | Meaning |
|---|---|
| `access_denied` | The user clicked **Cancel**. |
| `invalid_scope` | A requested scope isn't registered on the app. |
| `unsupported_response_type` | `response_type` was not `code`. |
| `invalid_request` | `code_challenge_method` was not `S256` or `plain`. |

Hearthly doesn't send `error_description` on redirects.

**Always check `state`** against the value you stored before using the code.

The code:

- is **single-use**
- expires after **10 minutes**
- is bound to your `client_id`, the exact `redirect_uri`, the granted scopes, the chosen website, and the PKCE challenge if you sent one

---

## 5. Exchange the code for tokens

## POST /api/oauth/token

> **Public · stable.** The OAuth token endpoint.

**Purpose:** Exchanges an authorization code for an access token and a refresh token (`grant_type=authorization_code`), or rotates a refresh token (`grant_type=refresh_token`, see [step 7](#7-refresh-the-access-token)).

**Content types:** `application/x-www-form-urlencoded`, the standard and recommended choice, or `application/json`. Hearthly treats the body as JSON whenever `Content-Type` contains `json`, and as form data otherwise. Only the first 10,000 characters of the body are read.

**Rate limit:** 30 requests burst, refilling at 1 request every 2 seconds, **per client IP**. Over the limit the endpoint returns `429 {"error":"slow_down"}`.

### Client authentication

Send credentials either way:

- **HTTP Basic:** `Authorization: Basic base64(urlencode(client_id) + ":" + urlencode(client_secret))`. When this header is present, it **overrides** any `client_id`/`client_secret` in the body.
- **Body:** `client_id` plus `client_secret`.

| Client type | What to send | Requirements |
|---|---|---|
| Confidential (server) | `client_id` + `client_secret` | PKCE is optional. If you sent a `code_challenge` at authorize time, you **must** also send the matching `code_verifier`. |
| Public (no secret) | `client_id` only | The code **must** have been issued with a `code_challenge`, and you must send `code_verifier`. Otherwise you get `invalid_client`. |

If you send a `client_secret`, it must be correct. A wrong secret returns `invalid_client` even when PKCE would have succeeded.

### Body params: `grant_type=authorization_code`

| Name | Type | Required | Notes |
|---|---|---|---|
| `grant_type` | string | yes | `authorization_code` |
| `code` | string | yes | The `hly_code_…` value from the redirect. |
| `redirect_uri` | string | yes | Must be identical to the one used at authorize time. If you leave it out you get `invalid_request`. |
| `client_id` | string | yes* | *Unless you use HTTP Basic. |
| `client_secret` | string | conditional | Confidential clients. |
| `code_verifier` | string | conditional | Required if the code was issued with a `code_challenge`. 43–128 characters from `[A-Za-z0-9-._~]`. |

**Example request** (confidential client with PKCE)

```bash
curl -X POST "$HEARTHLY_URL/api/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d grant_type=authorization_code \
  -d code=hly_code_dsEWI7XoblkWpFyzWFTRMbSPsGHpT1p1 \
  --data-urlencode redirect_uri=https://app.example.test/oauth/callback \
  -d client_id=hly_app_hkygbqnzb85h6hig \
  -d client_secret=hly_cs_kYJVvPO3cl_7A2IhLfxoEjlAnJvAZzAiQXGpMLGuOS8 \
  -d code_verifier=cemLqHVnrWytY4vuCn21A7zL6A5xeAy7gm6D6bh9Jxs
```

The same request using HTTP Basic:

```bash
curl -X POST "$HEARTHLY_URL/api/oauth/token" \
  -u "hly_app_hkygbqnzb85h6hig:hly_cs_kYJVvPO3cl_7A2IhLfxoEjlAnJvAZzAiQXGpMLGuOS8" \
  -d grant_type=authorization_code \
  -d code=hly_code_dsEWI7XoblkWpFyzWFTRMbSPsGHpT1p1 \
  --data-urlencode redirect_uri=https://app.example.test/oauth/callback \
  -d code_verifier=cemLqHVnrWytY4vuCn21A7zL6A5xeAy7gm6D6bh9Jxs
```

**Example response** `200 OK` (with `Cache-Control: no-store`)

```json
{
  "access_token": "hly_at_hUPf11LwruYxVlYScE1QiA-06inLUVALnbdCnwmd_pQ",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "hly_rt_Ry-5uZGOyRYY341A1TaRE-fjNUbIVUXPvUPLdlBGtL8",
  "scope": "conversations:read messages:write website:read",
  "website_id": "3553592859d1362a59419b18"
}
```

| Field | Notes |
|---|---|
| `access_token` | `hly_at_…`, valid for `expires_in` seconds (3600 = 1 hour). |
| `token_type` | Always `Bearer`. |
| `expires_in` | Seconds. Always `3600`. |
| `refresh_token` | `hly_rt_…`, valid for 90 days. |
| `scope` | Space-separated scopes granted in this authorization. |
| `website_id` | The website the user installed your app on. Every API call with this token acts on that website. Hearthly-specific. |

**Errors:** see [Error reference](#error-reference).

---

## 6. Call the API

Send the access token as a bearer token to any [REST API v1](README.md#authentication) endpoint:

```bash
curl "$HEARTHLY_URL/api/v1/conversations?status=open&limit=1" \
  -H "Authorization: Bearer hly_at_hUPf11LwruYxVlYScE1QiA-06inLUVALnbdCnwmd_pQ"
```

- Every request is limited to the token's `scope`. A missing scope returns `403 { "error": { "code": "insufficient_scope", … } }`.
- Expired, revoked or uninstalled tokens return `401 { "error": { "code": "unauthorized", "message": "Invalid, expired or revoked token" } }` with `WWW-Authenticate: Bearer error="invalid_token"`. When you get this, refresh the token and retry once.
- The rate limit is 120 requests burst and 2 req/s sustained **per token**. See [Rate limits](README.md#rate-limits).
- Messages your app sends get `via` set to your app name, and their author id is `app:<app id>`. Webhooks your app creates show `created_via: "app:<app name>"`.

---

## 7. Refresh the access token

Call [POST /api/oauth/token](#post-apioauthtoken) with `grant_type=refresh_token`.

### Body params: `grant_type=refresh_token`

| Name | Type | Required | Notes |
|---|---|---|---|
| `grant_type` | string | yes | `refresh_token` |
| `refresh_token` | string | yes | The current `hly_rt_…`. It must have been issued to this `client_id`. |
| `client_id` | string | yes* | *Unless you use HTTP Basic. |
| `client_secret` | string | recommended | Confidential clients should send it. If it is sent, it is verified. |

`scope` is **not** accepted. The new tokens carry exactly the scopes of the token being refreshed. To get more scopes, run the authorization flow again.

```bash
curl -X POST "$HEARTHLY_URL/api/oauth/token" \
  -u "hly_app_hkygbqnzb85h6hig:hly_cs_kYJVvPO3cl_7A2IhLfxoEjlAnJvAZzAiQXGpMLGuOS8" \
  -d grant_type=refresh_token \
  -d refresh_token=hly_rt_Ry-5uZGOyRYY341A1TaRE-fjNUbIVUXPvUPLdlBGtL8
```

```json
{
  "access_token": "hly_at_8yJmKhjXasHO7U4uFn_ss5Ar5ChjAsqQzDYNwoYjOJI",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "hly_rt_ZQfAe1R1LDHMt86Qnw42sV6ZkoMD2rEQBtp_FYthMaI",
  "scope": "conversations:read messages:write website:read",
  "website_id": "3553592859d1362a59419b18"
}
```

**Refresh tokens rotate.** A successful refresh does three things:

- It revokes the old refresh token **and the access token issued with it**. Your old access token stops working at once, even if it hadn't expired.
- It returns a new access token (1 hour) and a new refresh token, valid for **90 days from now**. As long as you refresh at least once every 90 days, the installation keeps working.
- Using an old refresh token again returns `invalid_grant`.

Store the new refresh token atomically. If two workers refresh at the same time, only one succeeds.

---

## 8. Revoke tokens

## POST /api/oauth/revoke

> **Public · stable.** The token revocation endpoint (RFC 7009).

**Purpose:** Revokes an access token or refresh token that was issued to your app. Access and refresh tokens are issued as a **pair**, and revoking either one revokes both. Revocation does **not** uninstall the app. The installation and any other token pairs stay valid. To remove the app, the website admin has to [uninstall it](#installations-and-uninstalling).

**Content types:** form-encoded or JSON, as for the token endpoint.

**Client authentication:** Use HTTP Basic or `client_id` in the body. A `client_secret` is optional, but if you send one it must be correct.

**Body params**

| Name | Type | Required | Notes |
|---|---|---|---|
| `token` | string | yes | An `hly_at_…` or `hly_rt_…` issued to this client. |
| `client_id` | string | yes* | *Unless you use HTTP Basic. |
| `client_secret` | string | no | Verified if present. |
| `token_type_hint` | string | no | Accepted and ignored. Both token types are checked. |

**Example request**

```bash
curl -i -X POST "$HEARTHLY_URL/api/oauth/revoke" \
  -u "hly_app_hkygbqnzb85h6hig:hly_cs_kYJVvPO3cl_7A2IhLfxoEjlAnJvAZzAiQXGpMLGuOS8" \
  -d token=hly_rt_ZQfAe1R1LDHMt86Qnw42sV6ZkoMD2rEQBtp_FYthMaI
```

**Example response:** `200 OK` with an empty body. The response is the same for unknown, already-revoked or foreign tokens, so it doesn't reveal whether a token exists.

**Errors**

| Status | Body | When |
|---|---|---|
| 401 | `{"error":"invalid_client"}` | Missing or unknown `client_id`, or wrong `client_secret`. |

---

## Scopes

Scopes come from `OAUTH_SCOPES` in `src/lib/oauth.ts`. API keys use the same scope names.

| Scope | Grants |
|---|---|
| `conversations:read` | Read conversations and messages |
| `conversations:write` | Update conversations (assign, resolve, tag) |
| `messages:write` | Send messages as an operator or bot, and post inbound visitor messages |
| `contacts:read` | Read contacts and their activity |
| `contacts:write` | Create and update contacts |
| `webhooks:manage` | Create and delete webhooks |
| `website:read` | Read basic website information |

You can request only scopes registered on your app. If a developer later removes a scope from the app, tokens that were already issued **keep** their scopes until they are revoked.

## Tokens, prefixes and lifetimes

| Credential | Format | Lifetime | Storage on Hearthly |
|---|---|---|---|
| Client ID | `hly_app_` + 16 chars (`[2-9a-km-z]`) | Until the app is deleted | Plain |
| Client secret | `hly_cs_` + 43 base64url chars | Until rotated | SHA-256 hash only (shown once) |
| Authorization code | `hly_code_` + 32 base64url chars | **10 minutes**, single use | SHA-256 hash |
| Access token | `hly_at_` + 43 base64url chars | **1 hour** (`expires_in: 3600`) | SHA-256 hash |
| Refresh token | `hly_rt_` + 43 base64url chars | **90 days**, rotated on every use | SHA-256 hash |

Treat every token as opaque. Its length may change.

Tokens are also invalidated before their expiry if any of these happens:

- the pair is refreshed (rotation) or revoked
- the installation is uninstalled
- the developer deletes the app

## Installations and uninstalling

- An **installation** links one app to one website. The first time an admin authorizes your app on a website, Hearthly creates the installation. Authorizing again on the same website reuses it and **adds** any new scopes to it. Each authorization issues a **new, independent** token pair with the scopes requested in that authorization. Earlier pairs keep working until they expire or are revoked.
- Each successful API call with an access token updates the installation's **last used** time, which website admins see under **Settings → Installed apps**.
- **Uninstalling.** A website admin or owner can click **Uninstall** in **Settings → Installed apps** (see [DELETE /api/installations/{id}](apps.md#delete-apiinstallationsid)). This:
  - revokes **every** access and refresh token of that installation
  - **deletes the webhooks your app created** on that website
  - makes later refresh attempts fail with `invalid_grant` ("Installation was revoked")
- **Deleting the app.** When the developer [deletes the app](apps.md#delete-apidevappsid), every installation on every website is revoked, all tokens are revoked, and the webhooks created by those installations are deleted.
- When an admin installs your app again after an uninstall, Hearthly creates a new installation.

## Error reference

Token and revoke endpoint errors follow RFC 6749 §5.2: `{ "error": "<code>", "error_description"?: "<text>" }` with `Cache-Control: no-store`.

| Status | `error` | When |
|---|---|---|
| 400 | `invalid_request` | `grant_type=authorization_code` without `redirect_uri`. |
| 400 | `invalid_grant` | Code unknown, already used, expired (older than 10 min), issued to another client, or `redirect_uri` mismatch. Also a PKCE `code_verifier` that is missing, malformed or wrong. Also a refresh token that is unknown, already rotated or revoked, expired, or issued to another client. |
| 400 | `invalid_grant` + `error_description: "Installation was revoked"` | The app was uninstalled from the website. |
| 400 | `unsupported_grant_type` | `grant_type` is not `authorization_code` or `refresh_token`. |
| 401 | `invalid_client` + `error_description: "Unknown client or bad client_secret"` | Missing or unknown `client_id`, or wrong `client_secret`. |
| 401 | `invalid_client` | Public client (no secret) exchanging a code that was issued **without** a `code_challenge`. |
| 429 | `slow_down` | Token endpoint rate limit (per IP) exceeded. |
| 500 | `server_error` | Unexpected error. |

Errors in the authorization step are returned on the redirect (`access_denied`, `invalid_scope`, `unsupported_response_type`, `invalid_request`). Two cases are shown as an error page instead: an unknown `client_id` and an unregistered `redirect_uri`. See [step 2](#2-send-the-user-to-the-authorize-url).

## Node.js example

[`examples/oauth-node`](../../examples/oauth-node) is a complete, dependency-free integration (Node 18+) that:

1. redirects to `/oauth/authorize` with `state` and an S256 PKCE challenge
2. checks `state` on `/callback` and exchanges the code (form-encoded, with `code_verifier`, plus `client_secret` if set)
3. calls `GET /api/v1/website` and `GET /api/v1/conversations`, then posts a bot message with `POST /api/v1/conversations/{id}/messages`

To run it, first register an app in **Developers** with the redirect URI `http://localhost:4000/callback` and the scopes `conversations:read`, `messages:write` and `website:read`. Then start the example:

```bash
HEARTHLY_URL=http://localhost:3005 CLIENT_ID=hly_app_xxx CLIENT_SECRET=hly_cs_xxx node examples/oauth-node/index.mjs
# open http://localhost:4000
```

Leave out `CLIENT_SECRET` to act as a public client. PKCE alone is then required, and it is accepted.

The core of the token exchange:

```js
const body = new URLSearchParams({
  grant_type: "authorization_code",
  code: url.searchParams.get("code"),
  redirect_uri: REDIRECT,
  client_id: CLIENT_ID,
  code_verifier: verifier,
});
if (CLIENT_SECRET) body.set("client_secret", CLIENT_SECRET);
const r = await fetch(`${HEARTHLY_URL}/api/oauth/token`, { method: "POST", body });
const tokens = await r.json(); // { access_token, refresh_token, expires_in, scope, website_id, token_type }
```

A refresh helper:

```js
async function refresh(tokens) {
  const r = await fetch(`${HEARTHLY_URL}/api/oauth/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64") },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }),
  });
  if (!r.ok) throw new Error(`refresh failed: ${(await r.json()).error}`); // invalid_grant → re-run the authorization flow
  return r.json(); // persist BOTH new tokens; the old pair is now revoked
}
```
