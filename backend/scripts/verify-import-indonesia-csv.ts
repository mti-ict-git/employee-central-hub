import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

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

function isoDate(d: unknown): string | null {
  if (!d) return null;
  const s = String(d);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function normStatus(v: string): string | null {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "non_active" || s === "nonactive") return "inactive";
  if (s === "resigned") return "resign";
  return s;
}

function normGender(v: string): string | null {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return null;
  if (s === "male") return "M";
  if (s === "female") return "F";
  return s.toUpperCase();
}

async function run() {
  const port = parseInt(process.env.BACKEND_PORT || process.env.SERVER_PORT || "8083", 10);
  const base = `http://localhost:${port}`;
  const token = jwt.sign({ sub: "verify", username: "smoke_admin", roles: ["admin"] }, String(process.env.JWT_SECRET), {
    expiresIn: "10m",
  });
  const headers = { Authorization: `Bearer ${token}` };

  const csvPath = path.resolve(process.cwd(), "../public/import_indonesia.csv");
  const { header, rows } = parseCSV(csvPath);

  // Mapping from CSV column to API payload path
  const pathMap: Record<string, string> = {
    employee_id: "core.employee_id",
    imip_id: "core.imip_id",
    name: "core.name",
    gender: "core.gender",
    place_of_birth: "core.place_of_birth",
    date_of_birth: "core.date_of_birth",
    marital_status: "core.marital_status",
    tax_status: "core.tax_status",
    religion: "core.religion",
    nationality: "core.nationality",
    blood_type: "core.blood_type",
    education: "core.education",
    ktp_no: "core.ktp_no",
    kartu_keluarga_no: "core.kartu_keluarga_no",
    npwp: "core.npwp",
    phone_number: "contact.phone_number",
    address: "contact.address",
    city: "contact.city",
    spouse_name: "contact.spouse_name",
    child_name_1: "contact.child_name_1",
    child_name_2: "contact.child_name_2",
    child_name_3: "contact.child_name_3",
    emergency_contact_name: "contact.emergency_contact_name",
    emergency_contact_phone: "contact.emergency_contact_phone",
    employment_status: "employment.employment_status",
    status: "employment.status",
    branch: "core.branch",
    branch_id: "core.branch_id",
    company_office: "employment.company_office",
    work_location: "employment.work_location",
    division: "employment.division",
    department: "employment.department",
    section: "employment.section",
    job_title: "employment.job_title",
    grade: "employment.grade",
    position_grade: "employment.position_grade",
    group_job_title: "employment.group_job_title",
    direct_report: "employment.direct_report",
    locality_status: "employment.locality_status",
    point_of_hire: "onboard.point_of_hire",
    point_of_origin: "onboard.point_of_origin",
    schedule_type: "onboard.schedule_type",
    travel_in: "travel.travel_in",
    travel_out: "travel.travel_out",
    first_join_date_merdeka: "onboard.first_join_date_merdeka",
    transfer_merdeka: "onboard.transfer_merdeka",
    first_join_date: "onboard.first_join_date",
    join_date: "onboard.join_date",
    end_contract: "onboard.end_contract",
    office_email: "core.office_email",
    email: "contact.email",
    id_card_mti: "core.id_card_mti",
    bank_name: "bank.bank_name",
    account_name: "bank.account_name",
    account_no: "bank.account_no",
    bpjs_tk: "insurance.bpjs_tk",
    bpjs_kes: "insurance.bpjs_kes",
    status_bpjs_kes: "insurance.status_bpjs_kes",
    social_insurance_no_alt: "insurance.social_insurance_no_alt",
    bpjs_kes_no_alt: "insurance.bpjs_kes_no_alt",
    insurance_endorsement: "insurance.insurance_endorsement",
    insurance_owlexa: "insurance.insurance_owlexa",
    insurance_fpg: "insurance.insurance_fpg",
    fpg_no: "insurance.fpg_no",
    owlexa_no: "insurance.owlexa_no",
    terminated_type: "employment.terminated_type",
    terminated_date: "employment.terminated_date",
    terminated_reason: "employment.terminated_reason",
    blacklist_mti: "employment.blacklist_mti",
    blacklist_imip: "employment.blacklist_imip",
  };

  function get(obj: any, path: string): any {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  const report: Array<{
    employee_id: string;
    ok: boolean;
    mismatches: Array<{ column: string; csv: string; api: any }>;
    missing: string[];
  }> = [];

  for (const row of rows) {
    const id = row["employee_id"];
    const res = await fetch(`${base}/api/employees/${encodeURIComponent(id)}`, { headers });
    if (!res.ok) {
      report.push({ employee_id: id, ok: false, mismatches: [], missing: [`HTTP_${res.status}`] });
      continue;
    }
    const api = await res.json();
    const mismatches: Array<{ column: string; csv: string; api: any }> = [];
    const missing: string[] = [];
    for (const col of header) {
      const csvVal = (row[col] || "").trim();
      const pathKey = pathMap[col];
      if (!pathKey) continue;
      let apiVal = get(api, pathKey);
      // Normalize for comparison
      if (col === "gender") apiVal = apiVal ?? null, apiVal = apiVal ? String(apiVal) : null, apiVal = apiVal ? apiVal.toUpperCase() : null, apiVal = apiVal === "M" || apiVal === "F" ? apiVal : apiVal;
      if (col === "date_of_birth" || col === "first_join_date_merdeka" || col === "transfer_merdeka" || col === "first_join_date" || col === "join_date" || col === "end_contract" || col === "terminated_date") {
        apiVal = isoDate(apiVal);
      }
      if (col === "status") apiVal = normStatus(apiVal || "") || apiVal;
      if (col === "gender") {
        apiVal = apiVal ? String(apiVal) : null;
        const ng = normGender(csvVal);
        if (ng && apiVal !== ng) mismatches.push({ column: col, csv: csvVal, api: apiVal });
        continue;
      }
      if (csvVal === "") {
        if (apiVal === null || apiVal === undefined || apiVal === "") continue;
        // CSV empty but API has value — not a failure for import verification
        continue;
      }
      const expected = col === "status" ? normStatus(csvVal) : col.endsWith("_date") || ["date_of_birth", "first_join_date_merdeka", "transfer_merdeka", "first_join_date", "join_date", "end_contract"].includes(col) ? isoDate(csvVal) : csvVal;
      const got = apiVal === null || apiVal === undefined ? null : apiVal;
      if (expected === null) {
        if (got !== null) mismatches.push({ column: col, csv: csvVal, api: got });
      } else if (String(got) !== String(expected)) {
        mismatches.push({ column: col, csv: String(expected), api: got });
      }
      if (got === null) missing.push(col);
    }
    report.push({ employee_id: id, ok: mismatches.length === 0, mismatches, missing });
  }

  console.log(JSON.stringify({ summary: { total: report.length, ok: report.filter(r => r.ok).length, failed: report.filter(r => !r.ok).length }, report }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
