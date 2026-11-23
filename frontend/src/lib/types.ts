export type Agency = { id: number; name: string; plan: string; logo_url: string | null; brand_color: string };
export type User = { id: number; name: string; email: string; role: string; email_alerts: boolean; agency: Agency };
export type Competitor = { id?: number; name: string; domain?: string | null; aliases: string[] };
export type Client = {
  id: number; name: string; domain: string | null; industry: string | null; aliases: string[];
  competitors: Competitor[]; created_at: string; prompt_count?: number; visibility?: number | null;
};
export type Prompt = {
  id: number; client_id: number; text: string; category: string | null; active: boolean;
  runs: number; visibility: number | null; avg_position: number | null; last_run: string | null;
};
export type RunStatus = "pending" | "running" | "analyzing" | "done" | "failed";
export type Run = {
  id: number; prompt_id: number; engine: string; status: RunStatus; is_mock: boolean;
  brand_mentioned: boolean; position: number | null; sentiment: number | null; latency_ms: number;
  cost_usd: number; error: string | null; created_at: string;
};
export type RunDetail = Run & {
  raw_response: string | null;
  mentions: { name: string; is_client: boolean; position: number; sentiment: number; snippet: string | null }[];
  citations: { url: string; domain: string; title: string | null }[];
};
export type Summary = { runs: number; visibility: number; avg_position: number | null; sentiment: number | null; share_of_voice: number };
export type Overview = {
  days: number; current: Summary; previous: Summary;
  by_engine: { engine: string; runs: number; visibility: number; avg_position: number | null }[];
  trend: { date: string; visibility: number; runs: number }[];
  brands: { name: string; is_client: boolean; mentions: number; share: number; avg_position: number | null; sentiment: number | null }[];
  top_citations: { domain: string; count: number }[];
  pending_runs: number; cost_usd: number; has_mock: boolean;
};
export type PlanInfo = { plan: string; limits: { clients: number; prompts: number }; usage: { clients: number; prompts: number };
  answers_today: { used: number; limit: number; live_engines: number; next_slot_in_s: number | null };
  drafts_today: { used: number; limit: number; enabled: boolean } };
export type Alert = { id: number; client_id: number; kind: "drop" | "gain"; message: string; read: boolean; created_at: string };
export type Suggestion = { text: string; category: string };

export type ScanEngine = {
  engine: string; mode: "live" | "demo"; total: number; done: number; failed: number; queued: number; running: number; analyzing: number;
  mentioned: number; avg_latency_ms: number | null;
};
export type ScanItem = {
  id: number; prompt_id: number; prompt: string; engine: string; status: RunStatus; is_mock: boolean; brand_mentioned: boolean;
  position: number | null; sentiment: number | null; latency_ms: number; error: string | null; brands: { name: string; is_client: boolean }[];
};
export type ScanStatus = {
  active: boolean; total: number; max_concurrent?: number; engine_modes: Record<string, "live" | "demo">;
  started_at?: string; done?: number; failed?: number; queued?: number; running?: number; analyzing?: number; prompts?: number; mentioned?: number;
  engines?: ScanEngine[]; items?: ScanItem[];
};

export type GapAction = {
  id: string; priority: "high" | "medium" | "low"; kind: "source" | "content" | "brand" | "engine" | "competitor" | "setup";
  title: string; why: string; steps: string[]; impact: number;
  evidence: { domains?: string[]; prompts?: string[]; competitors?: string[]; engines?: string[]; pages?: { url: string; title: string | null }[] };
};
export type GapAnalysis =
  | { has_data: false; days: number }
  | {
    has_data: true; days: number; has_mock: boolean; mock_pct: number;
    summary: { answers: number; prompts: number; prompts_with_gap: number; invisible_prompts: number; losing_answers: number; losing_pct: number; visibility: number; top_competitor: string | null; weakest_engine: string | null };
    actions: GapAction[];
    prompt_gaps: { prompt_id: number; text: string; category: string | null; runs: number; visibility: number; missing_runs: number; competitors: { name: string; count: number }[]; engines_missing: string[]; top_sources: string[] }[];
    source_gaps: { domain: string; category: string; category_label: string; gap_answers: number; client_answers: number; examples: { url: string; title: string | null }[]; prompts: string[] }[];
    competitors: { name: string; answers: number; top_sources: string[] }[];
    engines: { engine: string; runs: number; visibility: number; vs_overall: number }[];
  };
export type Draft = { id: number; action_id: string; content: string; model: string; created_at: string };
