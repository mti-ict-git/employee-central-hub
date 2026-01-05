import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { Button } from "@/components/ui/button";
import { Employee } from "@/types/employee";
import { useEffect, useState } from "react";
import { Users, UserCheck, UserX, Globe, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const Index = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, indonesia: 0, expat: 0 });
  const [departments, setDepartments] = useState<Array<{ department: string; count: number }>>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const [statsRes, employeesRes] = await Promise.all([
          apiFetch(`/employees/stats`, { signal: ctrl.signal, credentials: "include" }),
          apiFetch(`/employees?limit=500`, { signal: ctrl.signal, credentials: "include" }),
        ]);

        if (statsRes.ok) {
          const data = (await statsRes.json().catch(() => null)) as
            | { total?: number; active?: number; inactive?: number; indonesia?: number; expat?: number; departments?: Array<{ department?: string; count?: number }> }
            | null;
          setStats({
            total: Number(data?.total || 0),
            active: Number(data?.active || 0),
            inactive: Number(data?.inactive || 0),
            indonesia: Number(data?.indonesia || 0),
            expat: Number(data?.expat || 0),
          });
          setDepartments(
            Array.isArray(data?.departments)
              ? data.departments.map((d) => ({
                  department: String(d?.department || "-").trim() || "-",
                  count: Number(d?.count || 0),
                }))
              : [],
          );
        }

        if (!employeesRes.ok) return;
        const employeesData = await employeesRes.json();
        const items = Array.isArray(employeesData.items) ? employeesData.items : [];
        const mapped: Employee[] = items.map((e: { core: { employee_id: string; name: string; nationality?: string | null }; employment: { department?: string | null; status?: string | null }; type?: string }) => ({
          core: { employee_id: e.core.employee_id, name: e.core.name, nationality: e.core.nationality || "", imip_id: "", branch: "", branch_id: "" },
          contact: { phone_number: "", email: "", address: "", city: "", spouse_name: "", child_name_1: "", child_name_2: "", child_name_3: "", emergency_contact_name: "", emergency_contact_phone: "" },
          employment: { employment_status: "", status: e.employment.status || "Active", division: "", department: e.employment.department || "", section: "", job_title: "", grade: "", position_grade: "", group_job_title: "", direct_report: "", company_office: "", work_location: "", locality_status: "", terminated_date: "", terminated_type: "", terminated_reason: "", blacklist_mti: false, blacklist_imip: false },
          onboard: { point_of_hire: "", point_of_origin: "", schedule_type: "", first_join_date_merdeka: "", transfer_merdeka: "", first_join_date: "", join_date: "", end_contract: "", years_in_service: "" },
          bank: { employee_id: e.core.employee_id, bank_name: "", account_name: "", account_no: "", bank_code: "", icbc_bank_account_no: "", icbc_username: "" },
          insurance: { employee_id: e.core.employee_id, insurance_endorsement: false, insurance_owlexa: false, insurance_fpg: false, bpjs_tk: "", bpjs_kes: "", status_bpjs_kes: undefined, social_insurance_no_alt: "", bpjs_kes_no_alt: "", fpg_no: "", owlexa_no: "" },
          travel: { employee_id: e.core.employee_id, kitas_no: "", passport_no: "", travel_in: "", travel_out: "", name_as_passport: "", passport_expiry: "", kitas_expiry: "", imta: "", rptka_no: "", rptka_position: "", kitas_address: "", job_title_kitas: "" },
          checklist: { employee_id: e.core.employee_id, passport_checklist: false, kitas_checklist: false, imta_checklist: false, rptka_checklist: false, npwp_checklist: false, bpjs_kes_checklist: false, bpjs_tk_checklist: false, bank_checklist: false },
          notes: { employee_id: e.core.employee_id, batch: "", note: "" },
          type: (e.type === "indonesia" ? "indonesia" : "expat"),
        }));
        setEmployees(mapped);
      } catch {
        setEmployees([]);
        setStats({ total: 0, active: 0, inactive: 0, indonesia: 0, expat: 0 });
        setDepartments([]);
      }
    };
    run();
    return () => ctrl.abort();
  }, []);
  const recentEmployees = employees.slice(0, 5);
  const handleDelete = async (employeeId: string) => {
    try {
      const res = await apiFetch(`/employees/${encodeURIComponent(employeeId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      const next = employees.filter((e) => e.core.employee_id !== employeeId);
      setEmployees(next);
      try {
        const r = await apiFetch(`/employees/stats`, { credentials: "include" });
        if (r.ok) {
          const data = (await r.json().catch(() => null)) as
            | { total?: number; active?: number; inactive?: number; indonesia?: number; expat?: number; departments?: Array<{ department?: string; count?: number }> }
            | null;
          setStats({
            total: Number(data?.total || 0),
            active: Number(data?.active || 0),
            inactive: Number(data?.inactive || 0),
            indonesia: Number(data?.indonesia || 0),
            expat: Number(data?.expat || 0),
          });
          setDepartments(
            Array.isArray(data?.departments)
              ? data.departments.map((d) => ({
                  department: String(d?.department || "-").trim() || "-",
                  count: Number(d?.count || 0),
                }))
              : [],
          );
        }
      } catch (e: unknown) {
        void e;
      }
      toast({ title: "Deleted", description: `Employee ${employeeId} deleted` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <MainLayout title="Dashboard" subtitle="Employee Master Data Overview">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 animate-fade-in">
        <StatCard
          title="Total Employees"
          value={stats.total}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Inactive"
          value={stats.inactive}
          icon={UserX}
        />
        <StatCard
          title="Indonesia"
          value={stats.indonesia}
          icon={MapPin}
        />
        <StatCard
          title="Expatriate"
          value={stats.expat}
          icon={Globe}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Recent Employees</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/employees">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <EmployeeTable employees={recentEmployees} onDelete={handleDelete} />
        </div>

        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-display text-lg font-semibold">Quick Actions</h2>
          
          <div className="space-y-3">
            <Link 
              to="/employees/new"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">Add New Employee</p>
                <p className="text-sm text-muted-foreground">Register a new employee</p>
              </div>
            </Link>

            <Link 
              to="/employees?type=indonesia"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <MapPin className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Indonesia Employees</p>
                <p className="text-sm text-muted-foreground">{stats.indonesia} employees</p>
              </div>
            </Link>

            <Link 
              to="/employees?type=expat"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Globe className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Expatriate Employees</p>
                <p className="text-sm text-muted-foreground">{stats.expat} employees</p>
              </div>
            </Link>
          </div>

          {/* Department Distribution */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="font-medium mb-3">Department Distribution</h3>
            <div className="space-y-2 max-h-96 overflow-auto">
              {departments.map((d) => {
                const percentage = stats.total ? (d.count / stats.total) * 100 : 0;
                return (
                  <div key={d.department}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{d.department}</span>
                      <span className="text-muted-foreground">{d.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full rounded-full gradient-primary transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
