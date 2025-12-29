import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type SyncRunStats = {
  inserted?: number;
  updated?: number;
  skipped?: number;
  missing_in_source?: number;
  scanned?: number;
  examples?: Array<{ employee_id?: string | null; StaffNo?: string | null }>;
  errors?: Array<{ employee_id?: string | null; StaffNo?: string | null; message?: string }>;
};

type SyncStatus = {
  started_at?: string | null;
  finished_at?: string | null;
  success?: boolean | null;
  stats?: SyncRunStats | null;
  error?: string | null;
};

export default function SyncSettings() {
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [dryRun, setDryRun] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/sync/config`, { credentials: "include" });
      const cfg = await r.json().catch(() => null);
      if (r.ok && cfg) {
        setEnabled(!!cfg.enabled);
        setSchedule(String(cfg.schedule || ""));
      }
      const s = await apiFetch(`/sync/status`, { credentials: "include" });
      const st = await s.json().catch(() => null);
      if (s.ok) setStatus(st as SyncStatus);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to load sync settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const r = await apiFetch(`/sync/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, schedule }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || `HTTP_${r.status}`);
      }
      toast({ title: "Saved", description: "Sync configuration updated" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save", variant: "destructive" });
    }
  };

  const runSync = async () => {
    try {
      setRunning(true);
      const r = await apiFetch(`/sync/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun, limit: 200 }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || `HTTP_${r.status}`);
      toast({ title: "Sync Triggered", description: dryRun ? "Dry-run completed" : "Sync run completed" });
      await load();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to run sync", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <MainLayout title="Data Sync" subtitle="Configure and run one-way sync from EmployeeWorkflow to MTIMasterEmployeeDB">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Enabled</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="space-y-2">
              <span className="text-sm">Schedule (cron)</span>
              <Input placeholder="e.g. 0 2 * * *" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
              <span className="text-sm">Dry Run</span>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={loading}>Save</Button>
              <Button variant="outline" onClick={runSync} disabled={running}>{running ? "Running..." : "Run Sync"}</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">Started: {status?.started_at ? String(status.started_at) : "-"}</div>
            <div className="text-sm">Finished: {status?.finished_at ? String(status.finished_at) : "-"}</div>
            <div className="text-sm">Success: {status?.success === true ? "Yes" : status?.success === false ? "No" : "-"}</div>
            <div className="text-sm">Stats: {status?.stats ? JSON.stringify(status.stats) : "-"}</div>
            <div className="text-sm text-destructive">{status?.error || ""}</div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
