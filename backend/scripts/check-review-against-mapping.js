const fs = require("fs");
const path = require("path");

async function loadXLSX() {
  // Mirror backend dynamic import to use the same dependency
  const xlsx = await (0, eval)('import("xlsx/xlsx.mjs")');
  return xlsx;
}

function toRowArrays(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => Array.isArray(row));
}

function pickHeaderRowIndex(rows) {
  const limit = Math.min(6, rows.length);
  let bestIdx = 0;
  let bestCount = 0;
  for (let i = 0; i < limit; i++) {
    const count = rows[i].filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function normalizeHeader(value) {
  return String(value || "").trim();
}

function loadMapping() {
  const candidates = [
    path.resolve(process.cwd(), "backend", "scripts", "sharepoint-mapping.json"),
    path.resolve(process.cwd(), "scripts", "sharepoint-mapping.json"),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { mapping: parsed, path: p };
      }
    } catch {}
  }
  throw new Error("MAPPING_FILE_NOT_FOUND");
}

async function main() {
  const reviewCandidates = [
    path.resolve(process.cwd(), "storage", "sharepoint-review", "sharepoint-review.xlsx"),
    path.resolve(process.cwd(), "backend", "storage", "sharepoint-review", "sharepoint-review.xlsx"),
  ];
  const reviewPath = reviewCandidates.find((p) => fs.existsSync(p));
  if (!reviewPath) {
    console.error(JSON.stringify({ ok: false, error: "REVIEW_FILE_NOT_FOUND", candidates: reviewCandidates }));
    process.exit(2);
  }
  const { mapping, path: mappingPath } = loadMapping();
  const columnsByGroup = mapping.columns || {};
  const sheetMap = mapping.sheet_name_map || {};

  const xlsx = await loadXLSX();
  const buf = fs.readFileSync(reviewPath);
  let workbook;
  try {
    workbook = xlsx.read(buf, { type: "buffer" });
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: "XLSX_INVALID", details: String(e && e.message || e) }));
    process.exit(3);
  }

  const report = {};
  const groups = Object.keys(columnsByGroup);
  for (const group of groups) {
    const sheetName = sheetMap[group] || group;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      report[group] = { sheet: sheetName, exists: false, missing_columns: "ALL", present_count: 0, required_count: (columnsByGroup[group] || []).filter((e) => e && e.status === "mapped" && e.db).length };
      continue;
    }
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const rows = toRowArrays(rawRows);
    if (!rows.length) {
      report[group] = { sheet: sheetName, exists: true, header_found: false, missing_columns: "ALL", present_count: 0, required_count: (columnsByGroup[group] || []).filter((e) => e && e.status === "mapped" && e.db).length };
      continue;
    }
    const headerRowIndex = pickHeaderRowIndex(rows);
    const headerRow = rows[headerRowIndex].map(normalizeHeader);
    const headerSet = new Set(headerRow);

    const required = [];
    for (const entry of columnsByGroup[group] || []) {
      if (!entry || entry.status !== "mapped" || !entry.db) continue;
      required.push(String(entry.excelName || "").trim());
    }
    const missing = required.filter((name) => !headerSet.has(name));
    report[group] = {
      sheet: sheetName,
      exists: true,
      header_found: true,
      header_row_index: headerRowIndex,
      required_count: required.length,
      present_count: required.length - missing.length,
      missing_columns: missing,
      sample_header: headerRow.slice(0, 50),
    };
  }

  const summary = Object.fromEntries(Object.entries(report).map(([g, r]) => [g, { sheet: r.sheet, required: r.required_count, present: r.present_count, missing: Array.isArray(r.missing_columns) ? r.missing_columns.length : r.missing_columns }] ));
  console.log(JSON.stringify({ ok: true, mapping: mappingPath, file: reviewPath, summary, detail: report }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: "UNEXPECTED_ERROR", details: String(e && e.message || e) }));
  process.exit(1);
});
