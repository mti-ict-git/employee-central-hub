import { Router } from "express";
import sql from "mssql";
import { CONFIG } from "../config";
import { authMiddleware } from "../middleware/auth";
import { can, readSectionsFor } from "../policy";

export const employeesRouter = Router();

employeesRouter.use(authMiddleware);

employeesRouter.use((req, res, next) => {
  const roles = req.user?.roles || [];
  if (req.method === "GET") return next();
  if (req.method === "POST") {
    if (roles.some((r) => can(r, "create", "employees"))) return next();
    return res.status(403).json({ error: "FORBIDDEN_CREATE_EMPLOYEE" });
  }
  if (req.method === "PUT" || req.method === "PATCH") {
    if (roles.some((r) => can(r, "update", "employees"))) return next();
    return res.status(403).json({ error: "FORBIDDEN_UPDATE_EMPLOYEE" });
  }
  if (req.method === "DELETE") {
    if (roles.some((r) => can(r, "delete", "employees"))) return next();
    return res.status(403).json({ error: "FORBIDDEN_DELETE_EMPLOYEE" });
  }
  return next();
});
function getPool() {
  return new sql.ConnectionPool({
    server: CONFIG.DB.SERVER,
    database: CONFIG.DB.DATABASE,
    user: CONFIG.DB.USER,
    password: CONFIG.DB.PASSWORD,
    port: CONFIG.DB.PORT,
    options: {
      encrypt: CONFIG.DB.ENCRYPT,
      trustServerCertificate: CONFIG.DB.TRUST_SERVER_CERTIFICATE,
    },
  });
}

type EmployeeListRow = {
  employee_id: string;
  name: string | null;
  nationality: string | null;
  department: string | null;
  status: string | null;
};

type EmployeeDetailRow = {
  employee_id: string;
  name: string | null;
  gender: string | null;
  place_of_birth: string | null;
  date_of_birth: Date | null;
  marital_status: string | null;
  religion: string | null;
  nationality: string | null;
  blood_type: string | null;
  kartu_keluarga_no: string | null;
  ktp_no: string | null;
  npwp: string | null;
  tax_status: string | null;
  education: string | null;
  office_email: string | null;
  branch: string | null;
  branch_id: string | null;
  imip_id: string | null;
  id_card_mti: boolean | null;
  field: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  spouse_name: string | null;
  child_name_1: string | null;
  child_name_2: string | null;
  child_name_3: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  employment_status: string | null;
  status: string | null;
  division: string | null;
  department: string | null;
  section: string | null;
  job_title: string | null;
  grade: string | null;
  position_grade: string | null;
  group_job_title: string | null;
  direct_report: string | null;
  company_office: string | null;
  work_location: string | null;
  locality_status: string | null;
  terminated_date: Date | null;
  terminated_type: string | null;
  terminated_reason: string | null;
  blacklist_mti: string | null;
  blacklist_imip: string | null;
  point_of_hire: string | null;
  point_of_origin: string | null;
  schedule_type: string | null;
  first_join_date_merdeka: Date | null;
  transfer_merdeka: string | null;
  first_join_date: Date | null;
  join_date: Date | null;
  end_contract: Date | null;
  years_in_service: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_no: string | null;
  bank_code: string | null;
  icbc_bank_account_no: string | null;
  icbc_username: string | null;
  insurance_endorsement: boolean | null;
  insurance_owlexa: boolean | null;
  insurance_fpg: boolean | null;
  fpg_no: string | null;
  owlexa_no: string | null;
  bpjs_tk: string | null;
  bpjs_kes: string | null;
  status_bpjs_kes: string | null;
  social_insurance_no_alt: string | null;
  bpjs_kes_no_alt: string | null;
  passport_no: string | null;
  name_as_passport: string | null;
  passport_expiry: Date | null;
  kitas_no: string | null;
  kitas_expiry: Date | null;
  kitas_address: string | null;
  imta: string | null;
  rptka_no: string | null;
  rptka_position: string | null;
  job_title_kitas: string | null;
  travel_in: string | null;
  travel_out: string | null;
  paspor_checklist: boolean | null;
  kitas_checklist: boolean | null;
  imta_checklist: boolean | null;
  rptka_checklist: boolean | null;
  npwp_checklist: boolean | null;
  bpjs_kes_checklist: boolean | null;
  bpjs_tk_checklist: boolean | null;
  bank_checklist: boolean | null;
  batch: string | null;
  note: string | null;
};

function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function genderToCode(g: string | null | undefined) {
  const v = String(g || "").toLowerCase();
  if (v === "male") return "M";
  if (v === "female") return "F";
  return null;
}

function boolToYN(v: unknown) {
  if (v === undefined || v === null) return null;
  return v ? "Y" : "N";
}

function normalizeRoleName(role: string) {
  const s = String(role || "").trim().toLowerCase();
  if (s.includes("super")) return "superadmin";
  if (s === "admin") return "admin";
  if (s.includes("hr")) return "hr_general";
  if (s.includes("finance")) return "finance";
  if (s.includes("dep")) return "department_rep";
  if (s.includes("employee")) return "employee";
  return s;
}

function canonicalSectionKey(section: string) {
  const s = String(section || "").trim().toLowerCase();
  if (s.startsWith("employee ")) return s.slice("employee ".length);
  if (s.startsWith("employee_")) return s.slice("employee_".length);
  return s;
}

function extractDbErrorDetails(err: unknown): { code?: string; number?: number; state?: string; name?: string } | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const o = err as { [k: string]: unknown };
  const code = typeof o.code === "string" ? o.code : undefined;
  const number = typeof o.number === "number" ? o.number : undefined;
  const state = typeof o.state === "string" ? o.state : undefined;
  const name = typeof (err as Error).name === "string" ? (err as Error).name : undefined;
  if (!code && !number && !state && !name) return undefined;
  return { code, number, state, name };
}
  employeesRouter.get("/", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const pool = getPool();
  try {
    await pool.connect();
    const rolesRaw = req.user?.roles || [];
    const roles = rolesRaw.map((r) => normalizeRoleName(String(r)));
    const isDepRep = roles.includes("department_rep");
    let userDept: string | null = null;
    if (isDepRep) {
      const deptReq = new sql.Request(pool);
      deptReq.input("username", sql.VarChar(50), String(req.user?.username || ""));
      const deptRes = await deptReq.query(`
        SELECT TOP 1 department
        FROM dbo.login
        WHERE username = @username
      `);
      const deptRow = (deptRes.recordset || [])[0] as { department?: unknown } | undefined;
      const d = String(deptRow?.department || "").trim();
      if (!d) return res.status(403).json({ error: "DEPARTMENT_NOT_SET_FOR_USER" });
      userDept = d;
    }
    const request = new sql.Request(pool);
    if (isDepRep && userDept) request.input("department", sql.NVarChar(100), userDept);
    const whereClause = isDepRep ? "WHERE emp.department IS NOT NULL AND LTRIM(RTRIM(emp.department)) <> '' AND LOWER(emp.department) = LOWER(@department)" : "";
    const result = await request.query<EmployeeListRow>(`
      SELECT core.employee_id,
             core.name,
             core.nationality,
             emp.department,
             emp.status
      FROM dbo.employee_core AS core
      LEFT JOIN dbo.employee_employment AS emp ON emp.employee_id = core.employee_id
      ${whereClause}
      ORDER BY core.employee_id
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `);
    const rows: EmployeeListRow[] = result.recordset || [];
    const data = rows.map((r: EmployeeListRow) => ({
      core: {
        employee_id: r.employee_id,
        name: r.name,
        nationality: r.nationality,
      },
      employment: {
        department: r.department,
        status: r.status,
      },
      type: (String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expat") as "indonesia" | "expat",
    }));
    return res.json({ items: data, paging: { limit, offset, count: data.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_EMPLOYEES";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

employeesRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "EMPLOYEE_ID_REQUIRED" });
  const pool = getPool();
  const trx = new sql.Transaction(await pool.connect());
  try {
    await trx.begin();
    const request = new sql.Request(trx);
    request.input("employee_id", sql.VarChar(100), id);
    await request.query(`
      DELETE FROM dbo.employee_notes WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_checklist WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_travel WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_insurance WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_bank WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_onboard WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_employment WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_contact WHERE employee_id=@employee_id;
      DELETE FROM dbo.employee_core WHERE employee_id=@employee_id;
    `);
    await trx.commit();
    return res.json({ ok: true, employee_id: id });
  } catch (err: unknown) {
    await trx.rollback();
    const message = err instanceof Error ? err.message : "FAILED_TO_DELETE_EMPLOYEE";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

employeesRouter.put("/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "EMPLOYEE_ID_REQUIRED" });
  const body = req.body || {};
  const pool = getPool();
  const trx = new sql.Transaction(await pool.connect());
  let phase = "init";
  try {
    await trx.begin();
    const request = new sql.Request(trx);
    const core = (body && body.core) ? body.core : body;
    const contact = (body && body.contact) ? body.contact : body;
    const employment = (body && body.employment) ? body.employment : body;
    const onboard = (body && body.onboard) ? body.onboard : body;
    const bank = (body && body.bank) ? body.bank : body;
    const insurance = (body && body.insurance) ? body.insurance : body;
    const travel = (body && body.travel) ? body.travel : body;
    const checklist = (body && body.checklist) ? body.checklist : body;
    const notes = (body && body.notes) ? body.notes : body;
    request.input("employee_id", sql.VarChar(100), id);
    request.input("name", sql.NVarChar(200), core.name || null);
    request.input("gender", sql.Char(1), genderToCode(core.gender));
    request.input("place_of_birth", sql.NVarChar(100), core.place_of_birth || null);
    request.input("date_of_birth", sql.Date, parseDate(core.date_of_birth));
    request.input("marital_status", sql.NVarChar(50), core.marital_status || null);
    request.input("religion", sql.NVarChar(50), core.religion || null);
    request.input("nationality", sql.NVarChar(100), core.nationality || null);
    request.input("blood_type", sql.NVarChar(5), core.blood_type || null);
    request.input("kartu_keluarga_no", sql.NVarChar(50), core.kartu_keluarga_no || null);
    request.input("ktp_no", sql.NVarChar(50), core.ktp_no || null);
    request.input("npwp", sql.NVarChar(30), core.npwp || null);
    request.input("tax_status", sql.NVarChar(20), core.tax_status || null);
    request.input("education", sql.NVarChar(100), core.education || null);
    request.input("imip_id", sql.NVarChar(50), core.imip_id || null);
    request.input("branch", sql.NVarChar(50), core.branch || null);
    request.input("branch_id", sql.NVarChar(50), core.branch_id || null);
    request.input("office_email", sql.NVarChar(255), core.office_email || null);
    const idCardVal =
      core.id_card_mti === true ? 1 :
      core.id_card_mti === false ? 0 : null;
    request.input("id_card_mti", sql.Bit, idCardVal);
    request.input("field", sql.NVarChar(100), (core.field ?? employment.field) || null);
    phase = "core_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_core WHERE employee_id = @employee_id)
        UPDATE dbo.employee_core
        SET name=@name, gender=@gender, place_of_birth=@place_of_birth, date_of_birth=@date_of_birth,
            marital_status=@marital_status, religion=@religion, nationality=@nationality, blood_type=@blood_type,
            kartu_keluarga_no=@kartu_keluarga_no, ktp_no=@ktp_no, npwp=@npwp, tax_status=@tax_status,
            education=@education, imip_id=@imip_id, branch=@branch, branch_id=@branch_id, office_email=@office_email, id_card_mti=@id_card_mti, field=@field
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_core (employee_id, name, gender, place_of_birth, date_of_birth, marital_status, religion, nationality, blood_type, kartu_keluarga_no, ktp_no, npwp, tax_status, education, imip_id, branch, branch_id, office_email, id_card_mti, field)
        VALUES (@employee_id, @name, @gender, @place_of_birth, @date_of_birth, @marital_status, @religion, @nationality, @blood_type, @kartu_keluarga_no, @ktp_no, @npwp, @tax_status, @education, @imip_id, @branch, @branch_id, @office_email, @id_card_mti, @field);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("phone_number", sql.NVarChar(50), contact.phone_number || null);
    request.input("email", sql.NVarChar(200), contact.email || null);
    request.input("address", sql.NVarChar(255), contact.address || null);
    request.input("city", sql.NVarChar(100), contact.city || null);
    request.input("spouse_name", sql.NVarChar(200), contact.spouse_name || null);
    request.input("child_name_1", sql.NVarChar(200), contact.child_name_1 || null);
    request.input("child_name_2", sql.NVarChar(200), contact.child_name_2 || null);
    request.input("child_name_3", sql.NVarChar(200), contact.child_name_3 || null);
    request.input("emergency_contact_name", sql.NVarChar(200), contact.emergency_contact_name || null);
    request.input("emergency_contact_phone", sql.NVarChar(50), contact.emergency_contact_phone || null);
    phase = "contact_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_contact WHERE employee_id = @employee_id)
        UPDATE dbo.employee_contact
        SET phone_number=@phone_number, email=@email, address=@address, city=@city, spouse_name=@spouse_name,
            child_name_1=@child_name_1, child_name_2=@child_name_2, child_name_3=@child_name_3,
            emergency_contact_name=@emergency_contact_name, emergency_contact_phone=@emergency_contact_phone
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_contact (employee_id, phone_number, email, address, city, spouse_name, child_name_1, child_name_2, child_name_3, emergency_contact_name, emergency_contact_phone)
        VALUES (@employee_id, @phone_number, @email, @address, @city, @spouse_name, @child_name_1, @child_name_2, @child_name_3, @emergency_contact_name, @emergency_contact_phone);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("employment_status", sql.NVarChar(50), employment.employment_status || null);
    request.input("status", sql.NVarChar(50), employment.status || "Active");
    request.input("division", sql.NVarChar(100), employment.division || null);
    request.input("department", sql.NVarChar(100), employment.department || null);
    request.input("section", sql.NVarChar(100), employment.section || null);
    request.input("job_title", sql.NVarChar(100), employment.job_title || null);
    request.input("grade", sql.NVarChar(20), employment.grade || null);
    request.input("position_grade", sql.NVarChar(50), employment.position_grade || null);
    request.input("group_job_title", sql.NVarChar(100), employment.group_job_title || null);
    request.input("direct_report", sql.NVarChar(100), employment.direct_report || null);
    request.input("company_office", sql.NVarChar(100), employment.company_office || null);
    request.input("work_location", sql.NVarChar(100), employment.work_location || null);
    request.input("locality_status", sql.NVarChar(50), employment.locality_status || null);
    request.input("blacklist_mti", sql.NVarChar(1), boolToYN((employment as unknown as { blacklist_mti?: boolean }).blacklist_mti));
    request.input("blacklist_imip", sql.NVarChar(1), boolToYN((employment as unknown as { blacklist_imip?: boolean }).blacklist_imip));
    phase = "employment_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_employment WHERE employee_id = @employee_id)
        UPDATE dbo.employee_employment
        SET employment_status=@employment_status, status=@status, division=@division, department=@department, section=@section,
            job_title=@job_title, grade=@grade, position_grade=@position_grade, group_job_title=@group_job_title,
            direct_report=@direct_report, company_office=@company_office, work_location=@work_location,
            locality_status=@locality_status, blacklist_mti=@blacklist_mti, blacklist_imip=@blacklist_imip
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_employment (employee_id, employment_status, status, division, department, section, job_title, grade, position_grade, group_job_title, direct_report, company_office, work_location, locality_status, blacklist_mti, blacklist_imip)
        VALUES (@employee_id, @employment_status, @status, @division, @department, @section, @job_title, @grade, @position_grade, @group_job_title, @direct_report, @company_office, @work_location, @locality_status, @blacklist_mti, @blacklist_imip);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("point_of_hire", sql.NVarChar(100), onboard.point_of_hire || null);
    request.input("point_of_origin", sql.NVarChar(100), onboard.point_of_origin || null);
    request.input("schedule_type", sql.NVarChar(50), onboard.schedule_type || null);
    request.input("first_join_date_merdeka", sql.Date, parseDate(onboard.first_join_date_merdeka));
    request.input("transfer_merdeka", sql.Date, parseDate(onboard.transfer_merdeka));
    request.input("first_join_date", sql.Date, parseDate(onboard.first_join_date));
    request.input("join_date", sql.Date, parseDate(onboard.join_date));
    request.input("end_contract", sql.Date, parseDate(onboard.end_contract));
    phase = "onboard_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_onboard WHERE employee_id = @employee_id)
        UPDATE dbo.employee_onboard
        SET point_of_hire=@point_of_hire, point_of_origin=@point_of_origin, schedule_type=@schedule_type,
            first_join_date_merdeka=@first_join_date_merdeka, transfer_merdeka=@transfer_merdeka,
            first_join_date=@first_join_date, join_date=@join_date, end_contract=@end_contract
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_onboard (employee_id, point_of_hire, point_of_origin, schedule_type, first_join_date_merdeka, transfer_merdeka, first_join_date, join_date, end_contract)
        VALUES (@employee_id, @point_of_hire, @point_of_origin, @schedule_type, @first_join_date_merdeka, @transfer_merdeka, @first_join_date, @join_date, @end_contract);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("bank_name", sql.NVarChar(100), bank.bank_name || null);
    request.input("account_name", sql.NVarChar(100), bank.account_name || null);
    request.input("account_no", sql.NVarChar(50), bank.account_no || null);
    request.input("bank_code", sql.NVarChar(50), bank.bank_code || null);
    request.input("icbc_bank_account_no", sql.NVarChar(50), bank.icbc_bank_account_no || null);
    request.input("icbc_username", sql.NVarChar(50), bank.icbc_username || null);
    phase = "bank_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_bank WHERE employee_id = @employee_id)
        UPDATE dbo.employee_bank
        SET bank_name=@bank_name, account_name=@account_name, account_no=@account_no, bank_code=@bank_code,
            icbc_bank_account_no=@icbc_bank_account_no, icbc_username=@icbc_username
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_bank (employee_id, bank_name, account_name, account_no, bank_code, icbc_bank_account_no, icbc_username)
        VALUES (@employee_id, @bank_name, @account_name, @account_no, @bank_code, @icbc_bank_account_no, @icbc_username);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("bpjs_tk", sql.NVarChar(50), insurance.bpjs_tk || null);
    request.input("bpjs_kes", sql.NVarChar(50), insurance.bpjs_kes || null);
    request.input("status_bpjs_kes", sql.NVarChar(50), insurance.status_bpjs_kes || null);
    request.input("insurance_endorsement", sql.NVarChar(1), boolToYN(insurance.insurance_endorsement));
    request.input("insurance_owlexa", sql.NVarChar(1), boolToYN(insurance.insurance_owlexa));
    request.input("insurance_fpg", sql.NVarChar(1), boolToYN(insurance.insurance_fpg));
    phase = "insurance_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_insurance WHERE employee_id = @employee_id)
        UPDATE dbo.employee_insurance
        SET bpjs_tk=@bpjs_tk, bpjs_kes=@bpjs_kes, status_bpjs_kes=@status_bpjs_kes,
            insurance_endorsement=@insurance_endorsement, insurance_owlexa=@insurance_owlexa, insurance_fpg=@insurance_fpg
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_insurance (employee_id, bpjs_tk, bpjs_kes, status_bpjs_kes, insurance_endorsement, insurance_owlexa, insurance_fpg)
        VALUES (@employee_id, @bpjs_tk, @bpjs_kes, @status_bpjs_kes, @insurance_endorsement, @insurance_owlexa, @insurance_fpg);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("passport_no", sql.NVarChar(50), travel.passport_no || null);
    request.input("name_as_passport", sql.NVarChar(100), travel.name_as_passport || null);
    request.input("passport_expiry", sql.Date, parseDate(travel.passport_expiry));
    request.input("kitas_no", sql.NVarChar(50), travel.kitas_no || null);
    request.input("kitas_expiry", sql.Date, parseDate(travel.kitas_expiry));
    request.input("kitas_address", sql.NVarChar(255), travel.kitas_address || null);
    request.input("imta", sql.NVarChar(50), travel.imta || null);
    request.input("rptka_no", sql.NVarChar(50), travel.rptka_no || null);
    request.input("rptka_position", sql.NVarChar(100), travel.rptka_position || null);
    request.input("job_title_kitas", sql.NVarChar(100), travel.job_title_kitas || null);
    phase = "travel_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_travel WHERE employee_id = @employee_id)
        UPDATE dbo.employee_travel
        SET passport_no=@passport_no, name_as_passport=@name_as_passport, passport_expiry=@passport_expiry,
            kitas_no=@kitas_no, kitas_expiry=@kitas_expiry, kitas_address=@kitas_address, imta=@imta,
            rptka_no=@rptka_no, rptka_position=@rptka_position, job_title_kitas=@job_title_kitas
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_travel (employee_id, passport_no, name_as_passport, passport_expiry, kitas_no, kitas_expiry, kitas_address, imta, rptka_no, rptka_position, job_title_kitas)
        VALUES (@employee_id, @passport_no, @name_as_passport, @passport_expiry, @kitas_no, @kitas_expiry, @kitas_address, @imta, @rptka_no, @rptka_position, @job_title_kitas);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("paspor_checklist", sql.NVarChar(1), boolToYN(checklist.passport_checklist));
    request.input("kitas_checklist", sql.NVarChar(1), boolToYN(checklist.kitas_checklist));
    request.input("imta_checklist", sql.NVarChar(1), boolToYN(checklist.imta_checklist));
    request.input("rptka_checklist", sql.NVarChar(1), boolToYN(checklist.rptka_checklist));
    request.input("npwp_checklist", sql.NVarChar(1), boolToYN(checklist.npwp_checklist));
    request.input("bpjs_kes_checklist", sql.NVarChar(1), boolToYN(checklist.bpjs_kes_checklist));
    request.input("bpjs_tk_checklist", sql.NVarChar(1), boolToYN(checklist.bpjs_tk_checklist));
    request.input("bank_checklist", sql.NVarChar(1), boolToYN(checklist.bank_checklist));
    phase = "checklist_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_checklist WHERE employee_id = @employee_id)
        UPDATE dbo.employee_checklist
        SET paspor_checklist=@paspor_checklist, kitas_checklist=@kitas_checklist, imta_checklist=@imta_checklist,
            rptka_checklist=@rptka_checklist, npwp_checklist=@npwp_checklist, bpjs_kes_checklist=@bpjs_kes_checklist,
            bpjs_tk_checklist=@bpjs_tk_checklist, bank_checklist=@bank_checklist
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_checklist (employee_id, paspor_checklist, kitas_checklist, imta_checklist, rptka_checklist, npwp_checklist, bpjs_kes_checklist, bpjs_tk_checklist, bank_checklist)
        VALUES (@employee_id, @paspor_checklist, @kitas_checklist, @imta_checklist, @rptka_checklist, @npwp_checklist, @bpjs_kes_checklist, @bpjs_tk_checklist, @bank_checklist);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("batch", sql.NVarChar(50), notes.batch || null);
    request.input("note", sql.NVarChar(sql.MAX), notes.note || null);
    phase = "notes_upsert";
    console.log("employees.put", { id, phase, params: Object.keys(((request as unknown as { parameters?: Record<string, unknown> }).parameters) || {}) });
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_notes WHERE employee_id = @employee_id)
        UPDATE dbo.employee_notes
        SET batch=@batch, note=@note
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_notes (employee_id, batch, note)
        VALUES (@employee_id, @batch, @note);
    `);
    await trx.commit();
    return res.json({ ok: true, employee_id: id });
  } catch (err: unknown) {
    await trx.rollback();
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_EMPLOYEE";
    const details = extractDbErrorDetails(err);
    console.error("employees.put.error", { id, phase, message, details });
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

employeesRouter.post("/", async (req, res) => {
  const body = req.body || {};
  const id = String(body.employee_id || "").trim();
  if (!id) return res.status(400).json({ error: "EMPLOYEE_ID_REQUIRED" });
  const pool = getPool();
  const trx = new sql.Transaction(await pool.connect());
  try {
    await trx.begin();
    const request = new sql.Request(trx);
    const core = (body && body.core) ? body.core : body;
    const contact = (body && body.contact) ? body.contact : body;
    const employment = (body && body.employment) ? body.employment : body;
    const onboard = (body && body.onboard) ? body.onboard : body;
    const bank = (body && body.bank) ? body.bank : body;
    const insurance = (body && body.insurance) ? body.insurance : body;
    const travel = (body && body.travel) ? body.travel : body;
    const checklist = (body && body.checklist) ? body.checklist : body;
    const notes = (body && body.notes) ? body.notes : body;
    request.input("employee_id", sql.VarChar(100), id);
    request.input("name", sql.NVarChar(200), core.name || null);
    request.input("gender", sql.Char(1), genderToCode(core.gender));
    request.input("place_of_birth", sql.NVarChar(100), core.place_of_birth || null);
    request.input("date_of_birth", sql.Date, parseDate(core.date_of_birth));
    request.input("marital_status", sql.NVarChar(50), core.marital_status || null);
    request.input("religion", sql.NVarChar(50), core.religion || null);
    request.input("nationality", sql.NVarChar(100), core.nationality || null);
    request.input("blood_type", sql.NVarChar(5), core.blood_type || null);
    request.input("kartu_keluarga_no", sql.NVarChar(50), core.kartu_keluarga_no || null);
    request.input("ktp_no", sql.NVarChar(50), core.ktp_no || null);
    request.input("npwp", sql.NVarChar(30), core.npwp || null);
    request.input("tax_status", sql.NVarChar(20), core.tax_status || null);
    request.input("education", sql.NVarChar(100), core.education || null);
    request.input("imip_id", sql.NVarChar(50), core.imip_id || null);
    request.input("branch", sql.NVarChar(50), core.branch || null);
    request.input("branch_id", sql.NVarChar(50), core.branch_id || null);
    request.input("office_email", sql.NVarChar(255), core.office_email || null);
    const idCardVal =
      core.id_card_mti === true ? 1 :
      core.id_card_mti === false ? 0 : null;
    request.input("id_card_mti", sql.Bit, idCardVal);
    request.input("field", sql.NVarChar(100), (core.field ?? employment.field) || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_core WHERE employee_id = @employee_id)
        UPDATE dbo.employee_core
        SET name=@name, gender=@gender, place_of_birth=@place_of_birth, date_of_birth=@date_of_birth,
            marital_status=@marital_status, religion=@religion, nationality=@nationality, blood_type=@blood_type,
            kartu_keluarga_no=@kartu_keluarga_no, ktp_no=@ktp_no, npwp=@npwp, tax_status=@tax_status,
            education=@education, imip_id=@imip_id, branch=@branch, branch_id=@branch_id, office_email=@office_email, id_card_mti=@id_card_mti, field=@field
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_core (employee_id, name, gender, place_of_birth, date_of_birth, marital_status, religion, nationality, blood_type, kartu_keluarga_no, ktp_no, npwp, tax_status, education, imip_id, branch, branch_id, office_email, id_card_mti, field)
        VALUES (@employee_id, @name, @gender, @place_of_birth, @date_of_birth, @marital_status, @religion, @nationality, @blood_type, @kartu_keluarga_no, @ktp_no, @npwp, @tax_status, @education, @imip_id, @branch, @branch_id, @office_email, @id_card_mti, @field);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("phone_number", sql.NVarChar(50), contact.phone_number || null);
    request.input("email", sql.NVarChar(200), contact.email || null);
    request.input("address", sql.NVarChar(255), contact.address || null);
    request.input("city", sql.NVarChar(100), contact.city || null);
    request.input("spouse_name", sql.NVarChar(200), contact.spouse_name || null);
    request.input("child_name_1", sql.NVarChar(200), contact.child_name_1 || null);
    request.input("child_name_2", sql.NVarChar(200), contact.child_name_2 || null);
    request.input("child_name_3", sql.NVarChar(200), contact.child_name_3 || null);
    request.input("emergency_contact_name", sql.NVarChar(200), contact.emergency_contact_name || null);
    request.input("emergency_contact_phone", sql.NVarChar(50), contact.emergency_contact_phone || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_contact WHERE employee_id = @employee_id)
        UPDATE dbo.employee_contact
        SET phone_number=@phone_number, email=@email, address=@address, city=@city, spouse_name=@spouse_name,
            child_name_1=@child_name_1, child_name_2=@child_name_2, child_name_3=@child_name_3,
            emergency_contact_name=@emergency_contact_name, emergency_contact_phone=@emergency_contact_phone
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_contact (employee_id, phone_number, email, address, city, spouse_name, child_name_1, child_name_2, child_name_3, emergency_contact_name, emergency_contact_phone)
        VALUES (@employee_id, @phone_number, @email, @address, @city, @spouse_name, @child_name_1, @child_name_2, @child_name_3, @emergency_contact_name, @emergency_contact_phone);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("employment_status", sql.NVarChar(50), employment.employment_status || null);
    request.input("status", sql.NVarChar(50), employment.status || "Active");
    request.input("division", sql.NVarChar(100), employment.division || null);
    request.input("department", sql.NVarChar(100), employment.department || null);
    request.input("section", sql.NVarChar(100), employment.section || null);
    request.input("job_title", sql.NVarChar(100), employment.job_title || null);
    request.input("grade", sql.NVarChar(20), employment.grade || null);
    request.input("position_grade", sql.NVarChar(50), employment.position_grade || null);
    request.input("group_job_title", sql.NVarChar(100), employment.group_job_title || null);
    request.input("direct_report", sql.NVarChar(100), employment.direct_report || null);
    request.input("company_office", sql.NVarChar(100), employment.company_office || null);
    request.input("work_location", sql.NVarChar(100), employment.work_location || null);
    request.input("locality_status", sql.NVarChar(50), employment.locality_status || null);
    // branch and branch_id handled in employee_core above
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_employment WHERE employee_id = @employee_id)
        UPDATE dbo.employee_employment
        SET employment_status=@employment_status, status=@status, division=@division, department=@department, section=@section,
            job_title=@job_title, grade=@grade, position_grade=@position_grade, group_job_title=@group_job_title,
            direct_report=@direct_report, company_office=@company_office, work_location=@work_location,
            locality_status=@locality_status
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_employment (employee_id, employment_status, status, division, department, section, job_title, grade, position_grade, group_job_title, direct_report, company_office, work_location, locality_status)
        VALUES (@employee_id, @employment_status, @status, @division, @department, @section, @job_title, @grade, @position_grade, @group_job_title, @direct_report, @company_office, @work_location, @locality_status);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("point_of_hire", sql.NVarChar(100), onboard.point_of_hire || null);
    request.input("point_of_origin", sql.NVarChar(100), onboard.point_of_origin || null);
    request.input("schedule_type", sql.NVarChar(50), onboard.schedule_type || null);
    request.input("first_join_date_merdeka", sql.Date, parseDate(onboard.first_join_date_merdeka));
    request.input("transfer_merdeka", sql.Date, parseDate(onboard.transfer_merdeka));
    request.input("first_join_date", sql.Date, parseDate(onboard.first_join_date));
    request.input("join_date", sql.Date, parseDate(onboard.join_date));
    request.input("end_contract", sql.Date, parseDate(onboard.end_contract));
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_onboard WHERE employee_id = @employee_id)
        UPDATE dbo.employee_onboard
        SET point_of_hire=@point_of_hire, point_of_origin=@point_of_origin, schedule_type=@schedule_type,
            first_join_date_merdeka=@first_join_date_merdeka, transfer_merdeka=@transfer_merdeka,
            first_join_date=@first_join_date, join_date=@join_date, end_contract=@end_contract
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_onboard (employee_id, point_of_hire, point_of_origin, schedule_type, first_join_date_merdeka, transfer_merdeka, first_join_date, join_date, end_contract)
        VALUES (@employee_id, @point_of_hire, @point_of_origin, @schedule_type, @first_join_date_merdeka, @transfer_merdeka, @first_join_date, @join_date, @end_contract);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("bank_name", sql.NVarChar(100), bank.bank_name || null);
    request.input("account_name", sql.NVarChar(100), bank.account_name || null);
    request.input("account_no", sql.NVarChar(50), bank.account_no || null);
    request.input("bank_code", sql.NVarChar(50), bank.bank_code || null);
    request.input("icbc_bank_account_no", sql.NVarChar(50), bank.icbc_bank_account_no || null);
    request.input("icbc_username", sql.NVarChar(50), bank.icbc_username || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_bank WHERE employee_id = @employee_id)
        UPDATE dbo.employee_bank
        SET bank_name=@bank_name, account_name=@account_name, account_no=@account_no, bank_code=@bank_code,
            icbc_bank_account_no=@icbc_bank_account_no, icbc_username=@icbc_username
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_bank (employee_id, bank_name, account_name, account_no, bank_code, icbc_bank_account_no, icbc_username)
        VALUES (@employee_id, @bank_name, @account_name, @account_no, @bank_code, @icbc_bank_account_no, @icbc_username);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("bpjs_tk", sql.NVarChar(50), insurance.bpjs_tk || null);
    request.input("bpjs_kes", sql.NVarChar(50), insurance.bpjs_kes || null);
    request.input("status_bpjs_kes", sql.NVarChar(50), insurance.status_bpjs_kes || null);
    request.input("insurance_endorsement", sql.NVarChar(1), boolToYN(insurance.insurance_endorsement));
    request.input("insurance_owlexa", sql.NVarChar(1), boolToYN(insurance.insurance_owlexa));
    request.input("insurance_fpg", sql.NVarChar(1), boolToYN(insurance.insurance_fpg));
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_insurance WHERE employee_id = @employee_id)
        UPDATE dbo.employee_insurance
        SET bpjs_tk=@bpjs_tk, bpjs_kes=@bpjs_kes, status_bpjs_kes=@status_bpjs_kes,
            insurance_endorsement=@insurance_endorsement, insurance_owlexa=@insurance_owlexa, insurance_fpg=@insurance_fpg
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_insurance (employee_id, bpjs_tk, bpjs_kes, status_bpjs_kes, insurance_endorsement, insurance_owlexa, insurance_fpg)
        VALUES (@employee_id, @bpjs_tk, @bpjs_kes, @status_bpjs_kes, @insurance_endorsement, @insurance_owlexa, @insurance_fpg);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("passport_no", sql.NVarChar(50), travel.passport_no || null);
    request.input("name_as_passport", sql.NVarChar(100), travel.name_as_passport || null);
    request.input("passport_expiry", sql.Date, parseDate(travel.passport_expiry));
    request.input("kitas_no", sql.NVarChar(50), travel.kitas_no || null);
    request.input("kitas_expiry", sql.Date, parseDate(travel.kitas_expiry));
    request.input("kitas_address", sql.NVarChar(255), travel.kitas_address || null);
    request.input("imta", sql.NVarChar(50), travel.imta || null);
    request.input("rptka_no", sql.NVarChar(50), travel.rptka_no || null);
    request.input("rptka_position", sql.NVarChar(100), travel.rptka_position || null);
    request.input("job_title_kitas", sql.NVarChar(100), travel.job_title_kitas || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_travel WHERE employee_id = @employee_id)
        UPDATE dbo.employee_travel
        SET passport_no=@passport_no, name_as_passport=@name_as_passport, passport_expiry=@passport_expiry,
            kitas_no=@kitas_no, kitas_expiry=@kitas_expiry, kitas_address=@kitas_address, imta=@imta,
            rptka_no=@rptka_no, rptka_position=@rptka_position, job_title_kitas=@job_title_kitas
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_travel (employee_id, passport_no, name_as_passport, passport_expiry, kitas_no, kitas_expiry, kitas_address, imta, rptka_no, rptka_position, job_title_kitas)
        VALUES (@employee_id, @passport_no, @name_as_passport, @passport_expiry, @kitas_no, @kitas_expiry, @kitas_address, @imta, @rptka_no, @rptka_position, @job_title_kitas);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("paspor_checklist", sql.NVarChar(1), boolToYN(checklist.passport_checklist));
    request.input("kitas_checklist", sql.NVarChar(1), boolToYN(checklist.kitas_checklist));
    request.input("imta_checklist", sql.NVarChar(1), boolToYN(checklist.imta_checklist));
    request.input("rptka_checklist", sql.NVarChar(1), boolToYN(checklist.rptka_checklist));
    request.input("npwp_checklist", sql.NVarChar(1), boolToYN(checklist.npwp_checklist));
    request.input("bpjs_kes_checklist", sql.NVarChar(1), boolToYN(checklist.bpjs_kes_checklist));
    request.input("bpjs_tk_checklist", sql.NVarChar(1), boolToYN(checklist.bpjs_tk_checklist));
    request.input("bank_checklist", sql.NVarChar(1), boolToYN(checklist.bank_checklist));
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_checklist WHERE employee_id = @employee_id)
        UPDATE dbo.employee_checklist
        SET paspor_checklist=@paspor_checklist, kitas_checklist=@kitas_checklist, imta_checklist=@imta_checklist,
            rptka_checklist=@rptka_checklist, npwp_checklist=@npwp_checklist, bpjs_kes_checklist=@bpjs_kes_checklist,
            bpjs_tk_checklist=@bpjs_tk_checklist, bank_checklist=@bank_checklist
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_checklist (employee_id, paspor_checklist, kitas_checklist, imta_checklist, rptka_checklist, npwp_checklist, bpjs_kes_checklist, bpjs_tk_checklist, bank_checklist)
        VALUES (@employee_id, @paspor_checklist, @kitas_checklist, @imta_checklist, @rptka_checklist, @npwp_checklist, @bpjs_kes_checklist, @bpjs_tk_checklist, @bank_checklist);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("batch", sql.NVarChar(50), notes.batch || null);
    request.input("note", sql.NVarChar(sql.MAX), notes.note || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_notes WHERE employee_id = @employee_id)
        UPDATE dbo.employee_notes
        SET batch=@batch, note=@note
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_notes (employee_id, batch, note)
        VALUES (@employee_id, @batch, @note);
    `);
    await trx.commit();
    return res.json({ ok: true, employee_id: id });
  } catch (err: unknown) {
    await trx.rollback();
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_EMPLOYEE";
    const details = extractDbErrorDetails(err);
    console.error("employees.post.error", { id, message, details });
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

employeesRouter.post("/import", async (req, res) => {
  interface ImportEmployeeRow {
    employee_id: string;
    name?: string | null;
    gender?: string | null;
    nationality?: string | null;
    employment_status?: string | null;
    department?: string | null;
    job_title?: string | null;
    join_date?: string | Date | null;
  }
  const rows: ImportEmployeeRow[] = Array.isArray(req.body) ? req.body : [];
  if (!rows.length) return res.status(400).json({ error: "NO_ROWS" });
  const pool = getPool();
  const conn = await pool.connect();
  let success = 0;
  let failed = 0;
  for (const r of rows) {
    const trx = new sql.Transaction(conn);
    try {
      await trx.begin();
      const request = new sql.Request(trx);
      const id = String(r.employee_id || "").trim();
      if (!id) throw new Error("EMPLOYEE_ID_REQUIRED");
      request.input("employee_id", sql.VarChar(100), id);
      request.input("name", sql.NVarChar(200), r.name || null);
      request.input("gender", sql.Char(1), genderToCode(r.gender));
      request.input("nationality", sql.NVarChar(100), r.nationality || null);
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.employee_core WHERE employee_id = @employee_id)
          UPDATE dbo.employee_core SET name=@name, gender=@gender, nationality=@nationality WHERE employee_id=@employee_id
        ELSE
          INSERT INTO dbo.employee_core (employee_id, name, gender, nationality) VALUES (@employee_id, @name, @gender, @nationality);
      `);
      request.parameters = {};
      request.input("employee_id", sql.VarChar(100), id);
      request.input("employment_status", sql.NVarChar(50), r.employment_status || null);
      request.input("department", sql.NVarChar(100), r.department || null);
      request.input("job_title", sql.NVarChar(100), r.job_title || null);
      request.input("join_date", sql.Date, r.join_date || null);
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.employee_employment WHERE employee_id = @employee_id)
          UPDATE dbo.employee_employment SET employment_status=@employment_status, department=@department, job_title=@job_title WHERE employee_id=@employee_id
        ELSE
          INSERT INTO dbo.employee_employment (employee_id, employment_status, department, job_title) VALUES (@employee_id, @employment_status, @department, @job_title);
      `);
      request.parameters = {};
      request.input("employee_id", sql.VarChar(100), id);
      request.input("join_date", sql.Date, r.join_date || null);
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.employee_onboard WHERE employee_id = @employee_id)
          UPDATE dbo.employee_onboard SET join_date=@join_date WHERE employee_id=@employee_id
        ELSE
          INSERT INTO dbo.employee_onboard (employee_id, join_date) VALUES (@employee_id, @join_date);
      `);
      await trx.commit();
      success += 1;
    } catch {
      await trx.rollback();
      failed += 1;
    }
  }
  await pool.close();
  return res.json({ ok: true, success, failed, total: rows.length });
});

  employeesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const pool = getPool();
  try {
    await pool.connect();
    const rolesRaw = req.user?.roles || [];
    const rolesNorm = rolesRaw.map((r) => normalizeRoleName(String(r)));
    const isDepRep = rolesNorm.includes("department_rep");
    let userDept: string | null = null;
    if (isDepRep) {
      const deptReq = new sql.Request(pool);
      deptReq.input("username", sql.VarChar(50), String(req.user?.username || ""));
      const deptRes = await deptReq.query(`
        SELECT TOP 1 department
        FROM dbo.login
        WHERE username = @username
      `);
      const deptRow = (deptRes.recordset || [])[0] as { department?: unknown } | undefined;
      const d = String(deptRow?.department || "").trim();
      if (!d) return res.status(403).json({ error: "DEPARTMENT_NOT_SET_FOR_USER" });
      userDept = d;
    }
    const request = new sql.Request(pool);
    request.input("id", sql.VarChar(100), id);
    if (isDepRep && userDept) request.input("department", sql.NVarChar(100), userDept);
    const extraWhere = isDepRep ? " AND emp.department IS NOT NULL AND LTRIM(RTRIM(emp.department)) <> '' AND LOWER(emp.department) = LOWER(@department)" : "";
      const result = await request.query<EmployeeDetailRow>(`
        SELECT
          core.employee_id, core.name, core.gender, core.place_of_birth, core.date_of_birth, core.marital_status,
          core.religion, core.nationality, core.blood_type, core.kartu_keluarga_no, core.ktp_no, core.npwp,
          core.tax_status, core.education, core.office_email, core.branch, core.branch_id, core.imip_id, core.id_card_mti, core.field,
          contact.phone_number, contact.email, contact.address, contact.city,
          contact.spouse_name, contact.child_name_1, contact.child_name_2, contact.child_name_3,
          contact.emergency_contact_name, contact.emergency_contact_phone,
          emp.employment_status, emp.status, emp.division, emp.department, emp.section, emp.job_title,
          emp.grade, emp.position_grade, emp.group_job_title, emp.direct_report, emp.company_office,
        emp.work_location, emp.locality_status, emp.terminated_date, emp.terminated_type, emp.terminated_reason, emp.blacklist_mti, emp.blacklist_imip,
        onboard.point_of_hire, onboard.point_of_origin, onboard.schedule_type, onboard.first_join_date_merdeka,
        onboard.transfer_merdeka, onboard.first_join_date, onboard.join_date, onboard.end_contract, onboard.years_in_service,
        bank.bank_name, bank.account_name, bank.account_no, bank.bank_code, bank.icbc_bank_account_no, bank.icbc_username,
        ins.insurance_endorsement, ins.insurance_owlexa, ins.insurance_fpg, ins.fpg_no, ins.owlexa_no,
        ins.bpjs_tk, ins.bpjs_kes, ins.status_bpjs_kes, ins.social_insurance_no_alt, ins.bpjs_kes_no_alt,
        travel.passport_no, travel.name_as_passport, travel.passport_expiry, travel.kitas_no, travel.kitas_expiry,
        travel.kitas_address, travel.imta, travel.rptka_no, travel.rptka_position, travel.job_title_kitas,
        travel.travel_in, travel.travel_out,
        checklist.paspor_checklist, checklist.kitas_checklist, checklist.imta_checklist, checklist.rptka_checklist,
        checklist.npwp_checklist, checklist.bpjs_kes_checklist, checklist.bpjs_tk_checklist, checklist.bank_checklist,
        notes.batch, notes.note
      FROM dbo.employee_core AS core
      LEFT JOIN dbo.employee_contact AS contact ON contact.employee_id = core.employee_id
      LEFT JOIN dbo.employee_employment AS emp ON emp.employee_id = core.employee_id
      LEFT JOIN dbo.employee_onboard AS onboard ON onboard.employee_id = core.employee_id
      LEFT JOIN dbo.employee_bank AS bank ON bank.employee_id = core.employee_id
      LEFT JOIN dbo.employee_insurance AS ins ON ins.employee_id = core.employee_id
      LEFT JOIN dbo.employee_travel AS travel ON travel.employee_id = core.employee_id
      LEFT JOIN dbo.employee_checklist AS checklist ON checklist.employee_id = core.employee_id
      LEFT JOIN dbo.employee_notes AS notes ON notes.employee_id = core.employee_id
      WHERE core.employee_id = @id${extraWhere};
    `);
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ error: "EMPLOYEE_NOT_FOUND" });
    }
    const r: EmployeeDetailRow = result.recordset[0];
    const payload = {
      core: {
        employee_id: r.employee_id,
        name: r.name,
        gender: r.gender,
        place_of_birth: r.place_of_birth,
        date_of_birth: r.date_of_birth,
        marital_status: r.marital_status,
        religion: r.religion,
        nationality: r.nationality,
        blood_type: r.blood_type,
        kartu_keluarga_no: r.kartu_keluarga_no,
        ktp_no: r.ktp_no,
        npwp: r.npwp,
        tax_status: r.tax_status,
        education: r.education,
        office_email: r.office_email,
        branch: r.branch,
        branch_id: r.branch_id,
        imip_id: r.imip_id,
        id_card_mti: r.id_card_mti,
        field: r.field,
      },
      contact: {
        phone_number: r.phone_number,
        email: r.email,
        address: r.address,
        city: r.city,
        spouse_name: r.spouse_name,
        child_name_1: r.child_name_1,
        child_name_2: r.child_name_2,
        child_name_3: r.child_name_3,
        emergency_contact_name: r.emergency_contact_name,
        emergency_contact_phone: r.emergency_contact_phone,
      },
      employment: {
        employment_status: r.employment_status,
        status: r.status,
        division: r.division,
        department: r.department,
        section: r.section,
        job_title: r.job_title,
        grade: r.grade,
        position_grade: r.position_grade,
        group_job_title: r.group_job_title,
        direct_report: r.direct_report,
        company_office: r.company_office,
        work_location: r.work_location,
        locality_status: r.locality_status,
        terminated_date: r.terminated_date,
        terminated_type: r.terminated_type,
        terminated_reason: r.terminated_reason,
        blacklist_mti: r.blacklist_mti,
        blacklist_imip: r.blacklist_imip,
      },
      onboard: {
        point_of_hire: r.point_of_hire,
        point_of_origin: r.point_of_origin,
        schedule_type: r.schedule_type,
        first_join_date_merdeka: r.first_join_date_merdeka,
        transfer_merdeka: r.transfer_merdeka,
        first_join_date: r.first_join_date,
        join_date: r.join_date,
        end_contract: r.end_contract,
        years_in_service: r.years_in_service,
      },
      bank: {
        bank_name: r.bank_name,
        account_name: r.account_name,
        account_no: r.account_no,
        bank_code: r.bank_code,
        icbc_bank_account_no: r.icbc_bank_account_no,
        icbc_username: r.icbc_username,
      },
      insurance: {
        insurance_endorsement: r.insurance_endorsement,
        insurance_owlexa: r.insurance_owlexa,
        insurance_fpg: r.insurance_fpg,
        fpg_no: r.fpg_no,
        owlexa_no: r.owlexa_no,
        bpjs_tk: r.bpjs_tk,
        bpjs_kes: r.bpjs_kes,
        status_bpjs_kes: r.status_bpjs_kes,
        social_insurance_no_alt: r.social_insurance_no_alt,
        bpjs_kes_no_alt: r.bpjs_kes_no_alt,
      },
      travel: {
        passport_no: r.passport_no,
        name_as_passport: r.name_as_passport,
        passport_expiry: r.passport_expiry,
        kitas_no: r.kitas_no,
        kitas_expiry: r.kitas_expiry,
        kitas_address: r.kitas_address,
        imta: r.imta,
        rptka_no: r.rptka_no,
        rptka_position: r.rptka_position,
        job_title_kitas: r.job_title_kitas,
        travel_in: r.travel_in,
        travel_out: r.travel_out,
      },
      checklist: {
        // Transform DB 'paspor_checklist' -> frontend 'passport_checklist'
        passport_checklist: r.paspor_checklist,
        kitas_checklist: r.kitas_checklist,
        imta_checklist: r.imta_checklist,
        rptka_checklist: r.rptka_checklist,
        npwp_checklist: r.npwp_checklist,
        bpjs_kes_checklist: r.bpjs_kes_checklist,
        bpjs_tk_checklist: r.bpjs_tk_checklist,
        bank_checklist: r.bank_checklist,
      },
      notes: {
        batch: r.batch,
        note: r.note,
      },
      type: (String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expat") as "indonesia" | "expat",
    };
    const rolesRaw2 = req.user?.roles || [];
    const roles = rolesRaw2.map((r) => normalizeRoleName(r));
    const allowed = new Set<string>();
    for (const role of roles) for (const s of Array.from(readSectionsFor(role))) allowed.add(s);
    try {
      const req1 = new sql.Request(pool);
      const res1 = await req1.query(`
        SELECT [role], [section], [can_read], [can_view]
        FROM dbo.role_column_access
      `);
      const rows1 = (res1.recordset || []) as Array<{ role?: unknown; section?: unknown; can_read?: unknown; can_view?: unknown }>;
      for (const r1 of rows1) {
        const role1 = normalizeRoleName(String(r1.role || ""));
        if (!roles.includes(role1)) continue;
        const canRead = Number(r1.can_read) === 1 || r1.can_read === true || Number(r1.can_view) === 1 || r1.can_view === true;
        if (!canRead) continue;
        const sec = canonicalSectionKey(String(r1.section || ""));
        if (sec) allowed.add(sec);
      }
    } catch {}
    try {
      const req2 = new sql.Request(pool);
      const res2 = await req2.query(`
        SELECT
          COALESCE(r.[role], r.[name], r.[role_name], r.[role_display_name]) AS role_text,
          COALESCE(cc.[table_name], cc.[table]) AS table_name,
          COALESCE(rca.[can_read], rca.[can_view]) AS can_read
        FROM dbo.role_column_access AS rca
        LEFT JOIN dbo.roles AS r ON r.[role_id] = rca.[role_id]
        LEFT JOIN dbo.column_catalog AS cc ON cc.[column_id] = rca.[column_id]
      `);
      const rows2 = (res2.recordset || []) as Array<{ role_text?: unknown; table_name?: unknown; can_read?: unknown }>;
      for (const r2 of rows2) {
        const role2 = normalizeRoleName(String(r2.role_text || ""));
        if (!roles.includes(role2)) continue;
        const canRead2 = Number(r2.can_read) === 1 || r2.can_read === true;
        if (!canRead2) continue;
        const sec2 = canonicalSectionKey(String(r2.table_name || ""));
        if (sec2) allowed.add(sec2);
      }
    } catch {}
    const filtered: Record<string, unknown> = {};
    for (const k of Object.keys(payload as Record<string, unknown>)) {
      if (allowed.has(k)) (filtered as Record<string, unknown>)[k] = (payload as Record<string, unknown>)[k];
    }
    return res.json(filtered);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_EMPLOYEE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
