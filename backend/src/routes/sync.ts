import { Router } from "express";
import sql from "mssql";
import path from "node:path";
import { promises as fs } from "node:fs";
import { authMiddleware, requireRole } from "../middleware/auth";
import { CONFIG } from "../config";

export const syncRouter = Router();
syncRouter.use(authMiddleware);
syncRouter.use(requireRole(["admin","superadmin"]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

type SharePointConfig = {
  enabled: boolean;
  auth_flow: "device_code";
  delegated_permission: "Files.Read";
  tenant_id: string;
  client_id: string;
  site_url: string;
  library_drive_id: string;
  file_path: string;
  share_url: string;
  poll_minutes: number;
};

type SharePointAuthCache = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
  scope: string;
};

function readSharePointConfig(value: unknown): SharePointConfig | null {
  if (!isRecord(value)) return null;
  const tenant_id = String(value.tenant_id || "").trim();
  const client_id = String(value.client_id || "").trim();
  const authFlow = String(value.auth_flow || "").trim().toLowerCase();
  const delegatedPermission = String(value.delegated_permission || "").trim().toLowerCase();
  if (!tenant_id || !client_id) return null;
  if (authFlow !== "device_code") return null;
  if (delegatedPermission !== "files.read") return null;
  return {
    enabled: !!value.enabled,
    auth_flow: "device_code",
    delegated_permission: "Files.Read",
    tenant_id,
    client_id,
    site_url: String(value.site_url || "").trim(),
    library_drive_id: String(value.library_drive_id || "").trim(),
    file_path: String(value.file_path || "").trim(),
    share_url: String(value.share_url || "").trim(),
    poll_minutes: Number.isFinite(Number(value.poll_minutes)) ? Math.max(1, Math.min(1440, Math.floor(Number(value.poll_minutes)))) : 15,
  };
}

function extractSitePathFromUrl(siteUrl: string): { hostname: string; sitePath: string } | null {
  try {
    const u = new URL(siteUrl);
    const host = String(u.hostname || "").trim();
    if (!host) return null;
    const p = String(u.pathname || "").trim();
    if (!p) return null;
    const marker = p.toLowerCase().indexOf("/sites/");
    const teamMarker = p.toLowerCase().indexOf("/teams/");
    const idx = marker >= 0 ? marker : teamMarker;
    if (idx < 0) return null;
    const root = p.slice(idx);
    const segs = root.split("/").filter(Boolean);
    if (segs.length < 2) return null;
    const sitePath = `/${segs[0]}/${segs[1]}`;
    return { hostname: host, sitePath };
  } catch {
    return null;
  }
}

function encodeShareUrlForGraph(shareUrl: string): string {
  const base64 = Buffer.from(shareUrl, "utf-8").toString("base64");
  const base64Url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `u!${base64Url}`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function loadXLSXModule(): Promise<{
  read: (data: Buffer, opts: { type: "buffer" }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: (sheet: unknown, opts: { header: number; defval: string | number | null; raw: boolean }) => unknown[] };
  SSF?: { parse_date_code?: (value: number) => { y: number; m: number; d: number; H?: number; M?: number; S?: number } | null };
}> {
  const mod = await (0, eval)('import("xlsx/xlsx.mjs")');
  return mod as {
    read: (data: Buffer, opts: { type: "buffer" }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: (sheet: unknown, opts: { header: number; defval: string | number | null; raw: boolean }) => unknown[] };
    SSF?: { parse_date_code?: (value: number) => { y: number; m: number; d: number; H?: number; M?: number; S?: number } | null };
  };
}

async function readSharepointMappingFile(): Promise<Record<string, unknown> | null> {
  const candidates = [
    path.resolve(process.cwd(), "backend", "scripts", "sharepoint-mapping.json"),
    path.resolve(process.cwd(), "scripts", "sharepoint-mapping.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function readSharePointAuthCache(value: unknown): SharePointAuthCache | null {
  if (!isRecord(value)) return null;
  const accessToken = String(value.access_token || "").trim();
  const refreshToken = String(value.refresh_token || "").trim();
  const tokenType = String(value.token_type || "Bearer").trim();
  const scope = String(value.scope || "").trim();
  const expiresAt = Math.floor(Number(value.expires_at || 0));
  if (!accessToken) return null;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType || "Bearer",
    expires_at: expiresAt,
    scope,
  };
}

function buildAuthCacheFromTokenPayload(payload: Record<string, unknown>, fallbackRefreshToken: string): SharePointAuthCache | null {
  const accessToken = String(payload.access_token || "").trim();
  if (!accessToken) return null;
  const refreshToken = String(payload.refresh_token || fallbackRefreshToken || "").trim();
  const tokenType = String(payload.token_type || "Bearer").trim() || "Bearer";
  const scope = String(payload.scope || "").trim();
  const expiresInSec = Math.max(60, Math.floor(Number(payload.expires_in || 3600)));
  const expiresAt = Date.now() + (expiresInSec * 1000);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_at: expiresAt,
    scope,
  };
}

function isAuthCacheUsable(cache: SharePointAuthCache | null): cache is SharePointAuthCache {
  if (!cache) return false;
  return cache.expires_at > (Date.now() + 60_000);
}

async function readAuthCacheFromDb(pool: sql.ConnectionPool): Promise<SharePointAuthCache | null> {
  const r = await new sql.Request(pool).query(`SELECT TOP 1 sharepoint_auth FROM dbo.sync_config WHERE id=1`);
  const row = (r.recordset || [])[0] as { sharepoint_auth?: string } | undefined;
  return readSharePointAuthCache(parseJsonRecord(row?.sharepoint_auth));
}

async function saveAuthCacheToDb(pool: sql.ConnectionPool, cache: SharePointAuthCache): Promise<void> {
  const req = new sql.Request(pool);
  req.input("sharepointAuth", sql.NVarChar(sql.MAX), JSON.stringify(cache));
  await req.query(`
    UPDATE dbo.sync_config
    SET sharepoint_auth=@sharepointAuth, updated_at=SYSDATETIME()
    WHERE id=1
  `);
}

async function requestTokenByDeviceCode(tenantId: string, clientId: string, deviceCode: string): Promise<{ ok: boolean; payload: Record<string, unknown>; status: number }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
    }),
  });
  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as unknown;
  return {
    ok: tokenRes.ok && isRecord(tokenPayload),
    payload: isRecord(tokenPayload) ? tokenPayload : {},
    status: tokenRes.status,
  };
}

async function requestTokenByRefreshToken(tenantId: string, clientId: string, refreshToken: string): Promise<{ ok: boolean; payload: Record<string, unknown>; status: number }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "Files.Read offline_access",
    }),
  });
  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as unknown;
  return {
    ok: tokenRes.ok && isRecord(tokenPayload),
    payload: isRecord(tokenPayload) ? tokenPayload : {},
    status: tokenRes.status,
  };
}

function getDestPool() {
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

function getSrcPool() {
  return new sql.ConnectionPool({
    server: String(process.env.SRC_DB_SERVER || CONFIG.DB.SERVER),
    database: String(process.env.SRC_DB_DATABASE || "EmployeeWorkflow"),
    user: String(process.env.SRC_DB_USER || CONFIG.DB.USER),
    password: String(process.env.SRC_DB_PASSWORD || CONFIG.DB.PASSWORD),
    port: parseInt(String(process.env.SRC_DB_PORT || CONFIG.DB.PORT || "1433"), 10),
    options: {
      encrypt: (process.env.SRC_DB_ENCRYPT || "false").toLowerCase() === "true",
      trustServerCertificate: (process.env.SRC_DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true",
    },
  });
}

function getCardPool() {
  return new sql.ConnectionPool({
    server: String(process.env.DATA_DB_SERVER || CONFIG.DB.SERVER),
    database: String(process.env.DATA_DB_DATABASE || ""),
    user: String(process.env.DATA_DB_USER || CONFIG.DB.USER),
    password: String(process.env.DATA_DB_PASSWORD || CONFIG.DB.PASSWORD),
    port: parseInt(String(process.env.DATA_DB_PORT || CONFIG.DB.PORT || "1433"), 10),
    options: {
      encrypt: (process.env.DATA_DB_ENCRYPT || "false").toLowerCase() === "true",
      trustServerCertificate: (process.env.DATA_DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true",
    },
  });
}

async function ensureSyncSchema(pool: sql.ConnectionPool) {
  await new sql.Request(pool).query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='sync_config')
      CREATE TABLE dbo.sync_config (
        id INT NOT NULL CONSTRAINT PK_sync_config PRIMARY KEY DEFAULT 1,
        enabled BIT NOT NULL CONSTRAINT DF_sync_config_enabled DEFAULT 0,
        schedule NVARCHAR(100) NULL,
        mapping NVARCHAR(MAX) NULL,
        sharepoint NVARCHAR(MAX) NULL,
        sharepoint_auth NVARCHAR(MAX) NULL,
        photo_sync_enabled BIT NULL,
        photo_sync_schedule NVARCHAR(100) NULL,
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_sync_config_updated_at DEFAULT SYSDATETIME()
      );
    IF NOT EXISTS (SELECT 1 FROM dbo.sync_config WHERE id=1)
      INSERT INTO dbo.sync_config (id, enabled) VALUES (1, 0);
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='sync_runs')
      CREATE TABLE dbo.sync_runs (
        run_id INT IDENTITY(1,1) PRIMARY KEY,
        started_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        finished_at DATETIME2 NULL,
        success BIT NULL,
        stats NVARCHAR(MAX) NULL,
        error NVARCHAR(MAX) NULL
      );
    IF COL_LENGTH('dbo.sync_config', 'sharepoint') IS NULL
      ALTER TABLE dbo.sync_config ADD sharepoint NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.sync_config', 'sharepoint_auth') IS NULL
      ALTER TABLE dbo.sync_config ADD sharepoint_auth NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.sync_config', 'photo_sync_enabled') IS NULL
      ALTER TABLE dbo.sync_config ADD photo_sync_enabled BIT NULL;
    IF COL_LENGTH('dbo.sync_config', 'photo_sync_schedule') IS NULL
      ALTER TABLE dbo.sync_config ADD photo_sync_schedule NVARCHAR(100) NULL;
  `);
}

syncRouter.get("/config", async (_req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const r = await new sql.Request(pool).query(`SELECT TOP 1 enabled, schedule, mapping, sharepoint, sharepoint_auth, photo_sync_enabled, photo_sync_schedule, updated_at FROM dbo.sync_config WHERE id=1`);
    const row = (r.recordset || [])[0] as {
      enabled?: boolean;
      schedule?: string;
      mapping?: string;
      sharepoint?: string;
      sharepoint_auth?: string;
      photo_sync_enabled?: boolean;
      photo_sync_schedule?: string;
      updated_at?: Date;
    } | undefined;
    const authCache = readSharePointAuthCache(parseJsonRecord(row?.sharepoint_auth));
    return res.json({
      enabled: !!row?.enabled,
      schedule: row?.schedule || "",
      mapping: parseJsonRecord(row?.mapping) || null,
      sharepoint: parseJsonRecord(row?.sharepoint) || null,
      sharepoint_auth_cached: !!authCache,
      sharepoint_auth_expires_at: authCache?.expires_at || null,
      photo_sync_enabled: !!row?.photo_sync_enabled,
      photo_sync_schedule: row?.photo_sync_schedule || "",
      updated_at: row?.updated_at || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_SYNC_CONFIG";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

type MappingTarget = { table: string; column: string };
type MappingEntry = { excelName: string; db: MappingTarget | MappingTarget[] | null; status: "mapped" | "unmapped" };
type SharepointMapping = {
  sheet_name_map?: Record<string, string>;
  columns?: Record<string, MappingEntry[]>;
};

function toRowArrays(value: unknown): Array<Array<unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => Array.isArray(row)) as Array<Array<unknown>>;
}

function pickHeaderRowIndex(rows: Array<Array<unknown>>): number {
  const limit = Math.min(6, rows.length);
  let bestIdx = 0;
  let bestCount = 0;
  for (let i = 0; i < limit; i += 1) {
    const count = rows[i].filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function normalizeHeader(value: unknown): string {
  return String(value || "").trim();
}

function parseExcelDate(xlsx: { SSF?: { parse_date_code?: (value: number) => { y: number; m: number; d: number; H?: number; M?: number; S?: number } | null } }, value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "number") return null;
  const parsed = xlsx.SSF?.parse_date_code ? xlsx.SSF.parse_date_code(value) : null;
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
  const h = parsed.H ?? 0;
  const m = parsed.M ?? 0;
  const s = parsed.S ?? 0;
  return new Date(parsed.y, parsed.m - 1, parsed.d, h, m, s);
}

function computeYearsInService(joinDate: Date, now = new Date()): number {
  let years = now.getFullYear() - joinDate.getFullYear();
  const m = now.getMonth() - joinDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < joinDate.getDate())) years -= 1;
  return Math.max(0, years);
}

function toDateValue(xlsx: { SSF?: { parse_date_code?: (value: number) => { y: number; m: number; d: number; H?: number; M?: number; S?: number } | null } }, value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") return parseExcelDate(xlsx, value);
  const asStr = String(value || "").trim();
  if (!asStr) return null;
  const parsed = new Date(asStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function coerceValueForColumn(xlsx: { SSF?: { parse_date_code?: (value: number) => { y: number; m: number; d: number; H?: number; M?: number; S?: number } | null } }, info: { type: string }, value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  const type = info.type;
  if (type.includes("int")) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (type.includes("bit")) {
    if (typeof value === "boolean") return value ? 1 : 0;
    const v = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(v)) return 1;
    if (["0", "false", "no", "n"].includes(v)) return 0;
    return null;
  }
  if (type.includes("decimal") || type.includes("numeric") || type.includes("float") || type.includes("real")) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (type.includes("date") || type.includes("time")) {
    return toDateValue(xlsx, value);
  }
  return String(value);
}

async function upsertMappedRow(
  pool: sql.ConnectionPool,
  table: string,
  row: Record<string, unknown>,
  columns: Set<string>,
  info: Array<{ name: string; type: string; nullable: boolean; hasDefault: boolean }>,
  xlsx: { SSF?: { parse_date_code?: (value: number) => { y: number; m: number; d: number; H?: number; M?: number; S?: number } | null } },
  dryRun: boolean
): Promise<void> {
  if (!row.employee_id) return;
  const req = new sql.Request(pool);
  req.input("employee_id", sql.VarChar(100), String(row.employee_id));
  const updateSets: string[] = [];
  const insertCols: string[] = ["employee_id"];
  const insertVals: string[] = ["@employee_id"];
  const infoMap = new Map(info.map((c) => [c.name, c]));

  for (const [key, raw] of Object.entries(row)) {
    const col = key.toLowerCase();
    if (col === "employee_id") continue;
    if (!columns.has(col)) continue;
    const colInfo = infoMap.get(col);
    if (!colInfo) continue;
    const param = `p_${col}`;
    const value = coerceValueForColumn(xlsx, colInfo, raw);
    if (colInfo.type.includes("date") || colInfo.type.includes("time")) {
      req.input(param, sql.DateTime2, value instanceof Date ? value : null);
    } else if (colInfo.type.includes("int")) {
      req.input(param, sql.Int, typeof value === "number" ? value : null);
    } else if (colInfo.type.includes("bit")) {
      req.input(param, sql.Bit, typeof value === "number" ? value : null);
    } else if (colInfo.type.includes("decimal") || colInfo.type.includes("numeric") || colInfo.type.includes("float") || colInfo.type.includes("real")) {
      req.input(param, sql.Decimal(18, 2), typeof value === "number" ? value : null);
    } else {
      req.input(param, sql.NVarChar(sql.MAX), value === null ? null : String(value));
    }
    updateSets.push(`[${col}]=@${param}`);
    insertCols.push(col);
    insertVals.push(`@${param}`);
  }

  for (const c of info) {
    if (!c.nullable && !c.hasDefault && c.name !== "employee_id" && !insertCols.includes(c.name)) {
      const param = `__def_${c.name}`;
      if (c.type.includes("char") || c.type.includes("text") || c.type.includes("nchar") || c.type.includes("nvarchar") || c.type.includes("varchar")) {
        req.input(param, sql.NVarChar(200), "");
        insertCols.push(c.name);
        insertVals.push(`@${param}`);
      } else if (c.type.includes("bit")) {
        req.input(param, sql.Bit, 0);
        insertCols.push(c.name);
        insertVals.push(`@${param}`);
      } else if (c.type.includes("int")) {
        req.input(param, sql.Int, 0);
        insertCols.push(c.name);
        insertVals.push(`@${param}`);
      } else if (c.type.includes("decimal") || c.type.includes("numeric") || c.type.includes("float") || c.type.includes("real")) {
        req.input(param, sql.Decimal(18, 2), 0);
        insertCols.push(c.name);
        insertVals.push(`@${param}`);
      } else if (c.type.includes("date") || c.type.includes("time")) {
        req.input(param, sql.DateTime2, new Date("1900-01-01T00:00:00Z"));
        insertCols.push(c.name);
        insertVals.push(`@${param}`);
      } else {
        req.input(param, sql.NVarChar(200), "");
        insertCols.push(c.name);
        insertVals.push(`@${param}`);
      }
    }
  }

  if (!updateSets.length) return;
  if (!dryRun) {
    await req.query(`
      IF EXISTS (SELECT 1 FROM dbo.${table} WHERE employee_id=@employee_id)
        UPDATE dbo.${table} SET ${updateSets.join(", ")} WHERE employee_id=@employee_id
      ELSE
        INSERT INTO dbo.${table} (${insertCols.map((c) => `[${c}]`).join(", ")})
        VALUES (${insertVals.join(", ")})
    `);
  }
}

type PhotoSyncStats = {
  scanned: number;
  updated: number;
  skipped: number;
  missing_in_dest: number;
  errors: Array<{ employee_id?: string | null; message: string }>;
};

function sanitizeSqlIdentifier(value: string, fallback: string): string {
  const raw = String(value || "").trim();
  return /^[A-Za-z0-9_]+$/.test(raw) ? raw : fallback;
}

function resolveCardTableName(): string {
  return sanitizeSqlIdentifier(String(process.env.DATA_DB_CARD_TABLE || "CardDB"), "CardDB");
}

function resolveCardSchemaName(): string {
  return sanitizeSqlIdentifier(String(process.env.DATA_DB_CARD_SCHEMA || "dbo"), "dbo");
}

async function resolveCardSourceObject(cardPool: sql.ConnectionPool): Promise<{ schemaName: string; tableName: string }> {
  const preferredSchema = resolveCardSchemaName();
  const preferredTable = resolveCardTableName();
  const preferredReq = new sql.Request(cardPool);
  preferredReq.input("schema_name", sql.NVarChar(128), preferredSchema);
  preferredReq.input("table_name", sql.NVarChar(128), preferredTable);
  const preferred = await preferredReq.query(`
    SELECT TOP 1 s.name AS schema_name, t.name AS table_name
    FROM sys.tables t
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name=@schema_name AND t.name=@table_name
  `);
  const preferredRow = (preferred.recordset || [])[0] as { schema_name?: string; table_name?: string } | undefined;
  if (preferredRow?.schema_name && preferredRow?.table_name) {
    return { schemaName: preferredRow.schema_name, tableName: preferredRow.table_name };
  }

  const searchReq = new sql.Request(cardPool);
  searchReq.input("table_name", sql.NVarChar(128), preferredTable);
  const found = await searchReq.query(`
    WITH candidates AS (
      SELECT
        c.TABLE_SCHEMA AS schema_name,
        c.TABLE_NAME AS table_name,
        SUM(CASE WHEN LOWER(c.COLUMN_NAME)='staffno' THEN 1 ELSE 0 END) AS has_staffno,
        SUM(CASE WHEN LOWER(c.COLUMN_NAME)='photo' THEN 1 ELSE 0 END) AS has_photo,
        SUM(CASE WHEN LOWER(c.COLUMN_NAME)='del_state' THEN 1 ELSE 0 END) AS has_del_state
      FROM INFORMATION_SCHEMA.COLUMNS c
      GROUP BY c.TABLE_SCHEMA, c.TABLE_NAME
    )
    SELECT TOP 1 schema_name, table_name
    FROM candidates
    WHERE has_staffno > 0 AND has_photo > 0
    ORDER BY
      CASE WHEN table_name=@table_name THEN 0
           WHEN table_name='CardDB' THEN 1
           WHEN table_name='CardDB2' THEN 2
           WHEN table_name LIKE 'CardDB%' THEN 3
           ELSE 4 END,
      CASE WHEN has_del_state > 0 THEN 0 ELSE 1 END,
      schema_name, table_name
  `);
  const foundRow = (found.recordset || [])[0] as { schema_name?: string; table_name?: string } | undefined;
  if (foundRow?.schema_name && foundRow?.table_name) {
    return { schemaName: foundRow.schema_name, tableName: foundRow.table_name };
  }
  const dbNameRes = await new sql.Request(cardPool).query(`SELECT DB_NAME() AS db_name`);
  const dbName = String(((dbNameRes.recordset || [])[0] as { db_name?: string } | undefined)?.db_name || "");
  throw new Error(`CARD_SOURCE_TABLE_NOT_FOUND (requested ${preferredSchema}.${preferredTable}, db=${dbName})`);
}

async function ensurePhotoSchema(pool: sql.ConnectionPool): Promise<void> {
  await new sql.Request(pool).query(`
    IF COL_LENGTH('dbo.employee_core', 'photo_blob') IS NULL
      ALTER TABLE dbo.employee_core ADD photo_blob VARBINARY(MAX) NULL;
  `);
}

async function runPhotoSyncWorker(dest: sql.ConnectionPool, dryRun: boolean, pageSizeRaw: unknown, onlyMissing: boolean): Promise<PhotoSyncStats> {
  const pageSize = Math.max(1, Math.min(1000, Math.floor(Number(pageSizeRaw) || 200)));
  const cardPool = getCardPool();
  const stats: PhotoSyncStats = { scanned: 0, updated: 0, skipped: 0, missing_in_dest: 0, errors: [] };
  let offset = 0;
  try {
    await cardPool.connect();
    await ensurePhotoSchema(dest);
    const cardSource = await resolveCardSourceObject(cardPool);
    const sourceSql = `[${cardSource.schemaName}].[${cardSource.tableName}]`;
    while (true) {
      const reqCard = new sql.Request(cardPool);
      reqCard.input("offset", sql.Int, offset);
      reqCard.input("limit", sql.Int, pageSize);
      const r = await reqCard.query(`
        SELECT StaffNo, Photo
        FROM ${sourceSql}
        WHERE ISNULL(Del_State, 0) = 0
          AND StaffNo IS NOT NULL
          AND LTRIM(RTRIM(StaffNo)) <> ''
          AND Photo IS NOT NULL
        ORDER BY StaffNo
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);
      const rows = (r.recordset || []) as Array<{ StaffNo?: string | null; Photo?: Buffer | Uint8Array | null }>;
      if (!rows.length) break;
      stats.scanned += rows.length;
      for (const row of rows) {
        const empId = String(row.StaffNo || "").trim();
        if (!empId) {
          stats.skipped += 1;
          continue;
        }
        const photoBuf = Buffer.isBuffer(row.Photo)
          ? row.Photo
          : row.Photo instanceof Uint8Array
            ? Buffer.from(row.Photo)
            : null;
        if (!photoBuf || !photoBuf.byteLength) {
          stats.skipped += 1;
          continue;
        }
        try {
          const existsReq = new sql.Request(dest);
          existsReq.input("employee_id", sql.VarChar(100), empId);
          const existsRes = await existsReq.query(`
            SELECT TOP 1 employee_id, DATALENGTH(photo_blob) AS existing_photo_len
            FROM dbo.employee_core
            WHERE employee_id=@employee_id
          `);
          const existingRow = (existsRes.recordset || [])[0] as { employee_id?: string; existing_photo_len?: number | null } | undefined;
          if (!existingRow?.employee_id) {
            stats.missing_in_dest += 1;
            continue;
          }
          const existingLen = Number(existingRow.existing_photo_len || 0);
          if (onlyMissing && existingLen > 0) {
            stats.skipped += 1;
            continue;
          }
          if (!dryRun) {
            const upReq = new sql.Request(dest);
            upReq.input("employee_id", sql.VarChar(100), empId);
            upReq.input("photo_blob", sql.VarBinary(sql.MAX), photoBuf);
            await upReq.query(`
              UPDATE dbo.employee_core
              SET photo_blob=@photo_blob, updated_at=SYSDATETIME()
              WHERE employee_id=@employee_id
            `);
          }
          stats.updated += 1;
        } catch (err: unknown) {
          stats.skipped += 1;
          stats.errors.push({ employee_id: empId, message: err instanceof Error ? err.message : String(err) });
        }
      }
      offset += pageSize;
    }
  } finally {
    await cardPool.close();
  }
  return stats;
}

syncRouter.put("/config", async (req, res) => {
  const pool = getDestPool();
  const body = req.body || {};
  const enabled = body.enabled === undefined ? false : !!body.enabled;
  const schedule = String(body.schedule || "");
  const photoSyncEnabled = body.photo_sync_enabled === undefined ? null : !!body.photo_sync_enabled;
  const photoSyncSchedule = String(body.photo_sync_schedule || "");
  const mapping = body.mapping ? JSON.stringify(body.mapping) : null;
  const sharepoint = body.sharepoint ? JSON.stringify(body.sharepoint) : null;
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const request = new sql.Request(pool);
    request.input("enabled", sql.Bit, enabled ? 1 : 0);
    request.input("schedule", sql.NVarChar(100), schedule || null);
    request.input("mapping", sql.NVarChar(sql.MAX), mapping);
    request.input("sharepoint", sql.NVarChar(sql.MAX), sharepoint);
    request.input("photo_sync_enabled", sql.Bit, photoSyncEnabled === null ? null : (photoSyncEnabled ? 1 : 0));
    request.input("photo_sync_schedule", sql.NVarChar(100), photoSyncSchedule || null);
    await request.query(`
      UPDATE dbo.sync_config 
      SET enabled=@enabled, schedule=@schedule, mapping=@mapping, sharepoint=@sharepoint,
          photo_sync_enabled=@photo_sync_enabled, photo_sync_schedule=@photo_sync_schedule, updated_at=SYSDATETIME()
      WHERE id=1
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_SAVE_SYNC_CONFIG";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.post("/run-sharepoint", async (req, res) => {
  const startedAt = new Date();
  const body = req.body || {};
  const dryRun = !!body.dry_run;
  const dest = getDestPool();
  const stats = { inserted: 0, updated: 0, skipped: 0, missing_in_source: 0, scanned: 0, examples: [] as Array<{ employee_id?: string | null }>, errors: [] as Array<{ employee_id?: string | null; message: string }> };
  try {
    await dest.connect();
    await ensureSyncSchema(dest);
    const mappingRaw = await readSharepointMappingFile();
    if (!mappingRaw) return res.status(404).json({ error: "MAPPING_FILE_NOT_FOUND" });
    const mapping = mappingRaw as SharepointMapping;
    const columnsByGroup = mapping.columns || {};
    const sheetMap = mapping.sheet_name_map || {};

    const filePath = path.resolve(process.cwd(), "storage", "sharepoint-review", "sharepoint-review.xlsx");
    const fileBuffer = await fs.readFile(filePath);
    const xlsx = await loadXLSXModule();
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });

    const perEmployee: Map<string, Record<string, Record<string, unknown>>> = new Map();
    const groupStatus: Record<string, string> = {
      "Active Employee (ID)": "Active",
      "Inactive Employee (ID)": "Non Active",
      "Active Employee CHN": "Active",
      "Inactive Employee CHN": "Non Active",
    };

    const collectRow = (empId: string, table: string, column: string, value: unknown) => {
      if (!perEmployee.has(empId)) perEmployee.set(empId, {});
      const tables = perEmployee.get(empId) as Record<string, Record<string, unknown>>;
      if (!tables[table]) tables[table] = {};
      tables[table][column] = value;
    };

    for (const [group, entries] of Object.entries(columnsByGroup)) {
      const sheetName = sheetMap[group] || group;
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
      const rows = toRowArrays(rawRows);
      if (!rows.length) continue;
      const headerRowIndex = pickHeaderRowIndex(rows);
      const headerRow = rows[headerRowIndex].map(normalizeHeader);
      const headerMap = new Map<string, number>();
      headerRow.forEach((h, idx) => {
        if (h) headerMap.set(h, idx);
      });

      for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
        const row = rows[r];
        const empIdIdx = headerMap.get("Emp. ID");
        const empIdRaw = empIdIdx !== undefined ? row[empIdIdx] : null;
        const empId = String(empIdRaw || "").trim();
        if (!empId) continue;
        stats.scanned += 1;
        for (const entry of entries) {
          if (entry.status !== "mapped" || !entry.db) continue;
          const colIdx = headerMap.get(entry.excelName);
          const value = colIdx !== undefined ? row[colIdx] : null;
          const targets = Array.isArray(entry.db) ? entry.db : [entry.db];
          for (const target of targets) {
            if (!target || !target.table || !target.column) continue;
            collectRow(empId, target.table, target.column, value);
          }
        }

        const status = groupStatus[group] || "Active";
        collectRow(empId, "employee_onboard", "employment_status", status);
      }
    }

    const tables = ["employee_core","employee_contact","employee_employment","employee_onboard","employee_bank","employee_insurance","employee_travel"];
    const columnsMap: Record<string, Set<string>> = {};
    const infoMap: Record<string, Array<{ name: string; type: string; nullable: boolean; hasDefault: boolean }>> = {};
    for (const t of tables) {
      columnsMap[t] = await scanColumns(dest, t);
      infoMap[t] = await getColumnInfo(dest, t);
    }

    for (const [empId, tableData] of perEmployee.entries()) {
      try {
        const onboard = tableData.employee_onboard;
        if (onboard && onboard.join_date) {
          const joinDate = toDateValue(xlsx, onboard.join_date);
          if (joinDate) onboard.years_in_service = computeYearsInService(joinDate);
        }
        for (const t of tables) {
          const data = tableData[t];
          if (!data) continue;
          data.employee_id = empId;
          await upsertMappedRow(dest, t, data, columnsMap[t], infoMap[t], xlsx, dryRun);
        }
        stats.inserted += 1;
      } catch (err: unknown) {
        stats.skipped += 1;
        stats.errors.push({ employee_id: empId, message: err instanceof Error ? err.message : String(err) });
      }
    }

    const runReq = new sql.Request(dest);
    runReq.input("started_at", sql.DateTime2, startedAt);
    runReq.input("finished_at", sql.DateTime2, new Date());
    runReq.input("success", sql.Bit, 1);
    runReq.input("stats", sql.NVarChar(sql.MAX), JSON.stringify(stats));
    await runReq.query(`
      INSERT INTO dbo.sync_runs (started_at, finished_at, success, stats) VALUES (@started_at, @finished_at, @success, @stats)
    `);
    return res.json({ ok: true, stats, dry_run: dryRun });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_RUN_SHAREPOINT_SYNC";
    try {
      const r = new sql.Request(dest);
      r.input("started_at", sql.DateTime2, startedAt);
      r.input("finished_at", sql.DateTime2, new Date());
      r.input("success", sql.Bit, 0);
      r.input("stats", sql.NVarChar(sql.MAX), JSON.stringify(stats));
      r.input("error", sql.NVarChar(sql.MAX), String(message));
      await r.query(`
        INSERT INTO dbo.sync_runs (started_at, finished_at, success, stats, error) VALUES (@started_at, @finished_at, @success, @stats, @error)
      `);
    } catch {}
    return res.status(500).json({ error: message });
  } finally {
    try { await dest.close(); } catch {}
  }
});

syncRouter.get("/config/sharepoint", async (_req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const r = await new sql.Request(pool).query(`SELECT TOP 1 sharepoint, sharepoint_auth, updated_at FROM dbo.sync_config WHERE id=1`);
    const row = (r.recordset || [])[0] as { sharepoint?: string; sharepoint_auth?: string; updated_at?: Date } | undefined;
    const sharepoint = parseJsonRecord(row?.sharepoint) || null;
    const authCache = readSharePointAuthCache(parseJsonRecord(row?.sharepoint_auth));
    return res.json({
      sharepoint,
      sharepoint_auth_cached: !!authCache,
      sharepoint_auth_expires_at: authCache?.expires_at || null,
      updated_at: row?.updated_at || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_SHAREPOINT_CONFIG";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.put("/config/sharepoint", async (req, res) => {
  const pool = getDestPool();
  const input = isRecord(req.body) && isRecord(req.body.sharepoint) ? req.body.sharepoint : req.body;
  const parsed = readSharePointConfig(input);
  if (!parsed) return res.status(400).json({ error: "SHAREPOINT_CONFIG_INVALID" });
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const request = new sql.Request(pool);
    request.input("sharepoint", sql.NVarChar(sql.MAX), JSON.stringify(parsed));
    await request.query(`
      UPDATE dbo.sync_config
      SET sharepoint=@sharepoint, updated_at=SYSDATETIME()
      WHERE id=1
    `);
    if (parsed.enabled) {
      const mappingJson = await readSharepointMappingFile();
      if (mappingJson) {
        const mappingRequest = new sql.Request(pool);
        mappingRequest.input("mapping", sql.NVarChar(sql.MAX), JSON.stringify(mappingJson));
        await mappingRequest.query(`
          UPDATE dbo.sync_config
          SET mapping=@mapping, updated_at=SYSDATETIME()
          WHERE id=1
        `);
      }
    }
    const updated = await new sql.Request(pool).query(`SELECT TOP 1 sharepoint, updated_at FROM dbo.sync_config WHERE id=1`);
    const row = (updated.recordset || [])[0] as { sharepoint?: string; updated_at?: Date } | undefined;
    return res.json({
      ok: true,
      sharepoint: parseJsonRecord(row?.sharepoint) || null,
      updated_at: row?.updated_at || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_SAVE_SHAREPOINT_CONFIG";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.get("/sharepoint/mapping-preview", async (_req, res) => {
  try {
    const mapping = await readSharepointMappingFile();
    if (!mapping) return res.status(404).json({ error: "MAPPING_FILE_NOT_FOUND" });
    return res.json(mapping);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_MAPPING_FILE";
    return res.status(500).json({ error: message });
  }
});

syncRouter.post("/run-photo", async (req, res) => {
  const startedAt = new Date();
  const body = req.body || {};
  const dryRun = !!body.dry_run;
  const pageSize = body.limit;
  const onlyMissing = body.only_missing === undefined ? true : !!body.only_missing;
  const runAsync = body.async === undefined ? true : !!body.async;
  const dest = getDestPool();
  try {
    await dest.connect();
    await ensureSyncSchema(dest);
    await ensurePhotoSchema(dest);

    const initReq = new sql.Request(dest);
    initReq.input("started_at", sql.DateTime2, startedAt);
    initReq.input("stats", sql.NVarChar(sql.MAX), JSON.stringify({ state: "running", dry_run: dryRun, only_missing: onlyMissing }));
    const initRes = await initReq.query(`
      INSERT INTO dbo.sync_runs (started_at, success, stats)
      OUTPUT INSERTED.run_id
      VALUES (@started_at, NULL, @stats)
    `);
    const runId = Number(((initRes.recordset || [])[0] as { run_id?: number } | undefined)?.run_id || 0);

    const execute = async () => {
      const workPool = getDestPool();
      let success = 1;
      let statsPayload: unknown = { scanned: 0, updated: 0, skipped: 0, missing_in_dest: 0, errors: [] };
      let errorMessage: string | null = null;
      try {
        await workPool.connect();
        await ensureSyncSchema(workPool);
        await ensurePhotoSchema(workPool);
        const stats = await runPhotoSyncWorker(workPool, dryRun, pageSize, onlyMissing);
        statsPayload = stats;
      } catch (err: unknown) {
        success = 0;
        errorMessage = err instanceof Error ? err.message : "FAILED_TO_RUN_PHOTO_SYNC";
      } finally {
        try {
          const endReq = new sql.Request(workPool);
          endReq.input("run_id", sql.Int, runId);
          endReq.input("finished_at", sql.DateTime2, new Date());
          endReq.input("success", sql.Bit, success);
          endReq.input("stats", sql.NVarChar(sql.MAX), JSON.stringify(statsPayload));
          endReq.input("error", sql.NVarChar(sql.MAX), errorMessage);
          await endReq.query(`
            UPDATE dbo.sync_runs
            SET finished_at=@finished_at, success=@success, stats=@stats, error=@error
            WHERE run_id=@run_id
          `);
        } finally {
          try { await workPool.close(); } catch {}
        }
      }
    };

    if (runAsync) {
      setTimeout(() => {
        execute().catch(() => {});
      }, 0);
      return res.status(202).json({ ok: true, accepted: true, run_id: runId, dry_run: dryRun, only_missing: onlyMissing });
    }

    await execute();
    const doneReq = new sql.Request(dest);
    doneReq.input("run_id", sql.Int, runId);
    const doneRes = await doneReq.query(`SELECT TOP 1 success, stats, error FROM dbo.sync_runs WHERE run_id=@run_id`);
    const doneRow = (doneRes.recordset || [])[0] as { success?: boolean | null; stats?: string | null; error?: string | null } | undefined;
    const doneStats = parseJsonRecord(doneRow?.stats) || null;
    if (!doneRow?.success) return res.status(500).json({ error: doneRow?.error || "FAILED_TO_RUN_PHOTO_SYNC", stats: doneStats, run_id: runId });
    return res.json({ ok: true, stats: doneStats, run_id: runId, dry_run: dryRun, only_missing: onlyMissing });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_RUN_PHOTO_SYNC";
    try {
      const r = new sql.Request(dest);
      r.input("started_at", sql.DateTime2, startedAt);
      r.input("finished_at", sql.DateTime2, new Date());
      r.input("success", sql.Bit, 0);
      r.input("stats", sql.NVarChar(sql.MAX), JSON.stringify({ scanned: 0, updated: 0, skipped: 0, missing_in_dest: 0, errors: [] }));
      r.input("error", sql.NVarChar(sql.MAX), String(message));
      await r.query(`
        INSERT INTO dbo.sync_runs (started_at, finished_at, success, stats, error) VALUES (@started_at, @finished_at, @success, @stats, @error)
      `);
    } catch {}
    return res.status(500).json({ error: message });
  } finally {
    try { await dest.close(); } catch {}
  }
});

syncRouter.post("/sharepoint/device-code", async (req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const bodySharepoint = isRecord(req.body) && isRecord(req.body.sharepoint) ? req.body.sharepoint : null;
    let sp = readSharePointConfig(bodySharepoint);
    if (!sp) {
      const configRes = await new sql.Request(pool).query(`SELECT TOP 1 sharepoint FROM dbo.sync_config WHERE id=1`);
      const row = (configRes.recordset || [])[0] as { sharepoint?: string } | undefined;
      const parsed = parseJsonRecord(row?.sharepoint) || null;
      sp = readSharePointConfig(parsed);
    }
    if (!sp) return res.status(400).json({ error: "SHAREPOINT_CONFIG_INVALID" });

    const tenant = encodeURIComponent(sp.tenant_id);
    const endpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`;
    const body = new URLSearchParams({
      client_id: sp.client_id,
      scope: "Files.Read offline_access",
    });
    const authRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await authRes.json().catch(() => null)) as unknown;
    if (!authRes.ok || !isRecord(payload)) {
      const err = isRecord(payload) && typeof payload.error_description === "string"
        ? payload.error_description
        : `HTTP_${authRes.status}`;
      return res.status(502).json({ error: "FAILED_TO_REQUEST_DEVICE_CODE", details: err });
    }

    return res.json({
      device_code: String(payload.device_code || ""),
      user_code: String(payload.user_code || ""),
      verification_uri: String(payload.verification_uri || ""),
      expires_in: Number(payload.expires_in || 0),
      interval: Number(payload.interval || 5),
      message: String(payload.message || ""),
      scope: String(payload.scope || "Files.Read offline_access"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_REQUEST_DEVICE_CODE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.post("/sharepoint/auth-status", async (req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const body = isRecord(req.body) ? req.body : {};
    const rawDeviceCode = String(body.device_code || "").trim();
    const bodySharepoint = isRecord(body.sharepoint) ? body.sharepoint : null;
    let sp = readSharePointConfig(bodySharepoint);
    if (!sp) {
      const configRes = await new sql.Request(pool).query(`SELECT TOP 1 sharepoint FROM dbo.sync_config WHERE id=1`);
      const row = (configRes.recordset || [])[0] as { sharepoint?: string } | undefined;
      const parsed = parseJsonRecord(row?.sharepoint) || null;
      sp = readSharePointConfig(parsed);
    }
    const fail = (message: string, authStatus = "failed") => {
      return res.json({
        auth_status: authStatus,
        connection_status: "not_connected",
        state: "FAILED",
        message,
      });
    };

    if (!sp) return fail("SharePoint configuration is invalid. Save Tenant ID and Client ID first.", "config_invalid");

    let authCache = await readAuthCacheFromDb(pool);
    let accessToken = isAuthCacheUsable(authCache) ? authCache.access_token : "";

    if (!accessToken && authCache?.refresh_token) {
      const refreshResult = await requestTokenByRefreshToken(sp.tenant_id, sp.client_id, authCache.refresh_token);
      if (refreshResult.ok) {
        const refreshed = buildAuthCacheFromTokenPayload(refreshResult.payload, authCache.refresh_token);
        if (refreshed) {
          authCache = refreshed;
          accessToken = refreshed.access_token;
          await saveAuthCacheToDb(pool, refreshed);
        }
      } else {
        const refreshErr = String(refreshResult.payload.error || "").trim();
        const refreshDesc = String(refreshResult.payload.error_description || "").trim();
        if (refreshErr === "invalid_grant" || refreshErr === "interaction_required") {
          authCache = null;
          accessToken = "";
          if (!rawDeviceCode) {
            return res.json({
              auth_status: "reauth_required",
              connection_status: "not_connected",
              state: "PENDING",
              message: refreshDesc || "Session expired. Generate a new device code and complete sign-in again.",
            });
          }
        }
      }
    }

    if (!accessToken) {
      if (!rawDeviceCode) {
        return res.json({
          auth_status: "device_code_missing",
          connection_status: "not_connected",
          state: "PENDING",
          message: "No valid cached token. Generate a new device code and complete sign-in.",
        });
      }
      const tokenResult = await requestTokenByDeviceCode(sp.tenant_id, sp.client_id, rawDeviceCode);
      if (!tokenResult.ok) {
        const err = String(tokenResult.payload.error || "").trim();
        const errDesc = String(tokenResult.payload.error_description || "").trim();
        if (err === "authorization_pending") {
          return res.json({
            auth_status: "authorization_pending",
            connection_status: "not_connected",
            state: "PENDING",
            message: errDesc || "Authorization is still pending. Complete verification in browser first.",
          });
        }
        if (err === "slow_down") {
          return res.json({
            auth_status: "slow_down",
            connection_status: "not_connected",
            state: "PENDING",
            message: errDesc || "Polling too frequently. Wait a few seconds and try again.",
          });
        }
        if (err === "authorization_code_already_redeemed" || err === "invalid_grant") {
          return res.json({
            auth_status: err || "invalid_grant",
            connection_status: "not_connected",
            state: "PENDING",
            message: "Device code already consumed or expired. Generate a new device code.",
          });
        }
        if (err === "expired_token" || err === "authorization_declined" || err === "bad_verification_code") {
          return res.json({
            auth_status: err,
            connection_status: "not_connected",
            state: "FAILED",
            message: errDesc || "Device authorization failed. Generate a new code.",
          });
        }
        const authStatus = err || "token_exchange_failed";
        return fail(errDesc || err || `Failed to exchange device code (HTTP_${tokenResult.status}).`, authStatus);
      }

      const tokenCache = buildAuthCacheFromTokenPayload(tokenResult.payload, authCache?.refresh_token || "");
      if (tokenCache) {
        authCache = tokenCache;
        accessToken = tokenCache.access_token;
        await saveAuthCacheToDb(pool, tokenCache);
      } else {
        accessToken = String(tokenResult.payload.access_token || "").trim();
      }
    }

    if (!accessToken) {
      return res.status(502).json({ error: "ACCESS_TOKEN_MISSING" });
    }

    const effectiveShareUrl = String(sp.share_url || "").trim();
    if (effectiveShareUrl) {
      const shareId = encodeShareUrlForGraph(effectiveShareUrl);
      const itemRes = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const itemPayload = (await itemRes.json().catch(() => null)) as unknown;
      if (!itemRes.ok || !isRecord(itemPayload)) {
        const graphErr = isRecord(itemPayload) && isRecord(itemPayload.error) && typeof itemPayload.error.message === "string"
          ? String(itemPayload.error.message)
          : "";
        return fail(`Authorized, but failed to resolve shared file link.${graphErr ? ` ${graphErr}` : ""}`, "share_link_resolve_failed");
      }
      return res.json({
        auth_status: "authorized",
        connection_status: "connected",
        state: "CONNECTED",
        message: "SharePoint connection established.",
      });
    }

    const siteMeta = extractSitePathFromUrl(sp.site_url);
    if (!siteMeta) {
      return fail("SharePoint Site URL is invalid. Use format https://<tenant>.sharepoint.com/sites/<site-name>", "site_url_invalid");
    }

    const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteMeta.hostname}:${siteMeta.sitePath}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sitePayload = (await siteRes.json().catch(() => null)) as unknown;
    if (!siteRes.ok || !isRecord(sitePayload)) {
      const graphErr = isRecord(sitePayload) && isRecord(sitePayload.error) && typeof sitePayload.error.message === "string"
        ? String(sitePayload.error.message)
        : "";
      return fail(`Authorized, but failed to resolve SharePoint site.${graphErr ? ` ${graphErr}` : ""}`, "site_resolve_failed");
    }
    const siteId = String(sitePayload.id || "").trim();
    if (!siteId) {
      return fail("Authorized, but site id is missing from Graph response.", "site_id_missing");
    }

    return res.json({
      auth_status: "authorized",
      connection_status: "connected",
      state: "CONNECTED",
      message: "SharePoint connection established.",
      site_id: siteId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_CHECK_AUTH_STATUS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.post("/sharepoint/download-file", async (req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const body = isRecord(req.body) ? req.body : {};
    const rawDeviceCode = String(body.device_code || "").trim();
    const shareUrl = String(body.share_url || "").trim();
    const bodySharepoint = isRecord(body.sharepoint) ? body.sharepoint : null;
    let sp = readSharePointConfig(bodySharepoint);
    if (!sp) {
      const configRes = await new sql.Request(pool).query(`SELECT TOP 1 sharepoint FROM dbo.sync_config WHERE id=1`);
      const row = (configRes.recordset || [])[0] as { sharepoint?: string } | undefined;
      const parsed = parseJsonRecord(row?.sharepoint) || null;
      sp = readSharePointConfig(parsed);
    }
    if (!sp) return res.status(400).json({ error: "SHAREPOINT_CONFIG_INVALID" });
    const effectiveShareUrl = shareUrl || String(sp.share_url || "").trim();
    if (!effectiveShareUrl) return res.status(400).json({ error: "SHARE_URL_REQUIRED" });

    let authCache = await readAuthCacheFromDb(pool);
    let accessToken = isAuthCacheUsable(authCache) ? authCache.access_token : "";

    if (!accessToken && authCache?.refresh_token) {
      const refreshResult = await requestTokenByRefreshToken(sp.tenant_id, sp.client_id, authCache.refresh_token);
      if (refreshResult.ok) {
        const refreshed = buildAuthCacheFromTokenPayload(refreshResult.payload, authCache.refresh_token);
        if (refreshed) {
          authCache = refreshed;
          accessToken = refreshed.access_token;
          await saveAuthCacheToDb(pool, refreshed);
        }
      }
    }

    if (!accessToken) {
      if (!rawDeviceCode) {
        return res.json({
          state: "PENDING",
          message: "No valid cached token. Generate a new device code and complete sign-in.",
        });
      }
      const tokenResult = await requestTokenByDeviceCode(sp.tenant_id, sp.client_id, rawDeviceCode);
      if (!tokenResult.ok) {
        const err = String(tokenResult.payload.error || "").trim();
        const errDesc = String(tokenResult.payload.error_description || "").trim();
        if (err === "authorization_pending") {
          return res.json({ state: "PENDING", message: errDesc || "Authorization is pending. Complete verification first." });
        }
        if (err === "slow_down") {
          return res.json({ state: "PENDING", message: errDesc || "Please wait a few seconds before trying again." });
        }
        if (err === "authorization_code_already_redeemed" || err === "invalid_grant") {
          return res.json({
            state: "PENDING",
            message: "Device code already consumed. Click Check Connection once or generate a new code to refresh auth cache.",
          });
        }
        return res.status(502).json({ error: err || "FAILED_TO_EXCHANGE_DEVICE_CODE", details: errDesc || `HTTP_${tokenResult.status}` });
      }
      const tokenCache = buildAuthCacheFromTokenPayload(tokenResult.payload, authCache?.refresh_token || "");
      if (tokenCache) {
        authCache = tokenCache;
        accessToken = tokenCache.access_token;
        await saveAuthCacheToDb(pool, tokenCache);
      } else {
        accessToken = String(tokenResult.payload.access_token || "").trim();
      }
    }

    if (!accessToken) return res.status(502).json({ error: "ACCESS_TOKEN_MISSING" });

    const shareId = encodeShareUrlForGraph(effectiveShareUrl);
    const itemRes = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const itemPayload = (await itemRes.json().catch(() => null)) as unknown;
    if (!itemRes.ok || !isRecord(itemPayload)) {
      const graphErr = isRecord(itemPayload) && isRecord(itemPayload.error) && typeof itemPayload.error.message === "string"
        ? String(itemPayload.error.message)
        : "";
      return res.status(502).json({ error: "FAILED_TO_RESOLVE_SHARE_LINK", details: graphErr || `HTTP_${itemRes.status}` });
    }
    const itemId = String(itemPayload.id || "").trim();
    const itemName = sanitizeFileName(String(itemPayload.name || "sharepoint-file.xlsx").trim() || "sharepoint-file.xlsx");
    const downloadUrl = String(itemPayload["@microsoft.graph.downloadUrl"] || "").trim();

    let bytes: Uint8Array;
    if (downloadUrl) {
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) return res.status(502).json({ error: "FAILED_TO_DOWNLOAD_FILE", details: `HTTP_${fileRes.status}` });
      const arr = await fileRes.arrayBuffer();
      bytes = new Uint8Array(arr);
    } else if (itemId) {
      const fallbackRes = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem/content`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!fallbackRes.ok) return res.status(502).json({ error: "FAILED_TO_DOWNLOAD_FILE", details: `HTTP_${fallbackRes.status}` });
      const arr = await fallbackRes.arrayBuffer();
      bytes = new Uint8Array(arr);
    } else {
      return res.status(502).json({ error: "SHARE_ITEM_ID_MISSING" });
    }

    const dir = path.resolve(process.cwd(), "storage", "sharepoint-review");
    await fs.mkdir(dir, { recursive: true });
    const fixedFileName = "sharepoint-review.xlsx";
    const absolutePath = path.join(dir, fixedFileName);
    await fs.writeFile(absolutePath, bytes);

    return res.json({
      state: "DOWNLOADED",
      message: "File downloaded and stored for review.",
      file_name: fixedFileName,
      source_file_name: itemName,
      bytes: bytes.byteLength,
      local_path: absolutePath,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_DOWNLOAD_SHAREPOINT_FILE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.get("/status", async (_req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const r = await new sql.Request(pool).query(`SELECT TOP 1 * FROM dbo.sync_runs ORDER BY run_id DESC`);
    const row = (r.recordset || [])[0] as { started_at?: Date; finished_at?: Date; success?: boolean; stats?: string; error?: string } | undefined;
    return res.json({
      started_at: row?.started_at || null,
      finished_at: row?.finished_at || null,
      success: row?.success ?? null,
      stats: row?.stats ? JSON.parse(String(row.stats)) : null,
      error: row?.error || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_SYNC_STATUS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.get("/diagnostics/schema", async (_req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    const tables = ["employee_core","employee_contact","employee_employment","employee_onboard"];
    const out: Record<string, Array<{ column: string; type: string; nullable: boolean; default?: string | null }>> = {};
    for (const t of tables) {
      const r = await new sql.Request(pool).query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='${t}'
        ORDER BY ORDINAL_POSITION
      `);
      out[t] = (r.recordset || []).map((row: any) => ({
        column: String(row.COLUMN_NAME || ""),
        type: String(row.DATA_TYPE || ""),
        nullable: String(row.IS_NULLABLE || "YES").toUpperCase() === "YES",
        default: row.COLUMN_DEFAULT ? String(row.COLUMN_DEFAULT) : null,
      }));
    }
    return res.json({ tables: out });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_SCHEMA";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
type SrcUser = {
  employee_id?: string | null;
  StaffNo?: string | null;
  employee_name?: string | null;
  gender?: string | null;
  division?: string | null;
  department?: string | null;
  section?: string | null;
  position_title?: string | null;
  grade_interval?: string | null;
  phone?: string | null;
  day_type?: string | null;
  CardNo?: string | null;
};

async function scanColumns(pool: sql.ConnectionPool, table: string): Promise<Set<string>> {
  const req = new sql.Request(pool);
  req.input("table", sql.NVarChar(128), table);
  const r = await req.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=@table
  `);
  const out = new Set<string>();
  for (const row of (r.recordset || []) as Array<{ COLUMN_NAME?: string }>) out.add(String(row.COLUMN_NAME || "").trim().toLowerCase());
  return out;
}

async function getColumnInfo(pool: sql.ConnectionPool, table: string): Promise<Array<{ name: string; type: string; nullable: boolean; hasDefault: boolean }>> {
  const req = new sql.Request(pool);
  req.input("table", sql.NVarChar(128), table);
  const r = await req.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=@table
    ORDER BY ORDINAL_POSITION
  `);
  return (r.recordset || []).map((row) => ({
    name: String((row as any).COLUMN_NAME || "").trim().toLowerCase(),
    type: String((row as any).DATA_TYPE || "").trim().toLowerCase(),
    nullable: String((row as any).IS_NULLABLE || "YES").toUpperCase() === "YES",
    hasDefault: !!(row as any).COLUMN_DEFAULT,
  }));
}

syncRouter.post("/run", async (req, res) => {
  const startedAt = new Date();
  const body = req.body || {};
  const dryRun = !!body.dry_run;
  const pageSize = Math.min(parseInt(String(body.limit || "500"), 10) || 500, 5000);
  let offset = Math.max(0, parseInt(String(body.offset || "0"), 10) || 0);
  const dest = getDestPool();
  const src = getSrcPool();
  const stats = { inserted: 0, updated: 0, skipped: 0, missing_in_source: 0, scanned: 0, examples: [] as Array<{ employee_id?: string | null; StaffNo?: string | null }>, errors: [] as Array<{ employee_id?: string | null; StaffNo?: string | null; message: string }> };
  try {
    await dest.connect();
    await src.connect();
    await ensureSyncSchema(dest);
    const coreCols = await scanColumns(dest, "employee_core");
    const coreInfo = await getColumnInfo(dest, "employee_core");
    const contactCols = await scanColumns(dest, "employee_contact");
    const contactInfo = await getColumnInfo(dest, "employee_contact");
    const employmentCols = await scanColumns(dest, "employee_employment");
    const employmentInfo = await getColumnInfo(dest, "employee_employment");
    const onboardCols = await scanColumns(dest, "employee_onboard");
    const onboardInfo = await getColumnInfo(dest, "employee_onboard");
    let loop = 0;
    while (true) {
      const srcRowsRes = await new sql.Request(src).query(`
        SELECT
          employee_id, StaffNo, employee_name, gender, division, department, section,
          position_title, grade_interval, phone, day_type, CardNo
        FROM EmployeeWorkflow.dbo.MTIUsers
        ORDER BY StaffNo
        OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
      `);
      const srcRows: SrcUser[] = (srcRowsRes.recordset || []) as any[];
      if (!srcRows.length) break;
      stats.scanned += srcRows.length;
      if (loop === 0) stats.examples = srcRows.slice(0, 5).map((r) => ({ employee_id: r.employee_id || null, StaffNo: r.StaffNo || null }));
      for (const s of srcRows) {
      const empId = String(s.employee_id || s.StaffNo || "").trim();
      if (!empId) { stats.skipped++; continue; }
      const natVal = (() => {
        const up = empId.toUpperCase();
        if (up.startsWith("MTIBJ")) return "Expat";
        if (up.startsWith("MTI")) return "Indonesia";
        return null;
      })();
      const idReq = new sql.Request(dest);
      idReq.input("employee_id", sql.VarChar(100), empId);
      const existsRes = await idReq.query(`SELECT TOP 1 employee_id FROM dbo.employee_core WHERE employee_id=@employee_id`);
      const exists = !!((existsRes.recordset || [])[0]);
      try {
        const nowIdCard = !!(s.CardNo && String(s.CardNo).trim());
        if (!exists) {
          const reqIns = new sql.Request(dest);
          reqIns.input("employee_id", sql.VarChar(100), empId);
          reqIns.input("name", sql.NVarChar(200), s.employee_name ? String(s.employee_name) : null);
          reqIns.input("gender", sql.Char(1), (() => { const g = String(s.gender || "").toLowerCase(); if (g.startsWith("m")) return "M"; if (g.startsWith("f")) return "F"; return null; })());
          if (coreCols.has("nationality")) reqIns.input("nationality", sql.NVarChar(100), natVal);
          if (coreCols.has("id_card_mti")) reqIns.input("id_card_mti", sql.Bit, nowIdCard ? 1 : 0);
          if (coreCols.has("imip_id")) reqIns.input("imip_id", sql.VarChar(100), String(s.StaffNo || empId));
          const cols = ["employee_id","name","gender"].filter((c) => coreCols.has(c));
          const vals = ["@employee_id","@name","@gender"];
          if (coreCols.has("nationality")) { cols.push("nationality"); vals.push("@nationality"); }
          if (coreCols.has("id_card_mti")) { cols.push("id_card_mti"); vals.push("@id_card_mti"); }
          if (coreCols.has("imip_id")) { cols.push("imip_id"); vals.push("@imip_id"); }
          for (const c of coreInfo) {
            if (!c.nullable && !c.hasDefault && !cols.includes(c.name)) {
              // Provide safe defaults for non-nullable columns we don't map
              const param = `__def_${c.name}`;
              if (c.type.includes("char") || c.type.includes("text") || c.type.includes("nchar") || c.type.includes("nvarchar") || c.type.includes("varchar")) {
                reqIns.input(param, sql.NVarChar(200), "");
                cols.push(c.name);
                vals.push(`@${param}`);
              } else if (c.type.includes("bit")) {
                reqIns.input(param, sql.Bit, 0);
                cols.push(c.name);
                vals.push(`@${param}`);
              } else if (c.type.includes("int")) {
                reqIns.input(param, sql.Int, 0);
                cols.push(c.name);
                vals.push(`@${param}`);
              } else if (c.type.includes("decimal") || c.type.includes("numeric") || c.type.includes("float") || c.type.includes("real")) {
                reqIns.input(param, sql.Decimal(18,2), 0);
                cols.push(c.name);
                vals.push(`@${param}`);
              } else if (c.type.includes("date") || c.type.includes("time")) {
                // Set to NULL if column exists but is non-nullable; if truly non-nullable date/time, attempt minimal date
                reqIns.input(param, sql.DateTime2, new Date("1900-01-01T00:00:00Z"));
                cols.push(c.name);
                vals.push(`@${param}`);
              } else {
                // Fallback empty string
                reqIns.input(param, sql.NVarChar(200), "");
                cols.push(c.name);
                vals.push(`@${param}`);
              }
            }
          }
          if (!dryRun) {
            await reqIns.query(`
              INSERT INTO dbo.employee_core (${cols.map((c) => `[${c}]`).join(", ")})
              VALUES (${vals.join(", ")})
            `);
          }
          stats.inserted++;
        } else {
          const reqUpd = new sql.Request(dest);
          reqUpd.input("employee_id", sql.VarChar(100), empId);
          reqUpd.input("name", sql.NVarChar(200), s.employee_name ? String(s.employee_name) : null);
          reqUpd.input("gender", sql.Char(1), (() => { const g = String(s.gender || "").toLowerCase(); if (g.startsWith("m")) return "M"; if (g.startsWith("f")) return "F"; return null; })());
          if (coreCols.has("nationality") && natVal !== null) reqUpd.input("nationality", sql.NVarChar(100), natVal);
          if (coreCols.has("id_card_mti")) reqUpd.input("id_card_mti", sql.Bit, nowIdCard ? 1 : 0);
          if (coreCols.has("imip_id")) reqUpd.input("imip_id", sql.VarChar(100), String(s.StaffNo || empId));
          const sets: string[] = [];
          if (coreCols.has("name")) sets.push("[name]=@name");
          if (coreCols.has("gender")) sets.push("[gender]=@gender");
          if (coreCols.has("nationality") && natVal !== null) sets.push("[nationality]=@nationality");
          if (coreCols.has("id_card_mti")) sets.push("[id_card_mti]=@id_card_mti");
          if (coreCols.has("imip_id")) sets.push("[imip_id]=ISNULL([imip_id], @imip_id)");
          if (sets.length && !dryRun) await reqUpd.query(`UPDATE dbo.employee_core SET ${sets.join(", ")} WHERE employee_id=@employee_id`);
          stats.updated++;
        }
        const reqEmp = new sql.Request(dest);
        reqEmp.input("employee_id", sql.VarChar(100), empId);
        if (employmentCols.has("division")) reqEmp.input("division", sql.NVarChar(100), s.division ? String(s.division) : null);
        if (employmentCols.has("department")) reqEmp.input("department", sql.NVarChar(100), s.department ? String(s.department) : null);
        if (employmentCols.has("section")) reqEmp.input("section", sql.NVarChar(100), s.section ? String(s.section) : null);
        if (employmentCols.has("job_title")) reqEmp.input("job_title", sql.NVarChar(100), s.position_title ? String(s.position_title) : null);
        if (employmentCols.has("grade")) reqEmp.input("grade", sql.NVarChar(50), s.grade_interval ? String(s.grade_interval) : null);
        const upEmpSets: string[] = [];
        if (employmentCols.has("division")) upEmpSets.push("[division]=@division");
        if (employmentCols.has("department")) upEmpSets.push("[department]=@department");
        if (employmentCols.has("section")) upEmpSets.push("[section]=@section");
        if (employmentCols.has("job_title")) upEmpSets.push("[job_title]=@job_title");
        if (employmentCols.has("grade")) upEmpSets.push("[grade]=@grade");
        if (upEmpSets.length) {
          const insCols: string[] = ["employee_id"];
          const insVals: string[] = ["@employee_id"];
          if (employmentCols.has("division")) { insCols.push("division"); insVals.push("@division"); }
          if (employmentCols.has("department")) { insCols.push("department"); insVals.push("@department"); }
          if (employmentCols.has("section")) { insCols.push("section"); insVals.push("@section"); }
          if (employmentCols.has("job_title")) { insCols.push("job_title"); insVals.push("@job_title"); }
          if (employmentCols.has("grade")) { insCols.push("grade"); insVals.push("@grade"); }
          for (const c of employmentInfo) {
            if (!c.nullable && !c.hasDefault && !insCols.includes(c.name) && c.name !== "employee_id") {
              const param = `__def_emp_${c.name}`;
              if (c.type.includes("char") || c.type.includes("text") || c.type.includes("nchar") || c.type.includes("nvarchar") || c.type.includes("varchar")) {
                reqEmp.input(param, sql.NVarChar(200), "");
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("bit")) {
                reqEmp.input(param, sql.Bit, 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("int")) {
                reqEmp.input(param, sql.Int, 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("decimal") || c.type.includes("numeric") || c.type.includes("float") || c.type.includes("real")) {
                reqEmp.input(param, sql.Decimal(18,2), 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("date") || c.type.includes("time")) {
                reqEmp.input(param, sql.DateTime2, new Date("1900-01-01T00:00:00Z"));
                insCols.push(c.name); insVals.push(`@${param}`);
              } else {
                reqEmp.input(param, sql.NVarChar(200), "");
                insCols.push(c.name); insVals.push(`@${param}`);
              }
            }
          }
          if (!dryRun) {
            await reqEmp.query(`
              IF EXISTS (SELECT 1 FROM dbo.employee_employment WHERE employee_id=@employee_id)
                UPDATE dbo.employee_employment SET ${upEmpSets.join(", ")} WHERE employee_id=@employee_id
              ELSE
                INSERT INTO dbo.employee_employment (${insCols.map((c) => `[${c}]`).join(", ")})
                VALUES (${insVals.join(", ")})
            `);
          }
        }
        const reqContact = new sql.Request(dest);
        reqContact.input("employee_id", sql.VarChar(100), empId);
        if (contactCols.has("phone_number")) reqContact.input("phone_number", sql.NVarChar(50), s.phone ? String(s.phone) : null);
        const upContactSets: string[] = [];
        if (contactCols.has("phone_number")) upContactSets.push("[phone_number]=@phone_number");
        if (upContactSets.length) {
          const insCols: string[] = ["employee_id"];
          const insVals: string[] = ["@employee_id"];
          if (contactCols.has("phone_number")) { insCols.push("phone_number"); insVals.push("@phone_number"); }
          for (const c of contactInfo) {
            if (!c.nullable && !c.hasDefault && !insCols.includes(c.name) && c.name !== "employee_id") {
              const param = `__def_contact_${c.name}`;
              if (c.type.includes("char") || c.type.includes("text") || c.type.includes("nchar") || c.type.includes("nvarchar") || c.type.includes("varchar")) {
                reqContact.input(param, sql.NVarChar(200), "");
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("bit")) {
                reqContact.input(param, sql.Bit, 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("int")) {
                reqContact.input(param, sql.Int, 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("decimal") || c.type.includes("numeric") || c.type.includes("float") || c.type.includes("real")) {
                reqContact.input(param, sql.Decimal(18,2), 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("date") || c.type.includes("time")) {
                reqContact.input(param, sql.DateTime2, new Date("1900-01-01T00:00:00Z"));
                insCols.push(c.name); insVals.push(`@${param}`);
              } else {
                reqContact.input(param, sql.NVarChar(200), "");
                insCols.push(c.name); insVals.push(`@${param}`);
              }
            }
          }
          if (!dryRun) {
            await reqContact.query(`
              IF EXISTS (SELECT 1 FROM dbo.employee_contact WHERE employee_id=@employee_id)
                UPDATE dbo.employee_contact SET ${upContactSets.join(", ")} WHERE employee_id=@employee_id
              ELSE
                INSERT INTO dbo.employee_contact (${insCols.map((c) => `[${c}]`).join(", ")})
                VALUES (${insVals.join(", ")})
            `);
          }
        }
        const reqOnb = new sql.Request(dest);
        reqOnb.input("employee_id", sql.VarChar(100), empId);
        if (onboardCols.has("schedule_type")) reqOnb.input("schedule_type", sql.NVarChar(50), s.day_type ? String(s.day_type) : null);
        const upOnbSets: string[] = [];
        if (onboardCols.has("schedule_type")) upOnbSets.push("[schedule_type]=@schedule_type");
        if (upOnbSets.length) {
          const insCols: string[] = ["employee_id"];
          const insVals: string[] = ["@employee_id"];
          if (onboardCols.has("schedule_type")) { insCols.push("schedule_type"); insVals.push("@schedule_type"); }
          for (const c of onboardInfo) {
            if (!c.nullable && !c.hasDefault && !insCols.includes(c.name) && c.name !== "employee_id") {
              const param = `__def_onboard_${c.name}`;
              if (c.type.includes("char") || c.type.includes("text") || c.type.includes("nchar") || c.type.includes("nvarchar") || c.type.includes("varchar")) {
                reqOnb.input(param, sql.NVarChar(200), "");
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("bit")) {
                reqOnb.input(param, sql.Bit, 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("int")) {
                reqOnb.input(param, sql.Int, 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("decimal") || c.type.includes("numeric") || c.type.includes("float") || c.type.includes("real")) {
                reqOnb.input(param, sql.Decimal(18,2), 0);
                insCols.push(c.name); insVals.push(`@${param}`);
              } else if (c.type.includes("date") || c.type.includes("time")) {
                reqOnb.input(param, sql.DateTime2, new Date("1900-01-01T00:00:00Z"));
                insCols.push(c.name); insVals.push(`@${param}`);
              } else {
                reqOnb.input(param, sql.NVarChar(200), "");
                insCols.push(c.name); insVals.push(`@${param}`);
              }
            }
          }
          if (!dryRun) {
            await reqOnb.query(`
              IF EXISTS (SELECT 1 FROM dbo.employee_onboard WHERE employee_id=@employee_id)
                UPDATE dbo.employee_onboard SET ${upOnbSets.join(", ")} WHERE employee_id=@employee_id
              ELSE
                INSERT INTO dbo.employee_onboard (${insCols.map((c) => `[${c}]`).join(", ")})
                VALUES (${insVals.join(", ")})
            `);
          }
        }
      } catch (err: unknown) {
        stats.skipped++;
        stats.errors.push({ employee_id: s.employee_id || null, StaffNo: s.StaffNo || null, message: err instanceof Error ? err.message : String(err) });
      }
      }
      offset += pageSize;
      loop += 1;
    }
    const runReq = new sql.Request(dest);
    runReq.input("started_at", sql.DateTime2, startedAt);
    runReq.input("finished_at", sql.DateTime2, new Date());
    runReq.input("success", sql.Bit, 1);
    runReq.input("stats", sql.NVarChar(sql.MAX), JSON.stringify(stats));
    await runReq.query(`
      INSERT INTO dbo.sync_runs (started_at, finished_at, success, stats) VALUES (@started_at, @finished_at, @success, @stats)
    `);
    return res.json({ ok: true, stats, dry_run: dryRun });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_RUN_SYNC";
    try {
      const r = new sql.Request(dest);
      r.input("started_at", sql.DateTime2, startedAt);
      r.input("finished_at", sql.DateTime2, new Date());
      r.input("success", sql.Bit, 0);
      r.input("stats", sql.NVarChar(sql.MAX), JSON.stringify(stats));
      r.input("error", sql.NVarChar(sql.MAX), String(message));
      await r.query(`
        INSERT INTO dbo.sync_runs (started_at, finished_at, success, stats, error) VALUES (@started_at, @finished_at, @success, @stats, @error)
      `);
    } catch {}
    return res.status(500).json({ error: message });
  } finally {
    try { await dest.close(); } catch {}
    try { await src.close(); } catch {}
  }
});
