import { readStoredAuthUser } from "@/lib/auth-user";

export type ThemePref = "light" | "dark" | "system";
export type PalettePref = "corporate" | "emerald" | "violet" | "rose" | "amber";

export type CachedUiPrefs = {
  theme?: ThemePref;
  palette?: PalettePref;
};

export function normalizeThemePref(value: unknown): ThemePref | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "light" || v === "dark" || v === "system") return v;
  return null;
}

export function normalizePalettePref(value: unknown): PalettePref | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "corporate" || v === "default" || v === "blue") return "corporate";
  if (v === "emerald" || v === "violet" || v === "rose" || v === "amber") return v;
  return null;
}

function getAnonymousSessionId() {
  if (typeof window === "undefined") return "anonymous:ssr";
  const key = "ui_prefs_anonymous_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const generated = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(key, generated);
  return generated;
}

export function getUiPrefsCacheKey() {
  if (typeof window === "undefined") return "ui_prefs:anonymous";
  const user = readStoredAuthUser();
  const who = (user?.username || user?.displayName || "").trim().toLowerCase();
  if (who) return `ui_prefs:${who}`;
  return `ui_prefs:anonymous:${getAnonymousSessionId()}`;
}

export function readCachedUiPrefs(): CachedUiPrefs {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(getUiPrefsCacheKey());
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const obj = parsed as Record<string, unknown>;
    return {
      theme: normalizeThemePref(obj.theme) || undefined,
      palette: normalizePalettePref(obj.palette) || undefined,
    };
  } catch {
    return {};
  }
}

export function writeCachedUiPrefs(next: CachedUiPrefs) {
  if (typeof window === "undefined") return;
  const key = getUiPrefsCacheKey();
  const prev = readCachedUiPrefs();
  const payload: CachedUiPrefs = {
    theme: next.theme ?? prev.theme,
    palette: next.palette ?? prev.palette,
  };
  localStorage.setItem(key, JSON.stringify(payload));
}
