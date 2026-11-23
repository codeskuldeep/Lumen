"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Glass, Reveal } from "@/components/ui/glass";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useApiMutation, useMe } from "@/lib/hooks";

export default function SettingsPage() {
  const me = useMe();
  const [name, setName] = useState(me.data?.agency.name ?? "");
  const [color, setColor] = useState(me.data?.agency.brand_color ?? "#7c5cff");

  const save = useApiMutation(() => api("/auth/agency", { method: "PATCH", body: { name, brand_color: color } }), { invalidate: [["me"]], success: "Settings saved" });
  const prefs = useApiMutation((email_alerts: boolean) => api("/auth/me", { method: "PATCH", body: { email_alerts } }), { invalidate: [["me"]], success: "Preferences updated" });
  const check = useApiMutation(() => api<{ created: number }>("/alerts/check", { method: "POST" }), {
    invalidate: [["alerts"]],
    onSuccess: (r) => import("sonner").then(({ toast }) => toast.success(r.created ? `${r.created} new alert(s)` : "No significant changes this week")),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <Reveal><h1 className="text-3xl font-semibold tracking-tight">Settings</h1></Reveal>

      <Reveal i={1}>
        <Glass className="space-y-5 p-6">
          <div>
            <h2 className="font-semibold">Agency branding</h2>
            <p className="text-sm text-muted">Used on the PDF reports you send to clients.</p>
          </div>
          <Field label="Agency name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Brand colour">
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-11 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-36 font-mono" />
            </div>
          </Field>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>Save changes</Button>
        </Glass>
      </Reveal>

      <Reveal i={2}>
        <Glass className="space-y-5 p-6">
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-sm text-muted">We alert you when a client&apos;s AI visibility moves by 10+ points week over week, and send a summary every Monday.</p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
            <div><div className="text-sm font-medium">Email alerts</div><div className="text-xs text-muted">Emailed to {me.data?.email} when a scan shows visibility moving 10+ points week over week</div></div>
            <Switch checked={me.data?.email_alerts ?? true} onCheckedChange={(v) => prefs.mutate(v)} aria-label="Email alerts" />
          </div>
          <Button variant="glass" onClick={() => check.mutate(undefined)} loading={check.isPending}>Check for changes now</Button>
        </Glass>
      </Reveal>
    </div>
  );
}
