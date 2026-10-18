import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Article, Category, Website } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  await dbConnect();
  const site = await Website.findOne({ publicId: websiteId }).select("name").lean();
  return { title: site ? `${site.name} Help Center` : "Help Center" };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function Help({ params, searchParams }: { params: Promise<{ websiteId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { websiteId } = await params;
  const { q = "" } = await searchParams;
  await dbConnect();
  const site = await Website.findOne({ publicId: websiteId }).select("_id name").lean();
  if (!site) notFound();
  const term = q.trim().slice(0, 100);
  const [cats, arts] = await Promise.all([
    Category.find({ website: site._id }).sort({ order: 1 }).lean(),
    Article.find({ website: site._id, published: true, ...(term ? { $or: [{ title: { $regex: esc(term), $options: "i" } }, { body: { $regex: esc(term), $options: "i" } }] } : {}) })
      .select("title slug excerpt category views")
      .sort({ views: -1 })
      .lean(),
  ]);
  return (
    <div>
      <h1 className="h-display text-3xl font-bold">How can we help?</h1>
      <form className="mt-5" role="search">
        <input name="q" defaultValue={term} className="input py-3 text-base" placeholder="Search articles…" aria-label="Search articles" />
      </form>
      {term ? (
        <section className="mt-8">
          <p className="text-sm text-muted">
            {arts.length} result{arts.length === 1 ? "" : "s"} for “{term}”
          </p>
          <ul className="mt-3 space-y-2">
            {arts.map((a) => (
              <li key={String(a._id)}>
                <Link href={`/help/${websiteId}/${a.slug}`} className="card block p-4 hover:border-brand">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-sm text-muted">{a.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {[...cats, { _id: null, name: "More articles", icon: "📄", description: "", slug: "" }].map((c) => {
            const list = arts.filter((a) => (c._id ? String(a.category) === String(c._id) : !cats.some((x) => String(x._id) === String(a.category))));
            if (!list.length) return null;
            return (
              <section key={String(c._id)} className="card p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <span>{c.icon}</span> {c.name}
                </h2>
                {c.description && <p className="text-sm text-muted">{c.description}</p>}
                <ul className="mt-3 space-y-1.5">
                  {list.map((a) => (
                    <li key={String(a._id)}>
                      <Link href={`/help/${websiteId}/${a.slug}`} className="text-sm font-medium text-brand hover:underline">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
