import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { fetchRoles, fetchColumnAccess, type ColumnAccess } from "@/lib/rbac";
import { Switch } from "@/components/ui/switch";

type MappingRow = {
  excel: { table: string; column: string; excelName?: string };
  matched?: { table?: string; column?: string; type?: string };
};

type ColumnDef = {
  section: string;
  column: string;
  label: string;
  type: string;
};

type Draft = Record<string, Record<string, Record<string, { read: boolean; write: boolean }>>>;

function toLabel(s: string) {
  const raw = String(s || "").trim();
  const withoutEmployeePrefix = (() => {
    const lower = raw.toLowerCase();
    if (lower.startsWith("employee ")) return raw.slice("employee ".length);
    if (lower.startsWith("employee_")) return raw.slice("employee_".length);
    return raw;
  })();
  const name = withoutEmployeePrefix.replace(/_/g, " ").trim();
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function canonicalGroup(section: string) {
  const s = String(section || "");
  const withoutPrefix = s.startsWith("Employee ") ? s.slice("Employee ".length) : s;
  const base = withoutPrefix.trim();
  if (base.toLowerCase() === "core") return "Personal";
  if (base.toLowerCase() === "onboard") return "Onboarding";
  return base;
}

export function ColumnAccessContent() {
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [access, setAccess] = useState<ColumnAccess[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const load = async () => {
    const [rs, ac] = await Promise.all([fetchRoles(), fetchColumnAccess()]);
    setRoles(rs);
    setAccess(ac);
    const mapRes = await apiFetch(`/mapping/dbinfo`, { credentials: "include" });
    const raw = await mapRes.json().catch(() => []);
    const rows = Array.isArray(raw) ? (raw as MappingRow[]) : [];
    const cols: ColumnDef[] = rows.map((r) => {
      const section = toLabel(r.excel.table || "");
      const column = String(r.excel.column || "");
      const label = r.excel.excelName ? String(r.excel.excelName) : toLabel(column);
      const type = r.matched?.type ? String(r.matched.type) : "";
      return { section, column, label, type };
    });
    const dedup = new Map<string, ColumnDef>();
    for (const c of cols) {
      const key = `${c.section}::${c.column}`;
      if (!dedup.has(key)) dedup.set(key, c);
    }
    setColumns([...dedup.values()]);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedRole && roles.length) setSelectedRole(roles[0]);
  }, [roles, selectedRole]);

  const draft: Draft = useMemo(() => {
    const d: Draft = {};
    for (const role of roles) {
      if (!d[role]) d[role] = {};
      for (const c of columns) {
        if (!d[role][c.section]) d[role][c.section] = {};
        d[role][c.section][c.column] = { read: false, write: false };
      }
    }
    for (const a of access) {
      const role = a.role;
      const section = toLabel(a.section);
      const column = a.column;
      if (!d[role]) d[role] = {};
      if (!d[role][section]) d[role][section] = {};
      const cur = d[role][section][column] || { read: false, write: false };
      d[role][section][column] = { read: !!a.read, write: !!a.write || cur.write };
    }
    return d;
  }, [roles, columns, access]);

  const filtered = useMemo(() => {
    const g = group.toLowerCase();
    const q = query.toLowerCase();
    const s = status.toLowerCase();
    return columns.filter((c) => {
      const gmatch = g === "all" || canonicalGroup(c.section).toLowerCase() === g;
      const qmatch = !q || c.label.toLowerCase().includes(q) || c.column.toLowerCase().includes(q);
      const state = draft[selectedRole]?.[c.section]?.[c.column] || { read: false, write: false };
      const smatch =
        s === "all" ||
        (s === "view_on" && !!state.read) ||
        (s === "view_off" && !state.read) ||
        (s === "edit_on" && !!state.write) ||
        (s === "edit_off" && !state.write);
      return gmatch && qmatch && smatch;
    });
  }, [columns, group, query, status, selectedRole, draft]);

  const toggle = (section: string, column: string, mode: "read" | "write") => {
    setAccess((prev) => {
      const exists = prev.find((r) => r.role === selectedRole && toLabel(r.section) === section && r.column === column);
      const next = [...prev];
      if (exists) {
        if (mode === "write") {
          const newWrite = !exists.write;
          exists.write = newWrite;
          if (newWrite && !exists.read) exists.read = true;
        } else {
          const newRead = !exists.read;
          if (!newRead && exists.write) exists.write = false;
          exists.read = newRead;
        }
      } else {
        const createRead = mode === "write" ? true : mode === "read";
        const createWrite = mode === "write";
        next.push({ role: selectedRole, section, column, read: createRead, write: createWrite });
      }
      return next;
    });
    setDirty(true);
  };

  const bulkSet = (mode: "read" | "write", on: boolean) => {
    setAccess((prev) => {
      const next = [...prev];
      for (const c of filtered) {
        const exists = next.find((r) => r.role === selectedRole && toLabel(r.section) === c.section && r.column === c.column);
        if (exists) {
          if (mode === "read") {
            exists.read = on;
            if (!on) exists.write = false;
          } else {
            exists.write = on;
            if (on && !exists.read) exists.read = true;
          }
        } else {
          if (mode === "read") {
            if (on) next.push({ role: selectedRole, section: c.section, column: c.column, read: true, write: false });
          } else {
            if (on) next.push({ role: selectedRole, section: c.section, column: c.column, read: true, write: true });
          }
        }
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    try {
      setSaving(true);
      const items = access.filter((a) => a.role === selectedRole);
      const jobs: Promise<Response>[] = [];
      for (const a of items) {
        jobs.push(
          apiFetch(`/rbac/columns`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role: a.role,
              section: a.section,
              column: a.column,
              read: !!a.read,
              write: !!a.write,
            }),
          }),
        );
      }
      await Promise.all(jobs);
      const ac = await fetchColumnAccess();
      setAccess(ac);
      setDirty(false);
      toast({ title: "Saved", description: "Column access updated" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save column access", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const s = new Set<string>();
    for (const c of columns) s.add(canonicalGroup(c.section));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [columns]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Role</label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => (<SelectItem key={r} value={r}>{toLabel(r)}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Group</label>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => (<SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="view_on">View: Enabled</SelectItem>
              <SelectItem value="view_off">View: Disabled</SelectItem>
              <SelectItem value="edit_on">Edit: Enabled</SelectItem>
              <SelectItem value="edit_off">Edit: Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <Input placeholder="Filter columns..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
      {(() => {
        const allReadOn = filtered.length > 0 && filtered.every((c) => !!draft[selectedRole]?.[c.section]?.[c.column]?.read);
        const allWriteOn = filtered.length > 0 && filtered.every((c) => !!draft[selectedRole]?.[c.section]?.[c.column]?.write);
        return (
          <div className="mb-3 flex flex-wrap items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">View</span>
              <Switch
                className="data-[state=checked]:!bg-success"
                checked={allReadOn}
                disabled={filtered.length === 0}
                onCheckedChange={(checked) => bulkSet("read", checked)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Edit</span>
              <Switch
                className="data-[state=checked]:!bg-warning"
                checked={allWriteOn}
                disabled={filtered.length === 0}
                onCheckedChange={(checked) => bulkSet("write", checked)}
              />
            </div>
          </div>
        );
      })()}
      <div className="grid grid-cols-[1fr_repeat(2,160px)] gap-4">
        <div className="text-sm font-semibold">Column</div>
        <div className="text-sm font-semibold text-center">View</div>
        <div className="text-sm font-semibold text-center">Edit</div>
        {filtered.map((c) => {
          const state = draft[selectedRole]?.[c.section]?.[c.column] || { read: false, write: false };
          return (
            <div key={`${c.section}-${c.column}`} className="contents">
              <div className="py-2">
                <div className="text-xs text-muted-foreground">{canonicalGroup(c.section)}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.column}{c.type ? ` · ${c.type}` : ""}</span>
                </div>
              </div>
              <div className="py-2 flex justify-center">
                <Switch checked={state.read} onCheckedChange={() => toggle(c.section, c.column, "read")} />
              </div>
              <div className="py-2 flex justify-center">
                <Switch checked={state.write} onCheckedChange={() => toggle(c.section, c.column, "write")} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ColumnAccessPage() {
  return (
    <MainLayout title="Column Access" subtitle="Configure per-column view and edit permissions">
      <ColumnAccessContent />
    </MainLayout>
  );
}
