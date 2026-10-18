"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Empty, Field, Modal, Skeleton } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card } from "./SettingsSection";

type S = { id?: string; shortcut: string; title: string; body: string };

export default function Shortcuts() {
  const toast = useToast();
  const { data, reload } = useFetch<S[]>("/api/shortcuts");
  const [edit, setEdit] = useState<S | null>(null);
  if (!data) return <Skeleton className="h-64" />;
  return (
    <Card
      title="Canned replies"
      description={<>Type <span className="kbd">/</span> in the composer to insert one. Variables: {"{{first_name | fallback}}, {{name}}, {{email}}, {{agent}}, {{website}}, {{help_url}}"}.</>}
      footer={
        <button className="btn-primary" onClick={() => setEdit({ shortcut: "", title: "", body: "" })}>
          <Plus className="size-4" /> New shortcut
        </button>
      }
    >
      {!data.length ? (
        <Empty title="No shortcuts yet">Save answers you type often.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-2.5">
              <code className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-sm font-semibold text-brand-strong">/{s.shortcut}</code>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="block truncate text-sm text-muted">{s.body}</span>
              </span>
              <button className="btn-ghost btn-sm !p-1.5" aria-label="Edit shortcut" onClick={() => setEdit(s)}>
                <Pencil className="size-4" />
              </button>
              <button className="btn-ghost btn-sm !p-1.5 text-danger" aria-label="Delete shortcut" onClick={async () => (await api(`/api/shortcuts/${s.id}`, { method: "DELETE" }), reload())}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit shortcut" : "New shortcut"}
        footer={
          <button className="btn-primary" disabled={!edit?.shortcut || !edit?.body} onClick={async () => { const { id, ...b } = edit!; try { await api(id ? `/api/shortcuts/${id}` : "/api/shortcuts", { method: id ? "PATCH" : "POST", json: b }); setEdit(null); void reload(); toast("Saved"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
            Save
          </button>
        }
      >
        {edit && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <Field label="Shortcut">
                <input className="input font-mono" value={edit.shortcut} onChange={(e) => setEdit({ ...edit, shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="refund" />
              </Field>
              <Field label="Title">
                <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </Field>
            </div>
            <Field label="Message">
              <textarea className="input min-h-32" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}
