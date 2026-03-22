import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cake, Briefcase, CalendarDays, Mail, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

type AnniversaryType = "birthday" | "work";
type AnniversaryStatus = "pending" | "approved" | "rejected" | "needs_revision" | "sent";

interface AnniversaryEntry {
  id: string;
  name: string;
  department: string;
  type: AnniversaryType;
  date: string;
  years?: number;
}

type AnniversaryQueueItem = {
  id: number;
  employeeId: string;
  name: string;
  department: string | null;
  anniversaryDate: string;
  type: AnniversaryType;
  status: AnniversaryStatus;
  imageUrl: string;
  emailSubject: string | null;
  years: number | null;
};

const MOCK_DATA: AnniversaryEntry[] = [
  { id: "1", name: "John Smith", department: "Engineering", type: "work", date: "2026-03-20", years: 5 },
  { id: "2", name: "Maria Lee", department: "Finance", type: "birthday", date: "2026-03-20" },
  { id: "3", name: "Ahmad Rizky", department: "Operations", type: "work", date: "2026-03-23", years: 1 },
  { id: "4", name: "Siti Nurhaliza", department: "HR", type: "birthday", date: "2026-03-25" },
  { id: "5", name: "Budi Santoso", department: "Engineering", type: "work", date: "2026-03-28", years: 3 },
  { id: "6", name: "Dewi Lestari", department: "Marketing", type: "birthday", date: "2026-04-02" },
  { id: "7", name: "Rahmat Hidayat", department: "Operations", type: "work", date: "2026-04-10", years: 2 },
  { id: "8", name: "Lisa Wijaya", department: "Finance", type: "birthday", date: "2026-03-18" },
];

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const departments = [...new Set(MOCK_DATA.map((e) => e.department))];

function AnniversaryRow({ entry }: { entry: AnniversaryEntry }) {
  const today = isToday(entry.date);
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors",
        today ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          entry.type === "birthday"
            ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        )}
      >
        {entry.type === "birthday" ? <Cake className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{entry.department}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={entry.type === "birthday" ? "secondary" : "outline"} className="text-xs">
          {entry.type === "birthday" ? "Birthday" : `${entry.years}yr Work`}
        </Badge>
        <span className={cn("text-xs font-medium", today ? "text-primary" : "text-muted-foreground")}>
          {today ? "Today" : formatDate(entry.date)}
        </span>
      </div>
    </div>
  );
}

export default function Anniversaries() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [queue, setQueue] = useState<AnniversaryQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseTarget, setReviseTarget] = useState<AnniversaryQueueItem | null>(null);
  const [revisePrompt, setRevisePrompt] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  const loadQueue = async () => {
    try {
      setQueueLoading(true);
      setQueueError(null);
      const res = await apiFetch("/anniversaries/queue?range=next7days", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || `HTTP_${res.status}`);
      const items = (data?.items || []) as AnniversaryQueueItem[];
      setQueue(items);
    } catch (err: unknown) {
      setQueueError(err instanceof Error ? err.message : "FAILED_TO_LOAD_QUEUE");
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    loadQueue().catch(() => {});
  }, []);

  const filtered = MOCK_DATA.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    return true;
  });

  const thisWeek = filtered.filter((e) => isThisWeek(e.date));
  const thisMonth = filtered.filter((e) => isThisMonth(e.date));
  const history = filtered.filter((e) => new Date(e.date) < new Date());

  const statusLabel = (status: AnniversaryStatus) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "needs_revision") return "Needs Revision";
    if (status === "sent") return "Sent";
    return "Pending";
  };

  return (
    <MainLayout title="Anniversaries">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Anniversaries</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track employee birthdays and work anniversaries.
            </p>
          </div>
          <Link
            to="/employees/anniversaries/email-preview"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Mail className="h-4 w-4" />
            Email Templates
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Weekly Review Queue</CardTitle>
              <p className="text-sm text-muted-foreground">Review upcoming anniversaries for the next 7 days.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setGenerateLoading(true);
                    const res = await apiFetch("/anniversaries/generate-weekly", { method: "POST", credentials: "include" });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) throw new Error((data && data.error) || `HTTP_${res.status}`);
                    await loadQueue();
                    toast({ title: "Weekly drafts generated", description: `Added ${data?.inserted ?? 0} items.` });
                  } catch (err: unknown) {
                    toast({ title: "Failed to generate drafts", description: err instanceof Error ? err.message : "FAILED", variant: "destructive" });
                  } finally {
                    setGenerateLoading(false);
                  }
                }}
                disabled={generateLoading}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {generateLoading ? "Generating..." : "Generate This Week"}
              </Button>
              <Button variant="outline" onClick={loadQueue} disabled={queueLoading}>
                {queueLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {queueError ? (
              <p className="text-sm text-destructive">Failed to load queue ({queueError}).</p>
            ) : queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming anniversaries in the next 7 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover" />
                          <div>
                            <div className="text-sm font-semibold">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.department || "Unknown Dept"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(item.anniversaryDate)}</TableCell>
                      <TableCell>
                        <Badge variant={item.type === "birthday" ? "secondary" : "outline"}>
                          {item.type === "birthday" ? "Birthday" : "Work"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "approved" ? "default" : item.status === "rejected" ? "destructive" : "secondary"}>
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <a href={item.imageUrl} target="_blank" rel="noreferrer">View</a>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              setActionLoading(true);
                              const res = await apiFetch(`/anniversaries/${item.id}/approve`, { method: "POST", credentials: "include" });
                              const data = await res.json().catch(() => null);
                              if (!res.ok) throw new Error((data && data.error) || `HTTP_${res.status}`);
                              await loadQueue();
                              toast({ title: "Approved", description: `${item.name} approved.` });
                            } catch (err: unknown) {
                              toast({ title: "Approval failed", description: err instanceof Error ? err.message : "FAILED", variant: "destructive" });
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          disabled={actionLoading}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviseTarget(item);
                            setRevisePrompt("");
                            setReviseOpen(true);
                          }}
                        >
                          Revise
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              setActionLoading(true);
                              const res = await apiFetch(`/anniversaries/${item.id}/reject`, { method: "POST", credentials: "include" });
                              const data = await res.json().catch(() => null);
                              if (!res.ok) throw new Error((data && data.error) || `HTTP_${res.status}`);
                              await loadQueue();
                              toast({ title: "Rejected", description: `${item.name} archived.` });
                            } catch (err: unknown) {
                              toast({ title: "Reject failed", description: err instanceof Error ? err.message : "FAILED", variant: "destructive" });
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          disabled={actionLoading}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="birthday">Birthday</SelectItem>
              <SelectItem value="work">Work Anniversary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="week" className="w-full">
          <TabsList>
            <TabsTrigger value="week" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              This Week
              {thisWeek.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                  {thisWeek.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="week" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">This Week</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {thisWeek.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No anniversaries this week.
                  </p>
                ) : (
                  thisWeek.map((e) => <AnniversaryRow key={e.id} entry={e} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="month" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {thisMonth.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No anniversaries this month.
                  </p>
                ) : (
                  thisMonth.map((e) => <AnniversaryRow key={e.id} entry={e} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Past Anniversaries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No past records yet.
                  </p>
                ) : (
                  history.map((e) => <AnniversaryRow key={e.id} entry={e} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Anniversary Draft</DialogTitle>
            <DialogDescription>Provide a prompt to regenerate the draft for {reviseTarget?.name}.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={revisePrompt}
            onChange={(event) => setRevisePrompt(event.target.value)}
            placeholder="Example: Use a warmer tone and emphasize team appreciation."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviseOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!reviseTarget) return;
                try {
                  setActionLoading(true);
                  const res = await apiFetch(`/anniversaries/${reviseTarget.id}/revise`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: revisePrompt }),
                  });
                  const data = await res.json().catch(() => null);
                  if (!res.ok) throw new Error((data && data.error) || `HTTP_${res.status}`);
                  setReviseOpen(false);
                  setRevisePrompt("");
                  await loadQueue();
                  toast({ title: "Revision requested", description: `${reviseTarget.name} draft regenerated.` });
                } catch (err: unknown) {
                  toast({ title: "Revision failed", description: err instanceof Error ? err.message : "FAILED", variant: "destructive" });
                } finally {
                  setActionLoading(false);
                }
              }}
              disabled={!revisePrompt.trim() || actionLoading}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
