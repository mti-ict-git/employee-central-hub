import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type RequireRoleProps = {
  allowed: string[];
  children: ReactNode;
};

export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const { toast } = useToast();
  let role: string | null = null;
  let roles: string[] = [];
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
    const parsed = stored ? JSON.parse(stored) : null;
    role = parsed?.role ?? null;
    roles = Array.isArray(parsed?.roles) ? parsed.roles : (role ? [role] : []);
  } catch {
    role = null;
    roles = [];
  }
  if (!roles.length) return <Navigate to="/" replace />;

  if (!roles.some((r) => allowed.includes(r))) {
    // Provide a subtle feedback, then redirect
    toast({
      title: "Access denied",
      description: "You do not have permission to view this page.",
    });
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
