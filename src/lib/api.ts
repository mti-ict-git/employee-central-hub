export const API_BASE = import.meta.env.VITE_API_URL || "/api";
const FALLBACK_PORT = import.meta.env.VITE_BACKEND_PORT || import.meta.env.VITE_SERVER_PORT || "8083";
const FALLBACK_BASE = `http://localhost:${FALLBACK_PORT}/api`;

export const apiFetch = async (path: string, init?: RequestInit) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const candidates = [API_BASE];
  if (API_BASE !== "/api") candidates.push("/api");
  if (!candidates.includes(FALLBACK_BASE)) candidates.push(FALLBACK_BASE);
  let lastResponse: Response | null = null;
  let lastError: unknown = null;
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}${p}`, { ...init, headers });
      if (res.status !== 404) return res;
      if (!lastResponse) lastResponse = res;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("NETWORK_ERROR");
};
