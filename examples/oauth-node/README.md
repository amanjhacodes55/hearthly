# Example: OAuth 2.0 + PKCE integration (Node, zero dependencies)

1. In Hearthly open **Developers → New OAuth app**, add the redirect URI `http://localhost:4000/callback`
   and the scopes `conversations:read`, `messages:write`, `website:read`. Copy the client id and secret.
2. Run:
   ```bash
   HEARTHLY_URL=http://localhost:3005 CLIENT_ID=hly_app_xxx CLIENT_SECRET=hly_cs_xxx node index.mjs
   ```
   (Omit `CLIENT_SECRET` to behave like a public client — PKCE alone is then required and accepted.)
3. Open <http://localhost:4000>, click **Connect Hearthly**, approve on the consent screen.
   The example exchanges the code (with the PKCE `code_verifier`), then posts a bot message
   into your most recent open conversation via `POST /api/v1/conversations/:id/messages`.
