import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type RequireRoleProps = {
  allowed: string[];
  children: ReactNode;
};

export default function RequireRole({ allowed, children }: RequireRoleProps) {
  const [role, setRole] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setRole(parsed?.role ?? null);
      }
    } catch {
      setRole(null);
    }
  }, []);

  if (!role) {
    return <Navigate to="/" replace />;
  }

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