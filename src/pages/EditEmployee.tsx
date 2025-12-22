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
  disabled = false 
}: { 
  label: string; 
  value?: string | null; 
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) => (
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
);

const SelectField = ({ 
  label, 
  value, 
  onChange, 
  options,
  placeholder = "Select..." 
}: { 
  label: string; 
  value?: string | null; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="bg-background">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const EditEmployee = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { caps } = useRBAC();
  const canWrite = (section: string, column?: string) => {
    if (!caps) return false;
    if (column) return caps.canColumn(section, column, "write");
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
        setEmployee({
          core: data.core,
          contact: data.contact,
          employment: data.employment,
          onboard: data.onboard,
          bank: data.bank,
          insurance: data.insurance,
          travel: data.travel,
          checklist: data.checklist,
          notes: data.notes,
          type: data.type,
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
      const res = await fetch(`http://localhost:${8083}/api/employees/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    v === 'Permanent' || v === 'Contract' || v === 'Probation' || v === 'Internship'
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

  const employeeStatus: EmployeeStatus = employee.employment.status === 'Active' ? 'active' : 'inactive';

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
        <Button onClick={handleSave} disabled={saving || !(caps?.canUpdateEmployees)}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="animate-fade-in">
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
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Personal details and identification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Employee ID" value={employee.core.employee_id} onChange={(v) => updateCore('employee_id', v)} disabled />
                <FormField label="IMIP ID" value={employee.core.imip_id} onChange={(v) => updateCore('imip_id', v)} disabled={!canWrite('core','imip_id')} />
                <FormField label="Name" value={employee.core.name} onChange={(v) => updateCore('name', v)} disabled={!canWrite('core','name')} />
                <SelectField 
                  label="Gender" 
                  value={employee.core.gender} 
                  onChange={(v) => updateCore('gender', isGender(v) ? v : employee.core.gender)}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                  ]}
                />
                <FormField label="Place of Birth" value={employee.core.place_of_birth} onChange={(v) => updateCore('place_of_birth', v)} disabled={!canWrite('core','place_of_birth')} />
                <FormField label="Date of Birth" value={employee.core.date_of_birth} onChange={(v) => updateCore('date_of_birth', v)} type="date" disabled={!canWrite('core','date_of_birth')} />
                <SelectField 
                  label="Marital Status" 
                  value={employee.core.marital_status} 
                  onChange={(v) => updateCore('marital_status', isMaritalStatus(v) ? v : employee.core.marital_status)}
                  options={[
                    { value: 'Single', label: 'Single' },
                    { value: 'Married', label: 'Married' },
                    { value: 'Divorced', label: 'Divorced' },
                    { value: 'Widowed', label: 'Widowed' },
                  ]}
                />
                <FormField label="Religion" value={employee.core.religion} onChange={(v) => updateCore('religion', v)} disabled={!canWrite('core','religion')} />
                <FormField label="Nationality" value={employee.core.nationality} onChange={(v) => updateCore('nationality', v)} disabled={!canWrite('core','nationality')} />
                <FormField label="Blood Type" value={employee.core.blood_type} onChange={(v) => updateCore('blood_type', v)} disabled={!canWrite('core','blood_type')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
                <CardDescription>ID numbers and documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="KTP No" value={employee.core.ktp_no} onChange={(v) => updateCore('ktp_no', v)} disabled={!canWrite('core','ktp_no')} />
                <FormField label="Kartu Keluarga No" value={employee.core.kartu_keluarga_no} onChange={(v) => updateCore('kartu_keluarga_no', v)} disabled={!canWrite('core','kartu_keluarga_no')} />
                <FormField label="NPWP" value={employee.core.npwp} onChange={(v) => updateCore('npwp', v)} disabled={!canWrite('core','npwp')} />
                <FormField label="Tax Status" value={employee.core.tax_status} onChange={(v) => updateCore('tax_status', v)} disabled={!canWrite('core','tax_status')} />
                <FormField label="Education" value={employee.core.education} onChange={(v) => updateCore('education', v)} disabled={!canWrite('core','education')} />
                <FormField label="Office Email" value={employee.core.office_email} onChange={(v) => updateCore('office_email', v)} type="email" disabled={!canWrite('core','office_email')} />
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
                <FormField label="Phone Number" value={employee.contact.phone_number} onChange={(v) => updateContact('phone_number', v)} disabled={!canWrite('contact','phone_number')} />
                <FormField label="Email" value={employee.contact.email} onChange={(v) => updateContact('email', v)} type="email" disabled={!canWrite('contact','email')} />
                <FormField label="Address" value={employee.contact.address} onChange={(v) => updateContact('address', v)} disabled={!canWrite('contact','address')} />
                <FormField label="City" value={employee.contact.city} onChange={(v) => updateContact('city', v)} disabled={!canWrite('contact','city')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Family & Emergency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Spouse Name" value={employee.contact.spouse_name} onChange={(v) => updateContact('spouse_name', v)} disabled={!canWrite('contact','spouse_name')} />
                <FormField label="Child Name 1" value={employee.contact.child_name_1} onChange={(v) => updateContact('child_name_1', v)} disabled={!canWrite('contact','child_name_1')} />
                <FormField label="Child Name 2" value={employee.contact.child_name_2} onChange={(v) => updateContact('child_name_2', v)} disabled={!canWrite('contact','child_name_2')} />
                <FormField label="Child Name 3" value={employee.contact.child_name_3} onChange={(v) => updateContact('child_name_3', v)} disabled={!canWrite('contact','child_name_3')} />
                <FormField label="Emergency Contact Name" value={employee.contact.emergency_contact_name} onChange={(v) => updateContact('emergency_contact_name', v)} disabled={!canWrite('contact','emergency_contact_name')} />
                <FormField label="Emergency Contact Phone" value={employee.contact.emergency_contact_phone} onChange={(v) => updateContact('emergency_contact_phone', v)} disabled={!canWrite('contact','emergency_contact_phone')} />
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
                  options={[
                    { value: 'Permanent', label: 'Permanent' },
                    { value: 'Contract', label: 'Contract' },
                    { value: 'Probation', label: 'Probation' },
                    { value: 'Internship', label: 'Internship' },
                  ]}
                />
                <SelectField 
                  label="Status" 
                  value={employee.employment.status} 
                  onChange={(v) => updateEmployment('status', isEmploymentActiveStatus(v) ? v : employee.employment.status)}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                    { value: 'Resign', label: 'Resign' },
                    { value: 'Terminated', label: 'Terminated' },
                  ]}
                />
                <FormField label="Division" value={employee.employment.division} onChange={(v) => updateEmployment('division', v)} disabled={!canWrite('employment','division')} />
                <FormField label="Department" value={employee.employment.department} onChange={(v) => updateEmployment('department', v)} disabled={!canWrite('employment','department')} />
                <FormField label="Section" value={employee.employment.section} onChange={(v) => updateEmployment('section', v)} disabled={!canWrite('employment','section')} />
                <FormField label="Job Title" value={employee.employment.job_title} onChange={(v) => updateEmployment('job_title', v)} disabled={!canWrite('employment','job_title')} />
                <FormField label="Grade" value={employee.employment.grade} onChange={(v) => updateEmployment('grade', v)} disabled={!canWrite('employment','grade')} />
                <SelectField 
                  label="Position Grade" 
                  value={employee.employment.position_grade} 
                  onChange={(v) => updateEmployment('position_grade', isPositionGrade(v) ? v : employee.employment.position_grade)}
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
                <FormField label="Company Office" value={employee.employment.company_office} onChange={(v) => updateEmployment('company_office', v)} disabled={!canWrite('employment','company_office')} />
                <FormField label="Work Location" value={employee.employment.work_location} onChange={(v) => updateEmployment('work_location', v)} disabled={!canWrite('employment','work_location')} />
                <SelectField 
                  label="Locality Status" 
                  value={employee.employment.locality_status} 
                  onChange={(v) => updateEmployment('locality_status', isLocalityStatus(v) ? v : employee.employment.locality_status)}
                  options={[
                    { value: 'Local', label: 'Local' },
                    { value: 'Non Local', label: 'Non Local' },
                    { value: 'Overseas', label: 'Overseas' },
                  ]}
                />
                <FormField label="Direct Report" value={employee.employment.direct_report} onChange={(v) => updateEmployment('direct_report', v)} disabled={!canWrite('employment','direct_report')} />
                <FormField label="Group Job Title" value={employee.employment.group_job_title} onChange={(v) => updateEmployment('group_job_title', v)} disabled={!canWrite('employment','group_job_title')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Onboarding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Point of Hire" value={employee.onboard.point_of_hire} onChange={(v) => updateOnboard('point_of_hire', v)} disabled={!canWrite('onboard','point_of_hire')} />
                <FormField label="Point of Origin" value={employee.onboard.point_of_origin} onChange={(v) => updateOnboard('point_of_origin', v)} disabled={!canWrite('onboard','point_of_origin')} />
                <FormField label="Schedule Type" value={employee.onboard.schedule_type} onChange={(v) => updateOnboard('schedule_type', v)} disabled={!canWrite('onboard','schedule_type')} />
                <FormField label="First Join Date" value={employee.onboard.first_join_date} onChange={(v) => updateOnboard('first_join_date', v)} type="date" disabled={!canWrite('onboard','first_join_date')} />
                <FormField label="Join Date" value={employee.onboard.join_date} onChange={(v) => updateOnboard('join_date', v)} type="date" disabled={!canWrite('onboard','join_date')} />
                <FormField label="End Contract" value={employee.onboard.end_contract} onChange={(v) => updateOnboard('end_contract', v)} type="date" disabled={!canWrite('onboard','end_contract')} />
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
              <FormField label="Bank Name" value={employee.bank.bank_name} onChange={(v) => updateBank('bank_name', v)} disabled={!canWrite('bank','bank_name')} />
              <FormField label="Account Name" value={employee.bank.account_name} onChange={(v) => updateBank('account_name', v)} disabled={!canWrite('bank','account_name')} />
              <FormField label="Account No" value={employee.bank.account_no} onChange={(v) => updateBank('account_no', v)} disabled={!canWrite('bank','account_no')} />
              <FormField label="Bank Code" value={employee.bank.bank_code} onChange={(v) => updateBank('bank_code', v)} disabled={!canWrite('bank','bank_code')} />
              <FormField label="ICBC Account No" value={employee.bank.icbc_bank_account_no} onChange={(v) => updateBank('icbc_bank_account_no', v)} disabled={!canWrite('bank','icbc_bank_account_no')} />
              <FormField label="ICBC Username" value={employee.bank.icbc_username} onChange={(v) => updateBank('icbc_username', v)} disabled={!canWrite('bank','icbc_username')} />
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
                <FormField label="BPJS TK No" value={employee.insurance.bpjs_tk} onChange={(v) => updateInsurance('bpjs_tk', v)} disabled={!canWrite('insurance','bpjs_tk')} />
                <FormField label="BPJS KES No" value={employee.insurance.bpjs_kes} onChange={(v) => updateInsurance('bpjs_kes', v)} disabled={!canWrite('insurance','bpjs_kes')} />
                <SelectField 
                  label="Status BPJS KES" 
                  value={employee.insurance.status_bpjs_kes} 
                  onChange={(v) => updateInsurance('status_bpjs_kes', isBpjsKesStatus(v) ? v : employee.insurance.status_bpjs_kes)}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Non Active', label: 'Non Active' },
                    { value: 'PBI', label: 'PBI' },
                    { value: 'Not Registered', label: 'Not Registered' },
                  ]}
                />
                <FormField label="FPG No" value={employee.insurance.fpg_no} onChange={(v) => updateInsurance('fpg_no', v)} disabled={!canWrite('insurance','fpg_no')} />
                <FormField label="Owlexa No" value={employee.insurance.owlexa_no} onChange={(v) => updateInsurance('owlexa_no', v)} disabled={!canWrite('insurance','owlexa_no')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alternative Numbers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="Social Insurance No (Alt)" value={employee.insurance.social_insurance_no_alt} onChange={(v) => updateInsurance('social_insurance_no_alt', v)} disabled={!canWrite('insurance','social_insurance_no_alt')} />
                <FormField label="BPJS KES No (Alt)" value={employee.insurance.bpjs_kes_no_alt} onChange={(v) => updateInsurance('bpjs_kes_no_alt', v)} disabled={!canWrite('insurance','bpjs_kes_no_alt')} />
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
                <FormField label="Passport No" value={employee.travel.passport_no} onChange={(v) => updateTravel('passport_no', v)} disabled={!canWrite('travel','passport_no')} />
                <FormField label="Name as Passport" value={employee.travel.name_as_passport} onChange={(v) => updateTravel('name_as_passport', v)} disabled={!canWrite('travel','name_as_passport')} />
                <FormField label="Passport Expiry" value={employee.travel.passport_expiry} onChange={(v) => updateTravel('passport_expiry', v)} type="date" disabled={!canWrite('travel','passport_expiry')} />
                <FormField label="KITAS No" value={employee.travel.kitas_no} onChange={(v) => updateTravel('kitas_no', v)} disabled={!canWrite('travel','kitas_no')} />
                <FormField label="KITAS Expiry" value={employee.travel.kitas_expiry} onChange={(v) => updateTravel('kitas_expiry', v)} type="date" disabled={!canWrite('travel','kitas_expiry')} />
                <FormField label="KITAS Address" value={employee.travel.kitas_address} onChange={(v) => updateTravel('kitas_address', v)} disabled={!canWrite('travel','kitas_address')} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Work Permits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label="IMTA" value={employee.travel.imta} onChange={(v) => updateTravel('imta', v)} disabled={!canWrite('travel','imta')} />
                <FormField label="RPTKA No" value={employee.travel.rptka_no} onChange={(v) => updateTravel('rptka_no', v)} disabled={!canWrite('travel','rptka_no')} />
                <FormField label="RPTKA Position" value={employee.travel.rptka_position} onChange={(v) => updateTravel('rptka_position', v)} disabled={!canWrite('travel','rptka_position')} />
                <FormField label="Job Title (KITAS)" value={employee.travel.job_title_kitas} onChange={(v) => updateTravel('job_title_kitas', v)} disabled={!canWrite('travel','job_title_kitas')} />
                <FormField label="Travel In" value={employee.travel.travel_in} onChange={(v) => updateTravel('travel_in', v)} type="date" disabled={!canWrite('travel','travel_in')} />
                <FormField label="Travel Out" value={employee.travel.travel_out} onChange={(v) => updateTravel('travel_out', v)} type="date" disabled={!canWrite('travel','travel_out')} />
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
              <FormField label="Batch" value={employee.notes.batch} onChange={(v) => updateNotes('batch', v)} disabled={!canWrite('notes','batch')} />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea 
                  value={employee.notes.note || ''} 
                  onChange={(e) => updateNotes('note', e.target.value)}
                  rows={6}
                  placeholder="Add notes about this employee..."
                  className="bg-background"
                  disabled={!canWrite('notes','note')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default EditEmployee;
