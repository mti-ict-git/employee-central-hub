import path from "path";
import fs from "fs";
import xlsx from "xlsx";

type MappingTarget = { table: string; column: string };
type MappingEntry = { excelName: string; db: MappingTarget | MappingTarget[] | null; status: "mapped" | "unmapped" };
type SharepointMapping = {
  sheet_name_map?: Record<string, string>;
  columns?: Record<string, MappingEntry[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRowArrays(value: unknown): Array<Array<unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => Array.isArray(row)) as Array<Array<unknown>>;
}

function normalizeHeader(value: unknown): string {
  return String(value || "").trim();
}

function normalizeHeaderKey(raw: string): string {
  const s = String(raw || "").toLowerCase();
  const fixed = s.replace(/employement/g, "employment").replace(/tittle/g, "title");
  const collapsed = fixed.replace(/[\(\)\[\]\-_.]+/g, " ").replace(/\s+/g, " ").trim();
  return collapsed;
}

function forwardFillHeaders(row: string[]): string[] {
  let last = "";
  return row.map((cell) => {
    const v = String(cell || "").trim();
    if (v) {
      last = v;
      return v;
    }
    return last;
  });
}

function buildHeaderMapFromRows(rows: Array<Array<unknown>>, headerRowIndex: number): Map<string, number> {
  const raw: string[][] = [];
  for (let i = 0; i < 3; i += 1) {
    const r = rows[headerRowIndex + i];
    if (!r) break;
    raw.push(r.map(normalizeHeader));
  }
  const headerRows = raw.map(forwardFillHeaders);
  const width = headerRows.reduce((m, r) => Math.max(m, r.length), 0);
  const out = new Map<string, number>();
  const addKey = (key: string, idx: number) => {
    const k = normalizeHeaderKey(key);
    if (k) out.set(k, idx);
  };
  for (let idx = 0; idx < width; idx += 1) {
    const parts = headerRows.map((r) => r[idx] || "").filter((v) => String(v).trim() !== "");
    for (const p of parts) addKey(String(p), idx);
    if (parts.length >= 2) {
      addKey(parts.join(" "), idx);
      addKey(parts.join("-"), idx);
      addKey(parts.join("/"), idx);
      const last2 = parts.slice(-2);
      if (last2.length === 2) {
        addKey(last2.join(" "), idx);
        addKey(last2.join("-"), idx);
        addKey(last2.join("/"), idx);
      }
    }
  }
  return out;
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

function main(): void {
  const mappingPath = path.resolve(process.cwd(), "scripts", "sharepoint-mapping.json");
  const filePath = path.resolve(process.cwd(), "storage", "sharepoint-review", "sharepoint-review.xlsx");

  if (!fs.existsSync(mappingPath)) {
    console.log(JSON.stringify({ ok: false, error: "MAPPING_FILE_NOT_FOUND", mappingPath }, null, 2));
    process.exit(2);
    return;
  }
  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({ ok: false, error: "REVIEW_FILE_NOT_FOUND", filePath }, null, 2));
    process.exit(2);
    return;
  }

  const rawMapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8")) as unknown;
  const mapping: SharepointMapping = isRecord(rawMapping) ? (rawMapping as SharepointMapping) : {};
  const workbook = xlsx.read(fs.readFileSync(filePath), { type: "buffer" });
  const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];

  const columnsByGroup = isRecord(mapping.columns) ? (mapping.columns as Record<string, MappingEntry[]>) : (mapping.columns || {});
  const sheetMap = isRecord(mapping.sheet_name_map) ? (mapping.sheet_name_map as Record<string, string>) : (mapping.sheet_name_map || {});

  const groups = Object.keys(columnsByGroup || {});
  const results: Array<{
    group: string;
    sheetName: string;
    ok: boolean;
    headerRowIndex: number;
    empIdPresent: boolean;
    mappedCount: number;
    mappedFound: number;
    mappedMissing: number;
    unmappedCount: number;
    missingMapped: string[];
  }> = [];

  let hardFail = false;

  for (const group of groups) {
    const entries = Array.isArray(columnsByGroup[group]) ? columnsByGroup[group] : [];
    const sheetName = sheetMap[group] || group;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      results.push({ group, sheetName, ok: false, headerRowIndex: -1, empIdPresent: false, mappedCount: 0, mappedFound: 0, mappedMissing: 0, unmappedCount: 0, missingMapped: [] });
      hardFail = true;
      continue;
    }
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown;
    const rows = toRowArrays(rawRows);
    const headerRowIndex = pickHeaderRowIndex(rows);
    const headerMap = buildHeaderMapFromRows(rows, headerRowIndex);

    const empIdPresent =
      headerMap.has(normalizeHeaderKey("Emp. ID")) || headerMap.has(normalizeHeaderKey("Emp ID")) || headerMap.has(normalizeHeaderKey("Employee ID"));
    if (!empIdPresent) hardFail = true;

    let mappedCount = 0;
    let mappedFound = 0;
    const missingMapped: string[] = [];
    let unmappedCount = 0;

    for (const e of entries) {
      const status = String(e.status || "");
      if (status === "unmapped") {
        unmappedCount += 1;
        continue;
      }
      if (status !== "mapped") continue;
      mappedCount += 1;
      const wanted = normalizeHeaderKey(e.excelName);
      const found = headerMap.has(wanted);
      if (found) mappedFound += 1;
      else missingMapped.push(String(e.excelName || ""));
    }

    results.push({
      group,
      sheetName,
      ok: empIdPresent,
      headerRowIndex,
      empIdPresent,
      mappedCount,
      mappedFound,
      mappedMissing: mappedCount - mappedFound,
      unmappedCount,
      missingMapped: missingMapped.slice(0, 50),
    });
  }

  const summary = {
    ok: !hardFail,
    filePath,
    mappingPath,
    sheetNames,
    groups: results.length,
    groupsOk: results.filter((r) => r.ok).length,
    groupsFail: results.filter((r) => !r.ok).length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main();
