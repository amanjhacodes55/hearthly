import { z } from "zod";
import { route, json, body, err, oid } from "@/lib/api";
import { Conversation } from "@/lib/models";
import { loadSite, postMessage } from "@/lib/chat";
import { findFile } from "@/lib/files";

const att = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), name: z.string().max(200), size: z.number(), type: z.string().max(120) });
const schema = z.object({ text: z.string().max(5000).default(""), note: z.boolean().default(false), attachments: z.array(att).max(5).default([]) });

/** Operator reply (or private internal note). */
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const b = await body(req, schema);
  if (!b.text.trim() && !b.attachments.length) return err("Message is empty");
  const site = await loadSite(ctx.website.id);
  const conv = await Conversation.findOne({ _id: oid(id), website: ctx.website.id }).lean();
  if (!conv || !site) return err("Conversation not found", 404);
  for (const a of b.attachments) {
    const f = await findFile(a.id);
    if (!f || f.file.metadata?.website !== ctx.website.id) return err("Unknown attachment");
  }
  if (!conv.assignee && !b.note) await Conversation.updateOne({ _id: conv._id }, { assignee: ctx.user.id });
  const r = await postMessage({ site, conv, from: b.note ? "note" : "operator", author: { id: ctx.user.id, name: ctx.user.name, avatar: ctx.user.image }, text: b.text.trim(), attachments: b.attachments });
  return json(r.message, 201);
});
