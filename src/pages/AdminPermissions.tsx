import { MainLayout } from "@/components/layout/MainLayout";
import { useEffect, useState } from "react";
import { fetchPermissions, RolePermission } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AdminPermissions() {
  const [items, setItems] = useState<RolePermission[]>([]);
  useEffect(() => {
    const run = async () => {
      const perms = await fetchPermissions();
      setItems(perms);
    };
    run();
  }, []);
  const roles = Array.from(new Set(items.map((p) => p.role)));
  const cols: { key: string; label: string }[] = [
    { key: "read", label: "Read" },
    { key: "create", label: "Create" },
    { key: "update", label: "Update" },
    { key: "delete", label: "Delete" },
    { key: "manage_users", label: "Manage Users" },
    { key: "export", label: "Export" },
  ];
  const check = (role: string, action: string) =>
    items.some((p) => p.role === role && ((p.action === action && p.module === "employees") || (p.action === action && p.module === "users") || (p.action === action && p.module === "reports")) && p.allowed);
  const toggle = async (role: string, action: string) => {
    const modules: ("employees"|"users"|"reports")[] = action === "manage_users" ? ["users"] : action === "export" ? ["reports"] : ["employees"];
    const allowed = !check(role, action);
    for (const module of modules) {
      await apiFetch(`/rbac/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role, module, action, allowed }),
      });
    }
    const next = await fetchPermissions();
    setItems(next);
  };
  return (
    <MainLayout title="System Administration Permissions">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="grid grid-cols-[200px_repeat(6,120px)] gap-4">
          <div className="text-sm font-semibold">Role</div>
          {cols.map((c) => (
            <div key={c.key} className="text-sm font-semibold">{c.label}</div>
          ))}
          {roles.map((role) => (
            <>
              <div className="py-2">
                <span className="px-2 py-1 rounded-full bg-muted text-xs">{role}</span>
              </div>
              {cols.map((c) => (
                <div key={c.key} className="py-2">
                  <Button variant={check(role, c.key) ? "default" : "outline"} size="sm" onClick={() => toggle(role, c.key)}>
                    {check(role, c.key) ? "On" : "Off"}
                  </Button>
                </div>
              ))}
            </>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Read-only view. Policies are enforced by backend and sourced from database.</p>
      </div>
    </MainLayout>
  );
}
