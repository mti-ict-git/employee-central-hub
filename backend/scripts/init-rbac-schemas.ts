import sql from "mssql";
import { CONFIG } from "../src/config";

async function scanColumns(pool: sql.ConnectionPool, table: string) {
  const res = await new sql.Request(pool).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}'
  `);
  return (res.recordset || []).map((r) => String((r as { COLUMN_NAME: string }).COLUMN_NAME).toLowerCase());
}

async function ensureRolePermissionsSchema(pool: sql.ConnectionPool) {
  const cols = await scanColumns(pool, "role_permissions");
  const ops: string[] = [];
  if (!cols.includes("role") && !cols.includes("role_id")) {
    ops.push("ALTER TABLE dbo.role_permissions ADD [role] NVARCHAR(50) NULL;");
  }
  if (!cols.includes("module") && !cols.includes("permission_module")) {
    ops.push("ALTER TABLE dbo.role_permissions ADD [module] NVARCHAR(50) NULL;");
  }
  if (!cols.includes("action") && !cols.includes("permission_action")) {
    ops.push("ALTER TABLE dbo.role_permissions ADD [action] NVARCHAR(50) NULL;");
  }
  if (!cols.includes("allowed") && !cols.includes("is_allowed")) {
    ops.push("ALTER TABLE dbo.role_permissions ADD [allowed] BIT NULL;");
  }
  for (const q of ops) await new sql.Request(pool).query(q);
  console.log("role_permissions schema ensured");
}

async function ensureRoleColumnAccessSchema(pool: sql.ConnectionPool) {
  const hasTableRes = await new sql.Request(pool).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'role_column_access'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0]);
  if (!hasTable) {
    await new sql.Request(pool).query(`
      CREATE TABLE dbo.role_column_access (
        [role] NVARCHAR(50) NOT NULL,
        [section] NVARCHAR(50) NOT NULL,
        [column] NVARCHAR(100) NOT NULL,
        [can_read] BIT NOT NULL CONSTRAINT DF_role_column_access_can_read DEFAULT 0,
        [can_write] BIT NOT NULL CONSTRAINT DF_role_column_access_can_write DEFAULT 0,
        CONSTRAINT PK_role_column_access PRIMARY KEY CLUSTERED ([role], [section], [column])
      )
    `);
  } else {
    const cols = await scanColumns(pool, "role_column_access");
    const ops: string[] = [];
    if (!cols.includes("role")) ops.push("ALTER TABLE dbo.role_column_access ADD [role] NVARCHAR(50) NOT NULL DEFAULT '';");
    if (!cols.includes("section")) ops.push("ALTER TABLE dbo.role_column_access ADD [section] NVARCHAR(50) NOT NULL DEFAULT '';");
    if (!cols.includes("column")) ops.push("ALTER TABLE dbo.role_column_access ADD [column] NVARCHAR(100) NOT NULL DEFAULT '';");
    if (!cols.includes("can_read")) ops.push("ALTER TABLE dbo.role_column_access ADD [can_read] BIT NOT NULL DEFAULT 0;");
    if (!cols.includes("can_write")) ops.push("ALTER TABLE dbo.role_column_access ADD [can_write] BIT NOT NULL DEFAULT 0;");
    for (const q of ops) await new sql.Request(pool).query(q);
  }
  console.log("role_column_access schema ensured");
}

async function ensureTypeColumnAccessSchema(pool: sql.ConnectionPool) {
  const hasTableRes = await new sql.Request(pool).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'type_column_access'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0]);
  if (!hasTable) {
    await new sql.Request(pool).query(`
      CREATE TABLE dbo.type_column_access (
        [employee_type] NVARCHAR(20) NOT NULL,
        [section] NVARCHAR(50) NOT NULL,
        [column] NVARCHAR(100) NOT NULL,
        [accessible] BIT NOT NULL CONSTRAINT DF_type_column_access_accessible DEFAULT 0,
        CONSTRAINT PK_type_column_access PRIMARY KEY CLUSTERED ([employee_type], [section], [column])
      )
    `);
  } else {
    const cols = await scanColumns(pool, "type_column_access");
    const ops: string[] = [];
    if (!cols.includes("employee_type")) ops.push("ALTER TABLE dbo.type_column_access ADD [employee_type] NVARCHAR(20) NOT NULL DEFAULT '';");
    if (!cols.includes("section")) ops.push("ALTER TABLE dbo.type_column_access ADD [section] NVARCHAR(50) NOT NULL DEFAULT '';");
    if (!cols.includes("column")) ops.push("ALTER TABLE dbo.type_column_access ADD [column] NVARCHAR(100) NOT NULL DEFAULT '';");
    if (!cols.includes("accessible")) ops.push("ALTER TABLE dbo.type_column_access ADD [accessible] BIT NOT NULL DEFAULT 0;");
    for (const q of ops) await new sql.Request(pool).query(q);
  }
  console.log("type_column_access schema ensured");
}

async function ensureColumnAccessTemplateSchema(pool: sql.ConnectionPool) {
  const hasTableRes = await new sql.Request(pool).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'column_access_templates'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0]);
  if (!hasTable) {
    await new sql.Request(pool).query(`
      CREATE TABLE dbo.column_access_templates (
        [template_name] NVARCHAR(100) NOT NULL PRIMARY KEY,
        [payload] NVARCHAR(MAX) NULL,
        [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_column_access_templates_updated_at DEFAULT SYSDATETIME()
      )
    `);
  } else {
    const cols = await scanColumns(pool, "column_access_templates");
    const ops: string[] = [];
    if (!cols.includes("template_name")) ops.push("ALTER TABLE dbo.column_access_templates ADD [template_name] NVARCHAR(100) NOT NULL DEFAULT '';");
    if (!cols.includes("payload")) ops.push("ALTER TABLE dbo.column_access_templates ADD [payload] NVARCHAR(MAX) NULL;");
    if (!cols.includes("updated_at")) ops.push("ALTER TABLE dbo.column_access_templates ADD [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_column_access_templates_updated_at DEFAULT SYSDATETIME();");
    for (const q of ops) await new sql.Request(pool).query(q);
  }
  console.log("column_access_templates schema ensured");
}

async function main() {
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
  try {
    await ensureRolePermissionsSchema(pool);
    await ensureRoleColumnAccessSchema(pool);
    await ensureTypeColumnAccessSchema(pool);
    await ensureColumnAccessTemplateSchema(pool);
    console.log("RBAC schemas ensured");
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

