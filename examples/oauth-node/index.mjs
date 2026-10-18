// Minimal third-party ChatCrip integration (zero dependencies, Node 18+).
// Implements the OAuth 2.0 authorization-code flow with PKCE, then uses the token to post a message.
//
//   CHATCRIP_URL=http://localhost:3005 CLIENT_ID=cc_app_... CLIENT_SECRET=cc_cs_... node index.mjs
//   open http://localhost:4000
//
// Register the app in ChatCrip → Developers with redirect URI http://localhost:4000/callback.
import http from "node:http";
import crypto from "node:crypto";

const CC = process.env.CHATCRIP_URL || "http://localhost:3005";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""; // optional: omit to act as a public (PKCE-only) client
const PORT = Number(process.env.PORT || 4000);
const REDIRECT = `http://localhost:${PORT}/callback`;
if (!CLIENT_ID) throw new Error("Set CLIENT_ID (and optionally CLIENT_SECRET)");

const pending = new Map(); // state -> code_verifier
let tokens = null;

const b64url = (buf) => buf.toString("base64url");
const html = (res, body) => res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html><body style="font-family:system-ui;max-width:640px;margin:40px auto;line-height:1.5">${body}</body>`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function api(path, init = {}) {
  const r = await fetch(CC + path, { ...init, headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j.error)}`);
  return j;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      if (url.pathname === "/") {
        return html(res, `<h1>Demo integration</h1><p>${tokens ? `Connected to website <code>${tokens.website_id}</code>. <a href="/send">Post a message</a>` : `<a href="/connect">Connect ChatCrip →</a>`}</p>`);
      }
      if (url.pathname === "/connect") {
        const verifier = b64url(crypto.randomBytes(32));
        const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
        const state = b64url(crypto.randomBytes(16));
        pending.set(state, verifier);
        const auth = new URL("/oauth/authorize", CC);
        auth.search = new URLSearchParams({ response_type: "code", client_id: CLIENT_ID, redirect_uri: REDIRECT, scope: "conversations:read messages:write website:read", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
        return res.writeHead(302, { Location: auth.toString() }).end();
      }
      if (url.pathname === "/callback") {
        const state = url.searchParams.get("state");
        const verifier = pending.get(state);
        if (!verifier) return html(res, "Unknown or reused state (CSRF protection).");
        pending.delete(state);
        if (url.searchParams.get("error")) return html(res, `Authorization failed: ${esc(url.searchParams.get("error"))}`);
        const body = new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code"), redirect_uri: REDIRECT, client_id: CLIENT_ID, code_verifier: verifier });
        if (CLIENT_SECRET) body.set("client_secret", CLIENT_SECRET);
        const r = await fetch(`${CC}/api/oauth/token`, { method: "POST", body });
        const j = await r.json();
        if (!r.ok) return html(res, `Token exchange failed: ${esc(JSON.stringify(j))}`);
        tokens = j;
        console.log("[example] connected; scopes:", j.scope);
        return res.writeHead(302, { Location: "/send" }).end();
      }
      if (url.pathname === "/send") {
        if (!tokens) return res.writeHead(302, { Location: "/" }).end();
        const site = await api("/api/v1/website");
        const { data: convs } = await api("/api/v1/conversations?status=open&limit=1");
        if (!convs.length) return html(res, `Connected to <b>${esc(site.data.name)}</b>, but there are no open conversations yet.`);
        const msg = await api(`/api/v1/conversations/${convs[0].id}/messages`, { method: "POST", body: JSON.stringify({ text: "👋 Hello from the example OAuth integration!", author_name: "Example Bot", from: "bot" }) });
        console.log("[example] sent message", msg.data.id);
        return html(res, `<h1>Sent ✅</h1><p>Posted message <code>${esc(msg.data.id)}</code> into conversation <code>${esc(convs[0].id)}</code> on <b>${esc(site.data.name)}</b>.</p><p>Token scopes: <code>${esc(site.token.scopes.join(" "))}</code></p>`);
      }
      res.writeHead(404).end("not found");
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  })
  .listen(PORT, () => console.log(`[example] open http://localhost:${PORT}`));
