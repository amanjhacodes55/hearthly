"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="btn-primary mt-6 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/websites/join", { method: "POST", json: { code } });
            router.push("/app/inbox");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
            setBusy(false);
          }
        }}
      >
        Accept invite
      </button>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </>
  );
}
