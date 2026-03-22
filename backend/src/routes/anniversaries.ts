import { Router } from "express";
import sql from "mssql";
import { CONFIG } from "../config";
import path from "node:path";
import fs from "node:fs";
import { authMiddleware, requireRole } from "../middleware/auth";

export const anniversariesRouter = Router();

anniversariesRouter.use(authMiddleware);
anniversariesRouter.use(requireRole(["hr_general", "admin", "superadmin"]));

type AnniversaryType = "birthday" | "work";
type AnniversaryStatus = "pending" | "approved" | "rejected" | "needs_revision" | "sent";

type AnniversaryCandidate = {
  employeeId: string;
  name: string;
  department: string | null;
  gender: string | null;
  type: AnniversaryType;
  anniversaryDate: Date;
  years: number | null;
};

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

async function ensureAnniversarySchema(pool: sql.ConnectionPool) {
  await new sql.Request(pool).query(`
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const start = addDays(d, -diff);
  return normalizeDate(start);
}

function safeAnniversaryDate(baseDate: Date, year: number) {
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  const candidate = new Date(year, month, day);
  if (candidate.getMonth() !== month) {
    return new Date(year, month + 1, 0);
  }
  return candidate;
}

function nextAnniversary(baseDate: Date, today: Date) {
  const currentYear = today.getFullYear();
  let candidate = safeAnniversaryDate(baseDate, currentYear);
  if (candidate < today) {
    candidate = safeAnniversaryDate(baseDate, currentYear + 1);
  }
  return candidate;
}

function yearsAtAnniversary(startDate: Date, anniversaryDate: Date) {
  let years = anniversaryDate.getFullYear() - startDate.getFullYear();
  const monthDiff = anniversaryDate.getMonth() - startDate.getMonth();
  const dayDiff = anniversaryDate.getDate() - startDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years -= 1;
  return Math.max(0, years);
}

async function estimateBodyProportion(apiKey: string, model: string, photoB64: string) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "image/png", data: photoB64 } },
            {
              text: [
                "You are a strict extractor. Return ONLY a compact JSON with:",
                '{ "proportionScore": <0..1>, "posture": "straight"|"tilted", "confidence": <0..1> }',
                "- proportionScore: 0=broad/stocky, 1=slender; infer from neck/shoulder clues visible near the face.",
                "- posture: straight if head is roughly front-facing; otherwise tilted.",
                "- If unsure, set confidence low and proportionScore ~0.5.",
              ].join("\\n"),
            },
          ],
        }],
        generationConfig: {
          responseModalities: ["TEXT"],
          thinkingConfig: { thinkingLevel: "Minimal", includeThoughts: false },
        },
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) return null;
    const candidates: unknown[] = (data && data.candidates) || [];
    let textOut = "";
    for (const c of candidates) {
      const parts = (c as { content?: { parts?: Array<{ text?: string }> } } | undefined)?.content?.parts || [];
      for (const p of parts) if (p.text) textOut += p.text;
    }
    const firstBrace = textOut.indexOf("{");
    const lastBrace = textOut.lastIndexOf("}");
    const jsonStr = firstBrace >= 0 && lastBrace > firstBrace ? textOut.slice(firstBrace, lastBrace + 1) : textOut.trim();
    const parsed = JSON.parse(jsonStr) as { proportionScore?: unknown; posture?: unknown; confidence?: unknown };
    const proportionScore = typeof parsed.proportionScore === "number" ? Math.min(1, Math.max(0, parsed.proportionScore)) : 0.5;
    const posture = parsed.posture === "tilted" ? "tilted" : "straight";
    const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
    return { proportionScore, posture, confidence };
  } catch {
    return null;
  }
}

function buildPrompt(candidate: AnniversaryCandidate) {
  const genderText = candidate.gender ? String(candidate.gender).trim().toLowerCase() : "";
  const genderLabel = genderText.includes("female") || genderText === "f" || genderText.includes("perempuan") ? "female" : genderText.includes("male") || genderText === "m" || genderText.includes("laki") ? "male" : "neutral";
  const years = candidate.years ?? 0;
  const typeLabel = candidate.type === "work" ? "work anniversary" : "birthday";
  return `Update the anniversary template with employee ${candidate.name} (${genderLabel}), ${years} years, and keep the template styling.`;
}

function formatEmailSubject(candidate: AnniversaryCandidate) {
  if (candidate.type === "work") {
    const years = candidate.years ?? 0;
    return `🎉 Happy ${years} Year Work Anniversary, ${candidate.name}!`;
  }
  return `🎂 Happy Birthday, ${candidate.name}!`;
}

function formatEmailBody(candidate: AnniversaryCandidate) {
  const years = candidate.years ?? 0;
  const typeLabel = candidate.type === "work" ? `Celebrating ${years} Years of Dedication` : "Wishing you a wonderful day";
  return `
    <div style="font-family: Inter, Arial, sans-serif;">
      <h2 style="margin:0 0 8px;">Happy ${candidate.type === "work" ? "Work Anniversary" : "Birthday"} ${candidate.name}</h2>
      <p style="margin:0 0 8px;">${typeLabel}</p>
      <p style="margin:0;">${candidate.department ? candidate.department : ""}</p>
    </div>
  `.trim();
}

anniversariesRouter.get("/settings", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const result = await new sql.Request(pool).query(`
      SELECT TOP 1 provider, fallback_enabled, model_preset, weekly_generation_day, weekly_generation_time, weekly_generation_timezone,
        nano_banana_api_key, openai_api_key
      FROM dbo.anniversary_settings
      WHERE id=1
    `);
    const row = (result.recordset || [])[0] as {
      provider?: string | null;
      fallback_enabled?: boolean | number | null;
      model_preset?: string | null;
      weekly_generation_day?: string | null;
      weekly_generation_time?: string | null;
      weekly_generation_timezone?: string | null;
      nano_banana_api_key?: string | null;
      openai_api_key?: string | null;
    } | undefined;
    const nanoKey = row?.nano_banana_api_key ? String(row.nano_banana_api_key) : "";
    const openaiKey = row?.openai_api_key ? String(row.openai_api_key) : "";
    return res.json({
      provider: row?.provider || "nano_banana",
      fallbackEnabled: Boolean(row?.fallback_enabled),
      modelPreset: row?.model_preset || "gemini-3.1-flash-image-preview",
      weeklyGenerationDay: row?.weekly_generation_day || "Monday",
      weeklyGenerationTime: row?.weekly_generation_time || "08:00",
      weeklyGenerationTimezone: row?.weekly_generation_timezone || "WITA",
      nanoBananaKeySet: nanoKey.length > 0,
      openAiKeySet: openaiKey.length > 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_LOAD_ANNIVERSARY_SETTINGS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.put("/settings", async (req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const body = isRecord(req.body) ? req.body : {};
    const provider = typeof body.provider === "string" ? body.provider : "nano_banana";
    const fallbackEnabled = typeof body.fallbackEnabled === "boolean" ? body.fallbackEnabled : true;
    const modelPreset = typeof body.modelPreset === "string" ? body.modelPreset : "gemini-3.1-flash-image-preview";
    const weeklyGenerationDay = typeof body.weeklyGenerationDay === "string" ? body.weeklyGenerationDay : "Monday";
    const weeklyGenerationTime = typeof body.weeklyGenerationTime === "string" ? body.weeklyGenerationTime : "08:00";
    const weeklyGenerationTimezone = typeof body.weeklyGenerationTimezone === "string" ? body.weeklyGenerationTimezone : "WITA";
    const nanoBananaApiKey = typeof body.nanoBananaApiKey === "string" ? body.nanoBananaApiKey.trim() : "";
    const openAiApiKey = typeof body.openAiApiKey === "string" ? body.openAiApiKey.trim() : "";

    const existing = await new sql.Request(pool).query(`
      SELECT TOP 1 nano_banana_api_key, openai_api_key
      FROM dbo.anniversary_settings
      WHERE id=1
    `);
    const row = (existing.recordset || [])[0] as { nano_banana_api_key?: string | null; openai_api_key?: string | null } | undefined;
    const nanoKeyFinal = nanoBananaApiKey ? nanoBananaApiKey : row?.nano_banana_api_key || null;
    const openAiKeyFinal = openAiApiKey ? openAiApiKey : row?.openai_api_key || null;

    const request = new sql.Request(pool);
    request.input("provider", sql.NVarChar(30), provider);
    request.input("fallback_enabled", sql.Bit, fallbackEnabled ? 1 : 0);
    request.input("model_preset", sql.NVarChar(50), modelPreset);
    request.input("weekly_generation_day", sql.NVarChar(20), weeklyGenerationDay);
    request.input("weekly_generation_time", sql.NVarChar(10), weeklyGenerationTime);
    request.input("weekly_generation_timezone", sql.NVarChar(50), weeklyGenerationTimezone);
    request.input("nano_banana_api_key", sql.NVarChar(512), nanoKeyFinal);
    request.input("openai_api_key", sql.NVarChar(512), openAiKeyFinal);
    await request.query(`
      MERGE dbo.anniversary_settings AS target
      USING (SELECT 1 AS id) AS source
      ON target.id = source.id
      WHEN MATCHED THEN
        UPDATE SET
          provider=@provider,
          fallback_enabled=@fallback_enabled,
          model_preset=@model_preset,
          weekly_generation_day=@weekly_generation_day,
          weekly_generation_time=@weekly_generation_time,
          weekly_generation_timezone=@weekly_generation_timezone,
          nano_banana_api_key=@nano_banana_api_key,
          openai_api_key=@openai_api_key,
          updated_at=SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (id, provider, fallback_enabled, model_preset, weekly_generation_day, weekly_generation_time, weekly_generation_timezone, nano_banana_api_key, openai_api_key, updated_at)
        VALUES (1, @provider, @fallback_enabled, @model_preset, @weekly_generation_day, @weekly_generation_time, @weekly_generation_timezone, @nano_banana_api_key, @openai_api_key, SYSDATETIME());
    `);
    const updated = await new sql.Request(pool).query(`
      SELECT TOP 1 nano_banana_api_key, openai_api_key
      FROM dbo.anniversary_settings
      WHERE id=1
    `);
    const updatedRow = (updated.recordset || [])[0] as { nano_banana_api_key?: string | null; openai_api_key?: string | null } | undefined;
    return res.json({
      ok: true,
      nanoBananaKeySet: Boolean(updatedRow?.nano_banana_api_key),
      openAiKeySet: Boolean(updatedRow?.openai_api_key),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_SAVE_ANNIVERSARY_SETTINGS";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.get("/queue", async (req, res) => {
  const range = String(req.query.range || "next7days");
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const today = normalizeDate(new Date());
    const end = addDays(today, 7);
    const request = new sql.Request(pool);
    request.input("today", sql.Date, today);
    request.input("end", sql.Date, end);
    const rows = await request.query(`
      SELECT n.id, n.employee_id, n.anniversary_date, n.type, n.status, n.image_url, n.email_subject,
        n.week_start, n.approved_at, n.rejected_at, n.archived,
        c.name, c.gender, e.department, o.years_in_service
      FROM dbo.anniversary_notifications n
      LEFT JOIN dbo.employee_core c ON c.employee_id = n.employee_id
      LEFT JOIN dbo.employee_employment e ON e.employee_id = n.employee_id
      LEFT JOIN dbo.employee_onboard o ON o.employee_id = n.employee_id
      WHERE n.archived = 0
        AND n.anniversary_date BETWEEN @today AND @end
      ORDER BY n.anniversary_date ASC, c.name ASC
    `);
    const items = (rows.recordset || []).map((r) => ({
      id: Number(r.id),
      employeeId: String(r.employee_id || ""),
      anniversaryDate: r.anniversary_date ? new Date(r.anniversary_date).toISOString().slice(0, 10) : "",
      type: (r.type || "work") as AnniversaryType,
      status: (r.status || "pending") as AnniversaryStatus,
      imageUrl: r.image_url || "/anniversary_template.png",
      emailSubject: r.email_subject || null,
      weekStart: r.week_start ? new Date(r.week_start).toISOString().slice(0, 10) : null,
      name: r.name || "",
      gender: r.gender || null,
      department: r.department || null,
      years: typeof r.years_in_service === "number" ? r.years_in_service : null,
    }));
    return res.json({ range, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_LOAD_ANNIVERSARY_QUEUE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.post("/generate-weekly", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const settingsRes = await new sql.Request(pool).query(`
      SELECT TOP 1 provider, model_preset
      FROM dbo.anniversary_settings
      WHERE id=1
    `);
    const settingsRow = (settingsRes.recordset || [])[0] as { provider?: string | null; model_preset?: string | null } | undefined;
    const provider = String(settingsRow?.provider || "nano_banana");
    const modelPreset = String(settingsRow?.model_preset || "gemini-3.1-flash-image-preview");
    const providerUsed = modelPreset ? `${provider}:${modelPreset}` : provider;
    const today = normalizeDate(new Date());
    const end = addDays(today, 7);
    const weekStart = startOfWeekMonday(today);
    const rows = await new sql.Request(pool).query(`
      SELECT c.employee_id, c.name, c.gender, c.date_of_birth, e.department, o.join_date, o.years_in_service
      FROM dbo.employee_core c
      LEFT JOIN dbo.employee_employment e ON e.employee_id = c.employee_id
      LEFT JOIN dbo.employee_onboard o ON o.employee_id = c.employee_id
      WHERE c.employee_id IS NOT NULL
    `);
    const candidates: AnniversaryCandidate[] = [];
    for (const r of rows.recordset || []) {
      const employeeId = String(r.employee_id || "").trim();
      if (!employeeId) continue;
      const name = String(r.name || "").trim() || employeeId;
      const department = r.department ? String(r.department) : null;
      const gender = r.gender ? String(r.gender) : null;
      if (r.date_of_birth) {
        const base = new Date(r.date_of_birth);
        const next = nextAnniversary(base, today);
        if (next >= today && next <= end) {
          candidates.push({
            employeeId,
            name,
            department,
            gender,
            type: "birthday",
            anniversaryDate: next,
            years: null,
          });
        }
      }
      if (r.join_date) {
        const base = new Date(r.join_date);
        const next = nextAnniversary(base, today);
        if (next >= today && next <= end) {
          const years = yearsAtAnniversary(base, next);
          candidates.push({
            employeeId,
            name,
            department,
            gender,
            type: "work",
            anniversaryDate: next,
            years,
          });
        }
      }
    }
    let inserted = 0;
    for (const candidate of candidates) {
      const request = new sql.Request(pool);
      request.input("employee_id", sql.VarChar(20), candidate.employeeId);
      request.input("anniversary_date", sql.Date, candidate.anniversaryDate);
      request.input("type", sql.NVarChar(20), candidate.type);
      request.input("status", sql.NVarChar(20), "pending");
      request.input("week_start", sql.Date, weekStart);
      request.input("prompt", sql.NVarChar(sql.MAX), buildPrompt(candidate));
      request.input("provider_used", sql.NVarChar(60), providerUsed);
      request.input("image_url", sql.NVarChar(500), "/anniversary_template.png");
      request.input("email_subject", sql.NVarChar(200), formatEmailSubject(candidate));
      request.input("email_body_html", sql.NVarChar(sql.MAX), formatEmailBody(candidate));
      const result = await request.query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.anniversary_notifications
          WHERE employee_id=@employee_id AND anniversary_date=@anniversary_date AND type=@type
        )
        BEGIN
          INSERT INTO dbo.anniversary_notifications (
            employee_id, anniversary_date, type, status, week_start, prompt,
            provider_used, image_url, email_subject, email_body_html
          )
          VALUES (
            @employee_id, @anniversary_date, @type, @status, @week_start, @prompt,
            @provider_used, @image_url, @email_subject, @email_body_html
          );
          SELECT 1 AS inserted;
        END
        ELSE
        BEGIN
          SELECT 0 AS inserted;
        END
      `);
      const row = (result.recordset || [])[0] as { inserted?: number } | undefined;
      if (row?.inserted === 1) inserted += 1;
    }
    return res.json({ ok: true, inserted, total: candidates.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_GENERATE_ANNIVERSARIES";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.post("/:id/approve", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: "INVALID_ANNIVERSARY_ID" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const request = new sql.Request(pool);
    request.input("id", sql.BigInt, id);
    request.input("approved_by", sql.NVarChar(100), req.user?.username || "system");
    await request.query(`
      UPDATE dbo.anniversary_notifications
      SET status='approved', approved_by=@approved_by, approved_at=SYSDATETIME(), updated_at=SYSDATETIME()
      WHERE id=@id
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_APPROVE_ANNIVERSARY";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.post("/:id/reject", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: "INVALID_ANNIVERSARY_ID" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const request = new sql.Request(pool);
    request.input("id", sql.BigInt, id);
    request.input("rejected_by", sql.NVarChar(100), req.user?.username || "system");
    await request.query(`
      UPDATE dbo.anniversary_notifications
      SET status='rejected', rejected_by=@rejected_by, rejected_at=SYSDATETIME(), archived=1, updated_at=SYSDATETIME()
      WHERE id=@id
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_REJECT_ANNIVERSARY";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.post("/:id/revise", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: "INVALID_ANNIVERSARY_ID" });
  const body = isRecord(req.body) ? req.body : {};
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "REVISION_PROMPT_REQUIRED" });
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const request = new sql.Request(pool);
    request.input("id", sql.BigInt, id);
    request.input("revised_prompt", sql.NVarChar(sql.MAX), prompt);
    await request.query(`
      UPDATE dbo.anniversary_notifications
      SET status='pending', revised_prompt=@revised_prompt, updated_at=SYSDATETIME()
      WHERE id=@id
    `);
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_REVISE_ANNIVERSARY";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.post("/send-today", async (_req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const today = normalizeDate(new Date());
    const request = new sql.Request(pool);
    request.input("today", sql.Date, today);
    const result = await request.query(`
      UPDATE dbo.anniversary_notifications
      SET status='sent', sent_at=SYSDATETIME(), updated_at=SYSDATETIME()
      OUTPUT inserted.id
      WHERE status='approved' AND archived=0 AND anniversary_date=@today
    `);
    const sentIds = (result.recordset || []).map((r) => Number(r.id));
    return res.json({ ok: true, sent: sentIds.length, ids: sentIds });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_SEND_ANNIVERSARIES";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});

anniversariesRouter.post("/preview-image", async (req, res) => {
  const pool = getPool();
  try {
    await pool.connect();
    await ensureAnniversarySchema(pool);
    const body = isRecord(req.body) ? req.body : {};
    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    const years = typeof body.years === "number" ? body.years : null;
    if (!employeeId) return res.status(400).json({ error: "EMPLOYEE_ID_REQUIRED" });

    const settings = await new sql.Request(pool).query(`
      SELECT TOP 1 provider, model_preset, nano_banana_api_key
      FROM dbo.anniversary_settings
      WHERE id=1
    `);
    const sRow = (settings.recordset || [])[0] as { provider?: string | null; model_preset?: string | null; nano_banana_api_key?: string | null } | undefined;
    const provider = String(sRow?.provider || "nano_banana");
    const model = String(sRow?.model_preset || "gemini-3.1-flash-image-preview");
    const nanoKey = String(sRow?.nano_banana_api_key || "");
    if (provider !== "nano_banana" || !nanoKey) {
      return res.status(400).json({ error: "NANO_BANANA_NOT_CONFIGURED" });
    }

    const empRes = await new sql.Request(pool).input("id", sql.VarChar(20), employeeId).query(`
      SELECT TOP 1 c.name, c.gender, e.department, o.join_date, c.photo_blob
      FROM dbo.employee_core c
      LEFT JOIN dbo.employee_employment e ON e.employee_id = c.employee_id
      LEFT JOIN dbo.employee_onboard o ON o.employee_id = c.employee_id
      WHERE c.employee_id = @id
    `);
    const row = (empRes.recordset || [])[0] as {
      name?: unknown; gender?: unknown; department?: unknown; join_date?: unknown; photo_blob?: Buffer | null;
    } | undefined;
    const name = String(row?.name || employeeId);
    const department = row?.department ? String(row.department) : "";
    const gender = row?.gender ? String(row.gender) : "";
    const joinDate = row?.join_date ? new Date(String(row.join_date)) : null;
    const y = years ?? (joinDate ? Math.max(0, new Date().getFullYear() - joinDate.getFullYear()) : 0);

    // Pick template variant by gender + proportion score (if available)
    const variantFromQuery = typeof req.query.templateVariant === "string" ? req.query.templateVariant : null;
    const chooseVariant = () => {
      if (variantFromQuery) return variantFromQuery;
      const g = (gender || "").toLowerCase();
      // Default slim/broad threshold
      const ps = typeof req.query.proportionScore === "string" ? Number(req.query.proportionScore) : NaN;
      const score = Number.isFinite(ps) ? ps : undefined;
      const slim = score !== undefined ? score >= 0.6 : undefined;
      if (g.includes("female")) return slim === false ? "female_regular" : "female_slim";
      if (g.includes("male")) return slim === false ? "male_regular" : "male_slim";
      return slim === false ? "unisex_regular" : "unisex_slim";
    };
    const variantKey = chooseVariant();
    const basePublic = path.resolve(__dirname, "../../..", "public");
    const candidateVariants = [
      `anniversary_template_${variantKey}.png`,
      `anniversary_template_${variantKey}.jpg`,
    ];
    let templateFile = "anniversary_template.png";
    for (const f of candidateVariants) {
      const p = path.join(basePublic, f);
      if (fs.existsSync(p)) {
        templateFile = f;
        break;
      }
    }
    const templatePath = path.join(basePublic, templateFile);
    const templateBytes = fs.existsSync(templatePath) ? fs.readFileSync(templatePath) : null;
    const templateB64 = templateBytes ? templateBytes.toString("base64") : "";
    const photoBlob = row?.photo_blob || null;
    const photoB64 = photoBlob ? Buffer.from(photoBlob).toString("base64") : "";

    let proportionScoreText = "0.50";
    let postureText = "straight";
    let targetHeadShoulderRatioText = "0.42";
    if (photoB64) {
      const est = await estimateBodyProportion(nanoKey, model, photoB64);
      if (est) {
        proportionScoreText = est.proportionScore.toFixed(2);
        postureText = est.posture;
        const mapped = 0.46 - est.proportionScore * 0.08; // 0.46 (broad) .. 0.38 (slender)
        targetHeadShoulderRatioText = mapped.toFixed(2);
      }
    }

    const prompt = [
      "Base image is the official work-anniversary template (first image).",
      "Second image is the employee portrait.",
      "Task:",
      "1) Replace ONLY the face region on the template person with the employee's face.",
      "   - Normalize head pose to forward-facing, neutral expression (no smile/open mouth).",
      "   - Align eyes horizontally; align jaw/neck seam to template; do not stretch.",
      "2) UPDATE EXISTING TEXT IN THE TEMPLATE (do not add new text layers):",
      `   - Replace the placeholder employee name with: ${name}`,
      `   - Replace the years line with: ${y} Years of Dedication`,
      "   Keep the exact font style, gold color, position, and size already used by the template.",
      "Hard constraints:",
      "- Do not alter the background.",
      "- Preserve uniform/PPE and logos visually; you MAY apply a UNIFORM horizontal warp to the torso region (shoulders → mid‑chest).",
      `- Body proportion hint (0 broad … 1 slender): ${proportionScoreText}. Use it to harmonize face-to-body with a horizontal warp.`,
      `- Target head‑to‑shoulder width ratio: ${targetHeadShoulderRatioText} ± 0.03. You may shrink/widen the torso up to ±15% to reach this ratio while keeping seams/logos aligned.`,
      `- If posture is not straight (predicted: ${postureText}), correct to straight without altering uniform or background.`,
      "- Do not add extra text or duplicate lines; keep only the template's single set of text.",
      "- Preserve helmet/hardhat and lanyard; fit the face naturally inside the helmet.",
      "- Proportions must match the original head: align eyes and neck; avoid stretching; head scale within ±5% of original.",
      "- Color-match skin tone to look natural with neck/lighting; avoid hue shifts to the uniform or background.",
      `Context: department=${department || ""}, gender=${gender || "neutral"}.`,
      "Return only the edited image.",
    ].join(" ");

    const SHOULD_LOG_PROMPT =
      String(process.env.LOG_ANNIV_PROMPT || "").toLowerCase() === "1" ||
      String(process.env.LOG_ANNIVERSARY_PROMPT || "").toLowerCase() === "1" ||
      (typeof process.env.NODE_ENV === "string" && process.env.NODE_ENV !== "production") ||
      String(req.query.debug || "").toLowerCase() === "1";
    if (SHOULD_LOG_PROMPT) {
      // Do not log any API keys or image data
      console.log(
        "[anniversaries][preview-image] model=%s employeeId=%s meta=%o template=%s prompt=%s",
        model,
        employeeId,
        {
          proportionScore: proportionScoreText,
          targetHeadShoulderRatio: targetHeadShoulderRatioText,
          posture: postureText,
          gender,
          department,
          years: y,
        },
        templateFile,
        prompt
      );
    }

    const isProModel = /pro/i.test(model);
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": nanoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...(templateB64 ? [{ inline_data: { mime_type: "image/png", data: templateB64 } }] : []),
            ...(photoB64 ? [{ inline_data: { mime_type: "image/png", data: photoB64 } }] : []),
            { text: prompt },
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1", imageSize: "2K" },
          thinkingConfig: { thinkingLevel: isProModel ? "High" : "Minimal", includeThoughts: false },
        },
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || `HTTP_${resp.status}`;
      return res.status(502).json({ error: String(msg) });
    }
    let imageB64: string | null = null;
    const candidates = (data && data.candidates) || [];
    for (const c of candidates) {
      const parts = (c && c.content && c.content.parts) || [];
      for (const p of parts) {
        if (p && p.inlineData && p.inlineData.data) {
          imageB64 = String(p.inlineData.data);
          break;
        }
      }
      if (imageB64) break;
    }
    if (!imageB64) {
      if (templateB64) {
        return res.json({
          imageBase64: templateB64,
          model,
          ...(String(req.query.returnPrompt || "") === "1"
            ? { prompt, meta: { proportionScore: proportionScoreText, targetHeadShoulderRatio: targetHeadShoulderRatioText, posture: postureText, gender, department, years: y } }
            : {}),
        });
      }
      return res.status(502).json({ error: "NO_IMAGE_RETURNED" });
    }
    return res.json({
      imageBase64: imageB64,
      model,
      ...(String(req.query.returnPrompt || "") === "1"
        ? { prompt, meta: { proportionScore: proportionScoreText, targetHeadShoulderRatio: targetHeadShoulderRatioText, posture: postureText, gender, department, years: y } }
        : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_PREVIEW_IMAGE";
    return res.status(500).json({ error: message });
  } finally {
    await pool.close();
  }
});
