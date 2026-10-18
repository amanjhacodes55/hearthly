import { z } from "zod";
import { route, json, body, err, oid } from "@/lib/api";
import { Contact } from "@/lib/models";
import { loadSite } from "@/lib/chat";
import { identifyContact } from "@/lib/visitor";
import { sContact } from "@/lib/serialize";

/** Merge every other contact sharing this contact's email into it (conversations, page views, tags). */
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  await body(req, z.object({}).passthrough());
  const c = await Contact.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  const site = await loadSite(ctx.website.id);
  if (!c || !site) return err("Contact not found", 404);
  if (!c.email) return err("This contact has no email to merge on");
  // Clear email locally so identifyContact treats it as a (trusted) new identification and folds duplicates in.
  const updated = await identifyContact(site, { ...c, email: "" }, { email: c.email }, true);
  return json(sContact(updated));
});
