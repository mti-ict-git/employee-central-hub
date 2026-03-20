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
import { ClipboardCopy, Loader2, RefreshCcw, Share2 } from "lucide-react";

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

type SharePointSyncConfig = {
  enabled: boolean;
  auth_flow: "device_code";
  delegated_permission: "Files.Read";
  tenant_id: string;
  client_id: string;
  site_url: string;
  library_drive_id: string;
  file_path: string;
  poll_minutes: number;
};

type DeviceCodePayload = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
  scope: string;
};

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
  const [sharepointEnabled, setSharepointEnabled] = useState(false);
  const [sharepointTenantId, setSharepointTenantId] = useState("");
  const [sharepointClientId, setSharepointClientId] = useState("");
  const [sharepointSiteUrl, setSharepointSiteUrl] = useState("");
  const [sharepointDriveId, setSharepointDriveId] = useState("");
  const [sharepointFilePath, setSharepointFilePath] = useState("");
  const [sharepointPollMinutes, setSharepointPollMinutes] = useState(15);
  const [requestingDeviceCode, setRequestingDeviceCode] = useState(false);
  const [deviceCodePayload, setDeviceCodePayload] = useState<DeviceCodePayload | null>(null);
  const [savingSharepoint, setSavingSharepoint] = useState(false);

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
        const sp = cfg.sharepoint;
        if (sp && typeof sp === "object" && !Array.isArray(sp)) {
          const record = sp as Record<string, unknown>;
          setSharepointEnabled(!!record.enabled);
          setSharepointTenantId(String(record.tenant_id || ""));
          setSharepointClientId(String(record.client_id || ""));
          setSharepointSiteUrl(String(record.site_url || ""));
          setSharepointDriveId(String(record.library_drive_id || ""));
          setSharepointFilePath(String(record.file_path || ""));
          setSharepointPollMinutes(clampInt(record.poll_minutes, 1, 1440, 15));
        }
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
      const sharepointConfig: SharePointSyncConfig = {
        enabled: sharepointEnabled,
        auth_flow: "device_code",
        delegated_permission: "Files.Read",
        tenant_id: sharepointTenantId.trim(),
        client_id: sharepointClientId.trim(),
        site_url: sharepointSiteUrl.trim(),
        library_drive_id: sharepointDriveId.trim(),
        file_path: sharepointFilePath.trim(),
        poll_minutes: clampInt(sharepointPollMinutes, 1, 1440, 15),
      };
      const r = await apiFetch(`/sync/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, schedule, sharepoint: sharepointConfig }),
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

  const saveSharepointSettings = async () => {
    const sharepointConfig: SharePointSyncConfig = {
      enabled: sharepointEnabled,
      auth_flow: "device_code",
      delegated_permission: "Files.Read",
      tenant_id: sharepointTenantId.trim(),
      client_id: sharepointClientId.trim(),
      site_url: sharepointSiteUrl.trim(),
      library_drive_id: sharepointDriveId.trim(),
      file_path: sharepointFilePath.trim(),
      poll_minutes: clampInt(sharepointPollMinutes, 1, 1440, 15),
    };
    if (!sharepointConfig.tenant_id || !sharepointConfig.client_id) {
      toast({
        title: "Missing required fields",
        description: "Tenant ID and Client ID are required to save SharePoint configuration.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSavingSharepoint(true);
      const r = await apiFetch(`/sync/config/sharepoint`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharepoint: sharepointConfig }),
      });
      const body = (await r.json().catch(() => null)) as unknown;
      if (!r.ok) {
        const msg = body && typeof body === "object" && !Array.isArray(body) && "error" in body && typeof (body as { error?: unknown }).error === "string"
          ? String((body as { error?: unknown }).error)
          : `HTTP_${r.status}`;
        throw new Error(msg);
      }
      toast({ title: "Saved", description: "SharePoint Sync configuration saved." });
      await load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "FAILED_TO_SAVE_SHAREPOINT_CONFIG",
        variant: "destructive",
      });
    } finally {
      setSavingSharepoint(false);
    }
  };

  const requestSharePointDeviceCode = async () => {
    const sharepointConfig: SharePointSyncConfig = {
      enabled: sharepointEnabled,
      auth_flow: "device_code",
      delegated_permission: "Files.Read",
      tenant_id: sharepointTenantId.trim(),
      client_id: sharepointClientId.trim(),
      site_url: sharepointSiteUrl.trim(),
      library_drive_id: sharepointDriveId.trim(),
      file_path: sharepointFilePath.trim(),
      poll_minutes: clampInt(sharepointPollMinutes, 1, 1440, 15),
    };
    if (!sharepointConfig.tenant_id || !sharepointConfig.client_id) {
      toast({
        title: "Missing SharePoint auth fields",
        description: "Please fill Tenant ID and Client ID first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setRequestingDeviceCode(true);
      const r = await apiFetch(`/sync/sharepoint/device-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharepoint: sharepointConfig }),
      });
      const d = (await r.json().catch(() => null)) as unknown;
      if (!r.ok || !d || typeof d !== "object" || Array.isArray(d)) {
        const msg = d && typeof d === "object" && "error" in d && typeof (d as { error?: unknown }).error === "string"
          ? String((d as { error?: unknown }).error)
          : `HTTP_${r.status}`;
        throw new Error(msg);
      }
      const payload = d as Record<string, unknown>;
      const nextPayload: DeviceCodePayload = {
        device_code: String(payload.device_code || ""),
        user_code: String(payload.user_code || ""),
        verification_uri: String(payload.verification_uri || ""),
        expires_in: clampInt(payload.expires_in, 0, 86400, 0),
        interval: clampInt(payload.interval, 1, 30, 5),
        message: String(payload.message || ""),
        scope: String(payload.scope || "Files.Read offline_access"),
      };
      setDeviceCodePayload(nextPayload);
      toast({ title: "Device code generated", description: "Use the code below to authorize this app in Microsoft login page." });
    } catch (e: unknown) {
      toast({
        title: "Failed to generate device code",
        description: e instanceof Error ? e.message : "FAILED_TO_REQUEST_DEVICE_CODE",
        variant: "destructive",
      });
    } finally {
      setRequestingDeviceCode(false);
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
      <div className="space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              SharePoint Sync
            </CardTitle>
            <CardDescription>
              Configure Microsoft Graph device-code authentication using delegated Files.Read for SharePoint file sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Enable SharePoint Sync</div>
                <div className="text-xs text-muted-foreground">When enabled, file polling from SharePoint can be executed by sync workers.</div>
              </div>
              <Switch checked={sharepointEnabled} onCheckedChange={setSharepointEnabled} disabled={loading || running} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Auth Flow</div>
                <Input value="device_code" readOnly disabled />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Permission</div>
                <Input value="Files.Read (Delegated)" readOnly disabled />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Azure Tenant ID</div>
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={sharepointTenantId}
                  onChange={(e) => setSharepointTenantId(e.target.value)}
                  disabled={loading || running}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Azure Client ID (Public Client App)</div>
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={sharepointClientId}
                  onChange={(e) => setSharepointClientId(e.target.value)}
                  disabled={loading || running}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm font-medium">SharePoint Site URL</div>
                <Input
                  placeholder="https://contoso.sharepoint.com/sites/YourSite"
                  value={sharepointSiteUrl}
                  onChange={(e) => setSharepointSiteUrl(e.target.value)}
                  disabled={loading || running}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Document Library Drive ID</div>
                <Input
                  placeholder="Optional: leave empty to resolve dynamically"
                  value={sharepointDriveId}
                  onChange={(e) => setSharepointDriveId(e.target.value)}
                  disabled={loading || running}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">File Path</div>
                <Input
                  placeholder="/Shared Documents/import/employee.xlsx"
                  value={sharepointFilePath}
                  onChange={(e) => setSharepointFilePath(e.target.value)}
                  disabled={loading || running}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Polling Interval (minutes)</div>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={sharepointPollMinutes}
                  onChange={(e) => setSharepointPollMinutes(clampInt(e.target.value, 1, 1440, 15))}
                  disabled={loading || running}
                />
              </div>
            </div>

            <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground">
              Required Azure App settings: allow public client flows, delegated Microsoft Graph permission Files.Read, and user/admin consent for your tenant.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={saveSharepointSettings} disabled={loading || running || requestingDeviceCode || savingSharepoint}>
                {savingSharepoint ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {savingSharepoint ? "Saving..." : "Save SharePoint Settings"}
              </Button>
              <Button type="button" onClick={requestSharePointDeviceCode} disabled={loading || running || requestingDeviceCode}>
                {requestingDeviceCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {requestingDeviceCode ? "Requesting..." : "Generate Device Code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!deviceCodePayload?.verification_uri}
                onClick={() => {
                  const url = deviceCodePayload?.verification_uri;
                  if (!url) return;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                Open Microsoft Verification Page
              </Button>
            </div>

            {deviceCodePayload && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="text-sm font-medium">Authorization Code</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">User Code</div>
                    <div className="flex items-center gap-2">
                      <Input value={deviceCodePayload.user_code} readOnly className="font-mono" />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={async () => {
                          await navigator.clipboard.writeText(deviceCodePayload.user_code);
                          toast({ title: "Copied", description: "User code copied to clipboard." });
                        }}
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Verification URL</div>
                    <Input value={deviceCodePayload.verification_uri} readOnly />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Expires In (seconds)</div>
                    <Input value={String(deviceCodePayload.expires_in)} readOnly />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Polling Interval (seconds)</div>
                    <Input value={String(deviceCodePayload.interval)} readOnly />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">{deviceCodePayload.message}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
