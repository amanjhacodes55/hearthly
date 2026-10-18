import "server-only";
import { dbConnect } from "@/lib/db";
import { Conversation, Website } from "@/lib/models";
import { processDueDeliveries } from "@/lib/webhooks";
import { setConversationStatus } from "@/lib/chat";
import { publish } from "@/lib/bus";

const g = globalThis as unknown as { _ccScheduler?: boolean };

/** In-app job loop (single instance): webhook retries every 15s; snooze wake-ups + auto-resolve every 2 min. */
export function startScheduler() {
  if (g._ccScheduler || process.env.CHATCRIP_DISABLE_SCHEDULER === "1") return;
  g._ccScheduler = true;
  if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET)
    console.warn("[chatcrip] NEXTAUTH_SECRET is not set — using an insecure built-in default. Set it (Render generates one from render.yaml).");
  const safe = (name: string, fn: () => Promise<void>) => async () => {
    try {
      await dbConnect();
      await fn();
    } catch (e) {
      console.error(`[scheduler] ${name} failed:`, e instanceof Error ? e.message : e);
    }
  };
  setInterval(safe("webhooks", processDueDeliveries), 15_000).unref();
  setInterval(safe("conversations", conversationJobs), 120_000).unref();
  setTimeout(safe("conversations", conversationJobs), 10_000).unref();
  console.log("[scheduler] started");
}

export async function conversationJobs() {
  const due = await Conversation.find({ snoozedUntil: { $lte: new Date() } }).select("website contact").limit(200).lean();
  for (const c of due) {
    await Conversation.updateOne({ _id: c._id }, { snoozedUntil: null, status: "open", $inc: { unreadAgent: 1 } });
    publish(`site:${c.website}`, "conversation.woke", { id: String(c._id) });
  }
  const sites = await Website.find({ "rules.autoResolveDays": { $gt: 0 } }).lean();
  for (const s of sites) {
    const cutoff = new Date(Date.now() - (s.rules!.autoResolveDays as number) * 86400_000);
    const stale = await Conversation.find({ website: s._id, status: { $ne: "resolved" }, updatedAt: { $lt: cutoff }, snoozedUntil: null }).select("_id").limit(200).lean();
    for (const c of stale) await setConversationStatus(s, String(c._id), "resolved", "auto-resolve");
  }
}
