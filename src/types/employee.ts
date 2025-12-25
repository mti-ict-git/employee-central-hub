// Employee types based on database schema

export type EmployeeType = 'indonesia' | 'expat';
export type EmployeeStatus = 'active' | 'inactive';

export interface EmployeeCore {
  employee_id: string;
  imip_id?: string;
  name: string;
  gender: 'Male' | 'Female';
  place_of_birth?: string;
  date_of_birth?: string;
  marital_status?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  tax_status?: string;
  religion?: string;
  nationality?: string;
  blood_type?: string;
  ktp_no?: string;
  kartu_keluarga_no?: string;
  npwp?: string;
  education?: string;
  branch_id?: string;
  branch?: string;
  office_email?: string;
  month_of_birthday?: string;
  id_card_mti?: boolean;
  field?: string;
}

export interface EmployeeContact {
  employee_id: string;
  phone_number?: string;
  email?: string;
  address?: string;
  city?: string;
  spouse_name?: string;
  child_name_1?: string;
  child_name_2?: string;
  child_name_3?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface EmployeeEmployment {
  employee_id: string;
  employment_status?: 'suspended' | 'retired' | 'terminated' | 'non_active' | 'intern' | 'contract' | 'probation' | 'active';
  status?: 'Active' | 'Inactive' | 'Resign' | 'Terminated';
  company_office?: string;
  work_location?: string;
  division?: string;
  department?: string;
  section?: string;
  direct_report?: string;
  job_title?: string;
  grade?: string;
  position_grade?: 'Staff' | 'NonStaff' | 'Supervisor' | 'Manager';
  group_job_title?: string;
  locality_status?: 'Local' | 'Non Local' | 'Overseas';
  terminated_date?: string;
  terminated_type?: 'Resignation' | 'Termination' | 'End Contract' | 'Retirement';
  terminated_reason?: string;
  blacklist_mti?: boolean;
  blacklist_imip?: boolean;
}

export interface EmployeeBank {
  employee_id: string;
  bank_name?: string;
  account_name?: string;
  account_no?: string;
  bank_code?: string;
  icbc_bank_account_no?: string;
  icbc_username?: string;
}

export interface EmployeeInsurance {
  employee_id: string;
  insurance_endorsement?: boolean;
  insurance_owlexa?: boolean;
  insurance_fpg?: boolean;
  bpjs_tk?: string;
  bpjs_kes?: string;
  status_bpjs_kes?: 'Active' | 'Non Active' | 'PBI' | 'Not Registered';
  social_insurance_no_alt?: string;
  bpjs_kes_no_alt?: string;
  fpg_no?: string;
  owlexa_no?: string;
}

export interface EmployeeOnboard {
  employee_id: string;
  point_of_hire?: string;
  point_of_origin?: string;
  schedule_type?: string;
  first_join_date_merdeka?: string;
  transfer_merdeka?: string;
  first_join_date?: string;
  join_date?: string;
  end_contract?: string;
  years_in_service?: string;
}

export interface EmployeeTravel {
  employee_id: string;
  kitas_no?: string;
  passport_no?: string;
  travel_in?: string;
  travel_out?: string;
  name_as_passport?: string;
  passport_expiry?: string;
  kitas_expiry?: string;
  imta?: string;
  rptka_no?: string;
  rptka_position?: string;
  kitas_address?: string;
  job_title_kitas?: string;
}

export interface EmployeeChecklist {
  employee_id: string;
  passport_checklist?: boolean;
  kitas_checklist?: boolean;
  imta_checklist?: boolean;
  rptka_checklist?: boolean;
  npwp_checklist?: boolean;
  bpjs_kes_checklist?: boolean;
  bpjs_tk_checklist?: boolean;
  bank_checklist?: boolean;
}

export interface EmployeeNotes {
  employee_id: string;
  batch?: string;
  note?: string;
}

export interface Employee {
  core: EmployeeCore;
  contact: EmployeeContact;
  employment: EmployeeEmployment;
  bank: EmployeeBank;
  insurance: EmployeeInsurance;
  onboard: EmployeeOnboard;
  travel: EmployeeTravel;
  checklist: EmployeeChecklist;
  notes: EmployeeNotes;
  type: EmployeeType;
}
