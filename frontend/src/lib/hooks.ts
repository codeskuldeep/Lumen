"use client";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, tokenStore } from "./api";
import type { Alert, Client, Draft, GapAnalysis, Overview, PlanInfo, Prompt, Run, RunDetail, ScanStatus, User } from "./types";

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => api<User>("/auth/me"), enabled: !!tokenStore.get(), staleTime: 5 * 60_000, retry: false });

export const useClients = () => useQuery({ queryKey: ["clients"], queryFn: () => api<Client[]>("/clients") });
export const useClient = (id: number) => useQuery({ queryKey: ["client", id], queryFn: () => api<Client>(`/clients/${id}`) });
export const usePlan = () => useQuery({ queryKey: ["plan"], queryFn: () => api<PlanInfo>("/plan") });

export const useOverview = (id: number, days: number) =>
  useQuery({
    queryKey: ["overview", id, days],
    queryFn: () => api<Overview>(`/clients/${id}/overview?days=${days}`),
    placeholderData: (prev) => prev,
  });

export const usePrompts = (id: number) =>
  useQuery({ queryKey: ["prompts", id], queryFn: () => api<Prompt[]>(`/clients/${id}/prompts`) });

export const useRuns = (id: number) => useQuery({ queryKey: ["runs", id], queryFn: () => api<Run[]>(`/clients/${id}/runs?limit=100`) });

export const useRunDetail = (id: number | null) =>
  useQuery({ queryKey: ["run", id], queryFn: () => api<RunDetail>(`/runs/${id}`), enabled: id != null });

export function useApiMutation<TVars, TRes = unknown>(
  fn: (v: TVars) => Promise<TRes>,
  opts: { invalidate?: unknown[][]; success?: string; onSuccess?: (r: TRes) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useAlerts = () => useQuery({ queryKey: ["alerts"], queryFn: () => api<Alert[]>("/alerts"), refetchInterval: 60_000 });

/** Live progress of the latest scan. The only thing that polls (every 3 s, and only while a scan runs). Other pages refresh when it reports new answers. */
export const useScan = (id: number) =>
  useQuery({
    queryKey: ["scan", id],
    queryFn: () => api<ScanStatus>(`/clients/${id}/scan`),
    refetchInterval: (q) => (q.state.data?.active ? 3000 : false),
  });

/** Show the progress card the instant a scan is queued, before the first status poll returns. */
export function showScanStarting(qc: QueryClient, clientId: number, queued: number, prompts: number) {
  qc.setQueryData<ScanStatus>(["scan", clientId], (old) => ({
    engine_modes: {}, ...old, active: true, total: queued, done: 0, failed: 0, queued, running: 0, analyzing: 0, prompts, mentioned: 0, engines: old?.engines ?? [], items: [],
  }));
  qc.invalidateQueries({ queryKey: ["scan", clientId] });
  qc.invalidateQueries({ queryKey: ["plan"] });
  qc.invalidateQueries({ queryKey: ["overview", clientId] });
  qc.invalidateQueries({ queryKey: ["runs", clientId] });
}

export const useGaps = (id: number, days: number) =>
  useQuery({ queryKey: ["gaps", id, days], queryFn: () => api<GapAnalysis>(`/clients/${id}/gaps?days=${days}`), placeholderData: (prev) => prev });

export const useDrafts = (id: number) => useQuery({ queryKey: ["drafts", id], queryFn: () => api<Draft[]>(`/clients/${id}/drafts`) });
