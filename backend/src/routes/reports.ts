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
        SELECT TOP (${limit})
          employee_id, imip_id, name, gender, place_of_birth, date_of_birth, marital_status,
          tax_status, religion, nationality, blood_type, kartu_keluarga_no, ktp_no, education,
          branch_id, branch, npwp, office_email, id_card_mti
        FROM dbo.employee_core
        ORDER BY employee_id
        OFFSET ${offset} ROWS
      `);
      const rows = (result.recordset || []) as Array<Record<string, unknown>>;
      const data = rows.map((r) => {
        const type = String(r.nationality || "").toLowerCase() === "indonesia" ? "indonesia" : "expat";
        const allowed = typeIndex[type]["Core"] || {};
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (k === "nationality") {
            out[k] = v;
            continue;
          }
          if (allowed[k] !== false) {
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
  return res.json({ id, url: `/downloads/report-${id}.csv` });
});
