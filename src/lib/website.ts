import "server-only";
import { DEFAULT_WIDGET, User, Website } from "@/lib/models";
import { newPublicId, seedSample } from "@/lib/sample";
import { rand } from "@/lib/ids";

export async function createWebsite(userId: string, o: { name: string; domain?: string; sample?: boolean; publicId?: string; demo?: boolean }) {
  const site = await Website.create({
    name: o.name,
    domain: o.domain || "",
    publicId: o.publicId || newPublicId(),
    members: [{ user: userId, role: "owner" }],
    widget: { ...DEFAULT_WIDGET, title: `Chat with ${o.name}` },
    identitySecret: rand(24),
    demo: Boolean(o.demo),
  });
  await User.updateOne({ _id: userId }, { currentWebsite: site._id });
  if (o.sample) {
    const u = await User.findById(userId).select("name").lean();
    await seedSample(String(site._id), userId, u?.name || "Agent");
  }
  return site;
}
