"use client";
import { useState } from "react";
import clsx from "clsx";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { Empty, Field, ListSkeleton, Modal, PageHeader, Switch } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { CONDITION_TYPES, type ConditionType } from "@/lib/triggers";

type Cond = { type: ConditionType; op: string; value: string };
type Act = { type: "message" | "open" | "tag" | "assign"; text: string; operator: string; tag: string };
type Trig = { id: string; name: string; enabled: boolean; once: boolean; conditions: Cond[]; actions: Act[]; fired: number };
type Rules = { autoAssign: boolean; offlineAutoReply: boolean; autoResolveDays: number; botEnabled: boolean };

const OPS_FOR: Record<ConditionType, string[]> = {
  url: ["matches", "not_matches", "contains", "eq"],
  time_on_page: ["gte"],
  returning: ["is_true", "is_false"],
  visits: ["gte", "lte", "eq"],
  utm_source: ["eq", "neq", "contains"],
  utm_campaign: ["eq", "neq", "contains"],
  referrer: ["contains", "matches", "eq"],
  country: ["eq", "neq"],
  language: ["eq", "neq"],
  identified: ["is_true", "is_false"],
  device: ["eq", "neq"],
};
const OP_LABEL: Record<string, string> = { matches: "matches", not_matches: "doesn't match", contains: "contains", eq: "is", neq: "is not", gte: "at least", lte: "at most", is_true: "yes", is_false: "no" };
const blank: Omit<Trig, "id" | "fired"> = { name: "", enabled: true, once: true, conditions: [{ type: "url", op: "matches", value: "*/pricing*" }], actions: [{ type: "message", text: "Hi {{first_name | there}} 👋 can I help?", operator: "", tag: "" }] };

function describe(c: Cond) {
  if (c.type === "returning" || c.type === "identified") return `${CONDITION_TYPES[c.type]}: ${OP_LABEL[c.op]}`;
  return `${CONDITION_TYPES[c.type]} ${OP_LABEL[c.op]} “${c.value}”${c.type === "time_on_page" ? "s" : ""}`;
}

export default function Automations() {
  const toast = useToast();
  const { data: triggers, loading, reload } = useFetch<Trig[]>("/api/triggers");
  const { data: site, reload: reloadSite } = useFetch<{ rules: Rules; role: string }>("/api/websites/current");
  const [edit, setEdit] = useState<(Omit<Trig, "id" | "fired"> & { id?: string }) | null>(null);

  async function saveRules(patch: Partial<Rules>) {
    try {
      await api("/api/websites/current", { method: "PATCH", json: { rules: patch } });
      await reloadSite();
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }
  async function save() {
    if (!edit) return;
    const { id, ...body } = edit;
    try {
      await api(id ? `/api/triggers/${id}` : "/api/triggers", { method: id ? "PATCH" : "POST", json: body });
      toast(id ? "Trigger updated" : "Trigger created");
      setEdit(null);
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }
  const setCond = (i: number, c: Partial<Cond>) => setEdit((e) => e && { ...e, conditions: e.conditions.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const setAct = (i: number, a: Partial<Act>) => setEdit((e) => e && { ...e, actions: e.actions.map((x, j) => (j === i ? { ...x, ...a } : x)) });

  return (
    <div>
      <PageHeader
        icon={<Zap className="size-5" />}
        title="Automations"
        subtitle="Triggers engage visitors automatically; rules keep the inbox tidy."
        actions={
          <button className="btn-primary btn-sm" onClick={() => setEdit(structuredClone(blank))}>
            <Plus className="size-3.5" /> New trigger
          </button>
        }
      />
      <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-faint">Visitor triggers</h2>
          <div className="card divide-y divide-border">
            {loading && !triggers ? (
              <ListSkeleton rows={3} />
            ) : !triggers?.length ? (
              <Empty icon={<Zap className="size-6" />} title="No triggers yet" action={<button className="btn-primary btn-sm" onClick={() => setEdit(structuredClone(blank))}>Create a trigger</button>}>
                Example: when a visitor spends 15 seconds on your pricing page, send a friendly message and open the widget.
              </Empty>
            ) : (
              triggers.map((t) => (
                <div key={t.id} className="flex flex-wrap items-start gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {t.name}
                      <span className={clsx("chip", t.enabled ? "!bg-brand-soft !text-brand-strong" : "")}>{t.enabled ? "Active" : "Paused"}</span>
                      <span className="chip">fired {t.fired}×</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      <b className="text-text">When</b> {t.conditions.map(describe).join(" and ")}
                    </p>
                    <p className="text-sm text-muted">
                      <b className="text-text">Then</b>{" "}
                      {t.actions.map((a) => (a.type === "message" ? `send “${a.text.slice(0, 60)}${a.text.length > 60 ? "…" : ""}”` : a.type === "open" ? "open the widget" : a.type === "tag" ? `tag #${a.tag}` : `assign to ${a.operator}`)).join(", ")}
                      {t.once && " · once per visitor"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={t.enabled} label={`Enable ${t.name}`} onChange={async (v) => (await api(`/api/triggers/${t.id}`, { method: "PATCH", json: { enabled: v } }), reload())} />
                    <button className="btn-ghost btn-sm !p-1.5" aria-label="Edit trigger" onClick={() => setEdit({ id: t.id, name: t.name, enabled: t.enabled, once: t.once, conditions: t.conditions, actions: t.actions.map((a) => ({ ...a, text: a.text || "", operator: a.operator || "", tag: a.tag || "" })) })}>
                      <Pencil className="size-4" />
                    </button>
                    <button className="btn-ghost btn-sm !p-1.5 text-danger" aria-label="Delete trigger" onClick={async () => confirm(`Delete “${t.name}”?`) && (await api(`/api/triggers/${t.id}`, { method: "DELETE" }), reload())}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-faint">Conversation rules</h2>
          <div className="card space-y-2 p-4">
            {site && (
              <>
                <Switch checked={site.rules.autoAssign} onChange={(v) => saveRules({ autoAssign: v })} label="Auto-assign new chats" description="Round-robin across teammates, preferring those online." />
                <Switch checked={site.rules.offlineAutoReply} onChange={(v) => saveRules({ offlineAutoReply: v })} label="Auto-reply when offline" description="Sends your offline message when nobody is online or outside hours." />
                <Switch checked={site.rules.botEnabled} onChange={(v) => saveRules({ botEnabled: v })} label="Help-center answer bot" description="When offline, suggests matching help articles." />
                <div className="pt-2">
                  <Field label="Auto-resolve inactive conversations after (days, 0 = never)">
                    <input type="number" min={0} max={90} className="input" defaultValue={site.rules.autoResolveDays} onBlur={(e) => Number(e.target.value) !== site.rules.autoResolveDays && saveRules({ autoResolveDays: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} />
                  </Field>
                </div>
                <p className="pt-1 text-xs text-faint">Office hours and the offline message live in Settings → Availability. Welcome quick-replies (routing bot) live in Settings → Chat widget.</p>
              </>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit trigger" : "New trigger"}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={!edit?.name.trim()}>
              Save trigger
            </button>
          </>
        }
      >
        {edit && (
          <div className="space-y-5">
            <Field label="Name">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Pricing page nudge" />
            </Field>
            <div>
              <p className="label">When all of these are true</p>
              <div className="space-y-2">
                {edit.conditions.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <select className="input !w-auto !py-1.5 text-sm" value={c.type} aria-label="Condition" onChange={(e) => setCond(i, { type: e.target.value as ConditionType, op: OPS_FOR[e.target.value as ConditionType][0], value: "" })}>
                      {Object.entries(CONDITION_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select className="input !w-auto !py-1.5 text-sm" value={c.op} aria-label="Operator" onChange={(e) => setCond(i, { op: e.target.value })}>
                      {OPS_FOR[c.type].map((o) => (
                        <option key={o} value={o}>
                          {OP_LABEL[o]}
                        </option>
                      ))}
                    </select>
                    {!["is_true", "is_false"].includes(c.op) && (
                      <input className="input !w-56 !py-1.5 text-sm" value={c.value} aria-label="Value" placeholder={c.type === "url" ? "*/pricing*" : c.type === "time_on_page" ? "15" : ""} onChange={(e) => setCond(i, { value: e.target.value })} />
                    )}
                    <button className="btn-ghost btn-sm !p-1" disabled={edit.conditions.length === 1} aria-label="Remove condition" onClick={() => setEdit({ ...edit, conditions: edit.conditions.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <button className="btn-ghost btn-sm text-brand" onClick={() => setEdit({ ...edit, conditions: [...edit.conditions, { type: "time_on_page", op: "gte", value: "10" }] })}>
                  <Plus className="size-3.5" /> Add condition
                </button>
                <p className="text-xs text-faint">URL patterns use * as a wildcard (no regex). Evaluated live as visitors browse.</p>
              </div>
            </div>
            <div>
              <p className="label">Then</p>
              <div className="space-y-2">
                {edit.actions.map((a, i) => (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <select className="input !w-auto !py-1.5 text-sm" value={a.type} aria-label="Action" onChange={(e) => setAct(i, { type: e.target.value as Act["type"] })}>
                        <option value="message">Send a message</option>
                        <option value="open">Open the widget</option>
                        <option value="tag">Tag the contact</option>
                        <option value="assign">Assign to teammate</option>
                      </select>
                      <button className="btn-ghost btn-sm !p-1 ml-auto" disabled={edit.actions.length === 1} aria-label="Remove action" onClick={() => setEdit({ ...edit, actions: edit.actions.filter((_, j) => j !== i) })}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {a.type === "message" && (
                      <>
                        <textarea className="input mt-2 min-h-20 text-sm" value={a.text} onChange={(e) => setAct(i, { text: e.target.value })} aria-label="Message text" />
                        <input className="input mt-2 !py-1.5 text-sm" placeholder="Send as (teammate name, optional)" value={a.operator} onChange={(e) => setAct(i, { operator: e.target.value })} />
                        <p className="mt-1 text-xs text-faint">Variables: {"{{first_name | fallback}}, {{name}}, {{page_title}}, {{website}}, {{agent}}"}</p>
                      </>
                    )}
                    {a.type === "tag" && <input className="input mt-2 !py-1.5 text-sm" placeholder="tag" value={a.tag} onChange={(e) => setAct(i, { tag: e.target.value })} />}
                    {a.type === "assign" && <input className="input mt-2 !py-1.5 text-sm" placeholder="Teammate name" value={a.operator} onChange={(e) => setAct(i, { operator: e.target.value })} />}
                  </div>
                ))}
                <button className="btn-ghost btn-sm text-brand" onClick={() => setEdit({ ...edit, actions: [...edit.actions, { type: "open", text: "", operator: "", tag: "" }] })}>
                  <Plus className="size-3.5" /> Add action
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <Switch checked={edit.once} onChange={(v) => setEdit({ ...edit, once: v })} label="Fire once per visitor" />
              <Switch checked={edit.enabled} onChange={(v) => setEdit({ ...edit, enabled: v })} label="Enabled" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
