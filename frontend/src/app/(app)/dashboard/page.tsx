"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Building2, FileText, Plus } from "lucide-react";
import { ClientForm } from "@/components/client-form";
import { Ring } from "@/components/charts/visibility-ring";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Badge, Empty, Glass, Reveal, Skeleton } from "@/components/ui/glass";
import { api } from "@/lib/api";
import { useApiMutation, useClients, useMe, usePlan } from "@/lib/hooks";
import type { Client } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const me = useMe();
  const clients = useClients();
  const plan = usePlan();
  const [open, setOpen] = useState(false);

  const create = useApiMutation((d: unknown) => api<Client>("/clients", { method: "POST", body: d }), {
    invalidate: [["clients"], ["plan"]], success: "Client added",
    onSuccess: (c) => { setOpen(false); router.push(`/clients/${c.id}`); },
  });

  const p = plan.data;
  const atLimit = p ? p.usage.clients >= p.limits.clients : false;

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Welcome back, {me.data?.name.split(" ")[0]}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Your clients</h1>
        </div>
        <Button onClick={() => setOpen(true)} disabled={atLimit}><Plus className="size-4" /> Add client</Button>
      </Reveal>

      {p && (
        <Reveal i={1}>
          <Glass className="grid gap-5 p-5 sm:grid-cols-3">
            {([["Plan", null], ["Clients", "clients"], ["Prompts", "prompts"]] as const).map(([label, k]) => (
              <div key={label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  {k ? <span className="font-medium">{p.usage[k]} / {p.limits[k]}</span> : <Badge tone="good">Free forever</Badge>}
                </div>
                {k && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (p.usage[k] / p.limits[k]) * 100)}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
                  </div>
                )}
              </div>
            ))}
          </Glass>
        </Reveal>
      )}

      {clients.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : clients.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.data.map((c, i) => (
            <Reveal key={c.id} i={i + 2}>
              <Link href={`/clients/${c.id}`} className="block">
                <Glass hover className="group p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold">{c.name}</h3>
                      <p className="truncate text-sm text-muted">{c.domain || c.industry || "—"}</p>
                    </div>
                    <Ring value={c.visibility ?? null} />
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-muted">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5"><FileText className="size-3.5" />{c.prompt_count ?? 0} prompts</span>
                      <span className="flex items-center gap-1.5"><Building2 className="size-3.5" />{c.competitors.length} rivals</span>
                    </span>
                    <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Glass>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : (
        <Glass><Empty icon={<Building2 className="size-6" />} title="Add your first client" body="Add a brand and its competitors, then choose the questions customers ask AI." action={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add client</Button>} /></Glass>
      )}

      <Modal open={open} onOpenChange={setOpen} title="Add a client" description="Who should we track across AI engines?" className="max-w-xl">
        <ClientForm submitLabel="Create client" busy={create.isPending} onSubmit={(d) => create.mutate({ ...d, domain: d.domain || null, industry: d.industry || null })} />
      </Modal>
    </div>
  );
}
