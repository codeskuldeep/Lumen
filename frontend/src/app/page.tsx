import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Globe2, Layers, Radar, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";

const ENGINES = ["ChatGPT", "Google AI Overviews"];
const FEATURES = [
  { icon: Radar, t: "Two engines, one view", d: "Run every client prompt across ChatGPT and Google AI Overviews whenever you need an update." },
  { icon: BarChart3, t: "Share of voice", d: "See how often a brand is mentioned, where it ranks in the answer and how it stacks up against competitors." },
  { icon: Globe2, t: "Citation intelligence", d: "Find the domains AI trusts in each niche — the exact sources worth earning links and mentions from." },
  { icon: Layers, t: "Built for many clients", d: "Switch clients instantly, track dozens of prompts each, and keep every account cleanly separated." },
  { icon: FileText, t: "White-label reports", d: "Export branded PDF reports with your agency name and colours, ready to send to the client." },
  { icon: Sparkles, t: "Prompt suggestions", d: "Generate discovery, comparison and brand prompts from the client's industry and competitors in one click." },
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <header className="flex h-20 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-xl px-4 py-2 text-muted transition hover:text-fg">Sign in</Link>
          <Link href="/signup" className="glass !rounded-xl px-4 py-2 font-medium transition hover:bg-white/10">Get started</Link>
        </nav>
      </header>

      <section className="pb-24 pt-20 text-center md:pt-28">
        <div className="glass mx-auto mb-8 inline-flex items-center gap-2 !rounded-full px-4 py-1.5 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-good shadow-[0_0_10px_var(--good)]" /> Free AI search visibility tracking for agencies
        </div>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Know when AI <span className="text-gradient">recommends your clients</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Track brand mentions, rankings and citations across the AI answer engines your clients&apos; customers use every day — and prove the value of your work.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-br from-[#9a7dff] to-[#6d4aff] px-6 font-medium shadow-[0_12px_40px_-10px_rgba(139,108,255,.9)] transition hover:-translate-y-0.5">
            Start tracking — it&apos;s free <ArrowRight className="size-4" />
          </Link>
          <Link href="/login" className="glass inline-flex h-12 items-center !rounded-xl px-6 font-medium transition hover:bg-white/10">Sign in</Link>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
          {ENGINES.map((e) => <span key={e} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />{e}</span>)}
        </div>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: I, t, d }) => (
          <div key={t} className="glass glass-hover p-6">
            <div className="mb-4 grid size-11 place-items-center rounded-xl bg-white/7 text-accent ring-1 ring-white/10"><I className="size-5" /></div>
            <h3 className="mb-1.5 font-semibold">{t}</h3>
            <p className="text-sm leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-white/8 py-8 text-center text-sm text-muted">© {new Date().getFullYear()} Lumen</footer>
    </div>
  );
}
