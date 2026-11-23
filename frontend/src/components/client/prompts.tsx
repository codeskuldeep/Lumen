"use client";
import { ClipboardList, Loader2, Play, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Badge, Empty, Glass, Skeleton } from "@/components/ui/glass";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { showScanStarting, useApiMutation, usePrompts, useScan } from "@/lib/hooks";
import type { Prompt, Suggestion } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

export function Prompts({ clientId }: { clientId: number }) {
  const { data, isLoading } = usePrompts(clientId);
  const [text, setText] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const inv = [["prompts", clientId], ["plan"], ["clients"]];

  const add = useApiMutation((prompts: Partial<Suggestion>[]) => api(`/clients/${clientId}/prompts`, { method: "POST", body: { prompts } }), { invalidate: inv });
  const patch = useApiMutation(({ id, ...b }: { id: number } & Partial<Prompt>) => api(`/prompts/${id}`, { method: "PATCH", body: b }), { invalidate: [["prompts", clientId]] });
  const del = useApiMutation((id: number) => api(`/prompts/${id}`, { method: "DELETE" }), { invalidate: inv });
  const qc = useQueryClient();
  const scan = useScan(clientId);
  const busy = new Set((scan.data?.items ?? []).filter((i) => ["pending", "running", "analyzing"].includes(i.status)).map((i) => i.prompt_id));
  const run = useApiMutation((id: number) => api<{ queued: number; prompts: number }>(`/prompts/${id}/run`, { method: "POST" }), {
    onSuccess: (r) => { showScanStarting(qc, clientId, r.queued, r.prompts); toast.info(`Scan started: ${r.queued} answers queued for this prompt`); },
  });

  return (
    <div className="space-y-4">
      <Glass className="flex flex-wrap gap-2 p-3">
        <form className="flex min-w-60 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) { add.mutate([{ text }], { onSuccess: () => setText("") }); } }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. What are the best dentists in Austin?" className="!h-10" />
          <Button type="submit" loading={add.isPending}><Plus className="size-4" /> Add</Button>
        </form>
        <Button variant="glass" onClick={() => setSuggestOpen(true)}><Sparkles className="size-4 text-accent" /> Suggest</Button>
        <Button variant="glass" onClick={() => setBulkOpen(true)}><Upload className="size-4" /> Bulk import</Button>
      </Glass>

      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? (
        <Glass><Empty icon={<ClipboardList className="size-6" />} title="No prompts yet" body="Add the questions customers ask AI, or let us suggest some from the brand and its competitors." action={<Button onClick={() => setSuggestOpen(true)}><Sparkles className="size-4" /> Suggest prompts</Button>} /></Glass>
      ) : (
        <Glass className="divide-y divide-white/8 overflow-hidden !p-0">
          {data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-white/4">
              <Switch checked={p.active} onCheckedChange={(active) => patch.mutate({ id: p.id, active })} aria-label="Active" />
              <div className="min-w-56 flex-1">
                <div className={p.active ? "" : "text-muted line-through"}>{p.text}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {p.category && <Badge>{p.category}</Badge>}
                  {busy.has(p.id) && <Badge tone="accent"><Loader2 className="size-3 animate-spin" /> Running</Badge>}
                  <span>{p.runs ? `${p.runs} answers` : "Not run yet"}</span>{p.last_run && <span>· last {fmtDate(p.last_run)}</span>}
                </div>
              </div>
              <div className="w-20 text-right">{p.runs ? <span className={p.visibility! >= 50 ? "text-good" : p.visibility! > 0 ? "text-amber-300" : "text-bad"}>{p.visibility}%</span> : <span className="text-muted">—</span>}</div>
              <div className="flex gap-1">
                {busy.has(p.id)
                  ? <span className="grid h-9 w-9 place-items-center text-accent" title="Running now" aria-label="Running now"><Loader2 className="size-4 animate-spin" /></span>
                  : <Button variant="ghost" size="icon" disabled={run.isPending && run.variables === p.id} onClick={() => run.mutate(p.id)} aria-label="Run this prompt now" title="Run this prompt now"><Play className="size-4" /></Button>}
                <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)} aria-label="Delete"><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </Glass>
      )}

      <SuggestModal open={suggestOpen} onOpenChange={setSuggestOpen} clientId={clientId} onAdd={(s) => add.mutate(s, { onSuccess: () => { setSuggestOpen(false); toast.success(`Added ${s.length} prompts`); } })} busy={add.isPending} />

      <Modal open={bulkOpen} onOpenChange={setBulkOpen} title="Bulk import prompts" description="One prompt per line. Paste from a spreadsheet or CSV column.">
        <BulkForm busy={add.isPending} onSubmit={(lines) => add.mutate(lines.map((t) => ({ text: t })), { onSuccess: () => { setBulkOpen(false); toast.success(`Imported ${lines.length} prompts`); } })} />
      </Modal>
    </div>
  );
}

function BulkForm({ onSubmit, busy }: { onSubmit: (l: string[]) => void; busy: boolean }) {
  const [v, setV] = useState("");
  const lines = [...new Set(v.split("\n").map((l) => l.replace(/^["'\s]+|["'\s,]+$/g, "")).filter((l) => l.length >= 3))];
  return (
    <div className="space-y-3">
      <Textarea rows={9} value={v} onChange={(e) => setV(e.target.value)} placeholder={"best CRM for startups\nacme vs globex\n…"} />
      <Button className="w-full" disabled={!lines.length} loading={busy} onClick={() => onSubmit(lines)}>Import {lines.length || ""} prompts</Button>
    </div>
  );
}

function SuggestModal({ open, onOpenChange, clientId, onAdd, busy }: { open: boolean; onOpenChange: (o: boolean) => void; clientId: number; onAdd: (s: Suggestion[]) => void; busy: boolean }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Suggested prompts" description="Based on the brand, its industry and competitors." className="max-w-xl">
      <SuggestBody clientId={clientId} onAdd={onAdd} busy={busy} />
    </Modal>
  );
}

function SuggestBody({ clientId, onAdd, busy }: { clientId: number; onAdd: (s: Suggestion[]) => void; busy: boolean }) {
  const q = useQuery({ queryKey: ["suggest", clientId], queryFn: () => api<Suggestion[]>(`/clients/${clientId}/prompts/suggest`, { method: "POST", body: { count: 30 } }), staleTime: 0, gcTime: 0 });
  const [sel, setSel] = useState<Set<string> | null>(null);
  const list = q.data;
  const chosen = sel ?? new Set((list ?? []).map((x) => x.text));
  if (!list) return <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>;
  const toggle = (t: string) => { const n = new Set(chosen); if (n.has(t)) n.delete(t); else n.add(t); setSel(n); };
  return (
    <div className="space-y-3">
      <div className="max-h-[50dvh] space-y-1 overflow-y-auto pr-1">
        {list.map((s) => (
          <label key={s.text} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-white/6">
            <input type="checkbox" className="size-4 accent-[#8b6cff]" checked={chosen.has(s.text)} onChange={() => toggle(s.text)} />
            <span className="flex-1">{s.text}</span><Badge>{s.category}</Badge>
          </label>
        ))}
      </div>
      <Button className="w-full" loading={busy} disabled={!chosen.size} onClick={() => onAdd(list.filter((s) => chosen.has(s.text)))}>Add {chosen.size} prompts</Button>
    </div>
  );
}
