"use client";
import { CheckCircle2, MailWarning } from "lucide-react";
import { Card, type SettingsCtx } from "./SettingsSection";
import { CodeBlock } from "./WebsiteSettings";

export default function EmailSettings({ ctx }: { ctx: SettingsCtx }) {
  return (
    <Card title="Email delivery" description="Used for conversation transcripts, email campaigns, invite links and reply notifications to offline visitors.">
      {ctx.smtp ? (
        <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm">
          <CheckCircle2 className="size-4 text-success" /> SMTP is configured via <code className="kbd">SMTP_URL</code>. Emails are sent for real.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-warn/10 p-3 text-sm">
          <MailWarning className="size-4 text-warn" /> SMTP isn&apos;t configured — emails are written to the server log instead, so every flow still works.
        </p>
      )}
      <div className="mt-4">
        <CodeBlock
          label="Configure (environment variables)"
          code={`SMTP_URL=smtps://USER:PASSWORD@smtp.example.com:465
SMTP_FROM="Acme Support <support@acme.com>"`}
        />
      </div>
    </Card>
  );
}
