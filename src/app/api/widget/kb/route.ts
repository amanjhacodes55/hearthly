import { dbConnect } from "@/lib/db";
import { Article } from "@/lib/models";
import { loadSiteByPublicId } from "@/lib/chat";
import { options, rateLimited, werr, wjson } from "@/lib/widgetApi";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Help-center search from inside the widget. */
export async function GET(req: Request) {
  const limited = rateLimited(req, "kb", 30, 1);
  if (limited) return limited;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 100);
  await dbConnect();
  const site = await loadSiteByPublicId(sp.get("website") || "");
  if (!site) return werr("Unknown website", 404);
  const base = { website: site._id, published: true };
  const list = q
    ? await Article.find({ ...base, $or: [{ title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { body: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] }).limit(6).select("title slug excerpt").lean()
    : await Article.find(base).sort({ views: -1 }).limit(5).select("title slug excerpt").lean();
  return wjson({ articles: list.map((a) => ({ title: a.title, excerpt: a.excerpt, url: `/help/${site.publicId}/${a.slug}` })) });
}
