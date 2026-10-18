"use client";
import { useState } from "react";
import clsx from "clsx";
import { BookOpen, Eye, ExternalLink, FolderPlus, Plus, Save, Trash2 } from "lucide-react";
import { Empty, Field, ListSkeleton, Modal, PageHeader, Switch, timeAgo } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";

type Cat = { id: string; name: string; slug: string; description: string; icon: string; order: number };
type Art = { id: string; title: string; slug: string; body: string; category: string | null; published: boolean; views: number; updatedAt: string; excerpt: string };

export default function KnowledgeBase({ publicId }: { publicId: string }) {
  const toast = useToast();
  const { data: cats, reload: reloadCats } = useFetch<Cat[]>("/api/kb/categories");
  const { data: arts, loading, reload } = useFetch<Art[]>("/api/kb/articles");
  const [cat, setCat] = useState<string>("");
  const [edit, setEdit] = useState<Partial<Art> | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [newCat, setNewCat] = useState<{ name: string; icon: string; description: string } | null>(null);
  const list = (arts || []).filter((a) => !cat || a.category === cat);

  async function save() {
    if (!edit) return;
    const { id, title, body, category, published } = edit;
    try {
      await api(id ? `/api/kb/articles/${id}` : "/api/kb/articles", { method: id ? "PATCH" : "POST", json: { title, body, category: category || null, published } });
      toast("Article saved");
      setEdit(null);
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        icon={<BookOpen className="size-5" />}
        title="Help center"
        subtitle="Markdown articles — public, searchable from the widget, and suggested by the bot."
        actions={
          <>
            <a href={`/help/${publicId}`} target="_blank" rel="noopener" className="btn-outline btn-sm">
              <ExternalLink className="size-3.5" /> View public site
            </a>
            <button className="btn-outline btn-sm" onClick={() => setNewCat({ name: "", icon: "📘", description: "" })}>
              <FolderPlus className="size-3.5" /> Category
            </button>
            <button className="btn-primary btn-sm" onClick={() => (setEdit({ title: "", body: "## Overview\n\n", category: cat || null, published: true }), setTab("write"))}>
              <Plus className="size-3.5" /> New article
            </button>
          </>
        }
      />
      <div className="grid gap-5 p-5 md:p-8 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-1">
          <button className="nav-item w-full" aria-current={!cat ? "page" : undefined} onClick={() => setCat("")}>
            All articles <span className="ml-auto text-xs text-faint">{arts?.length ?? ""}</span>
          </button>
          {(cats || []).map((c) => (
            <div key={c.id} className="group flex items-center">
              <button className="nav-item flex-1" aria-current={cat === c.id ? "page" : undefined} onClick={() => setCat(c.id)}>
                <span>{c.icon}</span>
                <span className="flex-1 truncate text-left">{c.name}</span>
                <span className="text-xs text-faint">{(arts || []).filter((a) => a.category === c.id).length}</span>
              </button>
              <button className="btn-ghost btn-sm !p-1 opacity-0 group-hover:opacity-100" aria-label={`Delete ${c.name}`} onClick={async () => confirm(`Delete category “${c.name}”? Articles are kept.`) && (await api(`/api/kb/categories/${c.id}`, { method: "DELETE" }), reloadCats())}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </aside>
        <div className="card overflow-hidden">
          {loading && !arts ? (
            <ListSkeleton rows={4} />
          ) : !list.length ? (
            <Empty icon={<BookOpen className="size-6" />} title="No articles here yet">
              Write answers to your most common questions once — visitors find them from the widget.
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((a) => (
                <li key={a.id}>
                  <button className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2" onClick={() => (setEdit(a), setTab("write"))}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold">
                        {a.title}
                        {!a.published && <span className="chip">draft</span>}
                      </span>
                      <span className="block truncate text-sm text-muted">{a.excerpt}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-faint">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3" /> {a.views}
                      </span>
                      <span className="block">{timeAgo(a.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Edit article" : "New article"}
        wide
        footer={
          <>
            {edit?.id && (
              <button className="btn-ghost mr-auto text-danger" onClick={async () => confirm("Delete this article?") && (await api(`/api/kb/articles/${edit.id}`, { method: "DELETE" }), setEdit(null), reload())}>
                <Trash2 className="size-4" /> Delete
              </button>
            )}
            {edit?.id && edit.slug && (
              <a className="btn-outline" href={`/help/${publicId}/${edit.slug}`} target="_blank" rel="noopener">
                <ExternalLink className="size-4" /> Open
              </a>
            )}
            <button className="btn-primary" onClick={save} disabled={!edit?.title?.trim()}>
              <Save className="size-4" /> Save
            </button>
          </>
        }
      >
        {edit && (
          <div className="space-y-3">
            <Field label="Title">
              <input className="input text-base font-semibold" value={edit.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <Field label="Category">
                  <select className="input" value={edit.category || ""} onChange={(e) => setEdit({ ...edit, category: e.target.value || null })}>
                    <option value="">Uncategorized</option>
                    {(cats || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Switch checked={edit.published !== false} onChange={(v) => setEdit({ ...edit, published: v })} label="Published" />
            </div>
            <div className="flex gap-1">
              {(["write", "preview"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={clsx("rounded-lg px-3 py-1 text-xs font-semibold capitalize", tab === t ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2")}>
                  {t}
                </button>
              ))}
              <span className="ml-auto self-center text-xs text-faint">Markdown: ## headings, **bold**, `code`, lists, [links](https://…), ```code blocks```</span>
            </div>
            {tab === "write" ? (
              <textarea className="input min-h-[320px] font-mono text-[13px]" value={edit.body || ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} aria-label="Article body (Markdown)" />
            ) : (
              <div className="min-h-[320px] rounded-xl border border-border p-4">
                <Markdown source={edit.body || ""} />
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(newCat)}
        onClose={() => setNewCat(null)}
        title="New category"
        footer={
          <button
            className="btn-primary"
            disabled={!newCat?.name.trim()}
            onClick={async () => {
              await api("/api/kb/categories", { method: "POST", json: { ...newCat, order: cats?.length || 0 } });
              setNewCat(null);
              void reloadCats();
            }}
          >
            Create
          </button>
        }
      >
        {newCat && (
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Icon">
              <input className="input text-center text-lg" maxLength={4} value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} />
            </Field>
            <Field label="Name">
              <input className="input" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
            </Field>
            <div className="col-span-2">
              <Field label="Description">
                <input className="input" value={newCat.description} onChange={(e) => setNewCat({ ...newCat, description: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
