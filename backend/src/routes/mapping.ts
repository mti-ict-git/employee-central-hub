import { Router } from "express";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx/xlsx.mjs";

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

mappingRouter.get("/type-columns", (_req, res) => {
  try {
    const excelPath = path.resolve(process.cwd(), "..", "public", "Comben Master Data Column Assignment2.xlsx");
    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ error: "TYPE_EXCEL_NOT_FOUND" });
    }
    const data = fs.readFileSync(excelPath);
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
