/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import type { ZodTypeAny } from "zod";
import { route, json, body, err, oid } from "@/lib/api";
import type { Ctx } from "@/lib/context";

type Opts = {
  role?: "admin";
  readRole?: "admin";
  sort?: Record<string, 1 | -1>;
  serialize?: (d: any) => unknown;
  before?: (data: any, ctx: Ctx, existing?: any) => Promise<any> | any;
  after?: (doc: any, ctx: Ctx, kind: "create" | "update" | "delete") => Promise<void> | void;
};

const base = (d: any) => {
  const { _id, ...rest } = d;
  delete rest.website;
  delete rest.__v;
  return { id: String(_id), ...rest };
};

/** Website-scoped CRUD for simple resources (shortcuts, segments, triggers, KB, campaigns). */
export function crud(Model: any, schema: ZodTypeAny & { partial?: () => ZodTypeAny }, o: Opts = {}) {
  const ser = o.serialize || base;
  const partial = (schema as any).partial ? (schema as any).partial() : schema;
  return {
    list: route(async (_req, ctx) => json((await Model.find({ website: ctx.website.id }).sort(o.sort || { createdAt: -1 }).limit(500).lean()).map(ser)), { role: o.readRole }),
    create: route(async (req, ctx) => {
      let data = await body(req, schema);
      if (o.before) data = await o.before(data, ctx);
      const doc = await Model.create({ ...data, website: ctx.website.id });
      await o.after?.(doc.toObject(), ctx, "create");
      return json(ser(doc.toObject()), 201);
    }, { role: o.role }),
    get: route<{ id: string }>(async (_req, ctx, { id }) => {
      const d = await Model.findOne({ _id: oid(id), website: ctx.website.id }).lean();
      return d ? json(ser(d)) : err("Not found", 404);
    }, { role: o.readRole }),
    update: route<{ id: string }>(async (req, ctx, { id }) => {
      let data = await body(req, partial);
      const existing = await Model.findOne({ _id: oid(id), website: ctx.website.id }).lean();
      if (!existing) return err("Not found", 404);
      if (o.before) data = await o.before(data, ctx, existing);
      const d = await Model.findByIdAndUpdate(existing._id, { $set: data }, { new: true }).lean();
      await o.after?.(d, ctx, "update");
      return json(ser(d));
    }, { role: o.role }),
    remove: route<{ id: string }>(async (_req, ctx, { id }) => {
      const d = await Model.findOneAndDelete({ _id: oid(id), website: ctx.website.id }).lean();
      if (!d) return err("Not found", 404);
      await o.after?.(d, ctx, "delete");
      return json({ ok: true });
    }, { role: o.role }),
  };
}
