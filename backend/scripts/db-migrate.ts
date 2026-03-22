import path from "path";
import dotenv from "dotenv";
import sql from "mssql";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const bool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
};

async function main() {
  const pool = new sql.ConnectionPool({
    server: String(process.env.DB_SERVER || ""),
    database: String(process.env.DB_DATABASE || ""),
    user: String(process.env.DB_USER || ""),
    password: String(process.env.DB_PASSWORD || ""),
    port: parseInt(String(process.env.DB_PORT || "1433"), 10),
    options: {
      encrypt: bool(process.env.DB_ENCRYPT, false),
      trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
    },
  });

  await pool.connect();
  try {
    await new sql.Request(pool).query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='sync_config' AND schema_id = SCHEMA_ID('dbo'))
      BEGIN
        CREATE TABLE dbo.sync_config (
          id INT NOT NULL CONSTRAINT PK_sync_config PRIMARY KEY,
          enabled BIT NOT NULL CONSTRAINT DF_sync_config_enabled DEFAULT 0,
          schedule NVARCHAR(100) NULL,
          mapping NVARCHAR(MAX) NULL,
          sharepoint NVARCHAR(MAX) NULL,
          sharepoint_auth NVARCHAR(MAX) NULL,
          photo_sync_enabled BIT NULL,
          photo_sync_schedule NVARCHAR(100) NULL,
          updated_at DATETIME2 NOT NULL CONSTRAINT DF_sync_config_updated_at DEFAULT SYSDATETIME()
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM dbo.sync_config WHERE id=1)
      BEGIN
        INSERT INTO dbo.sync_config (id, enabled, schedule, mapping, sharepoint, sharepoint_auth, photo_sync_enabled, photo_sync_schedule, updated_at)
        VALUES (1, 0, NULL, NULL, NULL, NULL, 0, NULL, SYSDATETIME());
      END;

      IF COL_LENGTH('dbo.sync_config', 'sharepoint') IS NULL
        ALTER TABLE dbo.sync_config ADD sharepoint NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.sync_config', 'sharepoint_auth') IS NULL
        ALTER TABLE dbo.sync_config ADD sharepoint_auth NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.sync_config', 'photo_sync_enabled') IS NULL
        ALTER TABLE dbo.sync_config ADD photo_sync_enabled BIT NULL;
      IF COL_LENGTH('dbo.sync_config', 'photo_sync_schedule') IS NULL
        ALTER TABLE dbo.sync_config ADD photo_sync_schedule NVARCHAR(100) NULL;

      IF COL_LENGTH('dbo.employee_core', 'photo_blob') IS NULL
        ALTER TABLE dbo.employee_core ADD photo_blob VARBINARY(MAX) NULL;
    `);

    const result = await new sql.Request(pool).query(`
      SELECT
        COL_LENGTH('dbo.employee_core','photo_blob') AS photo_blob_col,
        COL_LENGTH('dbo.sync_config','photo_sync_enabled') AS photo_sync_enabled_col,
        COL_LENGTH('dbo.sync_config','photo_sync_schedule') AS photo_sync_schedule_col
    `);
    console.log("db:migrate OK", result.recordset?.[0]);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error("db:migrate failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
