// A tiny "channel bridge": lets you chat into ChatCrip from your terminal as if you were
// a user on another platform (Telegram/Slack/WhatsApp…), and prints operator replies.
//
//   CHATCRIP_URL=http://localhost:3005 CHATCRIP_KEY=cc_key_... node bridge.mjs
//
// The key needs messages:write + conversations:read. Replies are fetched by polling the REST API
// (a production bridge would subscribe to the `message.sent` webhook instead).
import readline from "node:readline";

const CC = process.env.CHATCRIP_URL || "http://localhost:3005";
const KEY = process.env.CHATCRIP_KEY;
if (!KEY) throw new Error("Set CHATCRIP_KEY");
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const user = { external_id: process.env.EXTERNAL_ID || "cli-user-1", name: process.env.NAME || "Terminal User" };
let conversation = null;
const shown = new Set();

async function send(text) {
  const r = await fetch(`${CC}/api/v1/inbound`, { method: "POST", headers: H, body: JSON.stringify({ channel: "terminal", contact: user, text }) });
  const j = await r.json();
  if (!r.ok) return console.error("error:", j.error);
  conversation = j.data.conversation_id;
  shown.add(j.data.message.id);
}

async function poll() {
  if (!conversation) return;
  const r = await fetch(`${CC}/api/v1/conversations/${conversation}/messages?limit=20`, { headers: H });
  const j = await r.json();
  for (const m of j.data || []) {
    if (shown.has(m.id)) continue;
    shown.add(m.id);
    if (m.from === "operator" || m.from === "bot") console.log(`\n💬 ${m.author?.name || "Support"}: ${m.text}\n> `);
  }
}
setInterval(() => poll().catch(() => {}), 2000);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
console.log(`Chatting as ${user.name} (${user.external_id}) on channel "terminal". Type a message:`);
rl.prompt();
rl.on("line", async (line) => {
  if (line.trim()) await send(line.trim());
  rl.prompt();
});
