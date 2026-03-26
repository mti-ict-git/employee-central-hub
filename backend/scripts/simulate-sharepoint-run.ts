import path from "node:path";
import { promises as fs } from "node:fs";

type MappingTarget = { table: string; column: string };
type MappingEntry = { excelName: string; db: MappingTarget | MappingTarget[] | null; status: "mapped" | "unmapped" };
type SharepointMapping = {
  sheet_name_map?: Record<string, string>;
  columns?: Record<string, MappingEntry[]>;
};

type XlsxWorkbook = { SheetNames: string[]; Sheets: Record<string, unknown> };
type XlsxModule = {
  read: (data: Buffer, opts: { type: "buffer" }) => XlsxWorkbook;
  utils: { sheet_to_json: (sheet: unknown, opts: { header: number; defval: string | number | null; raw: boolean }) => unknown[] };
};

function isXlsxModule(value: unknown): value is XlsxModule {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const read = v.read;
  const utils = v.utils;
  if (typeof read !== "function") return false;
  if (typeof utils !== "object" || utils === null) return false;
  const u = utils as Record<string, unknown>;
  if (typeof u.sheet_to_json !== "function") return false;
  return true;
}

async function loadXLSXModule(): Promise<XlsxModule> {
  // eslint-disable-next-line no-eval
  const modUnknown = (await (0, eval)('import("xlsx/xlsx.mjs")')) as unknown;
  if (!isXlsxModule(modUnknown)) {
    throw new Error("Failed to load xlsx module");
  }
  return modUnknown;
}

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

function isLikelyHeaderRow(row: Array<unknown> | undefined): boolean {
  if (!row || !Array.isArray(row) || row.length === 0) return false;
  const cells = row.map(normalizeHeader);
  const nonEmpty = cells.filter((c) => c !== "");
  if (nonEmpty.length < 2) return false;
  const stringCount = nonEmpty.filter((c) => Number.isNaN(Number(c))).length;
  return stringCount / nonEmpty.length >= 0.8;
}

function buildHeaderForSheet(rows: Array<Array<unknown>>, headerRowIndex: number, sheetName: string): { header: string[]; headerDepth: number } {
  const rowA = (rows[headerRowIndex] || []).map(normalizeHeader);
  const allowDouble = sheetName.trim().toLowerCase() === "active empl (ind)".toLowerCase();
  const rowB = allowDouble && isLikelyHeaderRow(rows[headerRowIndex + 1]) ? (rows[headerRowIndex + 1] || []).map(normalizeHeader) : [];
  const headerDepth = rowB.length ? 2 : 1;
  const width = Math.max(rowA.length, rowB.length);
  const parentRow = rowB.length ? forwardFillHeaders(rowA) : rowA;
  const header: string[] = [];
  for (let idx = 0; idx < width; idx += 1) {
    const parent = String(parentRow[idx] || "").trim();
    const child = String(rowB[idx] || "").trim();
    if (child && parent && parent !== child) {
      header.push(`${parent} > ${child}`);
      continue;
    }
    if (child) {
      header.push(child);
      continue;
    }
    if (parent) {
      header.push(parent);
      continue;
    }
    header.push(`col_${idx}`);
  }
  return { header, headerDepth };
}

function normalizeHeaderKey(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[\(\)\[\]\-_,.:;/>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findEmpIdIndex(headerMap: Map<string, number>): number | undefined {
  const candidates = ["Emp. ID", "Emp ID", "Employee ID", "Employee Id", "Employee id"];
  for (const c of candidates) {
    const idx = headerMap.get(normalizeHeaderKey(c));
    if (idx !== undefined) return idx;
  }
  return undefined;
}

async function main() {
  const cwd = process.cwd();
  const repoRoot = path.basename(cwd).toLowerCase() === "backend" ? path.resolve(cwd, "..") : cwd;
  const filePath = path.resolve(repoRoot, "backend", "storage", "sharepoint-review", "sharepoint-review.xlsx");
  const mappingGeneratedPath = path.resolve(repoRoot, "backend", "scripts", "sharepoint-mapping.generated.json");
  const mappingDefaultPath = path.resolve(repoRoot, "backend", "scripts", "sharepoint-mapping.json");
  const mappingPath = await fs
    .stat(mappingGeneratedPath)
    .then((s) => (s.isFile() ? mappingGeneratedPath : mappingDefaultPath))
    .catch(() => mappingDefaultPath);

  let reviewStat: import("node:fs").Stats | null = null;
  try {
    reviewStat = await fs.stat(filePath);
  } catch {
    reviewStat = null;
  }
  if (!reviewStat || !reviewStat.isFile()) {
    console.error("REVIEW_FILE_NOT_FOUND", filePath);
    process.exit(2);
  }
  const mappingRaw = await fs.readFile(mappingPath, "utf-8").catch(() => null);
  if (!mappingRaw) {
    console.error("MAPPING_FILE_NOT_FOUND", mappingPath);
    process.exit(3);
  }
  const mapping = JSON.parse(mappingRaw) as SharepointMapping;
  const xlsx = await loadXLSXModule();
  const buf = await fs.readFile(filePath);
  const wb = xlsx.read(buf, { type: "buffer" });
  const sheetMap = mapping.sheet_name_map || {};
  const columnsByGroup = mapping.columns || {};

  let scanned = 0;
  const firstEmployees: string[] = [];
  const groups: Array<{
    group: string;
    sheetName: string;
    rows: number;
    headerDepth: number;
    mappedColumns: number;
    mappedColumnsFound: number;
    empIdFound: boolean;
  }> = [];

  for (const [group, entries] of Object.entries(columnsByGroup)) {
    const sheetName = sheetMap[group] || group;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      groups.push({
        group,
        sheetName,
        rows: 0,
        headerDepth: 0,
        mappedColumns: entries.filter((e) => e.status === "mapped" && e.db).length,
        mappedColumnsFound: 0,
        empIdFound: false,
      });
      continue;
    }
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const rows = toRowArrays(rawRows);
    if (!rows.length) continue;
    const headerRowIndex = pickHeaderRowIndex(rows);
    const { header, headerDepth } = buildHeaderForSheet(rows, headerRowIndex, sheetName);
    const headerMap = new Map<string, number>();
    header.forEach((h: string, idx: number) => {
      const k = normalizeHeaderKey(h);
      if (k) headerMap.set(k, idx);
    });
    const mappedEntries = entries.filter((e) => e.status === "mapped" && e.db);
    const mappedColumnsFound = mappedEntries.reduce((acc, e) => acc + (headerMap.has(normalizeHeaderKey(e.excelName)) ? 1 : 0), 0);
    const empIdFound = findEmpIdIndex(headerMap) !== undefined;

    for (let r = headerRowIndex + headerDepth; r < rows.length; r += 1) {
      const row = rows[r];
      const empIdIdx = findEmpIdIndex(headerMap);
      const empIdRaw = empIdIdx !== undefined ? row[empIdIdx] : null;
      const empId = String(empIdRaw || "").trim();
      if (!empId) continue;
      const empIdNorm = empId.replace(/[\s.\-_:]/g, "").toLowerCase();
      if (empIdNorm === "empid" || empIdNorm === "employeeid") continue;
      scanned += 1;
      if (firstEmployees.length < 10) firstEmployees.push(empId);
      // quick validation: ensure at least one mapped column exists in this row
      let anyValue = false;
      for (const entry of mappedEntries) {
        const colIdx = headerMap.get(normalizeHeaderKey(entry.excelName));
        const value = colIdx !== undefined ? row[colIdx] : null;
        if (value !== null && value !== undefined && String(value).trim() !== "") { anyValue = true; break; }
      }
      if (!anyValue && scanned < 5) {
        console.warn(`Row ${r} for ${group} has no mapped values`);
      }
    }

    groups.push({
      group,
      sheetName,
      rows: rows.length,
      headerDepth,
      mappedColumns: mappedEntries.length,
      mappedColumnsFound,
      empIdFound,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mappingPath,
    file: { path: filePath, size: reviewStat.size },
    workbook_sheets: wb.SheetNames,
    scanned,
    firstEmployees,
    groups,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
