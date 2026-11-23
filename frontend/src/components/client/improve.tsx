"use client";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink, Info, Lightbulb, Radar, Swords, Target } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Badge, Empty, Glass, Reveal, Skeleton } from "@/components/ui/glass";
import { DraftPanel } from "@/components/client/draft-panel";
import { api } from "@/lib/api";
import { useApiMutation, useDrafts, useGaps, usePlan } from "@/lib/hooks";
import type { Draft, GapAction } from "@/lib/types";
import { ENGINES, cn } from "@/lib/utils";

const PRIORITY = {
  high: { label: "High priority", tone: "bad" as const },
  medium: { label: "Medium", tone: "warn" as const },
  low: { label: "Low", tone: "neutral" as const },
};
const engName = (k: string | null) => (k ? ENGINES[k]?.label ?? k : "—");

function useDone(clientId: number) {
  const key = `bv_done_${clientId}`;
  const [done, setDone] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { return new Set<string>(); }
  });
  const toggle = (id: string) => {
    const n = new Set(done);
    if (n.has(id)) n.delete(id); else n.add(id);
    setDone(n);
    try { localStorage.setItem(key, JSON.stringify([...n])); } catch { /* storage unavailable: still works for this visit */ }
  };
  return { done, toggle };
}

function Stat({ label, value, hint, i }: { label: string; value: string; hint: string; i: number }) {
  return (
    <Reveal i={i}>
      <Glass className="p-5">
        <div className="text-sm text-muted">{label}</div>
        <div className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted/70">{hint}</div>
      </Glass>
    </Reveal>
  );
}

type DraftProps = { clientId: number; draft: Draft | undefined; enabled: boolean; busy: boolean; writing: boolean; onGenerate: (facts: string) => void };

function ActionCard({ a, n, open, onToggleOpen, done, onToggleDone, d }: { a: GapAction; n: number; open: boolean; onToggleOpen: () => void; done: boolean; onToggleDone: () => void; d: DraftProps }) {
  const p = PRIORITY[a.priority];
  const ev = a.evidence;
  return (
    <Glass className={cn("overflow-hidden !p-0 transition-opacity", done && "opacity-55")}>
      <div className="flex items-start gap-3 p-4">
        <input type="checkbox" checked={done} onChange={onToggleDone} aria-label={`Mark "${a.title}" as done`} className="mt-1 size-4 shrink-0 accent-[#8b6cff]" />
        <button onClick={onToggleOpen} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">#{n}</span>
            <Badge tone={p.tone}>{p.label}</Badge>
            {d.draft && <Badge tone="good">Draft ready</Badge>}
            {a.impact > 0 && <Badge>affects {a.impact} {a.impact === 1 ? "answer" : "answers"}</Badge>}
          </div>
          <h4 className={cn("mt-1.5 font-semibold", done && "line-through")}>{a.title}</h4>
          <p className="mt-0.5 text-sm text-muted">{a.why}</p>
        </button>
        <button onClick={onToggleOpen} aria-label={open ? "Collapse" : "Expand"} className="rounded-lg p-1.5 text-muted transition hover:bg-white/8 hover:text-fg">
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="space-y-4 border-t border-white/8 px-4 pb-4 pt-3 pl-11 text-sm">
              <div>
                <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">What to do</h5>
                <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </div>
              {(ev.prompts?.length ?? 0) > 0 && (
                <div>
                  <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Prompts this is about</h5>
                  <ul className="space-y-1 text-muted">{ev.prompts!.map((t) => <li key={t}>“{t}”</li>)}</ul>
                </div>
              )}
              {(ev.pages?.length ?? 0) > 0 && (
                <div>
                  <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Pages the AI cited (where the client was missing)</h5>
                  <div className="space-y-1">{ev.pages!.map((pg) => (
                    <a key={pg.url} href={pg.url} target="_blank" rel="noreferrer noopener" className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-muted transition hover:bg-white/6 hover:text-fg">
                      <span className="truncate">{pg.title || pg.url}</span><ExternalLink className="size-3 shrink-0" />
                    </a>
                  ))}</div>
                </div>
              )}
              {((ev.domains?.length ?? 0) > 0 || (ev.competitors?.length ?? 0) > 0) && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {ev.domains?.map((d) => <Badge key={d}>{d}</Badge>)}
                  {ev.competitors?.map((c) => <Badge key={c} tone="warn">{c}</Badge>)}
                </div>
              )}
              {a.kind !== "setup" && (
                <div>
                  <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Let AI write it</h5>
                  <DraftPanel clientId={d.clientId} actionId={a.id} draft={d.draft} enabled={d.enabled} busy={d.busy} writing={d.writing} onGenerate={d.onGenerate} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Glass>
  );
}

export function Improve({ clientId, days, onGoPrompts }: { clientId: number; days: number; onGoPrompts: () => void }) {
  const q = useGaps(clientId, days);
  const { done, toggle } = useDone(clientId);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const g = q.data;
  const drafts = useDrafts(clientId);
  const enabled = usePlan().data?.drafts_today.enabled ?? false;
  const draftByAction = new Map((drafts.data ?? []).map((x) => [x.action_id, x]));
  const gen = useApiMutation(({ id, facts }: { id: string; facts: string }) => api<Draft>(`/clients/${clientId}/gaps/draft`, { method: "POST", body: { action_id: id, facts, days } }), {
    invalidate: [["drafts", clientId], ["plan"]], success: "Draft ready. Review it before using it.",
  });

  if (q.isLoading || !g) return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>;
  if (!g.has_data)
    return <Glass><Empty icon={<Radar className="size-6" />} title="Run a scan to see how to improve" body="We compare which brands the AI recommends, and which sources it cites, then turn the gaps into a to-do list. Press “Run scan” at the top right." action={<button onClick={onGoPrompts} className="rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-[#c9bcff] hover:bg-accent/30">Go to prompts</button>} /></Glass>;

  const s = g.summary;
  // the first two actions start expanded; `open` holds the ids the user has flipped from that default
  const isOpen = (id: string, i: number) => (i < 2) !== open.has(id);
  const flip = (id: string) => { const n = new Set(open); if (n.has(id)) n.delete(id); else n.add(id); setOpen(n); };
  const remaining = g.actions.filter((a) => !done.has(a.id)).length;

  return (
    <div className="space-y-6">
      {g.has_mock && (
        <Glass className="flex items-start gap-3 !border-amber-300/30 px-5 py-3 text-sm text-amber-200"><Info className="mt-0.5 size-4 shrink-0" /> {g.mock_pct}% of these answers are simulated demo data, so the sources and competitors below are not real. Add API keys for all engines and run a scan for a real analysis.</Glass>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat i={0} label="Answers lost to competitors" value={`${s.losing_pct}%`} hint={`${s.losing_answers} of ${s.answers}: a competitor was named instead of the client`} />
        <Stat i={1} label="Prompts with a gap" value={`${s.prompts_with_gap} of ${s.prompts}`} hint={s.invisible_prompts ? `${s.invisible_prompts} where the brand never appears` : "Client appears in under half of the answers"} />
        <Stat i={2} label="Top rival" value={s.top_competitor ?? "—"} hint="Most often recommended when the client is missed" />
        <Stat i={3} label="Weakest engine" value={engName(s.weakest_engine)} hint="Lowest visibility compared with the client's average" />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Lightbulb className="size-5 text-accent" /> Action plan</h3>
            <p className="text-sm text-muted">Ordered by priority and by how many answers each step could affect. Tick items as you finish them.</p>
          </div>
          <Badge tone={remaining ? "accent" : "good"}>{remaining ? `${remaining} to do` : "All done"}</Badge>
        </div>
        {g.actions.length === 0
          ? <Glass><Empty icon={<Target className="size-6" />} title="No gaps found" body="The client is doing well on the prompts tracked so far. Add more prompts to look for blind spots." /></Glass>
          : g.actions.map((a, i) => <ActionCard key={a.id} a={a} n={i + 1} open={isOpen(a.id, i)} onToggleOpen={() => flip(a.id)} done={done.has(a.id)} onToggleDone={() => toggle(a.id)}
              d={{ clientId, draft: draftByAction.get(a.id), enabled, busy: gen.isPending, writing: gen.isPending && gen.variables?.id === a.id, onGenerate: (facts) => gen.mutate({ id: a.id, facts }) }} />)}
        <p className="flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" /> AI answers can take weeks to reflect new content. Re-run a scan afterwards and watch the visibility trend on the Overview tab to see what worked.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Glass className="p-5">
          <h3 className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-300" /> Where the client is missing</h3>
          <p className="mb-4 text-sm text-muted">Prompts where the brand shows up in under half of the answers.</p>
          {g.prompt_gaps.length === 0 ? <p className="text-sm text-muted">No gaps. Nice.</p> : (
            <div className="divide-y divide-white/8">
              {g.prompt_gaps.map((p) => (
                <div key={p.prompt_id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm">{p.text}</span>
                    <Badge tone={p.visibility === 0 ? "bad" : "warn"} className="shrink-0">{p.visibility}% visible</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {p.competitors.length > 0 ? <><Swords className="size-3" /> Instead:{p.competitors.map((c) => <Badge key={c.name}>{c.name} ×{c.count}</Badge>)}</> : <span>No competitor named either, so the AI gave a generic answer.</span>}
                  </div>
                  {p.engines_missing.length > 0 && <div className="text-xs text-muted">Never mentioned on {p.engines_missing.map(engName).join(", ")}</div>}
                </div>
              ))}
            </div>
          )}
        </Glass>

        <div className="space-y-4">
          <Glass className="p-5">
            <h3 className="mb-1 font-semibold">Sources to get listed on</h3>
            <p className="mb-4 text-sm text-muted">Sites the AI cites in answers where a competitor wins and the client doesn&apos;t.</p>
            {g.source_gaps.length === 0 ? <p className="text-sm text-muted">No repeated sources yet. Run more prompts to find patterns.</p> : (
              <div className="space-y-3">
                {g.source_gaps.map((x) => (
                  <div key={x.domain} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{x.domain}</span>
                    <Badge>{x.category_label}</Badge>
                    <span className="w-20 shrink-0 text-right text-muted" title={x.client_answers ? `The client is cited here in ${x.client_answers} answers` : "Never cited alongside the client"}>{x.gap_answers} lost{x.client_answers === 0 && <span className="text-bad"> · absent</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </Glass>

          {g.competitors.length > 0 && (
            <Glass className="p-5">
              <h3 className="mb-3 font-semibold">Who wins the lost answers</h3>
              <div className="space-y-3">
                {g.competitors.map((c) => (
                  <div key={c.name} className="text-sm">
                    <div className="flex justify-between"><span>{c.name}</span><span className="text-muted">{c.answers} answers</span></div>
                    {c.top_sources.length > 0 && <div className="mt-1 text-xs text-muted">Often cited via {c.top_sources.join(", ")}</div>}
                  </div>
                ))}
              </div>
            </Glass>
          )}
        </div>
      </div>
    </div>
  );
}
