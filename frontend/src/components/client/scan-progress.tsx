"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Radar, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Glass } from "@/components/ui/glass";
import { useScan } from "@/lib/hooks";
import type { ScanEngine, ScanItem, ScanStatus } from "@/lib/types";
import { ENGINES, cn, fmtDuration, friendlyError, parseUtc } from "@/lib/utils";

const eng = (k: string) => ENGINES[k] ?? { label: k, color: "#8b6cff" };

function useElapsed(startedAt: string | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return startedAt ? Math.max(0, (now - parseUtc(startedAt).getTime()) / 1000) : 0;
}

function phase(s: ScanStatus) {
  if (s.running) return "Waiting for the AI engines to answer";
  if (s.analyzing) return "Finding brand mentions in the answers";
  return "Starting up";
}

function engineState(e: ScanEngine) {
  if (e.running) return { text: "Asking…", live: true };
  if (e.analyzing) return { text: "Analyzing answer…", live: true };
  if (e.queued) return { text: "Queued", live: false };
  if (e.failed && !e.done) return { text: "Failed", live: false };
  return { text: e.failed ? `Finished · ${e.failed} failed` : "Finished", live: false };
}

function EngineTile({ e }: { e: ScanEngine }) {
  const meta = eng(e.engine);
  const st = engineState(e);
  const finished = e.done + e.failed;
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", st.live && "animate-pulse")} style={{ background: meta.color }} />
          {meta.label}
        </span>
        {e.mode === "demo" && <Badge tone="warn" title="No API key for this engine, so answers are simulated">Demo</Badge>}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        {st.live && <Loader2 className="size-3 animate-spin" />}
        {!st.live && !e.queued && (e.failed && !e.done ? <AlertTriangle className="size-3 text-bad" /> : <CheckCircle2 className="size-3 text-good" />)}
        {st.text}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <motion.div className="h-full rounded-full" style={{ background: meta.color }} animate={{ width: `${(finished / e.total) * 100}%` }} transition={{ duration: 0.5 }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{finished}/{e.total} answers</span>
        {e.done > 0 && <span>brand in {e.mentioned}</span>}
      </div>
    </div>
  );
}

const STAGE: Record<string, string> = { pending: "Queued", running: "Asking", analyzing: "Analyzing" };

function FeedRow({ it }: { it: ScanItem }) {
  const meta = eng(it.engine);
  const others = it.brands.filter((b) => !b.is_client).slice(0, 3).map((b) => b.name);
  const inFlight = it.status === "pending" || it.status === "running" || it.status === "analyzing";
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
      <span className="flex w-24 shrink-0 items-center gap-2"><span className="size-2 rounded-full" style={{ background: meta.color }} />{meta.label}</span>
      <span className="min-w-0 flex-1 truncate text-muted" title={it.prompt}>{it.prompt}</span>
      {inFlight ? (
        <Badge tone={it.status === "pending" ? "neutral" : "accent"}>
          {it.status !== "pending" && <Loader2 className="size-3 animate-spin" />}{STAGE[it.status]}
        </Badge>
      ) : it.status === "failed" ? (
        <Badge tone="bad" title={it.error ?? undefined}><AlertTriangle className="size-3" /> Failed</Badge>
      ) : (
        <span className="flex items-center gap-2">
          {others.length > 0 && <span className="hidden text-xs text-muted md:inline">also: {others.join(", ")}</span>}
          {it.brand_mentioned ? <Badge tone="good"><CheckCircle2 className="size-3" /> Mentioned #{it.position}</Badge> : <Badge>Not mentioned</Badge>}
        </span>
      )}
    </motion.li>
  );
}

function ActiveCard({ s }: { s: ScanStatus }) {
  const total = s.total, finished = (s.done ?? 0) + (s.failed ?? 0);
  const elapsed = useElapsed(s.started_at, true);
  const eta = finished >= 3 && finished < total ? (elapsed / finished) * (total - finished) : null;
  const inflight = (s.items ?? []).filter((i) => i.status === "running" || i.status === "analyzing");
  const queuedCount = s.queued ?? 0;
  const recent = (s.items ?? []).filter((i) => i.status === "done" || i.status === "failed").slice(0, 6);
  const feed = [...inflight.slice(0, 6), ...recent];

  return (
    <Glass className="relative overflow-hidden !border-accent/40 p-5" role="status" aria-live="polite">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/20 text-accent">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-accent/20" />
            <Radar className="relative size-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold">Scanning AI engines…</h3>
            <p className="text-sm text-muted">{phase(s)} · {s.prompts} {s.prompts === 1 ? "prompt" : "prompts"} × {s.engines?.length || 2} engines</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold tabular-nums">{finished} of {total} answers</div>
          <div className="flex items-center justify-end gap-1 text-xs text-muted"><Clock className="size-3" />{fmtDuration(elapsed)} elapsed{eta != null && ` · about ${fmtDuration(eta)} left`}</div>
        </div>
      </div>

      <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-white/8">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" animate={{ width: `${Math.max(4, (finished / total) * 100)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        <div className="skeleton absolute inset-0 !rounded-full opacity-60" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{s.engines?.map((e) => <EngineTile key={e.engine} e={e} />)}</div>

      <div className="mt-4">
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Live activity</h4>
        <ul className="divide-y divide-white/6 overflow-hidden rounded-xl border border-white/8 bg-black/20">
          <AnimatePresence initial={false}>{feed.map((it) => <FeedRow key={it.id} it={it} />)}</AnimatePresence>
        </ul>
        {queuedCount > 0 && <p className="mt-1.5 text-xs text-muted">+ {queuedCount} {queuedCount === 1 ? "answer is" : "answers are"} waiting in the queue (at most {s.max_concurrent ?? 8} calls run at once to protect API limits)</p>}
      </div>

      <p className="mt-3 text-xs text-muted/80">You can switch tabs or leave this page. The scan keeps running on the server and every answer is saved as it arrives.</p>
    </Glass>
  );
}

function DoneCard({ s, seconds, onDismiss, onViewAnswers }: { s: ScanStatus; seconds: number; onDismiss: () => void; onViewAnswers: () => void }) {
  const done = s.done ?? 0, failed = s.failed ?? 0, mentioned = s.mentioned ?? 0;
  const allFailed = done === 0;
  const firstErr = (s.items ?? []).find((i) => i.status === "failed")?.error;
  const demo = (s.engines ?? []).filter((e) => e.mode === "demo").map((e) => eng(e.engine).label);
  const pct = done ? Math.round((mentioned / done) * 100) : 0;
  return (
    <Glass className={cn("relative p-5", allFailed ? "!border-bad/40" : "!border-good/35")}>
      <button onClick={onDismiss} aria-label="Dismiss" className="absolute right-3 top-3 rounded-lg p-1.5 text-muted transition hover:bg-white/8 hover:text-fg"><X className="size-4" /></button>
      <div className="flex items-start gap-3">
        <div className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", allFailed ? "bg-bad/15 text-bad" : "bg-good/15 text-good")}>
          {allFailed ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="font-semibold">{allFailed ? "Scan finished, but no answers came back" : `Scan complete in ${fmtDuration(seconds)}`}</h3>
          {!allFailed && (
            <p className="mt-0.5 text-sm text-muted">
              {done} {done === 1 ? "answer" : "answers"} analysed across {s.prompts} {s.prompts === 1 ? "prompt" : "prompts"}. Your brand was mentioned in <span className="font-medium text-fg">{mentioned} ({pct}%)</span>.
            </p>
          )}
          {failed > 0 && (
            <p className="mt-1 text-sm text-bad">{failed} {failed === 1 ? "answer" : "answers"} failed: {friendlyError(firstErr)}</p>
          )}
          {demo.length > 0 && (
            <p className="mt-1 text-sm text-amber-300">{demo.join(", ")} used demo data because no API key is set for {demo.length === 1 ? "it" : "them"}.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onViewAnswers}>View answers</Button>
            <Button size="sm" variant="glass" onClick={onDismiss}>Dismiss</Button>
          </div>
        </div>
      </div>
    </Glass>
  );
}

/** Shows what is running while a scan is in flight, and a summary of what was found when it ends. */
export function ScanProgress({ clientId, onViewAnswers }: { clientId: number; onViewAnswers: () => void }) {
  const { data } = useScan(clientId);
  const qc = useQueryClient();
  const wasActive = useRef<boolean | null>(null);
  const finishedCount = useRef(0);
  const [finished, setFinished] = useState<{ s: ScanStatus; seconds: number } | null>(null);

  useEffect(() => {
    if (!data) return;
    const prev = wasActive.current;
    wasActive.current = data.active;
    // refresh the numbers on screen only when the scan has actually produced new answers
    const finishedNow = (data.done ?? 0) + (data.failed ?? 0);
    if (data.active && finishedNow !== finishedCount.current) {
      finishedCount.current = finishedNow;
      ["overview", "runs", "prompts"].forEach((k) => qc.invalidateQueries({ queryKey: [k, clientId] }));
    }
    if (prev === true && !data.active) {
      const seconds = data.started_at ? (Date.now() - parseUtc(data.started_at).getTime()) / 1000 : 0;
      setFinished({ s: data, seconds });
      ["overview", "runs", "prompts", "clients", "alerts", "gaps"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      const done = data.done ?? 0;
      if (done) toast.success(`Scan complete: ${data.mentioned} of ${done} answers mention your brand`);
      else toast.error("Scan finished without any answers. See the details on the page.");
    } else if (prev !== true && data.active) {
      finishedCount.current = 0;
      setFinished(null);
    }
  }, [data, qc, clientId]);

  return (
    <AnimatePresence mode="popLayout">
      {data?.active ? (
        <motion.div key="active" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><ActiveCard s={data} /></motion.div>
      ) : finished ? (
        <motion.div key="done" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <DoneCard s={finished.s} seconds={finished.seconds} onDismiss={() => setFinished(null)} onViewAnswers={() => { setFinished(null); onViewAnswers(); }} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
