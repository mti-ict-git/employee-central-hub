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
import { TypeAccessContent } from "./TypeAccess";

export default function AdminPermissions() {
  const [items, setItems] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  type Draft = Record<string, Record<string, boolean>>;
  const [draft, setDraft] = useState<Draft>({});
  const actions: Array<{ key: "read"|"create"|"update"|"delete"|"manage_users"|"report_read"|"report_export"; label: string }> = [
    { key: "read", label: "Read" },
    { key: "create", label: "Create" },
    { key: "update", label: "Update" },
    { key: "delete", label: "Delete" },
    { key: "manage_users", label: "Manage Users" },
    { key: "report_read", label: "Reports: Read" },
    { key: "report_export", label: "Reports: Export" },
  ];

  const buildDraft = (rs: string[], perms: RolePermission[]): Draft => {
    const d: Draft = {};
    for (const r of rs) {
      d[r] = { read: false, create: false, update: false, delete: false, manage_users: false, report_read: false, report_export: false };
    }
    for (const p of perms) {
      if (!d[p.role]) continue;
      if (p.module === "employees" && (p.action === "read" || p.action === "create" || p.action === "update" || p.action === "delete")) {
        d[p.role][p.action] = !!p.allowed;
      }
      if (p.module === "users" && p.action === "manage_users") {
        d[p.role].manage_users = !!p.allowed;
      }
      if (p.module === "reports" && p.action === "read") {
        d[p.role].report_read = !!p.allowed;
      }
      if (p.module === "reports" && p.action === "export") {
        d[p.role].report_export = !!p.allowed;
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
      const jobs: Array<{ role: string; module: string; action: string; allowed: boolean }> = [];
      for (const role of roles) {
        if (!draft[role]) continue;
        for (const act of ["read","create","update","delete"] as const) {
          jobs.push({ role, module: "employees", action: act, allowed: !!draft[role][act] });
        }
        jobs.push({ role, module: "users", action: "manage_users", allowed: !!draft[role].manage_users });
        jobs.push({ role, module: "reports", action: "read", allowed: !!draft[role].report_read });
        jobs.push({ role, module: "reports", action: "export", allowed: !!draft[role].report_export });
      }
      const results = await Promise.allSettled(
        jobs.map((j) =>
          apiFetch(`/rbac/permissions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(j),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              const msg = data?.error || `HTTP_${res.status}`;
              throw new Error(`${j.role}/${j.module}/${j.action}: ${msg}`);
            }
            return true;
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      if (failed.length) {
        const first = failed[0].reason instanceof Error ? failed[0].reason.message : String(failed[0].reason);
        throw new Error(first);
      }
      await reload();
      toast({ title: "Saved", description: "Permissions updated" });
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
          <TabsTrigger value="types">Indonesia VS Expat</TabsTrigger>
        </TabsList>
        <TabsContent value="matrix">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-end mb-4 gap-2">
              <Button variant="outline" onClick={reload} disabled={saving}>Reset</Button>
              <Button onClick={saveAll} disabled={!dirty || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            <div className="w-full overflow-x-auto">
              <div className="grid grid-cols-[minmax(140px,1fr)_repeat(7,minmax(120px,1fr))] gap-4 min-w-[900px]">
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
          </div>
        </TabsContent>
        <TabsContent value="columns">
          <ColumnAccessContent />
        </TabsContent>
        <TabsContent value="types">
          <TypeAccessContent />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
