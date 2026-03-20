import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cake, Briefcase, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type AnniversaryType = "birthday" | "work";

interface AnniversaryEntry {
  id: string;
  name: string;
  department: string;
  type: AnniversaryType;
  date: string;
  years?: number;
}

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

  const filtered = MOCK_DATA.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    return true;
  });

  const thisWeek = filtered.filter((e) => isThisWeek(e.date));
  const thisMonth = filtered.filter((e) => isThisMonth(e.date));
  const history = filtered.filter((e) => new Date(e.date) < new Date());

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Anniversaries</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track employee birthdays and work anniversaries.
          </p>
        </div>

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
    </MainLayout>
  );
}
