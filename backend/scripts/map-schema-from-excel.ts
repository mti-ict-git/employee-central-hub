import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import * as XLSX from "xlsx/xlsx.mjs";

// Load root .env (not strictly needed here, but consistent with other scripts)
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

type ColumnDef = {
  name: string;
  type?: string;
  nullable?: boolean;
};

type TableDef = {
  columns: ColumnDef[];
};

type SchemaMap = Record<string, TableDef>;

function loadScannedSchema(): SchemaMap {
  const schemaPath = path.resolve(process.cwd(), "scripts", "schema.json");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Missing schema.json at ${schemaPath}. Run npm run scan:schema first.`);
  }
  const parsed = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const schema = parsed.schema as Record<string, { columns: any[] }>;
  const map: SchemaMap = {};
  for (const [tbl, info] of Object.entries(schema)) {
    map[tbl] = {
      columns: info.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
    };
  }
  return map;
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")
    .replace(/[\s]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const aa = normalizeForCompare(a);
  const bb = normalizeForCompare(b);
  if (!aa && !bb) return 1;
  const d = levenshtein(aa, bb);
  const denom = Math.max(aa.length, bb.length) || 1;
  return 1 - d / denom; // 1.0 = exact, 0.0 = different
}

// Try to pick likely column names from the Excel sheet headers
function resolveHeaderKeys(headers: string[]) {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const hNorm = headers.map(norm);
  const tokens = (s: string) => s.split(/\s+/g);
  const hasAll = (s: string, req: string[]) => {
    const t = tokens(s);
    return req.every((r) => t.includes(r));
  };
  const hasPrefixToken = (s: string, prefixes: string[]) => {
    const t = tokens(s);
    return t.some((tok) => prefixes.some((p) => tok.startsWith(p)));
  };
  const findExact = (targets: string[]) => {
    for (let i = 0; i < hNorm.length; i++) {
      if (targets.includes(hNorm[i])) return headers[i];
    }
    return undefined;
  };
  const findByTokens = (requirements: string[][]) => {
    for (let i = 0; i < hNorm.length; i++) {
      if (requirements.some((req) => hasAll(hNorm[i], req))) return headers[i];
    }
    return undefined;
  };
  const findFuzzyMapping = () => {
    for (let i = 0; i < hNorm.length; i++) {
      const s = hNorm[i];
      if (s.includes("mapping") && s.includes("db") && hasPrefixToken(s, ["sche", "schen", "schema"])) {
        return headers[i];
      }
    }
    return undefined;
  };
  const columnNameKey =
    findExact(["column name"]) ||
    findByTokens([["column", "name"], ["excel", "column", "name"]]);
  const existingTblKey =
    findExact(["existing table name"]) ||
    findByTokens([["existing", "table", "name"], ["existing", "table"]]);
  const mappingKey =
    findExact(["mapping to existing db schema"]) ||
    findByTokens([
      ["mapping", "existing", "db", "schema"],
      ["column", "mapping", "existing", "db", "schema"],
      ["mapping", "schema"],
    ]) ||
    findFuzzyMapping();
  return { columnNameKey, existingTblKey, mappingKey };
}

function readExcelDBSchema(): Array<{ table: string; column?: string; schema?: string; excelName?: string; usedColumnHeader?: string | undefined; usedTableHeader?: string | undefined }> {
  const excelPath = path.resolve(process.cwd(), "..", "public", "Comben Master Data Column Assignment.xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at ${excelPath}`);
  }
  const data = fs.readFileSync(excelPath);
  const wb = XLSX.read(data, { type: "buffer" });
  const sheet = wb.Sheets["DB Schema"];
  if (!sheet) throw new Error(`Sheet 'DB Schema' not found in workbook.`);
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const { columnNameKey, existingTblKey, mappingKey } = resolveHeaderKeys(headers);
  if (!existingTblKey && !mappingKey) {
    console.error("DB Schema sheet headers:", headers);
    throw new Error("Missing required headers: 'Existing Table Name' or 'Mapping to Existing DB Schema'.");
  }
  const parseMappingColumn = (s: string) => {
    const raw = s.trim();
    if (!raw) return undefined;
    const parts = raw.split(".").map((p) => p.trim()).filter(Boolean);
    return parts[parts.length - 1];
  };
  const out: Array<{ table: string; column?: string; schema?: string; excelName?: string; usedColumnHeader?: string | undefined; usedTableHeader?: string | undefined }> = [];
  const parseList = (s: string) => {
    const raw = s.trim();
    if (!raw) return [] as Array<{ schema?: string; table?: string; column?: string }>;
    return raw
      .split(/[;,]+/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const segs = part.split(".").map((p) => p.trim());
        if (segs.length >= 3) return { schema: segs[0], table: segs[1], column: segs.slice(2).join(".") };
        if (segs.length === 2) return { table: segs[0], column: segs[1] };
        if (segs.length === 1) return { table: segs[0] };
        return {} as { schema?: string; table?: string; column?: string };
      });
  };
  for (const r of rows) {
    const excelName = columnNameKey ? String(r[columnNameKey] || "").trim() : undefined;
    const mappingRaw = mappingKey ? String(r[mappingKey] || "").trim() : "";
    const existingTableRaw = existingTblKey ? String(r[existingTblKey] || "").trim() : "";
    const mColumn = parseMappingColumn(mappingRaw);
    const usedColumnHeader = mColumn ? "Mapping to Existing DB Schema" : (excelName ? "Column Name" : undefined);
    const usedTableHeaderBase = existingTableRaw ? "Existing Table Name" : undefined;
    const tableList =
      (existingTableRaw && (existingTableRaw.includes(",") || existingTableRaw.includes(";"))) ? parseList(existingTableRaw) :
      (existingTableRaw ? [{ table: existingTableRaw }] : []);
    if (!tableList.length) {
      const schema = "dbo";
      const column = mColumn || undefined;
      out.push({ table: "", column, schema, excelName, usedColumnHeader, usedTableHeader: usedTableHeaderBase });
      continue;
    }
    for (const entry of tableList) {
      let schema = entry.schema;
      let table = entry.table || "";
      let column = mColumn || undefined;
      if (!table) {
        out.push({ table: "", column, schema: schema || "dbo", excelName, usedColumnHeader, usedTableHeader: usedTableHeaderBase });
        continue;
      }
      if (!schema) schema = table.includes(".") ? undefined : "dbo";
      if (!schema && table.includes(".")) {
        const [sch, tbl] = table.split(".");
        schema = sch.trim();
        table = tbl.trim();
      }
      out.push({ table, column, schema, excelName, usedColumnHeader, usedTableHeader: usedTableHeaderBase });
    }
  }
  return out;
}

function buildQualifiedName(tbl: string, schema?: string): string {
  const t = tbl.trim();
  if (!schema || !schema.trim()) return t.includes(".") ? t : `dbo.${t}`;
  return `${schema.trim()}.${t}`;
}

function mapExcelToSchema(
  excelRows: Array<{ table: string; column?: string; schema?: string; excelName?: string; usedColumnHeader?: string | undefined; usedTableHeader?: string | undefined }>,
  schema: SchemaMap,
) {
  const mapping: any[] = [];
  const tableCoverage: Record<string, { total: number; column_matched: number; column_missing: number; table_only: number }> = {};
  const unmatched: Array<any> = [];
  // Build quick index of columns across all tables for global suggestions
  const allColumns: Array<{ table: string; column: string }> = [];
  for (const [tbl, def] of Object.entries(schema)) {
    for (const c of def.columns) {
      allColumns.push({ table: tbl, column: c.name });
    }
  }
  for (const r of excelRows) {
    const qualified = r.table ? buildQualifiedName(r.table, r.schema) : "";
    const tblKey = r.table ? normalizeName(qualified) : "";
    let matchKey: string | undefined = r.table ? Object.keys(schema).find((k) => normalizeName(k) === tblKey) : undefined;
    if (!matchKey && r.table) {
      const dboKey = normalizeName(`dbo.${r.table}`);
      matchKey = Object.keys(schema).find((k) => normalizeName(k) === dboKey);
    }
    const tableFound = !!matchKey;
    let columnFound = false;
    let columnType: string | undefined;
    let suggestion: { type: "table" | "column"; value: string; score: number } | undefined;
    let suggestions: Array<{ type: "table" | "column"; value: string; score: number }> = [];
    if (tableFound && r.column) {
      const tdef = schema[matchKey!];
      const cdef = tdef.columns.find((c) => normalizeName(c.name) === normalizeName(r.column!));
      if (cdef) {
        columnFound = true;
        columnType = cdef.type;
      } else {
        const target = r.column || "";
        const scored = tdef.columns
          .map((c) => ({ value: c.name, score: similarity(target, c.name) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .filter((s) => s.score >= 0.6);
        if (scored.length) {
          suggestion = { type: "column", value: scored[0].value, score: Number(scored[0].score.toFixed(2)) };
          suggestions = scored.map((s) => ({ type: "column" as const, value: s.value, score: Number(s.score.toFixed(2)) }));
        }
      }
    }
    if (!tableFound) {
      const targetTable = qualified || (r.table || "");
      const bestTbl = Object.keys(schema)
        .map((k) => ({ value: k, score: similarity(targetTable, k) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .filter((s) => s.score >= 0.6);
      if (bestTbl.length) {
        suggestion = { type: "table", value: bestTbl[0].value, score: Number(bestTbl[0].score.toFixed(2)) };
        suggestions = bestTbl.map((s) => ({ type: "table" as const, value: s.value, score: Number(s.score.toFixed(2)) }));
      }
      // Global column suggestions only when mapping provides a column name
      const targetCol = r.column || "";
      if (targetCol) {
        const bestCols = allColumns
          .map((tc) => ({ value: `${tc.table}.${tc.column}`, score: similarity(targetCol, tc.column) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .filter((s) => s.score >= 0.6);
        if (bestCols.length) {
          const colSuggestions = bestCols.map((s) => ({ type: "column" as const, value: s.value, score: Number(s.score.toFixed(2)) }));
          suggestions = colSuggestions as Array<{ type: "column"; value: string; score: number }>;
          suggestion = { type: "column", value: bestCols[0].value, score: Number(bestCols[0].score.toFixed(2)) };
        }
      }
    }
    const status = tableFound ? (r.column ? (columnFound ? "column_matched" : "column_missing") : "table_only") : "table_missing";
    const coverageKey = tableFound ? (matchKey as string) : (qualified || (r.excelName || "unknown"));
    tableCoverage[coverageKey] ||= { total: 0, column_matched: 0, column_missing: 0, table_only: 0 };
    tableCoverage[coverageKey].total += 1;
    if (status === "column_matched") tableCoverage[coverageKey].column_matched += 1;
    else if (status === "column_missing") tableCoverage[coverageKey].column_missing += 1;
    else if (status === "table_only") tableCoverage[coverageKey].table_only += 1;
    const record = {
      excel: {
        table: r.table || null,
        schema: r.schema || "dbo",
        column: r.column || null,
        excelName: r.excelName || null,
        usedColumnHeader: r.usedColumnHeader || null,
        usedTableHeader: r.usedTableHeader || null,
      },
      matched: { table: tableFound ? matchKey : null, column: columnFound ? r.column : null, type: columnType || null },
      status,
      suggestion: suggestion || null,
      suggestions: suggestions.length ? suggestions : null,
    };
    mapping.push(record);
    if (status !== "column_matched") unmatched.push(record);
  }
  (mapping as any).__meta = { tableCoverage, totalRows: excelRows.length, unmatched };
  return mapping;
}

function saveMapping(mapping: any[]) {
  const outDir = path.resolve(process.cwd(), "scripts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "schema-mapping.json");
  fs.writeFileSync(jsonPath, JSON.stringify(mapping, null, 2));
  const mdLines: string[] = [];
  mdLines.push(`# Excel → DB Schema Mapping Report`);
  mdLines.push("");
  const meta = (mapping as any).__meta || { tableCoverage: {}, totalRows: 0, unmatched: [] };
  const totalRows = meta.totalRows || mapping.length;
  const summary = mapping.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  mdLines.push("## Summary");
  mdLines.push(`- total_rows_parsed: ${totalRows}`);
  for (const [k, v] of Object.entries(summary)) {
    mdLines.push(`- ${k}: ${v}`);
  }
  mdLines.push("");
  mdLines.push("## Per-Table Coverage");
  const coverageEntries = Object.entries(meta.tableCoverage as Record<string, { total: number; column_matched: number; column_missing: number; table_only: number }>)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [tbl, cov] of coverageEntries) {
    mdLines.push(`- ${tbl}: total=${cov.total}, matched=${cov.column_matched}, missing=${cov.column_missing}, table_only=${cov.table_only}`);
  }
  mdLines.push("");
  mdLines.push("## Top 20 Unmatched with Suggestions");
  const topUnmatched = (meta.unmatched as any[]).slice(0, 20);
  for (const m of topUnmatched) {
    const sug = m.suggestion ? `${m.suggestion.type} → ${m.suggestion.value} (score=${m.suggestion.score})` : "-";
    mdLines.push(
      `- [${m.status}] Excel: ${m.excel.schema}.${m.excel.table}` +
        `${m.excel.column ? "." + m.excel.column : ""} | used headers: table=${m.excel.usedTableHeader || "-"}, column=${m.excel.usedColumnHeader || "-"} | suggestion: ${sug}`,
    );
  }
  mdLines.push("");
  mdLines.push("## Details");
  for (const m of mapping) {
    mdLines.push(
      `- [${m.status}] Excel: ${m.excel.schema}.${m.excel.table}` +
        `${m.excel.column ? "." + m.excel.column : ""} → Matched: ${m.matched.table || "-"}` +
        `${m.matched.column ? "." + m.matched.column : ""} | used headers: table=${m.excel.usedTableHeader || "-"}, column=${m.excel.usedColumnHeader || "-"}`
    );
  }
  const mdPath = path.join(outDir, "schema-mapping.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"));
  console.log(`Schema mapping saved to:\n- ${jsonPath}\n- ${mdPath}`);
}

function main() {
  const schema = loadScannedSchema();
  const rows = readExcelDBSchema();
  const mapping = mapExcelToSchema(rows, schema);
  saveMapping(mapping);
}

main();
