import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
function WorkAnniversaryEmail({ recipientType }: { recipientType: string }) {
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
              <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🎉</div>
            </td>
          </tr>
          {/* Title */}
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 8px" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: BRAND.textDark, lineHeight: 1.3 }}>
                {isEmployee
                  ? "Congratulations on 5 Years!"
                  : "Work Anniversary Reminder"}
              </h1>
            </td>
          </tr>
          {/* Subtitle */}
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 24px" }}>
              <p style={{ margin: 0, fontSize: 14, color: BRAND.textMuted, lineHeight: 1.6 }}>
                {isEmployee
                  ? "Today marks your 5th year with Merdeka Group. Thank you for your dedication, hard work, and the incredible contributions you've made to our team."
                  : isManager
                    ? "Your team member, John Smith (Engineering), is celebrating 5 years with Merdeka Group today, March 20."
                    : "John Smith from the Engineering department is celebrating 5 years with Merdeka Group today, March 20."}
              </p>
            </td>
          </tr>
          {/* Milestone badge */}
          <tr>
            <td style={{ textAlign: "center" as const, padding: "0 32px 24px" }}>
              <div style={{
                display: "inline-block",
                padding: "14px 32px",
                background: `linear-gradient(135deg, ${BRAND.primaryLight}, ${BRAND.white})`,
                borderRadius: 10,
                border: `1px solid ${BRAND.primaryColor}22`,
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: BRAND.primaryColor, lineHeight: 1 }}>5</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.primaryColor, textTransform: "uppercase" as const, letterSpacing: 1, marginTop: 2 }}>Years of Service</div>
              </div>
            </td>
          </tr>
          {/* Detail card */}
          <tr>
            <td style={{ padding: "0 32px 28px" }}>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", backgroundColor: BRAND.primaryLight, borderRadius: 8, border: `1px solid ${BRAND.primaryColor}22` }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "18px 20px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.primaryColor, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 }}>Anniversary Details</div>
                      <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted, paddingBottom: 6, width: 100 }}>Employee</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark, paddingBottom: 6 }}>John Smith</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted, paddingBottom: 6 }}>Department</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark, paddingBottom: 6 }}>Engineering</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted, paddingBottom: 6 }}>Join Date</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark, paddingBottom: 6 }}>March 20, 2021</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: 13, color: BRAND.textMuted }}>Milestone</td>
                            <td style={{ fontSize: 13, fontWeight: 600, color: BRAND.textDark }}>5 Years</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          {/* CTA */}
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

        {/* Templates */}
        <Tabs defaultValue="birthday" className="w-full">
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
                      {tab === "birthday" ? "🎂 Happy Birthday, Maria!" : tab === "work" ? "🎉 Congratulations on 5 Years, John!" : "📅 Upcoming Anniversaries This Week"}
                    </span>
                  </div>
                </div>

                {/* Email body */}
                <div className={cn(
                  "mx-auto overflow-x-auto transition-all",
                  device === "mobile" ? "max-w-[375px]" : "w-full"
                )}>
                  {tab === "birthday" && <BirthdayEmail recipientType={recipient} />}
                  {tab === "work" && <WorkAnniversaryEmail recipientType={recipient} />}
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
