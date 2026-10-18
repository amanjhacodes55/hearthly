"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy as CopyIcon, RefreshCw } from "lucide-react";
import { Field, Skeleton } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card, type SettingsCtx } from "./SettingsSection";

type Site = { name: string; domain: string; logo: string; publicId: string; identitySecret?: string };

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const toast = useToast();
  return (
    <div className="relative">
      {label && <p className="label">{label}</p>}
      <pre className="overflow-x-auto rounded-xl bg-[#0b1114] p-4 pr-12 text-[12.5px] leading-relaxed text-teal-50">
        <code>{code}</code>
      </pre>
      <button className="absolute right-2 top-2 rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20" style={label ? { top: "1.9rem" } : undefined} aria-label="Copy code" onClick={() => navigator.clipboard?.writeText(code).then(() => toast("Copied"))}>
        <CopyIcon className="size-3.5" />
      </button>
    </div>
  );
}

export default function WebsiteSettings({ ctx }: { ctx: SettingsCtx }) {
  const toast = useToast();
  const router = useRouter();
  const { data, reload } = useFetch<Site>("/api/websites/current");
  const [f, setF] = useState<Site | null>(null);
  const [origin, setOrigin] = useState(ctx.origin);
  useEffect(() => setOrigin(ctx.origin || window.location.origin), [ctx.origin]);
  useEffect(() => {
    if (data) setF(data);
  }, [data]);
  if (!f) return <Skeleton className="h-64" />;
  const snippet = `<script src="${origin}/widget.js" data-website="${f.publicId}" async></script>`;
  return (
    <>
      <Card title="Install the chat widget" description="Paste this before </body> on every page. Works with any site, SPA or CMS.">
        <CodeBlock code={snippet} />
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="label">Website ID</p>
            <code className="font-mono font-semibold">{f.publicId}</code>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="label">Public help center</p>
            <a className="font-medium text-brand hover:underline" href={`/help/${f.publicId}`} target="_blank" rel="noopener">
              {origin}/help/{f.publicId}
            </a>
          </div>
        </div>
        <CodeBlock
          label="JavaScript API (optional)"
          code={`<script>
  // queue calls before the widget loads
  window.ChatCrip = window.ChatCrip || [];
  ChatCrip.push(["set", "user:email", "ada@example.com"]);
  ChatCrip.push(["set", "user:nickname", "Ada Lovelace"]);
  ChatCrip.push(["set", "session:data", [["plan", "pro"], ["seats", 12]]]);
</script>
<!-- after load: ChatCrip.open(), ChatCrip.identify({...}), ChatCrip.track("checkout", {total: 49}),
     ChatCrip.on("message:received", m => console.log(m)) -->`}
        />
      </Card>
      {ctx.admin && (
        <Card
          title="Website"
          footer={
            <button className="btn-primary" onClick={async () => { try { await api("/api/websites/current", { method: "PATCH", json: { name: f.name, domain: f.domain, logo: f.logo } }); toast("Saved"); router.refresh(); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
              Save
            </button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Domain">
              <input className="input" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Logo URL (https)">
                <input className="input" value={f.logo} onChange={(e) => setF({ ...f, logo: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>
      )}
      {ctx.admin && f.identitySecret && (
        <Card title="Identity verification" description="Prove a visitor's email came from your backend. Verified identities can be merged with existing contacts safely.">
          <CodeBlock code={f.identitySecret} label="Secret (keep it server-side)" />
          <CodeBlock
            label="Compute user_hash on your server (Node)"
            code={`const user_hash = require("crypto").createHmac("sha256", process.env.CHATCRIP_IDENTITY_SECRET)
  .update(user.email.toLowerCase()).digest("hex");
// then in the page: ChatCrip.identify({ email: user.email, name: user.name, user_hash })`}
          />
          <button className="btn-outline btn-sm mt-3" onClick={async () => confirm("Rotate the secret? Existing hashes stop verifying.") && (await api("/api/websites/current", { method: "PATCH", json: { rotateIdentitySecret: true } }), reload(), toast("Secret rotated"))}>
            <RefreshCw className="size-3.5" /> Rotate secret
          </button>
        </Card>
      )}
      {ctx.website.role === "owner" && (
        <Card title="Danger zone">
          <p className="text-sm text-muted">Deleting the website removes all conversations, contacts, articles, keys and webhooks. This cannot be undone.</p>
          <button
            className="btn-danger mt-3"
            onClick={async () => {
              const confirmName = prompt(`Type “${ctx.website.name}” to delete this website`);
              if (confirmName !== ctx.website.name) return;
              try {
                await api("/api/websites/current", { method: "DELETE", json: { confirm: confirmName } });
                window.location.href = "/app";
              } catch (e) {
                toast(e instanceof Error ? e.message : "Failed", "error");
              }
            }}
          >
            Delete website
          </button>
        </Card>
      )}
    </>
  );
}
