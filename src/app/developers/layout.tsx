import Link from "next/link";
import { getCtx } from "@/lib/context";
import AppShell from "@/components/AppShell";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Inside the app shell when signed in; a public frame for the docs otherwise. */
export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx().catch(() => null);
  if (ctx?.website.id) return <AppShell ctx={ctx}>{children}</AppShell>;
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/">
            <Logo />
          </Link>
          <span className="chip">Developers</span>
          <Link href={ctx ? "/onboarding" : "/login?next=/developers"} className="btn-primary btn-sm ml-auto">
            {ctx ? "Finish setup" : "Sign in"}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
