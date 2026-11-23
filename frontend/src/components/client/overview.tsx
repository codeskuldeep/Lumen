"use client";
import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight, Info, Minus, Radar } from "lucide-react";
import { motion } from "motion/react";
import { Badge, Empty, Glass, Reveal, Skeleton } from "@/components/ui/glass";
import { CountUp } from "@/components/ui/number";
import { useOverview } from "@/lib/hooks";
import { ENGINES } from "@/lib/utils";

const TrendChart = dynamic(() => import("@/components/charts/trend-chart"), { ssr: false, loading: () => <Skeleton className="h-[260px]" /> });

function Kpi({ label, value, decimals = 0, suffix = "", delta, i, hint }: { label: string; value: number | null; decimals?: number; suffix?: string; delta?: number | null; i: number; hint?: string }) {
  const up = (delta ?? 0) > 0, flat = !delta;
  return (
    <Reveal i={i}>
      <Glass className="p-5">
        <div className="text-sm text-muted">{label}</div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="text-3xl font-semibold tracking-tight">{value == null ? "—" : <CountUp value={value} decimals={decimals} suffix={suffix} />}</div>
          {delta != null && (
            <Badge tone={flat ? "neutral" : up ? "good" : "bad"}>
              {flat ? <Minus className="size-3" /> : up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta).toFixed(1)}
            </Badge>
          )}
        </div>
        {hint && <div className="mt-1 text-xs text-muted/70">{hint}</div>}
      </Glass>
    </Reveal>
  );
}

export function Overview({ clientId, days, hasPrompts, onGoPrompts }: { clientId: number; days: number; hasPrompts: boolean; onGoPrompts: () => void }) {
  const { data: ov, isLoading } = useOverview(clientId, days);

  if (isLoading || !ov) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>;

  if (!ov.current.runs && !ov.pending_runs)
    return (
      <Glass>
        <Empty icon={<Radar className="size-6" />} title={hasPrompts ? "Run your first scan" : "Add prompts to start tracking"}
          body={hasPrompts ? "Press “Run scan” at the top right to ask ChatGPT and Google AI your prompts. Scans only run when you press the button." : "Prompts are the questions your client's customers ask AI."}
          action={!hasPrompts ? <button onClick={onGoPrompts} className="rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-[#c9bcff] hover:bg-accent/30">Add prompts</button> : undefined} />
      </Glass>
    );

  const c = ov.current, p = ov.previous;
  const maxMentions = Math.max(1, ...ov.brands.map((b) => b.mentions));
  const maxCite = Math.max(1, ...ov.top_citations.map((x) => x.count));

  return (
    <div className="space-y-4">
      {ov.has_mock && (
        <Glass className="flex items-start gap-3 !border-amber-300/30 px-5 py-3 text-sm text-amber-200"><Info className="mt-0.5 size-4 shrink-0" /> Some answers here are simulated demo data because no API key is set for one or more engines. Add the key in backend/.env and restart the API to get real results.</Glass>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi i={0} label="Visibility" value={c.visibility} decimals={1} suffix="%" delta={p.runs ? c.visibility - p.visibility : null} hint="Answers that mention the brand" />
        <Kpi i={1} label="Share of voice" value={c.share_of_voice} decimals={1} suffix="%" delta={p.runs ? c.share_of_voice - p.share_of_voice : null} hint="vs. tracked competitors" />
        <Kpi i={2} label="Avg. position" value={c.avg_position} decimals={1} hint="Lower is better" />
        <Kpi i={3} label="Answers analysed" value={c.runs} hint={`Last ${days} days`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Reveal i={4} className="xl:col-span-2">
          <Glass className="p-5"><h3 className="mb-3 font-semibold">Visibility over time</h3><TrendChart data={ov.trend} /></Glass>
        </Reveal>
        <Reveal i={5}>
          <Glass className="h-full space-y-4 p-5">
            <h3 className="font-semibold">By AI engine</h3>
            {ov.by_engine.map((e) => {
              const meta = ENGINES[e.engine] ?? { label: e.engine, color: "#8b6cff" };
              return (
                <div key={e.engine}>
                  <div className="mb-1.5 flex justify-between text-sm"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: meta.color }} />{meta.label}</span><span className="font-medium">{e.visibility}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8"><motion.div className="h-full rounded-full" style={{ background: meta.color }} initial={{ width: 0 }} animate={{ width: `${e.visibility}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} /></div>
                </div>
              );
            })}
          </Glass>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal i={6}>
          <Glass className="h-full p-5">
            <h3 className="mb-4 font-semibold">Brand leaderboard</h3>
            <div className="space-y-3.5">
              {ov.brands.map((b, i) => (
                <div key={b.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="w-4 text-xs text-muted">{i + 1}</span>{b.name}{b.is_client && <Badge tone="accent">Client</Badge>}</span>
                    <span className="text-muted">{b.mentions} · <span className="text-fg">{b.share}%</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><motion.div className={b.is_client ? "h-full rounded-full bg-gradient-to-r from-accent to-accent2" : "h-full rounded-full bg-white/35"} initial={{ width: 0 }} animate={{ width: `${(b.mentions / maxMentions) * 100}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} /></div>
                </div>
              ))}
            </div>
          </Glass>
        </Reveal>
        <Reveal i={7}>
          <Glass className="h-full p-5">
            <h3 className="mb-4 font-semibold">Most cited sources</h3>
            <div className="space-y-3">
              {ov.top_citations.length === 0 && <p className="text-sm text-muted">No citations recorded yet.</p>}
              {ov.top_citations.map((s) => (
                <div key={s.domain} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate">{s.domain}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8"><motion.div className="h-full rounded-full bg-accent2/80" initial={{ width: 0 }} animate={{ width: `${(s.count / maxCite) * 100}%` }} transition={{ duration: 0.9 }} /></div>
                  <span className="w-8 text-right text-muted">{s.count}</span>
                </div>
              ))}
            </div>
          </Glass>
        </Reveal>
      </div>
    </div>
  );
}
