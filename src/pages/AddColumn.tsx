import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { MoreHorizontal } from "lucide-react";

type MappingRow = {
  excel?: { table?: string; schema?: string; column?: string; excelName?: string };
  matched?: { table?: string; column?: string; type?: string };
  status?: string | null;
};

const formatGroupLabel = (value: string) => {
  const trimmed = String(value || "").trim();
  return trimmed;
};

const resolveGroupKey = (row: MappingRow) => {
  const schema = String(row.excel?.schema || "").trim();
  const table = String(row.excel?.table || "").trim();
  if (!table) return "";
  return schema ? `${schema}.${table}` : table;
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
  const [tableOptions, setTableOptions] = useState<Array<{ schema: string; table: string; fullName: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    table: string;
    column?: string;
    groupLabel: string;
    groupCount: number;
  } | null>(null);

  const groupValue = group.trim();
  const columnValue = column.trim();
  const labelValue = label.trim();
  const typeValue = type.trim();
  const normalizeColumn = (raw: string) => {
    const base = raw.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "_");
    if (!base) return "";
    const prefixed = /^[A-Za-z_]/.test(base) ? base : `_${base}`;
    return prefixed.replace(/_+/g, "_").toLowerCase();
  };
  const normalizedColumn = normalizeColumn(columnValue);
  const columnValid = /^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizedColumn);
  const canSubmit = !!groupValue && !!normalizedColumn && !!typeValue && columnValid && !saving;

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

  const loadTables = async () => {
    setLoadingTables(true);
    try {
      const res = await apiFetch(`/mapping/dbinfo/tables`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      const list = Array.isArray(data) ? data : [];
      setTableOptions(list);
    } catch (err: unknown) {
      setTableOptions([]);
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    loadMappings();
    loadTables();
  }, []);

  const submitColumn = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/mapping/dbinfo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: groupValue,
          column: normalizedColumn,
          label: labelValue || undefined,
          type: typeValue || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      toast({ title: "Column added", description: `${groupValue}.${normalizedColumn} is now available` });
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setConfirmOpen(true);
  };

  const handleDelete = async (tableName: string, columnName?: string) => {
    const table = String(tableName || "").trim();
    const column = String(columnName || "").trim();
    if (!table) return;
    const groupCount = rows.filter((row) => resolveGroupKey(row).toLowerCase() === table.toLowerCase()).length;
    const groupLabel = formatGroupLabel(table);
    setDeleteTarget({
      table,
      column: column || undefined,
      groupLabel,
      groupCount,
    });
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { table, column, groupLabel } = deleteTarget;
    const key = column ? `${table}.${column}` : `${table}::*`;
    setDeleting(key);
    try {
      const res = await apiFetch(`/mapping/dbinfo`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, column: column || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      toast({
        title: "Mapping deleted",
        description: column ? `${groupLabel}.${column} dihapus` : `Group ${groupLabel} dihapus`,
      });
      await loadMappings();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete mapping",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const tableName = resolveGroupKey(row).toLowerCase();
      const columnName = String(row.excel?.column || "").toLowerCase();
      const labelName = String(row.excel?.excelName || "").toLowerCase();
      const typeName = String(row.matched?.type || "").toLowerCase();
      return tableName.includes(q) || columnName.includes(q) || labelName.includes(q) || typeName.includes(q);
    });
  }, [query, rows]);

  const groups = useMemo(() => {
    const fromTables = tableOptions.map((item) => item.fullName).filter(Boolean);
    if (fromTables.length) return fromTables;
    const existing = new Set<string>();
    for (const row of rows) {
      const g = resolveGroupKey(row);
      if (g) existing.add(g);
    }
    return Array.from(existing).sort((a, b) => a.localeCompare(b));
  }, [rows, tableOptions]);

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
      const t = resolveGroupKey(row);
      if (t) tables.add(t);
      if (String(row.status || "") === "manual_added") manual += 1;
    }
    return { total: rows.length, tables: tables.size, manual };
  }, [rows]);

  return (
    <MainLayout title="Add Column" subtitle="Pilih table database untuk menambahkan column">
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Column Details</CardTitle>
                  <CardDescription>Pilih table dari database. Gunakan format schema.table agar konsisten.</CardDescription>
                </div>
                <Button variant="outline" onClick={loadTables} disabled={loadingTables}>
                  {loadingTables ? "Refreshing..." : "Refresh Tables"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <p className="text-xs text-muted-foreground">Kolom bertanda * wajib diisi.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="group">
                      Group <span className="text-destructive">*</span>
                    </Label>
                    <Select value={group} onValueChange={setGroup}>
                      <SelectTrigger id="group">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {groups.map((g) => (
                          <SelectItem key={g} value={g}>{formatGroupLabel(g)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="column">
                      Column <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="column"
                      value={column}
                      onChange={(event) => setColumn(event.target.value)}
                      placeholder="employee_id"
                      autoComplete="off"
                    />
                    {columnValue && normalizedColumn && normalizedColumn !== columnValue && (
                      <p className="text-xs text-muted-foreground">Akan disimpan sebagai: {normalizedColumn}</p>
                    )}
                    {columnValue && !columnValid && (
                      <p className="text-xs text-destructive">Gunakan huruf, angka, dan underscore saja, diawali huruf/underscore.</p>
                    )}
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
                    <Label htmlFor="type">
                      Tipe Data <span className="text-destructive">*</span>
                    </Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger id="type">
                      <SelectValue placeholder="Pilih tipe data" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {typeOptions.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item.charAt(0).toUpperCase() + item.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Wajib diisi untuk menandai tipe data kolom DB.</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={!canSubmit}>
                    {saving ? "Saving..." : "Add Column"}
                  </Button>
                </div>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tambah column baru?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {groupValue && normalizedColumn
                          ? `Kolom ${groupValue}.${normalizedColumn} akan ditambahkan dan tersedia untuk permissions.`
                          : "Kolom baru akan ditambahkan dan tersedia untuk permissions."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button
                          variant="destructive"
                          disabled={saving || !canSubmit}
                          onClick={async () => {
                            setConfirmOpen(false);
                            await submitColumn();
                          }}
                        >
                          Tambah
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </form>
            </CardContent>
          </Card>
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(open) => {
              setDeleteOpen(open);
              if (!open) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {deleteTarget?.column ? "Hapus column?" : "Hapus group?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget?.column
                    ? `Column ${deleteTarget.groupLabel}.${deleteTarget.column} akan dihapus dan tidak dapat dibatalkan.`
                    : deleteTarget
                      ? `Group ${deleteTarget.groupLabel} akan dihapus (${deleteTarget.groupCount} column) dan tidak dapat dibatalkan.`
                      : "Tindakan ini tidak dapat dibatalkan."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    variant="destructive"
                    disabled={deleting !== null}
                    onClick={confirmDelete}
                  >
                    Hapus
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                  <li>Gunakan format schema.table agar grouping konsisten, contoh dbo.employee_core.</li>
                  <li>Column sebaiknya nama kolom database, Label untuk tampilan manusia.</li>
                  <li>Tipe Data wajib untuk membantu konteks di Column Access.</li>
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          {loading ? "Loading mappings..." : "No mappings found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row, index) => (
                        <TableRow key={`${resolveGroupKey(row)}-${row.excel?.column || ""}-${index}`}>
                          <TableCell className="font-medium">{formatGroupLabel(resolveGroupKey(row) || "-")}</TableCell>
                          <TableCell>{row.excel?.column || "-"}</TableCell>
                          <TableCell>{row.excel?.excelName || "-"}</TableCell>
                          <TableCell>{row.matched?.type || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === "manual_added" ? "secondary" : "outline"}>
                              {row.status || "mapped"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={
                                    deleting === `${resolveGroupKey(row)}.${row.excel?.column || ""}` ||
                                    deleting === `${resolveGroupKey(row)}::*`
                                  }
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(resolveGroupKey(row), String(row.excel?.column || ""))}
                                >
                                  Delete Column
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(resolveGroupKey(row))}
                                >
                                  Delete Group
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
