import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Download, FileText } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { apiFetch } from "@/lib/api";

type CoreRow = Record<string, unknown>;

export default function ReportsPage() {
  const { caps } = useRBAC();
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CoreRow[]>([]);

  const canAccess = !!caps?.canAccessReport;
  const canExport = !!caps?.canExportReport;

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!canAccess) return;
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        const res = await apiFetch(`/reports/employees-core?${params.toString()}`, { signal: ctrl.signal, credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `HTTP_${res.status}`);
        const items: CoreRow[] = Array.isArray(data?.data) ? data.data : [];
        setRows(items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_REPORT");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [canAccess, limit, offset]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      for (const v of Object.values(r)) {
        if (v && String(v).toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [rows, search]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    const url = `/reports/employees-core/export?${params.toString()}`;
    const res = await apiFetch(url, { credentials: "include" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `HTTP_${res.status}`);
    }
    const blob = await res.blob();
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = dlUrl;
    a.download = `report-employees-core-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
  };

  return (
    <MainLayout title="Reports" subtitle="Prebuilt exports with role- and template-gated columns">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Employees Core
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canAccess ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-muted-foreground">You do not have permission to access reports.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Input
                    className="w-64"
                    placeholder="Search preview rows..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    min={1}
                    max={1000}
                    value={limit}
                    onChange={(e) => setLimit(Math.min(Math.max(parseInt(e.target.value || "0", 10) || 0, 1), 1000))}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    value={offset}
                    onChange={(e) => setOffset(Math.max(parseInt(e.target.value || "0", 10) || 0, 0))}
                  />
                  <Button
                    variant="outline"
                    disabled={!canExport || loading}
                    onClick={() => exportCsv().catch((err) => console.error(err))}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
                {loading ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : error ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-destructive">{error}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card/95 shadow-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {filtered[0]
                            ? Object.keys(filtered[0]).map((k) => (
                                <TableHead key={k}>{k}</TableHead>
                              ))
                            : ["employee_id","name","department","status","job_title"].map((k) => (
                                <TableHead key={k}>{k}</TableHead>
                              ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.slice(0, 20).map((row, i) => (
                          <TableRow key={i}>
                            {Object.keys(filtered[0] || row).map((k) => (
                              <TableCell key={k}>{String(row[k] ?? "")}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell className="text-muted-foreground">No data</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              <li>Exports include only columns permitted by your role.</li>
              <li>Per-user template assignments apply if active.</li>
              <li>Employee type access rules are enforced.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
