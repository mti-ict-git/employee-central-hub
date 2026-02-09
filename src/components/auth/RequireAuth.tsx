import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiFetch } from "@/lib/api";

type AuthStatus = "checking" | "authed" | "unauth";

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (typeof window === "undefined") return "checking";
    const token = localStorage.getItem("auth_token");
    const user = localStorage.getItem("auth_user");
    return token && user ? "checking" : "unauth";
  });

  useEffect(() => {
    if (status !== "checking") return;
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const user = localStorage.getItem("auth_user");
    if (!token || !user) {
      setStatus("unauth");
      return;
    }
    let cancelled = false;
    const clearAuth = () => {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_last_activity");
      sessionStorage.removeItem("auth_last_logged_in");
      sessionStorage.removeItem("auth_session_expired");
    };
    const run = async () => {
      try {
        const res = await apiFetch(`/users/me/preferences?key=theme`, {
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          clearAuth();
          if (!cancelled) setStatus("unauth");
          return;
        }
        if (!cancelled) setStatus("authed");
      } catch {
        if (!cancelled) setStatus("authed");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "unauth") {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (status === "checking") {
    return null;
  }

  return <>{children}</>;
};

export default RequireAuth;
