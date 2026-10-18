"use client";
import { useRouter } from "next/navigation";
import { MessageCircle, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/Toast";

export default function ContactActions({ id, canDelete }: { id: string; canDelete: boolean }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <button
        className="btn-primary btn-sm"
        onClick={async () => {
          const text = prompt("Message to send (opens their widget if they're online):");
          if (!text) return;
          try {
            const r = await api<{ conversation: { id: string } }>("/api/conversations", { method: "POST", json: { contactId: id, text } });
            router.push(`/app/inbox?c=${r.conversation.id}`);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          }
        }}
      >
        <MessageCircle className="size-3.5" /> Message
      </button>
      {canDelete && (
        <button
          className="btn-outline btn-sm text-danger"
          onClick={async () => {
            if (!confirm("Delete this contact and all their conversations? This can't be undone.")) return;
            await api(`/api/contacts/${id}`, { method: "DELETE" });
            toast("Contact deleted");
            router.push("/app/contacts");
          }}
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      )}
    </div>
  );
}
