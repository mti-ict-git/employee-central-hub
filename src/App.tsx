import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";

const queryClient = new QueryClient();

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
              path="/settings/rbac-diagnostics"
              element={
                <RequireAuth>
                  <RequireRole allowed={["admin", "superadmin"]}>
                    <RbacDiagnostics />
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
