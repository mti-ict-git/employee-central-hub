import { Router } from "express";
import sql from "mssql";
import { authMiddleware } from "../middleware/auth";
import { canAccessReport, canExportReport } from "../policy";
import { CONFIG } from "../config";

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

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
async function buildReadAccess(pool: sql.ConnectionPool, rolesRaw: string[]) {
  const roles = rolesRaw.map((r) => normalizeRoleName(String(r)));
  const seenRead: Record<string, Set<string>> = {};
  const allowRead: Record<string, Set<string>> = {};
  const request = new sql.Request(pool);
  const hasTableRes = await request.query(`SELECT 1 AS ok FROM sys.tables WHERE name = 'role_column_access'`);
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
        const roleAliases = (role: string): string[] => (role === "department_rep" ? [role, "dep_rep"] : [role]);
        const queryRoles = Array.from(new Set(roles.flatMap((r) => roleAliases(r))));
        const roleParams = queryRoles.map((_, i) => `@role${i}`).join(", ");
        if (hasTextSchema) {
          const req2 = new sql.Request(pool);
          queryRoles.forEach((r, i) => req2.input(`role${i}`, sql.NVarChar(50), String(r || "").trim().toLowerCase()));
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
            queryRoles.forEach((r, i) => req3.input(`role${i}`, sql.NVarChar(50), String(r || "").trim().toLowerCase()));
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
    return true;
  };
  return { canReadColumn };
}
async function loadUserTemplateAllowed(pool: sql.ConnectionPool, username: string): Promise<Set<string> | null> {
  try {
    const hasAssignRes = await new sql.Request(pool).query(`
      SELECT 1 AS ok FROM sys.tables WHERE name = 'column_access_assignments'
    `);
    const hasAssign = !!((hasAssignRes.recordset || [])[0]);
    if (!hasAssign) return null;
  } catch {
    return null;
  }
  const req = new sql.Request(pool);
  req.input("username", sql.NVarChar(100), username);
  const resAssign = await req.query(`
    SELECT TOP 1 [template_name], [active]
    FROM dbo.column_access_assignments
    WHERE [username]=@username AND [active]=1
  `);
  const row = (resAssign.recordset || [])[0] as { template_name?: unknown } | undefined;
  const templateName = String(row?.template_name || "").trim();
  if (!templateName) return null;
  const reqTpl = new sql.Request(pool);
  reqTpl.input("template_name", sql.NVarChar(100), templateName);
  let resTpl: sql.IResult<any>;
  try {
    resTpl = await reqTpl.query(`
      SELECT TOP 1 [payload]
      FROM dbo.column_access_templates
      WHERE [template_name]=@template_name
    `);
  } catch {
    return null;
  }
  const trow = (resTpl.recordset || [])[0] as { payload?: unknown } | undefined;
  const payloadStr = typeof trow?.payload === "string" ? (trow?.payload as string) : null;
  if (!payloadStr) return null;
  let items: Array<{ section?: unknown; column?: unknown; read?: unknown }> = [];
  try {
    const parsed = JSON.parse(payloadStr);
    if (Array.isArray(parsed)) items = parsed as any[];
  } catch { return null; }
  const set = new Set<string>();
  for (const it of items) {
    const sec = canonicalSectionKey(String(it.section || ""));
    const col = String(it.column || "").trim().toLowerCase();
    const read = it.read === true;
    if (sec && col && read) set.add(`${sec}.${col}`);
  }
  return set;
}

async function fetchTypeAccessIndex(pool: sql.ConnectionPool) {
  const res = await new sql.Request(pool).query(`
    SELECT [employee_type], [section], [column], [accessible]
    FROM dbo.type_column_access
  `);
  const index: Record<"indonesia" | "expat", Record<string, Record<string, boolean>>> = { indonesia: {}, expat: {} };
  const rows = res.recordset || [];
  for (const r of rows) {
    const type = String((r as any).employee_type || "").toLowerCase() === "expat" ? "expat" : "indonesia";
    const section = String((r as any).section || "");
    const column = String((r as any).column || "");
    const accessible = !!(r as any).accessible;
    if (!index[type][section]) index[type][section] = {};
    index[type][section][column] = accessible;
    if (section.startsWith("Employee ")) {
      const alias = section.slice("Employee ".length);
      if (!index[type][alias]) index[type][alias] = {};
      index[type][alias][column] = accessible;
    }
  }
  return index;
}

reportsRouter.get("/:id", async (req, res) => {
  const roles = req.user?.roles || [];
  if (!roles.some((r) => canAccessReport(r))) return res.status(403).json({ error: "FORBIDDEN_REPORT_ACCESS" });
  const id = String(req.params.id || "");
  if (id === "employees-core") {
    const pool = getPool();
    try {
      await pool.connect();
      const limit = Math.min(parseInt(String(req.query.limit || "200"), 10) || 200, 1000);
      const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
      const typeIndex = await fetchTypeAccessIndex(pool);
      const result = await new sql.Request(pool).query(`
        SELECT
          employee_id, imip_id, name, gender, place_of_birth, date_of_birth, marital_status,
          tax_status, religion, nationality, blood_type, kartu_keluarga_no, ktp_no, education,
          branch_id, branch, npwp, office_email, id_card_mti, residen
        FROM dbo.employee_core
        ORDER BY employee_id
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `);
  const rows = (result.recordset || []) as Array<Record<string, unknown>>;
      const rolesRaw = req.user?.roles || [];
      const readAccess = await buildReadAccess(pool, rolesRaw);
      let tplAllowed: Set<string> | null = null;
      try {
        tplAllowed = req.user?.username ? await loadUserTemplateAllowed(pool, String(req.user.username)) : null;
      } catch {
        tplAllowed = null;
      }
      const data = rows.map((r) => {
        const type = String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expat";
        const allowed = typeIndex[type]["Core"] || {};
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (k === "nationality") {
            out[k] = v;
            continue;
          }
          const canByType = allowed[k] !== false;
          const canByRole = readAccess.canReadColumn("core", k);
          const canByTemplate = !tplAllowed || tplAllowed.has(`core.${String(k).toLowerCase()}`);
          if (canByType && canByRole && canByTemplate) {
            out[k] = v;
          }
        }
        return out;
      });
      return res.json({ id, data, paging: { limit, offset, count: data.length } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_EMPLOYEES_CORE_REPORT";
      return res.status(500).json({ error: message });
    }
  }
  return res.json({ id, data: [], note: "No report configured for this id" });
});

reportsRouter.get("/:id/export", (req, res) => {
  const roles = req.user?.roles || [];
  if (!roles.some((r) => canExportReport(r))) return res.status(403).json({ error: "FORBIDDEN_REPORT_EXPORT" });
  const id = String(req.params.id || "");
  if (id !== "employees-core") return res.status(400).json({ error: "REPORT_NOT_SUPPORTED" });
  const limit = Math.min(parseInt(String(req.query.limit || "1000"), 10) || 1000, 5000);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const pool = getPool();
  (async () => {
    try {
      await pool.connect();
      const typeIndex = await fetchTypeAccessIndex(pool);
      const result = await new sql.Request(pool).query(`
        SELECT
          employee_id, imip_id, name, gender, place_of_birth, date_of_birth, marital_status,
          tax_status, religion, nationality, blood_type, kartu_keluarga_no, ktp_no, education,
          branch_id, branch, npwp, office_email, id_card_mti, residen
        FROM dbo.employee_core
        ORDER BY employee_id
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `);
      const rows = (result.recordset || []) as Array<Record<string, unknown>>;
      const rolesRaw = req.user?.roles || [];
      const readAccess = await buildReadAccess(pool, rolesRaw);
      let tplAllowed: Set<string> | null = null;
      try {
        tplAllowed = req.user?.username ? await loadUserTemplateAllowed(pool, String(req.user.username)) : null;
      } catch {
        tplAllowed = null;
      }
      const gated = rows.map((r) => {
        const type = String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expat";
        const allowed = typeIndex[type]["Core"] || {};
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (k === "nationality") { out[k] = v; continue; }
          const canByType = allowed[k] !== false;
          const canByRole = readAccess.canReadColumn("core", k);
          const canByTemplate = !tplAllowed || tplAllowed.has(`core.${String(k).toLowerCase()}`);
          if (canByType && canByRole && canByTemplate) out[k] = v;
        }
        return out;
      });
      const headers = Array.from(new Set(gated.flatMap((r) => Object.keys(r))));
      const esc = (s: unknown) => {
        const v = s === undefined || s === null ? "" : String(s);
        const q = v.replace(/"/g, '""');
        return `"${q}"`;
      };
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      res.setHeader("Content-Disposition", `attachment; filename="report-employees-core-${ts}.csv"`);
      res.write(headers.map((h) => esc(h)).join(",") + "\r\n");
      for (const row of gated) {
        const line = headers.map((h) => esc(row[h])).join(",");
        res.write(line + "\r\n");
      }
      res.end();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "FAILED_TO_EXPORT";
      res.status(500).json({ error: message });
    } finally {
      await pool.close();
    }
  })();
});
