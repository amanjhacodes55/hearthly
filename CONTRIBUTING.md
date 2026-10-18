# Contributing to Hearthly

Thanks for helping make Hearthly warmer! Bug reports, docs fixes, features and design polish are all welcome.

## Ground rules

- Be kind — this project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Security issues go to [SECURITY.md](SECURITY.md), **not** public issues.
- For anything bigger than a small fix, open an issue first so we can agree on the approach.

## Local setup

Requirements: **Node.js 20+**, **MongoDB 6+** (local `mongod`, Docker, or a free Atlas cluster).

```bash
git clone https://github.com/amanjhacodes55/hearthly && cd hearthly
npm install
cp .env.example .env.local      # set NEXTAUTH_SECRET; MONGODB_URI defaults to mongodb://127.0.0.1:27017/hearthly_dev
npm run dev                     # http://localhost:3005
```

Register an account, pick **"Load sample data"** during onboarding and open `/demo` in another tab to chat
with yourself through the real widget.

- The widget lives in `src/widget/widget.js` (plain ES2017, no framework). `npm run build:widget` bundles it to
  `public/widget.js`; `npm run build` does that automatically.
- Set `ALLOW_PRIVATE_URLS=true` in `.env.local` only if you need webhooks to reach `localhost` while testing.

## Checks — run before every PR

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest
STANDALONE=1 npx next build   # the production (Docker/Render) build
```

## Pull request checklist

- [ ] The change is focused, and the PR description explains the *why*.
- [ ] `typecheck`, `lint`, `test` and the production build pass.
- [ ] New logic has tests where practical (`tests/*.test.ts`).
- [ ] API changes update `docs/api/*.md` (and `docs/openapi.yaml` for `/api/v1/**`, OAuth or inbound).
- [ ] Public API (`/api/v1`, webhook payloads, widget JS API) stays backwards compatible — add, don't break.
- [ ] UI changes work in light **and** dark mode, on mobile, and keep text contrast at WCAG AA.
- [ ] Screenshots for visible UI changes.

## Code style

TypeScript strict, server code in `src/lib`, route handlers wrapped with `route()` (dashboard), `v1()` (REST)
or `visitorRoute()` (widget) so auth, validation (zod) and errors stay consistent. Keep dependencies minimal.

## License of contributions

Hearthly is licensed under the **GNU Affero General Public License v3.0 or later**
([LICENSE](LICENSE)). By submitting a contribution you agree that it is licensed under
**AGPL-3.0-or-later** as well, and that you have the right to submit it.
