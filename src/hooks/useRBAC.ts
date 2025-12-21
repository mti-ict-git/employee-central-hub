import { useEffect, useState } from "react";
import { computeCapabilities, fetchPermissions, fetchColumnAccess } from "@/lib/rbac";

export function useRBAC() {
  const [ready, setReady] = useState(false);
  const [caps, setCaps] = useState<ReturnType<typeof computeCapabilities> | null>(null);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const stored = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
      const parsed = stored ? JSON.parse(stored) : null;
      const roles: string[] = Array.isArray(parsed?.roles) ? parsed.roles : (parsed?.role ? [parsed.role] : []);
      const perms = await fetchPermissions();
      const cols = await fetchColumnAccess();
      const c = computeCapabilities(roles, perms, cols);
      if (mounted) {
        setCaps(c);
        setReady(true);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);
  return { ready, caps };
}
