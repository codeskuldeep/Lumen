"use client";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

export function Glass({ className, hover, ...p }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn("glass", hover && "glass-hover", className)} {...p} />;
}

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] as const } }),
};

export function Reveal({ i = 0, className, ...p }: HTMLMotionProps<"div"> & { i?: number }) {
  return <motion.div variants={fadeUp} initial="hidden" animate="show" custom={i} className={className} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Badge({ className, tone = "neutral", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "good" | "bad" | "accent" | "warn" }) {
  const tones = {
    neutral: "bg-white/8 text-muted border-white/10",
    good: "bg-good/12 text-good border-good/25",
    bad: "bg-bad/12 text-bad border-bad/25",
    accent: "bg-accent/15 text-[#c9bcff] border-accent/30",
    warn: "bg-amber-400/12 text-amber-300 border-amber-300/25",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)} {...p} />;
}

export function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-white/6 text-accent ring-1 ring-white/10">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
