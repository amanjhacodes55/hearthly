import KnowledgeBase from "@/components/pages/KnowledgeBase";
import { requireCtx } from "@/lib/context";
export const metadata = { title: "Help center" };
export default async function Page() {
  const ctx = await requireCtx();
  return <KnowledgeBase publicId={ctx.website.publicId} />;
}
