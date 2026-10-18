import "server-only";
import { z } from "zod";
import { Types } from "mongoose";
import { Segment } from "@/lib/models";
import { filterSchema, segmentToQuery, type SegmentFilter } from "@/lib/segments";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Build the contact query from ?q, ?tag, ?segment (saved) or ?filters (ad-hoc JSON) + ?match. */
export async function contactQuery(websiteId: string, sp: URLSearchParams) {
  const q: Record<string, unknown> = { website: new Types.ObjectId(websiteId), mergedInto: null };
  const and: Record<string, unknown>[] = [];
  const term = (sp.get("q") || "").trim().slice(0, 100);
  if (term) {
    const rx = { $regex: esc(term), $options: "i" };
    and.push({ $or: [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }] });
  }
  if (sp.get("tag")) q.tags = sp.get("tag");
  if (sp.get("identified") === "1") and.push({ email: { $nin: ["", null] } });
  const segId = sp.get("segment");
  if (segId && /^[a-f0-9]{24}$/.test(segId)) {
    const seg = await Segment.findOne({ _id: segId, website: websiteId }).lean();
    if (seg) and.push(segmentToQuery({ match: seg.match as "all" | "any", filters: seg.filters as SegmentFilter[] }));
  }
  const raw = sp.get("filters");
  if (raw) {
    const parsed = z.array(filterSchema).max(20).safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error("Invalid filters");
    and.push(segmentToQuery({ match: sp.get("match") === "any" ? "any" : "all", filters: parsed.data }));
  }
  const nonEmpty = and.filter((x) => Object.keys(x).length);
  if (nonEmpty.length) q.$and = nonEmpty;
  return q;
}

export const contactInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200).or(z.literal("")).default(""),
  name: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  company: z.string().trim().max(100).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  data: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).default({}),
});

