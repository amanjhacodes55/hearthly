import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import DevApps from "@/components/dev/DevApps";

export const metadata = { title: "Developers" };

export default async function Page() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login?next=/developers");
  return <DevApps />;
}
