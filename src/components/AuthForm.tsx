"use client";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/ui";
import { api } from "@/lib/client";

const ERRORS: Record<string, string> = {
  CredentialsSignin: "Wrong email or password.",
  DatabaseUnavailable: "We can't reach the database right now — please try again in a minute.",
  TooManyAttempts: "Too many attempts. Wait a few minutes and try again.",
};

export default function AuthForm({ mode, google }: { mode: "login" | "register"; google: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") && sp.get("next")!.startsWith("/") && !sp.get("next")!.startsWith("//") ? sp.get("next")! : "/app";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(sp.get("error") ? ERRORS[sp.get("error")!] || "Sign-in failed." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await api("/api/register", { method: "POST", json: { name, email, password } });
      const r = await signIn("credentials", { email, password, redirect: false });
      if (r?.error) throw new Error(ERRORS[r.error] || r.error);
      router.push(mode === "register" ? (next.startsWith("/join") || next.startsWith("/oauth") ? next : "/onboarding") : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" aria-label="ChatCrip home">
            <Logo />
          </Link>
          <h1 className="h-display mt-10 text-3xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted">{mode === "login" ? "Sign in to your team inbox." : "Free & open source. Your inbox is ready in 30 seconds."}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "register" && (
              <label className="block">
                <span className="label">Your name</span>
                <input className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}
            <label className="block">
              <span className="label">Work email</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input className="input" type="password" required minLength={mode === "register" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "register" && <span className="mt-1 block text-xs text-faint">At least 8 characters.</span>}
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button className="btn-primary w-full py-2.5" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          {google && (
            <button className="btn-outline mt-3 w-full py-2.5" onClick={() => signIn("google", { callbackUrl: next })}>
              Continue with Google
            </button>
          )}
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "login" ? "New to ChatCrip? " : "Already have an account? "}
            <Link className="font-semibold text-brand" href={`${mode === "login" ? "/register" : "/login"}${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0b1114] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_20%_20%,rgba(20,184,166,.35),transparent),radial-gradient(500px_400px_at_80%_80%,rgba(249,115,98,.28),transparent)]" />
        <div className="relative flex h-full flex-col justify-center gap-4 p-16 text-white">
          <p className="h-display max-w-md text-4xl font-bold leading-tight">Every conversation, one calm inbox.</p>
          <p className="max-w-md text-white/70">Live chat, visitor tracking, automations and an API-first platform — open source and yours to host.</p>
          <div className="mt-6 max-w-sm space-y-3">
            {["Hi! Do you ship to Canada? 🇨🇦", "We do — 3–5 days, free over $50 📦", "Perfect, ordering now!"].map((t, i) => (
              <div key={i} className={`animate-floaty w-fit rounded-2xl px-4 py-2.5 text-sm shadow-lg ${i % 2 ? "ml-auto bg-gradient-to-br from-teal-500 to-teal-700" : "bg-white/10 backdrop-blur"}`} style={{ animationDelay: `${i * 0.8}s` }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
