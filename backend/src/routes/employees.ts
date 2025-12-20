import { Router } from "express";
import sql from "mssql";
import { CONFIG } from "../config";

export const employeesRouter = Router();

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
employeesRouter.get("/", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    const result = await request.query(`
      SELECT core.employee_id,
             core.name,
             core.nationality,
             emp.department,
             emp.status
      FROM dbo.employee_core AS core
      LEFT JOIN dbo.employee_employment AS emp ON emp.employee_id = core.employee_id
      ORDER BY core.employee_id
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `);
    const rows = result.recordset || [];
    const data = rows.map((r: any) => ({
      core: {
        employee_id: r.employee_id,
        name: r.name,
        nationality: r.nationality,
      },
      employment: {
        department: r.department,
        status: r.status,
      },
      type: (String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expatriate") as "indonesia" | "expatriate",
    }));
    return res.json({ items: data, paging: { limit, offset, count: data.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_EMPLOYEES";
    return res.status(500).json({ error: message });
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
    request.input("employee_id", sql.VarChar(100), id);
    request.input("name", sql.NVarChar(200), body.name || null);
    request.input("gender", sql.Char(1), genderToCode(body.gender));
    request.input("place_of_birth", sql.NVarChar(100), body.place_of_birth || null);
    request.input("date_of_birth", sql.Date, body.date_of_birth || null);
    request.input("marital_status", sql.NVarChar(50), body.marital_status || null);
    request.input("religion", sql.NVarChar(50), body.religion || null);
    request.input("nationality", sql.NVarChar(100), body.nationality || null);
    request.input("blood_type", sql.NVarChar(5), body.blood_type || null);
    request.input("kartu_keluarga_no", sql.NVarChar(50), body.kartu_keluarga_no || null);
    request.input("ktp_no", sql.NVarChar(50), body.ktp_no || null);
    request.input("npwp", sql.NVarChar(30), body.npwp || null);
    request.input("tax_status", sql.NVarChar(20), body.tax_status || null);
    request.input("education", sql.NVarChar(100), body.education || null);
    request.input("imip_id", sql.NVarChar(50), body.imip_id || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_core WHERE employee_id = @employee_id)
        UPDATE dbo.employee_core
        SET name=@name, gender=@gender, place_of_birth=@place_of_birth, date_of_birth=@date_of_birth,
            marital_status=@marital_status, religion=@religion, nationality=@nationality, blood_type=@blood_type,
            kartu_keluarga_no=@kartu_keluarga_no, ktp_no=@ktp_no, npwp=@npwp, tax_status=@tax_status,
            education=@education, imip_id=@imip_id
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_core (employee_id, name, gender, place_of_birth, date_of_birth, marital_status, religion, nationality, blood_type, kartu_keluarga_no, ktp_no, npwp, tax_status, education, imip_id)
        VALUES (@employee_id, @name, @gender, @place_of_birth, @date_of_birth, @marital_status, @religion, @nationality, @blood_type, @kartu_keluarga_no, @ktp_no, @npwp, @tax_status, @education, @imip_id);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("phone_number", sql.NVarChar(50), body.phone_number || null);
    request.input("email", sql.NVarChar(200), body.email || null);
    request.input("address", sql.NVarChar(255), body.address || null);
    request.input("city", sql.NVarChar(100), body.city || null);
    request.input("spouse_name", sql.NVarChar(200), body.spouse_name || null);
    request.input("child_name_1", sql.NVarChar(200), body.child_name_1 || null);
    request.input("child_name_2", sql.NVarChar(200), body.child_name_2 || null);
    request.input("child_name_3", sql.NVarChar(200), body.child_name_3 || null);
    request.input("emergency_contact_name", sql.NVarChar(200), body.emergency_contact_name || null);
    request.input("emergency_contact_phone", sql.NVarChar(50), body.emergency_contact_phone || null);
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
    request.input("employment_status", sql.NVarChar(50), body.employment_status || null);
    request.input("status", sql.NVarChar(50), body.status || "Active");
    request.input("division", sql.NVarChar(100), body.division || null);
    request.input("department", sql.NVarChar(100), body.department || null);
    request.input("section", sql.NVarChar(100), body.section || null);
    request.input("job_title", sql.NVarChar(100), body.job_title || null);
    request.input("grade", sql.NVarChar(20), body.grade || null);
    request.input("position_grade", sql.NVarChar(50), body.position_grade || null);
    request.input("group_job_title", sql.NVarChar(100), body.group_job_title || null);
    request.input("direct_report", sql.NVarChar(100), body.direct_report || null);
    request.input("company_office", sql.NVarChar(100), body.company_office || null);
    request.input("work_location", sql.NVarChar(100), body.work_location || null);
    request.input("locality_status", sql.NVarChar(50), body.locality_status || null);
    request.input("branch", sql.NVarChar(50), body.branch || null);
    request.input("branch_id", sql.NVarChar(50), body.branch_id || null);
    request.input("field", sql.NVarChar(100), body.field || null);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.employee_employment WHERE employee_id = @employee_id)
        UPDATE dbo.employee_employment
        SET employment_status=@employment_status, status=@status, division=@division, department=@department, section=@section,
            job_title=@job_title, grade=@grade, position_grade=@position_grade, group_job_title=@group_job_title,
            direct_report=@direct_report, company_office=@company_office, work_location=@work_location,
            locality_status=@locality_status, branch=@branch, branch_id=@branch_id, field=@field
        WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.employee_employment (employee_id, employment_status, status, division, department, section, job_title, grade, position_grade, group_job_title, direct_report, company_office, work_location, locality_status, branch, branch_id, field)
        VALUES (@employee_id, @employment_status, @status, @division, @department, @section, @job_title, @grade, @position_grade, @group_job_title, @direct_report, @company_office, @work_location, @locality_status, @branch, @branch_id, @field);
    `);
    request.parameters = {};
    request.input("employee_id", sql.VarChar(100), id);
    request.input("point_of_hire", sql.NVarChar(100), body.point_of_hire || null);
    request.input("point_of_origin", sql.NVarChar(100), body.point_of_origin || null);
    request.input("schedule_type", sql.NVarChar(50), body.schedule_type || null);
    request.input("first_join_date_merdeka", sql.Date, body.first_join_date_merdeka || null);
    request.input("transfer_merdeka", sql.Date, body.transfer_merdeka || null);
    request.input("first_join_date", sql.Date, body.first_join_date || null);
    request.input("join_date", sql.Date, body.join_date || null);
    request.input("end_contract", sql.Date, body.end_contract || null);
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
    request.input("bank_name", sql.NVarChar(100), body.bank_name || null);
    request.input("account_name", sql.NVarChar(100), body.account_name || null);
    request.input("account_no", sql.NVarChar(50), body.account_no || null);
    request.input("bank_code", sql.NVarChar(50), body.bank_code || null);
    request.input("icbc_bank_account_no", sql.NVarChar(50), body.icbc_bank_account_no || null);
    request.input("icbc_username", sql.NVarChar(50), body.icbc_username || null);
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
    request.input("bpjs_tk", sql.NVarChar(50), body.bpjs_tk || null);
    request.input("bpjs_kes", sql.NVarChar(50), body.bpjs_kes || null);
    request.input("status_bpjs_kes", sql.NVarChar(50), body.status_bpjs_kes || null);
    request.input("insurance_endorsement", sql.NVarChar(1), boolToYN(body.insurance_endorsement));
    request.input("insurance_owlexa", sql.NVarChar(1), boolToYN(body.insurance_owlexa));
    request.input("insurance_fpg", sql.NVarChar(1), boolToYN(body.insurance_fpg));
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
    request.input("passport_no", sql.NVarChar(50), body.passport_no || null);
    request.input("name_as_passport", sql.NVarChar(100), body.name_as_passport || null);
    request.input("passport_expiry", sql.Date, body.passport_expiry || null);
    request.input("kitas_no", sql.NVarChar(50), body.kitas_no || null);
    request.input("kitas_expiry", sql.Date, body.kitas_expiry || null);
    request.input("kitas_address", sql.NVarChar(255), body.kitas_address || null);
    request.input("imta", sql.NVarChar(50), body.imta || null);
    request.input("rptka_no", sql.NVarChar(50), body.rptka_no || null);
    request.input("rptka_position", sql.NVarChar(100), body.rptka_position || null);
    request.input("job_title_kitas", sql.NVarChar(100), body.job_title_kitas || null);
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
    await trx.commit();
    return res.json({ ok: true, employee_id: id });
  } catch (err: unknown) {
    await trx.rollback();
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_EMPLOYEE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

employeesRouter.post("/import", async (req, res) => {
  const rows: any[] = Array.isArray(req.body) ? req.body : [];
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
    const request = new sql.Request(pool);
    request.input("id", sql.VarChar(100), id);
    const result = await request.query(`
      SELECT
        core.employee_id, core.name, core.gender, core.place_of_birth, core.date_of_birth, core.marital_status,
        core.religion, core.nationality, core.blood_type, core.kartu_keluarga_no, core.ktp_no, core.npwp,
        core.tax_status, core.education, core.office_email, core.branch, core.branch_id, core.imip_id,
        contact.phone_number, contact.email, contact.address, contact.city,
        contact.spouse_name, contact.child_name_1, contact.child_name_2, contact.child_name_3,
        contact.emergency_contact_name, contact.emergency_contact_phone,
        emp.employment_status, emp.status, emp.division, emp.department, emp.section, emp.job_title,
        emp.grade, emp.position_grade, emp.group_job_title, emp.direct_report, emp.company_office,
        emp.work_location, emp.locality_status, emp.terminated_date, emp.terminated_type, emp.terminated_reason,
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
      WHERE core.employee_id = @id;
    `);
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ error: "EMPLOYEE_NOT_FOUND" });
    }
    const r: any = result.recordset[0];
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
      type: (String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expatriate") as "indonesia" | "expatriate",
    };
    return res.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_EMPLOYEE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
