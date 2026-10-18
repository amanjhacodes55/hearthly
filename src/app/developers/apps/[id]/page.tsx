import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import AppDetail from "@/components/dev/AppDetail";

export const metadata = { title: "OAuth app" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx) redirect(`/login?next=/developers/apps/${id}`);
  return <AppDetail id={id} />;
}
