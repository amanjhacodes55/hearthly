import Link from "next/link";
import Script from "next/script";
import { ensureDemoSite } from "@/lib/demo";
import { Logo } from "@/components/ui";
import DemoControls from "@/components/DemoControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live demo", description: "Try the ChatCrip chat widget on a demo website." };

export default async function Demo() {
  const id = await ensureDemoSite().catch(() => null);
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#1d1b16]">
      <div className="border-b border-black/5 bg-[#0b1114] px-5 py-2 text-center text-xs text-white/80">
        This is a fake product site running the real <Logo size={14} className="mx-1 align-middle text-white" /> widget.{" "}
        <Link href="/register" className="font-semibold text-teal-300 underline">
          Create your own inbox
        </Link>{" "}
        to answer chats in realtime.
      </div>
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-lg">☁️</span>
        <span className="text-xl font-extrabold tracking-tight">Nimbus Notes</span>
        <nav className="ml-auto hidden gap-6 text-sm text-black/60 sm:flex">
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5">
        <section className="py-16">
          <h1 className="max-w-2xl text-5xl font-extrabold leading-tight tracking-tight">Notes that sync before you blink.</h1>
          <p className="mt-4 max-w-xl text-lg text-black/60">A pretend note-taking app, here so you can poke at the chat bubble in the corner →</p>
          <DemoControls />
        </section>
        <section id="pricing" className="grid gap-4 py-12 sm:grid-cols-3">
          {[
            ["Free", "$0", "1 device, 100 notes"],
            ["Pro", "$6", "Unlimited devices & notes"],
            ["Team", "$12", "Shared spaces, admin tools"],
          ].map(([n, p, d]) => (
            <div key={n} className="rounded-2xl border border-black/10 bg-white p-6">
              <p className="font-semibold">{n}</p>
              <p className="mt-2 text-3xl font-extrabold">
                {p}
                <span className="text-sm font-medium text-black/50">/mo</span>
              </p>
              <p className="mt-2 text-sm text-black/60">{d}</p>
            </div>
          ))}
        </section>
        <section id="faq" className="py-12 text-sm text-black/60">
          <p>Tip: open the help tab in the widget and search “refund” or “password”. Quick-reply buttons route your chat and get an instant bot answer.</p>
        </section>
      </main>
      {id ? <Script src="/widget.js" data-website={id} strategy="afterInteractive" /> : <p className="p-5 text-center text-red-600">Demo unavailable: database not reachable.</p>}
    </div>
  );
}
