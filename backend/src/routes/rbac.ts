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

function extractDbErrorDetails(err: unknown): { code?: string; number?: number; state?: string; name?: string } | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const o = err as { [k: string]: unknown };
  const code = typeof o.code === "string" ? o.code : undefined;
  const number = typeof o.number === "number" ? o.number : undefined;
  const state = typeof o.state === "string" ? o.state : undefined;
  const name = typeof (err as Error).name === "string" ? (err as Error).name : undefined;
  if (!code && !number && !state && !name) return undefined;
  return { code, number, state, name };
}
async function scanColumns(pool: sql.ConnectionPool, table: string) {
  const res = await new sql.Request(pool).query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${table}'
  `);
  return (res.recordset || []).map((r) => String((r as { COLUMN_NAME: string }).COLUMN_NAME).toLowerCase());
}

function normalizeRoleName(role: string) {
  const s = String(role || "").trim().toLowerCase();
  if (s.includes("super")) return "superadmin";
  if (s === "admin") return "admin";
  if (s.includes("human resources") || s.includes("human resource")) return "hr_general";
  if (s.includes("hr")) return "hr_general";
  if (s.includes("finance")) return "finance";
  if (s.includes("dep")) return "department_rep";
  if (s.includes("employee")) return "employee";
  return s;
}

function isSuperadminRequest(req: { user?: { roles?: string[] } }): boolean {
  const roles = Array.isArray(req.user?.roles) ? req.user?.roles : [];
  return roles.includes("superadmin");
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
}

async function ensureColumnAccessAssignmentSchema(pool: sql.ConnectionPool) {
  const hasTableRes = await new sql.Request(pool).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = 'column_access_assignments'
  `);
  const hasTable = !!((hasTableRes.recordset || [])[0]);
  if (!hasTable) {
    await new sql.Request(pool).query(`
      CREATE TABLE dbo.column_access_assignments (
        [username] NVARCHAR(100) NOT NULL PRIMARY KEY,
        [template_name] NVARCHAR(100) NOT NULL,
        [active] BIT NOT NULL CONSTRAINT DF_column_access_assignments_active DEFAULT 1,
        [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_column_access_assignments_updated_at DEFAULT SYSDATETIME()
      )
    `);
  } else {
    const cols = await scanColumns(pool, "column_access_assignments");
    const ops: string[] = [];
    if (!cols.includes("username")) ops.push("ALTER TABLE dbo.column_access_assignments ADD [username] NVARCHAR(100) NOT NULL DEFAULT '';");
    if (!cols.includes("template_name")) ops.push("ALTER TABLE dbo.column_access_assignments ADD [template_name] NVARCHAR(100) NOT NULL DEFAULT '';");
    if (!cols.includes("active")) ops.push("ALTER TABLE dbo.column_access_assignments ADD [active] BIT NOT NULL CONSTRAINT DF_column_access_assignments_active DEFAULT 1;");
    if (!cols.includes("updated_at")) ops.push("ALTER TABLE dbo.column_access_assignments ADD [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_column_access_assignments_updated_at DEFAULT SYSDATETIME();");
    for (const q of ops) await new sql.Request(pool).query(q);
  }
}

rbacRouter.get("/roles", async (req, res) => {
  const isSuperadmin = isSuperadminRequest(req);
  const pool = getPool();
  try {
    await pool.connect();
    const cols = await scanColumns(pool, "roles");
    const pick = (names: string[]) => {
      for (const n of names) if (cols.includes(n)) return `[${n}]`;
      return null;
    };
    const nameCol = pick(["role","name","role_name","display_name"]);
    let roles: string[] = [];
    if (nameCol) {
      const byRoles = await new sql.Request(pool).query(`
        SELECT DISTINCT ${nameCol} AS role
        FROM dbo.roles
        WHERE ${nameCol} IS NOT NULL AND LTRIM(RTRIM(${nameCol})) <> ''
        ORDER BY ${nameCol}
      `);
      roles = (byRoles.recordset || []).map((r) => normalizeRoleName(String((r as { role: string }).role)));
    }
    // Fallback to role_permissions if roles table is empty or has no suitable name column
    if (!roles.length) {
      const rpCols = await scanColumns(pool, "role_permissions");
      const roleTextCol = rpCols.includes("role") ? "[role]" : null;
      const roleIdCol = rpCols.includes("role_id") ? "[role_id]" : null;
      const moduleCol = rpCols.includes("module") ? "[module]" : (rpCols.includes("permission_module") ? "[permission_module]" : null);
      const actionCol = rpCols.includes("action") ? "[action]" : (rpCols.includes("permission_action") ? "[permission_action]" : null);
      if (roleTextCol) {
        const byText = await new sql.Request(pool).query(`
          SELECT DISTINCT ${roleTextCol} AS role
          FROM dbo.role_permissions
          WHERE ${roleTextCol} IS NOT NULL AND LTRIM(RTRIM(${roleTextCol})) <> ''
          ORDER BY ${roleTextCol}
        `);
        roles = (byText.recordset || []).map((r) => normalizeRoleName(String((r as { role: string }).role)));
      } else if (roleIdCol && nameCol) {
        const byJoin = await new sql.Request(pool).query(`
          SELECT DISTINCT r.${nameCol} AS role
          FROM dbo.role_permissions AS p
          LEFT JOIN dbo.roles AS r ON r.[role_id] = p.${roleIdCol}
          WHERE r.${nameCol} IS NOT NULL AND LTRIM(RTRIM(r.${nameCol})) <> ''
          ORDER BY r.${nameCol}
        `);
        roles = (byJoin.recordset || []).map((r) => normalizeRoleName(String((r as { role: string }).role)));
      }
    }
    if (!roles.length) {
      const byLogin = await new sql.Request(pool).query(`
        SELECT DISTINCT [Role] AS role
        FROM dbo.login
        WHERE [Role] IS NOT NULL AND LTRIM(RTRIM([Role])) <> ''
        ORDER BY [Role]
      `);
      roles = (byLogin.recordset || []).map((r) => normalizeRoleName(String((r as { role: string }).role)));
    }
    const baseline = isSuperadmin
      ? ["superadmin", "admin", "hr_general", "finance", "department_rep", "employee"]
      : ["admin", "hr_general", "finance", "department_rep", "employee"];
    const dedup = Array.from(new Set([...roles, ...baseline]));
    const out = isSuperadmin ? dedup : dedup.filter((r) => normalizeRoleName(r) !== "superadmin");
    return res.json(out);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_ROLES";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/type_columns", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureTypeColumnAccessSchema(pool);
    const result = await new sql.Request(pool).query(`
      SELECT [employee_type], [section], [column], [accessible]
      FROM dbo.type_column_access
    `);
    const items = (result.recordset || []).map((r) => {
      const row = r as { employee_type?: string; section?: string; column?: string; accessible?: number | boolean };
      const raw = String(row.employee_type || "").trim().toLowerCase();
      const type = raw.startsWith("expat") ? "expat" : "indonesia";
      return {
        type,
        section: String(row.section || ""),
        column: String(row.column || ""),
        accessible: !!row.accessible,
      };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_TYPE_COLUMNS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/type_columns", requireRole(["admin","superadmin"]), async (req, res) => {
  const body = req.body || {};
  const type = String(body.type || "").toLowerCase() === "expat" ? "expat" : "indonesia";
  const section = String(body.section || "");
  const column = String(body.column || "");
  const accessible = !!body.accessible;
  if (!section || !column) return res.status(400).json({ error: "INVALID_TYPE_COLUMN" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureTypeColumnAccessSchema(pool);
    const request = new sql.Request(pool);
    request.input("employee_type", sql.NVarChar(20), type);
    request.input("section", sql.NVarChar(50), section);
    request.input("column", sql.NVarChar(100), column);
    request.input("accessible", sql.Bit, accessible ? 1 : 0);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.type_column_access WHERE [employee_type]=@employee_type AND [section]=@section AND [column]=@column)
        UPDATE dbo.type_column_access SET [accessible]=@accessible WHERE [employee_type]=@employee_type AND [section]=@section AND [column]=@column;
      ELSE
        INSERT INTO dbo.type_column_access ([employee_type], [section], [column], [accessible]) VALUES (@employee_type, @section, @column, @accessible);
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_TYPE_COLUMNS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/permissions", async (req, res) => {
  const isSuperadmin = isSuperadminRequest(req);
  const pool = getPool();
  try {
    await pool.connect();
    const cols = await scanColumns(pool, "role_permissions");
    const pick = (names: string[]) => {
      for (const n of names) if (cols.includes(n)) return `[${n}]`;
      return null;
    };
    const roleIdCol = pick(["role_id"]);
    const roleTextCol = pick(["role"]);
    const allowedCol = pick(["is_allowed", "allowed"]);
    const moduleCol = pick(["module", "permission_module"]);
    const actionCol = pick(["action", "permission_action"]);
    const hasRoleId = !!roleIdCol;
    if (!allowedCol || !moduleCol || !actionCol || (!roleIdCol && !roleTextCol)) {
      return res.json([]);
    }
    let sqlText = "";
    if (hasRoleId) {
      const rcols = await scanColumns(pool, "roles");
      const pickRoleName = (names: string[]) => {
        for (const n of names) if (rcols.includes(n)) return `[${n}]`;
        return null;
      };
      const rolesNameCol =
        pickRoleName(["role"]) ||
        pickRoleName(["name"]) ||
        pickRoleName(["role_name"]) ||
        pickRoleName(["role_display_name"]);
      const rpHasPermissionId = cols.includes("permission_id");
      const hasPermissionsTableRes = await new sql.Request(pool).query(`
        SELECT 1 AS ok FROM sys.tables WHERE name = 'permissions'
      `);
      const hasPermissionsTable = !!((hasPermissionsTableRes.recordset || [])[0]);
      const usePermJoin = rpHasPermissionId && hasPermissionsTable;
      if (rolesNameCol) {
        sqlText = usePermJoin
          ? `
            SELECT r.${rolesNameCol} AS role,
                   COALESCE(p.${moduleCol}, perms.[module_name]) AS module,
                   COALESCE(p.${actionCol}, perms.[action_name]) AS action,
                   p.${allowedCol} AS allowed
            FROM dbo.role_permissions AS p
            LEFT JOIN dbo.roles AS r ON r.[role_id] = p.${roleIdCol}
            LEFT JOIN dbo.permissions AS perms ON perms.[permission_id] = p.[permission_id]
          `
          : `
            SELECT r.${rolesNameCol} AS role, p.${moduleCol} AS module, p.${actionCol} AS action, p.${allowedCol} AS allowed
            FROM dbo.role_permissions AS p
            LEFT JOIN dbo.roles AS r ON r.[role_id] = p.${roleIdCol}
          `;
      } else {
        sqlText = usePermJoin
          ? `
            SELECT CAST(p.${roleIdCol} AS NVARCHAR(50)) AS role,
                   COALESCE(p.${moduleCol}, perms.[module_name]) AS module,
                   COALESCE(p.${actionCol}, perms.[action_name]) AS action,
                   p.${allowedCol} AS allowed
            FROM dbo.role_permissions AS p
            LEFT JOIN dbo.permissions AS perms ON perms.[permission_id] = p.[permission_id]
          `
          : `
            SELECT CAST(p.${roleIdCol} AS NVARCHAR(50)) AS role, p.${moduleCol} AS module, p.${actionCol} AS action, p.${allowedCol} AS allowed
            FROM dbo.role_permissions AS p
          `;
      }
    } else {
      const rpHasPermissionId = cols.includes("permission_id");
      const hasPermissionsTableRes = await new sql.Request(pool).query(`
        SELECT 1 AS ok FROM sys.tables WHERE name = 'permissions'
      `);
      const hasPermissionsTable = !!((hasPermissionsTableRes.recordset || [])[0]);
      const usePermJoin = rpHasPermissionId && hasPermissionsTable;
      sqlText = usePermJoin
        ? `
          SELECT p.${roleTextCol} AS role,
                 COALESCE(p.${moduleCol}, perms.[module_name]) AS module,
                 COALESCE(p.${actionCol}, perms.[action_name]) AS action,
                 p.${allowedCol} AS allowed
          FROM dbo.role_permissions AS p
          LEFT JOIN dbo.permissions AS perms ON perms.[permission_id] = p.[permission_id]
        `
        : `
          SELECT p.${roleTextCol} AS role, p.${moduleCol} AS module, p.${actionCol} AS action, p.${allowedCol} AS allowed
          FROM dbo.role_permissions AS p
        `;
    }
    const result = await new sql.Request(pool).query(sqlText);
    const items = (result.recordset || []).map((row) => {
      const rr = row as { role: unknown; module: unknown; action: unknown; allowed: unknown };
      const mod = String(rr.module || "");
      const actRaw = String(rr.action || "");
      const act = (() => {
        const a = actRaw.toLowerCase();
        if (a === "view") return "read";
        if (a === "edit") return "update";
        if (mod.toLowerCase() === "users" && a === "manage_roles") return "manage_users";
        return actRaw;
      })();
      return {
        role: String(rr.role),
        module: mod,
        action: act,
        allowed: Boolean(rr.allowed),
      };
    });
    const out = isSuperadmin ? items : items.filter((i) => normalizeRoleName(String(i.role)) !== "superadmin");
    return res.json(out);
  } catch (err: unknown) {
    return res.json([]);
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/permissions", requireRole(["admin","superadmin"]), async (req, res) => {
  if (!isSuperadminRequest(req) && normalizeRoleName(String((req.body || {}).role || "").trim()) === "superadmin") {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  const body = req.body || {};
  const role = String(body.role || "").trim();
  const module = String(body.module || "").trim();
  const action = String(body.action || "").trim();
  const allowed = Boolean(body.allowed);
  if (!role || !module || !action) return res.status(400).json({ error: "ROLE_MODULE_ACTION_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureRolePermissionsSchema(pool);
    const cols = await scanColumns(pool, "role_permissions");
    let hasRoleId = cols.includes("role_id");
    const allowedCol = cols.includes("is_allowed") ? "[is_allowed]" : "[allowed]";
    const moduleCol = cols.includes("module") ? "[module]" : "[permission_module]";
    const actionCol = cols.includes("action") ? "[action]" : "[permission_action]";
    let roleIdentifierValue: number | string = role;
    if (hasRoleId) {
      const rcols = await scanColumns(pool, "roles");
      const idCol = rcols.includes("role_id") ? "[role_id]" : (rcols.includes("id") ? "[id]" : "[role_id]");
      const nameCols: string[] = [];
      if (rcols.includes("role")) nameCols.push("[role]");
      if (rcols.includes("name")) nameCols.push("[name]");
      if (rcols.includes("role_name")) nameCols.push("[role_name]");
      if (rcols.includes("role_display_name")) nameCols.push("[role_display_name]");
      if (!nameCols.length) {
        hasRoleId = false;
        roleIdentifierValue = role;
      } else {
        const aliases = (r: string): string[] => (r === "department_rep" ? [r, "dep_rep"] : [r]);
        let foundId: number | null = null;
        for (const col of nameCols) {
          for (const candidate of aliases(role)) {
            const req = new sql.Request(pool);
            req.input("name", sql.VarChar(100), candidate);
            const resId = await req.query(`
              SELECT TOP 1 ${idCol} AS id
              FROM dbo.roles
              WHERE LOWER(${col}) = LOWER(@name)
            `);
            const row = (resId.recordset || [])[0] as { id?: number };
            if (typeof row?.id === "number") { foundId = row.id; break; }
          }
          if (foundId !== null) break;
        }
        if (foundId !== null) {
          roleIdentifierValue = foundId;
        } else {
          // Build dynamic insert honoring NOT NULL columns
          const reqIns = new sql.Request(pool);
          const insCols: string[] = [];
          const insVals: string[] = [];
          const roleDisplay = role;
          if (rcols.includes("role_name")) { insCols.push("[role_name]"); insVals.push("@role_name"); reqIns.input("role_name", sql.NVarChar(50), roleDisplay); }
          if (rcols.includes("role_display_name")) { insCols.push("[role_display_name]"); insVals.push("@role_display_name"); reqIns.input("role_display_name", sql.NVarChar(100), roleDisplay); }
          if (rcols.includes("role")) { insCols.push("[role]"); insVals.push("@role"); reqIns.input("role", sql.NVarChar(50), roleDisplay); }
          if (rcols.includes("name")) { insCols.push("[name]"); insVals.push("@name"); reqIns.input("name", sql.NVarChar(50), roleDisplay); }
          if (rcols.includes("is_active")) { insCols.push("[is_active]"); insVals.push("@is_active"); reqIns.input("is_active", sql.Bit, 1); }
          if (rcols.includes("created_at")) { insCols.push("[created_at]"); insVals.push("SYSDATETIME()"); }
          if (rcols.includes("updated_at")) { insCols.push("[updated_at]"); insVals.push("SYSDATETIME()"); }
          // Ensure at least one name column is set
          if (!insCols.length && nameCols.length) {
            const simple = await new sql.Request(pool)
              .input("name", sql.VarChar(100), roleDisplay)
              .query(`INSERT INTO dbo.roles (${nameCols[0]}) VALUES (@name); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`);
            const simpleRow = (simple.recordset || [])[0] as { id?: number };
            if (!simpleRow || typeof simpleRow.id !== "number") {
              hasRoleId = false;
              roleIdentifierValue = role;
            } else {
              roleIdentifierValue = simpleRow.id;
            }
          } else {
            const sqlText = `INSERT INTO dbo.roles (${insCols.join(", ")}) VALUES (${insVals.join(", ")}); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`;
            try {
              const insRes = await reqIns.query(sqlText);
              const insRow = (insRes.recordset || [])[0] as { id?: number };
              roleIdentifierValue = typeof insRow?.id === "number" ? insRow.id : role;
            } catch {
              // If unique violation occurs, try re-select across all columns
              let retryId: number | null = null;
              for (const col of nameCols) {
                const re = await new sql.Request(pool)
                  .input("name", sql.VarChar(100), roleDisplay)
                  .query(`SELECT TOP 1 ${idCol} AS id FROM dbo.roles WHERE LOWER(${col})=LOWER(@name)`);
                const rr = (re.recordset || [])[0] as { id?: number };
                if (typeof rr?.id === "number") { retryId = rr.id; break; }
              }
              if (retryId !== null) roleIdentifierValue = retryId;
              else { hasRoleId = false; roleIdentifierValue = role; }
            }
          }
        }
      }
    }
    const request = new sql.Request(pool);
    let permissionIdColumn = "";
    let permissionIdValueExpr = "";
    let permissionIdLiteral: number | null = null;
    let permissionIdLiteralStr: string | null = null;
    let usedPermissionMapping = false;
    try {
      const hasPermissionsTableRes = await new sql.Request(pool).query(`
        SELECT 1 AS ok FROM sys.tables WHERE name = 'permissions'
      `);
      const hasPermissionsTable = !!((hasPermissionsTableRes.recordset || [])[0]);
      if (hasPermissionsTable) {
        const actNorm = (() => {
          const a = action.toLowerCase();
          if (a === "read" || a === "view") return "view";
          if (a === "update" || a === "edit") return "edit";
          if (a === "manage_users") return "manage_roles";
          return a;
        })();
        const modNorm = module.toLowerCase();
        const pReq = new sql.Request(pool);
        pReq.input("module_name", sql.VarChar(50), modNorm);
        pReq.input("action_name", sql.VarChar(50), actNorm);
        const pRes = await pReq.query(`
          SELECT TOP 1 permission_id AS id
          FROM dbo.permissions
          WHERE LOWER(module_name) = @module_name AND LOWER(action_name) = @action_name AND is_active = 1
        `);
        const pRow = (pRes.recordset || [])[0] as { id?: unknown };
        if (pRow && pRow.id !== undefined && pRow.id !== null) {
          if (typeof pRow.id === "number") {
            permissionIdColumn = "[permission_id]";
            permissionIdValueExpr = "";
            permissionIdLiteral = pRow.id;
            usedPermissionMapping = true;
          } else {
            const idStr = String(pRow.id);
            if (idStr.length >= 32) {
              permissionIdColumn = "[permission_id]";
              permissionIdValueExpr = "";
              permissionIdLiteralStr = idStr;
              usedPermissionMapping = true;
            }
          }
        }
      }
    } catch { usedPermissionMapping = false; }
    const rpInfoRes = await new sql.Request(pool).query(`
      SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='role_permissions' AND COLUMN_NAME='permission_id'
    `);
    const rpInfo = (rpInfoRes.recordset || [])[0] as { COLUMN_NAME?: string; IS_NULLABLE?: string; DATA_TYPE?: string };
    if (!usedPermissionMapping && rpInfo && String(rpInfo.COLUMN_NAME || "").toLowerCase() === "permission_id") {
      const identityRes = await new sql.Request(pool).query(`
        SELECT COLUMNPROPERTY(OBJECT_ID('dbo.role_permissions'), 'permission_id', 'IsIdentity') AS is_identity
      `);
      const isIdentity = !!((identityRes.recordset || [])[0] && Number((identityRes.recordset || [])[0].is_identity) === 1);
      const isNullable = String(rpInfo.IS_NULLABLE || "").toUpperCase() === "YES";
      const dtype = String(rpInfo.DATA_TYPE || "").toLowerCase();
      if (!isIdentity && !isNullable) {
        permissionIdColumn = "[permission_id]";
        if (dtype === "uniqueidentifier") {
          permissionIdValueExpr = "NEWID()";
        } else {
          const nextIdRes = await new sql.Request(pool).query(`
            SELECT ISNULL(MAX([permission_id]), 0) + 1 AS nextId
            FROM dbo.role_permissions
          `);
          const nextIdRow = (nextIdRes.recordset || [])[0] as { nextId?: number };
          const nextId = typeof nextIdRow?.nextId === "number" ? nextIdRow.nextId : 1;
          permissionIdValueExpr = String(nextId);
        }
      }
    }
    if (hasRoleId) request.input("role_id", sql.Int, roleIdentifierValue as number);
    else request.input("role", sql.VarChar(50), roleIdentifierValue as string);
    request.input("module", sql.VarChar(50), module);
    request.input("action", sql.VarChar(50), action);
    request.input("allowed", sql.Bit, allowed ? 1 : 0);
    const roleWhere = hasRoleId ? "[role_id]=@role_id" : "[role]=@role";
    if (usedPermissionMapping && hasRoleId && (typeof permissionIdLiteral === "number" || typeof permissionIdLiteralStr === "string")) {
      if (typeof permissionIdLiteral === "number") {
        const existsReq = new sql.Request(pool);
        existsReq.input("role_id", sql.Int, roleIdentifierValue as number);
        existsReq.input("permission_id", sql.Int, permissionIdLiteral);
        const exists = await existsReq.query(`
          SELECT 1 AS ok FROM dbo.role_permissions WHERE [role_id]=@role_id AND [permission_id]=@permission_id
        `);
        if ((exists.recordset || []).length) {
          const updReq = new sql.Request(pool);
          updReq.input("role_id", sql.Int, roleIdentifierValue as number);
          updReq.input("permission_id", sql.Int, permissionIdLiteral);
          updReq.input("allowed", sql.Bit, allowed ? 1 : 0);
          await updReq.query(`
            UPDATE dbo.role_permissions SET ${allowedCol}=@allowed WHERE [role_id]=@role_id AND [permission_id]=@permission_id
          `);
        } else {
          const insReq = new sql.Request(pool);
          insReq.input("role_id", sql.Int, roleIdentifierValue as number);
          insReq.input("permission_id", sql.Int, permissionIdLiteral);
          insReq.input("allowed", sql.Bit, allowed ? 1 : 0);
          await insReq.query(`
            INSERT INTO dbo.role_permissions ([role_id], [permission_id], ${allowedCol})
            VALUES (@role_id, @permission_id, @allowed)
          `);
        }
      } else if (typeof permissionIdLiteralStr === "string") {
        const existsReq = new sql.Request(pool);
        existsReq.input("role_id", sql.Int, roleIdentifierValue as number);
        existsReq.input("permission_id", sql.UniqueIdentifier, permissionIdLiteralStr);
        const exists = await existsReq.query(`
          SELECT 1 AS ok FROM dbo.role_permissions WHERE [role_id]=@role_id AND [permission_id]=@permission_id
        `);
        if ((exists.recordset || []).length) {
          const updReq = new sql.Request(pool);
          updReq.input("role_id", sql.Int, roleIdentifierValue as number);
          updReq.input("permission_id", sql.UniqueIdentifier, permissionIdLiteralStr);
          updReq.input("allowed", sql.Bit, allowed ? 1 : 0);
          await updReq.query(`
            UPDATE dbo.role_permissions SET ${allowedCol}=@allowed WHERE [role_id]=@role_id AND [permission_id]=@permission_id
          `);
        } else {
          const insReq = new sql.Request(pool);
          insReq.input("role_id", sql.Int, roleIdentifierValue as number);
          insReq.input("permission_id", sql.UniqueIdentifier, permissionIdLiteralStr);
          insReq.input("allowed", sql.Bit, allowed ? 1 : 0);
          await insReq.query(`
            INSERT INTO dbo.role_permissions ([role_id], [permission_id], ${allowedCol})
            VALUES (@role_id, @permission_id, @allowed)
          `);
        }
      }
    } else {
      const existsReq = new sql.Request(pool);
      if (hasRoleId) existsReq.input("role_id", sql.Int, roleIdentifierValue as number);
      else existsReq.input("role", sql.VarChar(50), roleIdentifierValue as string);
      existsReq.input("module", sql.VarChar(50), module);
      existsReq.input("action", sql.VarChar(50), action);
      const exists = await existsReq.query(`
        SELECT 1 AS ok FROM dbo.role_permissions WHERE ${roleWhere} AND ${moduleCol}=@module AND ${actionCol}=@action
      `);
      if ((exists.recordset || []).length) {
        const updReq = new sql.Request(pool);
        if (hasRoleId) updReq.input("role_id", sql.Int, roleIdentifierValue as number);
        else updReq.input("role", sql.VarChar(50), roleIdentifierValue as string);
        updReq.input("module", sql.VarChar(50), module);
        updReq.input("action", sql.VarChar(50), action);
        updReq.input("allowed", sql.Bit, allowed ? 1 : 0);
        await updReq.query(`
          UPDATE dbo.role_permissions SET ${allowedCol}=@allowed WHERE ${roleWhere} AND ${moduleCol}=@module AND ${actionCol}=@action
        `);
      } else {
        const insReq = new sql.Request(pool);
        if (hasRoleId) insReq.input("role_id", sql.Int, roleIdentifierValue as number);
        else insReq.input("role", sql.VarChar(50), roleIdentifierValue as string);
        insReq.input("module", sql.VarChar(50), module);
        insReq.input("action", sql.VarChar(50), action);
        insReq.input("allowed", sql.Bit, allowed ? 1 : 0);
        const insertCols = `${hasRoleId ? "[role_id]" : "[role]"}, ${moduleCol}, ${actionCol}, ${allowedCol}${permissionIdColumn ? `, ${permissionIdColumn}` : ""}`;
        const insertVals = `${hasRoleId ? "@role_id" : "@role"}, @module, @action, @allowed${permissionIdValueExpr ? `, ${permissionIdValueExpr}` : ""}`;
        await insReq.query(`
          INSERT INTO dbo.role_permissions (${insertCols})
          VALUES (${insertVals})
        `);
      }
    }
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_ROLE_PERMISSION";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/columns", async (req, res) => {
  const isSuperadmin = isSuperadminRequest(req);
  const pool = getPool();
  try {
    await pool.connect();
    const cols = await scanColumns(pool, "role_column_access");
    const hasNormalized = cols.includes("role_id") && cols.includes("column_id");
    if (hasNormalized) {
      const rcols = await scanColumns(pool, "roles");
      const ridCol = rcols.includes("role_id") ? "[role_id]" : rcols.includes("id") ? "[id]" : "[role_id]";
      const rnameCol =
        rcols.includes("role") ? "[role]" :
        rcols.includes("name") ? "[name]" :
        rcols.includes("role_name") ? "[role_name]" :
        rcols.includes("role_display_name") ? "[role_display_name]" : "[role]";
      const ccols = await scanColumns(pool, "column_catalog");
      const cidCol = ccols.includes("column_id") ? "[column_id]" : ccols.includes("id") ? "[id]" : "[column_id]";
      const tnameCol = ccols.includes("table_name") ? "[table_name]" : "[table]";
      const cnameCol = ccols.includes("column_name") ? "[column_name]" : "[column]";
      const readExpr = cols.includes("can_view") && cols.includes("can_read")
        ? "(CASE WHEN rca.[can_view]=1 OR rca.[can_read]=1 THEN 1 ELSE 0 END)"
        : (cols.includes("can_view") ? "rca.[can_view]" : "rca.[can_read]");
      const writeExpr = cols.includes("can_edit") && cols.includes("can_write")
        ? "(CASE WHEN rca.[can_edit]=1 OR rca.[can_write]=1 THEN 1 ELSE 0 END)"
        : (cols.includes("can_edit") ? "rca.[can_edit]" : "rca.[can_write]");
      const result = await new sql.Request(pool).query(`
        SELECT
          COALESCE(r.${rnameCol}, CAST(rca.[role_id] AS NVARCHAR(50)), rca.[role]) AS role_name,
          cc.${tnameCol} AS table_name,
          cc.${cnameCol} AS column_name,
          ${readExpr} AS can_read,
          ${writeExpr} AS can_write
        FROM dbo.role_column_access AS rca
        LEFT JOIN dbo.roles AS r ON r.${ridCol} = rca.[role_id]
        LEFT JOIN dbo.column_catalog AS cc ON cc.${cidCol} = rca.[column_id]
        WHERE rca.[role_id] IS NOT NULL AND rca.[column_id] IS NOT NULL
      `);
      const toLabel = (s: string) =>
        String(s || "")
          .replace(/_/g, " ")
          .split(" ")
          .filter(Boolean)
          .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
          .join(" ");
      const items = (result.recordset || []).map((r) => {
        const row = r as { role_name?: string; table_name?: string; column_name?: string; can_read?: number | boolean; can_write?: number | boolean; role?: string; section?: string; column?: string };
        const sectionRaw = String(row.table_name || "");
        const section = sectionRaw ? toLabel(sectionRaw) : String(row.section || "");
        return {
          role: normalizeRoleName(String(row.role_name || "")),
          section,
          column: String(row.column_name || String(row.column || "")),
          read: Boolean(row.can_read),
          write: Boolean(row.can_write),
        };
      });
      const out = isSuperadmin ? items : items.filter((i) => normalizeRoleName(i.role) !== "superadmin");
      return res.json(out);
    }
    const hasTextSchema = cols.includes("role") && cols.includes("section") && cols.includes("column");
    if (hasTextSchema) {
      const result = await new sql.Request(pool).query(`
        SELECT [role], [section], [column], [can_read], [can_write]
        FROM dbo.role_column_access
      `);
      const items = (result.recordset || []).map((r) => {
        const row = r as { role: string; section: string; column: string; can_read: number | boolean; can_write: number | boolean };
        return {
          role: normalizeRoleName(String(row.role)),
          section: String(row.section),
          column: String(row.column),
          read: Boolean(row.can_read),
          write: Boolean(row.can_write),
        };
      });
      const out = isSuperadmin ? items : items.filter((i) => normalizeRoleName(i.role) !== "superadmin");
      return res.json(out);
    }
    const hasViewRes = await new sql.Request(pool).query(`
      SELECT 1 AS ok FROM sys.views WHERE name = 'vw_role_column_access'
    `);
    const hasView = !!((hasViewRes.recordset || [])[0]);
    if (hasView) {
      const result = await new sql.Request(pool).query(`
        SELECT [role_name], [table_name], [column_name], [display_label]
        FROM dbo.vw_role_column_access
      `);
      const toLabel = (s: string) =>
        String(s || "")
          .replace(/_/g, " ")
          .split(" ")
          .filter(Boolean)
          .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
          .join(" ");
      const items = (result.recordset || []).map((r) => {
        const row = r as { role_name?: string; table_name?: string; column_name?: string; display_label?: string };
        const section = toLabel(String(row.table_name || ""));
        const label = String(row.display_label || "");
        return {
          role: normalizeRoleName(String(row.role_name || "")),
          section,
          column: String(row.column_name || ""),
          read: true,
          write: false,
        };
      });
      const out = isSuperadmin ? items : items.filter((i) => normalizeRoleName(i.role) !== "superadmin");
      return res.json(out);
    }
    return res.json([]);
  } catch {
    return res.json([]);
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/columns", requireRole(["admin","superadmin"]), async (req, res) => {
  if (!isSuperadminRequest(req) && normalizeRoleName(String((req.body || {}).role || "").trim()) === "superadmin") {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  const body = req.body || {};
  const role = normalizeRoleName(String(body.role || "").trim());
  const section = String(body.section || "").trim();
  const column = String(body.column || "").trim();
  const read = Boolean(body.read);
  const write = Boolean(body.write);
  const effectiveRead = write ? true : read;
  if (!role || !section || !column) return res.status(400).json({ error: "ROLE_SECTION_COLUMN_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    const cols = await scanColumns(pool, "role_column_access");
    const hasNormalized = cols.includes("role_id") && cols.includes("column_id");
    if (hasNormalized) {
      try {
        const rcols = await scanColumns(pool, "roles");
        const idCol = rcols.includes("role_id") ? "[role_id]" : rcols.includes("id") ? "[id]" : null;
        const nameCol =
          rcols.includes("role") ? "[role]" :
          rcols.includes("name") ? "[name]" :
          rcols.includes("role_name") ? "[role_name]" :
          rcols.includes("role_display_name") ? "[role_display_name]" : null;
        if (!nameCol) throw new Error("ROLES_NAME_COLUMN_NOT_FOUND");
        let roleId: number | null = null;
        if (idCol) {
          const req1 = new sql.Request(pool);
          req1.input("name", sql.VarChar(100), role);
          const getId = await req1.query(`SELECT ${idCol} AS id FROM dbo.roles WHERE LOWER(${nameCol})=LOWER(@name)`);
          const foundRole = (getId.recordset || [])[0] as { id?: number };
          roleId = typeof foundRole?.id === "number" ? foundRole.id : null;
          if (roleId === null) {
            const alt = role.includes("department_rep") ? "dep_rep" : role;
            const req2 = new sql.Request(pool);
            req2.input("name", sql.VarChar(100), alt);
            const getIdAlt = await req2.query(`SELECT ${idCol} AS id FROM dbo.roles WHERE LOWER(${nameCol})=LOWER(@name)`);
            const foundAlt = (getIdAlt.recordset || [])[0] as { id?: number };
            roleId = typeof foundAlt?.id === "number" ? foundAlt.id : null;
          }
        }
        if (typeof roleId !== "number") {
          const rcols2 = await scanColumns(pool, "roles");
          const insCols: string[] = [];
          const insVals: string[] = [];
          const reqIns = new sql.Request(pool);
          if (rcols2.includes("role_name")) { insCols.push("[role_name]"); insVals.push("@role_name"); reqIns.input("role_name", sql.NVarChar(50), role); }
          if (rcols2.includes("role_display_name")) { insCols.push("[role_display_name]"); insVals.push("@role_display_name"); reqIns.input("role_display_name", sql.NVarChar(100), role); }
          if (rcols2.includes("role")) { insCols.push("[role]"); insVals.push("@role"); reqIns.input("role", sql.NVarChar(50), role); }
          if (rcols2.includes("name")) { insCols.push("[name]"); insVals.push("@name"); reqIns.input("name", sql.NVarChar(50), role); }
          if (rcols2.includes("is_active")) { insCols.push("[is_active]"); insVals.push("@is_active"); reqIns.input("is_active", sql.Bit, 1); }
          if (rcols2.includes("created_at")) { insCols.push("[created_at]"); insVals.push("SYSDATETIME()"); }
          if (rcols2.includes("updated_at")) { insCols.push("[updated_at]"); insVals.push("SYSDATETIME()"); }
          if (!insCols.length && nameCol) {
            const insRole = await new sql.Request(pool)
              .input("name", sql.VarChar(100), role)
              .query(`INSERT INTO dbo.roles (${nameCol}) VALUES (@name); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`);
            const insRow = (insRole.recordset || [])[0] as { id?: number };
            roleId = typeof insRow?.id === "number" ? insRow.id : null;
          } else {
            const sqlText = `INSERT INTO dbo.roles (${insCols.join(", ")}) VALUES (${insVals.join(", ")}); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`;
            const insRes = await reqIns.query(sqlText);
            const insRow = (insRes.recordset || [])[0] as { id?: number };
            roleId = typeof insRow?.id === "number" ? insRow.id : null;
          }
        }
        if (typeof roleId !== "number") throw new Error("ROLE_ID_RESOLUTION_FAILED");
        const normalizeTable = (s: string) => String(s || "").toLowerCase().replace(/\s+/g, "_");
        const tableName = normalizeTable(section);
        const ccols = await scanColumns(pool, "column_catalog");
        const colIdCol = ccols.includes("column_id") ? "[column_id]" : ccols.includes("id") ? "[id]" : null;
        const tableNameCol = ccols.includes("table_name") ? "[table_name]" : ccols.includes("table") ? "[table]" : null;
        const columnNameCol = ccols.includes("column_name") ? "[column_name]" : ccols.includes("column") ? "[column]" : null;
        if (!tableNameCol || !columnNameCol) throw new Error("COLUMN_CATALOG_NAME_COLUMNS_NOT_FOUND");
        let columnId: number | null = null;
        if (colIdCol) {
          const getColId = await new sql.Request(pool)
            .input("table_name", sql.NVarChar(128), tableName)
            .input("column_name", sql.NVarChar(128), column)
            .query(`
              SELECT ${colIdCol} AS id
              FROM dbo.column_catalog
              WHERE LOWER(${tableNameCol}) = LOWER(@table_name) AND LOWER(${columnNameCol}) = LOWER(@column_name)
            `);
          const foundCol = (getColId.recordset || [])[0] as { id?: number };
          columnId = typeof foundCol?.id === "number" ? foundCol.id : null;
        }
        if (typeof columnId !== "number") {
          const insColReq = new sql.Request(pool);
          insColReq.input("table_name", sql.NVarChar(128), tableName);
          insColReq.input("column_name", sql.NVarChar(128), column);
          await insColReq.query(`
            INSERT INTO dbo.column_catalog (${tableNameCol}, ${columnNameCol})
            VALUES (@table_name, @column_name)
          `);
          if (colIdCol) {
            const getColId2 = await new sql.Request(pool)
              .input("table_name", sql.NVarChar(128), tableName)
              .input("column_name", sql.NVarChar(128), column)
              .query(`
                SELECT ${colIdCol} AS id
                FROM dbo.column_catalog
                WHERE LOWER(${tableNameCol}) = LOWER(@table_name) AND LOWER(${columnNameCol}) = LOWER(@column_name)
              `);
            const insCol = (getColId2.recordset || [])[0] as { id?: number };
            columnId = typeof insCol?.id === "number" ? insCol.id : null;
          }
        }
        if (typeof columnId !== "number") throw new Error("COLUMN_ID_RESOLUTION_FAILED");
        const request = new sql.Request(pool);
        request.input("role_id", sql.Int, roleId);
        request.input("column_id", sql.Int, columnId);
        request.input("can_read", sql.Bit, effectiveRead ? 1 : 0);
        request.input("can_write", sql.Bit, write ? 1 : 0);
        const hasView = cols.includes("can_view");
        const hasEdit = cols.includes("can_edit");
        const hasRead = cols.includes("can_read");
        const hasWrite = cols.includes("can_write");
        const setBits = [
          hasView ? "[can_view]=@can_read" : null,
          hasRead ? "[can_read]=@can_read" : null,
          hasEdit ? "[can_edit]=@can_write" : null,
          hasWrite ? "[can_write]=@can_write" : null,
        ].filter(Boolean).join(", ");
        const insBitCols = [
          hasView ? "[can_view]" : null,
          hasRead ? "[can_read]" : null,
          hasEdit ? "[can_edit]" : null,
          hasWrite ? "[can_write]" : null,
        ].filter(Boolean).join(", ");
        const insBitVals = [
          hasView ? "@can_read" : null,
          hasRead ? "@can_read" : null,
          hasEdit ? "@can_write" : null,
          hasWrite ? "@can_write" : null,
        ].filter(Boolean).join(", ");
        const idInfoRes = await new sql.Request(pool).query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='role_column_access' AND COLUMN_NAME='id'
        `);
        const hasIdCol = !!((idInfoRes.recordset || [])[0]);
        let useExplicitId = false;
        if (hasIdCol) {
          const idIdentityRes = await new sql.Request(pool).query(`
            SELECT COLUMNPROPERTY(OBJECT_ID('dbo.role_column_access'), 'id', 'IsIdentity') AS is_identity
          `);
          const isIdentity = !!((idIdentityRes.recordset || [])[0] && Number((idIdentityRes.recordset || [])[0].is_identity) === 1);
          useExplicitId = !isIdentity;
        }
        if (useExplicitId) {
          const nextIdRes = await new sql.Request(pool).query(`
            SELECT ISNULL(MAX([id]), 0) + 1 AS nextId
            FROM dbo.role_column_access
          `);
          const nextIdRow = (nextIdRes.recordset || [])[0] as { nextId?: number };
          const nextId = typeof nextIdRow?.nextId === "number" ? nextIdRow.nextId : 1;
          request.input("id", sql.BigInt, nextId);
        }
        const insertColsPrefix = useExplicitId ? "[id], [role_id], [column_id]" : "[role_id], [column_id]";
        const insertValsPrefix = useExplicitId ? "@id, @role_id, @column_id" : "@role_id, @column_id";
        await request.query(`
          IF EXISTS (SELECT 1 FROM dbo.role_column_access WHERE [role_id]=@role_id AND [column_id]=@column_id)
            UPDATE dbo.role_column_access SET ${setBits} WHERE [role_id]=@role_id AND [column_id]=@column_id;
          ELSE
            INSERT INTO dbo.role_column_access (${insertColsPrefix}${insBitCols ? `, ${insBitCols}` : ""}) VALUES (${insertValsPrefix}${insBitVals ? `, ${insBitVals}` : ""});
        `);
      } catch {
        await ensureRoleColumnAccessSchema(pool);
        const request = new sql.Request(pool);
        request.input("role", sql.VarChar(50), role);
        request.input("section", sql.VarChar(50), section);
        request.input("column", sql.VarChar(100), column);
        request.input("can_read", sql.Bit, effectiveRead ? 1 : 0);
        request.input("can_write", sql.Bit, write ? 1 : 0);
        const idInfoRes = await new sql.Request(pool).query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='role_column_access' AND COLUMN_NAME='id'
        `);
        const hasIdCol = !!((idInfoRes.recordset || [])[0]);
        let useExplicitId = false;
        if (hasIdCol) {
          const idIdentityRes = await new sql.Request(pool).query(`
            SELECT COLUMNPROPERTY(OBJECT_ID('dbo.role_column_access'), 'id', 'IsIdentity') AS is_identity
          `);
          const isIdentity = !!((idIdentityRes.recordset || [])[0] && Number((idIdentityRes.recordset || [])[0].is_identity) === 1);
          useExplicitId = !isIdentity;
        }
        if (useExplicitId) {
          const nextIdRes = await new sql.Request(pool).query(`
            SELECT ISNULL(MAX([id]), 0) + 1 AS nextId
            FROM dbo.role_column_access
          `);
          const nextIdRow = (nextIdRes.recordset || [])[0] as { nextId?: number };
          const nextId = typeof nextIdRow?.nextId === "number" ? nextIdRow.nextId : 1;
          request.input("id", sql.BigInt, nextId);
        }
        const insertColsPrefix = useExplicitId ? "[id], [role], [section], [column]" : "[role], [section], [column]";
        const insertValsPrefix = useExplicitId ? "@id, @role, @section, @column" : "@role, @section, @column";
        await request.query(`
          IF EXISTS (SELECT 1 FROM dbo.role_column_access WHERE [role]=@role AND [section]=@section AND [column]=@column)
            UPDATE dbo.role_column_access SET [can_read]=@can_read, [can_write]=@can_write WHERE [role]=@role AND [section]=@section AND [column]=@column;
          ELSE
            INSERT INTO dbo.role_column_access (${insertColsPrefix}, [can_read], [can_write]) VALUES (${insertValsPrefix}, @can_read, @can_write);
        `);
      }
    } else {
      await ensureRoleColumnAccessSchema(pool);
      const request = new sql.Request(pool);
      request.input("role", sql.VarChar(50), role);
      request.input("section", sql.VarChar(50), section);
      request.input("column", sql.VarChar(100), column);
      request.input("can_read", sql.Bit, effectiveRead ? 1 : 0);
      request.input("can_write", sql.Bit, write ? 1 : 0);
      const idInfoRes = await new sql.Request(pool).query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='role_column_access' AND COLUMN_NAME='id'
      `);
      const hasIdCol = !!((idInfoRes.recordset || [])[0]);
      let useExplicitId = false;
      if (hasIdCol) {
        const idIdentityRes = await new sql.Request(pool).query(`
          SELECT COLUMNPROPERTY(OBJECT_ID('dbo.role_column_access'), 'id', 'IsIdentity') AS is_identity
        `);
        const isIdentity = !!((idIdentityRes.recordset || [])[0] && Number((idIdentityRes.recordset || [])[0].is_identity) === 1);
        useExplicitId = !isIdentity;
      }
      if (useExplicitId) {
        const nextIdRes = await new sql.Request(pool).query(`
          SELECT ISNULL(MAX([id]), 0) + 1 AS nextId
          FROM dbo.role_column_access
        `);
        const nextIdRow = (nextIdRes.recordset || [])[0] as { nextId?: number };
        const nextId = typeof nextIdRow?.nextId === "number" ? nextIdRow.nextId : 1;
        request.input("id", sql.BigInt, nextId);
      }
      const insertColsPrefix = useExplicitId ? "[id], [role], [section], [column]" : "[role], [section], [column]";
      const insertValsPrefix = useExplicitId ? "@id, @role, @section, @column" : "@role, @section, @column";
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.role_column_access WHERE [role]=@role AND [section]=@section AND [column]=@column)
          UPDATE dbo.role_column_access SET [can_read]=@can_read, [can_write]=@can_write WHERE [role]=@role AND [section]=@section AND [column]=@column;
        ELSE
          INSERT INTO dbo.role_column_access (${insertColsPrefix}, [can_read], [can_write]) VALUES (${insertValsPrefix}, @can_read, @can_write);
      `);
    }
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPSERT_COLUMN_ACCESS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/templates", requireRole(["admin","superadmin"]), async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureColumnAccessTemplateSchema(pool);
    const result = await new sql.Request(pool).query(`
      SELECT [template_name], [updated_at]
      FROM dbo.column_access_templates
      ORDER BY [template_name]
    `);
    const items = (result.recordset || []).map((r) => {
      const row = r as { template_name?: string; updated_at?: Date };
      return { template_name: String(row.template_name || ""), updated_at: row.updated_at || null };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_LIST_TEMPLATES";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/templates/:name", requireRole(["admin","superadmin"]), async (req, res) => {
  const name = String(req.params.name || "").trim();
  if (!name) return res.status(400).json({ error: "TEMPLATE_NAME_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureColumnAccessTemplateSchema(pool);
    const request = new sql.Request(pool);
    request.input("template_name", sql.NVarChar(100), name);
    const result = await request.query(`
      SELECT TOP 1 [payload]
      FROM dbo.column_access_templates
      WHERE [template_name]=@template_name
    `);
    const row = (result.recordset || [])[0] as { payload?: string } | undefined;
    const payload = row?.payload ? JSON.parse(String(row.payload)) : [];
    return res.json({ template_name: name, items: Array.isArray(payload) ? payload : [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_TEMPLATE";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/templates", requireRole(["admin","superadmin"]), async (req, res) => {
  const body = req.body || {};
  const name = String(body.template_name || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];
  if (!name) return res.status(400).json({ error: "TEMPLATE_NAME_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureColumnAccessTemplateSchema(pool);
    const request = new sql.Request(pool);
    request.input("template_name", sql.NVarChar(100), name);
    request.input("payload", sql.NVarChar(sql.MAX), JSON.stringify(items));
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.column_access_templates WHERE [template_name]=@template_name)
        UPDATE dbo.column_access_templates SET [payload]=@payload, [updated_at]=SYSDATETIME() WHERE [template_name]=@template_name;
      ELSE
        INSERT INTO dbo.column_access_templates ([template_name], [payload]) VALUES (@template_name, @payload);
    `);
    return res.json({ ok: true, template_name: name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_SAVE_TEMPLATE";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/assignments", requireRole(["admin","superadmin"]), async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureColumnAccessAssignmentSchema(pool);
    const result = await new sql.Request(pool).query(`
      SELECT [username], [template_name], [active], [updated_at]
      FROM dbo.column_access_assignments
    `);
    const items = (result.recordset || []).map((r) => {
      const row = r as { username?: string; template_name?: string; active?: number | boolean; updated_at?: Date };
      return { username: String(row.username || ""), template_name: String(row.template_name || ""), active: !!row.active, updated_at: row.updated_at || null };
    });
    return res.json(items);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_LIST_ASSIGNMENTS";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/assignments/:username", requireRole(["admin","superadmin"]), async (req, res) => {
  const username = String(req.params.username || "").trim();
  if (!username) return res.status(400).json({ error: "USERNAME_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureColumnAccessAssignmentSchema(pool);
    const request = new sql.Request(pool);
    request.input("username", sql.NVarChar(100), username);
    const result = await request.query(`
      SELECT TOP 1 [template_name], [active], [updated_at]
      FROM dbo.column_access_assignments
      WHERE [username]=@username
    `);
    const row = (result.recordset || [])[0] as { template_name?: string; active?: number | boolean } | undefined;
    if (!row) return res.json({ username, template_name: null, active: false });
    return res.json({ username, template_name: String(row.template_name || ""), active: !!row.active });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_ASSIGNMENT";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.post("/assignments", requireRole(["admin","superadmin"]), async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || "").trim();
  const templateName = String(body.template_name || "").trim();
  const active = body.active === undefined ? true : Boolean(body.active);
  if (!username || !templateName) return res.status(400).json({ error: "USERNAME_TEMPLATE_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureColumnAccessAssignmentSchema(pool);
    const request = new sql.Request(pool);
    request.input("username", sql.NVarChar(100), username);
    request.input("template_name", sql.NVarChar(100), templateName);
    request.input("active", sql.Bit, active ? 1 : 0);
    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.column_access_assignments WHERE [username]=@username)
        UPDATE dbo.column_access_assignments SET [template_name]=@template_name, [active]=@active, [updated_at]=SYSDATETIME() WHERE [username]=@username;
      ELSE
        INSERT INTO dbo.column_access_assignments ([username], [template_name], [active]) VALUES (@username, @template_name, @active);
    `);
    return res.json({ ok: true, username, template_name: templateName, active });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_SAVE_ASSIGNMENT";
    const details = extractDbErrorDetails(err);
    return res.status(500).json({ error: message, details });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/schema/role_permissions", requireRole(["superadmin"]), async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    const columnsRes = await new sql.Request(pool).query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'role_permissions'
      ORDER BY ORDINAL_POSITION
    `);
    const sampleRes = await new sql.Request(pool).query(`
      SELECT TOP 10 *
      FROM dbo.role_permissions
      ORDER BY 1
    `);
    return res.json({
      columns: columnsRes.recordset || [],
      sample: sampleRes.recordset || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_SCHEMA_ROLE_PERMISSIONS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/schema/roles", requireRole(["superadmin"]), async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    const columnsRes = await new sql.Request(pool).query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'roles'
      ORDER BY ORDINAL_POSITION
    `);
    const sampleRes = await new sql.Request(pool).query(`
      SELECT TOP 10 *
      FROM dbo.roles
      ORDER BY 1
    `);
    return res.json({
      columns: columnsRes.recordset || [],
      sample: sampleRes.recordset || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_SCHEMA_ROLES";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

rbacRouter.get("/schema/role_column_access", requireRole(["superadmin"]), async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    const columnsRes = await new sql.Request(pool).query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'role_column_access'
      ORDER BY ORDINAL_POSITION
    `);
    const sampleRes = await new sql.Request(pool).query(`
      SELECT TOP 10 *
      FROM dbo.role_column_access
      ORDER BY 1
    `);
    return res.json({
      columns: columnsRes.recordset || [],
      sample: sampleRes.recordset || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_QUERY_SCHEMA_ROLE_COLUMN_ACCESS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
