import { SOURCE_URL } from "@/lib/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Website } from "@/lib/models";
import { LogoMark } from "@/components/ui";

export default async function HelpLayout({ children, params }: { children: React.ReactNode; params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  await dbConnect();
  const site = await Website.findOne({ publicId: websiteId }).select("name widget.color").lean();
  if (!site) notFound();
  const color = (site.widget as { color?: string })?.color || "#c2410c";
  return (
    <div className="min-h-screen bg-bg">
      <header className="text-white" style={{ background: `linear-gradient(135deg, ${color}, #1a1123)` }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-5">
          <Link href={`/help/${websiteId}`} className="text-lg font-bold">
            {site.name} <span className="font-normal opacity-75">Help Center</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10">{children}</main>
      <footer className="flex items-center justify-center gap-2 py-8 text-xs text-faint">
        <LogoMark size={16} /> Help center by Hearthly ·{" "}
        <a href={SOURCE_URL} className="underline-offset-2 hover:underline">
          source code
        </a>
      </footer>
    </div>
  );
}
