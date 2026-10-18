import "server-only";
import mongoose from "mongoose";
import { Readable } from "node:stream";
import { dbConnect } from "@/lib/db";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** MIME allowlist → permitted extensions. No SVG/HTML (script injection), no executables. */
export const ALLOWED: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "text/plain": ["txt", "log", "md"],
  "text/csv": ["csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
};
const BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(ALLOWED).flatMap(([t, exts]) => exts.map((e) => [e, t])));

/** Magic-number sniffing so a renamed .exe can't pass as a PNG. */
function sniff(buf: Buffer, type: string) {
  const hex = buf.subarray(0, 8).toString("hex");
  if (type === "image/png") return hex.startsWith("89504e47");
  if (type === "image/jpeg") return hex.startsWith("ffd8ff");
  if (type === "image/gif") return hex.startsWith("47494638");
  if (type === "image/webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  if (type === "application/pdf") return buf.subarray(0, 5).toString() === "%PDF-";
  if (type.includes("zip") || type.includes("openxmlformats")) return hex.startsWith("504b0304") || hex.startsWith("504b0506");
  if (type.startsWith("text/")) return !buf.subarray(0, 4096).includes(0);
  return false;
}

export function validateUpload(name: string, declaredType: string, buf: Buffer) {
  if (buf.length === 0) return "File is empty";
  if (buf.length > MAX_FILE_BYTES) return "File is larger than 10 MB";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const type = BY_EXT[ext];
  if (!type) return `.${ext} files aren't allowed`;
  if (declaredType && declaredType !== "application/octet-stream" && !ALLOWED[declaredType]?.includes(ext) && !(declaredType.includes("zip") && ext === "zip")) return "File type doesn't match its extension";
  if (!sniff(buf, type)) return "File contents don't match its type";
  return null;
}
export const typeForName = (name: string) => BY_EXT[(name.split(".").pop() || "").toLowerCase()] || "application/octet-stream";

async function bucket() {
  await dbConnect();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "attachments" });
}

export function cleanName(name: string) {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(-120) || "file";
}

export async function saveFile(buf: Buffer, name: string, meta: { website: string; conversation?: string; uploader: string }) {
  const b = await bucket();
  const filename = cleanName(name);
  const contentType = typeForName(filename);
  const up = b.openUploadStream(filename, { metadata: { ...meta, contentType } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buf).pipe(up).on("finish", () => resolve()).on("error", reject);
  });
  return { id: String(up.id), name: filename, size: buf.length, type: contentType };
}

export async function findFile(id: string) {
  const b = await bucket();
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const [f] = await b.find({ _id: new mongoose.Types.ObjectId(id) }).toArray();
  return f ? { file: f, stream: () => b.openDownloadStream(f._id) } : null;
}

/** Read a multipart upload into a Buffer with a hard size cap. */
export async function readUpload(req: Request) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_FILE_BYTES + 64 * 1024) return { error: "File is larger than 10 MB" } as const;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !file || typeof file === "string") return { error: "No file uploaded (field name: file)" } as const;
  const buf = Buffer.from(await file.arrayBuffer());
  const problem = validateUpload(file.name, file.type, buf);
  if (problem) return { error: problem } as const;
  return { buf, name: file.name, form } as const;
}
