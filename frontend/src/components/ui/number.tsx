"use client";
import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect } from "react";

export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals) + suffix);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}
