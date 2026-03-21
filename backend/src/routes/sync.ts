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
  `);
}

syncRouter.get("/config", async (_req, res) => {
  const pool = getDestPool();
  try {
    await pool.connect();
    await ensureSyncSchema(pool);
    const r = await new sql.Request(pool).query(`SELECT TOP 1 enabled, schedule, mapping, sharepoint, sharepoint_auth, updated_at FROM dbo.sync_config WHERE id=1`);
    const row = (r.recordset || [])[0] as { enabled?: boolean; schedule?: string; mapping?: string; sharepoint?: string; sharepoint_auth?: string; updated_at?: Date } | undefined;
    const authCache = readSharePointAuthCache(parseJsonRecord(row?.sharepoint_auth));
    return res.json({
      enabled: !!row?.enabled,
      schedule: row?.schedule || "",
      mapping: parseJsonRecord(row?.mapping) || null,
      sharepoint: parseJsonRecord(row?.sharepoint) || null,
      sharepoint_auth_cached: !!authCache,
      sharepoint_auth_expires_at: authCache?.expires_at || null,
      updated_at: row?.updated_at || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_SYNC_CONFIG";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

syncRouter.put("/config", async (req, res) => {
  const pool = getDestPool();
  const body = req.body || {};
  const enabled = body.enabled === undefined ? false : !!body.enabled;
  const schedule = String(body.schedule || "");
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
    await request.query(`
      UPDATE dbo.sync_config 
      SET enabled=@enabled, schedule=@schedule, mapping=@mapping, sharepoint=@sharepoint, updated_at=SYSDATETIME()
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
