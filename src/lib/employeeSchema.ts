import { z } from "zod";

// Step 1: Basic Information
export const basicInfoSchema = z.object({
  employee_type: z.enum(["indonesia", "expat"], {
    required_error: "Please select employee type",
  }),
  employee_id: z.string().min(1, "Employee ID is required").max(20),
  imip_id: z.string().max(20).optional(),
  name: z.string().min(1, "Name is required").max(100),
  gender: z.enum(["Male", "Female"], {
    required_error: "Please select gender",
  }),
  place_of_birth: z.string().max(50).optional(),
  date_of_birth: z.string().optional(),
  marital_status: z.enum(["Single", "Married", "Divorced", "Widowed"]).optional(),
  tax_status: z.string().max(10).optional(),
  religion: z.string().max(30).optional(),
  nationality: z.string().min(1, "Nationality is required").max(50),
  blood_type: z.string().max(5).optional(),
  education: z.string().max(50).optional(),
});

// Step 2: Contact Information
export const contactInfoSchema = z.object({
  phone_number: z.string().min(1, "Phone number is required").max(20),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  ktp_no: z.string().max(20).optional(),
  kartu_keluarga_no: z.string().max(25).optional(),
  spouse_name: z.string().max(100).optional(),
  child_name_1: z.string().max(100).optional(),
  child_name_2: z.string().max(100).optional(),
  child_name_3: z.string().max(100).optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
});

// Step 3: Employment Details
export const employmentSchema = z.object({
  employment_status: z.enum([
    "suspended",
    "retired",
    "terminated",
    "non_active",
    "intern",
    "contract",
    "probation",
    "active",
  ], {
    required_error: "Employment status is required",
  }),
  company_office: z.string().max(100).optional(),
  work_location: z.string().max(100).optional(),
  division: z.string().min(1, "Division is required").max(100),
  department: z.string().min(1, "Department is required").max(100),
  section: z.string().max(100).optional(),
  direct_report: z.string().max(100).optional(),
  job_title: z.string().min(1, "Job title is required").max(100),
  grade: z.string().max(10).optional(),
  position_grade: z.enum(["Staff", "NonStaff", "Supervisor", "Manager"]).optional(),
  group_job_title: z.string().max(100).optional(),
  locality_status: z.enum(["Local", "Non Local", "Overseas"]).optional(),
  branch: z.string().max(50).optional(),
  branch_id: z.string().max(20).optional(),
  field: z.string().max(100).optional(),
});

// Step 4: Onboarding
export const onboardingSchema = z.object({
  point_of_hire: z.string().max(100).optional(),
  point_of_origin: z.string().max(100).optional(),
  schedule_type: z.string().max(50).optional(),
  first_join_date_merdeka: z.string().optional(),
  transfer_merdeka: z.string().optional(),
  first_join_date: z.string().optional(),
  join_date: z.string().min(1, "Join date is required"),
  end_contract: z.string().optional(),
});

// Step 5: Bank & Insurance
export const bankInsuranceSchema = z.object({
  bank_name: z.string().max(100).optional(),
  account_name: z.string().max(100).optional(),
  account_no: z.string().max(50).optional(),
  bank_code: z.string().max(20).optional(),
  icbc_bank_account_no: z.string().max(50).optional(),
  icbc_username: z.string().max(50).optional(),
  npwp: z.string().max(25).optional(),
  bpjs_tk: z.string().max(30).optional(),
  bpjs_kes: z.string().max(30).optional(),
  status_bpjs_kes: z.enum(["Active", "Non Active", "PBI", "Not Registered"]).optional(),
  insurance_endorsement: z.boolean().optional(),
  insurance_owlexa: z.boolean().optional(),
  insurance_fpg: z.boolean().optional(),
});

// Step 6: Travel Documents (mainly for Expat)
export const travelDocumentsSchema = z.object({
  passport_no: z.string().max(50).optional(),
  name_as_passport: z.string().max(100).optional(),
  passport_expiry: z.string().optional(),
  kitas_no: z.string().max(50).optional(),
  kitas_expiry: z.string().optional(),
  kitas_address: z.string().max(255).optional(),
  imta: z.string().max(50).optional(),
  rptka_no: z.string().max(50).optional(),
  rptka_position: z.string().max(100).optional(),
  job_title_kitas: z.string().max(100).optional(),
});

// Complete form schema
export const employeeFormSchema = basicInfoSchema
  .merge(contactInfoSchema)
  .merge(employmentSchema)
  .merge(onboardingSchema)
  .merge(bankInsuranceSchema)
  .merge(travelDocumentsSchema);

export type EmployeeFormData = z.infer<typeof employeeFormSchema>;
