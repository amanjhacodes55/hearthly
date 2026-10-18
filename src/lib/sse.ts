import "server-only";
import { subscribe, type BusEvent } from "@/lib/bus";

/**
 * Server-Sent Events response fed by the in-process bus. Sends a heartbeat every 20s and a `retry` hint so
 * EventSource reconnects automatically; clients fall back to polling if SSE is unavailable.
 */
export function sseResponse(req: Request, topics: string[], o: { initial?: BusEvent[]; filter?: (e: BusEvent) => boolean; onOpen?: () => void; onClose?: () => void; headers?: HeadersInit } = {}) {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (e: BusEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`));
        } catch {
          close();
        }
      };
      controller.enqueue(enc.encode(`retry: 3000\n: connected\n\n`));
      for (const e of o.initial || []) send(e);
      const unsubs = topics.map((t) => subscribe(t, (e) => (!o.filter || o.filter(e)) && send(e)));
      const hb = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          close();
        }
      }, 20_000);
      function close() {
        if (closed) return;
        closed = true;
        clearInterval(hb);
        unsubs.forEach((u) => u());
        o.onClose?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
      cleanup = close;
      req.signal.addEventListener("abort", close);
      o.onOpen?.();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", ...o.headers },
  });
}
