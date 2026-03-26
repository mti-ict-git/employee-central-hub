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

function isLikelyHeaderRow(row) {
  if (!Array.isArray(row) || row.length === 0) return false;
  const cells = row.map(norm);
  const nonEmpty = cells.filter((c) => c !== "");
  if (nonEmpty.length < 2) return false;
  const stringCount = nonEmpty.filter((c) => isNaN(Number(c))).length;
  return stringCount / nonEmpty.length >= 0.8;
}

function buildBottomFirstHeader(rows, headerRowIndex, sheetName) {
  const rowA = (rows[headerRowIndex] || []).map(norm);
  // Only Active Empl (IND) has double header; others single
  const allowDouble = String(sheetName || "").trim().toLowerCase() === "active empl (ind)".toLowerCase();
  const rowB = allowDouble && isLikelyHeaderRow(rows[headerRowIndex + 1]) ? (rows[headerRowIndex + 1] || []).map(norm) : [];
  const headerDepth = rowB.length ? 2 : 1;
  const width = Math.max(rowA.length, rowB.length);
  const final = [];
  const parentRow = rowB.length ? forwardFill(rowA) : rowA;
  for (let idx = 0; idx < width; idx += 1) {
    const parent = (parentRow[idx] || "").trim();
    const child = (rowB[idx] || "").trim();
    if (child && parent && parent !== child) {
      final.push(`${parent} > ${child}`);
      continue;
    }
    if (child) {
      final.push(child);
      continue;
    }
    if (parent) {
      final.push(parent);
      continue;
    }
    final.push(`col_${idx}`);
  }
  const headerRows = rowB.length ? [rowA, rowB] : [rowA];
  return { headerRows, header: final, headerDepth };
}

function lastNonEmptyIndex(row) {
  if (!Array.isArray(row)) return -1;
  for (let i = row.length - 1; i >= 0; i -= 1) {
    const v = String(row[i] ?? "").trim();
    if (v) return i;
  }
  return -1;
}

function computeEffectiveWidth(headerRows, dataRows, sampleLimit) {
  let maxIdx = -1;
  for (const r of headerRows) {
    maxIdx = Math.max(maxIdx, lastNonEmptyIndex(r));
  }
  const limit = Math.min(sampleLimit, dataRows.length);
  for (let i = 0; i < limit; i += 1) {
    maxIdx = Math.max(maxIdx, lastNonEmptyIndex(dataRows[i]));
  }
  return maxIdx >= 0 ? (maxIdx + 1) : 0;
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
  const outDir = path.resolve(process.cwd(), "scripts", "review-headers-bottom");
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
    const { headerRows, header, headerDepth } = buildBottomFirstHeader(rows, headerRowIndex, name);
    const dataStart = headerRowIndex + headerDepth;
    const dataRows = rows.length > dataStart ? rows.slice(dataStart) : [];
    const effectiveWidth = computeEffectiveWidth(headerRows, dataRows, 25);
    const trimmedHeader = effectiveWidth > 0 ? header.slice(0, effectiveWidth) : [];
    const dataCount = dataRows.length;
    const out = {
      sheetName: name,
      headerRowIndex,
      header: trimmedHeader,
      rowCount: rows.length,
      dataCount,
    };
    const fileName = String(name || "").trim().replace(/[^A-Za-z0-9._-]+/g, "_") + ".json";
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
    index.sheets.push({ name, file: filePath, headerRowIndex, dataCount });
  }

  const indexPath = path.join(outDir, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(JSON.stringify({ ok: true, index: indexPath, sheets: index.sheets }, null, 2));
}

main();
