import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export const ENGINES: Record<string, { label: string; color: string }> = {
  chatgpt: { label: "ChatGPT", color: "#3ee6a8" },
  google_aio: { label: "Google AI", color: "#ffb454" },
};

/** The API sends UTC timestamps, sometimes without a "Z" (SQLite). Treat them as UTC either way. */
export const parseUtc = (s: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}Z`);
export const fmtDate = (s: string | null | undefined) =>
  s ? parseUtc(s).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";
export const fmtDateTime = (s: string) =>
  parseUtc(s).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const ACTIVE = ["pending", "running", "analyzing"];

/** Turns raw engine errors into something a person can act on. */
export function friendlyError(err: string | null | undefined): string {
  if (!err) return "Something went wrong.";
  if (/401|403|unauthori|forbidden|invalid.*key|api key/i.test(err)) return "The engine rejected the API key. Check the key in backend/.env and restart the API.";
  if (/no longer available|404|not found|not supported/i.test(err)) return "The model name isn't available for this key. Update the model in backend/.env (see the README).";
  if (/429|rate|quota|credit|billing/i.test(err)) return "Quota or rate limit reached for this engine. Check the plan and billing on that provider's dashboard, or wait a minute.";
  if (/503|overload|high demand|unavailable/i.test(err)) return "The engine is overloaded right now. This is temporary; run the scan again shortly.";
  if (/timeout|timed out/i.test(err)) return "The engine took too long to answer (over 3 minutes).";
  if (/Interrupted/i.test(err)) return err;
  if (/5\d\d|server error|connect/i.test(err)) return "The engine's service had an error. Try again shortly.";
  return err.length > 160 ? `${err.slice(0, 160)}…` : err;
}

export const fmtDuration = (sec: number) => (sec < 60 ? `${Math.max(0, Math.round(sec))}s` : `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`);
