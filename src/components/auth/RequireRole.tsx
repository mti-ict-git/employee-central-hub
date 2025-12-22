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
    role = parsed?.role ? String(parsed.role).toLowerCase() : null;
    roles = Array.isArray(parsed?.roles) ? parsed.roles.map((r: string) => String(r).toLowerCase()) : (role ? [role] : []);
  } catch {
    role = null;
    roles = [];
  }
  if (!roles.length) return <Navigate to="/" replace />;

  const allowedNorm = allowed.map((a) => a.toLowerCase());
  if (!roles.some((r) => allowedNorm.includes(r))) {
    // Provide a subtle feedback, then redirect
    toast({
      title: "Access denied",
      description: "You do not have permission to view this page.",
    });
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
