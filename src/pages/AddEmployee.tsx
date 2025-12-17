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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      console.log("Employee data:", data);
      
      toast({
        title: "Employee Created",
        description: `${data.name} has been successfully added to the system.`,
      });
      
      navigate("/employees");
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
