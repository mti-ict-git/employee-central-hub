import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type TypeName = "indonesia" | "expat";

type MappingRow = {
  excel: { table: string; column: string; excelName?: string };
  matched?: { table?: string; column?: string; type?: string };
};

type TypeMapRow = { section: string; column: string; indonesia: boolean; expat: boolean };

type ColumnDef = {
  section: string;
  column: string;
  label: string;
  type: string;
};

type AccessItem = { type: TypeName; section: string; column: string; accessible: boolean };
type Draft = Record<TypeName, Record<string, Record<string, boolean>>>;

function toLabel(s: string) {
  const name = s.replace(/_/g, " ").trim();
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function TypeAccessContent() {
  const [selectedType, setSelectedType] = useState<TypeName>("indonesia");
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [access, setAccess] = useState<AccessItem[]>([]);
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    try {
      const [dbinfoRes, typeRes, savedRes] = await Promise.all([
        apiFetch(`/mapping/dbinfo`, { credentials: "include" }),
        apiFetch(`/mapping/type-columns`, { credentials: "include" }),
        apiFetch(`/rbac/type_columns`, { credentials: "include" }),
      ]);
      const dbinfoRaw = await dbinfoRes.json().catch(() => []);
      const typeRaw = await typeRes.json().catch(() => []);
      const savedRaw = await savedRes.json().catch(() => []);
      const dbRows = Array.isArray(dbinfoRaw) ? (dbinfoRaw as MappingRow[]) : [];
      const typeRows = Array.isArray(typeRaw) ? (typeRaw as TypeMapRow[]) : [];
      const savedRows = Array.isArray(savedRaw) ? (savedRaw as AccessItem[]) : [];
      const typeIndex = new Map<string, TypeMapRow>();
      for (const r of typeRows) {
        typeIndex.set(`${toLabel(r.section)}::${r.column}`, { section: toLabel(r.section), column: r.column, indonesia: !!r.indonesia, expat: !!r.expat });
      }
      const cols: ColumnDef[] = dbRows.map((r) => {
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
      const final = Array.from(dedup.values());
      setColumns(final);
      if (savedRows.length) {
        const next: AccessItem[] = [];
        for (const c of final) {
          const iKey = `indonesia::${c.section}::${c.column}`;
          const eKey = `expat::${c.section}::${c.column}`;
          const iFind = savedRows.find((r) => `${r.type}::${r.section}::${r.column}` === iKey);
          const eFind = savedRows.find((r) => `${r.type}::${r.section}::${r.column}` === eKey);
          next.push({ type: "indonesia", section: c.section, column: c.column, accessible: !!iFind?.accessible });
          next.push({ type: "expat", section: c.section, column: c.column, accessible: !!eFind?.accessible });
        }
        setAccess(next);
      } else {
        const next: AccessItem[] = [];
        for (const c of final) {
          const key = `${c.section}::${c.column}`;
          const t = typeIndex.get(key);
          next.push({ type: "indonesia", section: c.section, column: c.column, accessible: t ? !!t.indonesia : false });
          next.push({ type: "expat", section: c.section, column: c.column, accessible: t ? !!t.expat : false });
        }
        setAccess(next);
      }
      setDirty(false);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load type mappings", variant: "destructive" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const draft: Draft = useMemo(() => {
    const d: Draft = { indonesia: {}, expat: {} };
    for (const c of columns) {
      if (!d.indonesia[c.section]) d.indonesia[c.section] = {};
      if (!d.expat[c.section]) d.expat[c.section] = {};
      d.indonesia[c.section][c.column] = false;
      d.expat[c.section][c.column] = false;
    }
    for (const a of access) {
      const section = a.section;
      const column = a.column;
      if (!d[a.type][section]) d[a.type][section] = {};
      d[a.type][section][column] = !!a.accessible;
    }
    return d;
  }, [columns, access]);

  const filtered = useMemo(() => {
    const g = group.toLowerCase();
    const q = query.toLowerCase();
    return columns.filter((c) => {
      const gmatch = g === "all" || c.section.toLowerCase() === g;
      const qmatch = !q || c.label.toLowerCase().includes(q) || c.column.toLowerCase().includes(q);
      return gmatch && qmatch;
    });
  }, [columns, group, query]);

  const toggle = (section: string, column: string) => {
    setAccess((prev) => {
      const idx = prev.findIndex((r) => r.type === selectedType && r.section === section && r.column === column);
      const next = [...prev];
      if (idx >= 0) {
        const item = { ...next[idx] };
        item.accessible = !item.accessible;
        next[idx] = item;
      } else {
        next.push({ type: selectedType, section, column, accessible: true });
      }
      return next;
    });
    setDirty(true);
  };

  const bulkSet = (on: boolean) => {
    setAccess((prev) => {
      const next = [...prev];
      for (const c of filtered) {
        const idx = next.findIndex((r) => r.type === selectedType && r.section === c.section && r.column === c.column);
        if (idx >= 0) {
          const item = { ...next[idx] };
          item.accessible = on;
          next[idx] = item;
        } else {
          if (on) next.push({ type: selectedType, section: c.section, column: c.column, accessible: true });
        }
      }
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    try {
      const items = access.filter((a) => a.type === selectedType);
      const jobs: Promise<Response>[] = [];
      for (const a of items) {
        jobs.push(
          apiFetch(`/rbac/type_columns`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: a.type,
              section: a.section,
              column: a.column,
              accessible: !!a.accessible,
            }),
          }),
        );
      }
      await Promise.all(jobs);
      const savedRes = await apiFetch(`/rbac/type_columns`, { credentials: "include" });
      const savedRaw = await savedRes.json().catch(() => []);
      const savedRows = Array.isArray(savedRaw) ? (savedRaw as AccessItem[]) : [];
      setAccess(savedRows);
      setDirty(false);
      toast({ title: "Saved", description: "Type-based column access updated" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save type-based access", variant: "destructive" });
    }
  };

  const groups = useMemo(() => {
    const s = new Set<string>();
    for (const c of columns) s.add(c.section);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [columns]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as TypeName)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="indonesia">Indonesia</SelectItem>
              <SelectItem value="expat">Expat</SelectItem>
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
        <div className="md:col-span-2 flex items-end justify-end gap-2">
          <Input placeholder="Filter columns..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button onClick={save} disabled={!dirty}>Save Changes</Button>
        </div>
      </div>
      {(() => {
        const allAccessibleOn = filtered.length > 0 && filtered.every((c) => !!draft[selectedType]?.[c.section]?.[c.column]);
        return (
          <div className="mb-3 flex flex-wrap items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Accessible</span>
              <Switch
                className="data-[state=checked]:!bg-success"
                checked={allAccessibleOn}
                disabled={filtered.length === 0}
                onCheckedChange={(checked) => bulkSet(checked)}
              />
            </div>
          </div>
        );
      })()}
      <div className="grid grid-cols-[1fr_160px] gap-4">
        <div className="text-sm font-semibold">Column</div>
        <div className="text-sm font-semibold text-center">Accessible</div>
        {filtered.map((c) => {
          const accessible = !!draft[selectedType]?.[c.section]?.[c.column];
          return (
            <div key={`${c.section}-${c.column}`} className="contents">
              <div className="py-2">
                <div className="text-xs text-muted-foreground">{c.section}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.column}{c.type ? ` · ${c.type}` : ""}</span>
                </div>
              </div>
              <div className="py-2 flex justify-center">
                <Switch checked={accessible} onCheckedChange={() => toggle(c.section, c.column)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TypeAccessPage() {
  return (
    <MainLayout title="Indonesia VS Expat" subtitle="View and adjust type-based column applicability">
      <TypeAccessContent />
    </MainLayout>
  );
}
