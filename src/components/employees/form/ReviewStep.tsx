import { UseFormReturn } from "react-hook-form";
import { EmployeeFormData } from "@/lib/employeeSchema";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Briefcase, Calendar, CreditCard, Plane } from "lucide-react";

interface ReviewStepProps {
  form: UseFormReturn<EmployeeFormData>;
}

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
      <Icon className="h-4 w-4 text-primary" />
      <h4 className="font-medium">{title}</h4>
    </div>
    <div className="grid gap-2 text-sm">{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value?: string | boolean | null }) => {
  if (value === undefined || value === null || value === '') return null;
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{displayValue}</span>
    </div>
  );
};

export function ReviewStep({ form }: ReviewStepProps) {
  const values = form.getValues();
  const isExpat = values.employee_type === 'expat';
  const toLabel = (s: string) =>
    String(s || "")
      .replace(/_/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <h3 className="font-semibold mb-1">Review & Submit</h3>
        <p className="text-sm text-muted-foreground">
          Please review all information before submitting.
        </p>
      </div>

      {/* Header Summary */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-xl font-bold text-primary-foreground">
            {values.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'NA'}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-xl font-bold">{values.name || 'No Name'}</h2>
              <Badge variant={isExpat ? 'secondary' : 'default'}>
                {isExpat ? 'Expatriate' : 'Indonesia'}
              </Badge>
            </div>
            <p className="text-muted-foreground">{values.job_title || 'No Job Title'} • {values.department || 'No Department'}</p>
            <p className="text-sm text-muted-foreground">
              Employee ID: <span className="font-medium text-primary">{values.employee_id || 'N/A'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Basic Information" icon={User}>
          <Field label="Gender" value={values.gender} />
          <Field label="Nationality" value={values.nationality} />
          <Field label="Date of Birth" value={values.date_of_birth} />
          <Field label="Place of Birth" value={values.place_of_birth} />
          <Field label="Marital Status" value={values.marital_status} />
          <Field label="Religion" value={values.religion} />
          <Field label="Education" value={values.education} />
          {values.imip_id && <Field label="IMIP ID" value={values.imip_id} />}
        </Section>

        <Section title="Contact Information" icon={Phone}>
          <Field label="Phone" value={values.phone_number} />
          <Field label="Email" value={values.email} />
          <Field label="Address" value={values.address} />
          <Field label="City" value={values.city} />
          <Field label="KTP No" value={values.ktp_no} />
          {values.emergency_contact_name && (
            <Field label="Emergency Contact" value={`${values.emergency_contact_name} (${values.emergency_contact_phone})`} />
          )}
        </Section>

        <Section title="Employment Details" icon={Briefcase}>
          <Field label="Status" value={values.employment_status ? toLabel(values.employment_status) : values.employment_status} />
          <Field label="Division" value={values.division} />
          <Field label="Department" value={values.department} />
          <Field label="Section" value={values.section} />
          <Field label="Job Title" value={values.job_title} />
          <Field label="Grade" value={values.grade} />
          <Field label="Position Grade" value={values.position_grade} />
          <Field label="Direct Report" value={values.direct_report} />
          {isExpat && <Field label="Work Location" value={values.work_location} />}
          {!isExpat && <Field label="Branch" value={values.branch} />}
        </Section>

        <Section title="Onboarding" icon={Calendar}>
          <Field label="Point of Hire" value={values.point_of_hire} />
          <Field label="Schedule Type" value={values.schedule_type} />
          <Field label="Join Date" value={values.join_date} />
          <Field label="First Join Date" value={values.first_join_date} />
          <Field label="End Contract" value={values.end_contract} />
        </Section>

        <Section title="Bank & Insurance" icon={CreditCard}>
          {!isExpat && (
            <>
              <Field label="Bank" value={values.bank_name} />
              <Field label="Account Name" value={values.account_name} />
              <Field label="Account No" value={values.account_no} />
            </>
          )}
          {isExpat && (
            <>
              <Field label="Bank Code" value={values.bank_code} />
              <Field label="ICBC Account" value={values.icbc_bank_account_no} />
            </>
          )}
          <Field label="NPWP" value={values.npwp} />
          <Field label="BPJS TK" value={values.bpjs_tk} />
          <Field label="BPJS KES" value={values.bpjs_kes} />
          <Field label="Status BPJS KES" value={values.status_bpjs_kes} />
          <Field label="Insurance Endorsement" value={values.insurance_endorsement} />
          <Field label="Insurance Owlexa" value={values.insurance_owlexa} />
          <Field label="Insurance FPG" value={values.insurance_fpg} />
        </Section>

        {isExpat && (
          <Section title="Travel Documents" icon={Plane}>
            <Field label="Passport No" value={values.passport_no} />
            <Field label="Passport Expiry" value={values.passport_expiry} />
            <Field label="KITAS No" value={values.kitas_no} />
            <Field label="KITAS Expiry" value={values.kitas_expiry} />
            <Field label="IMTA" value={values.imta} />
            <Field label="RPTKA No" value={values.rptka_no} />
            <Field label="RPTKA Position" value={values.rptka_position} />
          </Section>
        )}
      </div>
    </div>
  );
}
