import { Router } from "express";
import sql from "mssql";
import { CONFIG } from "../config";
import { authMiddleware, requireRole } from "../middleware/auth";

export const rbacRouter = Router();

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

rbacRouter.use(authMiddleware);

rbacRouter.get("/permissions", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    const result = await new sql.Request(pool).query(`
      SELECT role, module, action, allowed
      FROM dbo.role_permissions
    `);
    const items = (result.recordset || []).map((r) => {
      const row = r as { role: string; module: string; action: string; allowed: number | boolean };
      return {
        role: String(row.role),
        module: String(row.module),
        action: String(row.action),
        allowed: Boolean(row.allowed),
      };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_ROLE_PERMISSIONS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/permissions", requireRole(["admin","superadmin"]), async (req, res) => {
  const body = req.body || {};
  const role = String(body.role || "").trim();
  const module = String(body.module || "").trim();
  const action = String(body.action || "").trim();
  const allowed = Boolean(body.allowed);
  if (!role || !module || !action) return res.status(400).json({ error: "ROLE_MODULE_ACTION_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("role", sql.VarChar(50), role);
    request.input("module", sql.VarChar(50), module);
    request.input("action", sql.VarChar(50), action);
    request.input("allowed", sql.Bit, allowed ? 1 : 0);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.role_permissions WHERE role=@role AND module=@module AND action=@action)
        UPDATE dbo.role_permissions SET allowed=@allowed WHERE role=@role AND module=@module AND action=@action;
      ELSE
        INSERT INTO dbo.role_permissions (role, module, action, allowed) VALUES (@role, @module, @action, @allowed);
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_ROLE_PERMISSION";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/columns", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    const result = await new sql.Request(pool).query(`
      SELECT role, section, column, can_read, can_write
      FROM dbo.role_column_access
    `);
    const items = (result.recordset || []).map((r) => {
      const row = r as { role: string; section: string; column: string; can_read: number | boolean; can_write: number | boolean };
      return {
        role: String(row.role),
        section: String(row.section),
        column: String(row.column),
        read: Boolean(row.can_read),
        write: Boolean(row.can_write),
      };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_COLUMN_ACCESS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/columns", requireRole(["admin","superadmin"]), async (req, res) => {
  const body = req.body || {};
  const role = String(body.role || "").trim();
  const section = String(body.section || "").trim();
  const column = String(body.column || "").trim();
  const read = Boolean(body.read);
  const write = Boolean(body.write);
  if (!role || !section || !column) return res.status(400).json({ error: "ROLE_SECTION_COLUMN_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("role", sql.VarChar(50), role);
    request.input("section", sql.VarChar(50), section);
    request.input("column", sql.VarChar(100), column);
    request.input("can_read", sql.Bit, read ? 1 : 0);
    request.input("can_write", sql.Bit, write ? 1 : 0);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.role_column_access WHERE role=@role AND section=@section AND column=@column)
        UPDATE dbo.role_column_access SET can_read=@can_read, can_write=@can_write WHERE role=@role AND section=@section AND column=@column;
      ELSE
        INSERT INTO dbo.role_column_access (role, section, column, can_read, can_write) VALUES (@role, @section, @column, @can_read, @can_write);
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_COLUMN_ACCESS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
