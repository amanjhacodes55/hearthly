// Verifies Hearthly webhook signatures (zero dependencies).
//   HEARTHLY_WEBHOOK_SECRET=whsec_... node server.mjs   → listens on :4100/webhook
import http from "node:http";
import crypto from "node:crypto";

const SECRET = process.env.HEARTHLY_WEBHOOK_SECRET;
if (!SECRET) throw new Error("Set HEARTHLY_WEBHOOK_SECRET");

export function verify(secret, rawBody, header, toleranceSec = 300) {
  const parts = Object.fromEntries(String(header || "").split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

const seen = new Set(); // dedupe retries / redeliveries by event id
http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!verify(SECRET, raw, req.headers["hearthly-signature"])) {
        res.writeHead(400).end("bad signature");
        return;
      }
      const evt = JSON.parse(raw);
      if (!seen.has(evt.id)) {
        seen.add(evt.id);
        console.log(`✓ ${evt.event}`, JSON.stringify(evt.data).slice(0, 200));
      }
      res.writeHead(204).end();
    });
  })
  .listen(Number(process.env.PORT || 4100), () => console.log("listening on :4100"));
