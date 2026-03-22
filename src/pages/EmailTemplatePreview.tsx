import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Shared brand constants                                             */
/* ------------------------------------------------------------------ */
const BRAND = {
  name: "Merdeka Group",
  tagline: "Human Resources Information System",
  primaryColor: "#1d4ed8",   // blue-700
  primaryLight: "#dbeafe",   // blue-100
  accentWarm: "#f59e0b",     // amber-500
  accentWarmLight: "#fef3c7",// amber-100
  textDark: "#1e293b",       // slate-800
  textMuted: "#64748b",      // slate-500
  border: "#e2e8f0",         // slate-200
  bgLight: "#f8fafc",        // slate-50
  white: "#ffffff",
};

/* ------------------------------------------------------------------ */
/*  Birthday Email Template                                            */
/* ------------------------------------------------------------------ */
function BirthdayEmail({ recipientType }: { recipientType: string }) {
  const isEmployee = recipientType === "employee";
  const isManager = recipientType === "manager";

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", backgroundColor: BRAND.bgLight, padding: "32px 0" }}>
      <table cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, margin: "0 auto", backgroundColor: BRAND.white, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        {/* Header */}
        <thead>
          <tr>
            <td style={{ backgroundColor: BRAND.primaryColor, padding: "28px 32px", textAlign: "center" as const }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>
                {BRAND.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {BRAND.tagline}
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          {/* Emoji hero */}
          <tr>
            <td style={{ textAlign: "center" as const, padding: "36px 32px 8px" }}>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🎂</div>
            </td>
          </tr>
          {/* Title */}
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 8px" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.textDark, lineHeight: 1.3 }}>
                {isEmployee ? "Happy Birthday, Maria!" : "Birthday Reminder"}
              </h1>
            </td>
          </tr>
          {/* Subtitle */}
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 24px" }}>
              <p style={{ margin: 0, fontSize: 14, color: BRAND.textMuted, lineHeight: 1.6 }}>
                {isEmployee
                  ? "Wishing you a wonderful day filled with joy and celebration. The entire team at Merdeka Group hopes this year brings you happiness and success!"
                  : isManager
                    ? "This is a reminder that your team member, Maria Lee (Finance), is celebrating her birthday today, March 20."
                    : "Maria Lee from the Finance department is celebrating her birthday today, March 20."}
              </p>
            </td>
          </tr>
          {/* Detail card */}
          <tr>
            <td style={{ padding: "0 32px 28px" }}>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", backgroundColor: BRAND.accentWarmLight, borderRadius: 8, border: `1px solid ${BRAND.accentWarm}33` }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "18px 20px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.accentWarm, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 }}>Birthday Details</div>
                      <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted, paddingBottom: 6, width: 100 }}>Employee</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark, paddingBottom: 6 }}>Maria Lee</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted, paddingBottom: 6 }}>Department</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark, paddingBottom: 6 }}>Finance</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted }}>Date</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark }}>March 20, 2026</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          {/* CTA (non-employee only) */}
          {!isEmployee && (
            <tr>
              <td style={{ textAlign: "center" as const, padding: "0 32px 28px" }}>
                <a href="#" style={{ display: "inline-block", padding: "10px 28px", backgroundColor: BRAND.primaryColor, color: BRAND.white, fontSize: 13, fontWeight: 600, borderRadius: 6, textDecoration: "none" }}>
                  View Employee Profile
                </a>
              </td>
            </tr>
          )}
          {/* Footer */}
          <tr>
            <td style={{ borderTop: `1px solid ${BRAND.border}`, padding: "20px 32px", textAlign: "center" as const }}>
              <p style={{ margin: 0, fontSize: 11, color: BRAND.textMuted, lineHeight: 1.6 }}>
                This is an automated notification from {BRAND.name} HRIS.<br />
                To manage notification preferences, visit Settings → Anniversaries.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Work Anniversary Email Template                                    */
/* ------------------------------------------------------------------ */
function WorkAnniversaryEmail({
  recipientType,
  name,
  department,
  years,
  joinDate,
  employeePhotoUrl,
  previewImageBase64,
}: {
  recipientType: string;
  name: string;
  department: string;
  years: number;
  joinDate: string;
  employeePhotoUrl?: string | null;
  previewImageBase64?: string | null;
}) {
  const isEmployee = recipientType === "employee";
  const subtitle = isEmployee ? `Celebrating ${years} Years of Dedication` : "Please celebrate this milestone with the team.";
  return (
    <div className="bg-muted/40 p-6">
      <div className="mx-auto max-w-[640px] overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="relative">
          <img
            src={previewImageBase64 ? `data:image/png;base64,${previewImageBase64}` : "/anniversary_template.png"}
            alt="Anniversary Template"
            className="w-full object-cover"
          />
          {!previewImageBase64 && (
            <div className="absolute inset-0 flex flex-col items-center justify-end px-6 pb-10 text-center">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">Happy Work Anniversary</div>
              <div className="mt-2 text-3xl font-bold text-white">{name}</div>
              <div className="mt-1 text-sm text-emerald-100">{subtitle}</div>
            </div>
          )}
          {!!employeePhotoUrl && !previewImageBase64 && (
            <img
              src={employeePhotoUrl}
              alt={name}
              className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white object-cover shadow-md"
            />
          )}
        </div>
        <div className="space-y-3 p-6 text-sm text-muted-foreground">
          <div className="text-base font-semibold text-foreground">Anniversary Details</div>
          <div className="flex items-center justify-between">
            <span>Department</span>
            <span className="text-foreground">{department}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Join Date</span>
            <span className="text-foreground">{joinDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Milestone</span>
            <span className="text-foreground">{years} Years</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Advance Reminder Email Template                                    */
/* ------------------------------------------------------------------ */
function ReminderEmail() {
  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", backgroundColor: BRAND.bgLight, padding: "32px 0" }}>
      <table cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, margin: "0 auto", backgroundColor: BRAND.white, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <thead>
          <tr>
            <td style={{ backgroundColor: BRAND.primaryColor, padding: "28px 32px", textAlign: "center" as const }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>
                {BRAND.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {BRAND.tagline}
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: "center" as const, padding: "36px 32px 8px" }}>
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>📅</div>
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 8px" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.textDark, lineHeight: 1.3 }}>
                Upcoming Anniversaries This Week
              </h1>
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 24px" }}>
              <p style={{ margin: 0, fontSize: 14, color: BRAND.textMuted, lineHeight: 1.6 }}>
                The following employees have upcoming milestones. Plan ahead to make their day special.
              </p>
            </td>
          </tr>
          {/* List */}
          <tr>
            <td style={{ padding: "0 32px 28px" }}>
              {[
                { name: "Maria Lee", dept: "Finance", type: "Birthday", date: "Mar 20", emoji: "🎂" },
                { name: "John Smith", dept: "Engineering", type: "5yr Work Anniversary", date: "Mar 20", emoji: "🎉" },
                { name: "Ahmad Rizky", dept: "Operations", type: "1yr Work Anniversary", date: "Mar 23", emoji: "🎉" },
              ].map((item, i) => (
                <table key={i} cellPadding={0} cellSpacing={0} style={{ width: "100%", marginBottom: i < 2 ? 8 : 0, backgroundColor: BRAND.bgLight, borderRadius: 8, border: `1px solid ${BRAND.border}` }}>
                  <tbody>
                    <tr>
                      <td style={{ width: 44, textAlign: "center" as const, verticalAlign: "middle", padding: "12px 0 12px 14px", fontSize: 22 }}>
                        {item.emoji}
                      </td>
                      <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: BRAND.textMuted }}>{item.dept} · {item.type}</div>
                      </td>
                      <td style={{ padding: "12px 14px 12px 0", textAlign: "right" as const, verticalAlign: "middle" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.primaryColor }}>{item.date}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ))}
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 28px" }}>
              <a href="#" style={{ display: "inline-block", padding: "10px 28px", backgroundColor: BRAND.primaryColor, color: BRAND.white, fontSize: 13, fontWeight: 600, borderRadius: 6, textDecoration: "none" }}>
                View All Anniversaries
              </a>
            </td>
          </tr>
          <tr>
            <td style={{ borderTop: `1px solid ${BRAND.border}`, padding: "20px 32px", textAlign: "center" as const }}>
              <p style={{ margin: 0, fontSize: 11, color: BRAND.textMuted, lineHeight: 1.6 }}>
                This is an automated notification from {BRAND.name} HRIS.<br />
                To manage notification preferences, visit Settings → Anniversaries.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview Page                                                       */
/* ------------------------------------------------------------------ */
export default function EmailTemplatePreview() {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [recipient, setRecipient] = useState("employee");
  const [activeTab, setActiveTab] = useState<"birthday" | "work" | "reminder">("work");
  const [workName, setWorkName] = useState("John Smith");
  const [workDept, setWorkDept] = useState("Engineering");
  const [workYears, setWorkYears] = useState(5);
  const [workJoinDate, setWorkJoinDate] = useState("March 20, 2021");
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<Array<{ id: string; name: string; dept?: string }>>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [employeePhotoUrl, setEmployeePhotoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewImageBase64, setPreviewImageBase64] = useState<string | null>(null);

  return (
    <MainLayout title="Email Template Preview">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Template Preview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview how anniversary notification emails will appear to recipients.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={recipient} onValueChange={setRecipient}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">As Employee</SelectItem>
              <SelectItem value="hr">As HR Team</SelectItem>
              <SelectItem value="manager">As Manager</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => setDevice("desktop")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                device === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                device === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
          </div>

          <Badge variant="outline" className="text-xs">Mockup — not sent</Badge>
        </div>

        {activeTab === "work" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-4">
              <div className="flex items-center gap-2">
                <Input
                  className="w-full"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search employee (name or ID)"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const params = new URLSearchParams();
                      params.set("limit", "5");
                      params.set("offset", "0");
                      params.set("q", empSearch.trim());
                      const res = await apiFetch(`/employees?${params.toString()}`, { credentials: "include" });
                      const data = await res.json().catch(() => null);
                      if (!res.ok) throw new Error(`HTTP_${res.status}`);
                      const items = Array.isArray(data?.items) ? (data.items as unknown[]) : [];
                      const mapped = items.map((raw) => {
                        const it = raw as Record<string, unknown>;
                        const core = (it.core as Record<string, unknown>) || {};
                        const emp = (it.employment as Record<string, unknown>) || {};
                        return {
                          id: String(core.employee_id || ""),
                          name: String(core.name || ""),
                          dept: emp && typeof emp.department !== "undefined" ? String(emp.department || "") : undefined,
                        };
                      });
                      setEmpResults(mapped);
                    } catch (err: unknown) {
                      toast({ title: "Search failed", description: err instanceof Error ? err.message : "FAILED", variant: "destructive" });
                    }
                  }}
                >
                  Search
                </Button>
              </div>
              {empResults.length > 0 && (
                <div className="mt-2 rounded-md border">
                  {empResults.map((e) => (
                    <button
                      key={e.id}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={async () => {
                        try {
                          setSelectedEmpId(e.id);
                          setWorkName(e.name || e.id);
                          setWorkDept(e.dept || "Unknown");
                          setEmployeePhotoUrl(`/api/employees/${e.id}/photo`);
                          const res = await apiFetch(`/employees/${e.id}`, { credentials: "include" });
                          if (res.ok) {
                            const det = await res.json().catch(() => null);
                            const join = det?.onboard?.join_date || det?.employment?.join_date || null;
                            if (join) {
                              const dt = new Date(join);
                              setWorkJoinDate(dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }));
                              const now = new Date();
                              const yrs = now.getFullYear() - dt.getFullYear() - ((now.getMonth() < dt.getMonth() || (now.getMonth() === dt.getMonth() && now.getDate() < dt.getDate())) ? 1 : 0);
                              setWorkYears(Math.max(0, yrs));
                            }
                          }
                        } catch { /* ignore */ }
                      }}
                    >
                      <span>{e.name} <span className="text-muted-foreground">({e.id})</span></span>
                      <span className="text-xs text-muted-foreground">{e.dept || "—"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-12 md:col-span-3">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={workName}
                onChange={(e) => setWorkName(e.target.value)}
                placeholder="Employee Name"
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={workDept}
                onChange={(e) => setWorkDept(e.target.value)}
                placeholder="Department"
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <input
                type="number"
                min={0}
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={workYears}
                onChange={(e) => setWorkYears(Number(e.target.value))}
                placeholder="Years"
              />
            </div>
            <div className="col-span-6 md:col-span-4">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={workJoinDate}
                onChange={(e) => setWorkJoinDate(e.target.value)}
                placeholder="Join Date (text)"
              />
            </div>
            <div className="col-span-12">
              <Button
                onClick={async () => {
                  setPreviewImageBase64(null);
                  if (!selectedEmpId) {
                    toast({ title: "Select an employee first", description: "Search and choose an employee", variant: "destructive" });
                    return;
                  }
                  try {
                    setGenerating(true);
                    const res = await apiFetch(`/anniversaries/preview-image?debug=1&returnPrompt=1`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ employeeId: selectedEmpId, years: workYears }),
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok) throw new Error((data && data.error) || `HTTP_${res.status}`);
                    if (data?.imageBase64) {
                      setPreviewImageBase64(String(data.imageBase64));
                      toast({ title: "Preview generated", description: "Image generated with Nano Banana" });
                      if (data?.prompt) {
                        console.info("[Anniversary Preview Prompt]", data.prompt, data?.meta || {});
                      }
                    } else {
                      throw new Error("No image in response");
                    }
                  } catch (err: unknown) {
                    toast({ title: "Generation failed", description: err instanceof Error ? err.message : "FAILED", variant: "destructive" });
                  } finally {
                    setGenerating(false);
                  }
                }}
                disabled={!selectedEmpId || generating}
              >
                {generating ? "Generating..." : "Generate with Nano Banana"}
              </Button>
            </div>
          </div>
        )}

        {/* Templates */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList>
            <TabsTrigger value="birthday">🎂 Birthday</TabsTrigger>
            <TabsTrigger value="work">🎉 Work Anniversary</TabsTrigger>
            <TabsTrigger value="reminder">📅 Advance Reminder</TabsTrigger>
          </TabsList>

          {["birthday", "work", "reminder"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card className="overflow-hidden border-2 border-dashed">
                {/* Fake email client header */}
                <div className="border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                  <div className="flex gap-2">
                    <span className="font-semibold text-foreground w-14">From:</span>
                    <span>hr-notifications@merdekagroup.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-foreground w-14">To:</span>
                    <span>
                      {recipient === "employee" ? "maria.lee@merdekagroup.com" : recipient === "manager" ? "manager@merdekagroup.com" : "hr-team@merdekagroup.com"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-foreground w-14">Subject:</span>
                    <span className="font-medium text-foreground">
                      {tab === "birthday" ? "🎂 Happy Birthday, Maria!" : tab === "work" ? `🎉 Congratulations on ${workYears} Years, ${workName}!` : "📅 Upcoming Anniversaries This Week"}
                    </span>
                  </div>
                </div>

                {/* Email body */}
                <div className={cn(
                  "mx-auto overflow-x-auto transition-all",
                  device === "mobile" ? "max-w-[375px]" : "w-full"
                )}>
                  {tab === "birthday" && <BirthdayEmail recipientType={recipient} />}
                  {tab === "work" && (
                    <WorkAnniversaryEmail
                      recipientType={recipient}
                      name={workName}
                      department={workDept}
                      years={workYears}
                      joinDate={workJoinDate}
                      employeePhotoUrl={employeePhotoUrl}
                      previewImageBase64={previewImageBase64}
                    />
                  )}
                  {tab === "reminder" && <ReminderEmail />}
                </div>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
