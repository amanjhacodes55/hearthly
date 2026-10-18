"use client";
import Link from "next/link";
import { Blocks } from "lucide-react";
import { Avatar, Empty, Skeleton, timeAgo } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, useFetch } from "@/lib/client";
import { Card, type SettingsCtx } from "./SettingsSection";

type Inst = { id: string; app: { name: string; description: string; homepage: string; logo: string } | null; scopes: string[]; installedBy: string; createdAt: string; lastUsedAt?: string };

export default function InstalledApps({ ctx }: { ctx: SettingsCtx }) {
  const toast = useToast();
  const { data, reload } = useFetch<Inst[]>("/api/installations");
  if (!data) return <Skeleton className="h-40" />;
  return (
    <Card title="Installed apps" description={<>Third-party apps you authorized with OAuth. Build your own in <Link href="/developers" className="text-brand hover:underline">Developers</Link>.</>}>
      {!data.length ? (
        <Empty icon={<Blocks className="size-6" />} title="No apps installed" />
      ) : (
        <ul className="divide-y divide-border">
          {data.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={i.app?.name || "App"} image={i.app?.logo} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.app?.name || "Deleted app"}</span>
                <span className="block text-xs text-muted">
                  Installed by {i.installedBy} {timeAgo(i.createdAt)} · {i.lastUsedAt ? `active ${timeAgo(i.lastUsedAt)}` : "not used yet"}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {i.scopes.map((s) => (
                    <span key={s} className="chip font-mono !text-[10px]">
                      {s}
                    </span>
                  ))}
                </span>
              </span>
              {ctx.admin && (
                <button className="btn-outline btn-sm text-danger" onClick={async () => confirm(`Uninstall ${i.app?.name}? Its tokens and webhooks are revoked.`) && (await api(`/api/installations/${i.id}`, { method: "DELETE" }), reload(), toast("App uninstalled"))}>
                  Uninstall
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
