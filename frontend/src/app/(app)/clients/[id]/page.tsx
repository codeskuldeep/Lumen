"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Improve } from "@/components/client/improve";
import { Overview } from "@/components/client/overview";
import { ScanProgress } from "@/components/client/scan-progress";
import { Prompts } from "@/components/client/prompts";
import { Runs } from "@/components/client/runs";
import { ClientSettings } from "@/components/client/settings";
import { Button } from "@/components/ui/button";
import { Reveal, Skeleton } from "@/components/ui/glass";
import { Select } from "@/components/ui/select";
import { api, downloadFile } from "@/lib/api";
import { showScanStarting, useApiMutation, useClient, usePlan, usePrompts, useScan } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const TABS = [["overview", "Overview"], ["prompts", "Prompts"], ["runs", "Answers"], ["improve", "Improve"], ["settings", "Settings"]] as const;

export default function ClientPage() {
  const id = Number(useParams<{ id: string }>().id);
  const client = useClient(id);
  const prompts = usePrompts(id);
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState("30");
  const [dl, setDl] = useState(false);

  const qc = useQueryClient();
  const scan = useScan(id);
  const today = usePlan().data?.answers_today;
  const scanning = !!scan.data?.active;
  const run = useApiMutation(() => api<{ queued: number; prompts: number; engines: number }>(`/clients/${id}/run`, { method: "POST" }), {
    onSuccess: (r) => { showScanStarting(qc, id, r.queued, r.prompts); toast.info(`Scan started: ${r.queued} answers queued (${r.prompts} prompts × ${r.engines} engines)`); },
  });

  if (client.isError) return <p className="p-10 text-center text-muted">Client not found.</p>;
  if (!client.data) return <div className="space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96" /></div>;
  const c = client.data;

  return (
    <div className="space-y-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{c.domain || c.industry || "AI visibility"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{c.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {today && today.live_engines > 0 && (
            <span className={cn("hidden text-xs sm:block", today.used / today.limit > 0.85 ? "text-amber-300" : "text-muted")} title="Live AI answers started in the last 24 hours. Protects your API budget.">
              {today.used}/{today.limit} answers today
            </span>
          )}
          <Select value={days} onValueChange={setDays} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} className="w-36 !h-10" />
          <Button variant="glass" loading={dl} onClick={async () => { setDl(true); try { await downloadFile(`/clients/${id}/report.pdf?days=${days}`, `${c.name}-ai-visibility.pdf`); } catch (e) { toast.error((e as Error).message); } setDl(false); }}><Download className="size-4" /> Report</Button>
          <Button loading={run.isPending} disabled={scanning} onClick={() => run.mutate(undefined)}>
            {scanning ? <><Loader2 className="size-4 animate-spin" /> Scanning {(scan.data?.done ?? 0) + (scan.data?.failed ?? 0)}/{scan.data?.total}</> : <><Play className="size-4" /> Run scan</>}
          </Button>
        </div>
      </Reveal>

      <ScanProgress clientId={id} onViewAnswers={() => setTab("runs")} />

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="glass mb-5 inline-flex gap-1 !rounded-2xl p-1.5">
          {TABS.map(([v, l]) => (
            <Tabs.Trigger key={v} value={v} className={cn("relative rounded-xl px-4 py-2 text-sm font-medium transition-colors", tab === v ? "text-fg" : "text-muted hover:text-fg")}>
              {tab === v && <span className="absolute inset-0 -z-0 rounded-xl bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]" />}
              <span className="relative">{l}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className="outline-none"><Overview clientId={id} days={Number(days)} hasPrompts={!!prompts.data?.length} onGoPrompts={() => setTab("prompts")} /></Tabs.Content>
        <Tabs.Content value="prompts" className="outline-none"><Prompts clientId={id} /></Tabs.Content>
        <Tabs.Content value="runs" className="outline-none"><Runs clientId={id} /></Tabs.Content>
        <Tabs.Content value="improve" className="outline-none"><Improve clientId={id} days={Number(days)} onGoPrompts={() => setTab("prompts")} /></Tabs.Content>
        <Tabs.Content value="settings" className="outline-none"><ClientSettings client={c} /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
