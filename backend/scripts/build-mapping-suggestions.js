const fs = require("fs");
const path = require("path");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\(\)\[\]\-_,.:;/>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return norm(s)
    .split(" ")
    .filter(Boolean);
}

function buildAliases() {
  const pairs = [
    ["Employee ID", "Emp. ID"],
    ["Employee Id", "Emp. ID"],
    ["Emp ID", "Emp. ID"],
    ["Employement Status", "Employment Status"],
    ["Employment Type", "Employment Status"],
    ["Status Pajak", "Tax Status"],
    ["Passport No", "PASSPORT ID"],
    ["End Date", "End Contract"],
    ["Position Title", "Job Title"],
    ["position_title", "Job Title"],
    ["supervisor_name", "Direct Report"],
    ["Citizenship", "Nationality"],
    ["Blacklist MTI", "Black List MTI"],
    ["Blacklist  IMIP", "Black List IMIP"],
    ["Blacklist IMIP", "Black List IMIP"],
    ["POH", "Poin of Hire"],
    ["POO", "Poin of Origin"],
  ];
  const m = new Map();
  for (const [from, to] of pairs) {
    m.set(norm(from), String(to));
  }
  return m;
}

const ALIAS_MAP = buildAliases();

function applyAlias(header) {
  const key = norm(header);
  const hit = ALIAS_MAP.get(key);
  return hit || header;
}

function expandHeaderVariants(excelHeader) {
  const base = String(excelHeader || "").trim();
  const variants = new Set();
  if (!base) return [];
  variants.add(base);
  const aliasedBase = applyAlias(base);
  variants.add(aliasedBase);

  const parts = base.split(">").map((p) => String(p || "").trim()).filter(Boolean);
  if (parts.length >= 2) {
    const parent = applyAlias(parts[0]);
    const child = applyAlias(parts.slice(1).join(" "));
    variants.add(`${parent} ${child}`);
    variants.add(`${parent} ${child}`.replace(/\s+/g, " ").trim());
    variants.add(child);
    variants.add(applyAlias(`${parent} ${child}`));
  }

  return Array.from(variants).filter((v) => String(v || "").trim() !== "");
}

function scoreHeaderMatch(excelHeader, candidateExcelName) {
  const a = norm(excelHeader);
  const b = norm(candidateExcelName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  const denom = Math.max(ta.size, tb.size);
  return overlap / denom;
}

function main() {
  const bottomIndexPath = path.resolve(process.cwd(), "scripts", "review-headers-bottom", "index.json");
  const dbinfoPath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");

  const bottomIndex = readJson(bottomIndexPath);
  const dbinfo = readJson(dbinfoPath);

  if (!bottomIndex || !dbinfo) {
    console.log(
      JSON.stringify(
        { ok: false, error: "SOURCE_MISSING", bottomIndexPathExists: !!bottomIndex, dbinfoPathExists: !!dbinfo },
        null,
        2
      )
    );
    process.exit(1);
    return;
  }

  const dbEntries = Array.isArray(dbinfo) ? dbinfo : [];
  const makeCandidate = (entry, sc, variantUsed) => ({
    excelName: String(entry?.excel?.excelName || ""),
    matched: {
      table: String(entry?.matched?.table || ""),
      column: String(entry?.matched?.column || ""),
      type: String(entry?.matched?.type || ""),
    },
    score: sc,
    variantUsed,
  });

  const suggestions = [];
  for (const sheet of bottomIndex.sheets || []) {
    const filePath = String(sheet.file || "").trim();
    const sheetJson = filePath ? readJson(filePath) : null;
    if (!sheetJson || !Array.isArray(sheetJson.header)) continue;
    const headers = sheetJson.header;
    const sheetOut = { sheetName: sheet.name, file: filePath, items: [] };
    for (const h of headers) {
      const excelHeader = String(h || "").trim();
      if (!excelHeader) {
        sheetOut.items.push({ excelHeader, status: "unmapped", candidates: [] });
        continue;
      }
      let best = null;
      const candidates = [];
      const variants = expandHeaderVariants(excelHeader);
      for (const entry of dbEntries) {
        let bestSc = 0;
        let bestVariant = "";
        for (const v of variants) {
          const sc = scoreHeaderMatch(v, entry?.excel?.excelName || "");
          if (sc > bestSc) {
            bestSc = sc;
            bestVariant = v;
          }
        }
        if (bestSc <= 0) continue;
        const cand = makeCandidate(entry, bestSc, bestVariant);
        candidates.push(cand);
        if (!best || bestSc > best.score) best = cand;
      }
      candidates.sort((x, y) => y.score - x.score);
      const top = candidates.slice(0, 5);
      if (best && best.score >= 0.6 && best.matched.table && best.matched.column) {
        sheetOut.items.push({
          excelHeader,
          status: "mapped",
          matched: best.matched,
          score: Number(best.score.toFixed(3)),
          matchedBy: best.variantUsed,
          candidates: top,
        });
      } else {
        sheetOut.items.push({
          excelHeader,
          status: "unmapped",
          candidates: top,
        });
      }
    }
    suggestions.push(sheetOut);
  }

  const outDir = path.resolve(process.cwd(), "scripts");
  const outPath = path.join(outDir, "mapping-suggestions.json");
  fs.writeFileSync(outPath, JSON.stringify({ ok: true, suggestions }, null, 2));
  console.log(JSON.stringify({ ok: true, output: outPath, sheets: suggestions.length }, null, 2));
}

main();
