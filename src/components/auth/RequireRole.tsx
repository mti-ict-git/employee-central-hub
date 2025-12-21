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
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
    const parsed = stored ? JSON.parse(stored) : null;
    role = parsed?.role ?? null;
  } catch {
    role = null;
  }
  if (!role) return <Navigate to="/" replace />;

  if (!allowed.includes(role)) {
    // Provide a subtle feedback, then redirect
    toast({
      title: "Access denied",
      description: "You do not have permission to view this page.",
    });
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
