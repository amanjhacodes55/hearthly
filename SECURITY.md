# Security policy

## Supported versions

Hearthly is released from the `main` branch. Security fixes land on `main`; please run the latest commit.

## Reporting a vulnerability

**Please do not open a public issue.** Report privately through
[GitHub private vulnerability reporting](https://github.com/amanjhacodes55/hearthly/security/advisories/new).

Include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept (against your own local instance — never someone else's deployment),
- the affected version / commit and your configuration (Docker, Render, Node version).

What to expect:

- acknowledgement within **3 working days**,
- an initial assessment within **7 days**,
- a fix or mitigation as fast as severity warrants, with credit in the advisory if you'd like it.

## Scope

In scope: the Hearthly server, REST/OAuth/webhook/widget APIs, the embeddable widget, the Dockerfile and
`render.yaml`. Out of scope: vulnerabilities in third-party hosting (Render, MongoDB Atlas), social
engineering, and denial of service through sheer traffic volume.

## Hardening notes for operators

- Always set strong, unique `NEXTAUTH_SECRET`, `WIDGET_TOKEN_SECRET` and `WEBHOOK_SIGNING_SECRET` (Render
  generates them from `render.yaml`). In production Hearthly never falls back to a public default secret.
- Keep `ALLOW_PRIVATE_URLS` **off** in production — it disables SSRF protection for webhook URLs.
- Serve Hearthly over HTTPS only.
