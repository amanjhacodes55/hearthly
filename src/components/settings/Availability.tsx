"use client";
import { useEffect, useState } from "react";
import { Field, Skeleton, Switch } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card } from "./SettingsSection";

type Av = { enabled: boolean; timezone: string; hours: { day: number; start: string; end: string }[]; offlineMessage: string };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Availability() {
  const toast = useToast();
  const { data } = useFetch<{ availability: Av }>("/api/websites/current");
  const [av, setAv] = useState<Av | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    if (data) setAv(data.availability);
    try {
      setZones((Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"));
    } catch {
      setZones(["UTC"]);
    }
  }, [data]);
  if (!av) return <Skeleton className="h-80" />;
  const dayHours = (d: number) => av.hours.find((h) => h.day === d);
  return (
    <Card
      title="Office hours"
      description="Outside these hours the widget shows you as away, and the offline auto-reply kicks in (if enabled in Automations)."
      footer={
        <button className="btn-primary" onClick={async () => { try { await api("/api/websites/current", { method: "PATCH", json: { availability: av } }); toast("Availability saved"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
          Save
        </button>
      }
    >
      <Switch checked={av.enabled} onChange={(v) => setAv({ ...av, enabled: v })} label="Use office hours" description="When off, you're “online” whenever a teammate has the dashboard open." />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Time zone">
          <select className="input" value={av.timezone} onChange={(e) => setAv({ ...av, timezone: e.target.value })}>
            {(zones.includes(av.timezone) ? zones : [av.timezone, ...zones]).map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border">
        {DAYS.map((name, d) => {
          const h = dayHours(d);
          return (
            <div key={d} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label className="flex w-36 items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={Boolean(h)} onChange={(e) => setAv({ ...av, hours: e.target.checked ? [...av.hours, { day: d, start: "09:00", end: "18:00" }] : av.hours.filter((x) => x.day !== d) })} />
                {name}
              </label>
              {h ? (
                <span className="flex items-center gap-2 text-sm">
                  <input type="time" className="input !w-auto !py-1" value={h.start} onChange={(e) => setAv({ ...av, hours: av.hours.map((x) => (x.day === d ? { ...x, start: e.target.value } : x)) })} aria-label={`${name} start`} />
                  –
                  <input type="time" className="input !w-auto !py-1" value={h.end} onChange={(e) => setAv({ ...av, hours: av.hours.map((x) => (x.day === d ? { ...x, end: e.target.value } : x)) })} aria-label={`${name} end`} />
                </span>
              ) : (
                <span className="text-sm text-faint">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Field label="Offline message">
          <textarea className="input" maxLength={500} value={av.offlineMessage} onChange={(e) => setAv({ ...av, offlineMessage: e.target.value })} />
        </Field>
      </div>
    </Card>
  );
}
