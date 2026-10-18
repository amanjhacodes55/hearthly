"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { Logo, Switch } from "@/components/ui";
import { api } from "@/lib/client";

export default function Onboarding({ name }: { name: string }) {
  const router = useRouter();
  const [site, setSite] = useState("");
  const [domain, setDomain] = useState("");
  const [sample, setSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(800px_400px_at_50%_-10%,var(--brand-soft),transparent)] p-4">
      <form
        className="card animate-pop w-full max-w-md p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/api/websites", { method: "POST", json: { name: site, domain, sample } });
            router.push("/app/inbox?welcome=1");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
            setBusy(false);
          }
        }}
      >
        <Logo />
        <h1 className="h-display mt-6 text-2xl font-bold">Welcome, {name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-muted">Add the website you want to chat on. You can add more later.</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="label">Website / company name</span>
            <input className="input" required maxLength={80} value={site} onChange={(e) => setSite(e.target.value)} placeholder="Acme Inc." />
          </label>
          <label className="block">
            <span className="label">Domain (optional)</span>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input className="input pl-9" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
            </div>
          </label>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <Switch checked={sample} onChange={setSample} label="Load sample data" description="Contacts, conversations, help articles and a trigger — so you can explore right away." />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Create my inbox
          </button>
        </div>
      </form>
    </div>
  );
}
