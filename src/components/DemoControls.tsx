"use client";
import { useState } from "react";

type CC = { open: () => void; identify: (p: object) => Promise<unknown>; track: (n: string, p?: object) => void; on: (e: string, fn: (d: unknown) => void) => void };

/** Buttons that exercise the widget's public JS API. */
export default function DemoControls() {
  const [log, setLog] = useState<string[]>([]);
  const cc = () => (window as unknown as { ChatCrip?: CC }).ChatCrip;
  const add = (s: string) => setLog((l) => [s, ...l].slice(0, 5));
  return (
    <div className="mt-8 rounded-2xl border border-black/10 bg-white p-5">
      <p className="text-sm font-semibold">Try the JavaScript API</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-xl bg-[#1d1b16] px-4 py-2 text-sm font-semibold text-white" onClick={() => (cc()?.open(), add("ChatCrip.open()"))}>
          ChatCrip.open()
        </button>
        <button className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold" onClick={() => { cc()?.identify({ name: "Demo Visitor", data: { plan: "pro", source: "demo-page" } }); add('ChatCrip.identify({ name: "Demo Visitor", data: {...} })'); }}>
          identify()
        </button>
        <button className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold" onClick={() => (cc()?.track("clicked_pricing", { plan: "pro" }), add('ChatCrip.track("clicked_pricing")'))}>
          track(event)
        </button>
        <button className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold" onClick={() => (history.pushState({}, "", `/demo?page=${Date.now() % 1000}`), add("history.pushState → SPA page view"))}>
          SPA navigation
        </button>
      </div>
      {log.length > 0 && (
        <pre className="mt-3 rounded-xl bg-[#0b1114] p-3 text-xs text-teal-100">
          {log.map((l) => `> ${l}`).join("\n")}
        </pre>
      )}
    </div>
  );
}
