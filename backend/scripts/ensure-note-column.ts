import path from "path";
import dotenv from "dotenv";
import sql from "mssql";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const env = (key: string, fallback?: string): string => {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
};

const bool = (v: string | undefined, def = false) => {
  if (v === undefined || v === "") return def;
  return ["1", "true", "yes"].includes(v.toLowerCase());
};

const CONFIG = {
  server: env("DB_SERVER"),
  database: env("DB_DATABASE"),
  user: env("DB_USER"),
  password: env("DB_PASSWORD"),
  port: parseInt(process.env.DB_PORT || "1433", 10),
  options: {
    encrypt: bool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
  },
};

async function ensureNoteColumn() {
  const pool = new sql.ConnectionPool({
    server: CONFIG.server,
    database: CONFIG.database,
    user: CONFIG.user,
    password: CONFIG.password,
    port: CONFIG.port,
    options: CONFIG.options,
  });
  await pool.connect();
  const request = new sql.Request(pool);
  const tableExists = await request.query(`
    SELECT 1 AS ok
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'employee_notes';
  `);
  if (!tableExists.recordset.length) {
    await pool.close();
    throw new Error("Missing table dbo.employee_notes");
  }
  const colExists = await request.query(`
    SELECT 1 AS ok
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'employee_notes' AND COLUMN_NAME = 'note';
  `);
  let changed = false;
  if (!colExists.recordset.length) {
    await request.query(`ALTER TABLE dbo.employee_notes ADD note VARCHAR(MAX) NULL;`);
    changed = true;
  }
  await pool.close();
  console.log(changed ? "Added dbo.employee_notes.note" : "dbo.employee_notes.note already exists");
}

ensureNoteColumn().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});

