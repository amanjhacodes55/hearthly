import { dbConnect } from "@/lib/db";
import { DEFAULT_WIDGET, User } from "@/lib/models";
import { loadSiteByPublicId, siteStatus } from "@/lib/chat";
import { options, rateLimited, werr, wjson } from "@/lib/widgetApi";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Public widget configuration for a website id (no secrets). */
export async function GET(req: Request) {
  const limited = rateLimited(req, "config", 60, 2);
  if (limited) return limited;
  try {
    const id = new URL(req.url).searchParams.get("website") || "";
    if (!/^[a-z0-9_-]{3,40}$/i.test(id)) return werr("Invalid website id", 400);
    await dbConnect();
    const site = await loadSiteByPublicId(id);
    if (!site) return werr("Unknown website", 404);
    const users = await User.find({ _id: { $in: site.members.map((m) => m.user) } }).select("name image").limit(5).lean();
    const w = { ...DEFAULT_WIDGET, ...(site.widget || {}) };
    const status = siteStatus(site);
    return wjson({
      website: { id: site.publicId, name: site.name, logo: site.logo || "" },
      widget: w,
      team: w.showTeam ? users.map((u) => ({ name: u.name.split(" ")[0], avatar: u.image || "" })) : [],
      status: { online: status.online, withinHours: status.withinHours, offlineMessage: site.availability?.offlineMessage || "" },
      help: `/help/${site.publicId}`,
    });
  } catch (e) {
    const r = handleError(e);
    return wjson(await r.json(), r.status);
  }
}
