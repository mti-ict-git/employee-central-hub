import React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEffect, useState } from "react";
import { fetchPermissions, fetchRoles, RolePermission } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ColumnAccessContent } from "./ColumnAccess";

export default function AdminPermissions() {
  const [items, setItems] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  type Draft = Record<string, Record<string, boolean>>;
  const [draft, setDraft] = useState<Draft>({});
  const actions: Array<{ key: "read"|"create"|"update"|"delete"|"manage_users"; label: string }> = [
    { key: "read", label: "Read" },
    { key: "create", label: "Create" },
    { key: "update", label: "Update" },
    { key: "delete", label: "Delete" },
    { key: "manage_users", label: "Manage Users" },
  ];

  const buildDraft = (rs: string[], perms: RolePermission[]): Draft => {
    const d: Draft = {};
    for (const r of rs) {
      d[r] = { read: false, create: false, update: false, delete: false, manage_users: false };
    }
    for (const p of perms) {
      if (!d[p.role]) continue;
      if (p.module === "employees" && (p.action === "read" || p.action === "create" || p.action === "update" || p.action === "delete")) {
        d[p.role][p.action] = !!p.allowed;
      }
      if (p.module === "users" && p.action === "manage_users") {
        d[p.role].manage_users = !!p.allowed;
      }
    }
    return d;
  };

  const reload = async () => {
    const [perms, rs] = await Promise.all([fetchPermissions(), fetchRoles()]);
    setItems(perms);
    setRoles(rs);
    setDraft(buildDraft(rs, perms));
    setDirty(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const onToggleLocal = (role: string, action: keyof Draft[string]) => {
    setDraft((prev) => {
      const next: Draft = { ...prev, [role]: { ...prev[role], [action]: !prev[role][action] } };
      return next;
    });
    setDirty(true);
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      const jobs: Promise<Response>[] = [];
      for (const role of roles) {
        if (!draft[role]) continue;
        for (const act of ["read","create","update","delete"] as const) {
          jobs.push(
            apiFetch(`/rbac/permissions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ role, module: "employees", action: act, allowed: !!draft[role][act] }),
            })
          );
        }
        jobs.push(
          apiFetch(`/rbac/permissions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role, module: "users", action: "manage_users", allowed: !!draft[role].manage_users }),
          })
        );
      }
      await Promise.all(jobs);
      await reload();
      toast({ title: "Saved", description: "Employee Management permissions updated" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save permissions", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <MainLayout title="Employee Management Permissions">
      <Tabs defaultValue="matrix" className="animate-fade-in">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="matrix">Role Matrix</TabsTrigger>
          <TabsTrigger value="columns">Column Access</TabsTrigger>
        </TabsList>
        <TabsContent value="matrix">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-end mb-4 gap-2">
              <Button variant="outline" onClick={reload} disabled={saving}>Reset</Button>
              <Button onClick={saveAll} disabled={!dirty || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            <div className="grid grid-cols-[200px_repeat(5,160px)] gap-4">
              <div className="text-sm font-semibold">Role</div>
              {actions.map((c) => (
                <div key={c.key} className="text-sm font-semibold">{c.label}</div>
              ))}
              {roles.map((role) => (
                <React.Fragment key={role}>
                  <div className="py-2">
                    <span className="px-2 py-1 rounded-full bg-muted text-xs">{role}</span>
                  </div>
                  {actions.map((c) => (
                    <div key={`${role}-${c.key}`} className="py-2 flex items-center">
                      <Switch checked={!!draft[role]?.[c.key]} onCheckedChange={() => onToggleLocal(role, c.key)} />
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="columns">
          <ColumnAccessContent />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
