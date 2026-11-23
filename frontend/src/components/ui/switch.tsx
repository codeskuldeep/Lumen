"use client";
import * as S from "@radix-ui/react-switch";

export const Switch = (p: React.ComponentProps<typeof S.Root>) => (
  <S.Root className="relative h-6 w-11 shrink-0 rounded-full bg-white/12 transition-colors data-[state=checked]:bg-accent" {...p}>
    <S.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
  </S.Root>
);
