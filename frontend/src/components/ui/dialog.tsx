"use client";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({ open, onOpenChange, title, description, children, className }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild>
              <motion.div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <div className="fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none">
              <D.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className={cn("glass pointer-events-auto flex max-h-[88dvh] w-full max-w-lg flex-col !bg-[#14122a]/80 outline-none", className)}
                >
                  <div className="flex items-start justify-between gap-4 p-6 pb-3">
                    <div>
                      <D.Title className="text-lg font-semibold">{title}</D.Title>
                      <D.Description className={cn("mt-1 text-sm text-muted", !description && "sr-only")}>{description ?? title}</D.Description>
                    </div>
                    <D.Close className="rounded-lg p-1.5 text-muted transition hover:bg-white/10 hover:text-fg"><X className="size-4" /></D.Close>
                  </div>
                  <div className="overflow-y-auto p-6 pt-3">{children}</div>
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
