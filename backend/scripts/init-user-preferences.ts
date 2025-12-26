import sql from "mssql";
import { CONFIG } from "../src/config";

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
  try {
    await pool.connect();
    const hasTableRes = await new sql.Request(pool).query(`
      SELECT 1 AS ok FROM sys.tables WHERE name = 'user_preferences'
    `);
    const hasTable = !!((hasTableRes.recordset || [])[0]);
    if (!hasTable) {
      await new sql.Request(pool).query(`
        CREATE TABLE dbo.user_preferences (
          [pref_id] INT IDENTITY(1,1) PRIMARY KEY,
          [user_id] INT NOT NULL,
          [pref_key] NVARCHAR(100) NOT NULL,
          [pref_value] NVARCHAR(MAX) NULL,
          [updated_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME()
        );
        CREATE UNIQUE INDEX UX_user_preferences_user_key ON dbo.user_preferences(user_id, pref_key);
      `);
      console.log("Created dbo.user_preferences");
    } else {
      console.log("dbo.user_preferences already exists");
    }
  } catch (err) {
    console.error("Failed to ensure user_preferences", err);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

main();

