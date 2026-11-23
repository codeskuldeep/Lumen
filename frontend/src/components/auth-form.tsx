"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokenStore } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Glass, Reveal } from "@/components/ui/glass";
import { Field, Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const signup = mode === "signup";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ token: string; user: User }>(signup ? "/auth/signup" : "/auth/login", { method: "POST", body: f });
      tokenStore.set(res.token);
      qc.setQueryData(["me"], res.user);
      router.replace("/dashboard");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Reveal>
      <Glass className="p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Create your agency account" : "Welcome back"}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">{signup ? "Start tracking AI visibility for your clients." : "Sign in to your dashboard."}</p>
        <form onSubmit={submit} className="space-y-4">
          {signup && (
            <>
              <Field label="Agency name"><Input name="agency_name" required minLength={2} placeholder="Northwind Digital" /></Field>
              <Field label="Your name"><Input name="name" required placeholder="Alex Morgan" /></Field>
            </>
          )}
          <Field label="Email"><Input name="email" type="email" required autoComplete="email" placeholder="you@agency.com" /></Field>
          <Field label="Password" hint={signup ? "At least 8 characters" : undefined}>
            <Input name="password" type="password" required minLength={signup ? 8 : 1} autoComplete={signup ? "new-password" : "current-password"} placeholder="••••••••" />
          </Field>
          {!signup && <div className="-mt-2 text-right text-xs"><Link href="/forgot-password" className="text-muted hover:text-fg">Forgot password?</Link></div>}
          {err && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>{signup ? "Create account" : "Sign in"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {signup ? "Already have an account? " : "New here? "}
          <Link href={signup ? "/login" : "/signup"} className="font-medium text-accent hover:underline">{signup ? "Sign in" : "Create an account"}</Link>
        </p>
      </Glass>
    </Reveal>
  );
}
