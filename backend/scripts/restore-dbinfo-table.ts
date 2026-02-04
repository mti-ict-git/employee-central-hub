import fs from "fs";
import path from "path";
import sql from "mssql";
import { CONFIG } from "../src/config";

async function main() {
  const tableKey = String(process.argv[2] || "").trim().toLowerCase();
  if (!tableKey) {
    console.error("TABLE_REQUIRED");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");
  if (!fs.existsSync(filePath)) {
    console.error("MAPPING_SOURCE_NOT_FOUND");
    process.exit(2);
  }

  const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const rows = Array.isArray(existing) ? existing : [];

  const pool = new sql.ConnectionPool({
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

  await pool.connect();

  const createSql =
    "IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'dbinfo_mappings') BEGIN CREATE TABLE dbo.dbinfo_mappings ([mapping_id] INT IDENTITY(1,1) PRIMARY KEY, [excel_table] NVARCHAR(128) NOT NULL, [excel_schema] NVARCHAR(128) NOT NULL, [excel_column] NVARCHAR(128) NOT NULL, [excel_name] NVARCHAR(256) NULL, [matched_table] NVARCHAR(256) NULL, [matched_column] NVARCHAR(128) NULL, [matched_type] NVARCHAR(64) NULL, [status] NVARCHAR(32) NULL, [updated_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME()); CREATE UNIQUE INDEX UX_dbinfo_mappings_excel ON dbo.dbinfo_mappings(excel_table, excel_column); END";
  await new sql.Request(pool).query(createSql);

  let restored = 0;
  let total = 0;
  const insertSql =
    "IF NOT EXISTS (SELECT 1 FROM dbo.dbinfo_mappings WHERE LOWER(excel_table)=LOWER(@excel_table) AND LOWER(excel_column)=LOWER(@excel_column)) BEGIN INSERT INTO dbo.dbinfo_mappings (excel_table, excel_schema, excel_column, excel_name, matched_table, matched_column, matched_type, status) VALUES (@excel_table, @excel_schema, @excel_column, @excel_name, @matched_table, @matched_column, @matched_type, @status); SELECT 1 AS inserted; END ELSE SELECT 0 AS inserted;";

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
    const res = await req.query(insertSql);
    const inserted = Number(((res.recordset || [])[0] as any)?.inserted || 0);
    restored += inserted;
  }

  await pool.close();
  console.log(JSON.stringify({ ok: true, table: tableKey, restored, total }));
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err || "FAILED_TO_RESTORE_DBINFO");
  console.error(message);
  process.exit(1);
});
