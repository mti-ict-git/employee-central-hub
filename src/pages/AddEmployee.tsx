import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MainLayout } from "@/components/layout/MainLayout";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { FormSteps } from "@/components/employees/form/FormStep";
import { BasicInfoStep } from "@/components/employees/form/BasicInfoStep";
import { ContactInfoStep } from "@/components/employees/form/ContactInfoStep";
import { EmploymentStep } from "@/components/employees/form/EmploymentStep";
import { OnboardingStep } from "@/components/employees/form/OnboardingStep";
import { BankInsuranceStep } from "@/components/employees/form/BankInsuranceStep";
import { TravelDocumentsStep } from "@/components/employees/form/TravelDocumentsStep";
import { ReviewStep } from "@/components/employees/form/ReviewStep";
import { employeeFormSchema, EmployeeFormData, basicInfoSchema, contactInfoSchema, employmentSchema, onboardingSchema, bankInsuranceSchema, travelDocumentsSchema } from "@/lib/employeeSchema";
import { ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const steps = [
  { id: 'basic', title: 'Basic Info' },
  { id: 'contact', title: 'Contact' },
  { id: 'employment', title: 'Employment' },
  { id: 'onboarding', title: 'Onboarding' },
  { id: 'bank', title: 'Bank & Insurance' },
  { id: 'travel', title: 'Travel Docs' },
  { id: 'review', title: 'Review' },
];

const AddEmployee = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employee_type: undefined,
      employee_id: "",
      name: "",
      phone_number: "",
      division: "",
      department: "",
      job_title: "",
      join_date: "",
    },
    mode: "onTouched",
  });

  const employeeType = form.watch("employee_type");

  const validateCurrentStep = async () => {
    const values = form.getValues();
    
    try {
      switch (currentStep) {
        case 0:
          basicInfoSchema.parse(values);
          break;
        case 1:
          contactInfoSchema.parse(values);
          break;
        case 2:
          employmentSchema.parse(values);
          break;
        case 3:
          onboardingSchema.parse(values);
          break;
        case 4:
          bankInsuranceSchema.parse(values);
          break;
        case 5:
          if (employeeType === 'expat') {
            travelDocumentsSchema.parse(values);
          }
          break;
      }
      return true;
    } catch (error) {
      // Trigger validation to show errors
      await form.trigger();
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      // Skip travel docs step for Indonesia employees
      if (currentStep === 4 && employeeType === 'indonesia') {
        setCurrentStep(6); // Go directly to review
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      }
    }
  };

  const handlePrevious = () => {
    // Skip travel docs step when going back for Indonesia employees
    if (currentStep === 6 && employeeType === 'indonesia') {
      setCurrentStep(4);
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 0));
    }
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        employee_id: data.employee_id,
        name: data.name,
        gender: data.gender,
        place_of_birth: data.place_of_birth,
        date_of_birth: data.date_of_birth,
        marital_status: data.marital_status,
        religion: data.religion,
        nationality: data.nationality,
        blood_type: data.blood_type,
        education: data.education,
        imip_id: data.imip_id,
        phone_number: data.phone_number,
        email: data.email || null,
        address: data.address,
        city: data.city,
        spouse_name: data.spouse_name,
        child_name_1: data.child_name_1,
        child_name_2: data.child_name_2,
        child_name_3: data.child_name_3,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        ktp_no: data.ktp_no,
        kartu_keluarga_no: data.kartu_keluarga_no,
        employment_status: data.employment_status,
        company_office: data.company_office,
        work_location: data.work_location,
        division: data.division,
        department: data.department,
        section: data.section,
        direct_report: data.direct_report,
        job_title: data.job_title,
        grade: data.grade,
        position_grade: data.position_grade,
        group_job_title: data.group_job_title,
        locality_status: data.locality_status,
        branch: data.branch,
        branch_id: data.branch_id,
        field: data.field,
        point_of_hire: data.point_of_hire,
        point_of_origin: data.point_of_origin,
        schedule_type: data.schedule_type,
        first_join_date_merdeka: data.first_join_date_merdeka,
        transfer_merdeka: data.transfer_merdeka,
        first_join_date: data.first_join_date,
        join_date: data.join_date,
        end_contract: data.end_contract,
        bank_name: data.bank_name,
        account_name: data.account_name,
        account_no: data.account_no,
        bank_code: data.bank_code,
        icbc_bank_account_no: data.icbc_bank_account_no,
        icbc_username: data.icbc_username,
        npwp: data.npwp,
        bpjs_tk: data.bpjs_tk,
        bpjs_kes: data.bpjs_kes,
        status_bpjs_kes: data.status_bpjs_kes,
        insurance_endorsement: data.insurance_endorsement,
        insurance_owlexa: data.insurance_owlexa,
        insurance_fpg: data.insurance_fpg,
        passport_no: data.passport_no,
        name_as_passport: data.name_as_passport,
        passport_expiry: data.passport_expiry,
        kitas_no: data.kitas_no,
        kitas_expiry: data.kitas_expiry,
        kitas_address: data.kitas_address,
        imta: data.imta,
        rptka_no: data.rptka_no,
        rptka_position: data.rptka_position,
        job_title_kitas: data.job_title_kitas,
      };
      const res = await fetch(`http://localhost:${8083}/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = result?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      const createdId = String(result?.employee_id || data.employee_id || "");
      toast({
        title: "Employee Created",
        description: createdId ? `${data.name} created (ID: ${createdId}).` : `${data.name} has been successfully added.`,
      });
      if (createdId) {
        navigate(`/employees/${encodeURIComponent(createdId)}`);
      } else {
        navigate("/employees");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicInfoStep form={form} />;
      case 1:
        return <ContactInfoStep form={form} />;
      case 2:
        return <EmploymentStep form={form} />;
      case 3:
        return <OnboardingStep form={form} />;
      case 4:
        return <BankInsuranceStep form={form} />;
      case 5:
        return <TravelDocumentsStep form={form} />;
      case 6:
        return <ReviewStep form={form} />;
      default:
        return null;
    }
  };

  // Adjust display steps for Indonesia employees
  const displaySteps = employeeType === 'indonesia' 
    ? steps.filter(s => s.id !== 'travel')
    : steps;

  const displayCurrentStep = employeeType === 'indonesia' && currentStep > 4 
    ? currentStep - 1 
    : currentStep;

  return (
    <MainLayout title="Add New Employee" subtitle="Create a new employee record">
      <div className="max-w-4xl mx-auto">
        <FormSteps 
          steps={displaySteps} 
          currentStep={displayCurrentStep} 
        />

        <div className="rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {renderStep()}

              <div className="flex justify-between mt-8 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                {currentStep < steps.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Create Employee
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </MainLayout>
  );
};

export default AddEmployee;
