import { Router } from "express";
import sql from "mssql";
import { CONFIG } from "../config";
import { authMiddleware } from "../middleware/auth";
import { can, readSectionsFor, writeSectionsFor } from "../policy";

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
    return next();
  }
  if (req.method === "DELETE") {
    if (roles.some((r) => can(r, "delete", "employees"))) return next();
    return res.status(403).json({ error: "FORBIDDEN_DELETE_EMPLOYEE" });
  }
  return next();
});

type WriteAccess = {
  canWriteColumn: (section: string, column: string) => boolean;
  hasColumnRule: (section: string, column: string) => boolean;
  hasAnyWriteAccess: boolean;
};

type ReadAccess = {
  canReadColumn: (section: string, column: string) => boolean;
  hasColumnRule: (section: string, column: string) => boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EMPLOYMENT_STATUS_ALLOWED = [
  "suspended",
  "retired",
  "terminated",
  "non_active",
  "intern",
  "contract",
  "probation",
  "active",
] as const;

type EmploymentStatusAllowed = (typeof EMPLOYMENT_STATUS_ALLOWED)[number];

function normalizeEmploymentStatus(raw: unknown): EmploymentStatusAllowed | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const lowered = String(raw).trim().toLowerCase();
  if (!lowered) return null;

  const canonical = lowered
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/__+/g, "_");

  const mapped = (() => {
    if (canonical === "internship") return "intern";
    if (canonical === "permanent") return "active";
    if (canonical === "inactive") return "non_active";
    return canonical;
  })();

  if ((EMPLOYMENT_STATUS_ALLOWED as readonly string[]).includes(mapped)) {
    return mapped as EmploymentStatusAllowed;
  }
  return null;
}

const STATUS_ALLOWED = ["active", "inactive", "resign", "terminated"] as const;
type StatusAllowed = (typeof STATUS_ALLOWED)[number];
function normalizeStatus(raw: unknown): StatusAllowed | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const canonical = s.replace(/\s+/g, "_").replace(/-+/g, "_").replace(/__+/g, "_");
  const mapped =
    canonical === "resigned" ? "resign" :
    canonical === "non_active" || canonical === "nonactive" || canonical === "inactive" ? "inactive" :
    canonical;
  if ((STATUS_ALLOWED as readonly string[]).includes(mapped)) return mapped as StatusAllowed;
  return null;
}

type DeniedTypeAccess = Record<string, Set<string>>;

async function loadTypeDeniedAccess(pool: sql.ConnectionPool, employeeType: "indonesia" | "expat"): Promise<DeniedTypeAccess> {
  const out: DeniedTypeAccess = {};
  const hasTableRes = await new sql.Request(pool).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'type_column_access'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0] as { ok?: unknown } | undefined);
  if (!hasTable) return out;
  const req = new sql.Request(pool);
  req.input("employee_type", sql.NVarChar(20), employeeType);
  const res = await req.query(`
    SELECT [section], [column], [accessible]
    FROM dbo.type_column_access
    WHERE [employee_type] = @employee_type
  `);
  const rows = (res.recordset || []) as Array<{ section?: unknown; column?: unknown; accessible?: unknown }>;
  for (const r of rows) {
    const sec = canonicalSectionKey(String(r.section || ""));
    const col = String(r.column || "").trim().toLowerCase();
    if (!sec || !col) continue;
    const accessible = r.accessible === true || r.accessible === 1;
    if (accessible) continue;
    if (!out[sec]) out[sec] = new Set<string>();
    out[sec].add(col);
  }
  return out;
}

async function buildWriteAccess(pool: sql.ConnectionPool, rolesRaw: string[]): Promise<WriteAccess> {
  const roles = rolesRaw.map((r) => normalizeRoleName(String(r)));
  const writeSections = new Set<string>();
  for (const role of roles) {
    for (const sec of writeSectionsFor(role)) writeSections.add(canonicalSectionKey(sec));
  }

  const seenWrite: Record<string, Set<string>> = {};
  const allowWrite: Record<string, Set<string>> = {};
  const request = new sql.Request(pool);
  const hasTableRes = await request.query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'role_column_access'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0] as { ok?: unknown } | undefined);
  if (hasTable && roles.length) {
    try {
      const rcaCols = await scanColumns(pool, "role_column_access");
      const hasTextSchema = rcaCols.has("role") && rcaCols.has("section") && rcaCols.has("column");
      const hasNormalized = rcaCols.has("role_id") && rcaCols.has("column_id");
      const writeExpr = (() => {
        const hasCanWrite = rcaCols.has("can_write");
        const hasCanEdit = rcaCols.has("can_edit");
        if (hasCanWrite && hasCanEdit) return "(CASE WHEN rca.[can_write]=1 OR rca.[can_edit]=1 THEN 1 ELSE 0 END)";
        if (hasCanWrite) return "rca.[can_write]";
        if (hasCanEdit) return "rca.[can_edit]";
        return null;
      })();
      if (writeExpr) {
        const roleAliases = (role: string): string[] => {
          if (role === "department_rep") return [role, "dep_rep"];
          return [role];
        };
        const queryRoles = Array.from(new Set(roles.flatMap((r) => roleAliases(r))));
        const roleParams = queryRoles.map((_, i) => `@role${i}`).join(", ");

        if (hasTextSchema) {
          const req2 = new sql.Request(pool);
          queryRoles.forEach((r, i) => {
            req2.input(`role${i}`, sql.NVarChar(50), String(r || "").trim().toLowerCase());
          });
          const rows = await req2.query(`
            SELECT rca.[role] AS role, rca.[section] AS section, rca.[column] AS col, ${writeExpr} AS can_write
            FROM dbo.role_column_access AS rca
            WHERE LOWER(rca.[role]) IN (${roleParams})
          `);
          const items = (rows.recordset || []) as Array<{ role?: unknown; section?: unknown; col?: unknown; can_write?: unknown }>;
          for (const it of items) {
            const roleNorm = normalizeRoleName(String(it.role || ""));
            if (!roles.includes(roleNorm)) continue;
            const sec = canonicalSectionKey(String(it.section || ""));
            const col = String(it.col || "").trim().toLowerCase();
            if (!sec || !col) continue;
            if (!seenWrite[sec]) seenWrite[sec] = new Set<string>();
            seenWrite[sec].add(col);
            if (it.can_write === true || it.can_write === 1) {
              if (!allowWrite[sec]) allowWrite[sec] = new Set<string>();
              allowWrite[sec].add(col);
            }
          }
        }

        if (hasNormalized) {
          const roleCols = await scanColumns(pool, "roles");
          const pickRole = (names: string[]) => {
            for (const n of names) if (roleCols.has(n)) return `[${n}]`;
            return null;
          };
          const roleIdCol = pickRole(["role_id", "id"]);
          const roleNameCol = pickRole(["role", "name", "role_name", "role_display_name"]);

          const catCols = await scanColumns(pool, "column_catalog");
          const pickCat = (names: string[]) => {
            for (const n of names) if (catCols.has(n)) return `[${n}]`;
            return null;
          };
          const colIdCol = pickCat(["column_id", "id"]);
          const tableNameCol = pickCat(["table_name", "table"]);
          const columnNameCol = pickCat(["column_name", "column"]);

          if (roleIdCol && colIdCol && tableNameCol && columnNameCol) {
            const roleTextExpr = roleNameCol
              ? `COALESCE(r.${roleNameCol}, CAST(rca.[role_id] AS NVARCHAR(50)))`
              : `CAST(rca.[role_id] AS NVARCHAR(50))`;
            const req3 = new sql.Request(pool);
            queryRoles.forEach((r, i) => {
              req3.input(`role${i}`, sql.NVarChar(50), String(r || "").trim().toLowerCase());
            });
            const res3 = await req3.query(`
              SELECT
                ${roleTextExpr} AS role_text,
                cc.${tableNameCol} AS table_name,
                cc.${columnNameCol} AS column_name,
                ${writeExpr} AS can_write
              FROM dbo.role_column_access AS rca
              LEFT JOIN dbo.roles AS r ON r.${roleIdCol} = rca.[role_id]
              LEFT JOIN dbo.column_catalog AS cc ON cc.${colIdCol} = rca.[column_id]
              WHERE rca.[role_id] IS NOT NULL AND rca.[column_id] IS NOT NULL
                AND LOWER(${roleTextExpr}) IN (${roleParams})
            `);
            const items2 = (res3.recordset || []) as Array<{ role_text?: unknown; table_name?: unknown; column_name?: unknown; can_write?: unknown }>;
            for (const it2 of items2) {
              const roleNorm = normalizeRoleName(String(it2.role_text || ""));
              if (!roles.includes(roleNorm)) continue;
              const sec = canonicalSectionKey(String(it2.table_name || ""));
              const col = String(it2.column_name || "").trim().toLowerCase();
              if (!sec || !col) continue;
              if (!seenWrite[sec]) seenWrite[sec] = new Set<string>();
              seenWrite[sec].add(col);
              if (it2.can_write === true || it2.can_write === 1) {
                if (!allowWrite[sec]) allowWrite[sec] = new Set<string>();
                allowWrite[sec].add(col);
              }
            }
          }
        }
      }
    } catch {}
  }

  const canWriteColumn = (section: string, column: string) => {
    const sec = canonicalSectionKey(section);
    const col = String(column || "").trim().toLowerCase();
    const seen = seenWrite[sec];
    if (seen && seen.has(col)) return !!(allowWrite[sec] && allowWrite[sec].has(col));
    return writeSections.has(sec);
  };
  const hasColumnRule = (section: string, column: string) => {
    const sec = canonicalSectionKey(section);
    const col = String(column || "").trim().toLowerCase();
    return !!(seenWrite[sec] && seenWrite[sec].has(col));
  };
  const hasAnyWriteAccess = writeSections.size > 0 || Object.keys(allowWrite).some((k) => (allowWrite[k]?.size || 0) > 0);
  return { canWriteColumn, hasColumnRule, hasAnyWriteAccess };
}

async function buildReadAccess(pool: sql.ConnectionPool, rolesRaw: string[]): Promise<ReadAccess> {
  const roles = rolesRaw.map((r) => normalizeRoleName(String(r)));
  const readSections = new Set<string>();
  for (const role of roles) {
    for (const sec of readSectionsFor(role)) readSections.add(canonicalSectionKey(sec));
  }

  const seenRead: Record<string, Set<string>> = {};
  const allowRead: Record<string, Set<string>> = {};

  const request = new sql.Request(pool);
  const hasTableRes = await request.query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'role_column_access'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0] as { ok?: unknown } | undefined);
  if (hasTable && roles.length) {
    try {
      const rcaCols = await scanColumns(pool, "role_column_access");
      const hasTextSchema = rcaCols.has("role") && rcaCols.has("section") && rcaCols.has("column");
      const hasNormalized = rcaCols.has("role_id") && rcaCols.has("column_id");
      const readExpr = (() => {
        const hasCanRead = rcaCols.has("can_read");
        const hasCanView = rcaCols.has("can_view");
        if (hasCanRead && hasCanView) return "(CASE WHEN rca.[can_read]=1 OR rca.[can_view]=1 THEN 1 ELSE 0 END)";
        if (hasCanRead) return "rca.[can_read]";
        if (hasCanView) return "rca.[can_view]";
        return null;
      })();
      if (readExpr) {
        const roleAliases = (role: string): string[] => {
          if (role === "department_rep") return [role, "dep_rep"];
          return [role];
        };
        const queryRoles = Array.from(new Set(roles.flatMap((r) => roleAliases(r))));
        const roleParams = queryRoles.map((_, i) => `@role${i}`).join(", ");

        if (hasTextSchema) {
          const req2 = new sql.Request(pool);
          queryRoles.forEach((r, i) => {
            req2.input(`role${i}`, sql.NVarChar(50), String(r || "").trim().toLowerCase());
          });
          const rows = await req2.query(`
            SELECT rca.[role] AS role, rca.[section] AS section, rca.[column] AS col, ${readExpr} AS can_read
            FROM dbo.role_column_access AS rca
            WHERE LOWER(rca.[role]) IN (${roleParams})
          `);
          const items = (rows.recordset || []) as Array<{ role?: unknown; section?: unknown; col?: unknown; can_read?: unknown }>;
          for (const it of items) {
            const roleNorm = normalizeRoleName(String(it.role || ""));
            if (!roles.includes(roleNorm)) continue;
            const sec = canonicalSectionKey(String(it.section || ""));
            const col = String(it.col || "").trim().toLowerCase();
            if (!sec || !col) continue;
            if (!seenRead[sec]) seenRead[sec] = new Set<string>();
            seenRead[sec].add(col);
            if (it.can_read === true || it.can_read === 1) {
              if (!allowRead[sec]) allowRead[sec] = new Set<string>();
              allowRead[sec].add(col);
            }
          }
        }

        if (hasNormalized) {
          const roleCols = await scanColumns(pool, "roles");
          const pickRole = (names: string[]) => {
            for (const n of names) if (roleCols.has(n)) return `[${n}]`;
            return null;
          };
          const roleIdCol = pickRole(["role_id", "id"]);
          const roleNameCol = pickRole(["role", "name", "role_name", "role_display_name"]);

          const catCols = await scanColumns(pool, "column_catalog");
          const pickCat = (names: string[]) => {
            for (const n of names) if (catCols.has(n)) return `[${n}]`;
            return null;
          };
          const colIdCol = pickCat(["column_id", "id"]);
          const tableNameCol = pickCat(["table_name", "table"]);
          const columnNameCol = pickCat(["column_name", "column"]);

          if (roleIdCol && colIdCol && tableNameCol && columnNameCol) {
            const roleTextExpr = roleNameCol
              ? `COALESCE(r.${roleNameCol}, CAST(rca.[role_id] AS NVARCHAR(50)))`
              : `CAST(rca.[role_id] AS NVARCHAR(50))`;
            const req3 = new sql.Request(pool);
            queryRoles.forEach((r, i) => {
              req3.input(`role${i}`, sql.NVarChar(50), String(r || "").trim().toLowerCase());
            });
            const res3 = await req3.query(`
              SELECT
                ${roleTextExpr} AS role_text,
                cc.${tableNameCol} AS table_name,
                cc.${columnNameCol} AS column_name,
                ${readExpr} AS can_read
              FROM dbo.role_column_access AS rca
              LEFT JOIN dbo.roles AS r ON r.${roleIdCol} = rca.[role_id]
              LEFT JOIN dbo.column_catalog AS cc ON cc.${colIdCol} = rca.[column_id]
              WHERE rca.[role_id] IS NOT NULL AND rca.[column_id] IS NOT NULL
                AND LOWER(${roleTextExpr}) IN (${roleParams})
            `);
            const items2 = (res3.recordset || []) as Array<{ role_text?: unknown; table_name?: unknown; column_name?: unknown; can_read?: unknown }>;
            for (const it2 of items2) {
              const roleNorm = normalizeRoleName(String(it2.role_text || ""));
              if (!roles.includes(roleNorm)) continue;
              const sec = canonicalSectionKey(String(it2.table_name || ""));
              const col = String(it2.column_name || "").trim().toLowerCase();
              if (!sec || !col) continue;
              if (!seenRead[sec]) seenRead[sec] = new Set<string>();
              seenRead[sec].add(col);
              if (it2.can_read === true || it2.can_read === 1) {
                if (!allowRead[sec]) allowRead[sec] = new Set<string>();
                allowRead[sec].add(col);
              }
            }
          }
        }
      }
    } catch {}
  }

  const canReadColumn = (section: string, column: string) => {
    const sec = canonicalSectionKey(section);
    const col = String(column || "").trim().toLowerCase();
    const seen = seenRead[sec];
    if (seen && seen.has(col)) return !!(allowRead[sec] && allowRead[sec].has(col));
    return readSections.has(sec);
  };
  const hasColumnRule = (section: string, column: string) => {
    const sec = canonicalSectionKey(section);
    const col = String(column || "").trim().toLowerCase();
    return !!(seenRead[sec] && seenRead[sec].has(col));
  };
  return { canReadColumn, hasColumnRule };
}

async function upsertEmployeeSection(
  trx: sql.Transaction,
  table: string,
  employeeId: string,
  fields: Array<{ column: string; param: string; sqlType: sql.ISqlType; value: unknown }>,
) {
  if (!fields.length) return;
  const request = new sql.Request(trx);
  request.input("employee_id", sql.VarChar(100), employeeId);
  for (const f of fields) request.input(f.param, f.sqlType, f.value);
  const setClause = fields.map((f) => `[${f.column}]=@${f.param}`).join(", ");
  const cols = ["employee_id", ...fields.map((f) => f.column)].map((c) => `[${c}]`).join(", ");
  const vals = ["@employee_id", ...fields.map((f) => `@${f.param}`)].join(", ");
  await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.${table} WHERE employee_id = @employee_id)
      UPDATE dbo.${table} SET ${setClause} WHERE employee_id = @employee_id
    ELSE
      INSERT INTO dbo.${table} (${cols}) VALUES (${vals});
  `);
}
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
  job_title: string | null;
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
  if (s.includes("human resources") || s.includes("human resource")) return "hr_general";
  if (s.includes("hr")) return "hr_general";
  if (s.includes("finance")) return "finance";
  if (s.includes("dep")) return "department_rep";
  if (s.includes("employee")) return "employee";
  return s;
}

function canonicalSectionKey(section: string) {
  let s = String(section || "").trim().toLowerCase();
  if (s.includes(".")) s = s.split(".").pop() as string;
  if (s.startsWith("employee ")) s = s.slice("employee ".length);
  if (s.startsWith("employee_")) s = s.slice("employee_".length);
  return s;
}

async function scanColumns(pool: sql.ConnectionPool, table: string): Promise<Set<string>> {
  const request = new sql.Request(pool);
  request.input("table", sql.NVarChar(128), table);
  const result = await request.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=@table
  `);
  const out = new Set<string>();
  const rows = (result.recordset || []) as Array<{ COLUMN_NAME?: unknown }>;
  for (const r of rows) out.add(String(r.COLUMN_NAME || "").trim().toLowerCase());
  return out;
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
    const rolesAll = rolesRaw.map((r) => normalizeRoleName(String(r)));
    const isDepRep = rolesAll.includes("department_rep");
    const isPrivileged = rolesAll.includes("superadmin") || rolesAll.includes("admin");
    const rolesForAccess = isDepRep && !isPrivileged ? ["department_rep"] : rolesAll;
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
             emp.status,
             emp.job_title
      FROM dbo.employee_core AS core
      LEFT JOIN dbo.employee_employment AS emp ON emp.employee_id = core.employee_id
      ${whereClause}
      ORDER BY core.employee_id
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `);
    const rows: EmployeeListRow[] = result.recordset || [];
    const data = rows.map((r: EmployeeListRow) => {
      const s = String(r.status || "").trim().toLowerCase();
      const statusPretty =
        !s ? undefined :
        s === "active" ? "Active" :
        s === "inactive" ? "Inactive" :
        s === "resign" ? "Resign" :
        s === "terminated" ? "Terminated" :
        r.status;
      return {
      core: {
        employee_id: r.employee_id,
        name: r.name,
        nationality: r.nationality,
      },
      employment: {
        department: r.department,
        status: statusPretty,
        job_title: r.job_title,
      },
      type: (String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expat") as "indonesia" | "expat",
    }});
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
  const pool = getPool();
  await pool.connect();
  const trx = new sql.Transaction(pool);
  const body = isObjectRecord(req.body) ? req.body : {};
  const rolesRaw = req.user?.roles || [];
  const rolesNorm = rolesRaw.map((r) => normalizeRoleName(String(r)));
  try {
    const writeAccess = await buildWriteAccess(pool, rolesRaw);
    if (!writeAccess.hasAnyWriteAccess) {
      return res.status(403).json({ error: "FORBIDDEN_UPDATE_EMPLOYEE", reason: "NO_WRITE_ACCESS" });
    }

    const core = isObjectRecord((body as { core?: unknown }).core) ? ((body as { core?: unknown }).core as Record<string, unknown>) : body;
    const contact = isObjectRecord((body as { contact?: unknown }).contact) ? ((body as { contact?: unknown }).contact as Record<string, unknown>) : body;
    const employment = isObjectRecord((body as { employment?: unknown }).employment) ? ((body as { employment?: unknown }).employment as Record<string, unknown>) : body;
    const onboard = isObjectRecord((body as { onboard?: unknown }).onboard) ? ((body as { onboard?: unknown }).onboard as Record<string, unknown>) : body;
    const bank = isObjectRecord((body as { bank?: unknown }).bank) ? ((body as { bank?: unknown }).bank as Record<string, unknown>) : body;
    const insurance = isObjectRecord((body as { insurance?: unknown }).insurance) ? ((body as { insurance?: unknown }).insurance as Record<string, unknown>) : body;
    const travel = isObjectRecord((body as { travel?: unknown }).travel) ? ((body as { travel?: unknown }).travel as Record<string, unknown>) : body;
    const checklist = isObjectRecord((body as { checklist?: unknown }).checklist) ? ((body as { checklist?: unknown }).checklist as Record<string, unknown>) : body;
    const notes = isObjectRecord((body as { notes?: unknown }).notes) ? ((body as { notes?: unknown }).notes as Record<string, unknown>) : body;

    const natReq = new sql.Request(pool);
    natReq.input("employee_id", sql.VarChar(100), id);
    const natRes = await natReq.query(`
      SELECT TOP 1 nationality
      FROM dbo.employee_core
      WHERE employee_id = @employee_id
    `);
    const natDbRow = (natRes.recordset || [])[0] as { nationality?: unknown } | undefined;
    const natFallback = core.nationality;
    const nat = String(natDbRow?.nationality ?? natFallback ?? "").trim().toLowerCase();
    const employeeType: "indonesia" | "expat" = nat === "indonesia" || nat.startsWith("indo") ? "indonesia" : "expat";

    const typeDenied = await loadTypeDeniedAccess(pool, employeeType);
    const canWrite = (section: string, column: string) => {
      if (column === "employee_id") return false;
      const sec = canonicalSectionKey(section);
      const col = String(column || "").trim().toLowerCase();
      const isEmploymentStatus = sec === "employment" && col === "employment_status";
      const applyLegacyEmploymentStatusMapping = rolesNorm.includes("hr_general");
      const hasEmploymentEmploymentStatusRule = writeAccess.hasColumnRule("employment", "employment_status");
      const hasOnboardEmploymentStatusRule = writeAccess.hasColumnRule("onboard", "employment_status");
      const canWriteOnboardEmploymentStatus = writeAccess.canWriteColumn("onboard", "employment_status");
      const denyFromOnboardEmploymentStatusRule =
        isEmploymentStatus &&
        applyLegacyEmploymentStatusMapping &&
        !hasEmploymentEmploymentStatusRule &&
        hasOnboardEmploymentStatusRule &&
        !canWriteOnboardEmploymentStatus;
      if (denyFromOnboardEmploymentStatusRule) return false;
      const canWriteLegacyEmploymentStatus =
        isEmploymentStatus &&
        !hasEmploymentEmploymentStatusRule &&
        applyLegacyEmploymentStatusMapping &&
        canWriteOnboardEmploymentStatus;
      if (!writeAccess.canWriteColumn(section, column) && !canWriteLegacyEmploymentStatus) return false;
      if (typeDenied[sec] && typeDenied[sec].has(col)) return false;
      return true;
    };

    const coreTableCols = await scanColumns(pool, "employee_core");
    const contactTableCols = await scanColumns(pool, "employee_contact");
    const employmentTableCols = await scanColumns(pool, "employee_employment");
    const onboardTableCols = await scanColumns(pool, "employee_onboard");
    const bankTableCols = await scanColumns(pool, "employee_bank");
    const insuranceTableCols = await scanColumns(pool, "employee_insurance");
    const travelTableCols = await scanColumns(pool, "employee_travel");
    const checklistTableCols = await scanColumns(pool, "employee_checklist");
    const notesTableCols = await scanColumns(pool, "employee_notes");

    const idCardRaw = core.id_card_mti;
    const idCardVal = idCardRaw === true ? 1 : idCardRaw === false ? 0 : null;

    const coreFields = [
      { column: "name", param: "name", sqlType: sql.NVarChar(200), value: core.name ? String(core.name) : null, gate: "name" },
      { column: "gender", param: "gender", sqlType: sql.Char(1), value: genderToCode(core.gender ? String(core.gender) : null), gate: "gender" },
      { column: "place_of_birth", param: "place_of_birth", sqlType: sql.NVarChar(100), value: core.place_of_birth ? String(core.place_of_birth) : null, gate: "place_of_birth" },
      { column: "date_of_birth", param: "date_of_birth", sqlType: sql.Date(), value: parseDate(core.date_of_birth), gate: "date_of_birth" },
      { column: "marital_status", param: "marital_status", sqlType: sql.NVarChar(50), value: core.marital_status ? String(core.marital_status) : null, gate: "marital_status" },
      { column: "religion", param: "religion", sqlType: sql.NVarChar(50), value: core.religion ? String(core.religion) : null, gate: "religion" },
      { column: "nationality", param: "nationality", sqlType: sql.NVarChar(100), value: core.nationality ? String(core.nationality) : null, gate: "nationality" },
      { column: "blood_type", param: "blood_type", sqlType: sql.NVarChar(5), value: core.blood_type ? String(core.blood_type) : null, gate: "blood_type" },
      { column: "kartu_keluarga_no", param: "kartu_keluarga_no", sqlType: sql.NVarChar(50), value: core.kartu_keluarga_no ? String(core.kartu_keluarga_no) : null, gate: "kartu_keluarga_no" },
      { column: "ktp_no", param: "ktp_no", sqlType: sql.NVarChar(50), value: core.ktp_no ? String(core.ktp_no) : null, gate: "ktp_no" },
      { column: "npwp", param: "npwp", sqlType: sql.NVarChar(30), value: core.npwp ? String(core.npwp) : null, gate: "npwp" },
      { column: "tax_status", param: "tax_status", sqlType: sql.NVarChar(20), value: core.tax_status ? String(core.tax_status) : null, gate: "tax_status" },
      { column: "education", param: "education", sqlType: sql.NVarChar(100), value: core.education ? String(core.education) : null, gate: "education" },
      { column: "imip_id", param: "imip_id", sqlType: sql.NVarChar(50), value: core.imip_id ? String(core.imip_id) : null, gate: "imip_id" },
      { column: "branch", param: "branch", sqlType: sql.NVarChar(50), value: core.branch ? String(core.branch) : null, gate: "branch" },
      { column: "branch_id", param: "branch_id", sqlType: sql.NVarChar(50), value: core.branch_id ? String(core.branch_id) : null, gate: "branch_id" },
      { column: "office_email", param: "office_email", sqlType: sql.NVarChar(255), value: core.office_email ? String(core.office_email) : null, gate: "office_email" },
      { column: "id_card_mti", param: "id_card_mti", sqlType: sql.Bit(), value: idCardVal, gate: "id_card_mti" },
      { column: "field", param: "field", sqlType: sql.NVarChar(100), value: core.field ? String(core.field) : null, gate: "field" },
    ]
      .filter((f) => coreTableCols.has(f.column) && canWrite("core", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const contactFields = [
      { column: "phone_number", param: "phone_number", sqlType: sql.NVarChar(50), value: contact.phone_number ? String(contact.phone_number) : null, gate: "phone_number" },
      { column: "email", param: "email", sqlType: sql.NVarChar(200), value: contact.email ? String(contact.email) : null, gate: "email" },
      { column: "address", param: "address", sqlType: sql.NVarChar(255), value: contact.address ? String(contact.address) : null, gate: "address" },
      { column: "city", param: "city", sqlType: sql.NVarChar(100), value: contact.city ? String(contact.city) : null, gate: "city" },
      { column: "spouse_name", param: "spouse_name", sqlType: sql.NVarChar(200), value: contact.spouse_name ? String(contact.spouse_name) : null, gate: "spouse_name" },
      { column: "child_name_1", param: "child_name_1", sqlType: sql.NVarChar(200), value: contact.child_name_1 ? String(contact.child_name_1) : null, gate: "child_name_1" },
      { column: "child_name_2", param: "child_name_2", sqlType: sql.NVarChar(200), value: contact.child_name_2 ? String(contact.child_name_2) : null, gate: "child_name_2" },
      { column: "child_name_3", param: "child_name_3", sqlType: sql.NVarChar(200), value: contact.child_name_3 ? String(contact.child_name_3) : null, gate: "child_name_3" },
      { column: "emergency_contact_name", param: "emergency_contact_name", sqlType: sql.NVarChar(200), value: contact.emergency_contact_name ? String(contact.emergency_contact_name) : null, gate: "emergency_contact_name" },
      { column: "emergency_contact_phone", param: "emergency_contact_phone", sqlType: sql.NVarChar(50), value: contact.emergency_contact_phone ? String(contact.emergency_contact_phone) : null, gate: "emergency_contact_phone" },
    ]
      .filter((f) => contactTableCols.has(f.column) && canWrite("contact", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const normalizedEmploymentStatus = normalizeEmploymentStatus(employment.employment_status);
    if (employment.employment_status !== undefined && normalizedEmploymentStatus === null && canWrite("employment", "employment_status")) {
      return res.status(400).json({
        error: "INVALID_EMPLOYMENT_STATUS",
        received: employment.employment_status,
        allowed: EMPLOYMENT_STATUS_ALLOWED,
      });
    }

    const employmentFields = [
      ...(normalizedEmploymentStatus !== undefined
        ? [{ column: "employment_status", param: "employment_status", sqlType: sql.NVarChar(50), value: normalizedEmploymentStatus, gate: "employment_status" }]
        : []),
      { column: "status", param: "status", sqlType: sql.NVarChar(50), value: employment.status ? String(employment.status) : "Active", gate: "status" },
      { column: "division", param: "division", sqlType: sql.NVarChar(100), value: employment.division ? String(employment.division) : null, gate: "division" },
      { column: "department", param: "department", sqlType: sql.NVarChar(100), value: employment.department ? String(employment.department) : null, gate: "department" },
      { column: "section", param: "section", sqlType: sql.NVarChar(100), value: employment.section ? String(employment.section) : null, gate: "section" },
      { column: "job_title", param: "job_title", sqlType: sql.NVarChar(100), value: employment.job_title ? String(employment.job_title) : null, gate: "job_title" },
      { column: "grade", param: "grade", sqlType: sql.NVarChar(20), value: employment.grade ? String(employment.grade) : null, gate: "grade" },
      { column: "position_grade", param: "position_grade", sqlType: sql.NVarChar(50), value: employment.position_grade ? String(employment.position_grade) : null, gate: "position_grade" },
      { column: "group_job_title", param: "group_job_title", sqlType: sql.NVarChar(100), value: employment.group_job_title ? String(employment.group_job_title) : null, gate: "group_job_title" },
      { column: "direct_report", param: "direct_report", sqlType: sql.NVarChar(100), value: employment.direct_report ? String(employment.direct_report) : null, gate: "direct_report" },
      { column: "company_office", param: "company_office", sqlType: sql.NVarChar(100), value: employment.company_office ? String(employment.company_office) : null, gate: "company_office" },
      { column: "work_location", param: "work_location", sqlType: sql.NVarChar(100), value: employment.work_location ? String(employment.work_location) : null, gate: "work_location" },
      { column: "locality_status", param: "locality_status", sqlType: sql.NVarChar(50), value: employment.locality_status ? String(employment.locality_status) : null, gate: "locality_status" },
      { column: "blacklist_mti", param: "blacklist_mti", sqlType: sql.NVarChar(1), value: boolToYN(employment.blacklist_mti), gate: "blacklist_mti" },
      { column: "blacklist_imip", param: "blacklist_imip", sqlType: sql.NVarChar(1), value: boolToYN(employment.blacklist_imip), gate: "blacklist_imip" },
    ]
      .filter((f) => employmentTableCols.has(f.column) && canWrite("employment", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const onboardFields = [
      { column: "point_of_hire", param: "point_of_hire", sqlType: sql.NVarChar(100), value: onboard.point_of_hire ? String(onboard.point_of_hire) : null, gate: "point_of_hire" },
      { column: "point_of_origin", param: "point_of_origin", sqlType: sql.NVarChar(100), value: onboard.point_of_origin ? String(onboard.point_of_origin) : null, gate: "point_of_origin" },
      { column: "schedule_type", param: "schedule_type", sqlType: sql.NVarChar(50), value: onboard.schedule_type ? String(onboard.schedule_type) : null, gate: "schedule_type" },
      { column: "first_join_date_merdeka", param: "first_join_date_merdeka", sqlType: sql.Date(), value: parseDate(onboard.first_join_date_merdeka), gate: "first_join_date_merdeka" },
      { column: "transfer_merdeka", param: "transfer_merdeka", sqlType: sql.Date(), value: parseDate(onboard.transfer_merdeka), gate: "transfer_merdeka" },
      { column: "first_join_date", param: "first_join_date", sqlType: sql.Date(), value: parseDate(onboard.first_join_date), gate: "first_join_date" },
      { column: "join_date", param: "join_date", sqlType: sql.Date(), value: parseDate(onboard.join_date), gate: "join_date" },
      { column: "end_contract", param: "end_contract", sqlType: sql.Date(), value: parseDate(onboard.end_contract), gate: "end_contract" },
    ]
      .filter((f) => onboardTableCols.has(f.column) && canWrite("onboard", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const bankFields = [
      { column: "bank_name", param: "bank_name", sqlType: sql.NVarChar(100), value: bank.bank_name ? String(bank.bank_name) : null, gate: "bank_name" },
      { column: "account_name", param: "account_name", sqlType: sql.NVarChar(100), value: bank.account_name ? String(bank.account_name) : null, gate: "account_name" },
      { column: "account_no", param: "account_no", sqlType: sql.NVarChar(50), value: bank.account_no ? String(bank.account_no) : null, gate: "account_no" },
      { column: "bank_code", param: "bank_code", sqlType: sql.NVarChar(50), value: bank.bank_code ? String(bank.bank_code) : null, gate: "bank_code" },
      { column: "icbc_bank_account_no", param: "icbc_bank_account_no", sqlType: sql.NVarChar(50), value: bank.icbc_bank_account_no ? String(bank.icbc_bank_account_no) : null, gate: "icbc_bank_account_no" },
      { column: "icbc_username", param: "icbc_username", sqlType: sql.NVarChar(50), value: bank.icbc_username ? String(bank.icbc_username) : null, gate: "icbc_username" },
    ]
      .filter((f) => bankTableCols.has(f.column) && canWrite("bank", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const insuranceFields = [
      { column: "bpjs_tk", param: "bpjs_tk", sqlType: sql.NVarChar(50), value: insurance.bpjs_tk ? String(insurance.bpjs_tk) : null, gate: "bpjs_tk" },
      { column: "bpjs_kes", param: "bpjs_kes", sqlType: sql.NVarChar(50), value: insurance.bpjs_kes ? String(insurance.bpjs_kes) : null, gate: "bpjs_kes" },
      { column: "status_bpjs_kes", param: "status_bpjs_kes", sqlType: sql.NVarChar(50), value: insurance.status_bpjs_kes ? String(insurance.status_bpjs_kes) : null, gate: "status_bpjs_kes" },
      { column: "insurance_endorsement", param: "insurance_endorsement", sqlType: sql.NVarChar(1), value: boolToYN(insurance.insurance_endorsement), gate: "insurance_endorsement" },
      { column: "insurance_owlexa", param: "insurance_owlexa", sqlType: sql.NVarChar(1), value: boolToYN(insurance.insurance_owlexa), gate: "insurance_owlexa" },
      { column: "insurance_fpg", param: "insurance_fpg", sqlType: sql.NVarChar(1), value: boolToYN(insurance.insurance_fpg), gate: "insurance_fpg" },
      { column: "fpg_no", param: "fpg_no", sqlType: sql.NVarChar(50), value: insurance.fpg_no ? String(insurance.fpg_no) : null, gate: "fpg_no" },
      { column: "owlexa_no", param: "owlexa_no", sqlType: sql.NVarChar(50), value: insurance.owlexa_no ? String(insurance.owlexa_no) : null, gate: "owlexa_no" },
      { column: "social_insurance_no_alt", param: "social_insurance_no_alt", sqlType: sql.NVarChar(100), value: insurance.social_insurance_no_alt ? String(insurance.social_insurance_no_alt) : null, gate: "social_insurance_no_alt" },
      { column: "bpjs_kes_no_alt", param: "bpjs_kes_no_alt", sqlType: sql.NVarChar(100), value: insurance.bpjs_kes_no_alt ? String(insurance.bpjs_kes_no_alt) : null, gate: "bpjs_kes_no_alt" },
    ]
      .filter((f) => insuranceTableCols.has(f.column) && canWrite("insurance", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const travelFields = [
      { column: "passport_no", param: "passport_no", sqlType: sql.NVarChar(50), value: travel.passport_no ? String(travel.passport_no) : null, gate: "passport_no" },
      { column: "name_as_passport", param: "name_as_passport", sqlType: sql.NVarChar(100), value: travel.name_as_passport ? String(travel.name_as_passport) : null, gate: "name_as_passport" },
      { column: "passport_expiry", param: "passport_expiry", sqlType: sql.Date(), value: parseDate(travel.passport_expiry), gate: "passport_expiry" },
      { column: "kitas_no", param: "kitas_no", sqlType: sql.NVarChar(50), value: travel.kitas_no ? String(travel.kitas_no) : null, gate: "kitas_no" },
      { column: "kitas_expiry", param: "kitas_expiry", sqlType: sql.Date(), value: parseDate(travel.kitas_expiry), gate: "kitas_expiry" },
      { column: "kitas_address", param: "kitas_address", sqlType: sql.NVarChar(255), value: travel.kitas_address ? String(travel.kitas_address) : null, gate: "kitas_address" },
      { column: "imta", param: "imta", sqlType: sql.NVarChar(50), value: travel.imta ? String(travel.imta) : null, gate: "imta" },
      { column: "rptka_no", param: "rptka_no", sqlType: sql.NVarChar(50), value: travel.rptka_no ? String(travel.rptka_no) : null, gate: "rptka_no" },
      { column: "rptka_position", param: "rptka_position", sqlType: sql.NVarChar(100), value: travel.rptka_position ? String(travel.rptka_position) : null, gate: "rptka_position" },
      { column: "job_title_kitas", param: "job_title_kitas", sqlType: sql.NVarChar(100), value: travel.job_title_kitas ? String(travel.job_title_kitas) : null, gate: "job_title_kitas" },
      { column: "travel_in", param: "travel_in", sqlType: sql.Date(), value: parseDate(travel.travel_in), gate: "travel_in" },
      { column: "travel_out", param: "travel_out", sqlType: sql.Date(), value: parseDate(travel.travel_out), gate: "travel_out" },
    ]
      .filter((f) => travelTableCols.has(f.column) && canWrite("travel", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const checklistFields = [
      { column: "paspor_checklist", param: "paspor_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.passport_checklist), gate: "passport_checklist" },
      { column: "kitas_checklist", param: "kitas_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.kitas_checklist), gate: "kitas_checklist" },
      { column: "imta_checklist", param: "imta_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.imta_checklist), gate: "imta_checklist" },
      { column: "rptka_checklist", param: "rptka_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.rptka_checklist), gate: "rptka_checklist" },
      { column: "npwp_checklist", param: "npwp_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.npwp_checklist), gate: "npwp_checklist" },
      { column: "bpjs_kes_checklist", param: "bpjs_kes_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.bpjs_kes_checklist), gate: "bpjs_kes_checklist" },
      { column: "bpjs_tk_checklist", param: "bpjs_tk_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.bpjs_tk_checklist), gate: "bpjs_tk_checklist" },
      { column: "bank_checklist", param: "bank_checklist", sqlType: sql.NVarChar(1), value: boolToYN(checklist.bank_checklist), gate: "bank_checklist" },
    ]
      .filter((f) => checklistTableCols.has(f.column) && canWrite("checklist", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const notesFields = [
      { column: "batch", param: "batch", sqlType: sql.NVarChar(50), value: notes.batch ? String(notes.batch) : null, gate: "batch" },
      { column: "note", param: "note", sqlType: sql.NVarChar(sql.MAX), value: notes.note ? String(notes.note) : null, gate: "note" },
    ]
      .filter((f) => notesTableCols.has(f.column) && canWrite("notes", f.gate))
      .map((f) => ({ column: f.column, param: f.param, sqlType: f.sqlType, value: f.value }));

    const totalUpdates =
      coreFields.length +
      contactFields.length +
      employmentFields.length +
      onboardFields.length +
      bankFields.length +
      insuranceFields.length +
      travelFields.length +
      checklistFields.length +
      notesFields.length;
    if (totalUpdates === 0) {
      return res.status(403).json({ error: "FORBIDDEN_UPDATE_EMPLOYEE", reason: "NO_ALLOWED_FIELDS" });
    }

    await trx.begin();
    try {
      await upsertEmployeeSection(trx, "employee_core", id, coreFields);
      await upsertEmployeeSection(trx, "employee_contact", id, contactFields);
      await upsertEmployeeSection(trx, "employee_employment", id, employmentFields);
      await upsertEmployeeSection(trx, "employee_onboard", id, onboardFields);
      await upsertEmployeeSection(trx, "employee_bank", id, bankFields);
      await upsertEmployeeSection(trx, "employee_insurance", id, insuranceFields);
      await upsertEmployeeSection(trx, "employee_travel", id, travelFields);
      await upsertEmployeeSection(trx, "employee_checklist", id, checklistFields);
      await upsertEmployeeSection(trx, "employee_notes", id, notesFields);
      await trx.commit();
    } catch (err: unknown) {
      await trx.rollback();
      throw err;
    }
    return res.json({ ok: true, employee_id: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_EMPLOYEE";
    const details = extractDbErrorDetails(err);
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
    const normalizedEmploymentStatus = normalizeEmploymentStatus(employment.employment_status);
    if (normalizedEmploymentStatus === undefined || normalizedEmploymentStatus === null) {
      await trx.rollback();
      return res.status(400).json({
        error: "INVALID_EMPLOYMENT_STATUS",
        received: employment.employment_status,
        allowed: EMPLOYMENT_STATUS_ALLOWED,
      });
    }
    request.input("employment_status", sql.NVarChar(50), normalizedEmploymentStatus);
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
  const rows: Array<Record<string, unknown>> = Array.isArray(req.body) ? (req.body as Array<Record<string, unknown>>) : [];
  if (!rows.length) return res.status(400).json({ error: "NO_ROWS" });
  const pool = getPool();
  const conn = await pool.connect();
  let success = 0;
  let failed = 0;
  const results: Array<{ employee_id: string; status: "success" | "failed"; error?: string }> = [];
  for (const r of rows) {
    const trx = new sql.Transaction(conn);
    try {
      await trx.begin();
      const id = String((r as any).employee_id || "").trim();
      if (!id) throw new Error("EMPLOYEE_ID_REQUIRED");
      const rawEmploymentStatus = (r as any).employment_status;
      const normalizedEmploymentStatus = normalizeEmploymentStatus(rawEmploymentStatus);
      const hasEmploymentStatus = String(rawEmploymentStatus || "").trim() !== "";
      if (hasEmploymentStatus && normalizedEmploymentStatus === null) throw new Error("INVALID_EMPLOYMENT_STATUS");
      const employmentStatusValue =
        (normalizedEmploymentStatus === undefined || normalizedEmploymentStatus === null) ? "active" : normalizedEmploymentStatus;
      const rawStatus = (r as any).status;
      const normalizedStatus = normalizeStatus(rawStatus);
      const hasStatus = String(rawStatus || "").trim() !== "";
      if (hasStatus && normalizedStatus === null) throw new Error("INVALID_STATUS");
      const statusValue = normalizedStatus || null;
      const terminatedDate = parseDate((r as any).terminated_date);
      const terminatedType = (r as any).terminated_type ? String((r as any).terminated_type) : null;
      const terminatedReason = (r as any).terminated_reason ? String((r as any).terminated_reason) : null;
      if (normalizedStatus === "terminated") {
        if (!terminatedDate || !terminatedType) throw new Error("TERMINATION_FIELDS_REQUIRED");
      }
      const coreFields = [
        { column: "name", param: "name", sqlType: sql.NVarChar(200), value: (r as any).name || null },
        { column: "gender", param: "gender", sqlType: sql.Char(1), value: genderToCode((r as any).gender) },
        { column: "place_of_birth", param: "place_of_birth", sqlType: sql.NVarChar(100), value: (r as any).place_of_birth || null },
        { column: "date_of_birth", param: "date_of_birth", sqlType: sql.Date(), value: parseDate((r as any).date_of_birth) },
        { column: "marital_status", param: "marital_status", sqlType: sql.NVarChar(50), value: (r as any).marital_status || null },
        { column: "tax_status", param: "tax_status", sqlType: sql.NVarChar(20), value: (r as any).tax_status || null },
        { column: "religion", param: "religion", sqlType: sql.NVarChar(50), value: (r as any).religion || null },
        { column: "nationality", param: "nationality", sqlType: sql.NVarChar(100), value: (r as any).nationality || null },
        { column: "blood_type", param: "blood_type", sqlType: sql.NVarChar(5), value: (r as any).blood_type || null },
        { column: "education", param: "education", sqlType: sql.NVarChar(100), value: (r as any).education || null },
        { column: "kartu_keluarga_no", param: "kartu_keluarga_no", sqlType: sql.NVarChar(50), value: (r as any).kartu_keluarga_no || null },
        { column: "ktp_no", param: "ktp_no", sqlType: sql.NVarChar(50), value: (r as any).ktp_no || null },
        { column: "npwp", param: "npwp", sqlType: sql.NVarChar(30), value: (r as any).npwp || null },
        { column: "office_email", param: "office_email", sqlType: sql.NVarChar(255), value: (r as any).office_email || null },
        { column: "branch", param: "branch", sqlType: sql.NVarChar(50), value: (r as any).branch || null },
        { column: "branch_id", param: "branch_id", sqlType: sql.NVarChar(50), value: (r as any).branch_id || null },
        { column: "imip_id", param: "imip_id", sqlType: sql.NVarChar(50), value: ((r as any).imip_id ? String((r as any).imip_id) : id) },
        { column: "id_card_mti", param: "id_card_mti", sqlType: sql.Bit(), value: (() => { const v = String((r as any).id_card_mti || "").trim().toLowerCase(); if (!v) return null; if (v === "1" || v === "y" || v === "yes" || v === "true") return 1; if (v === "0" || v === "n" || v === "no" || v === "false") return 0; return null; })() },
      ];
      const contactFields = [
        { column: "phone_number", param: "phone_number", sqlType: sql.NVarChar(50), value: (r as any).phone_number || null },
        { column: "email", param: "email", sqlType: sql.NVarChar(200), value: (r as any).email || null },
        { column: "address", param: "address", sqlType: sql.NVarChar(255), value: (r as any).address || null },
        { column: "city", param: "city", sqlType: sql.NVarChar(100), value: (r as any).city || null },
        { column: "spouse_name", param: "spouse_name", sqlType: sql.NVarChar(200), value: (r as any).spouse_name || null },
        { column: "child_name_1", param: "child_name_1", sqlType: sql.NVarChar(200), value: (r as any).child_name_1 || null },
        { column: "child_name_2", param: "child_name_2", sqlType: sql.NVarChar(200), value: (r as any).child_name_2 || null },
        { column: "child_name_3", param: "child_name_3", sqlType: sql.NVarChar(200), value: (r as any).child_name_3 || null },
        { column: "emergency_contact_name", param: "emergency_contact_name", sqlType: sql.NVarChar(200), value: (r as any).emergency_contact_name || null },
        { column: "emergency_contact_phone", param: "emergency_contact_phone", sqlType: sql.NVarChar(50), value: (r as any).emergency_contact_phone || null },
      ];
      const employmentFields = [
        { column: "employment_status", param: "employment_status", sqlType: sql.NVarChar(50), value: employmentStatusValue },
        { column: "status", param: "status", sqlType: sql.NVarChar(50), value: statusValue },
        { column: "division", param: "division", sqlType: sql.NVarChar(100), value: (r as any).division || null },
        { column: "department", param: "department", sqlType: sql.NVarChar(100), value: (r as any).department || null },
        { column: "section", param: "section", sqlType: sql.NVarChar(100), value: (r as any).section || null },
        { column: "job_title", param: "job_title", sqlType: sql.NVarChar(100), value: (r as any).job_title || null },
        { column: "grade", param: "grade", sqlType: sql.NVarChar(20), value: (r as any).grade || null },
        { column: "position_grade", param: "position_grade", sqlType: sql.NVarChar(50), value: (r as any).position_grade || null },
        { column: "group_job_title", param: "group_job_title", sqlType: sql.NVarChar(100), value: (r as any).group_job_title || null },
        { column: "direct_report", param: "direct_report", sqlType: sql.NVarChar(100), value: (r as any).direct_report || null },
        { column: "company_office", param: "company_office", sqlType: sql.NVarChar(100), value: (r as any).company_office || null },
        { column: "work_location", param: "work_location", sqlType: sql.NVarChar(100), value: (r as any).work_location || null },
        { column: "locality_status", param: "locality_status", sqlType: sql.NVarChar(50), value: (r as any).locality_status || null },
        { column: "terminated_date", param: "terminated_date", sqlType: sql.Date(), value: terminatedDate || null },
        { column: "terminated_type", param: "terminated_type", sqlType: sql.NVarChar(50), value: terminatedType },
        { column: "terminated_reason", param: "terminated_reason", sqlType: sql.NVarChar(200), value: terminatedReason },
        { column: "blacklist_mti", param: "blacklist_mti", sqlType: sql.NVarChar(1), value: (() => { const v = String((r as any).blacklist_mti || "").trim(); if (!v) return null; return v === "1" ? "Y" : "N"; })() },
        { column: "blacklist_imip", param: "blacklist_imip", sqlType: sql.NVarChar(1), value: (() => { const v = String((r as any).blacklist_imip || "").trim(); if (!v) return null; return v === "1" ? "Y" : "N"; })() },
      ];
      const onboardFields = [
        { column: "point_of_hire", param: "point_of_hire", sqlType: sql.NVarChar(100), value: (r as any).point_of_hire || null },
        { column: "point_of_origin", param: "point_of_origin", sqlType: sql.NVarChar(100), value: (r as any).point_of_origin || null },
        { column: "schedule_type", param: "schedule_type", sqlType: sql.NVarChar(50), value: (r as any).schedule_type || null },
        { column: "first_join_date_merdeka", param: "first_join_date_merdeka", sqlType: sql.Date(), value: parseDate((r as any).first_join_date_merdeka) },
        { column: "transfer_merdeka", param: "transfer_merdeka", sqlType: sql.Date(), value: parseDate((r as any).transfer_merdeka) },
        { column: "first_join_date", param: "first_join_date", sqlType: sql.Date(), value: parseDate((r as any).first_join_date) },
        { column: "join_date", param: "join_date", sqlType: sql.Date(), value: parseDate((r as any).join_date) },
        { column: "end_contract", param: "end_contract", sqlType: sql.Date(), value: parseDate((r as any).end_contract) },
      ];
      const bankFields = [
        { column: "bank_name", param: "bank_name", sqlType: sql.NVarChar(100), value: (r as any).bank_name || null },
        { column: "account_name", param: "account_name", sqlType: sql.NVarChar(100), value: (r as any).account_name || null },
        { column: "account_no", param: "account_no", sqlType: sql.NVarChar(50), value: (r as any).account_no || null },
      ];
      const insuranceFields = [
        { column: "bpjs_tk", param: "bpjs_tk", sqlType: sql.NVarChar(50), value: (r as any).bpjs_tk || null },
        { column: "bpjs_kes", param: "bpjs_kes", sqlType: sql.NVarChar(50), value: (r as any).bpjs_kes || null },
        { column: "status_bpjs_kes", param: "status_bpjs_kes", sqlType: sql.NVarChar(50), value: (r as any).status_bpjs_kes || null },
        { column: "social_insurance_no_alt", param: "social_insurance_no_alt", sqlType: sql.NVarChar(100), value: (r as any).social_insurance_no_alt || null },
        { column: "bpjs_kes_no_alt", param: "bpjs_kes_no_alt", sqlType: sql.NVarChar(100), value: (r as any).bpjs_kes_no_alt || null },
        { column: "insurance_endorsement", param: "insurance_endorsement", sqlType: sql.NVarChar(1), value: (() => { const v = String((r as any).insurance_endorsement || "").trim(); if (!v) return null; return v === "1" ? "Y" : "N"; })() },
        { column: "insurance_owlexa", param: "insurance_owlexa", sqlType: sql.NVarChar(1), value: (() => { const v = String((r as any).insurance_owlexa || "").trim(); if (!v) return null; return v === "1" ? "Y" : "N"; })() },
        { column: "insurance_fpg", param: "insurance_fpg", sqlType: sql.NVarChar(1), value: (() => { const v = String((r as any).insurance_fpg || "").trim(); if (!v) return null; return v === "1" ? "Y" : "N"; })() },
        { column: "fpg_no", param: "fpg_no", sqlType: sql.NVarChar(50), value: (r as any).fpg_no || null },
        { column: "owlexa_no", param: "owlexa_no", sqlType: sql.NVarChar(50), value: (r as any).owlexa_no || null },
      ];
      const travelFields = [
        { column: "travel_in", param: "travel_in", sqlType: sql.Date(), value: parseDate((r as any).travel_in) },
        { column: "travel_out", param: "travel_out", sqlType: sql.Date(), value: parseDate((r as any).travel_out) },
      ];
      const reqCore = new sql.Request(trx);
      for (const f of coreFields) reqCore.input(f.param, f.sqlType, f.value);
      reqCore.input("employee_id", sql.VarChar(100), id);
      await reqCore.query(`
        IF EXISTS (SELECT 1 FROM dbo.employee_core WHERE employee_id = @employee_id)
          UPDATE dbo.employee_core SET ${coreFields.map(f => `[${f.column}]=@${f.param}`).join(", ")} WHERE employee_id=@employee_id
        ELSE
          INSERT INTO dbo.employee_core ([employee_id], ${coreFields.map(f => `[${f.column}]`).join(", ")}) VALUES (@employee_id, ${coreFields.map(f => `@${f.param}`).join(", ")});
      `);
      await upsertEmployeeSection(trx, "employee_contact", id, contactFields);
      await upsertEmployeeSection(trx, "employee_employment", id, employmentFields);
      await upsertEmployeeSection(trx, "employee_onboard", id, onboardFields);
      await upsertEmployeeSection(trx, "employee_bank", id, bankFields);
      await upsertEmployeeSection(trx, "employee_insurance", id, insuranceFields);
      await upsertEmployeeSection(trx, "employee_travel", id, travelFields);
      await trx.commit();
      success += 1;
      results.push({ employee_id: String((r as any).employee_id || ""), status: "success" });
    } catch (e: unknown) {
      await trx.rollback();
      failed += 1;
      const msg = e instanceof Error ? e.message : "FAILED";
      const details = extractDbErrorDetails(e);
      console.error("employees.import.error", { employee_id: String(r.employee_id || ""), message: msg, details });
      results.push({
        employee_id: String(r.employee_id || ""),
        status: "failed",
        error: details?.code ? `${msg}:${details.code}` : msg,
      });
    }
  }
  await pool.close();
  return res.json({ ok: true, success, failed, total: rows.length, results });
});

employeesRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const pool = getPool();
  try {
    await pool.connect();
    const rolesRaw = req.user?.roles || [];
    const rolesNormAll = rolesRaw.map((r) => normalizeRoleName(String(r)));
    const rolesNorm = rolesRaw.map((r) => normalizeRoleName(String(r)));
    const isDepRep = rolesNorm.includes("department_rep");
    const isPrivileged = rolesNorm.includes("superadmin") || rolesNorm.includes("admin");
    const rolesForAccess = isDepRep && !isPrivileged ? ["department_rep"] : rolesNorm;
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

    const readAccess = await buildReadAccess(pool, rolesRaw);
    const employeeType: "indonesia" | "expat" = String(r.nationality || "").trim().toLowerCase() === "indonesia" ? "indonesia" : "expat";
    const typeDenied = await loadTypeDeniedAccess(pool, employeeType);

    const canRead = (section: string, column: string) => {
      const sec = canonicalSectionKey(section);
      const col = String(column || "").trim().toLowerCase();
      if (sec === "core" && col === "employee_id") return true;
      const isEmploymentStatus = sec === "employment" && col === "employment_status";
      const applyLegacyEmploymentStatusMapping = rolesNormAll.includes("hr_general");
      const hasEmploymentEmploymentStatusRule = readAccess.hasColumnRule("employment", "employment_status");
      const hasOnboardEmploymentStatusRule = readAccess.hasColumnRule("onboard", "employment_status");
      const canReadOnboardEmploymentStatus = readAccess.canReadColumn("onboard", "employment_status");
      const denyFromOnboardEmploymentStatusRule =
        isEmploymentStatus &&
        applyLegacyEmploymentStatusMapping &&
        !hasEmploymentEmploymentStatusRule &&
        hasOnboardEmploymentStatusRule &&
        !canReadOnboardEmploymentStatus;
      if (denyFromOnboardEmploymentStatusRule) return false;
      const canReadLegacyEmploymentStatus =
        isEmploymentStatus &&
        !hasEmploymentEmploymentStatusRule &&
        applyLegacyEmploymentStatusMapping &&
        canReadOnboardEmploymentStatus;
      if (!readAccess.canReadColumn(section, column) && !canReadLegacyEmploymentStatus) return false;
      if (typeDenied[sec] && typeDenied[sec].has(col)) return false;
      return true;
    };

    const toRecord = (v: unknown): Record<string, unknown> => {
      if (!isObjectRecord(v)) return {};
      return v;
    };
    const filterSection = (sectionKey: string, sectionValue: unknown) => {
      const obj = toRecord(sectionValue);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (canRead(sectionKey, k)) out[k] = v;
      }
      return Object.keys(out).length ? out : null;
    };

    const filtered: Record<string, unknown> = { type: (payload as { type: unknown }).type };
    const sectionKeys = ["core", "contact", "employment", "onboard", "bank", "insurance", "travel", "checklist", "notes"];
    for (const sectionKey of sectionKeys) {
      const sectionValue = (payload as Record<string, unknown>)[sectionKey];
      const sectionFiltered = filterSection(sectionKey, sectionValue);
      if (sectionFiltered) filtered[sectionKey] = sectionFiltered;
    }
    return res.json(filtered);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_EMPLOYEE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
