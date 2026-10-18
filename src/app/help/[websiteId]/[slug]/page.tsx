import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Article, Category, Website } from "@/lib/models";
import { Markdown } from "@/components/Markdown";

export const dynamic = "force-dynamic";

async function load(websiteId: string, slug: string) {
  await dbConnect();
  const site = await Website.findOne({ publicId: websiteId }).select("_id name publicId").lean();
  if (!site) return null;
  const art = await Article.findOneAndUpdate({ website: site._id, slug, published: true }, { $inc: { views: 1 } }, { new: true }).lean();
  return art ? { site, art } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ websiteId: string; slug: string }> }) {
  const { websiteId, slug } = await params;
  await dbConnect();
  const site = await Website.findOne({ publicId: websiteId }).select("_id name").lean();
  const art = site ? await Article.findOne({ website: site._id, slug }).select("title excerpt").lean() : null;
  return { title: art ? `${art.title} · ${site!.name}` : "Article", description: art?.excerpt };
}

export default async function ArticlePage({ params }: { params: Promise<{ websiteId: string; slug: string }> }) {
  const { websiteId, slug } = await params;
  const r = await load(websiteId, slug);
  if (!r) notFound();
  const cat = r.art.category ? await Category.findById(r.art.category).select("name icon").lean() : null;
  return (
    <article>
      <nav className="text-sm text-muted">
        <Link href={`/help/${websiteId}`} className="hover:text-brand">
          Help Center
        </Link>
        {cat && (
          <>
            {" "}
            / {cat.icon} {cat.name}
          </>
        )}
      </nav>
      <h1 className="h-display mt-3 text-4xl font-bold">{r.art.title}</h1>
      <p className="mt-2 text-sm text-faint">Updated {new Date(r.art.updatedAt!).toLocaleDateString()}</p>
      <div className="card mt-8 p-6 md:p-8">
        <Markdown source={r.art.body || ""} />
      </div>
      <p className="mt-8 text-sm text-muted">Still stuck? Use the chat bubble in the corner — we&apos;re happy to help.</p>
      <Script src="/widget.js" data-website={r.site.publicId} strategy="afterInteractive" />
    </article>
  );
}
