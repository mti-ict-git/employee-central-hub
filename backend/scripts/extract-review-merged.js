const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

function norm(v) {
  return String(v ?? "").trim();
}

function pickHeaderRowIndex(rows) {
  const limit = Math.min(rows.length, 25);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i += 1) {
    const row = rows[i] || [];
    const nonEmpty = row.reduce((acc, c) => acc + (String(c ?? "").trim() ? 1 : 0), 0);
    if (nonEmpty > bestScore) {
      bestScore = nonEmpty;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function forwardFill(row) {
  let last = "";
  return row.map((cell) => {
    const v = norm(cell);
    if (v) {
      last = v;
      return v;
    }
    return last;
  });
}

function buildMergedHeaders(rows, headerRowIndex) {
  const raw = [];
  for (let i = 0; i < 3; i += 1) {
    const r = rows[headerRowIndex + i];
    if (!r) break;
    raw.push(r.map(norm));
  }
  const ff = raw.map(forwardFill);
  const width = ff.reduce((m, r) => Math.max(m, r.length), 0);
  const merged = [];
  for (let idx = 0; idx < width; idx += 1) {
    const parts = ff.map((r) => r[idx] || "").filter((v) => v && v.trim() !== "");
    if (!parts.length) {
      merged.push("");
      continue;
    }
    const seen = new Set();
    const orderedTopToBottom = [];
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      if (!seen.has(p)) {
        orderedTopToBottom.push(p);
        seen.add(p);
      }
    }
    merged.push(orderedTopToBottom.join(" - "));
  }
  return { headerRows: raw, forwardFilled: ff, merged };
}

function sanitize(name) {
  return String(name || "").trim().replace(/[^A-Za-z0-9._-]+/g, "_");
}

function makeRecords(headers, dataRows) {
  const recs = [];
  const width = headers.length;
  for (const row of dataRows) {
    const obj = {};
    for (let i = 0; i < width; i += 1) {
      const key = headers[i] || `col_${i}`;
      obj[key] = row[i] ?? "";
    }
    recs.push(obj);
  }
  return recs;
}

function main() {
  const inFile = path.resolve(process.cwd(), "storage", "sharepoint-review", "sharepoint-review.xlsx");
  if (!fs.existsSync(inFile)) {
    console.log(JSON.stringify({ ok: false, error: "FILE_NOT_FOUND", inFile }, null, 2));
    process.exit(1);
    return;
  }
  const wb = xlsx.read(fs.readFileSync(inFile), { type: "buffer" });
  const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames : [];
  const outDir = path.resolve(process.cwd(), "scripts", "review-extract-merged");
  fs.mkdirSync(outDir, { recursive: true });

  const index = { ok: true, source: inFile, sheets: [] };

  for (const name of sheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) {
      index.sheets.push({ name, error: "SHEET_NOT_FOUND" });
      continue;
    }
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const rows = Array.isArray(rawRows) ? rawRows.filter((r) => Array.isArray(r)) : [];
    const headerRowIndex = pickHeaderRowIndex(rows);
    const { headerRows, forwardFilled, merged } = buildMergedHeaders(rows, headerRowIndex);
    const dataStart = headerRowIndex + headerRows.length;
    const dataRows = rows.slice(dataStart);
    const records = makeRecords(merged, dataRows);
    const out = {
      sheetName: name,
      headerRowIndex,
      headerRows,
      forwardFilledHeaderRows: forwardFilled,
      mergedHeaders: merged,
      rowCount: rows.length,
      dataCount: records.length,
      sample: records.slice(0, 20),
    };
    const fileName = sanitize(name) + ".json";
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
    index.sheets.push({ name, file: filePath, headerRowIndex, dataCount: records.length });
  }

  const indexPath = path.join(outDir, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(JSON.stringify({ ok: true, index: indexPath, sheets: index.sheets }, null, 2));
}

main();
