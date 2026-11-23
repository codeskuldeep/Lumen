"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Glass, Reveal } from "@/components/ui/glass";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <Reveal>
      <Glass className="p-8">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-good/12 text-good"><MailCheck className="size-6" /></div>
            <h1 className="text-xl font-semibold">Check your inbox</h1>
            <p className="text-sm text-muted">If an account exists for that email, a reset link is on its way. It&apos;s valid for 30 minutes.</p>
            <Link href="/login" className="mt-2 text-sm font-medium text-accent hover:underline">Back to sign in</Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mb-6 mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a reset link.</p>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault(); setBusy(true); setErr("");
              try { await api("/auth/forgot", { method: "POST", body: { email: new FormData(e.currentTarget).get("email") } }); setSent(true); }
              catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
            }}>
              <Field label="Email"><Input name="email" type="email" required placeholder="you@agency.com" /></Field>
              {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></p>
          </>
        )}
      </Glass>
    </Reveal>
  );
}
