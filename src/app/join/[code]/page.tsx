import { redirect } from "next/navigation";
import { getCtx } from "@/lib/context";
import { dbConnect } from "@/lib/db";
import { Invite, Website } from "@/lib/models";
import JoinButton from "@/components/JoinButton";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join team" };

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await getCtx();
  if (!ctx) redirect(`/register?next=${encodeURIComponent(`/join/${code}`)}`);
  await dbConnect();
  const inv = await Invite.findOne({ code, expiresAt: { $gt: new Date() } }).lean();
  const site = inv ? await Website.findById(inv.website).select("name").lean() : null;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-7 text-center">
        <Logo className="justify-center" />
        {site ? (
          <>
            <h1 className="h-display mt-6 text-2xl font-bold">Join {site.name}</h1>
            <p className="mt-2 text-sm text-muted">
              You&apos;ve been invited as <b>{inv!.role}</b>. You&apos;re signed in as {ctx.user.email}.
            </p>
            <JoinButton code={code} />
          </>
        ) : (
          <p className="mt-6 font-semibold text-danger">This invite link is invalid or has expired.</p>
        )}
      </div>
    </div>
  );
}
