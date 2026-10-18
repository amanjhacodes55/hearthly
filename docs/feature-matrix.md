# ChatCrip vs Crisp — feature matrix

An honest comparison against Crisp's public feature set (shared inbox, chat widget, CRM, campaigns,
chatbot, knowledge base, status page, integrations, APIs). Crisp is a mature commercial product with
years of polish, native mobile apps and AI features; ChatCrip is a young open-source project that
aims to match the core and go further on UX details and the developer platform.

Legend: ✅ on par · ➕ ChatCrip does more / better · 🟡 partial · ⏳ not yet

## Inbox & conversations

| Capability | ChatCrip | Notes |
|---|---|---|
| Shared team inbox | ✅ | Open / pending / snoozed / resolved, assign, tags, search across people *and* message text |
| Realtime updates | ✅ | Server-Sent Events with automatic reconnect + polling fallback |
| Private notes | ✅ | |
| Canned replies / shortcuts | ➕ | `/` command menu with keyboard navigation and `{{variable \| fallback}}` templating |
| Live typing preview ("visitor is typing: …") | ✅ | |
| Read receipts (both directions) | ✅ | |
| Snooze with automatic wake-up | ✅ | |
| Keyboard-first workflow | ➕ | J/K, R, E, A, I, `/`, `?` help overlay, per-conversation drafts |
| Browser notifications + sound + unread badge in tab title | ✅ | |
| Mobile | 🟡 | Responsive web app (list → thread → profile panes); no native iOS/Android apps |
| Email / Messenger / WhatsApp / Instagram / SMS channels | 🟡 | Not built in — the **inbound channel API** + `message.sent` webhook let you bridge any channel yourself |
| Audio/video calls, co-browsing, screen sharing | ⏳ | |
| Auto-translation | ⏳ | |

## Chat widget

| Capability | ChatCrip | Notes |
|---|---|---|
| One-line embed, async | ✅ | `<script src=".../widget.js" data-website="ID" async>` — ~32 KB minified / ~11 KB gzipped |
| Style isolation | ✅ | Shadow DOM |
| Colors, gradient, light/dark/auto, position, launcher icon/text, radius | ➕ | Edited with a **live preview** that runs the real widget |
| Welcome message, team avatars, availability + offline message | ✅ | |
| Pre-chat form (custom fields, required toggles) | ✅ | |
| Text overrides / localization | 🟡 | Every string overridable per website; no bundled translations yet |
| Emoji, file attachments (drag & drop, paste images), image lightbox | ✅ | 10 MB limit, MIME allowlist + magic-byte sniffing |
| Ratings (1–5 + comment) | ✅ | |
| Email transcript | ✅ | Logged to the server console when SMTP isn't configured |
| Help-center search inside the widget | ✅ | |
| JS API (`push` queue, open/close, identify, track, events) | ✅ | |
| Identity verification (HMAC `user_hash`) | ✅ | |
| Hide on mobile / on URLs, auto-open rules | ✅ | |

## Contacts, tracking & analytics

| Capability | ChatCrip | Notes |
|---|---|---|
| Visitor profile (location, device, pages, referrer, UTM, sessions, custom data, events, notes) | ✅ | Location from edge headers / time zone / language — no paid geo-IP |
| Live visitors + proactive chat | ✅ | |
| SPA-aware page tracking | ✅ | pushState / replaceState / popstate / hashchange |
| CRM list, search, segments (saved filters) | ✅ | Fields, tags, events, last/first seen, custom data |
| CSV import / export, merge on email | ✅ | Formula-injection-safe CSV export |
| Analytics (volume, FRT, resolution, CSAT, heatmap, top pages, sources) | ✅ | |
| Company profiles / deals pipeline | ⏳ | |

## Automation & engagement

| Capability | ChatCrip | Notes |
|---|---|---|
| Triggers (URL, time on page, returning, UTM, referrer, country, language, device…) | ✅ | Glob URL patterns (no user regex → no ReDoS) |
| Trigger actions: message, open widget, tag, assign | ✅ | |
| Auto-assign round-robin (prefers online agents), offline auto-reply, auto-resolve | ✅ | |
| Chatbot | 🟡 | Quick-reply routing bot + help-center answer bot; no visual flow builder |
| AI answers / summaries | ⏳ | |
| Campaigns to a segment (in-chat + email) with sent / opened / replied | 🟡 | Plain-text emails; no drag-and-drop email designer or scheduling yet |

## Knowledge base & status

| Capability | ChatCrip | Notes |
|---|---|---|
| Markdown articles, categories, public help center per website | ✅ | Safe React renderer (no `dangerouslySetInnerHTML`) |
| Multilingual help center, custom domain | ⏳ | |
| Status page | ⏳ | |

## Developer platform

| Capability | ChatCrip | Notes |
|---|---|---|
| REST API | ➕ | Scoped API keys (hashed at rest), consistent `{error:{code,message}}`, pagination, token-bucket rate limits |
| Webhooks | ➕ | HMAC-SHA256 + timestamp signature, exponential retries, per-attempt request/response log, manual redeliver, SSRF protection |
| OAuth 2.0 for third-party apps | ➕ | Authorization code + **PKCE (S256)**, rotating refresh tokens, revoke endpoint, per-website installs, uninstall revokes tokens & webhooks |
| Inbound channel API | ➕ | Post visitor messages from any platform; contact threading by `channel + external_id` |
| Realtime API for third parties (WebSocket RTM) | ⏳ | Webhooks cover server-side use; SSE is dashboard/widget-only |
| Public integrations marketplace | ⏳ | Apps are installable by anyone with the link; no directory yet |
| Open source & self-hostable | ➕ | MIT, one Docker image, MongoDB |
