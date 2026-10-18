import Link from "next/link";
import { notFound } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { requireCtx, canAdmin } from "@/lib/context";
import { smtpEnabled } from "@/lib/mail";
import { PageHeader } from "@/components/ui";
import SettingsSection from "@/components/settings/SettingsSection";

const SECTIONS = [
  ["profile", "Profile", false],
  ["website", "Website & install", false],
  ["widget", "Chat widget", true],
  ["availability", "Availability", true],
  ["team", "Team & roles", false],
  ["shortcuts", "Shortcuts", false],
  ["tags", "Tags", true],
  ["api-keys", "API keys", true],
  ["webhooks", "Webhooks", true],
  ["apps", "Installed apps", false],
  ["email", "Email", false],
  ["data", "Data export", true],
] as const;

export const metadata = { title: "Settings" };

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const ctx = await requireCtx("/app/settings");
  const def = SECTIONS.find((s) => s[0] === section);
  if (!def) notFound();
  const admin = canAdmin(ctx.website.role);
  return (
    <div>
      <PageHeader icon={<SettingsIcon className="size-5" />} title="Settings" subtitle={`${ctx.website.name} · you are ${ctx.website.role}`} />
      <div className="grid gap-6 p-5 md:p-8 lg:grid-cols-[210px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
          {SECTIONS.map(([key, label, adminOnly]) => (
            <Link key={key} href={`/app/settings/${key}`} aria-current={key === section ? "page" : undefined} className="nav-item shrink-0 whitespace-nowrap">
              {label}
              {adminOnly && !admin && <span className="ml-auto text-[10px] text-faint">admin</span>}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          {def[2] && !admin ? (
            <div className="card p-6 text-sm text-muted">Only owners and admins can change {def[1].toLowerCase()}.</div>
          ) : (
            <SettingsSection section={section} ctx={{ user: ctx.user, website: ctx.website, admin, smtp: smtpEnabled(), origin: process.env.NEXTAUTH_URL || "" }} />
          )}
        </div>
      </div>
    </div>
  );
}
