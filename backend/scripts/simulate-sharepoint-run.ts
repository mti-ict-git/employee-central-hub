import path from "node:path";
import { promises as fs } from "node:fs";

type MappingTarget = { table: string; column: string };
type MappingEntry = { excelName: string; db: MappingTarget | MappingTarget[] | null; status: "mapped" | "unmapped" };
type SharepointMapping = {
  sheet_name_map?: Record<string, string>;
  columns?: Record<string, MappingEntry[]>;
};

async function loadXLSXModule(): Promise<{
  read: (data: Buffer, opts: { type: "buffer" }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: (sheet: unknown, opts: { header: number; defval: string | number | null; raw: boolean }) => unknown[] };
}> {
  // eslint-disable-next-line no-eval
  const mod = await (0, eval)('import("xlsx/xlsx.mjs")');
  return mod as any;
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

async function main() {
  const filePath = path.resolve(process.cwd(), "backend", "storage", "sharepoint-review", "sharepoint-review.xlsx");
  const mappingPath = path.resolve(process.cwd(), "backend", "scripts", "sharepoint-mapping.json");
  const exists = await fs.stat(filePath).catch(() => null as any);
  if (!exists || !exists.isFile()) {
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

  for (const [group, entries] of Object.entries(columnsByGroup)) {
    const sheetName = sheetMap[group] || group;
    const sheet = (wb.Sheets as any)[sheetName];
    if (!sheet) continue;
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const rows = toRowArrays(rawRows);
    if (!rows.length) continue;
    const headerRowIndex = pickHeaderRowIndex(rows);
    const headerRow = rows[headerRowIndex].map(normalizeHeader);
    const headerMap = new Map<string, number>();
    headerRow.forEach((h: string, idx: number) => { if (h) headerMap.set(h, idx); });

    for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
      const row = rows[r];
      const empIdIdx = headerMap.get("Emp. ID");
      const empIdRaw = empIdIdx !== undefined ? row[empIdIdx] : null;
      const empId = String(empIdRaw || "").trim();
      if (!empId) continue;
      scanned += 1;
      if (firstEmployees.length < 10) firstEmployees.push(empId);
      // quick validation: ensure at least one mapped column exists in this row
      const mapped = entries.filter((e) => e.status === "mapped" && e.db);
      let anyValue = false;
      for (const entry of mapped) {
        const colIdx = headerMap.get(entry.excelName);
        const value = colIdx !== undefined ? row[colIdx] : null;
        if (value !== null && value !== undefined && String(value).trim() !== "") { anyValue = true; break; }
      }
      if (!anyValue && scanned < 5) {
        console.warn(`Row ${r} for ${group} has no mapped values`);
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    file: { path: filePath, size: exists.size },
    workbook_sheets: wb.SheetNames,
    scanned,
    firstEmployees,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
