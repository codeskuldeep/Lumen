"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientForm } from "@/components/client-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Glass } from "@/components/ui/glass";
import { api } from "@/lib/api";
import { useApiMutation } from "@/lib/hooks";
import type { Client } from "@/lib/types";

export function ClientSettings({ client }: { client: Client }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const save = useApiMutation((d: unknown) => api(`/clients/${client.id}`, { method: "PATCH", body: d }), { invalidate: [["client", client.id], ["clients"]], success: "Client updated" });
  const del = useApiMutation(() => api(`/clients/${client.id}`, { method: "DELETE" }), { invalidate: [["clients"], ["plan"]], success: "Client deleted", onSuccess: () => router.replace("/dashboard") });

  return (
    <div className="max-w-2xl space-y-4">
      <Glass className="p-6"><ClientForm key={client.id + client.competitors.length} initial={client} submitLabel="Save changes" busy={save.isPending} onSubmit={(d) => save.mutate({ ...d, domain: d.domain || null, industry: d.industry || null })} /></Glass>
      <Glass className="flex items-center justify-between gap-4 !border-bad/25 p-5">
        <div><h3 className="font-semibold">Delete client</h3><p className="text-sm text-muted">Removes the client with all prompts and history.</p></div>
        <Button variant="danger" onClick={() => setConfirm(true)}>Delete</Button>
      </Glass>
      <Modal open={confirm} onOpenChange={setConfirm} title={`Delete ${client.name}?`} description="This cannot be undone.">
        <div className="flex justify-end gap-2"><Button variant="glass" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" loading={del.isPending} onClick={() => del.mutate(undefined)}>Delete permanently</Button></div>
      </Modal>
    </div>
  );
}
