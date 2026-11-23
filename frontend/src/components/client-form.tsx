"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { Client, Competitor } from "@/lib/types";

export type ClientDraft = { name: string; domain: string; industry: string; aliases: string[]; competitors: Competitor[] };

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function ClientForm({ initial, submitLabel, busy, onSubmit }: {
  initial?: Client; submitLabel: string; busy?: boolean; onSubmit: (d: ClientDraft) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [aliases, setAliases] = useState((initial?.aliases ?? []).join(", "));
  const [comps, setComps] = useState<{ name: string; domain: string }[]>(
    initial?.competitors.map((c) => ({ name: c.name, domain: c.domain ?? "" })) ?? [{ name: "", domain: "" }],
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: name.trim(), domain: domain.trim(), industry: industry.trim(), aliases: split(aliases),
          competitors: comps.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), domain: c.domain.trim() || null, aliases: [] })),
        });
      }}
    >
      <Field label="Brand name"><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Dental" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website"><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acmedental.com" /></Field>
        <Field label="Industry"><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="dental clinics in Austin" /></Field>
      </div>
      <Field label="Also known as" hint="Comma separated alternative names or spellings">
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Acme, Acme Dentistry" />
      </Field>
      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Competitors</span>
        {comps.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input value={c.name} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Competitor name" />
            <Input value={c.domain} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, domain: e.target.value } : x)))} placeholder="domain.com" className="hidden sm:block" />
            <Button type="button" variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => setComps(comps.filter((_, j) => j !== i))} aria-label="Remove"><X className="size-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="glass" size="sm" onClick={() => setComps([...comps, { name: "", domain: "" }])}><Plus className="size-4" /> Add competitor</Button>
      </div>
      <Button type="submit" loading={busy} className="w-full" size="lg">{submitLabel}</Button>
    </form>
  );
}
