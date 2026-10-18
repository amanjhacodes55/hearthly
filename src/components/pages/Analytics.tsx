"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { BarChart3, Clock, MessagesSquare, Smile, Timer } from "lucide-react";
import { PageHeader, Skeleton, duration } from "@/components/ui";
import { useFetch } from "@/lib/client";

type Point = { date: string; value: number };
type Data = {
  days: number;
  totals: { conversations: number; resolved: number; newContacts: number; messages: number; rated: number };
  firstResponseMs: number | null;
  resolutionMs: number | null;
  csat: number | null;
  ratings: number[];
  conversationsPerDay: Point[];
  visitorsPerDay: Point[];
  heatmap: { day: number; hour: number; value: number }[];
  topPages: { path: string; views: number; avgSeconds: number }[];
  sources: { source: string; visitors: number }[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Single-series time chart: 2px line + soft area, recessive grid, crosshair + tooltip on hover, table fallback. */
function TimeChart({ title, points, unit }: { title: string; points: Point[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640;
  const H = 180;
  const P = { l: 34, r: 10, t: 12, b: 24 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - P.b - (v / nice) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${H - P.b}L${x(0)},${H - P.b}Z`;
  const total = points.reduce((a, p) => a + p.value, 0);
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-muted">{title}</h3>
          <p className="text-2xl font-bold">{total.toLocaleString()}</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? "Chart" : "Table"}
        </button>
      </div>
      {table ? (
        <div className="max-h-48 overflow-y-auto text-sm">
          <table className="w-full">
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-b border-border">
                  <td className="py-1 text-muted">{p.date}</td>
                  <td className="py-1 text-right font-medium">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label={`${title}: ${total} ${unit} over ${points.length} days`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (points.length - 1));
              setHover(Math.max(0, Math.min(points.length - 1, i)));
            }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={P.l} x2={W - P.r} y1={y(nice * f)} y2={y(nice * f)} stroke="var(--border)" strokeWidth={1} strokeDasharray={f ? "3 4" : undefined} />
                <text x={P.l - 6} y={y(nice * f) + 3} textAnchor="end" fontSize="10" fill="var(--faint)">
                  {Math.round(nice * f)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % Math.ceil(points.length / 6) === 0 ? (
                <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">
                  {p.date.slice(5)}
                </text>
              ) : null,
            )}
            <path d={area} fill="var(--brand)" opacity={0.12} />
            <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--muted)" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(points[hover].value)} r={4.5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
              </g>
            )}
          </svg>
          {h && (
            <div className="pointer-events-none absolute top-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-pop" style={{ left: `clamp(0px, calc(${(x(hover!) / W) * 100}% - 50px), calc(100% - 110px))` }}>
              <p className="text-faint">{h.date}</p>
              <p className="font-bold">
                {h.value} {unit}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Heatmap({ cells }: { cells: Data["heatmap"] }) {
  const [hover, setHover] = useState<{ day: number; hour: number; value: number } | null>(null);
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    cells.forEach((c) => (g[c.day][c.hour] = c.value));
    return g;
  }, [cells]);
  const max = Math.max(1, ...cells.map((c) => c.value));
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-muted">Busiest hours (visitor messages)</h3>
        <span className="text-xs text-faint" aria-live="polite">
          {hover ? `${DAYS[hover.day]} ${String(hover.hour).padStart(2, "0")}:00 — ${hover.value} message${hover.value === 1 ? "" : "s"}` : "Hover a cell"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] grid-cols-[34px_repeat(24,1fr)] gap-[2px] text-[10px] text-faint">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="pr-1 text-right leading-5">{DAYS[d]}</span>
              {row.map((v, h) => (
                <span
                  key={h}
                  role="img"
                  aria-label={`${DAYS[d]} ${h}:00, ${v} messages`}
                  onMouseEnter={() => setHover({ day: d, hour: h, value: v })}
                  onMouseLeave={() => setHover(null)}
                  className="h-5 rounded-[3px]"
                  style={{ background: v ? `color-mix(in srgb, var(--brand) ${Math.round(18 + (v / max) * 82)}%, var(--surface))` : "var(--surface-2)" }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-faint">
        Less
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="size-3 rounded-[3px]" style={{ background: f ? `color-mix(in srgb, var(--brand) ${Math.round(18 + f * 82)}%, var(--surface))` : "var(--surface-2)" }} />
        ))}
        More
      </div>
    </div>
  );
}

function BarList({ title, rows, valueLabel }: { title: string; rows: { label: string; value: number; sub?: string }[]; valueLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-muted">{title}</h3>
      {!rows.length ? (
        <p className="py-6 text-center text-sm text-faint">No data yet</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Item</th>
              <th>{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="group" title={`${r.label}: ${r.value} ${valueLabel}${r.sub ? ` · ${r.sub}` : ""}`}>
                <td className="relative py-1 pr-3">
                  <span className="absolute inset-y-1 left-0 rounded-r-[4px] bg-brand/15 transition group-hover:bg-brand/25" style={{ width: `${(r.value / max) * 100}%` }} />
                  <span className="relative block truncate px-2 font-medium">{r.label}</span>
                </td>
                <td className="w-16 py-1 text-right font-semibold">
                  {r.value.toLocaleString()}
                  {r.sub && <span className="block text-[10px] font-normal text-faint">{r.sub}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const { data, loading } = useFetch<Data>(`/api/analytics?days=${days}&tz=${encodeURIComponent(tz)}`);
  const totalRatings = data ? data.ratings.reduce((a, b) => a + b, 0) : 0;
  return (
    <div>
      <PageHeader
        icon={<BarChart3 className="size-5" />}
        title="Analytics"
        subtitle={`Last ${days} days · times in ${tz}`}
        actions={
          <div className="flex rounded-xl border border-border bg-surface p-0.5" role="group" aria-label="Date range">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={clsx("rounded-lg px-3 py-1 text-xs font-semibold", days === d ? "bg-brand text-brand-fg" : "text-muted hover:text-text")}>
                {d}d
              </button>
            ))}
          </div>
        }
      />
      <div className="space-y-5 p-5 md:p-8">
        {loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: MessagesSquare, label: "Conversations", value: data.totals.conversations.toLocaleString(), sub: `${data.totals.resolved} resolved` },
                { icon: Timer, label: "Avg first response", value: duration(data.firstResponseMs), sub: "from first visitor message" },
                { icon: Clock, label: "Avg resolution time", value: duration(data.resolutionMs), sub: `${data.totals.messages} messages exchanged` },
                { icon: Smile, label: "CSAT", value: data.csat ? `${data.csat.toFixed(2)} / 5` : "—", sub: `${data.totals.rated} ratings` },
              ].map((k) => (
                <div key={k.label} className="card p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted">
                    <k.icon className="size-4 text-brand" /> {k.label}
                  </div>
                  <p className="h-display mt-2 text-3xl font-bold">{k.value}</p>
                  <p className="mt-0.5 text-xs text-faint">{k.sub}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <TimeChart title="Conversations per day" points={data.conversationsPerDay} unit="conversations" />
              <TimeChart title="Unique visitors per day" points={data.visitorsPerDay} unit="visitors" />
            </div>
            <Heatmap cells={data.heatmap} />
            <div className="grid gap-5 lg:grid-cols-3">
              <BarList title="Top pages" valueLabel="views" rows={data.topPages.map((p) => ({ label: p.path, value: p.views, sub: `${p.avgSeconds}s avg` }))} />
              <BarList title="Traffic sources" valueLabel="visitors" rows={data.sources.map((s) => ({ label: s.source, value: s.visitors }))} />
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-semibold text-muted">Ratings</h3>
                {[5, 4, 3, 2, 1].map((s) => {
                  const n = data.ratings[s - 1];
                  return (
                    <div key={s} className="flex items-center gap-2 py-1 text-sm" title={`${s} stars: ${n}`}>
                      <span className="w-8 text-muted">{s}★</span>
                      <span className="h-3 flex-1 overflow-hidden rounded-[4px] bg-surface-2">
                        <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${totalRatings ? (n / totalRatings) * 100 : 0}%` }} />
                      </span>
                      <span className="w-6 text-right font-semibold">{n}</span>
                    </div>
                  );
                })}
                <p className="mt-2 text-xs text-faint">{data.totals.newContacts} new contacts this period</p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
