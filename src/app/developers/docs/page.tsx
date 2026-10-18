import { headers } from "next/headers";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { OAUTH_SCOPES } from "@/lib/oauth";

export const metadata = { title: "API & developer docs" };

function Code({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border">
      {title && <div className="border-b border-white/10 bg-[#0f171b] px-4 py-1.5 font-mono text-[11px] text-teal-200/80">{title}</div>}
      <pre className="overflow-x-auto bg-[#0b1114] p-4 text-[12.5px] leading-relaxed text-teal-50">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="h-display mt-14 scroll-mt-6 border-t border-border pt-8 text-2xl font-bold">
      <a href={`#${id}`} className="hover:text-brand">
        {children}
      </a>
    </h2>
  );
}

const TOC = [
  ["quickstart", "Quick start"],
  ["auth", "Authentication"],
  ["conventions", "Errors, pagination & limits"],
  ["endpoints", "REST endpoints"],
  ["inbound", "Inbound channel API"],
  ["webhooks", "Webhooks"],
  ["verify", "Verifying signatures"],
  ["oauth", "OAuth 2.0 apps"],
  ["widget", "Widget JS API"],
  ["identity", "Identity verification"],
];

const ENDPOINTS: [string, string, string, string][] = [
  ["GET", "/api/v1/website", "—", "Website info + the calling token's scopes"],
  ["GET", "/api/v1/conversations", "conversations:read", "List (status, contact_id, page, limit)"],
  ["GET", "/api/v1/conversations/:id", "conversations:read", "One conversation with its contact"],
  ["PATCH", "/api/v1/conversations/:id", "conversations:write", "status, tags, assignee_id"],
  ["GET", "/api/v1/conversations/:id/messages", "conversations:read", "Messages, paginated (page 1 = newest)"],
  ["POST", "/api/v1/conversations/:id/messages", "messages:write", "Send as operator, bot, or private note"],
  ["POST", "/api/v1/inbound", "messages:write", "Post a visitor message from an external channel"],
  ["GET", "/api/v1/contacts", "contacts:read", "List / search (email, q, tag)"],
  ["POST", "/api/v1/contacts", "contacts:write", "Create — upserts (merges) on email"],
  ["GET", "/api/v1/contacts/:id", "contacts:read", "One contact"],
  ["PATCH", "/api/v1/contacts/:id", "contacts:write", "Update fields, tags, custom data"],
  ["GET", "/api/v1/webhooks", "webhooks:manage", "List endpoints"],
  ["POST", "/api/v1/webhooks", "webhooks:manage", "Subscribe (returns signing secret once)"],
  ["DELETE", "/api/v1/webhooks/:id", "webhooks:manage", "Unsubscribe"],
];

export default async function Docs() {
  const h = await headers();
  const host = process.env.NEXTAUTH_URL || `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[200px_1fr]">
      <nav className="hidden lg:block" aria-label="Docs sections">
        <div className="sticky top-6 space-y-1 text-sm">
          {TOC.map(([id, l]) => (
            <a key={id} href={`#${id}`} className="block rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-text">
              {l}
            </a>
          ))}
        </div>
      </nav>
      <article className="min-w-0 leading-7">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">Developer platform</p>
        <h1 className="h-display mt-1 text-4xl font-bold">ChatCrip API</h1>
        <p className="mt-3 text-muted">
          Everything you see in the inbox is available over HTTP: read and answer conversations, sync contacts, subscribe to signed webhooks, bridge any messaging channel, and ship installable OAuth apps. Base URL: <code className="kbd">{host}</code>
        </p>

        <H2 id="quickstart">Quick start</H2>
        <p>Create a key in <b>Settings → API keys</b>, then:</p>
        <Code title="bash">{`export CC=${host}
export KEY=cc_key_...

curl $CC/api/v1/conversations?status=open -H "Authorization: Bearer $KEY"

curl -X POST $CC/api/v1/conversations/$ID/messages \\
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"text":"Hi from the API 👋","from":"operator","author_name":"Support bot"}'`}</Code>

        <H2 id="auth">Authentication</H2>
        <p>
          Send <code className="kbd">Authorization: Bearer &lt;token&gt;</code>. Two token types are accepted, both stored only as SHA-256 hashes:
        </p>
        <ul className="my-3 list-disc space-y-1 pl-6">
          <li>
            <b>API keys</b> (<code className="kbd">cc_key_…</code>) — for your own servers. Each key has explicit scopes.
          </li>
          <li>
            <b>OAuth access tokens</b> (<code className="kbd">cc_at_…</code>) — issued to third-party apps a workspace admin installed. Valid 1 hour; refresh with the refresh token.
          </li>
        </ul>
        <p>Scopes:</p>
        <div className="my-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(OAUTH_SCOPES).map(([s, d]) => (
                <tr key={s} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{s}</td>
                  <td className="px-3 py-2 text-muted">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H2 id="conventions">Errors, pagination &amp; limits</H2>
        <Code title="error shape (every non-2xx)">{`HTTP/1.1 403 Forbidden
{ "error": { "code": "insufficient_scope", "message": "This token lacks the \\"contacts:write\\" scope" } }

codes: unauthorized · insufficient_scope · not_found · validation_failed · bad_request · rate_limited · server_error`}</Code>
        <Code title="pagination">{`GET /api/v1/contacts?page=2&limit=50
{ "data": [...], "pagination": { "page": 2, "limit": 50, "total": 342, "has_more": true } }`}</Code>
        <p>
          Rate limit: token bucket per token — burst <b>120</b>, refilling <b>2 req/s</b>. Responses carry <code className="kbd">X-RateLimit-Remaining</code>; a 429 includes <code className="kbd">Retry-After</code>. Bodies are limited to 256 KB and validated strictly (422 on bad input).
        </p>

        <H2 id="endpoints">REST endpoints</H2>
        <div className="my-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([m, p, s, d]) => (
                <tr key={m + p} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs font-bold text-brand">{m}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">{s}</td>
                  <td className="px-3 py-2 text-muted">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Code title="conversation object">{`{
  "id": "6650…", "status": "open", "assignee_id": null, "tags": ["billing"], "channel": "widget",
  "last_message": { "text": "Can I add seats?", "from": "visitor", "at": "2026-01-31T10:02:11.000Z" },
  "unread": 1, "rating": null, "first_response_at": null, "created_at": "…", "updated_at": "…",
  "contact_id": "664f…",
  "contact": { "id": "664f…", "email": "maya@example.com", "name": "Maya", "geo": { "country": "DE", "city": "Berlin" },
               "device": { "browser": "Chrome", "os": "macOS", "type": "desktop" }, "current_page": { "url": "…" }, "online": true }
}`}</Code>
        <Code title="create or merge a contact">{`curl -X POST $CC/api/v1/contacts -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"email":"ada@example.com","name":"Ada","tags":["vip"],"data":{"plan":"pro","seats":12}}'
# 201 Created (new) · 200 + "merged": true (an existing contact had that email)`}</Code>

        <H2 id="inbound">Inbound channel API</H2>
        <p>
          Build a bridge for Slack, Telegram, WhatsApp, SMS or email: post what your users write as <b>visitor</b> messages. ChatCrip finds or creates the contact (by <code className="kbd">channel + external_id</code>, then email) and keeps one open conversation per channel. Operator replies come back through the <code className="kbd">message.sent</code> webhook — relay any whose <code className="kbd">conversation.channel</code> is yours.
        </p>
        <Code title="POST /api/v1/inbound  (scope messages:write)">{`curl -X POST $CC/api/v1/inbound -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{
  "channel": "telegram",
  "contact": { "external_id": "tg_99812", "name": "Jonas" },
  "text": "Hey, my order hasn't arrived"
}'
→ 201 { "data": { "conversation_id": "…", "contact_id": "…", "message": { … } } }`}</Code>

        <H2 id="webhooks">Webhooks</H2>
        <p>
          Add endpoints in <b>Settings → Webhooks</b> or via <code className="kbd">POST /api/v1/webhooks</code>. Every delivery is an HTTP POST with a JSON body, retried with exponential backoff (30s, 2m, 8m, 32m, ~2h, ~8.5h) until a 2xx, then marked failed. The dashboard shows each attempt&apos;s request headers, status, latency and response, with one-click redelivery. URLs pointing at private networks are rejected (SSRF protection).
        </p>
        <div className="my-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(WEBHOOK_EVENTS).map(([e, d]) => (
                <tr key={e} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{e}</td>
                  <td className="px-3 py-2 text-muted">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Code title="headers">{`Content-Type: application/json
User-Agent: ChatCrip-Webhooks/1.0
X-ChatCrip-Event: message.received
X-ChatCrip-Delivery: 6651a…            # unique per attempt chain
X-ChatCrip-Timestamp: 1767225600
X-ChatCrip-Signature: t=1767225600,v1=5f2b…c9   # HMAC-SHA256(secret, "<t>.<raw body>")`}</Code>
        <Code title="payload — message.received">{`{
  "id": "evt_8c1f…",            // stable across retries/redeliveries: use it to dedupe
  "event": "message.received",
  "website_id": "664e…",
  "created_at": "2026-01-31T10:02:11.000Z",
  "data": {
    "message": { "id": "…", "conversation_id": "…", "from": "visitor", "text": "Hi!", "attachments": [], "created_at": "…" },
    "conversation": { "id": "…", "status": "open", "channel": "widget", "contact": { "email": "…", "name": "…" }, … }
  }
}`}</Code>
        <Code title="payload — rating.submitted">{`{ "event": "rating.submitted", "data": { "conversation": { … }, "rating": { "score": 5, "comment": "Super quick!", "at": "…" } } }`}</Code>

        <H2 id="verify">Verifying signatures</H2>
        <p>Always verify against the <b>raw</b> request body and reject timestamps older than 5 minutes.</p>
        <Code title="Node.js (Express)">{`import crypto from "node:crypto";
import express from "express";

const app = express();
app.post("/chatcrip/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("X-ChatCrip-Signature") || "";
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", process.env.CHATCRIP_WEBHOOK_SECRET)
    .update(\`\${t}.\${req.body}\`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  const ok = fresh && v1 && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  if (!ok) return res.status(400).send("bad signature");
  const event = JSON.parse(req.body);
  console.log(event.event, event.data);
  res.sendStatus(204);
});`}</Code>
        <Code title="Python (Flask)">{`import hmac, hashlib, os, time
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["CHATCRIP_WEBHOOK_SECRET"].encode()

@app.post("/chatcrip/webhook")
def webhook():
    parts = dict(p.split("=", 1) for p in request.headers.get("X-ChatCrip-Signature", "").split(","))
    t, v1 = parts.get("t", "0"), parts.get("v1", "")
    expected = hmac.new(SECRET, f"{t}.".encode() + request.get_data(), hashlib.sha256).hexdigest()
    if abs(time.time() - int(t)) > 300 or not hmac.compare_digest(expected, v1):
        abort(400)
    event = request.get_json()
    print(event["event"], event["data"])
    return "", 204`}</Code>

        <H2 id="oauth">OAuth 2.0 apps</H2>
        <p>
          Register an app under <b>Developers</b> to get a <code className="kbd">client_id</code> / <code className="kbd">client_secret</code>. Any workspace owner or admin can then install it. ChatCrip implements the authorization-code grant with <b>PKCE (S256)</b> — required for public clients without a secret — and rotating refresh tokens.
        </p>
        <Code title="1 · redirect the user">{`${host}/oauth/authorize
  ?response_type=code
  &client_id=cc_app_…
  &redirect_uri=https://yourapp.example/callback      # must exactly match a registered URI
  &scope=conversations:read%20messages:write
  &state=<random>
  &code_challenge=<BASE64URL(SHA256(code_verifier))>
  &code_challenge_method=S256`}</Code>
        <Code title="2 · exchange the code (expires in 10 minutes, single use)">{`curl -X POST ${host}/api/oauth/token \\
  -d grant_type=authorization_code -d code=cc_code_… \\
  -d redirect_uri=https://yourapp.example/callback \\
  -d client_id=cc_app_… -d client_secret=cc_cs_… \\
  -d code_verifier=<the original verifier>

{ "access_token": "cc_at_…", "token_type": "Bearer", "expires_in": 3600,
  "refresh_token": "cc_rt_…", "scope": "conversations:read messages:write", "website_id": "664e…" }`}</Code>
        <Code title="3 · refresh (the old refresh token is revoked) · revoke">{`curl -X POST ${host}/api/oauth/token -d grant_type=refresh_token -d refresh_token=cc_rt_… -d client_id=cc_app_… -d client_secret=cc_cs_…
curl -X POST ${host}/api/oauth/revoke -d token=cc_at_… -d client_id=cc_app_… -d client_secret=cc_cs_…`}</Code>
        <p>
          Apps can create their own webhooks with <code className="kbd">webhooks:manage</code>; they&apos;re removed automatically when the workspace uninstalls the app. See <code className="kbd">examples/oauth-node</code> in the repo for a complete, runnable integration.
        </p>

        <H2 id="widget">Widget JS API</H2>
        <Code title="html">{`<script src="${host}/widget.js" data-website="YOUR_WEBSITE_ID" async></script>
<script>
  // Queue commands before the widget loads (Array-style API)
  window.ChatCrip = window.ChatCrip || [];
  ChatCrip.push(["set", "user:email", "ada@example.com"]);
  ChatCrip.push(["set", "user:nickname", "Ada"]);
  ChatCrip.push(["set", "session:data", [["plan", "pro"], ["seats", 12]]]);
  ChatCrip.push(["set", "session:event", [["signed_up", { plan: "pro" }]]]);
  ChatCrip.push(["do", "chat:open"]);
  ChatCrip.push(["on", "message:received", (m) => console.log("new reply", m)]);
</script>`}</Code>
        <Code title="methods (after load)">{`ChatCrip.open() · .close() · .toggle() · .show() · .hide() · .isOpen()
ChatCrip.identify({ email, name, phone, company, avatar, data: { plan: "pro" }, user_hash })
ChatCrip.track("checkout", { total: 49 })   // shows in the contact's events, usable in segments
ChatCrip.send("Hello!")                      // send a message as the visitor
ChatCrip.on(event, fn) / .off(event, fn)     // ready · open · close · message:sent · message:received · rating:submitted
ChatCrip.reset()                             // forget the visitor (e.g. on logout)`}</Code>
        <p>The widget tracks page views automatically, including single-page-app navigations (pushState / popstate / hashchange).</p>

        <H2 id="identity">Identity verification</H2>
        <p>
          Widget identities are unverified by default, so ChatCrip never merges a visitor into an existing contact just because they typed an email. To link sessions to known users, compute <code className="kbd">user_hash = HMAC-SHA256(identity secret, lowercase email)</code> on your server (secret in <b>Settings → Website</b>) and pass it to <code className="kbd">ChatCrip.identify</code>. Verified identities merge history safely.
        </p>
      </article>
    </div>
  );
}
