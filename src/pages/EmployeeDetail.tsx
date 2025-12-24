import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import type { Employee } from "@/types/employee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Pencil, 
  User, 
  Briefcase, 
  CreditCard, 
  Shield, 
  Plane,
  Phone,
  CheckSquare,
  StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRBAC } from "@/hooks/useRBAC";
import { apiFetch } from "@/lib/api";

const InfoRow = ({ label, value, visible = true }: { label: string; value?: string | boolean | null; visible?: boolean }) => {
  if (!visible) return null;
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value ?? '');
  const text = displayValue === '' ? 'N/A' : displayValue;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground w-full sm:w-48 shrink-0">{label}</span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-6 shadow-card">
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
        <Icon className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

const EmployeeDetail = () => {
  const { id } = useParams();
  const { caps, typeAccess } = useRBAC();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toLabel = (s: string) =>
    String(s || "")
      .replace(/_/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ");
  const hasSectionData = (key: string) => {
    const obj = (employee as unknown as Record<string, unknown>) || {};
    return obj[key] !== undefined && obj[key] !== null;
  };
  const canReadSection = (section: string) => hasSectionData(section);
  const canReadCol = (section: string, column: string) => {
    if (!hasSectionData(section)) return false;
    const key = String(section || "").toLowerCase();
    const t = String(employee?.type || "").trim().toLowerCase();
    const nat = String(employee?.core?.nationality || "").trim().toLowerCase();
    const type = t.startsWith("expat") ? "expat" : (nat === "indonesia" || nat.startsWith("indo") ? "indonesia" : "expat");
    const applicable = typeAccess?.[type]?.[key]?.[column];
    if (applicable === false) return false;
    if (caps && caps.canColumn(section, column, "read")) return true;
    return true;
  };
  const computeAge = (dob?: string | Date | null) => {
    if (!dob) return "";
    const d = typeof dob === "string" ? new Date(dob) : dob;
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return String(age);
  };
  const computeMonthOfBirthday = (dob?: string | Date | null) => {
    if (!dob) return "";
    const d = typeof dob === "string" ? new Date(dob) : dob;
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    const month = d.getMonth() + 1;
    return month < 10 ? `0${month}` : String(month);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/employees/${encodeURIComponent(id)}`, { signal: ctrl.signal, credentials: "include" });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const data = await res.json();
        const normalizedType = (() => {
          const raw = String(data?.type || "").trim().toLowerCase();
          const nat = String(data?.core?.nationality || "").trim().toLowerCase();
          if (raw.startsWith("expat")) return "expat";
          if (nat === "indonesia" || nat.startsWith("indo")) return "indonesia";
          return "expat";
        })();
        const normalized: Employee = {
          core: data.core,
          contact: data.contact,
          employment: data.employment,
          onboard: data.onboard,
          bank: data.bank,
          insurance: data.insurance,
          travel: data.travel,
          checklist: data.checklist,
          notes: data.notes,
          type: normalizedType,
        };
        setEmployee(normalized);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "FAILED_TO_FETCH_EMPLOYEE");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [id]);

  if (!employee) {
    return (
      <MainLayout title="Employee Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{error ? `Failed to load employee (${error}).` : "The employee you're looking for doesn't exist."}</p>
          <Button asChild>
            <Link to="/employees">Back to Employee List</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isActive = employee.employment?.status === 'Active';

  return (
    <MainLayout title="Employee Details" subtitle={employee.core?.name || ""}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" asChild>
          <Link to="/employees">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Link>
        </Button>
        {caps?.canUpdateEmployees && (
          <Button asChild>
            <Link to={`/employees/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Employee
            </Link>
          </Button>
        )}
      </div>

      {/* Employee Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card mb-6 animate-fade-in">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground">
            {(employee.core?.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="font-display text-2xl font-bold">{employee.core?.name || ""}</h2>
              <Badge variant={employee.type === 'indonesia' ? 'default' : 'secondary'}>
                {employee.type === 'indonesia' ? 'Indonesia' : 'Expatriate'}
              </Badge>
              <Badge 
                className={cn(
                  isActive 
                    ? "bg-success/10 text-success" 
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {employee.employment?.status || "Unknown"}
              </Badge>
            </div>
            {(employee.employment?.job_title || employee.employment?.department) && (
              <p className="text-muted-foreground">
                {employee.employment?.job_title || ""}{(employee.employment?.job_title && employee.employment?.department) ? " • " : ""}{employee.employment?.department || ""}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Employee ID: <span className="font-medium text-primary">{employee.core?.employee_id || ""}</span>
              {employee.core?.imip_id && <> • IMIP ID: <span className="font-medium">{employee.core?.imip_id}</span></>}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          {canReadSection("core") && (
            <TabsTrigger value="personal" className="gap-2">
              <User className="h-4 w-4" />
              Personal
            </TabsTrigger>
          )}
          {canReadSection("contact") && (
            <TabsTrigger value="contact" className="gap-2">
              <Phone className="h-4 w-4" />
              Contact
            </TabsTrigger>
          )}
          {canReadSection("employment") && (
            <TabsTrigger value="employment" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Employment
            </TabsTrigger>
          )}
          {canReadSection("onboard") && (
            <TabsTrigger value="onboard" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Onboarding
            </TabsTrigger>
          )}
          {canReadSection("bank") && (
            <TabsTrigger value="bank" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Bank
            </TabsTrigger>
          )}
          {canReadSection("insurance") && (
            <TabsTrigger value="insurance" className="gap-2">
              <Shield className="h-4 w-4" />
              Insurance
            </TabsTrigger>
          )}
          {canReadSection("travel") && (
            <TabsTrigger value="travel" className="gap-2">
              <Plane className="h-4 w-4" />
              Travel
            </TabsTrigger>
          )}
          {canReadSection("checklist") && (
            <TabsTrigger value="checklist" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Checklist
            </TabsTrigger>
          )}
          {canReadSection("notes") && (
            <TabsTrigger value="notes" className="gap-2">
              <StickyNote className="h-4 w-4" />
              Notes
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="personal">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Identifiers" icon={User}>
              <InfoRow label="Employee ID" value={employee.core?.employee_id} visible={canReadCol("core","employee_id")} />
              <InfoRow label="IMIP ID" value={employee.core?.imip_id} visible={canReadCol("core","imip_id")} />
            </SectionCard>
            <SectionCard title="Basic Information" icon={User}>
              <InfoRow label="Employee Name" value={employee.core?.name} visible={canReadCol("core","name")} />
              <InfoRow label="Gender" value={employee.core?.gender} visible={canReadCol("core","gender")} />
              <InfoRow label="Place of Birth" value={employee.core?.place_of_birth} visible={canReadCol("core","place_of_birth")} />
              <InfoRow label="Date of Birth" value={employee.core?.date_of_birth} visible={canReadCol("core","date_of_birth")} />
              <InfoRow label="Age" value={computeAge(employee.core?.date_of_birth)} visible={canReadCol("core","date_of_birth")} />
              <InfoRow label="Marital Status" value={employee.core?.marital_status} visible={canReadCol("core","marital_status")} />
              <InfoRow label="Religion" value={employee.core?.religion} visible={canReadCol("core","religion")} />
              <InfoRow label="Nationality" value={employee.core?.nationality} visible={canReadCol("core","nationality")} />
              <InfoRow label="Blood Type" value={employee.core?.blood_type} visible={canReadCol("core","blood_type")} />
              <InfoRow label="Month of Birthday" value={computeMonthOfBirthday(employee.core?.date_of_birth)} visible={canReadCol("core","date_of_birth")} />
              <InfoRow
                label="Field"
                value={employee.core?.field}
                visible={canReadCol("core","field")}
              />
            </SectionCard>
            <SectionCard title="Identification" icon={User}>
              <InfoRow label="KTP No" value={employee.core?.ktp_no} visible={canReadCol("core","ktp_no")} />
              <InfoRow label="Kartu Keluarga No" value={employee.core?.kartu_keluarga_no} visible={canReadCol("core","kartu_keluarga_no")} />
              <InfoRow label="NPWP" value={employee.core?.npwp} visible={canReadCol("core","npwp")} />
              <InfoRow label="Tax Status" value={employee.core?.tax_status} visible={canReadCol("core","tax_status")} />
              <InfoRow label="Education" value={employee.core?.education} visible={canReadCol("core","education")} />
              <InfoRow label="Office Email" value={employee.core?.office_email} visible={canReadCol("core","office_email")} />
              <InfoRow label="Branch ID" value={employee.core?.branch_id} visible={canReadCol("core","branch_id")} />
              <InfoRow label="Branch" value={employee.core?.branch} visible={canReadCol("core","branch")} />
              <InfoRow label="ID CARD MTI" value={employee.core?.id_card_mti ?? null} visible={canReadCol("core","id_card_mti")} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="contact">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Contact Information" icon={Phone}>
              <InfoRow label="Phone Number" value={employee.contact?.phone_number} visible={canReadCol("contact","phone_number")} />
              <InfoRow label="Personal Email" value={employee.contact?.email} visible={canReadCol("contact","email")} />
              <InfoRow label="Address" value={employee.contact?.address} visible={canReadCol("contact","address")} />
              <InfoRow label="City" value={employee.contact?.city} visible={canReadCol("contact","city")} />
            </SectionCard>
            <SectionCard title="Family & Emergency" icon={User}>
              <InfoRow label="Spouse Name" value={employee.contact?.spouse_name} visible={canReadCol("contact","spouse_name")} />
              <InfoRow label="Child 1" value={employee.contact?.child_name_1} visible={canReadCol("contact","child_name_1")} />
              <InfoRow label="Child 2" value={employee.contact?.child_name_2} visible={canReadCol("contact","child_name_2")} />
              <InfoRow label="Child 3" value={employee.contact?.child_name_3} visible={canReadCol("contact","child_name_3")} />
              <InfoRow label="Emergency Contact" value={employee.contact?.emergency_contact_name} visible={canReadCol("contact","emergency_contact_name")} />
              <InfoRow label="Emergency Phone" value={employee.contact?.emergency_contact_phone} visible={canReadCol("contact","emergency_contact_phone")} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Position Details" icon={Briefcase}>
              <InfoRow label="Emp. ID" value={employee.core?.employee_id} visible={canReadCol("employment","employee_id")} />
              <InfoRow label="Employment Status" value={employee.employment?.employment_status} visible={canReadCol("employment","employment_status")} />
              <InfoRow label="Employee Status" value={employee.employment?.status} visible={canReadCol("employment","status")} />
              <InfoRow label="Division" value={employee.employment?.division} visible={canReadCol("employment","division")} />
              <InfoRow label="Department" value={employee.employment?.department} visible={canReadCol("employment","department")} />
              <InfoRow label="Section" value={employee.employment?.section} visible={canReadCol("employment","section")} />
              <InfoRow label="Job Title" value={employee.employment?.job_title} visible={canReadCol("employment","job_title")} />
              <InfoRow label="Grade" value={employee.employment?.grade} visible={canReadCol("employment","grade")} />
              <InfoRow label="Position Grade" value={employee.employment?.position_grade} visible={canReadCol("employment","position_grade")} />
              <InfoRow label="Group Job Title" value={employee.employment?.group_job_title} visible={canReadCol("employment","group_job_title")} />
              <InfoRow label="Direct Report" value={employee.employment?.direct_report} visible={canReadCol("employment","direct_report")} />
            </SectionCard>
            <SectionCard title="Work Details" icon={Briefcase}>
              <InfoRow label="Company Office" value={employee.employment?.company_office} visible={canReadCol("employment","company_office")} />
              <InfoRow label="Work Location" value={employee.employment?.work_location} visible={canReadCol("employment","work_location")} />
              <InfoRow label="Locality Status" value={employee.employment?.locality_status} visible={canReadCol("employment","locality_status")} />
              <InfoRow label="Terminated Date" value={employee.employment?.terminated_date} visible={canReadCol("employment","terminated_date")} />
              <InfoRow label="Terminated Type" value={employee.employment?.terminated_type} visible={canReadCol("employment","terminated_type")} />
              <InfoRow label="Terminated Reason" value={employee.employment?.terminated_reason} visible={canReadCol("employment","terminated_reason")} />
              <InfoRow label="Black List MTI" value={employee.employment?.blacklist_mti} visible={canReadCol("employment","blacklist_mti")} />
              <InfoRow label="Black List IMIP" value={employee.employment?.blacklist_imip} visible={canReadCol("employment","blacklist_imip")} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="onboard">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Onboarding" icon={Briefcase}>
              <InfoRow label="Point of Hire" value={employee.onboard?.point_of_hire} visible={canReadCol("onboard","point_of_hire")} />
              <InfoRow label="Point of Origin" value={employee.onboard?.point_of_origin} visible={canReadCol("onboard","point_of_origin")} />
              <InfoRow label="Schedule Type" value={employee.onboard?.schedule_type} visible={canReadCol("onboard","schedule_type")} />
              <InfoRow label="First Join Date (Merdeka)" value={employee.onboard?.first_join_date_merdeka} visible={canReadCol("onboard","first_join_date_merdeka")} />
              <InfoRow label="Transfer Merdeka" value={employee.onboard?.transfer_merdeka} visible={canReadCol("onboard","transfer_merdeka")} />
              <InfoRow label="First Join Date" value={employee.onboard?.first_join_date} visible={canReadCol("onboard","first_join_date")} />
              <InfoRow label="Join Date" value={employee.onboard?.join_date} visible={canReadCol("onboard","join_date")} />
              <InfoRow label="End Contract" value={employee.onboard?.end_contract} visible={canReadCol("onboard","end_contract")} />
              <InfoRow label="Years in Service" value={employee.onboard?.years_in_service} visible={canReadCol("onboard","years_in_service")} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="bank">
          <SectionCard title="Bank Account" icon={CreditCard}>
            <InfoRow label="Bank Name" value={employee.bank?.bank_name} visible={canReadCol("bank","bank_name")} />
            <InfoRow label="Account Name" value={employee.bank?.account_name} visible={canReadCol("bank","account_name")} />
            <InfoRow label="Account No" value={employee.bank?.account_no} visible={canReadCol("bank","account_no")} />
            <InfoRow label="Bank Code" value={employee.bank?.bank_code} visible={canReadCol("bank","bank_code")} />
            <InfoRow label="ICBC Account No" value={employee.bank?.icbc_bank_account_no} visible={canReadCol("bank","icbc_bank_account_no")} />
            <InfoRow label="ICBC Username" value={employee.bank?.icbc_username} visible={canReadCol("bank","icbc_username")} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="insurance">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Insurance Status" icon={Shield}>
              <InfoRow label="Insurance Endorsement" value={employee.insurance?.insurance_endorsement} visible={canReadCol("insurance","insurance_endorsement")} />
              <InfoRow label="Insurance Owlexa" value={employee.insurance?.insurance_owlexa} visible={canReadCol("insurance","insurance_owlexa")} />
              <InfoRow label="Insurance FPG" value={employee.insurance?.insurance_fpg} visible={canReadCol("insurance","insurance_fpg")} />
              <InfoRow label="FPG No" value={employee.insurance?.fpg_no} visible={canReadCol("insurance","fpg_no")} />
              <InfoRow label="Owlexa No" value={employee.insurance?.owlexa_no} visible={canReadCol("insurance","owlexa_no")} />
            </SectionCard>
            <SectionCard title="BPJS" icon={Shield}>
              <InfoRow label="BPJS TK No" value={employee.insurance?.bpjs_tk} visible={canReadCol("insurance","bpjs_tk")} />
              <InfoRow label="BPJS KES No" value={employee.insurance?.bpjs_kes} visible={canReadCol("insurance","bpjs_kes")} />
              <InfoRow label="Status BPJS KES" value={employee.insurance?.status_bpjs_kes} visible={canReadCol("insurance","status_bpjs_kes")} />
              <InfoRow label="Social Insurance No (Alt)" value={employee.insurance?.social_insurance_no_alt} visible={canReadCol("insurance","social_insurance_no_alt")} />
              <InfoRow label="BPJS KES No (Alt)" value={employee.insurance?.bpjs_kes_no_alt} visible={canReadCol("insurance","bpjs_kes_no_alt")} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="travel">
          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Travel Documents" icon={Plane}>
              <InfoRow label="Passport No" value={employee.travel?.passport_no} visible={canReadCol("travel","passport_no")} />
              <InfoRow label="Name as Passport" value={employee.travel?.name_as_passport} visible={canReadCol("travel","name_as_passport")} />
              <InfoRow label="Passport Expiry" value={employee.travel?.passport_expiry} visible={canReadCol("travel","passport_expiry")} />
              <InfoRow label="KITAS No" value={employee.travel?.kitas_no} visible={canReadCol("travel","kitas_no")} />
              <InfoRow label="KITAS Expiry" value={employee.travel?.kitas_expiry} visible={canReadCol("travel","kitas_expiry")} />
              <InfoRow label="KITAS Address" value={employee.travel?.kitas_address} visible={canReadCol("travel","kitas_address")} />
            </SectionCard>
            <SectionCard title="Work Permits" icon={Plane}>
              <InfoRow label="IMTA" value={employee.travel?.imta} visible={canReadCol("travel","imta")} />
              <InfoRow label="RPTKA No" value={employee.travel?.rptka_no} visible={canReadCol("travel","rptka_no")} />
              <InfoRow label="RPTKA Position" value={employee.travel?.rptka_position} visible={canReadCol("travel","rptka_position")} />
              <InfoRow label="Job Title (KITAS)" value={employee.travel?.job_title_kitas} visible={canReadCol("travel","job_title_kitas")} />
              <InfoRow label="Travel In" value={employee.travel?.travel_in} visible={canReadCol("travel","travel_in")} />
              <InfoRow label="Travel Out" value={employee.travel?.travel_out} visible={canReadCol("travel","travel_out")} />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="checklist">
          <SectionCard title="Document Checklist" icon={CheckSquare}>
            <InfoRow label="Passport" value={employee.checklist?.passport_checklist} visible={canReadCol("checklist","passport_checklist")} />
            <InfoRow label="KITAS" value={employee.checklist?.kitas_checklist} visible={canReadCol("checklist","kitas_checklist")} />
            <InfoRow label="IMTA" value={employee.checklist?.imta_checklist} visible={canReadCol("checklist","imta_checklist")} />
            <InfoRow label="RPTKA" value={employee.checklist?.rptka_checklist} visible={canReadCol("checklist","rptka_checklist")} />
            <InfoRow label="NPWP" value={employee.checklist?.npwp_checklist} visible={canReadCol("checklist","npwp_checklist")} />
            <InfoRow label="BPJS KES" value={employee.checklist?.bpjs_kes_checklist} visible={canReadCol("checklist","bpjs_kes_checklist")} />
            <InfoRow label="BPJS TK" value={employee.checklist?.bpjs_tk_checklist} visible={canReadCol("checklist","bpjs_tk_checklist")} />
            <InfoRow label="Bank" value={employee.checklist?.bank_checklist} visible={canReadCol("checklist","bank_checklist")} />
          </SectionCard>
        </TabsContent>

        <TabsContent value="notes">
          <SectionCard title="Notes & Batch" icon={StickyNote}>
            <InfoRow label="Batch" value={employee.notes?.batch} visible={canReadCol("notes","batch")} />
            <InfoRow label="Notes" value={employee.notes?.note} visible={canReadCol("notes","note")} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default EmployeeDetail;
