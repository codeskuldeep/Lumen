import { cn } from "@/lib/utils";

export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn("glass-input h-11 w-full px-3.5 text-sm", className)} {...p} />
);
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn("glass-input w-full px-3.5 py-3 text-sm", className)} {...p} />
);
export const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
    {children}
    {hint && !error && <span className="block text-xs text-muted/70">{hint}</span>}
    {error && <span className="block text-xs text-bad">{error}</span>}
  </label>
);
