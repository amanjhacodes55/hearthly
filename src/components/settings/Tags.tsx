"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton, Tag } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card } from "./SettingsSection";

type T = { name: string; color: string };

export default function Tags() {
  const toast = useToast();
  const { data } = useFetch<{ tags: T[] }>("/api/websites/current");
  const [tags, setTags] = useState<T[] | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    if (data) setTags(data.tags);
  }, [data]);
  if (!tags) return <Skeleton className="h-48" />;
  return (
    <Card
      title="Conversation tags"
      description="Tags organize conversations and power inbox filters. New tags typed in the inbox are added here automatically."
      footer={
        <button className="btn-primary" onClick={async () => { try { await api("/api/websites/current", { method: "PATCH", json: { tags } }); toast("Tags saved"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
          Save
        </button>
      }
    >
      <ul className="space-y-2">
        {tags.map((t, i) => (
          <li key={i} className="flex items-center gap-3">
            <input type="color" value={t.color} onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className="h-8 w-10 cursor-pointer rounded-md border border-border" aria-label={`Color of ${t.name}`} />
            <input className="input !w-48 !py-1.5" value={t.name} onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, name: e.target.value.toLowerCase() } : x)))} aria-label="Tag name" />
            <Tag name={t.name} color={t.color} />
            <button className="btn-ghost btn-sm !p-1.5 ml-auto" aria-label={`Delete ${t.name}`} onClick={() => setTags(tags.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setTags([...tags, { name: name.trim().toLowerCase(), color: "#0d9488" }]); setName(""); }}>
        <input className="input !w-56" placeholder="new-tag" value={name} onChange={(e) => setName(e.target.value)} aria-label="New tag" />
        <button className="btn-outline">
          <Plus className="size-4" /> Add
        </button>
      </form>
    </Card>
  );
}
