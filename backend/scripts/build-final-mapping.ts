import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

type ColumnDef = { name: string };
type TableDef = { columns: ColumnDef[] };
type SchemaMap = Record<string, TableDef>;

type Suggestion = { type: "table" | "column"; value: string; score: number };
type MappingRecord = {
  excel: { table: string | null; schema: string | null; column: string | null; excelName: string | null; usedColumnHeader: string | null; usedTableHeader: string | null };
  matched: { table: string | null; column: string | null; type: string | null };
  status: "column_matched" | "column_missing" | "table_only" | "table_missing";
  suggestion: Suggestion | null;
  suggestions: Suggestion[] | null;
};

function loadSchema(): SchemaMap {
  const schemaPath = path.resolve(process.cwd(), "scripts", "schema.json");
  const parsed = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const schema = parsed.schema as Record<string, { columns: any[] }>;
  const map: SchemaMap = {};
  for (const [tbl, info] of Object.entries(schema)) {
    map[tbl] = { columns: info.columns.map((c) => ({ name: c.name })) };
  }
  return map;
}

function hasColumn(schema: SchemaMap, table: string, column: string): boolean {
  const t = schema[table];
  if (!t) return false;
  const norm = (s: string) => s.trim().toLowerCase();
  return t.columns.some((c) => norm(c.name) === norm(column));
}

function parseQualified(s: string): { table?: string; column?: string } {
  const raw = s.trim();
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return {};
  const table = raw.slice(0, idx).trim();
  const column = raw.slice(idx + 1).trim();
  return { table, column };
}

function buildFinal() {
  const schema = loadSchema();
  const inPath = path.resolve(process.cwd(), "scripts", "schema-mapping.json");
  const mapping: MappingRecord[] = JSON.parse(fs.readFileSync(inPath, "utf-8"));

  const COLUMN_SUGGESTION_MIN = 0.6;
  const TABLE_SUGGESTION_MIN = 0.85;
  const norm = (s: string) => s?.trim().toLowerCase() || "";
  const columnIndex: Record<string, string[]> = {};
  for (const [tbl, def] of Object.entries(schema)) {
    for (const c of def.columns) {
      const k = norm(c.name);
      columnIndex[k] ||= [];
      if (!columnIndex[k].includes(tbl)) columnIndex[k].push(tbl);
    }
  }

  const decisions: any[] = [];
  let accepted = 0;
  let autoMapped = 0;
  let tableOnly = 0;
  let unresolved = 0;

  for (const m of mapping) {
    let finalTable: string | null = null;
    let finalColumn: string | null = null;
    let decision: "accepted" | "auto_mapped" | "table_only" | "unresolved" = "unresolved";
    let rationale = "";

    if (m.status === "column_matched" && m.matched.table && m.matched.column) {
      finalTable = m.matched.table;
      finalColumn = m.matched.column;
      decision = "accepted";
      rationale = "explicit match from Excel mapping or exact column match";
      accepted++;
    } else if (m.status === "table_only" && m.matched.table) {
      finalTable = m.matched.table;
      decision = "table_only";
      rationale = "table identified; Excel row provided no column";
      tableOnly++;
    } else if (m.status === "column_missing" && m.matched.table) {
      const colSugs = (m.suggestions || []).filter((s) => s.type === "column" && s.score >= COLUMN_SUGGESTION_MIN);
      if (colSugs.length && hasColumn(schema, m.matched.table, colSugs[0].value)) {
        finalTable = m.matched.table;
        finalColumn = colSugs[0].value;
        const exactFromExcel = norm(finalColumn) === norm(m.excel.column || "");
        decision = exactFromExcel ? "accepted" : "auto_mapped";
        rationale = exactFromExcel ? "accepted by exact DB column from Excel mapping" : `auto-mapped by column suggestion (score=${colSugs[0].score})`;
        autoMapped++;
      }
    } else if (m.status === "table_missing") {
      const excelCol = m.excel.column || m.excel.excelName || "";
      const idxTables = columnIndex[norm(excelCol)] || [];
      if (idxTables.length === 1) {
        finalTable = idxTables[0];
        finalColumn = excelCol;
        decision = m.excel.column ? "accepted" : "auto_mapped";
        rationale = m.excel.column ? "accepted by exact DB column match across schema" : "auto-mapped by exact column name match across schema";
        autoMapped++;
      } else if (idxTables.length > 1) {
        const tblSugs = (m.suggestions || []).filter((s) => s.type === "table" && s.score >= TABLE_SUGGESTION_MIN);
        if (tblSugs.length && idxTables.includes(tblSugs[0].value)) {
          finalTable = tblSugs[0].value;
          finalColumn = excelCol;
          decision = m.excel.column ? "accepted" : "auto_mapped";
          rationale = m.excel.column ? "accepted by exact DB column and table suggestion" : `auto-mapped by exact column match and table suggestion (score=${tblSugs[0].score})`;
          autoMapped++;
        }
      } else {
        const colSugs = (m.suggestions || []).filter((s) => s.type === "column" && s.score >= COLUMN_SUGGESTION_MIN);
        if (colSugs.length) {
          const qc = parseQualified(colSugs[0].value);
          if (qc.table && qc.column && hasColumn(schema, qc.table, qc.column)) {
            finalTable = qc.table;
            finalColumn = qc.column;
            decision = m.excel.column && norm(m.excel.column) === norm(finalColumn) ? "accepted" : "auto_mapped";
            rationale = m.excel.column && norm(m.excel.column) === norm(finalColumn)
              ? "accepted by exact DB column from Excel mapping via suggestion"
              : `auto-mapped by global column suggestion (score=${colSugs[0].score})`;
            autoMapped++;
          }
        } else {
          const tblSugs = (m.suggestions || []).filter((s) => s.type === "table" && s.score >= TABLE_SUGGESTION_MIN);
          if (tblSugs.length && m.excel.column) {
            const candidateTable = tblSugs[0].value;
            const colName = m.excel.column;
            if (hasColumn(schema, candidateTable, colName)) {
              finalTable = candidateTable;
              finalColumn = colName;
              decision = "accepted";
              rationale = `accepted by DB column in suggested table (score=${tblSugs[0].score})`;
              autoMapped++;
            }
          }
        }
      }
    }

    if (decision === "unresolved") unresolved++;

    decisions.push({
      excel: m.excel,
      initial_status: m.status,
      matched: m.matched,
      suggestions: m.suggestions,
      final: finalTable && finalColumn ? { table: finalTable, column: finalColumn } : null,
      decision,
      rationale,
    });
  }

  const outDir = path.resolve(process.cwd(), "scripts");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "schema-mapping-final.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ decisions, summary: { accepted, autoMapped, tableOnly, unresolved, total: decisions.length } }, null, 2));

  const mdLines: string[] = [];
  mdLines.push("# Excel → DB Final Mapping");
  mdLines.push("");
  mdLines.push("## Summary");
  mdLines.push(`- total: ${decisions.length}`);
  mdLines.push(`- accepted: ${accepted}`);
  mdLines.push(`- auto_mapped: ${autoMapped}`);
  mdLines.push(`- table_only: ${tableOnly}`);
  mdLines.push(`- unresolved: ${unresolved}`);
  mdLines.push("");
  mdLines.push("## Final Mappings");
  for (const d of decisions) {
    const excelKey = `${d.excel.schema}.${d.excel.table}${d.excel.column ? "." + d.excel.column : ""}`;
    const finalKey = d.final ? `${d.final.table}.${d.final.column}` : "-";
    mdLines.push(`- [${d.decision}] Excel: ${excelKey} → Final: ${finalKey} | rationale: ${d.rationale || "-"}`);
  }
  mdLines.push("");
  mdLines.push("## Unresolved Items");
  for (const d of decisions.filter((x) => x.decision === "unresolved")) {
    const excelKey = `${d.excel.schema}.${d.excel.table}${d.excel.column ? "." + d.excel.column : ""}`;
    const sug = d.suggestions && d.suggestions.length ? `${d.suggestions[0].type} → ${d.suggestions[0].value} (score=${d.suggestions[0].score})` : "-";
    mdLines.push(`- Excel: ${excelKey} | top suggestion: ${sug}`);
  }
  const mdPath = path.join(outDir, "schema-mapping-final.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"));
  console.log(`Final mapping saved to:\n- ${jsonPath}\n- ${mdPath}`);
}

buildFinal();
