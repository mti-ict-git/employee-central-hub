import { useEffect, useState } from "react";
import { computeCapabilities, fetchPermissions, fetchColumnAccess, fetchTypeColumnAccess, buildTypeAccessIndex } from "@/lib/rbac";

export function useRBAC() {
  const [ready, setReady] = useState(false);
  const [caps, setCaps] = useState<ReturnType<typeof computeCapabilities> | null>(null);
  const [typeAccess, setTypeAccess] = useState<Record<"indonesia" | "expat", Record<string, Record<string, boolean>>>>({ indonesia: {}, expat: {} });
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const stored = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
      const parsed = stored ? JSON.parse(stored) : null;
      const rolesRaw: string[] = Array.isArray(parsed?.roles) ? parsed.roles : (parsed?.role ? [parsed.role] : []);
      const roles: string[] = rolesRaw.map((r) => {
        const s = String(r || "").trim().toLowerCase();
        if (s.includes("super")) return "superadmin";
        if (s === "admin") return "admin";
        if (s.includes("hr")) return "hr_general";
        if (s.includes("finance")) return "finance";
        if (s.includes("dep")) return "department_rep";
        if (s.includes("employee")) return "employee";
        return s;
      });
      const perms = await fetchPermissions();
      const cols = await fetchColumnAccess();
      const types = await fetchTypeColumnAccess();
      const c = computeCapabilities(roles, perms, cols);
      if (mounted) {
        setCaps(c);
        setTypeAccess(buildTypeAccessIndex(types));
        setReady(true);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);
  return { ready, caps, typeAccess };
}
