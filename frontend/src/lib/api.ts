const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010/api";
const KEY = "bv_token";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(KEY)),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

type Opts = { method?: string; body?: unknown };

async function raw(path: string, { method = "GET", body }: Opts = {}) {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: { msg: string }) => d.msg).join(", ") : msg;
    } catch {}
    if (res.status === 401 && token && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      tokenStore.clear();
      window.location.assign("/login");
    }
    throw new ApiError(res.status, msg);
  }
  return res;
}

export async function api<T>(path: string, opts?: Opts): Promise<T> {
  const res = await raw(path, opts);
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function downloadFile(path: string, filename: string) {
  const blob = await (await raw(path)).blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
