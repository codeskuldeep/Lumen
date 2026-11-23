"use client";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const button = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium select-none whitespace-nowrap transition-all duration-200 active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-br from-[#9a7dff] to-[#6d4aff] text-white shadow-[0_8px_30px_-8px_rgba(139,108,255,.8),inset_0_1px_0_rgba(255,255,255,.35)] hover:shadow-[0_10px_40px_-6px_rgba(139,108,255,.95),inset_0_1px_0_rgba(255,255,255,.4)] hover:-translate-y-px",
        glass: "glass !rounded-xl hover:bg-white/10 text-fg",
        ghost: "text-muted hover:text-fg hover:bg-white/8",
        danger: "bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25",
      },
      size: { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { loading?: boolean };

export function Button({ className, variant, size, loading, children, disabled, ...p }: Props) {
  return (
    <button className={cn(button({ variant, size }), className)} disabled={disabled || loading} {...p}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
