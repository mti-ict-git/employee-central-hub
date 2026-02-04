import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type MappingRow = {
  excel?: { table?: string; column?: string; excelName?: string };
  matched?: { table?: string; column?: string; type?: string };
  status?: string | null;
};

const formatGroupLabel = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return trimmed;
  const withoutPrefix = trimmed.replace(/^employee[_\s-]+/i, "");
  if (!withoutPrefix) return withoutPrefix;
  return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
};

export default function AddColumn() {
  const [group, setGroup] = useState("");
  const [column, setColumn] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [customGroups, setCustomGroups] = useState<string[]>([]);

  const groupValue = group.trim();
  const columnValue = column.trim();
  const labelValue = label.trim();
  const typeValue = type.trim();
  const canSubmit = !!groupValue && !!columnValue && !saving;

  const loadMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/mapping/dbinfo`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      const list = Array.isArray(data) ? (data as MappingRow[]) : [];
      setRows(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load mappings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMappings();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/mapping/dbinfo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: groupValue,
          column: columnValue,
          label: labelValue || undefined,
          type: typeValue || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      toast({ title: "Column added", description: `${groupValue}.${columnValue} is now available` });
      setGroup("");
      setColumn("");
      setLabel("");
      setType("");
      await loadMappings();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add column",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const tableName = String(row.excel?.table || "").toLowerCase();
      const columnName = String(row.excel?.column || "").toLowerCase();
      const labelName = String(row.excel?.excelName || "").toLowerCase();
      const typeName = String(row.matched?.type || "").toLowerCase();
      return tableName.includes(q) || columnName.includes(q) || labelName.includes(q) || typeName.includes(q);
    });
  }, [query, rows]);

  const groups = useMemo(() => {
    const existing = new Set<string>();
    for (const row of rows) {
      const g = String(row.excel?.table || "").trim();
      if (g) existing.add(g);
    }
    for (const g of customGroups) existing.add(g);
    return Array.from(existing).sort((a, b) => a.localeCompare(b));
  }, [rows, customGroups]);

  const canCreateGroup = !!newGroup.trim();
  const createGroup = () => {
    const value = newGroup.trim();
    if (!value) return;
    setCustomGroups((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setGroup(value);
    setNewGroup("");
    setCreateOpen(false);
  };

  const typeOptions = [
    "varchar",
    "nvarchar",
    "text",
    "int",
    "bigint",
    "bit",
    "decimal",
    "date",
    "datetime",
    "datetime2",
    "time",
    "uniqueidentifier",
  ];

  const stats = useMemo(() => {
    const tables = new Set<string>();
    let manual = 0;
    for (const row of rows) {
      const t = String(row.excel?.table || "").trim();
      if (t) tables.add(t);
      if (String(row.status || "") === "manual_added") manual += 1;
    }
    return { total: rows.length, tables: tables.size, manual };
  }, [rows]);

  return (
    <MainLayout title="Add Column" subtitle="Pilih group existing untuk menambahkan column, atau buat group baru dari submenu">
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Column Details</CardTitle>
                  <CardDescription>Pilih group existing untuk menambahkan column. Gunakan format schema.group agar konsisten.</CardDescription>
                </div>
                <Collapsible open={createOpen} onOpenChange={setCreateOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline">Create Group</Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 w-[260px] rounded-lg border bg-background p-3">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="new-group">New Group</Label>
                        <Input
                          id="new-group"
                          value={newGroup}
                          onChange={(event) => setNewGroup(event.target.value)}
                          placeholder="dbo.employee"
                          autoComplete="off"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Button type="button" onClick={createGroup} disabled={!canCreateGroup}>Create</Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="group">Group</Label>
                    <Select value={group} onValueChange={setGroup}>
                      <SelectTrigger id="group">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {groups.map((g) => (
                          <SelectItem key={g} value={g}>{formatGroupLabel(g)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="column">Column</Label>
                    <Input
                      id="column"
                      value={column}
                      onChange={(event) => setColumn(event.target.value)}
                      placeholder="employee_id"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="label">Label (optional)</Label>
                    <Input
                      id="label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Employee ID"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type (optional)</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {typeOptions.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Isi tipe data kolom DB untuk referensi di Column Access.</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={!canSubmit}>
                    {saving ? "Saving..." : "Add Column"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Current scope of mappings available for permissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total mappings</p>
                    <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unique groups</p>
                    <p className="text-2xl font-semibold text-foreground">{stats.tables}</p>
                  </div>
                  <Badge variant="outline">Groups</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Manual additions</p>
                    <p className="text-2xl font-semibold text-foreground">{stats.manual}</p>
                  </div>
                  <Badge>Manual</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quick Guidelines</CardTitle>
                <CardDescription>Keep naming consistent to reduce duplicates.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Nama Group menentukan grouping di Column Access.</li>
                  <li>Gunakan format schema.group agar grouping konsisten, contoh dbo.employee.</li>
                  <li>Column sebaiknya nama kolom database, Label untuk tampilan manusia.</li>
                  <li>Type opsional, tapi membantu konteks di Column Access.</li>
                  <li>Group baru muncul setelah kamu membuat column pertamanya.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Existing Mappings</CardTitle>
                <CardDescription>Search across group, column, label, and type.</CardDescription>
              </div>
              <Button variant="outline" onClick={loadMappings} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search group, column, label, or type"
                autoComplete="off"
              />
            </div>
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          {loading ? "Loading mappings..." : "No mappings found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row, index) => (
                        <TableRow key={`${row.excel?.table || ""}-${row.excel?.column || ""}-${index}`}>
                          <TableCell className="font-medium">{formatGroupLabel(row.excel?.table || "-")}</TableCell>
                          <TableCell>{row.excel?.column || "-"}</TableCell>
                          <TableCell>{row.excel?.excelName || "-"}</TableCell>
                          <TableCell>{row.matched?.type || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === "manual_added" ? "secondary" : "outline"}>
                              {row.status || "mapped"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
