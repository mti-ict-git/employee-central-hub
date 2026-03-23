import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

type ChangeEntry = { employee_id: string; table: string; column: string; before: any; after: any; change: "insert" | "update" };
type Stats = { inserted: number; updated: number; skipped: number; scanned: number; errors?: Array<{ employee_id?: string | null; message: string }>; changes?: ChangeEntry[] };

const SyncRunDetail = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [stats, setStats] = useState<Stats | null>(null);
  const [meta, setMeta] = useState<{ run_id: number; started_at: string; finished_at: string | null; success: boolean; source: string }>({ run_id: 0, started_at: "", finished_at: null, success: false, source: "" });

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    (async () => {
      const res = await apiFetch(`/sync/runs/${id}`);
      const json = await res.json();
      setMeta({ run_id: json.run_id, started_at: json.started_at, finished_at: json.finished_at, success: !!json.success, source: String(json.source || "") });
      setStats(json.stats || null);
    })();
  }, [params.id]);

  const exportChangesCSV = () => {
    const changes = stats?.changes || [];
    const header = ["employee_id","table","column","before","after","change"];
    const rows = changes.map(c => [c.employee_id, c.table, c.column, JSON.stringify(c.before ?? ""), JSON.stringify(c.after ?? ""), c.change]);
    const csv = [header.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sync-run-${meta.run_id}-changes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ meta, stats }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sync-run-${meta.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title={`Sync Run #${meta.run_id}`} subtitle="Detailed changes and summary">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => navigate("/reports/sync-history")}>Back to History</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportChangesCSV}>Export Changes CSV</Button>
            <Button onClick={exportJSON}>Export JSON</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-lg font-medium">{meta.source || "-"}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Success</p>
              <p className="text-lg font-medium">{meta.success ? "Yes" : "No"}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Inserted</p>
              <p className="text-lg font-medium">{stats?.inserted ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-lg font-medium">{stats?.updated ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(stats?.changes || []).slice(0, 1000).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.employee_id}</TableCell>
                        <TableCell>{c.table}</TableCell>
                        <TableCell>{c.column}</TableCell>
                        <TableCell className="text-muted-foreground">{String(c.before ?? "")}</TableCell>
                        <TableCell>{String(c.after ?? "")}</TableCell>
                        <TableCell>{c.change}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default SyncRunDetail;
