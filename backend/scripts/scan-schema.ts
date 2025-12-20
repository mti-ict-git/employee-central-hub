import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import sql from "mssql";

// Load root .env (the backend runs in ./backend)
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const bool = (v: string | undefined, def = false) => {
  if (v === undefined || v === "") return def;
  return ["1", "true", "yes"].includes(v.toLowerCase());
};

const env = (key: string, fallback?: string): string => {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
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

type ColumnDef = {
  name: string;
  type: string;
  nullable: boolean;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
};

type ForeignKeyDef = {
  name: string;
  column: string;
  references: string;
};

type TableDef = {
  columns: ColumnDef[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDef[];
};

type SchemaMap = Record<string, TableDef>;

async function scanSchema() {
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

  // Tables
  const tablesRes = await request.query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_SCHEMA, TABLE_NAME;
  `);

  // Columns
  const colsRes = await request.query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE,
           CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;
  `);

  // Primary keys
  const pkRes = await request.query(`
    SELECT tc.TABLE_SCHEMA, tc.TABLE_NAME, ku.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
      ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
     AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
     AND tc.TABLE_NAME = ku.TABLE_NAME
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, ku.ORDINAL_POSITION;
  `);

  // Foreign keys
  const fkRes = await request.query(`
    SELECT fk.CONSTRAINT_SCHEMA AS FK_SCHEMA,
           fk.CONSTRAINT_NAME   AS FK_NAME,
           fk.TABLE_SCHEMA      AS FK_TABLE_SCHEMA,
           fk.TABLE_NAME        AS FK_TABLE_NAME,
           cu.COLUMN_NAME       AS FK_COLUMN_NAME,
           pk.TABLE_SCHEMA      AS PK_TABLE_SCHEMA,
           pk.TABLE_NAME        AS PK_TABLE_NAME,
           pt.COLUMN_NAME       AS PK_COLUMN_NAME
    FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS fk
      ON rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk
      ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE cu
      ON rc.CONSTRAINT_NAME = cu.CONSTRAINT_NAME
    JOIN (
      SELECT i1.TABLE_NAME, i1.TABLE_SCHEMA, i2.CONSTRAINT_NAME, i2.COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE i1
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE i2
        ON i1.CONSTRAINT_NAME = i2.CONSTRAINT_NAME
    ) pt
      ON pt.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
    WHERE fk.CONSTRAINT_TYPE = 'FOREIGN KEY'
    ORDER BY fk.TABLE_SCHEMA, fk.TABLE_NAME, cu.ORDINAL_POSITION;
  `);

  const schema: SchemaMap = {};
  for (const row of tablesRes.recordset) {
    const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
    schema[key] = { columns: [], primaryKey: [], foreignKeys: [] };
  }

  for (const c of colsRes.recordset) {
    const key = `${c.TABLE_SCHEMA}.${c.TABLE_NAME}`;
    if (!schema[key]) schema[key] = { columns: [], primaryKey: [], foreignKeys: [] };
    schema[key].columns.push({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      nullable: c.IS_NULLABLE === "YES",
      maxLength: c.CHARACTER_MAXIMUM_LENGTH ?? null,
      precision: c.NUMERIC_PRECISION ?? null,
      scale: c.NUMERIC_SCALE ?? null,
    });
  }

  for (const p of pkRes.recordset) {
    const key = `${p.TABLE_SCHEMA}.${p.TABLE_NAME}`;
    if (!schema[key]) schema[key] = { columns: [], primaryKey: [], foreignKeys: [] };
    schema[key].primaryKey.push(p.COLUMN_NAME);
  }

  for (const f of fkRes.recordset) {
    const key = `${f.FK_TABLE_SCHEMA}.${f.FK_TABLE_NAME}`;
    if (!schema[key]) schema[key] = { columns: [], primaryKey: [], foreignKeys: [] };
    schema[key].foreignKeys.push({
      name: f.FK_NAME,
      column: f.FK_COLUMN_NAME,
      references: `${f.PK_TABLE_SCHEMA}.${f.PK_TABLE_NAME}(${f.PK_COLUMN_NAME})`,
    });
  }

  await pool.close();

  // Write outputs
  const outDir = path.resolve(process.cwd(), "scripts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "schema.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ database: CONFIG.database, schema }, null, 2));

  const mdLines: string[] = [];
  mdLines.push(`# Database Schema Report`);
  mdLines.push(`Database: ${CONFIG.database}`);
  mdLines.push("");
  for (const tbl of Object.keys(schema)) {
    const info = schema[tbl];
    mdLines.push(`## ${tbl}`);
    mdLines.push("- Columns:");
    for (const col of info.columns) {
      mdLines.push(
        `  - ${col.name}: ${col.type}${col.nullable ? " (nullable)" : ""}` +
        `${col.maxLength ? `, len=${col.maxLength}` : ""}` +
        `${col.precision ? `, precision=${col.precision}` : ""}` +
        `${col.scale ? `, scale=${col.scale}` : ""}`
      );
    }
    if (info.primaryKey.length) {
      mdLines.push(`- Primary Key: ${info.primaryKey.join(", ")}`);
    }
    if (info.foreignKeys.length) {
      mdLines.push("- Foreign Keys:");
      for (const fk of info.foreignKeys) {
        mdLines.push(`  - ${fk.name}: ${fk.column} → ${fk.references}`);
      }
    }
    mdLines.push("");
  }

  const mdPath = path.join(outDir, "schema-report.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"));

  console.log(`Schema saved to: \n- ${jsonPath}\n- ${mdPath}`);
}

scanSchema().catch((err) => {
  console.error("Schema scan failed:", err.message);
  process.exit(1);
});