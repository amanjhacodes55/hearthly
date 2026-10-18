# ChatCrip examples

| Example | What it shows |
|---|---|
| [`oauth-node/`](oauth-node) | A third-party app: OAuth 2.0 authorization code + **PKCE**, token exchange, then posting a message with the access token. |
| [`webhook-receiver/`](webhook-receiver) | Verifying the `X-ChatCrip-Signature` HMAC in Node (`server.mjs`) and Python (`verify.py`), deduping retries by event id. |
| [`inbound-bridge/`](inbound-bridge) | A channel bridge using the **inbound API**: chat into ChatCrip from your terminal and see operator replies. |

All examples are dependency-free and run on Node 18+ / Python 3.8+.
