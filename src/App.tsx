import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import EmployeeList from "./pages/EmployeeList";
import EmployeeDetail from "./pages/EmployeeDetail";
import EditEmployee from "./pages/EditEmployee";
import AddEmployee from "./pages/AddEmployee";
import ImportEmployees from "./pages/ImportEmployees";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";

const queryClient = new QueryClient();

const App = () => (
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
