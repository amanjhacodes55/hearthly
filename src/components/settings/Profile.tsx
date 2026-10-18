"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Field } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/client";
import { Card, type SettingsCtx } from "./SettingsSection";

export default function Profile({ ctx }: { ctx: SettingsCtx }) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(ctx.user.name);
  const [image, setImage] = useState(ctx.user.image);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  return (
    <>
      <Card
        title="Your profile"
        description="Visitors see your first name and avatar on your replies."
        footer={
          <button className="btn-primary" onClick={async () => { try { await api("/api/me", { method: "PATCH", json: { name, image } }); toast("Profile saved"); router.refresh(); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
            Save
          </button>
        }
      >
        <div className="flex items-start gap-5">
          <Avatar name={name} image={image} size={64} />
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" value={ctx.user.email} disabled />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Avatar URL (https)">
                <input className="input" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
              </Field>
            </div>
          </div>
        </div>
      </Card>
      <Card
        title="Password"
        footer={
          <button className="btn-primary" disabled={pw.newPassword.length < 8} onClick={async () => { try { await api("/api/me", { method: "PATCH", json: pw }); toast("Password changed"); setPw({ currentPassword: "", newPassword: "" }); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }}>
            Change password
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Current password">
            <input type="password" className="input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <input type="password" className="input" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
        </div>
      </Card>
    </>
  );
}
