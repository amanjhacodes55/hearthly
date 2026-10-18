import "server-only";
import nodemailer from "nodemailer";

export const smtpEnabled = () => Boolean(process.env.SMTP_URL);
let transport: nodemailer.Transporter | null = null;

/** Sends through SMTP_URL when configured; otherwise logs the email (so flows still work in dev/demo). */
export async function sendMail(m: { to: string; subject: string; text: string; html?: string; replyTo?: string }) {
  if (!process.env.SMTP_URL) {
    console.log(`[mail] SMTP_URL not set — would send to ${m.to}: "${m.subject}"\n${m.text.slice(0, 2000)}`);
    return { logged: true as const };
  }
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.SMTP_FROM || "Hearthly <no-reply@hearthly.local>", ...m });
  return { sent: true as const };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
