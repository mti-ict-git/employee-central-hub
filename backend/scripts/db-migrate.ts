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

      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='anniversary_settings' AND schema_id = SCHEMA_ID('dbo'))
      BEGIN
        CREATE TABLE dbo.anniversary_settings (
          id INT NOT NULL CONSTRAINT PK_anniversary_settings PRIMARY KEY,
          provider NVARCHAR(30) NOT NULL CONSTRAINT DF_anniversary_provider DEFAULT 'nano_banana',
          nano_banana_api_key NVARCHAR(512) NULL,
          openai_api_key NVARCHAR(512) NULL,
          fallback_enabled BIT NOT NULL CONSTRAINT DF_anniversary_fallback DEFAULT 1,
          model_preset NVARCHAR(50) NULL,
          weekly_generation_day NVARCHAR(20) NULL,
          weekly_generation_time NVARCHAR(10) NULL,
          weekly_generation_timezone NVARCHAR(50) NULL,
          updated_at DATETIME2 NOT NULL CONSTRAINT DF_anniversary_settings_updated_at DEFAULT SYSDATETIME()
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM dbo.anniversary_settings WHERE id=1)
      BEGIN
        INSERT INTO dbo.anniversary_settings (id, provider, fallback_enabled, model_preset, weekly_generation_day, weekly_generation_time, weekly_generation_timezone, updated_at)
        VALUES (1, 'nano_banana', 1, NULL, 'Monday', '08:00', 'WITA', SYSDATETIME());
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='anniversary_notifications' AND schema_id = SCHEMA_ID('dbo'))
      BEGIN
        CREATE TABLE dbo.anniversary_notifications (
          id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_anniversary_notifications PRIMARY KEY,
          employee_id VARCHAR(20) NOT NULL,
          anniversary_date DATE NOT NULL,
          type NVARCHAR(20) NOT NULL,
          status NVARCHAR(20) NOT NULL,
          week_start DATE NULL,
          prompt NVARCHAR(MAX) NULL,
          revised_prompt NVARCHAR(MAX) NULL,
          provider_used NVARCHAR(30) NULL,
          image_url NVARCHAR(500) NULL,
          email_subject NVARCHAR(200) NULL,
          email_body_html NVARCHAR(MAX) NULL,
          created_at DATETIME2 NOT NULL CONSTRAINT DF_anniversary_notifications_created_at DEFAULT SYSDATETIME(),
          updated_at DATETIME2 NULL,
          approved_by NVARCHAR(100) NULL,
          approved_at DATETIME2 NULL,
          rejected_by NVARCHAR(100) NULL,
          rejected_at DATETIME2 NULL,
          archived BIT NOT NULL CONSTRAINT DF_anniversary_notifications_archived DEFAULT 0,
          sent_at DATETIME2 NULL
        );
      END;

      IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name='UX_anniversary_notifications_employee_date_type'
          AND object_id = OBJECT_ID('dbo.anniversary_notifications')
      )
      BEGIN
        CREATE UNIQUE INDEX UX_anniversary_notifications_employee_date_type
          ON dbo.anniversary_notifications (employee_id, anniversary_date, type);
      END;
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
