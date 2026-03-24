const fs = require("fs");
const path = require("path");

async function loadXLSX() {
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

async function main() {
  const candidates = [
    path.resolve(process.cwd(), "storage", "sharepoint-review", "sharepoint-review.xlsx"),
    path.resolve(process.cwd(), "backend", "storage", "sharepoint-review", "sharepoint-review.xlsx"),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    console.error(JSON.stringify({ ok: false, error: "REVIEW_FILE_NOT_FOUND", candidates }));
    process.exit(2);
  }
  const xlsx = await loadXLSX();
  const buf = fs.readFileSync(filePath);
  let workbook;
  try {
    workbook = xlsx.read(buf, { type: "buffer" });
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: "XLSX_INVALID", details: String(e && e.message || e) }));
    process.exit(3);
  }
  const out = {};
  const names = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
  for (const name of names) {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      out[name] = { exists: false };
      continue;
    }
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const rows = toRowArrays(rawRows);
    if (!rows.length) {
      out[name] = { exists: true, header_found: false, headers: [] };
      continue;
    }
    const idx = pickHeaderRowIndex(rows);
    const headers = rows[idx].map(normalizeHeader);
    out[name] = { exists: true, header_found: true, header_row_index: idx, headers };
  }
  console.log(JSON.stringify({ ok: true, file: filePath, sheets: out }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: "UNEXPECTED_ERROR", details: String(e && e.message || e) }));
  process.exit(1);
});

