import { z } from "zod";

export const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  data: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
  external_id: z.string().trim().max(100).optional(),
});

