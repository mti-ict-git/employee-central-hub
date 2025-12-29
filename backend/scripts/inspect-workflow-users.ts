import path from "path";
import dotenv from "dotenv";
import sql from "mssql";
import fs from "fs";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const server = process.env.DB_SERVER || "";
  const user = process.env.DB_USER || "";
  const password = process.env.DB_PASSWORD || "";
  const port = parseInt(process.env.DB_PORT || "1433", 10);
  const encrypt = (process.env.DB_ENCRYPT || "false").toLowerCase() === "true";
  const trustServerCertificate = (process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true";
  const defaultDb = process.env.DB_DATABASE || "";

  const pool = new sql.ConnectionPool({
    server,
    user,
    password,
    database: defaultDb,
    port,
    options: {
      encrypt,
      trustServerCertificate,
    },
  });

  const lines: string[] = [];
  const push = (s: string) => { lines.push(s); console.log(s); };

  try {
    await pool.connect();
    push(`# EmployeeWorkflow.dbo.MTIUsers Inspection`);
    push("");
    push(`- server: ${server}`);
    push(`- default_database: ${defaultDb}`);
    push(`- target_database: EmployeeWorkflow`);
    push("");

    let schemaRes: sql.IResult<any>;
    try {
      schemaRes = await new sql.Request(pool).query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM EmployeeWorkflow.INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='MTIUsers'
        ORDER BY ORDINAL_POSITION
      `);
    } catch (err) {
      throw new Error(`Failed to read schema for EmployeeWorkflow.dbo.MTIUsers: ${(err as Error).message}`);
    }
    const cols = schemaRes.recordset || [];
    push("## Columns");
    for (const c of cols) {
      const col = c as { COLUMN_NAME?: string; DATA_TYPE?: string; IS_NULLABLE?: string };
      push(`- ${col.COLUMN_NAME} · ${col.DATA_TYPE} · nullable=${String(col.IS_NULLABLE).toUpperCase() === "YES"}`);
    }
    push("");

    let topRes: sql.IResult<any>;
    try {
      topRes = await new sql.Request(pool).query(`
        SELECT TOP 10 *
        FROM EmployeeWorkflow.dbo.MTIUsers
        ORDER BY 1
      `);
    } catch (err) {
      throw new Error(`Failed to read sample rows from EmployeeWorkflow.dbo.MTIUsers: ${(err as Error).message}`);
    }
    const rows = topRes.recordset || [];
    push("## Sample Rows (TOP 10)");
    for (const r of rows) {
      push(`- ${JSON.stringify(r)}`);
    }
    push("");

    const outPath = path.resolve(process.cwd(), "scripts", "workflow-mtiusers.md");
    fs.writeFileSync(outPath, lines.join("\n"));
    console.log(`Wrote: ${outPath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

main();
