"use client";
import { Download } from "lucide-react";
import { Card } from "./SettingsSection";

export default function DataExport() {
  return (
    <Card title="Export your data" description="Your data is yours. Download everything at any time — no lock-in.">
      <div className="flex flex-wrap gap-3">
        <a className="btn-primary" href="/api/export">
          <Download className="size-4" /> Full export (JSON)
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from an API route */}
        <a className="btn-outline" href="/api/contacts/export">
          <Download className="size-4" /> Contacts (CSV)
        </a>
      </div>
      <p className="mt-3 text-xs text-muted">The JSON export contains website settings, contacts, conversations, messages, help-center articles, segments, shortcuts, triggers and campaigns. Attachments are referenced by id.</p>
    </Card>
  );
}
