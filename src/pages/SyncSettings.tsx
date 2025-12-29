import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCopy, Loader2, RefreshCcw } from "lucide-react";

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

type ScheduleMode = "none" | "hourly" | "daily" | "weekly" | "monthly" | "custom";

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return fallback;
};

const buildCronFromParts = (mode: Exclude<ScheduleMode, "custom" | "none">, minute: number, hour: number, dayOfWeek: number, dayOfMonth: number) => {
  const m = clampInt(minute, 0, 59, 0);
  const h = clampInt(hour, 0, 23, 2);
  const dow = clampInt(dayOfWeek, 0, 6, 1);
  const dom = clampInt(dayOfMonth, 1, 31, 1);
  if (mode === "hourly") return `${m} * * * *`;
  if (mode === "daily") return `${m} ${h} * * *`;
  if (mode === "weekly") return `${m} ${h} * * ${dow}`;
  return `${m} ${h} ${dom} * *`;
};

const parseCron = (raw: string): { mode: ScheduleMode; minute?: number; hour?: number; dayOfWeek?: number; dayOfMonth?: number } => {
  const cron = String(raw || "").trim();
  if (!cron) return { mode: "none" };

  const hourly = cron.match(/^(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (hourly) return { mode: "hourly", minute: clampInt(hourly[1], 0, 59, 0) };

  const daily = cron.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
  if (daily) return { mode: "daily", minute: clampInt(daily[1], 0, 59, 0), hour: clampInt(daily[2], 0, 23, 2) };

  const weekly = cron.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+(\d+)$/);
  if (weekly) {
    return {
      mode: "weekly",
      minute: clampInt(weekly[1], 0, 59, 0),
      hour: clampInt(weekly[2], 0, 23, 2),
      dayOfWeek: clampInt(weekly[3], 0, 6, 1),
    };
  }

  const monthly = cron.match(/^(\d+)\s+(\d+)\s+(\d+)\s+\*\s+\*$/);
  if (monthly) {
    return {
      mode: "monthly",
      minute: clampInt(monthly[1], 0, 59, 0),
      hour: clampInt(monthly[2], 0, 23, 2),
      dayOfMonth: clampInt(monthly[3], 1, 31, 1),
    };
  }

  return { mode: "custom" };
};

export default function SyncSettings() {
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [batchSize, setBatchSize] = useState(500);
  const [startOffset, setStartOffset] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("none");
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleHour, setScheduleHour] = useState(2);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const scheduleSummary = useMemo(() => {
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const m = clampInt(scheduleMinute, 0, 59, 0);
    const h = clampInt(scheduleHour, 0, 23, 2);
    const dow = clampInt(scheduleDayOfWeek, 0, 6, 1);
    const dom = clampInt(scheduleDayOfMonth, 1, 31, 1);
    const dowLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow] || "Mon";

    if (scheduleMode === "none") return "No automatic schedule";
    if (scheduleMode === "hourly") return `Every hour at :${pad2(m)}`;
    if (scheduleMode === "daily") return `Every day at ${pad2(h)}:${pad2(m)}`;
    if (scheduleMode === "weekly") return `Every ${dowLabel} at ${pad2(h)}:${pad2(m)}`;
    if (scheduleMode === "monthly") return `Every month on day ${dom} at ${pad2(h)}:${pad2(m)}`;
    if (scheduleMode === "custom") return "Custom cron expression";
    return "";
  }, [scheduleMode, scheduleMinute, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth]);

  useEffect(() => {
    if (scheduleMode === "custom") return;
    if (scheduleMode === "none") {
      setSchedule("");
      return;
    }
    setSchedule(buildCronFromParts(scheduleMode, scheduleMinute, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth));
  }, [scheduleMode, scheduleMinute, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth]);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  };

  const durationText = (startIso?: string | null, endIso?: string | null) => {
    if (!startIso || !endIso) return null;
    const a = new Date(startIso).getTime();
    const b = new Date(endIso).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
    const ms = b - a;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const ss = s % 60;
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m ${ss}s`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${s}s`;
  };

  const elapsedText = useMemo(() => {
    void tick;
    if (!runStartedAt) return null;
    const ms = Date.now() - runStartedAt;
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const ss = s % 60;
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m ${ss}s`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${s}s`;
  }, [runStartedAt, tick]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/sync/config`, { credentials: "include" });
      const cfg = await r.json().catch(() => null);
      if (r.ok && cfg) {
        setEnabled(!!cfg.enabled);
        const raw = String(cfg.schedule || "");
        setSchedule(raw);
        const parsed = parseCron(raw);
        setScheduleMode(parsed.mode);
        if (parsed.minute !== undefined) setScheduleMinute(parsed.minute);
        if (parsed.hour !== undefined) setScheduleHour(parsed.hour);
        if (parsed.dayOfWeek !== undefined) setScheduleDayOfWeek(parsed.dayOfWeek);
        if (parsed.dayOfMonth !== undefined) setScheduleDayOfMonth(parsed.dayOfMonth);
      }
      const s = await apiFetch(`/sync/status`, { credentials: "include" });
      const st = await s.json().catch(() => null);
      if (s.ok) setStatus(st as SyncStatus);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to load sync settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const ok = window.confirm(dryRun ? "Run sync in dry-run mode?" : "Run sync now? This will write updates to destination.");
      if (!ok) return;
      const limit = Math.max(1, Math.min(5000, Math.floor(Number(batchSize) || 500)));
      const offset = Math.max(0, Math.floor(Number(startOffset) || 0));
      setRunning(true);
      setRunStartedAt(Date.now());
      const r = await apiFetch(`/sync/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun, limit, offset }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || `HTTP_${r.status}`);
      const s = d?.stats as SyncRunStats | undefined;
      const msg = s
        ? `Scanned ${Number(s.scanned || 0)}, Inserted ${Number(s.inserted || 0)}, Updated ${Number(s.updated || 0)}, Skipped ${Number(s.skipped || 0)}`
        : (dryRun ? "Dry-run completed" : "Sync run completed");
      toast({ title: "Sync Completed", description: msg });
      await load();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to run sync", variant: "destructive" });
    } finally {
      setRunning(false);
      setRunStartedAt(null);
    }
  };

  const copyLastRun = async () => {
    try {
      const payload = status ? JSON.stringify(status, null, 2) : "";
      if (!payload) throw new Error("No run status to copy");
      await navigator.clipboard.writeText(payload);
      toast({ title: "Copied", description: "Last run details copied to clipboard" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to copy", variant: "destructive" });
    }
  };

  const statusBadge = () => {
    if (running) return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Running</Badge>;
    if (status?.success === true) return <Badge variant="secondary" className="bg-green-100 text-green-800">Success</Badge>;
    if (status?.success === false) return <Badge variant="secondary" className="bg-red-100 text-red-800">Failed</Badge>;
    return <Badge variant="outline">Unknown</Badge>;
  };

  const rowErrors = status?.stats?.errors ?? [];
  const rowErrorCount = rowErrors.length;
  const firstRowError = rowErrorCount > 0 ? rowErrors[0] : null;

  return (
    <MainLayout title="Data Sync" subtitle="Configure and run one-way sync from EmployeeWorkflow to MTIMasterEmployeeDB">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set schedule and choose how to run sync.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Enabled</div>
                <div className="text-xs text-muted-foreground">Allows the scheduler to run sync automatically.</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading || running} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Schedule</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Frequency</div>
                  <Select value={scheduleMode} onValueChange={(v) => setScheduleMode(v as ScheduleMode)} disabled={loading || running}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom (cron)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Summary</div>
                  <Input value={scheduleSummary} readOnly disabled />
                </div>
              </div>

              {scheduleMode !== "none" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scheduleMode !== "custom" ? (
                    <>
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Minute</div>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={scheduleMinute}
                          onChange={(e) => setScheduleMinute(clampInt(e.target.value, 0, 59, 0))}
                          disabled={loading || running}
                        />
                      </div>
                      {scheduleMode !== "hourly" && (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Hour</div>
                          <Input
                            type="number"
                            min={0}
                            max={23}
                            value={scheduleHour}
                            onChange={(e) => setScheduleHour(clampInt(e.target.value, 0, 23, 2))}
                            disabled={loading || running}
                          />
                        </div>
                      )}
                      {scheduleMode === "weekly" && (
                        <div className="space-y-2 md:col-span-2">
                          <div className="text-xs text-muted-foreground">Day of Week</div>
                          <Select value={String(scheduleDayOfWeek)} onValueChange={(v) => setScheduleDayOfWeek(clampInt(v, 0, 6, 1))} disabled={loading || running}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sunday</SelectItem>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {scheduleMode === "monthly" && (
                        <div className="space-y-2 md:col-span-2">
                          <div className="text-xs text-muted-foreground">Day of Month</div>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={scheduleDayOfMonth}
                            onChange={(e) => setScheduleDayOfMonth(clampInt(e.target.value, 1, 31, 1))}
                            disabled={loading || running}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <div className="text-xs text-muted-foreground">Cron</div>
                      <Input
                        placeholder="e.g. 0 2 * * *"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                        disabled={loading || running}
                        className="font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Batch Size</div>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  disabled={loading || running}
                />
                <div className="text-xs text-muted-foreground">Max 5000. Bigger is faster but heavier.</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Start Offset</div>
                <Input
                  type="number"
                  min={0}
                  value={startOffset}
                  onChange={(e) => setStartOffset(Number(e.target.value))}
                  disabled={loading || running}
                />
                <div className="text-xs text-muted-foreground">Usually 0. Use to resume from a later page.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={loading || running} />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Dry Run</div>
                <div className="text-xs text-muted-foreground">Compute changes without writing.</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={loading || running}>Save</Button>
              <Button variant="outline" onClick={load} disabled={loading || running}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={runSync} disabled={loading || running}>
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {running ? "Running..." : "Run Sync"}
              </Button>
            </div>
            {running && (
              <div className="text-xs text-muted-foreground">
                Sync is running. This page will update when it completes{elapsedText ? ` (elapsed ${elapsedText}).` : "."}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Last Run</CardTitle>
                <CardDescription>Latest recorded run in the destination database.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={load} disabled={loading || running}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={copyLastRun} disabled={!status}>
                  <ClipboardCopy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Status</div>
              {statusBadge()}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Started</div>
              <div>{formatDateTime(status?.started_at) || "-"}</div>
              <div className="text-muted-foreground">Finished</div>
              <div>{formatDateTime(status?.finished_at) || "-"}</div>
              <div className="text-muted-foreground">Duration</div>
              <div>{durationText(status?.started_at, status?.finished_at) || "-"}</div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Scanned</div>
                <div className="font-semibold">{Number(status?.stats?.scanned || 0)}</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Inserted</div>
                <div className="font-semibold">{Number(status?.stats?.inserted || 0)}</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Updated</div>
                <div className="font-semibold">{Number(status?.stats?.updated || 0)}</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-xs text-muted-foreground">Skipped</div>
                <div className="font-semibold">{Number(status?.stats?.skipped || 0)}</div>
              </div>
            </div>

            {(status?.error || rowErrorCount > 0) && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-destructive">
                    {status?.error ? "Run Error" : "Row Errors"}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      {rowErrorCount > 0 ? `${rowErrorCount} error(s)` : ""}
                    </div>
                    {!status?.error && rowErrorCount > 0 ? (
                      <Button variant="outline" size="sm" onClick={() => setShowDetails(true)} disabled={showDetails}>
                        {showDetails ? "Showing" : "Show"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {status?.error ? <div className="mt-1 text-sm text-destructive">{status.error}</div> : null}
                {!status?.error && firstRowError ? (
                  <div className="mt-2 rounded-md border border-destructive/20 bg-background/50 p-2">
                    <div className="text-xs font-mono">
                      {String(firstRowError.employee_id || "-")} / {String(firstRowError.StaffNo || "-")}
                    </div>
                    <div className="mt-1 text-xs">{String(firstRowError.message || "")}</div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Details</div>
              <Button variant="outline" size="sm" onClick={() => setShowDetails((v) => !v)} disabled={!status?.stats}>
                {showDetails ? "Hide" : "Show"}
              </Button>
            </div>

            {showDetails && status?.stats && (
              <div className="space-y-3">
                {status.stats.examples && status.stats.examples.length > 0 && (
                  <div className="rounded-md border p-3">
                    <div className="text-sm font-medium">Sample Source Rows</div>
                    <div className="mt-2 space-y-1 text-xs font-mono">
                      {status.stats.examples.slice(0, 10).map((e, idx) => (
                        <div key={`${idx}-${e.employee_id || ""}-${e.StaffNo || ""}`}>
                          {String(e.employee_id || "") || "-"} / {String(e.StaffNo || "") || "-"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {status.stats.errors && status.stats.errors.length > 0 && (
                  <div className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Errors (first 20)</div>
                      <div className="text-xs text-muted-foreground">{status.stats.errors.length} total</div>
                    </div>
                    <div className="mt-2 max-h-72 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Employee ID</TableHead>
                            <TableHead className="w-[140px]">Staff No</TableHead>
                            <TableHead>Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {status.stats.errors.slice(0, 20).map((er, idx) => (
                            <TableRow key={`${idx}-${er.employee_id || ""}-${er.StaffNo || ""}`}>
                              <TableCell className="font-mono text-xs">{String(er.employee_id || "")}</TableCell>
                              <TableCell className="font-mono text-xs">{String(er.StaffNo || "")}</TableCell>
                              <TableCell className="text-xs">{String(er.message || "")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
