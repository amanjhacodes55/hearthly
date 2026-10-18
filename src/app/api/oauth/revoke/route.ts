import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { OAuthToken } from "@/lib/models";
import { sha256 } from "@/lib/ids";
import { authenticateClient, readForm } from "@/lib/oauthServer";

/** RFC 7009 token revocation (access or refresh token). Always 200 for unknown tokens. */
export async function POST(req: Request) {
  await dbConnect();
  const b = await readForm(req);
  const { app } = await authenticateClient(req, b);
  if (!app) return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  const h = sha256(b.token || "");
  await OAuthToken.updateOne({ app: app._id, $or: [{ accessHash: h }, { refreshHash: h }] }, { revokedAt: new Date() });
  return new NextResponse(null, { status: 200 });
}
