import { Router } from "express";
import path from "path";
import fs from "fs";
import sql from "mssql";
import { authMiddleware, requireRole } from "../middleware/auth";
import { CONFIG } from "../config";
async function loadXLSX() {
  const mod = await (0, eval)('import("xlsx/xlsx.mjs")');
  return mod;
}
export const mappingRouter = Router();

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

async function ensureDbinfoMappingSchema(pool: sql.ConnectionPool) {
  const hasTableRes = await new sql.Request(pool).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'dbinfo_mappings'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0]);
  if (!hasTable) {
    await new sql.Request(pool).query(`
      CREATE TABLE dbo.dbinfo_mappings (
        [mapping_id] INT IDENTITY(1,1) PRIMARY KEY,
        [excel_table] NVARCHAR(128) NOT NULL,
        [excel_schema] NVARCHAR(128) NOT NULL,
        [excel_column] NVARCHAR(128) NOT NULL,
        [excel_name] NVARCHAR(256) NULL,
        [matched_table] NVARCHAR(256) NULL,
        [matched_column] NVARCHAR(128) NULL,
        [matched_type] NVARCHAR(64) NULL,
        [status] NVARCHAR(32) NULL,
        [updated_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
      CREATE UNIQUE INDEX UX_dbinfo_mappings_excel ON dbo.dbinfo_mappings(excel_table, excel_column);
    `);
    return;
  }
  const colsRes = await new sql.Request(pool).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='dbinfo_mappings'
  `);
  const cols = new Set((colsRes.recordset || []).map((r: any) => String(r.COLUMN_NAME || "").toLowerCase()));
  const ops: string[] = [];
  if (!cols.has("mapping_id")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [mapping_id] INT IDENTITY(1,1) NOT NULL;");
  if (!cols.has("excel_table")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [excel_table] NVARCHAR(128) NOT NULL DEFAULT '';");
  if (!cols.has("excel_schema")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [excel_schema] NVARCHAR(128) NOT NULL DEFAULT 'dbo';");
  if (!cols.has("excel_column")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [excel_column] NVARCHAR(128) NOT NULL DEFAULT '';");
  if (!cols.has("excel_name")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [excel_name] NVARCHAR(256) NULL;");
  if (!cols.has("matched_table")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [matched_table] NVARCHAR(256) NULL;");
  if (!cols.has("matched_column")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [matched_column] NVARCHAR(128) NULL;");
  if (!cols.has("matched_type")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [matched_type] NVARCHAR(64) NULL;");
  if (!cols.has("status")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [status] NVARCHAR(32) NULL;");
  if (!cols.has("updated_at")) ops.push("ALTER TABLE dbo.dbinfo_mappings ADD [updated_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME();");
  for (const q of ops) await new sql.Request(pool).query(q);
}

async function seedDbinfoMappingsIfEmpty(pool: sql.ConnectionPool) {
  const countRes = await new sql.Request(pool).query(`SELECT COUNT(1) AS total FROM dbo.dbinfo_mappings`);
  const total = Number(((countRes.recordset || [])[0] as any)?.total || 0);
  if (total > 0) return;
  const filePath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");
  if (!fs.existsSync(filePath)) return;
  const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows = Array.isArray(existing) ? existing : [];
  for (const r of rows) {
    const excelTable = String(r?.excel?.table || "").trim();
    const excelSchema = String(r?.excel?.schema || "dbo").trim() || "dbo";
    const excelColumn = String(r?.excel?.column || "").trim();
    if (!excelTable || !excelColumn) continue;
    const excelName = String(r?.excel?.excelName || "").trim() || null;
    const matchedTable = String(r?.matched?.table || "").trim() || null;
    const matchedColumn = String(r?.matched?.column || "").trim() || null;
    const matchedType = String(r?.matched?.type || "").trim() || null;
    const status = String(r?.status || "").trim() || null;
    const req = new sql.Request(pool);
    req.input("excel_table", sql.NVarChar(128), excelTable);
    req.input("excel_schema", sql.NVarChar(128), excelSchema);
    req.input("excel_column", sql.NVarChar(128), excelColumn);
    req.input("excel_name", sql.NVarChar(256), excelName);
    req.input("matched_table", sql.NVarChar(256), matchedTable);
    req.input("matched_column", sql.NVarChar(128), matchedColumn);
    req.input("matched_type", sql.NVarChar(64), matchedType);
    req.input("status", sql.NVarChar(32), status);
    await req.query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.dbinfo_mappings
        WHERE LOWER(excel_table)=LOWER(@excel_table) AND LOWER(excel_column)=LOWER(@excel_column)
      )
      INSERT INTO dbo.dbinfo_mappings
        (excel_table, excel_schema, excel_column, excel_name, matched_table, matched_column, matched_type, status)
      VALUES
        (@excel_table, @excel_schema, @excel_column, @excel_name, @matched_table, @matched_column, @matched_type, @status)
    `);
  }
}

async function seedDbinfoMappingsForTable(pool: sql.ConnectionPool, tableName: string) {
  const filePath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");
  if (!fs.existsSync(filePath)) return { restored: 0, total: 0 };
  const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows = Array.isArray(existing) ? existing : [];
  const tableKey = tableName.trim().toLowerCase();
  let restored = 0;
  let total = 0;
  for (const r of rows) {
    const excelTable = String(r?.excel?.table || "").trim();
    if (!excelTable || excelTable.trim().toLowerCase() !== tableKey) continue;
    const excelSchema = String(r?.excel?.schema || "dbo").trim() || "dbo";
    const excelColumn = String(r?.excel?.column || "").trim();
    if (!excelColumn) continue;
    total += 1;
    const excelName = String(r?.excel?.excelName || "").trim() || null;
    const matchedTable = String(r?.matched?.table || "").trim() || null;
    const matchedColumn = String(r?.matched?.column || "").trim() || null;
    const matchedType = String(r?.matched?.type || "").trim() || null;
    const status = String(r?.status || "").trim() || null;
    const req = new sql.Request(pool);
    req.input("excel_table", sql.NVarChar(128), excelTable);
    req.input("excel_schema", sql.NVarChar(128), excelSchema);
    req.input("excel_column", sql.NVarChar(128), excelColumn);
    req.input("excel_name", sql.NVarChar(256), excelName);
    req.input("matched_table", sql.NVarChar(256), matchedTable);
    req.input("matched_column", sql.NVarChar(128), matchedColumn);
    req.input("matched_type", sql.NVarChar(64), matchedType);
    req.input("status", sql.NVarChar(32), status);
    const res = await req.query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.dbinfo_mappings
        WHERE LOWER(excel_table)=LOWER(@excel_table) AND LOWER(excel_column)=LOWER(@excel_column)
      )
      BEGIN
        INSERT INTO dbo.dbinfo_mappings
          (excel_table, excel_schema, excel_column, excel_name, matched_table, matched_column, matched_type, status)
        VALUES
          (@excel_table, @excel_schema, @excel_column, @excel_name, @matched_table, @matched_column, @matched_type, @status)
        SELECT 1 AS inserted;
      END
      ELSE SELECT 0 AS inserted;
    `);
    const inserted = Number(((res.recordset || [])[0] as any)?.inserted || 0);
    restored += inserted;
  }
  return { restored, total };
}

mappingRouter.get("/dbinfo", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureDbinfoMappingSchema(pool);
    await seedDbinfoMappingsIfEmpty(pool);
    const result = await new sql.Request(pool).query(`
      SELECT excel_table, excel_schema, excel_column, excel_name, matched_table, matched_column, matched_type, status
      FROM dbo.dbinfo_mappings
      ORDER BY excel_table, excel_column
    `);
    const items = (result.recordset || []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        excel: {
          table: String(r.excel_table || ""),
          schema: String(r.excel_schema || ""),
          column: String(r.excel_column || ""),
          excelName: r.excel_name ? String(r.excel_name) : undefined,
          usedColumnHeader: "DB Column",
          usedTableHeader: "Table Name",
        },
        matched: {
          table: r.matched_table ? String(r.matched_table) : undefined,
          column: r.matched_column ? String(r.matched_column) : undefined,
          type: r.matched_type ? String(r.matched_type) : undefined,
        },
        status: r.status ? String(r.status) : null,
        suggestion: null,
        suggestions: null,
      };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_DBINFO";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

mappingRouter.get("/dbinfo/tables", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    const result = await new sql.Request(pool).query(`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE='BASE TABLE'
        AND TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    const items = (result.recordset || []).map((row) => {
      const r = row as Record<string, unknown>;
      const schema = String(r.TABLE_SCHEMA || "").trim();
      const table = String(r.TABLE_NAME || "").trim();
      return {
        schema,
        table,
        fullName: schema && table ? `${schema}.${table}` : table,
      };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_LIST_DB_TABLES";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

mappingRouter.post("/dbinfo/restore", authMiddleware, requireRole(["admin", "superadmin"]), async (req, res) => {
  const pool = getPool();
  try {
    const tableRaw = typeof req.body?.table === "string" ? req.body.table : "";
    const table = tableRaw.trim();
    if (!table) {
      return res.status(400).json({ error: "INVALID_RESTORE_INPUT" });
    }
    const excelTable = table.includes(".") ? table.split(".").pop() || table : table;
    await pool.connect();
    await ensureDbinfoMappingSchema(pool);
    const result = await seedDbinfoMappingsForTable(pool, excelTable);
    if (result.total === 0) {
      return res.status(404).json({ error: "MAPPING_SOURCE_NOT_FOUND" });
    }
    return res.json({ ok: true, restored: result.restored, total: result.total });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_RESTORE_DBINFO";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

mappingRouter.post("/dbinfo", authMiddleware, requireRole(["admin", "superadmin"]), async (req, res) => {
  const pool = getPool();
  try {
    const tableRaw = typeof req.body?.table === "string" ? req.body.table : "";
    const columnRaw = typeof req.body?.column === "string" ? req.body.column : "";
    const labelRaw = typeof req.body?.label === "string" ? req.body.label : "";
    const typeRaw = typeof req.body?.type === "string" ? req.body.type : "";
    const table = tableRaw.trim();
    const column = columnRaw.trim();
    if (!table || !column) {
      return res.status(400).json({ error: "INVALID_COLUMN_INPUT" });
    }
    const excelTable = table.includes(".") ? table.split(".").pop() || table : table;
    const schema = table.includes(".") ? (table.split(".")[0] || "dbo") : "dbo";
    const matchedTable = table.includes(".") ? table : `${schema}.${table}`;
    await pool.connect();
    await ensureDbinfoMappingSchema(pool);
    const dupReq = new sql.Request(pool);
    dupReq.input("excel_table", sql.NVarChar(128), excelTable.trim());
    dupReq.input("excel_column", sql.NVarChar(128), column.trim());
    const dupRes = await dupReq.query(`
      SELECT 1 AS ok
      FROM dbo.dbinfo_mappings
      WHERE LOWER(excel_table)=LOWER(@excel_table) AND LOWER(excel_column)=LOWER(@excel_column)
    `);
    if ((dupRes.recordset || [])[0]) {
      return res.status(409).json({ error: "COLUMN_ALREADY_EXISTS" });
    }
    const insertReq = new sql.Request(pool);
    insertReq.input("excel_table", sql.NVarChar(128), excelTable.trim());
    insertReq.input("excel_schema", sql.NVarChar(128), schema.trim());
    insertReq.input("excel_column", sql.NVarChar(128), column.trim());
    insertReq.input("excel_name", sql.NVarChar(256), labelRaw.trim() || null);
    insertReq.input("matched_table", sql.NVarChar(256), matchedTable.trim());
    insertReq.input("matched_column", sql.NVarChar(128), column.trim());
    insertReq.input("matched_type", sql.NVarChar(64), typeRaw.trim() || null);
    insertReq.input("status", sql.NVarChar(32), "manual_added");
    await insertReq.query(`
      INSERT INTO dbo.dbinfo_mappings
        (excel_table, excel_schema, excel_column, excel_name, matched_table, matched_column, matched_type, status)
      VALUES
        (@excel_table, @excel_schema, @excel_column, @excel_name, @matched_table, @matched_column, @matched_type, @status)
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_DBINFO";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

mappingRouter.delete("/dbinfo", authMiddleware, requireRole(["admin", "superadmin"]), async (req, res) => {
  const pool = getPool();
  try {
    const tableRaw = typeof req.body?.table === "string" ? req.body.table : "";
    const columnRaw = typeof req.body?.column === "string" ? req.body.column : "";
    const table = tableRaw.trim();
    const column = columnRaw.trim();
    if (!table) {
      return res.status(400).json({ error: "INVALID_DELETE_INPUT" });
    }
    const excelTable = table.includes(".") ? table.split(".").pop() || table : table;
    await pool.connect();
    await ensureDbinfoMappingSchema(pool);
    const sqlReq = new sql.Request(pool);
    sqlReq.input("excel_table", sql.NVarChar(128), excelTable.trim());
    sqlReq.input("excel_column", sql.NVarChar(128), column.trim());
    sqlReq.input("has_column", sql.Bit, column ? 1 : 0);
    const delRes = await sqlReq.query(`
      DELETE FROM dbo.dbinfo_mappings
      WHERE LOWER(excel_table)=LOWER(@excel_table)
        AND (@has_column=0 OR LOWER(excel_column)=LOWER(@excel_column));
      SELECT @@ROWCOUNT AS removed;
    `);
    const removed = Number(((delRes.recordset || [])[0] as any)?.removed || 0);
    if (removed === 0) {
      return res.status(404).json({ error: "MAPPING_NOT_FOUND" });
    }
    const countRes = await new sql.Request(pool).query(`SELECT COUNT(1) AS total FROM dbo.dbinfo_mappings`);
    const remaining = Number(((countRes.recordset || [])[0] as any)?.total || 0);
    return res.json({ ok: true, removed, remaining });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_DELETE_DBINFO";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

mappingRouter.get("/type-columns", async (_req, res) => {
  try {
    const excelPath = path.resolve(process.cwd(), "..", "public", "Comben Master Data Column Assignment2.xlsx");
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: "TYPE_EXCEL_NOT_FOUND" });
    }
    const data = fs.readFileSync(excelPath);
    const XLSX = await loadXLSX();
    const wb = XLSX.read(data, { type: "buffer" });
    const sheet = wb.Sheets["DB Schema"] || wb.Sheets["Column Assignment"] || wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      return res.status(400).json({ error: "TYPE_SHEET_NOT_FOUND" });
    }
    const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows.length) return res.json([]);
    const headers = Object.keys(rows[0]).map((h) => String(h));
    const resolve = (cands: string[]) => {
      for (const c of cands) {
        const hit = headers.find((h) => h.trim().toLowerCase() === c.trim().toLowerCase());
        if (hit) return hit;
      }
      return undefined;
    };
    const tableKey = resolve(["Table", "Existing Table Name", "existing table name"]);
    const columnKey = resolve(["DB Schema", "DB Column", "Mapping to Existing DB Schema", "mapping to existing db schema"]);
    const indoKey = resolve(["Indonesia", "Indo"]);
    const expatKey = resolve(["Expat", "Expatriate"]);
    const tokens = (s: string) => s.replace(/_/g, " ").trim().split(" ").filter(Boolean);
    const toLabel = (s: string) =>
      tokens(s)
        .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ");
    const out: Array<{ section: string; column: string; indonesia: boolean; expat: boolean }> = [];
    for (const r of rows) {
      const tableName = tableKey ? String(r[tableKey] || "").trim() : "";
      const columnNameRaw = columnKey ? String(r[columnKey] || "").trim() : "";
      const columnName = (() => {
        if (!columnNameRaw) return "";
        const parts = columnNameRaw.split(".").map((p) => p.trim()).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : columnNameRaw;
      })();
      if (!tableName || !columnName) continue;
      const indVal = indoKey ? String(r[indoKey] || "").trim().toUpperCase() : "";
      const expVal = expatKey ? String(r[expatKey] || "").trim().toUpperCase() : "";
      const indonesia = indVal === "Y";
      const expat = expVal === "Y";
      out.push({ section: toLabel(tableName), column: columnName, indonesia, expat });
    }
    return res.json(out);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_TYPE_COLUMNS";
    return res.status(500).json({ error: message });
  }
});
