"use client";
import * as S from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ value, onValueChange, options, className }: {
  value: string; onValueChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange}>
      <S.Trigger className={cn("glass-input inline-flex h-9 items-center justify-between gap-2 px-3 text-sm", className)}>
        <S.Value />
        <S.Icon><ChevronDown className="size-4 text-muted" /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} className="glass z-[60] min-w-[var(--radix-select-trigger-width)] !bg-[#14122a]/90 p-1 outline-none">
          <S.Viewport>
            {options.map((o) => (
              <S.Item key={o.value} value={o.value} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10">
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator><Check className="size-4 text-accent" /></S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
