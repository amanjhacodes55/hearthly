"use client";
import dynamic from "next/dynamic";
import { ListSkeleton } from "@/components/ui";

export type SettingsCtx = { user: { id: string; name: string; email: string; image: string }; website: { id: string; publicId: string; name: string; role: string }; admin: boolean; smtp: boolean; origin: string };

const load = (f: () => Promise<{ default: React.ComponentType<{ ctx: SettingsCtx }> }>) => dynamic(f, { loading: () => <div className="card"><ListSkeleton rows={4} /></div> });
const MAP: Record<string, React.ComponentType<{ ctx: SettingsCtx }>> = {
  profile: load(() => import("./Profile")),
  website: load(() => import("./WebsiteSettings")),
  widget: load(() => import("./WidgetSettings")),
  availability: load(() => import("./Availability")),
  team: load(() => import("./Team")),
  shortcuts: load(() => import("./Shortcuts")),
  tags: load(() => import("./Tags")),
  "api-keys": load(() => import("./ApiKeys")),
  webhooks: load(() => import("./Webhooks")),
  apps: load(() => import("./InstalledApps")),
  email: load(() => import("./EmailSettings")),
  data: load(() => import("./DataExport")),
};

export default function SettingsSection({ section, ctx }: { section: string; ctx: SettingsCtx }) {
  const C = MAP[section];
  return C ? <C ctx={ctx} /> : null;
}

export function Card({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="card mb-5 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">{footer}</div>}
    </section>
  );
}
