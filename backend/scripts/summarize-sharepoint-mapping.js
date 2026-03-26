const fs = require("fs");
const path = require("path");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function main() {
  const mapPath = path.resolve(process.cwd(), "scripts", "sharepoint-mapping.generated.json");
  const j = readJson(mapPath);
  if (!j) {
    console.log(JSON.stringify({ ok: false, error: "FILE_NOT_FOUND", mapPath }, null, 2));
    process.exit(1);
    return;
  }
  const cols = j.columns || {};
  const summary = [];
  for (const group of Object.keys(cols)) {
    const items = Array.isArray(cols[group]) ? cols[group] : [];
    const total = items.length;
    const mapped = items.filter((x) => String(x.status || "").toLowerCase() === "mapped").length;
    const unmappedItems = items.filter((x) => String(x.status || "").toLowerCase() === "unmapped");
    const unmapped = unmappedItems.length;
    const examples = unmappedItems.slice(0, 15).map((x) => x.excelName);
    summary.push({ group, total, mapped, unmapped, examples });
  }
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main();
