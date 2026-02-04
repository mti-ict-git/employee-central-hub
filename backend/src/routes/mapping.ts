import { Router } from "express";
import path from "path";
import fs from "fs";
import { authMiddleware, requireRole } from "../middleware/auth";
async function loadXLSX() {
  const mod = await (0, eval)('import("xlsx/xlsx.mjs")');
  return mod;
}
export const mappingRouter = Router();

mappingRouter.get("/dbinfo", (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "DBINFO_MAPPING_NOT_FOUND" });
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_DBINFO";
    return res.status(500).json({ error: message });
  }
});

mappingRouter.post("/dbinfo", authMiddleware, requireRole(["admin", "superadmin"]), (req, res) => {
  try {
    const tableRaw = typeof req.body?.table === "string" ? req.body.table : "";
    const columnRaw = typeof req.body?.column === "string" ? req.body.column : "";
    const labelRaw = typeof req.body?.label === "string" ? req.body.label : "";
    const typeRaw = typeof req.body?.type === "string" ? req.body.type : "";
    const table = tableRaw.trim();
    const column = columnRaw.trim();
    if (!table || !column) {
      return res.status(400).json({ error: "INVALID_COLUMN_INPUT" });
    }
    const excelTable = table.includes(".") ? table.split(".").pop() || table : table;
    const schema = table.includes(".") ? (table.split(".")[0] || "dbo") : "dbo";
    const matchedTable = table.includes(".") ? table : `${schema}.${table}`;
    const filePath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");
    const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : [];
    const rows = Array.isArray(existing) ? existing : [];
    const dup = rows.find((r: any) =>
      String(r?.excel?.table || "").trim().toLowerCase() === excelTable.trim().toLowerCase() &&
      String(r?.excel?.column || "").trim().toLowerCase() === column.toLowerCase(),
    );
    if (dup) {
      return res.status(409).json({ error: "COLUMN_ALREADY_EXISTS" });
    }
    const item = {
      excel: {
        table: excelTable,
        schema,
        column,
        excelName: labelRaw.trim() || undefined,
        usedColumnHeader: "DB Column",
        usedTableHeader: "Table Name",
      },
      matched: {
        table: matchedTable,
        column,
        type: typeRaw.trim() || undefined,
      },
      status: "manual_added",
      suggestion: null,
      suggestions: null,
    };
    rows.push(item);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
    return res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_UPDATE_DBINFO";
    return res.status(500).json({ error: message });
  }
});

mappingRouter.get("/type-columns", async (_req, res) => {
  try {
    const excelPath = path.resolve(process.cwd(), "..", "public", "Comben Master Data Column Assignment2.xlsx");
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: "TYPE_EXCEL_NOT_FOUND" });
    }
    const data = fs.readFileSync(excelPath);
    const XLSX = await loadXLSX();
    const wb = XLSX.read(data, { type: "buffer" });
    const sheet = wb.Sheets["DB Schema"] || wb.Sheets["Column Assignment"] || wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      return res.status(400).json({ error: "TYPE_SHEET_NOT_FOUND" });
    }
    const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows.length) return res.json([]);
    const headers = Object.keys(rows[0]).map((h) => String(h));
    const resolve = (cands: string[]) => {
      for (const c of cands) {
        const hit = headers.find((h) => h.trim().toLowerCase() === c.trim().toLowerCase());
        if (hit) return hit;
      }
      return undefined;
    };
    const tableKey = resolve(["Table", "Existing Table Name", "existing table name"]);
    const columnKey = resolve(["DB Schema", "DB Column", "Mapping to Existing DB Schema", "mapping to existing db schema"]);
    const indoKey = resolve(["Indonesia", "Indo"]);
    const expatKey = resolve(["Expat", "Expatriate"]);
    const tokens = (s: string) => s.replace(/_/g, " ").trim().split(" ").filter(Boolean);
    const toLabel = (s: string) =>
      tokens(s)
        .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ");
    const out: Array<{ section: string; column: string; indonesia: boolean; expat: boolean }> = [];
    for (const r of rows) {
      const tableName = tableKey ? String(r[tableKey] || "").trim() : "";
      const columnNameRaw = columnKey ? String(r[columnKey] || "").trim() : "";
      const columnName = (() => {
        if (!columnNameRaw) return "";
        const parts = columnNameRaw.split(".").map((p) => p.trim()).filter(Boolean);
        return parts.length ? parts[parts.length - 1] : columnNameRaw;
      })();
      if (!tableName || !columnName) continue;
      const indVal = indoKey ? String(r[indoKey] || "").trim().toUpperCase() : "";
      const expVal = expatKey ? String(r[expatKey] || "").trim().toUpperCase() : "";
      const indonesia = indVal === "Y";
      const expat = expVal === "Y";
      out.push({ section: toLabel(tableName), column: columnName, indonesia, expat });
    }
    return res.json(out);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_TYPE_COLUMNS";
    return res.status(500).json({ error: message });
  }
});
