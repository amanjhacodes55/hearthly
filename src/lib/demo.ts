import "server-only";
import { dbConnect } from "@/lib/db";
import { User, Website } from "@/lib/models";
import { createWebsite } from "@/lib/website";

export const DEMO_PUBLIC_ID = process.env.DEMO_WEBSITE_ID || "demo";
let pending: Promise<unknown> | null = null;

/** Lazily create the public demo workspace (owned by a system user that cannot sign in). */
export async function ensureDemoSite() {
  await dbConnect();
  if (await Website.exists({ publicId: DEMO_PUBLIC_ID })) return DEMO_PUBLIC_ID;
  pending ??= (async () => {
    const owner = (await User.findOne({ email: "demo-owner@chatcrip.example.test" })) || (await User.create({ name: "Avery (demo)", email: "demo-owner@chatcrip.example.test", providers: ["system"] }));
    await createWebsite(String(owner._id), { name: "Nimbus Notes", domain: "demo", sample: true, publicId: DEMO_PUBLIC_ID, demo: true });
    await Website.updateOne(
      { publicId: DEMO_PUBLIC_ID },
      { "widget.welcome": "Hi! 👋 This is a live ChatCrip demo. Send a message, drop a file, or pick a topic below.", "widget.title": "Nimbus Notes support", "rules.offlineAutoReply": true, "rules.botEnabled": true },
    );
  })().finally(() => (pending = null));
  await pending;
  return DEMO_PUBLIC_ID;
}
