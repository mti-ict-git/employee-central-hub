import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTheme } from "next-themes";
import Index from "./pages/Index";
import EmployeeList from "./pages/EmployeeList";
import EmployeeDetail from "./pages/EmployeeDetail";
import EditEmployee from "./pages/EditEmployee";
import AddEmployee from "./pages/AddEmployee";
import ImportEmployees from "./pages/ImportEmployees";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import AdminPermissions from "./pages/AdminPermissions";
import RbacDiagnostics from "./pages/RbacDiagnostics";
import ReportsPage from "./pages/Reports";
import SyncSettings from "./pages/SyncSettings";
import AddColumn from "./pages/AddColumn";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";
import { apiFetch } from "@/lib/api";

const queryClient = new QueryClient();
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_CHECK_MS = 60 * 1000;

type StoredAuthUser = {
  username?: string;
  displayName?: string;
  role?: string;
  roles?: string[];
};

function readStoredAuthUser(): StoredAuthUser | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const roles = Array.isArray(obj.roles) ? obj.roles.map((r) => String(r)) : undefined;
    return {
      username: obj.username ? String(obj.username) : undefined,
      displayName: obj.displayName ? String(obj.displayName) : undefined,
      role: obj.role ? String(obj.role) : undefined,
      roles,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeThemePref(value: unknown): "light" | "dark" | "system" | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "light" || v === "dark" || v === "system") return v;
  return null;
}

type PalettePref = "corporate" | "emerald" | "violet" | "rose" | "amber";

const PALETTE_CLASS_BY_PREF: Record<Exclude<PalettePref, "corporate">, string> = {
  emerald: "theme-emerald",
  violet: "theme-violet",
  rose: "theme-rose",
  amber: "theme-amber",
};

function normalizePalettePref(value: unknown): PalettePref | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "corporate" || v === "default" || v === "blue") return "corporate";
  if (v === "emerald" || v === "violet" || v === "rose" || v === "amber") return v;
  return null;
}

function applyPalettePref(pref: PalettePref) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const allClasses = new Set<string>(Object.values(PALETTE_CLASS_BY_PREF));
  for (const c of allClasses) root.classList.remove(c);
  if (pref === "corporate") return;
  root.classList.add(PALETTE_CLASS_BY_PREF[pref]);
}

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  localStorage.removeItem("auth_last_activity");
  sessionStorage.removeItem("auth_last_logged_in");
}

const ThemePreferenceLoader = () => {
  const { setTheme } = useTheme();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;

    const ctrl = new AbortController();
    const run = async () => {
      const res = await apiFetch(`/users/me/preferences`, { signal: ctrl.signal, credentials: "include" });
      if (!res.ok) return;
      const body = (await res.json().catch(() => null)) as unknown;
      if (!isRecord(body)) return;
      const theme = normalizeThemePref(body.theme);
      if (theme) setTheme(theme);

      const palette = normalizePalettePref(body.palette);
      if (palette) applyPalettePref(palette);
    };

    run().catch(() => {});
    return () => ctrl.abort();
  }, [setTheme]);

  return null;
};

const App = () => {
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) {
      if (typeof window !== "undefined") sessionStorage.removeItem("auth_last_logged_in");
      return;
    }
    const user = readStoredAuthUser();
    if (!user) return;
    const username = user.username || user.displayName || "unknown";
    const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : (user.role ? [user.role] : []);
    const primaryRole = roles[0] || "unknown";

    const marker = `${username}|${primaryRole}`;
    const last = typeof window !== "undefined" ? sessionStorage.getItem("auth_last_logged_in") : null;
    if (last === marker) return;
    if (typeof window !== "undefined") sessionStorage.setItem("auth_last_logged_in", marker);

    console.info(`${username} is logged in with role ${primaryRole}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateActivity = () => {
      localStorage.setItem("auth_last_activity", String(Date.now()));
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
    const attach = () => {
      for (const event of events) window.addEventListener(event, updateActivity, { passive: true });
    };
    const detach = () => {
      for (const event of events) window.removeEventListener(event, updateActivity);
    };

    const token = localStorage.getItem("auth_token");
    if (!token) {
      localStorage.removeItem("auth_last_activity");
      return;
    }

    updateActivity();
    attach();

    const interval = window.setInterval(() => {
      const currentToken = localStorage.getItem("auth_token");
      if (!currentToken) return;
      const lastRaw = localStorage.getItem("auth_last_activity");
      const last = Number(lastRaw ?? "0");
      if (!last) {
        updateActivity();
        return;
      }
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        sessionStorage.setItem("auth_session_expired", "1");
        clearStoredAuth();
        window.location.replace("/auth");
      }
    }, IDLE_CHECK_MS);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "auth_token" && !event.newValue) {
        detach();
        window.clearInterval(interval);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      detach();
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemePreferenceLoader />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Index />
                </RequireAuth>
              }
            />
            <Route
              path="/employees"
              element={
                <RequireAuth>
                  <EmployeeList />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/new"
              element={
                <RequireAuth>
                  <AddEmployee />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/import"
              element={
                <RequireAuth>
                  <ImportEmployees />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequireAuth>
                  <EmployeeDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id/edit"
              element={
                <RequireAuth>
                  <EditEmployee />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route
              path="/settings/users"
              element={
                <RequireAuth>
                  <RequireRole allowed={["admin", "superadmin"]}>
                    <UserManagement />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/settings/admin-permissions"
              element={
                <RequireAuth>
                  <RequireRole allowed={["admin", "superadmin"]}>
                    <AdminPermissions />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/settings/columns/new"
              element={
                <RequireAuth>
                  <RequireRole allowed={["admin", "superadmin"]}>
                    <AddColumn />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/settings/rbac-diagnostics"
              element={
                <RequireAuth>
                  <RequireRole allowed={["superadmin"]}>
                    <RbacDiagnostics />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/settings/sync"
              element={
                <RequireAuth>
                  <RequireRole allowed={["admin", "superadmin"]}>
                    <SyncSettings />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth>
                  <ReportsPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
