"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Download, Filter, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { Avatar, Empty, Field, ListSkeleton, Modal, PageHeader, Tag, flag, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { OPS, SEGMENT_FIELDS, type SegmentField } from "@/lib/segments";
import type { SContact } from "@/lib/serialize";

type F = { field: SegmentField; op: string; value: string; key: string };
type Seg = { id: string; name: string; match: "all" | "any"; filters: F[] };

const OP_LABEL: Record<string, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  exists: "is set",
  not_exists: "is empty",
  has: "has",
  not_has: "doesn't have",
  gt: "greater than",
  lt: "less than",
  within_days: "within last (days)",
  older_than_days: "more than (days) ago",
};
const noValue = (op: string) => op === "exists" || op === "not_exists";

export function FilterBuilder({ filters, setFilters, match, setMatch }: { filters: F[]; setFilters: (f: F[]) => void; match: "all" | "any"; setMatch: (m: "all" | "any") => void }) {
  return (
    <div className="space-y-2">
      {filters.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          Match
          <select className="input !w-auto !py-1 text-xs" value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")} aria-label="Match mode">
            <option value="all">all filters</option>
            <option value="any">any filter</option>
          </select>
        </div>
      )}
      {filters.map((f, i) => {
        const def = SEGMENT_FIELDS[f.field];
        const ops = OPS[def.type] as readonly string[];
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={f.field}
              aria-label="Field"
              onChange={(e) => {
                const field = e.target.value as SegmentField;
                const op = (OPS[SEGMENT_FIELDS[field].type] as readonly string[])[0];
                setFilters(filters.map((x, j) => (j === i ? { field, op, value: "", key: "" } : x)));
              }}
            >
              {Object.entries(SEGMENT_FIELDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            {def.type === "data" && <input className="input !w-28 !py-1.5 text-xs" placeholder="key (e.g. plan)" value={f.key} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} aria-label="Custom data key" />}
            <select className="input !w-auto !py-1.5 text-xs" value={f.op} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))} aria-label="Operator">
              {ops.map((o) => (
                <option key={o} value={o}>
                  {OP_LABEL[o]}
                </option>
              ))}
            </select>
            {!noValue(f.op) && <input className="input !w-40 !py-1.5 text-xs" placeholder="value" value={f.value} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label="Value" />}
            <button className="btn-ghost btn-sm !p-1" onClick={() => setFilters(filters.filter((_, j) => j !== i))} aria-label="Remove filter">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
      <button className="btn-ghost btn-sm text-brand" onClick={() => setFilters([...filters, { field: "tag", op: "has", value: "", key: "" }])}>
        <Plus className="size-3.5" /> Add filter
      </button>
    </div>
  );
}

export default function Contacts() {
  const toast = useToast();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [segment, setSegment] = useState("");
  const [filters, setFilters] = useState<F[]>([]);
  const [match, setMatch] = useState<"all" | "any">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [segName, setSegName] = useState("");
  const { data: segments, reload: reloadSegs } = useFetch<Seg[]>("/api/segments");

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const complete = filters.filter((f) => noValue(f.op) || f.value);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: "50" });
    if (dq) p.set("q", dq);
    if (segment) p.set("segment", segment);
    if (complete.length) {
      p.set("filters", JSON.stringify(complete));
      p.set("match", match);
    }
    return p.toString();
  }, [dq, segment, complete, match, page]);
  useEffect(() => setPage(1), [dq, segment, filters, match]);
  const { data, loading, reload } = useFetch<{ data: SContact[]; total: number; hasMore: boolean }>(`/api/contacts?${qs}`);
  const currentSeg = segments?.find((s) => s.id === segment);

  return (
    <div>
      <PageHeader
        icon={<Users className="size-5" />}
        title="Contacts"
        subtitle={data ? `${data.total.toLocaleString()} ${segment || complete.length || dq ? "matching" : "total"}` : "Everyone who chatted or visited"}
        actions={
          <>
            <button className="btn-outline btn-sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" /> Import CSV
            </button>
            <a className="btn-outline btn-sm" href={`/api/contacts/export?${qs}`}>
              <Download className="size-3.5" /> Export
            </a>
            <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add contact
            </button>
          </>
        }
      />
      <div className="grid gap-5 p-5 md:p-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-faint">Segments</p>
          <button className={clsx("nav-item w-full")} aria-current={!segment ? "page" : undefined} onClick={() => setSegment("")}>
            All contacts
          </button>
          {(segments || []).map((s) => (
            <div key={s.id} className="group flex items-center">
              <button className="nav-item flex-1 text-left" aria-current={segment === s.id ? "page" : undefined} onClick={() => setSegment(s.id)}>
                <span className="truncate">{s.name}</span>
              </button>
              <button
                className="btn-ghost btn-sm !p-1 opacity-0 group-hover:opacity-100"
                aria-label={`Delete segment ${s.name}`}
                onClick={async () => {
                  if (!confirm(`Delete segment “${s.name}”?`)) return;
                  await api(`/api/segments/${s.id}`, { method: "DELETE" });
                  if (segment === s.id) setSegment("");
                  void reloadSegs();
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {currentSeg && (
            <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-xs text-muted">
              <p className="mb-1 font-semibold text-text">Segment rules ({currentSeg.match})</p>
              {currentSeg.filters.map((f, i) => (
                <p key={i}>
                  {SEGMENT_FIELDS[f.field]?.label}
                  {f.key ? `.${f.key}` : ""} {OP_LABEL[f.op]} <b>{f.value}</b>
                </p>
              ))}
            </div>
          )}
        </aside>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input className="input pl-9" placeholder="Search name, email, phone, company" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
            </div>
            <button className={clsx("btn-outline", (showFilters || complete.length > 0) && "border-brand text-brand")} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              <Filter className="size-4" /> Filters {complete.length > 0 && `(${complete.length})`}
            </button>
          </div>
          {showFilters && (
            <div className="card animate-pop p-4">
              <FilterBuilder filters={filters} setFilters={setFilters} match={match} setMatch={setMatch} />
              {complete.length > 0 && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button className="btn-primary btn-sm" onClick={() => setSaveOpen(true)}>
                    Save as segment
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setFilters([])}>
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="card overflow-hidden">
            {loading && !data ? (
              <ListSkeleton rows={8} />
            ) : !data?.data.length ? (
              <Empty icon={<Users className="size-6" />} title="No contacts found">
                Visitors appear here automatically once the widget is installed. You can also import a CSV.
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-2.5">Contact</th>
                      <th className="hidden px-4 py-2.5 md:table-cell">Location</th>
                      <th className="hidden px-4 py-2.5 lg:table-cell">Tags</th>
                      <th className="hidden px-4 py-2.5 sm:table-cell">Sessions</th>
                      <th className="px-4 py-2.5">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((c) => (
                      <tr key={c.id} className="table-row cursor-pointer" onClick={() => router.push(`/app/contacts/${c.id}`)}>
                        <td className="px-4 py-2.5">
                          <Link href={`/app/contacts/${c.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <Avatar name={c.name || c.email || "Visitor"} image={c.avatar} size={32} online={c.online} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{c.name || <span className="text-faint">Anonymous</span>}</span>
                              <span className="block truncate text-xs text-muted">{c.email || c.company || `#${c.id.slice(-6)}`}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="hidden px-4 py-2.5 text-muted md:table-cell">
                          {flag(c.geo.country)} {c.geo.city || c.geo.country_name || "—"}
                        </td>
                        <td className="hidden px-4 py-2.5 lg:table-cell">
                          <span className="flex flex-wrap gap-1">
                            {c.tags.slice(0, 3).map((t) => (
                              <Tag key={t} name={t} />
                            ))}
                          </span>
                        </td>
                        <td className="hidden px-4 py-2.5 text-muted sm:table-cell">{c.sessions}</td>
                        <td className="px-4 py-2.5 text-muted">{c.online ? <span className="font-semibold text-success">Online</span> : timeAgo(c.last_seen_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {data && (data.hasMore || page > 1) && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Page {page} · {data.total} contacts
              </span>
              <div className="flex gap-2">
                <button className="btn-outline btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button className="btn-outline btn-sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => void reload()} />
      <AddContact open={addOpen} onClose={() => setAddOpen(false)} onDone={() => void reload()} />
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save segment"
        footer={
          <button
            className="btn-primary"
            disabled={!segName.trim()}
            onClick={async () => {
              try {
                const s = await api<Seg>("/api/segments", { method: "POST", json: { name: segName, match, filters: complete } });
                toast("Segment saved");
                setSaveOpen(false);
                setSegName("");
                setFilters([]);
                await reloadSegs();
                setSegment(s.id);
              } catch (e) {
                toast(e instanceof Error ? e.message : "Failed", "error");
              }
            }}
          >
            Save
          </button>
        }
      >
        <Field label="Segment name">
          <input className="input" value={segName} onChange={(e) => setSegName(e.target.value)} placeholder="e.g. Trials from France" />
        </Field>
        <p className="mt-2 text-xs text-muted">Segments update automatically. Use them for inbox filters and campaigns.</p>
      </Modal>
    </div>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={() => (onClose(), setResult(null), setFile(null))}
      title="Import contacts from CSV"
      footer={
        <button
          className="btn-primary"
          disabled={!file || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const fd = new FormData();
              fd.append("file", file!);
              const r = await fetch("/api/contacts/import", { method: "POST", body: fd });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error);
              setResult(j);
              onDone();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Import failed", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Importing…" : "Import"}
        </button>
      }
    >
      <p className="text-sm text-muted">
        Columns: <code className="kbd">email</code> <code className="kbd">name</code> <code className="kbd">phone</code> <code className="kbd">company</code> <code className="kbd">tags</code> (separate with ;). Any other column becomes custom data. Existing emails are merged, not duplicated.
      </p>
      <input type="file" accept=".csv,text/csv" className="input mt-4" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="CSV file" />
      {result && (
        <p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm">
          ✅ {result.created} created · {result.updated} merged · {result.skipped} skipped
        </p>
      )}
    </Modal>
  );
}

function AddContact({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", tags: "" });
  const toast = useToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add contact"
      footer={
        <button
          className="btn-primary"
          onClick={async () => {
            try {
              const r = await api<{ merged?: boolean }>("/api/contacts", { method: "POST", json: { ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) } });
              toast(r.merged ? "Merged into existing contact with that email" : "Contact created");
              onClose();
              setF({ name: "", email: "", phone: "", company: "", tags: "" });
              onDone();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Failed", "error");
            }
          }}
        >
          Save
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(["name", "email", "phone", "company"] as const).map((k) => (
          <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
            <input className="input" type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label="Tags (comma separated)">
            <input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
