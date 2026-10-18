import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/models";
import { err, handleError, json, zodMessage, clientIp } from "@/lib/api";
import { takeToken } from "@/lib/rateLimit";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: Request) {
  if (!takeToken(`register:${clientIp(req)}`, 5, 5 / 3600).ok) return err("Too many sign-ups from this address, try later.", 429);
  try {
    const p = schema.safeParse(await req.json().catch(() => ({})));
    if (!p.success) return err(zodMessage(p.error));
    await dbConnect();
    if (await User.exists({ email: p.data.email })) return err("An account with this email already exists.", 409);
    const u = await User.create({ name: p.data.name, email: p.data.email, passwordHash: await bcrypt.hash(p.data.password, 10), providers: ["credentials"] });
    return json({ id: String(u._id) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
