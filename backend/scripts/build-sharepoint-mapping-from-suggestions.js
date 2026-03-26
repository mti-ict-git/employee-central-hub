const fs = require("fs");
const path = require("path");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function normalizeDbTableName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const cleaned = s.replace(/[\[\]]/g, "");
  const parts = cleaned.split(".").map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : cleaned;
}

function normalizeDbColumnName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.replace(/[\[\]]/g, "");
}

function main() {
  const suggPath = path.resolve(process.cwd(), "scripts", "mapping-suggestions.json");
  const indexPath = path.resolve(process.cwd(), "scripts", "review-headers-bottom", "index.json");
  const suggestions = readJson(suggPath);
  const index = readJson(indexPath);
  if (!suggestions || !index) {
    console.log(JSON.stringify({ ok: false, error: "SOURCE_NOT_FOUND", suggestions: !!suggestions, index: !!index }, null, 2));
    process.exit(1);
    return;
  }

  const columns = {};
  for (const sheet of suggestions.suggestions || []) {
    const group = String(sheet.sheetName || "").trim() || String(sheet.name || "").trim() || "Sheet";
    const items = Array.isArray(sheet.items) ? sheet.items : [];
    columns[group] = items.map((it) => {
      const excelName = String(it.excelHeader || "").trim();
      const mapped = it.status === "mapped" && it.matched && it.matched.table && it.matched.column;
      return {
        excelName,
        db: mapped
          ? { table: normalizeDbTableName(it.matched.table), column: normalizeDbColumnName(it.matched.column) }
          : null,
        status: mapped ? "mapped" : "unmapped",
      };
    });
  }

  const out = {
    source: {
      workbook: "storage/sharepoint-review/sharepoint-review.xlsx",
      sheet: "",
      ignored_columns: [],
      generated_at: new Date().toISOString(),
    },
    sheet_name_map: {},
    columns,
  };

  const outPath = path.resolve(process.cwd(), "scripts", "sharepoint-mapping.generated.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: true, output: outPath, groups: Object.keys(columns).length }, null, 2));
}

main();
