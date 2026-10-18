import { requireCtx } from "@/lib/context";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
