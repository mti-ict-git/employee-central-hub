import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type RunSummary = {
  run_id: number;
  started_at: string;
  finished_at: string | null;
  success: boolean;
  source: string;
  error: string | null;
  summary: { inserted: number; updated: number; skipped: number; scanned: number };
};

const SyncHistory = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [source, setSource] = useState<string>("all");
  const [success, setSuccess] = useState<string>("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (source === "sharepoint" || source === "local_upload") params.set("source", source);
    if (success === "success") params.set("success", "1");
    if (success === "failed") params.set("success", "0");
    (async () => {
      const res = await apiFetch(`/sync/runs${params.toString() ? `?${params.toString()}` : ""}`);
      const json = await res.json();
      setRuns((json.runs || []).map((r: any) => ({
        run_id: r.run_id,
        started_at: r.started_at,
        finished_at: r.finished_at || null,
        success: !!r.success,
        source: String(r.source || ""),
        error: r.error || null,
        summary: r.summary || { inserted: 0, updated: 0, skipped: 0, scanned: 0 },
      })));
    })();
  }, [source, success]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(runs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sync-history.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["run_id","started_at","finished_at","success","source","inserted","updated","skipped","scanned","error"];
    const rows = runs.map(r => [r.run_id, r.started_at, r.finished_at ?? "", r.success ? "1" : "0", r.source, r.summary.inserted, r.summary.updated, r.summary.skipped, r.summary.scanned, r.error ?? ""]);
    const csv = [header.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sync-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title="Sync History" subtitle="Audit recent SharePoint sync runs">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="w-52">
              <label className="text-sm font-medium mb-2 block">Source</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sharepoint">SharePoint</SelectItem>
                  <SelectItem value="local_upload">Local Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={success} onValueChange={setSuccess}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
              <Button onClick={exportJSON}>Export JSON</Button>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Run ID</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Inserted</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Scanned</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.run_id}>
                    <TableCell className="font-medium">{r.run_id}</TableCell>
                    <TableCell>{new Date(r.started_at).toLocaleString()}</TableCell>
                    <TableCell>{r.finished_at ? new Date(r.finished_at).toLocaleString() : "-"}</TableCell>
                    <TableCell>{r.source || "-"}</TableCell>
                    <TableCell>{r.success ? "Yes" : "No"}</TableCell>
                    <TableCell>{r.summary.inserted}</TableCell>
                    <TableCell>{r.summary.updated}</TableCell>
                    <TableCell>{r.summary.skipped}</TableCell>
                    <TableCell>{r.summary.scanned}</TableCell>
                    <TableCell>
                      <Button variant="outline" onClick={() => navigate(`/reports/sync-runs/${r.run_id}`)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SyncHistory;
