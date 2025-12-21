import { Router } from "express";
import sql from "mssql";
import { CONFIG } from "../config";
import crypto from "crypto";

export const usersRouter = Router();

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

function toSource(auth_type?: string | null): "LOCAL" | "DOMAIN" {
  const a = String(auth_type || "").toUpperCase();
  return a === "DOMAIN" ? "DOMAIN" : "LOCAL";
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${key}`;
}

usersRouter.get("/", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    const result = await request.query(`
      SELECT Id, username, name, department, Role, account_locked, auth_type, domain_username, last_login, login_count
      FROM dbo.login
      ORDER BY username
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;
    `);
    const items = (result.recordset || []).map((r) => ({
      id: r.Id,
      username: r.username,
      displayName: r.name,
      department: r.department,
      role: r.Role,
      status: r.account_locked ? "inactive" : "active",
      source: toSource(r.auth_type),
      domain_username: r.domain_username,
      last_login: r.last_login,
      login_count: r.login_count,
    }));
    return res.json({ items, paging: { limit, offset, count: items.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_USERS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.post("/", async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || "").trim();
  const displayName = String(body.displayName || body.name || "").trim();
  const role = String(body.role || "").trim();
  const department = String(body.department || "").trim();
  const source = toSource(body.source || body.auth_type);
  const status = String(body.status || "active").toLowerCase();
  const passwordInput = String(body.password || "");
  const domainUsername = String(body.domain_username || body.username || "").trim();
  if (source === "DOMAIN") {
    return res.status(400).json({ error: "DOMAIN_USERS_AUTO_PROVISIONED" });
  }
  if (!username || !displayName || !role || !department) {
    return res.status(400).json({ error: "USERNAME_NAME_ROLE_DEPARTMENT_REQUIRED" });
  }
  if (source === "LOCAL" && passwordInput.length < 8) {
    return res.status(400).json({ error: "PASSWORD_MIN_LENGTH_8" });
  }
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    const hashed = source === "LOCAL" ? hashPassword(passwordInput) : "";
    request.input("username", sql.VarChar(50), username);
    request.input("password", sql.VarChar(255), hashed);
    request.input("Role", sql.VarChar(50), role);
    request.input("name", sql.VarChar(100), displayName);
    request.input("department", sql.VarChar(100), department);
    request.input("created_at", sql.DateTime2, new Date());
    request.input("account_locked", sql.Bit, status === "inactive" ? 1 : 0);
    request.input("auth_type", sql.NVarChar(20), source);
    request.input("domain_username", sql.NVarChar(100), null);
    request.input("login_count", sql.Int, 0);
    request.input("must_change_password", sql.Bit, source === "LOCAL" ? 0 : 0);
    const result = await request.query(`
      INSERT INTO dbo.login (username, password, Role, name, department, created_at, account_locked, auth_type, domain_username, login_count, must_change_password)
      OUTPUT INSERTED.Id
      VALUES (@username, @password, @Role, @name, @department, @created_at, @account_locked, @auth_type, @domain_username, @login_count, @must_change_password);
    `);
    const insertedId = result.recordset && result.recordset[0] ? result.recordset[0].Id : null;
    return res.json({
      ok: true,
      id: insertedId,
      username,
      displayName,
      role,
      department,
      status: status === "inactive" ? "inactive" : "active",
      source,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_CREATE_USER";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.get("/:id", async (req, res) => {
  const id = parseInt(String(req.params.id || "0"), 10);
  if (!id) return res.status(400).json({ error: "USER_ID_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("Id", sql.Int, id);
    const result = await request.query(`
      SELECT Id, username, name, department, Role, account_locked, auth_type, domain_username, last_login, login_count,
             created_at, created_by, updated_at, updated_by, must_change_password, locked_until
      FROM dbo.login
      WHERE Id = @Id;
    `);
    const r = result.recordset && result.recordset[0];
    if (!r) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const payload = {
      id: r.Id,
      username: r.username,
      displayName: r.name,
      department: r.department,
      role: r.Role,
      status: r.account_locked ? "inactive" : "active",
      source: toSource(r.auth_type),
      domain_username: r.domain_username,
      last_login: r.last_login,
      login_count: r.login_count,
      created_at: r.created_at,
      created_by: r.created_by,
      updated_at: r.updated_at,
      updated_by: r.updated_by,
      must_change_password: r.must_change_password,
      locked_until: r.locked_until,
    };
    return res.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_USER";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.put("/:id/role", async (req, res) => {
  const id = parseInt(String(req.params.id || "0"), 10);
  const role = String((req.body && req.body.role) || "").trim();
  if (!id || !role) return res.status(400).json({ error: "USER_ID_AND_ROLE_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("Id", sql.Int, id);
    request.input("Role", sql.VarChar(50), role);
    await request.query(`UPDATE dbo.login SET Role=@Role, updated_at=SYSDATETIME() WHERE Id=@Id;`);
    return res.json({ ok: true, id, role });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_ROLE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.put("/:id", async (req, res) => {
  const id = parseInt(String(req.params.id || "0"), 10);
  const body = req.body || {};
  const displayName = String(body.displayName || body.name || "").trim();
  const role = String(body.role || "").trim();
  const department = String(body.department || "").trim();
  const status = String(body.status || "").toLowerCase(); // "active" | "inactive"
  if (!id) return res.status(400).json({ error: "USER_ID_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("Id", sql.Int, id);
    if (displayName) request.input("name", sql.VarChar(100), displayName);
    if (role) request.input("Role", sql.VarChar(50), role);
    if (department) request.input("department", sql.VarChar(100), department);
    const account_locked = status === "inactive" ? 1 : 0;
    request.input("account_locked", sql.Bit, account_locked);
    await request.query(`
      UPDATE dbo.login
      SET
        ${displayName ? "name=@name," : ""}
        ${role ? "Role=@Role," : ""}
        ${department ? "department=@department," : ""}
        account_locked=@account_locked,
        updated_at=SYSDATETIME()
      WHERE Id=@Id;
    `);
    return res.json({ ok: true, id, displayName, role, department, status: account_locked ? "inactive" : "active" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_USER";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.put("/:id/lock", async (req, res) => {
  const id = parseInt(String(req.params.id || "0"), 10);
  const lock = Boolean(req.body && req.body.lock);
  const until = req.body && req.body.locked_until ? new Date(req.body.locked_until) : null;
  if (!id) return res.status(400).json({ error: "USER_ID_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("Id", sql.Int, id);
    request.input("account_locked", sql.Bit, lock ? 1 : 0);
    request.input("locked_until", sql.DateTime2, until);
    await request.query(`UPDATE dbo.login SET account_locked=@account_locked, locked_until=@locked_until, updated_at=SYSDATETIME() WHERE Id=@Id;`);
    return res.json({ ok: true, id, account_locked: lock, locked_until: until });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_LOCK";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.delete("/:id", async (req, res) => {
  const id = parseInt(String(req.params.id || "0"), 10);
  if (!id) return res.status(400).json({ error: "USER_ID_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("Id", sql.Int, id);
    await request.query(`DELETE FROM dbo.login WHERE Id=@Id;`);
    return res.json({ ok: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_DELETE_USER";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

usersRouter.post("/:id/reset-password", async (req, res) => {
  const id = parseInt(String(req.params.id || "0"), 10);
  const newPassword = String((req.body && req.body.password) || "").trim();
  if (!id || !newPassword) return res.status(400).json({ error: "USER_ID_AND_PASSWORD_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const request = new sql.Request(pool);
    request.input("Id", sql.Int, id);
    const result = await request.query(`SELECT auth_type FROM dbo.login WHERE Id=@Id;`);
    const r = result.recordset && result.recordset[0];
    if (!r) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const source = toSource(r.auth_type);
    if (source !== "LOCAL") {
      return res.status(400).json({ error: "PASSWORD_RESET_NOT_ALLOWED_FOR_DOMAIN_USERS" });
    }
    const hashed = hashPassword(newPassword);
    request.parameters = {};
    request.input("Id", sql.Int, id);
    request.input("password", sql.VarChar(255), hashed);
    request.input("must_change_password", sql.Bit, 1);
    await request.query(`
      UPDATE dbo.login
      SET password=@password, must_change_password=@must_change_password, password_changed_at=SYSDATETIME(), updated_at=SYSDATETIME()
      WHERE Id=@Id;
    `);
    return res.json({ ok: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_RESET_PASSWORD";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
