"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Glass, Reveal } from "@/components/ui/glass";
import { Field, Input } from "@/components/ui/input";
import { api, tokenStore } from "@/lib/api";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <Reveal>
      <Glass className="p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mb-6 mt-1 text-sm text-muted">You&apos;ll be signed in right after.</p>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (f.get("password") !== f.get("confirm")) return setErr("Passwords don't match");
          setBusy(true); setErr("");
          try {
            const r = await api<{ token: string }>("/auth/reset", { method: "POST", body: { token, password: f.get("password") } });
            tokenStore.set(r.token);
            router.replace("/dashboard");
          } catch (e) { setErr((e as Error).message); setBusy(false); }
        }}>
          <Field label="New password" hint="At least 8 characters"><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><Input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></Field>
          {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!token}>Update password</Button>
        </form>
      </Glass>
    </Reveal>
  );
}

export default function ResetPassword() { return <Suspense><Form /></Suspense>; }
