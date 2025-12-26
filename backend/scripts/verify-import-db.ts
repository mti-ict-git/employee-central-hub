import fs from "fs";
import path from "path";
import { CONFIG } from "../src/config";
import sql from "mssql";

type CsvRow = Record<string, string>;

function parseCSV(filePath: string): { header: string[]; rows: CsvRow[] } {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const lines = raw.split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const r: CsvRow = {};
    for (let i = 0; i < header.length; i++) r[header[i]] = (cols[i] || "").trim();
    return r;
  });
  return { header, rows };
}

async function getPool() {
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
  }).connect();
}

async function run() {
  const csvPath = path.resolve(process.cwd(), "../public/import_indonesia.csv");
  const { header, rows } = parseCSV(csvPath);
  const pool = await getPool();
  const out: any[] = [];
  for (const row of rows) {
    const id = row["employee_id"];
    const req = new sql.Request(pool);
    req.input("id", sql.VarChar(100), id);
    const res = await req.query(`
      SELECT
        core.*, contact.*, emp.*, onboard.*, bank.*, ins.*, travel.*
      FROM dbo.employee_core AS core
      LEFT JOIN dbo.employee_contact AS contact ON contact.employee_id = core.employee_id
      LEFT JOIN dbo.employee_employment AS emp ON emp.employee_id = core.employee_id
      LEFT JOIN dbo.employee_onboard AS onboard ON onboard.employee_id = core.employee_id
      LEFT JOIN dbo.employee_bank AS bank ON bank.employee_id = core.employee_id
      LEFT JOIN dbo.employee_insurance AS ins ON ins.employee_id = core.employee_id
      LEFT JOIN dbo.employee_travel AS travel ON travel.employee_id = core.employee_id
      WHERE core.employee_id = @id
    `);
    const rec = (res.recordset || [])[0] || null;
    if (!rec) {
      out.push({ employee_id: id, ok: false, error: "NOT_FOUND" });
      continue;
    }
    const mismatches: Array<{ column: string; csv: string; db: any }> = [];
    function cmp(col: string, dbCol: string, map?: (v: any) => any) {
      const csvVal = (row[col] || "").trim();
      const dbVal = map ? map(rec[dbCol]) : rec[dbCol];
      if (!csvVal) return;
      if (String(csvVal) !== String(dbVal ?? "")) mismatches.push({ column: col, csv: csvVal, db: dbVal });
    }
    cmp("name", "name");
    cmp("gender", "gender", (v) => v);
    cmp("place_of_birth", "place_of_birth");
    cmp("date_of_birth", "date_of_birth", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("marital_status", "marital_status");
    cmp("tax_status", "tax_status");
    cmp("religion", "religion");
    cmp("nationality", "nationality");
    cmp("blood_type", "blood_type");
    cmp("education", "education");
    cmp("ktp_no", "ktp_no");
    cmp("kartu_keluarga_no", "kartu_keluarga_no");
    cmp("npwp", "npwp");
    cmp("office_email", "office_email");
    cmp("branch", "branch");
    cmp("branch_id", "branch_id");
    cmp("employment_status", "employment_status");
    cmp("status", "status");
    cmp("division", "division");
    cmp("department", "department");
    cmp("section", "section");
    cmp("job_title", "job_title");
    cmp("grade", "grade");
    cmp("position_grade", "position_grade");
    cmp("group_job_title", "group_job_title");
    cmp("direct_report", "direct_report");
    cmp("company_office", "company_office");
    cmp("work_location", "work_location");
    cmp("locality_status", "locality_status");
    cmp("point_of_hire", "point_of_hire");
    cmp("point_of_origin", "point_of_origin");
    cmp("schedule_type", "schedule_type");
    cmp("first_join_date_merdeka", "first_join_date_merdeka", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("transfer_merdeka", "transfer_merdeka", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("first_join_date", "first_join_date", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("join_date", "join_date", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("end_contract", "end_contract", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("phone_number", "phone_number");
    cmp("email", "email");
    cmp("address", "address");
    cmp("city", "city");
    cmp("bank_name", "bank_name");
    cmp("account_name", "account_name");
    cmp("account_no", "account_no");
    cmp("bpjs_tk", "bpjs_tk");
    cmp("bpjs_kes", "bpjs_kes");
    cmp("status_bpjs_kes", "status_bpjs_kes");
    cmp("social_insurance_no_alt", "social_insurance_no_alt");
    cmp("bpjs_kes_no_alt", "bpjs_kes_no_alt");
    cmp("travel_in", "travel_in", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    cmp("travel_out", "travel_out", (v) => v ? new Date(v).toISOString().slice(0, 10) : "");
    out.push({ employee_id: id, ok: mismatches.length === 0, mismatches });
  }
  await pool.close();
  console.log(JSON.stringify({ summary: { total: out.length, ok: out.filter(r => r.ok).length, failed: out.filter(r => !r.ok).length }, report: out }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
