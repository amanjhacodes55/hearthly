import { EventEmitter } from "node:events";

/**
 * In-process pub/sub that feeds the SSE streams. ChatCrip is designed to run as a single instance
 * (Render free tier); swap this for Redis pub/sub to scale horizontally.
 * Topics: `site:<websiteId>` (agents) and `visitor:<contactId>` (that visitor's widget).
 */
const g = globalThis as unknown as { _ccBus?: EventEmitter; _ccPresence?: Map<string, Map<string, number>> };
export const bus = (g._ccBus ??= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(0);
  return e;
})());

export type BusEvent = { type: string; data: unknown };
export const publish = (topic: string, type: string, data: unknown) => bus.emit(topic, { type, data } satisfies BusEvent);
export function subscribe(topic: string, fn: (e: BusEvent) => void) {
  bus.on(topic, fn);
  return () => bus.off(topic, fn);
}

/** Agent presence per website: userId → open SSE connection count. */
const presence = (g._ccPresence ??= new Map());
export function agentOnline(websiteId: string, userId: string, delta: 1 | -1) {
  const m = presence.get(websiteId) ?? new Map<string, number>();
  const n = (m.get(userId) || 0) + delta;
  if (n <= 0) m.delete(userId);
  else m.set(userId, n);
  presence.set(websiteId, m);
  publish(`site:${websiteId}`, "presence", { online: [...m.keys()] });
}
export const onlineAgents = (websiteId: string) => [...(presence.get(websiteId)?.keys() ?? [])];
