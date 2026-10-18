"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type Handler = (type: string, data: unknown) => void;
type Ctx = { connected: boolean; online: string[]; subscribe: (fn: Handler) => () => void };
const RealtimeCtx = createContext<Ctx>({ connected: false, online: [], subscribe: () => () => {} });

const TYPES = ["hello", "message", "conversation", "conversation.deleted", "conversation.woke", "typing", "read", "visitor", "contact", "event", "presence", "settings", "team"];

/** One SSE connection per tab, auto-reconnecting with backoff. Consumers fall back to polling while disconnected. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef(new Set<Handler>());
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<string[]>([]);
  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const open = () => {
      if (stopped) return;
      es = new EventSource("/api/stream");
      es.onopen = () => {
        setConnected(true);
        retry = 1000;
      };
      for (const t of TYPES)
        es.addEventListener(t, (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          if (t === "presence" || t === "hello") setOnline((data as { online: string[] }).online || []);
          handlers.current.forEach((h) => h(t, data));
        });
      es.onerror = () => {
        setConnected(false);
        if (es?.readyState === EventSource.CLOSED) {
          es.close();
          timer = setTimeout(open, retry);
          retry = Math.min(retry * 2, 30_000);
        }
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      es?.close();
    };
  }, []);
  const subscribe = (fn: Handler) => {
    handlers.current.add(fn);
    return () => void handlers.current.delete(fn);
  };
  return <RealtimeCtx.Provider value={{ connected, online, subscribe }}>{children}</RealtimeCtx.Provider>;
}

export const useRealtime = () => useContext(RealtimeCtx);

/** Subscribe to realtime events for the lifetime of the component. */
export function useRealtimeEvent(fn: Handler) {
  const { subscribe } = useRealtime();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => subscribe((t, d) => ref.current(t, d)), [subscribe]);
}

/** Short pleasant chime via WebAudio (no asset needed). */
export function chime() {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new C();
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio unavailable */
  }
}
