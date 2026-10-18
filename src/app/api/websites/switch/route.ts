import { z } from "zod";
import { route, json, body, err } from "@/lib/api";
import { User, Website } from "@/lib/models";

export const POST = route(async (req, ctx) => {
  const { id } = await body(req, z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }));
  if (!(await Website.exists({ _id: id, "members.user": ctx.user.id }))) return err("Not a member of that website", 403);
  await User.updateOne({ _id: ctx.user.id }, { currentWebsite: id });
  return json({ ok: true });
}, { noWebsite: true });
