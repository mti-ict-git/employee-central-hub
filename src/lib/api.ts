export const API_BASE = import.meta.env.VITE_API_URL || "/api";
const FALLBACK_PORT = import.meta.env.VITE_BACKEND_PORT || import.meta.env.VITE_SERVER_PORT || "8083";
const FALLBACK_BASE = `http://localhost:${FALLBACK_PORT}/api`;

export const apiFetch = async (path: string, init?: RequestInit) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const primary = await fetch(`${API_BASE}${p}`, { ...init, headers });
  if (primary.status !== 404) return primary;
  if (API_BASE === "/api") {
    try {
      const fallback = await fetch(`${FALLBACK_BASE}${p}`, { ...init, headers });
      return fallback;
    } catch {
      // swallow and return original 404
    }
  }
  return primary;
};
