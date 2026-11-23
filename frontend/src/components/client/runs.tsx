"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, History, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Badge, Empty, Glass, Skeleton } from "@/components/ui/glass";
import { usePrompts, useRunDetail, useRuns } from "@/lib/hooks";
import type { RunDetail } from "@/lib/types";
import { ACTIVE, ENGINES, fmtDateTime, friendlyError } from "@/lib/utils";

function Highlighted({ run }: { run: RunDetail }) {
  const names = run.mentions.map((m) => m.name).filter(Boolean);
  if (!run.raw_response) return null;
  if (!names.length) return <>{run.raw_response}</>;
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const clients = new Set(run.mentions.filter((m) => m.is_client).map((m) => m.name.toLowerCase()));
  return <>{run.raw_response.split(re).map((part, i) => (i % 2 ? <mark key={i} className={clients.has(part.toLowerCase()) ? "rounded bg-accent/35 px-0.5 text-white" : "rounded bg-white/15 px-0.5 text-white"}>{part}</mark> : part))}</>;
}

export function Runs({ clientId }: { clientId: number }) {
  const runs = useRuns(clientId);
  const prompts = usePrompts(clientId);
  const [open, setOpen] = useState<number | null>(null);
  const detail = useRunDetail(open);
  const text = useMemo(() => Object.fromEntries((prompts.data ?? []).map((p) => [p.id, p.text])), [prompts.data]);

  if (runs.isLoading) return <Skeleton className="h-64" />;
  if (!runs.data?.length) return <Glass><Empty icon={<History className="size-6" />} title="No answers yet" body="Press “Run scan” at the top of the page. Every AI answer, with the brands it mentioned and its sources, will be listed here." /></Glass>;

  return (
    <>
      <Glass className="divide-y divide-white/8 overflow-hidden !p-0">
        {runs.data.map((r) => {
          const e = ENGINES[r.engine] ?? { label: r.engine, color: "#8b6cff" };
          return (
            <button key={r.id} disabled={ACTIVE.includes(r.status)} onClick={() => setOpen(r.id)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-white/5 disabled:cursor-wait">
              <span className="flex w-28 shrink-0 items-center gap-2 text-sm"><span className="size-2 rounded-full" style={{ background: e.color }} />{e.label}</span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate">{text[r.prompt_id] ?? `Prompt #${r.prompt_id}`}</span>
                {r.status === "failed" && <span className="block truncate text-xs text-bad/90">{friendlyError(r.error)}</span>}
              </span>
              {r.is_mock && <Badge tone="warn" className="hidden sm:inline-flex">Demo</Badge>}
              {ACTIVE.includes(r.status) ? <Badge tone={r.status === "pending" ? "neutral" : "accent"}>{r.status !== "pending" && <Loader2 className="size-3 animate-spin" />}{r.status === "pending" ? "Queued" : r.status === "running" ? "Asking…" : "Analyzing…"}</Badge>
                : r.status === "failed" ? <Badge tone="bad"><AlertTriangle className="size-3" /> Failed</Badge>
                : r.brand_mentioned ? <Badge tone="good"><CheckCircle2 className="size-3" /> Mentioned #{r.position}</Badge> : <Badge>Not mentioned</Badge>}
              <span className="hidden w-28 text-right text-xs text-muted md:block">{fmtDateTime(r.created_at)}</span>
            </button>
          );
        })}
      </Glass>

      <Modal open={open != null} onOpenChange={(o) => !o && setOpen(null)} title="AI answer" description={detail.data ? text[detail.data.prompt_id] : undefined} className="max-w-3xl">
        {!detail.data ? <Skeleton className="h-48" /> : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="accent">{ENGINES[detail.data.engine]?.label}</Badge>
              <Badge>{(detail.data.latency_ms / 1000).toFixed(1)}s</Badge>
              {detail.data.cost_usd > 0 && <Badge>${detail.data.cost_usd.toFixed(3)}</Badge>}
              {detail.data.is_mock && <Badge tone="warn">Demo data</Badge>}
            </div>
            {detail.data.error ? <div className="space-y-2 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad"><p className="font-medium">{friendlyError(detail.data.error)}</p><p className="break-words text-xs opacity-70">{detail.data.error}</p></div>
              : <div className="whitespace-pre-wrap rounded-xl bg-black/25 p-4 text-sm leading-relaxed"><Highlighted run={detail.data} /></div>}
            {detail.data.mentions.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Brands mentioned</h4>
                <div className="space-y-1.5">{detail.data.mentions.map((m) => (
                  <div key={m.name} className="flex items-center gap-3 text-sm"><span className="w-6 text-muted">#{m.position}</span><span className="flex-1">{m.name}</span>{m.is_client && <Badge tone="accent">Client</Badge>}<Badge tone={m.sentiment > 0.1 ? "good" : m.sentiment < -0.1 ? "bad" : "neutral"}>{m.sentiment > 0.1 ? "Positive" : m.sentiment < -0.1 ? "Negative" : "Neutral"}</Badge></div>
                ))}</div>
              </div>
            )}
            {detail.data.citations.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Sources cited</h4>
                <div className="space-y-1">{detail.data.citations.map((c) => (
                  <a key={c.url} href={c.url} target="_blank" rel="noreferrer noopener" className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-white/6 hover:text-fg"><span className="truncate">{c.title || c.domain}</span><span className="flex shrink-0 items-center gap-1 text-xs">{c.domain}<ExternalLink className="size-3" /></span></a>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
