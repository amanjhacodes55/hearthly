import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ContactPanel from "@/components/ContactPanel";
import ContactActions from "@/components/pages/ContactActions";
import { requireCtx, canAdmin } from "@/lib/context";

export const metadata = { title: "Contact" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/app/contacts" className="btn-ghost btn-sm">
          <ArrowLeft className="size-4" /> Contacts
        </Link>
        <ContactActions id={id} canDelete={canAdmin(ctx.website.role)} />
      </div>
      <div className="card overflow-hidden">
        <ContactPanel contactId={id} compact />
      </div>
    </div>
  );
}
