import sql from "mssql";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
const env = (key: string, fallback?: string) => {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing env: ${key}`);
  }
  return v;
};
const DB = {
  SERVER: env("DB_SERVER"),
  DATABASE: env("DB_DATABASE"),
  USER: env("DB_USER"),
  PASSWORD: env("DB_PASSWORD"),
  PORT: parseInt(env("DB_PORT", "1433"), 10),
  ENCRYPT: (env("DB_ENCRYPT", "false").toLowerCase() === "true"),
  TRUST_SERVER_CERTIFICATE: (env("DB_TRUST_SERVER_CERTIFICATE", "true").toLowerCase() === "true"),
};

async function scanColumns(pool: sql.ConnectionPool, table: string) {
  const res = await new sql.Request(pool).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}'
  `);
  return (res.recordset || []).map((r) => String((r as { COLUMN_NAME: string }).COLUMN_NAME).toLowerCase());
}

function toLabel(s: string) {
  return String(s || "")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

async function main() {
  const pool = new sql.ConnectionPool({
    server: DB.SERVER,
    database: DB.DATABASE,
    user: DB.USER,
    password: DB.PASSWORD,
    port: DB.PORT,
    options: {
      encrypt: DB.ENCRYPT,
      trustServerCertificate: DB.TRUST_SERVER_CERTIFICATE,
    },
  });
  await pool.connect();
  try {
    const cols = await scanColumns(pool, "role_column_access");
    const hasNormalized = cols.includes("role_id") && cols.includes("column_id");
    let rows: Array<{ role: string; section: string; column: string; read: boolean; write: boolean }> = [];
    if (hasNormalized) {
      const rcols = await scanColumns(pool, "roles");
      const ridCol = rcols.includes("role_id") ? "[role_id]" : rcols.includes("id") ? "[id]" : "[role_id]";
      const rnameCol =
        rcols.includes("role") ? "[role]" :
        rcols.includes("name") ? "[name]" :
        rcols.includes("role_name") ? "[role_name]" :
        rcols.includes("role_display_name") ? "[role_display_name]" : "[role]";
      const ccols = await scanColumns(pool, "column_catalog");
      const cidCol = ccols.includes("column_id") ? "[column_id]" : ccols.includes("id") ? "[id]" : "[column_id]";
      const tnameCol = ccols.includes("table_name") ? "[table_name]" : "[table]";
      const cnameCol = ccols.includes("column_name") ? "[column_name]" : "[column]";
      const readExpr = cols.includes("can_view") && cols.includes("can_read")
        ? "(CASE WHEN rca.[can_view]=1 OR rca.[can_read]=1 THEN 1 ELSE 0 END)"
        : (cols.includes("can_view") ? "rca.[can_view]" : "rca.[can_read]");
      const writeExpr = cols.includes("can_edit") && cols.includes("can_write")
        ? "(CASE WHEN rca.[can_edit]=1 OR rca.[can_write]=1 THEN 1 ELSE 0 END)"
        : (cols.includes("can_edit") ? "rca.[can_edit]" : "rca.[can_write]");
      const result = await new sql.Request(pool).query(`
        SELECT
          COALESCE(r.${rnameCol}, CAST(rca.[role_id] AS NVARCHAR(50)), rca.[role]) AS role_name,
          cc.${tnameCol} AS table_name,
          cc.${cnameCol} AS column_name,
          ${readExpr} AS can_read,
          ${writeExpr} AS can_write
        FROM dbo.role_column_access AS rca
        LEFT JOIN dbo.roles AS r ON r.${ridCol} = rca.[role_id]
        LEFT JOIN dbo.column_catalog AS cc ON cc.${cidCol} = rca.[column_id]
        WHERE rca.[role_id] IS NOT NULL AND rca.[column_id] IS NOT NULL
      `);
      rows = (result.recordset || []).map((r) => {
        const role = String((r as any).role_name || "");
        const section = toLabel(String((r as any).table_name || ""));
        const column = String((r as any).column_name || "");
        const read = Boolean((r as any).can_read);
        const write = Boolean((r as any).can_write);
        return { role, section, column, read, write };
      });
    } else if (cols.includes("role") && cols.includes("section") && cols.includes("column")) {
      const result = await new sql.Request(pool).query(`
        SELECT [role], [section], [column], [can_read], [can_write]
        FROM dbo.role_column_access
      `);
      rows = (result.recordset || []).map((r) => {
        const role = String((r as any).role || "");
        const section = toLabel(String((r as any).section || ""));
        const column = String((r as any).column || "");
        const read = Boolean((r as any).can_read);
        const write = Boolean((r as any).can_write);
        return { role, section, column, read, write };
      });
    } else {
      console.log("role_column_access schema not recognized");
      process.exit(2);
    }
    const depRows = rows.filter((r) => r.role.toLowerCase() === "dep_rep" || r.role.toLowerCase() === "department_rep");
    console.log(JSON.stringify({ count: depRows.length, items: depRows }, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
