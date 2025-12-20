import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import * as XLSX from "xlsx/xlsx.mjs";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

type ColumnDef = { name: string; type?: string; nullable?: boolean };
type TableDef = { columns: ColumnDef[] };
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
  return s.toLowerCase().replace(/[^a-z0-9_\s]/g, "").replace(/[\s]+/g, " ").trim();
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
  return 1 - d / denom;
}

function readWorkbook(): Array<{ excelColumn?: string; dbColumn?: string; tableName?: string }> {
  const wbPath = path.resolve(process.cwd(), "scripts", "DB Information.xlsx");
  if (!fs.existsSync(wbPath)) throw new Error(`Workbook not found at ${wbPath}`);
  const data = fs.readFileSync(wbPath);
  const wb = XLSX.read(data, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const idxExcel = headers.findIndex((h) => h.includes("excel") && h.includes("column"));
  const idxDb = headers.findIndex((h) => h.includes("db") && h.includes("column"));
  const idxTable = headers.findIndex((h) => h.includes("table") && h.includes("name"));
  const excelHeader = idxExcel >= 0 ? Object.keys(rows[0])[idxExcel] : undefined;
  const dbHeader = idxDb >= 0 ? Object.keys(rows[0])[idxDb] : undefined;
  const tableHeader = idxTable >= 0 ? Object.keys(rows[0])[idxTable] : undefined;
  const out: Array<{ excelColumn?: string; dbColumn?: string; tableName?: string }> = [];
  for (const r of rows) {
    out.push({
      excelColumn: excelHeader ? String(r[excelHeader] || "").trim() : undefined,
      dbColumn: dbHeader ? String(r[dbHeader] || "").trim() : undefined,
      tableName: tableHeader ? String(r[tableHeader] || "").trim() : undefined,
    });
  }
  return out;
}

function buildQualifiedName(tbl: string, schema?: string): string {
  const t = tbl.trim();
  if (!schema || !schema.trim()) return t.includes(".") ? t : `dbo.${t}`;
  return `${schema.trim()}.${t}`;
}

function mapFromWorkbook(rows: Array<{ excelColumn?: string; dbColumn?: string; tableName?: string }>, schema: SchemaMap) {
  const mapping: any[] = [];
  const tableCoverage: Record<string, { total: number; column_matched: number; column_missing: number; table_only: number }> = {};
  const unmatched: Array<any> = [];
  const allColumns: Array<{ table: string; column: string }> = [];
  for (const [tbl, def] of Object.entries(schema)) {
    for (const c of def.columns) allColumns.push({ table: tbl, column: c.name });
  }
  for (const r of rows) {
    const tables = (r.tableName || "").split(/[;,]+/g).map((t) => t.trim()).filter(Boolean);
    const column = r.dbColumn && r.dbColumn.trim() ? r.dbColumn.trim() : undefined;
    if (!tables.length) {
      const status = "table_missing";
      const suggestions = column
        ? allColumns
            .map((tc) => ({ type: "column", value: `${tc.table}.${tc.column}`, score: similarity(column, tc.column) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .filter((s) => s.score >= 0.6)
        : null;
      const record = {
        excel: { table: null, schema: "dbo", column: column || null, excelName: r.excelColumn || null, usedColumnHeader: column ? "DB Column" : null, usedTableHeader: null },
        matched: { table: null, column: null, type: null },
        status,
        suggestion: suggestions && suggestions.length ? suggestions[0] : null,
        suggestions: suggestions && suggestions.length ? suggestions : null,
      };
      mapping.push(record);
      unmatched.push(record);
      continue;
    }
    for (let t of tables) {
      let schemaKey: string | undefined;
      let tableKey = t;
      if (t.includes(".")) {
        const [sch, tbl] = t.split(".");
        schemaKey = sch.trim();
        tableKey = tbl.trim();
      }
      const qualified = buildQualifiedName(tableKey, schemaKey);
      const matchKey = Object.keys(schema).find((k) => normalizeName(k) === normalizeName(qualified));
      const tableFound = !!matchKey;
      let columnFound = false;
      let colType: string | undefined;
      let suggestion: { type: "column"; value: string; score: number } | undefined;
      let suggestions: Array<{ type: "column"; value: string; score: number }> = [];
      if (tableFound && column) {
        const tdef = schema[matchKey!];
        const cdef = tdef.columns.find((c) => normalizeName(c.name) === normalizeName(column));
        if (cdef) {
          columnFound = true;
          colType = cdef.type;
        } else {
          const scored = tdef.columns
            .map((c) => ({ value: c.name, score: similarity(column, c.name) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .filter((s) => s.score >= 0.6);
          if (scored.length) {
            suggestion = { type: "column", value: scored[0].value, score: Number(scored[0].score.toFixed(2)) };
            suggestions = scored.map((s) => ({ type: "column", value: s.value, score: Number(s.score.toFixed(2)) }));
          }
        }
      }
      const status = tableFound ? (column ? (columnFound ? "column_matched" : "column_missing") : "table_only") : "table_missing";
      tableCoverage[matchKey || qualified] ||= { total: 0, column_matched: 0, column_missing: 0, table_only: 0 };
      tableCoverage[matchKey || qualified].total += 1;
      if (status === "column_matched") tableCoverage[matchKey || qualified].column_matched += 1;
      else if (status === "column_missing") tableCoverage[matchKey || qualified].column_missing += 1;
      else if (status === "table_only") tableCoverage[matchKey || qualified].table_only += 1;
      const record = {
        excel: { table: tableKey, schema: schemaKey || "dbo", column: column || null, excelName: r.excelColumn || null, usedColumnHeader: column ? "DB Column" : null, usedTableHeader: "Table Name" },
        matched: { table: tableFound ? matchKey : null, column: columnFound ? column : null, type: colType || null },
        status,
        suggestion: suggestion || null,
        suggestions: suggestions.length ? suggestions : null,
      };
      mapping.push(record);
      if (status !== "column_matched") unmatched.push(record);
    }
  }
  (mapping as any).__meta = { tableCoverage, totalRows: rows.length, unmatched };
  return mapping;
}

function saveMapping(mapping: any[]) {
  const outDir = path.resolve(process.cwd(), "scripts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "dbinfo-mapping.json");
  fs.writeFileSync(jsonPath, JSON.stringify(mapping, null, 2));
  const mdLines: string[] = [];
  mdLines.push("# DB Information → Scanned Schema Mapping Report");
  mdLines.push("");
  const meta = (mapping as any).__meta || { tableCoverage: {}, totalRows: 0, unmatched: [] };
  const totalRows = meta.totalRows || mapping.length;
  const summary = mapping.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  mdLines.push("## Summary");
  mdLines.push(`- total_rows_parsed: ${totalRows}`);
  for (const [k, v] of Object.entries(summary)) mdLines.push(`- ${k}: ${v}`);
  mdLines.push("");
  mdLines.push("## Per-Table Coverage");
  const coverageEntries = Object.entries(meta.tableCoverage as Record<string, { total: number; column_matched: number; column_missing: number; table_only: number }>).sort(([a], [b]) => a.localeCompare(b));
  for (const [tbl, cov] of coverageEntries) mdLines.push(`- ${tbl}: total=${cov.total}, matched=${cov.column_matched}, missing=${cov.column_missing}, table_only=${cov.table_only}`);
  mdLines.push("");
  mdLines.push("## Top 20 Unmatched with Suggestions");
  const topUnmatched = (meta.unmatched as any[]).slice(0, 20);
  for (const m of topUnmatched) {
    const sug = m.suggestion ? `${m.suggestion.type} → ${m.suggestion.value} (score=${m.suggestion.score})` : "-";
    mdLines.push(`- [${m.status}] Excel: ${m.excel.schema}.${m.excel.table}${m.excel.column ? "." + m.excel.column : ""} | used headers: table=${m.excel.usedTableHeader || "-"}, column=${m.excel.usedColumnHeader || "-"} | suggestion: ${sug}`);
  }
  mdLines.push("");
  mdLines.push("## Details");
  for (const m of mapping) {
    mdLines.push(`- [${m.status}] Excel: ${m.excel.schema}.${m.excel.table}${m.excel.column ? "." + m.excel.column : ""} → Matched: ${m.matched.table || "-"}${m.matched.column ? "." + m.matched.column : ""} | used headers: table=${m.excel.usedTableHeader || "-"}, column=${m.excel.usedColumnHeader || "-"}`);
  }
  const mdPath = path.join(outDir, "dbinfo-mapping.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"));
  console.log(`DB Information mapping saved to:\n- ${jsonPath}\n- ${mdPath}`);
}

function main() {
  const schema = loadScannedSchema();
  const rows = readWorkbook();
  const mapping = mapFromWorkbook(rows, schema);
  saveMapping(mapping);
}

main();
