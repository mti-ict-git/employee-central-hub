import { Router } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { authenticate } from "../auth/ldap";
import { CONFIG } from "../config";
import type { AuthSuccess } from "../types";
import sql from "mssql";
import crypto from "crypto";

export const authRouter = Router();

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

function normalizeRole(role: string): "superadmin" | "admin" | "hr_general" | "finance" | "department_rep" {
  const s = String(role || "").trim().toLowerCase();
  if (s.includes("super")) return "superadmin";
  if (s === "admin") return "admin";
  if (s.includes("hr")) return "hr_general";
  if (s.includes("finance")) return "finance";
  if (s.includes("dep")) return "department_rep";
  return "admin";
}

function verifyPassword(stored: string, input: string): boolean {
  const val = String(stored || "");
  if (val.startsWith("scrypt:")) {
    const parts = val.split(":");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    const buf = crypto.scryptSync(input, salt, 32).toString("hex");
    return buf === key;
  }
  return val === input;
}

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password, provider } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "USERNAME_PASSWORD_REQUIRED" });
    }

    if (String(provider || "").toLowerCase() === "local") {
      const pool = getPool();
      try {
        await pool.connect();
        const request = new sql.Request(pool);
        request.input("username", sql.VarChar(50), username);
        const result = await request.query(`
          SELECT TOP 1 Id, username, name, Role, department, account_locked, locked_until, auth_type, password, must_change_password
          FROM dbo.login
          WHERE username = @username;
        `);
        const r = result.recordset && result.recordset[0];
        if (!r) return res.status(404).json({ error: "USER_NOT_FOUND" });
        if (String(r.auth_type || "").toUpperCase() !== "LOCAL") return res.status(400).json({ error: "NOT_LOCAL_ACCOUNT" });
        if (r.account_locked) return res.status(403).json({ error: "ACCOUNT_LOCKED" });
        if (!verifyPassword(String(r.password || ""), password)) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
        const roleNorm = normalizeRole(r.Role || "");
        const jwtPayload = {
          sub: `local:${r.Id}`,
          username: r.username,
          email: undefined,
          displayName: r.name,
          roles: [roleNorm],
          provider: "local",
        };
        const options: SignOptions = { expiresIn: CONFIG.JWT_EXPIRES_IN as StringValue };
        const token = jwt.sign(jwtPayload, CONFIG.JWT_SECRET as Secret, options);
        await new sql.Request(pool)
          .input("Id", sql.Int, r.Id)
          .query(`UPDATE dbo.login SET last_login=SYSDATETIME(), login_count=login_count+1 WHERE Id=@Id;`);
        const responsePayload: AuthSuccess = {
          token,
          user: {
            dn: `local:${r.Id}`,
            username: r.username,
            displayName: r.name,
            email: undefined,
            roles: [roleNorm],
            provider: "ad",
          },
        };
        return res.json(responsePayload);
      } finally {
        await pool.close();
      }
    }

    try {
      const user = await authenticate(username, password);
      if (!user.roles || user.roles.length === 0) {
        return res.status(403).json({ error: "USER_NOT_IN_ALLOWED_GROUPS" });
      }
      const jwtPayload = {
          sub: user.dn,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          roles: user.roles,
          provider: "ad",
        };
      const options: SignOptions = { expiresIn: CONFIG.JWT_EXPIRES_IN as StringValue };
      const token = jwt.sign(jwtPayload, CONFIG.JWT_SECRET as Secret, options);
      const responsePayload: AuthSuccess = {
        token,
        user: {
          dn: user.dn,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          roles: user.roles,
          provider: "ad",
        },
      };
      // Auto-provision or update domain user record in dbo.login
      const pool = getPool();
      try {
        await pool.connect();
        const request = new sql.Request(pool);
        const primaryRole =
          (user.roles || []).includes("superadmin") ? "SUPERADMIN" :
          (user.roles || []).includes("admin") ? "ADMIN" :
          (user.roles || []).includes("hr_general") ? "HR GENERAL" :
          (user.roles || []).includes("finance") ? "FINANCE" :
          (user.roles || []).includes("department_rep") ? "DEP REP" : "ADMIN";
        request.input("username", sql.VarChar(50), user.username);
        request.input("name", sql.VarChar(100), user.displayName || user.username);
        request.input("Role", sql.VarChar(50), primaryRole);
        request.input("auth_type", sql.NVarChar(20), "DOMAIN");
        request.input("domain_username", sql.NVarChar(100), user.username);
        await request.query(`
          IF EXISTS (SELECT 1 FROM dbo.login WHERE username=@username)
            UPDATE dbo.login SET name=@name, Role=@Role, auth_type=@auth_type, domain_username=@domain_username, last_login=SYSDATETIME(), login_count=login_count+1 WHERE username=@username;
          ELSE
            INSERT INTO dbo.login (username, password, Role, name, department, created_at, account_locked, auth_type, domain_username, login_count, must_change_password)
            VALUES (@username, '', @Role, @name, '', SYSDATETIME(), 0, @auth_type, @domain_username, 1, 0);
        `);
      } finally {
        await pool.close();
      }
      return res.json(responsePayload);
    } catch {
      const pool = getPool();
      try {
        await pool.connect();
        const request = new sql.Request(pool);
        request.input("username", sql.VarChar(50), username);
        const result = await request.query(`
          SELECT TOP 1 Id, username, name, Role, department, account_locked, locked_until, auth_type, password, must_change_password
          FROM dbo.login
          WHERE username = @username;
        `);
        const r = result.recordset && result.recordset[0];
        if (!r) return res.status(404).json({ error: "USER_NOT_FOUND" });
        if (String(r.auth_type || "").toUpperCase() !== "LOCAL") return res.status(400).json({ error: "NOT_LOCAL_ACCOUNT" });
        if (r.account_locked) return res.status(403).json({ error: "ACCOUNT_LOCKED" });
        if (!verifyPassword(String(r.password || ""), password)) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
        const roleNorm = normalizeRole(r.Role || "");
        const jwtPayload = {
          sub: `local:${r.Id}`,
          username: r.username,
          email: undefined,
          displayName: r.name,
          roles: [roleNorm],
          provider: "ad",
        };
        const options: SignOptions = { expiresIn: CONFIG.JWT_EXPIRES_IN as StringValue };
        const token = jwt.sign(jwtPayload, CONFIG.JWT_SECRET as Secret, options);
        await new sql.Request(pool)
          .input("Id", sql.Int, r.Id)
          .query(`UPDATE dbo.login SET last_login=SYSDATETIME(), login_count=login_count+1 WHERE Id=@Id;`);
        const responsePayload: AuthSuccess = {
          token,
          user: {
            dn: `local:${r.Id}`,
            username: r.username,
            displayName: r.name,
            email: undefined,
            roles: [roleNorm],
            provider: "ad",
          },
        };
        return res.json(responsePayload);
      } finally {
        await pool.close();
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AUTH_FAILED";
    const code = message === "USER_NOT_FOUND" ? 404 : 401;
    return res.status(code).json({ error: message });
  }
});
