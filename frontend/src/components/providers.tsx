"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster theme="dark" position="bottom-right" toastOptions={{ className: "!bg-[#14122a]/90 !backdrop-blur-xl !border !border-white/10 !text-white" }} />
    </QueryClientProvider>
  );
}
