"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar } from "@/components/sidebar";
import { tokenStore } from "@/lib/api";
import { useMe } from "@/lib/hooks";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const me = useMe();

  useEffect(() => {
    if (!tokenStore.get() || me.isError) { tokenStore.clear(); router.replace("/login"); }
  }, [me.isError, router]);

  if (!me.data) return <div className="grid min-h-dvh place-items-center"><div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-accent" /></div>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] gap-5 p-3 md:p-5">
      <Sidebar user={me.data} />
      <main className="min-w-0 flex-1 pb-24 md:pb-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
