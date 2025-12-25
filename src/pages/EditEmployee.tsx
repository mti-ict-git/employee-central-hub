import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import type { Employee, EmployeeChecklist, EmployeeType, EmployeeStatus } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistEditor } from "@/components/employees/edit/ChecklistEditor";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Save, 
  User, 
  Briefcase, 
  CreditCard, 
  Shield, 
  Plane,
  Phone,
  CheckSquare,
  StickyNote,
  Loader2
} from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { apiFetch } from "@/lib/api";

const FormField = ({ 
  label, 
  value, 
  onChange, 
  type = "text",
  placeholder,
  disabled = false,
  visible = true,
}: { 
  label: string; 
  value?: string | null; 
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  visible?: boolean;
}) => (
  !visible ? null : (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <Input 
      type={type}
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="bg-background"
    />
  </div>
  )
);

const SelectField = ({ 
  label, 
  value, 
  onChange, 
  options,
  placeholder = "Select...",
  disabled = false,
  visible = true,
}: { 
  label: string; 
  value?: string | null; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  visible?: boolean;
}) => (
  !visible ? null : (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="bg-background" disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  )
);

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { caps, typeAccess } = useRBAC();

  const employeeType = (() => {
    const t = String(employee?.type || "").trim().toLowerCase();
    const nat = String(employee?.core?.nationality || "").trim().toLowerCase();
    return t.startsWith("expat") ? "expat" : (nat === "indonesia" || nat.startsWith("indo") ? "indonesia" : "expat");
  })();

  const canWrite = (section: string, column?: string) => {
    if (!caps) return false;
    if (column) {
      if (column === "employee_id") return false;
      const key = String(section || "").toLowerCase();
      const applicable = typeAccess?.[employeeType]?.[key]?.[column];
      if (applicable === false) return false;
      return caps.canColumn(section, column, "write");
    }
    return caps.writeSections.has(section);
  };
  const canReadSection = (section: string) => caps ? caps.readSections.has(section) : true;

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/employees/${encodeURIComponent(id)}`, { 
          signal: ctrl.signal, 
          credentials: "include" 
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = data?.error || `HTTP_${res.status}`;
          throw new Error(msg);
        }
        const toRecord = (v: unknown): Record<string, unknown> => (
          typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
        );
        const root = toRecord(data);
        const coreRaw = toRecord(root.core);
        const nationality = String(coreRaw.nationality ?? "").trim().toLowerCase();
        const typeRaw = String(root.type ?? "").trim().toLowerCase();
        const type: EmployeeType = typeRaw.startsWith("expat") ? "expat" : (nationality === "indonesia" || nationality.startsWith("indo") ? "indonesia" : "expat");
        const nameRaw = coreRaw.name;
        const name = typeof nameRaw === "string" ? nameRaw : String(nameRaw ?? "");
        const genderRaw = String(coreRaw.gender ?? "");
        const gender: Employee["core"]["gender"] = genderRaw === "Female" ? "Female" : "Male";

        setEmployee({
          core: { ...coreRaw, employee_id: id, name, gender } as Employee["core"],
          contact: { ...toRecord(root.contact), employee_id: id } as Employee["contact"],
          employment: { ...toRecord(root.employment), employee_id: id } as Employee["employment"],
          onboard: { ...toRecord(root.onboard), employee_id: id } as Employee["onboard"],
          bank: { ...toRecord(root.bank), employee_id: id } as Employee["bank"],
          insurance: { ...toRecord(root.insurance), employee_id: id } as Employee["insurance"],
          travel: { ...toRecord(root.travel), employee_id: id } as Employee["travel"],
          checklist: { ...toRecord(root.checklist), employee_id: id } as Employee["checklist"],
          notes: { ...toRecord(root.notes), employee_id: id } as Employee["notes"],
          type,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "FAILED_TO_FETCH_EMPLOYEE");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [id]);

  const handleSave = async () => {
    if (!employee || !id) return;
    
    try {
      setSaving(true);
      const res = await apiFetch(`/employees/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(employee),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.details ? ` (${JSON.stringify(data.details)})` : "";
        const msg = (data?.error || `HTTP_${res.status}`) + detail;
        throw new Error(msg);
      }
      
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
      navigate(`/employees/${id}`);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save employee",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isGender = (v: string): v is Employee['core']['gender'] => v === 'Male' || v === 'Female';
  const isMaritalStatus = (v: string): v is Employee['core']['marital_status'] => (
    v === 'Single' || v === 'Married' || v === 'Divorced' || v === 'Widowed'
  );
  const isEmploymentStatus = (v: string): v is Employee['employment']['employment_status'] => (
    v === 'suspended' ||
    v === 'retired' ||
    v === 'terminated' ||
    v === 'non_active' ||
    v === 'intern' ||
    v === 'contract' ||
    v === 'probation' ||
    v === 'active'
  );
  const isEmploymentActiveStatus = (v: string): v is Employee['employment']['status'] => (
    v === 'Active' || v === 'Inactive' || v === 'Resign' || v === 'Terminated'
  );
  const isLocalityStatus = (v: string): v is Employee['employment']['locality_status'] => (
    v === 'Local' || v === 'Non Local' || v === 'Overseas'
  );
  const isPositionGrade = (v: string): v is Employee['employment']['position_grade'] => (
    v === 'Staff' || v === 'NonStaff' || v === 'Supervisor' || v === 'Manager'
  );
  const isBpjsKesStatus = (v: string): v is Employee['insurance']['status_bpjs_kes'] => (
    v === 'Active' || v === 'Non Active' || v === 'PBI' || v === 'Not Registered'
  );

  const updateCore = <K extends keyof Employee['core']>(key: K, value: Employee['core'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, core: { ...employee.core, [key]: value } });
  };

  const updateContact = <K extends keyof Employee['contact']>(key: K, value: Employee['contact'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, contact: { ...employee.contact, [key]: value } });
  };

  const updateEmployment = <K extends keyof Employee['employment']>(key: K, value: Employee['employment'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, employment: { ...employee.employment, [key]: value } });
  };

  const updateBank = <K extends keyof Employee['bank']>(key: K, value: Employee['bank'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, bank: { ...employee.bank, [key]: value } });
  };

  const updateInsurance = <K extends keyof Employee['insurance']>(key: K, value: Employee['insurance'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, insurance: { ...employee.insurance, [key]: value } });
  };

  const updateTravel = <K extends keyof Employee['travel']>(key: K, value: Employee['travel'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, travel: { ...employee.travel, [key]: value } });
  };

  const updateOnboard = <K extends keyof Employee['onboard']>(key: K, value: Employee['onboard'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, onboard: { ...employee.onboard, [key]: value } });
  };

  const updateChecklist = (key: keyof EmployeeChecklist, value: boolean) => {
    if (!employee) return;
    setEmployee({ ...employee, checklist: { ...employee.checklist, [key]: value } });
  };

  const updateNotes = <K extends keyof Employee['notes']>(key: K, value: Employee['notes'][K]) => {
    if (!employee) return;
    setEmployee({ ...employee, notes: { ...employee.notes, [key]: value } });
  };

  if (loading) {
    return (
      <MainLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

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

  const employeeStatus: EmployeeStatus = employee.employment?.status === 'Active' ? 'active' : 'inactive';
  const hasPersonalWrites = [
    "imip_id",
    "name",
    "gender",
    "place_of_birth",
    "date_of_birth",
    "marital_status",
    "religion",
    "nationality",
    "blood_type",
    "ktp_no",
    "kartu_keluarga_no",
    "npwp",
    "tax_status",
    "education",
    "office_email",
    "id_card_mti",
    "field",
    "branch_id",
    "branch",
  ].some((c) => canWrite("core", c));
  const hasContactWrites = [
    "phone_number",
    "email",
    "address",
    "city",
    "spouse_name",
    "child_name_1",
    "child_name_2",
    "child_name_3",
    "emergency_contact_name",
    "emergency_contact_phone",
  ].some((c) => canWrite("contact", c));
  const hasEmploymentWrites = [
    "employment_status",
    "status",
    "division",
    "department",
    "section",
    "job_title",
    "grade",
    "position_grade",
    "group_job_title",
    "direct_report",
    "company_office",
    "work_location",
    "locality_status",
    "blacklist_mti",
    "blacklist_imip",
  ].some((c) => canWrite("employment", c));
  const hasOnboardWrites = [
    "point_of_hire",
    "point_of_origin",
    "schedule_type",
    "first_join_date_merdeka",
    "transfer_merdeka",
    "first_join_date",
    "join_date",
    "end_contract",
  ].some((c) => canWrite("onboard", c));
  const hasBankWrites = [
    "bank_name",
    "account_name",
    "account_no",
    "bank_code",
    "icbc_bank_account_no",
    "icbc_username",
  ].some((c) => canWrite("bank", c));
  const hasInsuranceWrites = [
    "bpjs_tk",
    "bpjs_kes",
    "status_bpjs_kes",
    "insurance_endorsement",
    "insurance_owlexa",
    "insurance_fpg",
    "fpg_no",
    "owlexa_no",
    "social_insurance_no_alt",
    "bpjs_kes_no_alt",
  ].some((c) => canWrite("insurance", c));
  const hasTravelWrites = [
    "passport_no",
    "name_as_passport",
    "passport_expiry",
    "kitas_no",
    "kitas_expiry",
    "kitas_address",
    "imta",
    "rptka_no",
    "rptka_position",
    "job_title_kitas",
    "travel_in",
    "travel_out",
  ].some((c) => canWrite("travel", c));
  const hasChecklistWrites = [
    "passport_checklist",
    "kitas_checklist",
    "imta_checklist",
    "rptka_checklist",
    "npwp_checklist",
    "bpjs_kes_checklist",
    "bpjs_tk_checklist",
    "bank_checklist",
  ].some((c) => canWrite("checklist", c)) ||
    ["insurance_endorsement", "insurance_owlexa", "insurance_fpg"].some((c) => canWrite("insurance", c)) ||
    ["blacklist_mti", "blacklist_imip"].some((c) => canWrite("employment", c)) ||
    canWrite("core", "id_card_mti");
  const hasNotesWrites = ["batch", "note"].some((c) => canWrite("notes", c));
  const hasAnyWritable = hasPersonalWrites || hasContactWrites || hasEmploymentWrites || hasOnboardWrites || hasBankWrites || hasInsuranceWrites || hasTravelWrites || hasChecklistWrites || hasNotesWrites;
  const defaultTab = hasPersonalWrites
    ? "personal"
    : hasContactWrites
      ? "contact"
      : hasEmploymentWrites
        ? "employment"
        : hasBankWrites
          ? "bank"
          : hasInsuranceWrites
            ? "insurance"
            : hasTravelWrites
              ? "travel"
              : hasChecklistWrites
                ? "checklist"
                : hasNotesWrites
                  ? "notes"
                  : "personal";

  return (
    <MainLayout title="Edit Employee" subtitle={employee.core.name}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" asChild>
          <Link to={`/employees/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Details
          </Link>
        </Button>
        <Button onClick={handleSave} disabled={saving || !hasAnyWritable}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="animate-fade-in">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          {canReadSection("core") && hasPersonalWrites && (
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            Personal
          </TabsTrigger>
          )}
          {canReadSection("contact") && hasContactWrites && (
          <TabsTrigger value="contact" className="gap-2">
            <Phone className="h-4 w-4" />
            Contact
          </TabsTrigger>
          )}
          {canReadSection("employment") && (hasEmploymentWrites || hasOnboardWrites) && (
          <TabsTrigger value="employment" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Employment
          </TabsTrigger>
          )}
          {canReadSection("bank") && hasBankWrites && (
          <TabsTrigger value="bank" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Bank
          </TabsTrigger>
          )}
          {canReadSection("insurance") && hasInsuranceWrites && (
          <TabsTrigger value="insurance" className="gap-2">
            <Shield className="h-4 w-4" />
            Insurance
          </TabsTrigger>
          )}
          {canReadSection("travel") && hasTravelWrites && (
          <TabsTrigger value="travel" className="gap-2">
            <Plane className="h-4 w-4" />
            Travel
          </TabsTrigger>
          )}
          {canReadSection("checklist") && hasChecklistWrites && (
          <TabsTrigger value="checklist" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            Checklist
          </TabsTrigger>
          )}
          {canReadSection("notes") && hasNotesWrites && (
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4" />
            Notes
          </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="personal">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Personal details and identification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Employee ID" value={employee.core.employee_id} onChange={(v) => updateCore('employee_id', v)} disabled />
                <FormField label="IMIP ID" value={employee.core.imip_id} onChange={(v) => updateCore('imip_id', v)} visible={canWrite('core','imip_id')} />
                <FormField label="Name" value={employee.core.name} onChange={(v) => updateCore('name', v)} visible={canWrite('core','name')} />
                <SelectField 
                  label="Gender" 
                  value={employee.core.gender} 
                  onChange={(v) => updateCore('gender', isGender(v) ? v : employee.core.gender)}
                  disabled={!canWrite('core','gender')}
                  visible={canWrite('core','gender')}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                  ]}
                />
                <FormField label="Place of Birth" value={employee.core.place_of_birth} onChange={(v) => updateCore('place_of_birth', v)} visible={canWrite('core','place_of_birth')} />
                <FormField label="Date of Birth" value={employee.core.date_of_birth} onChange={(v) => updateCore('date_of_birth', v)} type="date" visible={canWrite('core','date_of_birth')} />
                <SelectField 
                  label="Marital Status" 
                  value={employee.core.marital_status} 
                  onChange={(v) => updateCore('marital_status', isMaritalStatus(v) ? v : employee.core.marital_status)}
                  disabled={!canWrite('core','marital_status')}
                  visible={canWrite('core','marital_status')}
                  options={[
                    { value: 'Single', label: 'Single' },
                    { value: 'Married', label: 'Married' },
                    { value: 'Divorced', label: 'Divorced' },
                    { value: 'Widowed', label: 'Widowed' },
                  ]}
                />
                <FormField label="Religion" value={employee.core.religion} onChange={(v) => updateCore('religion', v)} visible={canWrite('core','religion')} />
                <FormField label="Nationality" value={employee.core.nationality} onChange={(v) => updateCore('nationality', v)} visible={canWrite('core','nationality')} />
                <FormField label="Blood Type" value={employee.core.blood_type} onChange={(v) => updateCore('blood_type', v)} visible={canWrite('core','blood_type')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
                <CardDescription>ID numbers and documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="KTP No" value={employee.core.ktp_no} onChange={(v) => updateCore('ktp_no', v)} visible={canWrite('core','ktp_no')} />
                <FormField label="Kartu Keluarga No" value={employee.core.kartu_keluarga_no} onChange={(v) => updateCore('kartu_keluarga_no', v)} visible={canWrite('core','kartu_keluarga_no')} />
                <FormField label="NPWP" value={employee.core.npwp} onChange={(v) => updateCore('npwp', v)} visible={canWrite('core','npwp')} />
                <FormField label="Tax Status" value={employee.core.tax_status} onChange={(v) => updateCore('tax_status', v)} visible={canWrite('core','tax_status')} />
                <FormField label="Education" value={employee.core.education} onChange={(v) => updateCore('education', v)} visible={canWrite('core','education')} />
                <FormField label="Office Email" value={employee.core.office_email} onChange={(v) => updateCore('office_email', v)} type="email" visible={canWrite('core','office_email')} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contact">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Phone Number" value={employee.contact.phone_number} onChange={(v) => updateContact('phone_number', v)} visible={canWrite('contact','phone_number')} />
                <FormField label="Email" value={employee.contact.email} onChange={(v) => updateContact('email', v)} type="email" visible={canWrite('contact','email')} />
                <FormField label="Address" value={employee.contact.address} onChange={(v) => updateContact('address', v)} visible={canWrite('contact','address')} />
                <FormField label="City" value={employee.contact.city} onChange={(v) => updateContact('city', v)} visible={canWrite('contact','city')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Family & Emergency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Spouse Name" value={employee.contact.spouse_name} onChange={(v) => updateContact('spouse_name', v)} visible={canWrite('contact','spouse_name')} />
                <FormField label="Child Name 1" value={employee.contact.child_name_1} onChange={(v) => updateContact('child_name_1', v)} visible={canWrite('contact','child_name_1')} />
                <FormField label="Child Name 2" value={employee.contact.child_name_2} onChange={(v) => updateContact('child_name_2', v)} visible={canWrite('contact','child_name_2')} />
                <FormField label="Child Name 3" value={employee.contact.child_name_3} onChange={(v) => updateContact('child_name_3', v)} visible={canWrite('contact','child_name_3')} />
                <FormField label="Emergency Contact Name" value={employee.contact.emergency_contact_name} onChange={(v) => updateContact('emergency_contact_name', v)} visible={canWrite('contact','emergency_contact_name')} />
                <FormField label="Emergency Contact Phone" value={employee.contact.emergency_contact_phone} onChange={(v) => updateContact('emergency_contact_phone', v)} visible={canWrite('contact','emergency_contact_phone')} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Position Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SelectField 
                  label="Employment Status" 
                  value={employee.employment.employment_status} 
                  onChange={(v) => updateEmployment('employment_status', isEmploymentStatus(v) ? v : employee.employment.employment_status)}
                  disabled={!canWrite('employment','employment_status')}
                  visible={canWrite('employment','employment_status')}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'contract', label: 'Contract' },
                    { value: 'probation', label: 'Probation' },
                    { value: 'intern', label: 'Intern' },
                    { value: 'non_active', label: 'Non Active' },
                    { value: 'suspended', label: 'Suspended' },
                    { value: 'retired', label: 'Retired' },
                    { value: 'terminated', label: 'Terminated' },
                  ]}
                />
                <SelectField 
                  label="Status" 
                  value={employee.employment.status} 
                  onChange={(v) => updateEmployment('status', isEmploymentActiveStatus(v) ? v : employee.employment.status)}
                  disabled={!canWrite('employment','status')}
                  visible={canWrite('employment','status')}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                    { value: 'Resign', label: 'Resign' },
                    { value: 'Terminated', label: 'Terminated' },
                  ]}
                />
                <FormField label="Division" value={employee.employment.division} onChange={(v) => updateEmployment('division', v)} visible={canWrite('employment','division')} />
                <FormField label="Department" value={employee.employment.department} onChange={(v) => updateEmployment('department', v)} visible={canWrite('employment','department')} />
                <FormField label="Section" value={employee.employment.section} onChange={(v) => updateEmployment('section', v)} visible={canWrite('employment','section')} />
                <FormField label="Job Title" value={employee.employment.job_title} onChange={(v) => updateEmployment('job_title', v)} visible={canWrite('employment','job_title')} />
                <FormField label="Grade" value={employee.employment.grade} onChange={(v) => updateEmployment('grade', v)} visible={canWrite('employment','grade')} />
                <SelectField 
                  label="Position Grade" 
                  value={employee.employment.position_grade} 
                  onChange={(v) => updateEmployment('position_grade', isPositionGrade(v) ? v : employee.employment.position_grade)}
                  disabled={!canWrite('employment','position_grade')}
                  visible={canWrite('employment','position_grade')}
                  options={[
                    { value: 'Staff', label: 'Staff' },
                    { value: 'NonStaff', label: 'Non-Staff' },
                    { value: 'Supervisor', label: 'Supervisor' },
                    { value: 'Manager', label: 'Manager' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Work Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Company Office" value={employee.employment.company_office} onChange={(v) => updateEmployment('company_office', v)} visible={canWrite('employment','company_office')} />
                <FormField label="Work Location" value={employee.employment.work_location} onChange={(v) => updateEmployment('work_location', v)} visible={canWrite('employment','work_location')} />
                <SelectField 
                  label="Locality Status" 
                  value={employee.employment.locality_status} 
                  onChange={(v) => updateEmployment('locality_status', isLocalityStatus(v) ? v : employee.employment.locality_status)}
                  disabled={!canWrite('employment','locality_status')}
                  visible={canWrite('employment','locality_status')}
                  options={[
                    { value: 'Local', label: 'Local' },
                    { value: 'Non Local', label: 'Non Local' },
                    { value: 'Overseas', label: 'Overseas' },
                  ]}
                />
                <FormField label="Direct Report" value={employee.employment.direct_report} onChange={(v) => updateEmployment('direct_report', v)} visible={canWrite('employment','direct_report')} />
                <FormField label="Group Job Title" value={employee.employment.group_job_title} onChange={(v) => updateEmployment('group_job_title', v)} visible={canWrite('employment','group_job_title')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Onboarding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Point of Hire" value={employee.onboard.point_of_hire} onChange={(v) => updateOnboard('point_of_hire', v)} visible={canWrite('onboard','point_of_hire')} />
                <FormField label="Point of Origin" value={employee.onboard.point_of_origin} onChange={(v) => updateOnboard('point_of_origin', v)} visible={canWrite('onboard','point_of_origin')} />
                <FormField label="Schedule Type" value={employee.onboard.schedule_type} onChange={(v) => updateOnboard('schedule_type', v)} visible={canWrite('onboard','schedule_type')} />
                <FormField label="First Join Date" value={employee.onboard.first_join_date} onChange={(v) => updateOnboard('first_join_date', v)} type="date" visible={canWrite('onboard','first_join_date')} />
                <FormField label="Join Date" value={employee.onboard.join_date} onChange={(v) => updateOnboard('join_date', v)} type="date" visible={canWrite('onboard','join_date')} />
                <FormField label="End Contract" value={employee.onboard.end_contract} onChange={(v) => updateOnboard('end_contract', v)} type="date" visible={canWrite('onboard','end_contract')} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bank">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Bank Account</CardTitle>
              <CardDescription>Bank account details for payroll</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Bank Name" value={employee.bank.bank_name} onChange={(v) => updateBank('bank_name', v)} visible={canWrite('bank','bank_name')} />
              <FormField label="Account Name" value={employee.bank.account_name} onChange={(v) => updateBank('account_name', v)} visible={canWrite('bank','account_name')} />
              <FormField label="Account No" value={employee.bank.account_no} onChange={(v) => updateBank('account_no', v)} visible={canWrite('bank','account_no')} />
              <FormField label="Bank Code" value={employee.bank.bank_code} onChange={(v) => updateBank('bank_code', v)} visible={canWrite('bank','bank_code')} />
              <FormField label="ICBC Account No" value={employee.bank.icbc_bank_account_no} onChange={(v) => updateBank('icbc_bank_account_no', v)} visible={canWrite('bank','icbc_bank_account_no')} />
              <FormField label="ICBC Username" value={employee.bank.icbc_username} onChange={(v) => updateBank('icbc_username', v)} visible={canWrite('bank','icbc_username')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Insurance Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="BPJS TK No" value={employee.insurance.bpjs_tk} onChange={(v) => updateInsurance('bpjs_tk', v)} visible={canWrite('insurance','bpjs_tk')} />
                <FormField label="BPJS KES No" value={employee.insurance.bpjs_kes} onChange={(v) => updateInsurance('bpjs_kes', v)} visible={canWrite('insurance','bpjs_kes')} />
                <SelectField 
                  label="Status BPJS KES" 
                  value={employee.insurance.status_bpjs_kes} 
                  onChange={(v) => updateInsurance('status_bpjs_kes', isBpjsKesStatus(v) ? v : employee.insurance.status_bpjs_kes)}
                  disabled={!canWrite('insurance','status_bpjs_kes')}
                  visible={canWrite('insurance','status_bpjs_kes')}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Non Active', label: 'Non Active' },
                    { value: 'PBI', label: 'PBI' },
                    { value: 'Not Registered', label: 'Not Registered' },
                  ]}
                />
                <FormField label="FPG No" value={employee.insurance.fpg_no} onChange={(v) => updateInsurance('fpg_no', v)} visible={canWrite('insurance','fpg_no')} />
                <FormField label="Owlexa No" value={employee.insurance.owlexa_no} onChange={(v) => updateInsurance('owlexa_no', v)} visible={canWrite('insurance','owlexa_no')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alternative Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Social Insurance No (Alt)" value={employee.insurance.social_insurance_no_alt} onChange={(v) => updateInsurance('social_insurance_no_alt', v)} visible={canWrite('insurance','social_insurance_no_alt')} />
                <FormField label="BPJS KES No (Alt)" value={employee.insurance.bpjs_kes_no_alt} onChange={(v) => updateInsurance('bpjs_kes_no_alt', v)} visible={canWrite('insurance','bpjs_kes_no_alt')} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="travel">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Travel Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Passport No" value={employee.travel.passport_no} onChange={(v) => updateTravel('passport_no', v)} visible={canWrite('travel','passport_no')} />
                <FormField label="Name as Passport" value={employee.travel.name_as_passport} onChange={(v) => updateTravel('name_as_passport', v)} visible={canWrite('travel','name_as_passport')} />
                <FormField label="Passport Expiry" value={employee.travel.passport_expiry} onChange={(v) => updateTravel('passport_expiry', v)} type="date" visible={canWrite('travel','passport_expiry')} />
                <FormField label="KITAS No" value={employee.travel.kitas_no} onChange={(v) => updateTravel('kitas_no', v)} visible={canWrite('travel','kitas_no')} />
                <FormField label="KITAS Expiry" value={employee.travel.kitas_expiry} onChange={(v) => updateTravel('kitas_expiry', v)} type="date" visible={canWrite('travel','kitas_expiry')} />
                <FormField label="KITAS Address" value={employee.travel.kitas_address} onChange={(v) => updateTravel('kitas_address', v)} visible={canWrite('travel','kitas_address')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Work Permits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="IMTA" value={employee.travel.imta} onChange={(v) => updateTravel('imta', v)} visible={canWrite('travel','imta')} />
                <FormField label="RPTKA No" value={employee.travel.rptka_no} onChange={(v) => updateTravel('rptka_no', v)} visible={canWrite('travel','rptka_no')} />
                <FormField label="RPTKA Position" value={employee.travel.rptka_position} onChange={(v) => updateTravel('rptka_position', v)} visible={canWrite('travel','rptka_position')} />
                <FormField label="Job Title (KITAS)" value={employee.travel.job_title_kitas} onChange={(v) => updateTravel('job_title_kitas', v)} visible={canWrite('travel','job_title_kitas')} />
                <FormField label="Travel In" value={employee.travel.travel_in} onChange={(v) => updateTravel('travel_in', v)} type="date" visible={canWrite('travel','travel_in')} />
                <FormField label="Travel Out" value={employee.travel.travel_out} onChange={(v) => updateTravel('travel_out', v)} type="date" visible={canWrite('travel','travel_out')} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistEditor
            checklist={employee.checklist}
            insurance={{
              insurance_endorsement: employee.insurance.insurance_endorsement,
              insurance_owlexa: employee.insurance.insurance_owlexa,
              insurance_fpg: employee.insurance.insurance_fpg,
            }}
            employment={{
              blacklist_mti: employee.employment.blacklist_mti,
              blacklist_imip: employee.employment.blacklist_imip,
            }}
            core={{
              id_card_mti: employee.core.id_card_mti,
            }}
            employeeType={employee.type}
            employeeStatus={employeeStatus}
            canWrite={canWrite}
            onChecklistChange={updateChecklist}
            onInsuranceChange={(key, value) => updateInsurance(key, value)}
            onEmploymentChange={(key, value) => updateEmployment(key, value)}
            onCoreChange={(key, value) => updateCore(key, value)}
          />
        </TabsContent>

        <TabsContent value="notes">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Notes & Batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Batch" value={employee.notes.batch} onChange={(v) => updateNotes('batch', v)} visible={canWrite('notes','batch')} />
              {canWrite('notes','note') && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Notes</Label>
                  <Textarea 
                    value={employee.notes.note || ''} 
                    onChange={(e) => updateNotes('note', e.target.value)}
                    rows={6}
                    placeholder="Add notes about this employee..."
                    className="bg-background"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default EditEmployee;
