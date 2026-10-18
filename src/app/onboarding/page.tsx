import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import Onboarding from "@/components/Onboarding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your website" };

export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const ctx = await getCtx();
  if (!ctx) redirect("/login?next=/onboarding");
  const sp = await searchParams;
  if (ctx.website.id && !sp.new) redirect("/app");
  return <Onboarding name={ctx.user.name} />;
}
