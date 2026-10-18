import { Suspense } from "react";
import { requireCtx } from "@/lib/context";
import Inbox from "@/components/inbox/Inbox";

export const metadata = { title: "Inbox" };

export default async function Page() {
  const ctx = await requireCtx("/app/inbox");
  return (
    <Suspense>
      <Inbox me={{ id: ctx.user.id, name: ctx.user.name }} website={{ id: ctx.website.id, name: ctx.website.name, publicId: ctx.website.publicId }} />
    </Suspense>
  );
}
