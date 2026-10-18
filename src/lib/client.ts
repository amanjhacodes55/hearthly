"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch JSON from our API; throws ApiError with the server's message. */
export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error || `Request failed (${res.status})`);
  return data as T;
}

/** Minimal SWR-ish hook: data + loading + error + reload, with optional polling. */
export function useFetch<T>(url: string | null, o: { refreshMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!url) return;
    const n = ++seq.current;
    try {
      const d = await api<T>(url);
      if (n === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (n === seq.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setLoading(Boolean(url));
    void load();
  }, [load, url]);
  useEffect(() => {
    if (!o.refreshMs || !url) return;
    const t = setInterval(() => !document.hidden && void load(), o.refreshMs);
    return () => clearInterval(t);
  }, [o.refreshMs, load, url]);
  return { data, error, loading, reload: load, setData };
}

export async function uploadFile(file: File, url = "/api/upload") {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(url, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Upload failed");
  return j as { id: string; name: string; size: number; type: string };
}
