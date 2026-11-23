"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Download, KeyRound, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/glass";
import { Textarea } from "@/components/ui/input";
import type { Draft } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

/** Minimal Markdown view: headings, fenced code, and plain paragraphs. [PLACEHOLDER]s are highlighted. */
function DraftText({ text }: { text: string }) {
  const parts = text.split(/```[^\n]*\n([\s\S]*?)```/g);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i} className="overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs">{p.trimEnd()}</pre>
        ) : (
          <div key={i} className="space-y-1.5">
            {p.split("\n").map((line, j) => {
              const h = /^(#{1,4})\s+(.*)/.exec(line);
              const body = (h ? h[2] : line).split(/(\[PLACEHOLDER[^\]]*\])/g).map((seg, k) => (k % 2 ? <mark key={k} className="rounded bg-amber-400/20 px-1 text-amber-200">{seg}</mark> : seg));
              if (!line.trim()) return null;
              return h ? <p key={j} className={h[1].length <= 2 ? "pt-2 text-base font-semibold" : "pt-1 font-semibold"}>{body}</p> : <p key={j} className="whitespace-pre-wrap">{body}</p>;
            })}
          </div>
        ),
      )}
    </div>
  );
}

const STAGES = ["Reading the evidence…", "Planning the content…", "Writing the draft…", "Adding schema and checklists…"];

function Writing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-2.5 rounded-xl border border-accent/30 bg-accent/5 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin text-accent" /> {STAGES[i]}</div>
      <Skeleton className="h-3 w-11/12" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-9/12" />
      <p className="text-xs text-muted">Claude is writing this. It usually takes 20–60 seconds, and you can keep using the page.</p>
    </div>
  );
}

export function DraftPanel({ clientId, actionId, draft, enabled, busy, writing, onGenerate }: {
  clientId: number; actionId: string; draft: Draft | undefined; enabled: boolean; busy: boolean; writing: boolean; onGenerate: (facts: string) => void;
}) {
  const key = `bv_facts_${clientId}`;
  const [facts, setFacts] = useState(() => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } });
  const [copied, setCopied] = useState(false);
  const save = (v: string) => { setFacts(v); try { localStorage.setItem(key, v); } catch { /* ignore */ } };

  if (!enabled)
    return (
      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted">
        <KeyRound className="mt-0.5 size-3.5 shrink-0" /> Drafting is off. Add <code className="rounded bg-white/10 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-white/10 px-1">backend/.env</code> and restart the API to let Claude write this for you.
      </div>
    );

  const factsBox = (
    <details className="group rounded-xl border border-white/8 bg-black/20 p-3 text-xs">
      <summary className="cursor-pointer select-none text-muted transition group-open:text-fg">Facts about the client (optional, makes the draft far better)</summary>
      <Textarea rows={4} value={facts} onChange={(e) => save(e.target.value)} className="mt-2" placeholder={"What the product is and who it's for\nPricing, key features, differentiators\nReal customer numbers or awards you can back up"} />
      <p className="mt-1.5 text-muted">Saved in this browser for this client. Anything not provided becomes a [PLACEHOLDER] you fill in.</p>
    </details>
  );

  if (writing) return <Writing />;

  if (!draft)
    return (
      <div className="space-y-2.5">
        {factsBox}
        <Button size="sm" disabled={busy} onClick={() => onGenerate(facts)}><Sparkles className="size-4" /> Draft this with Claude</Button>
      </div>
    );

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft.content); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.error("Couldn't copy. Select the text and copy it manually."); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([draft.content], { type: "text/markdown" }));
    Object.assign(document.createElement("a"), { href: url, download: `${actionId.replace(/[^a-z0-9]+/gi, "-")}.md` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="good"><Check className="size-3" /> Draft ready</Badge>
        <span className="text-xs text-muted">{fmtDateTime(draft.created_at)} · {draft.model}</span>
        <span className="ml-auto flex gap-1.5">
          <Button size="sm" variant="glass" onClick={copy}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}</Button>
          <Button size="sm" variant="glass" onClick={download}><Download className="size-3.5" /> .md</Button>
        </span>
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-400/8 p-3 text-xs text-amber-200"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> AI-written. Check every fact, fill the highlighted [PLACEHOLDER]s, and have a person review it before publishing.</p>
      <div className="max-h-[32rem] overflow-y-auto rounded-xl bg-black/25 p-4"><DraftText text={draft.content} /></div>
      {factsBox}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => onGenerate(facts)}><RefreshCw className="size-3.5" /> Regenerate</Button>
    </div>
  );
}
