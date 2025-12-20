import path from "path";
import fs from "fs";
import * as XLSX from "xlsx/xlsx.mjs";

function inspect() {
  const wbPath = path.resolve(process.cwd(), "scripts", "DB Information.xlsx");
  if (!fs.existsSync(wbPath)) {
    console.error(`Workbook not found: ${wbPath}`);
    process.exit(1);
  }
  const data = fs.readFileSync(wbPath);
  const wb = XLSX.read(data, { type: "buffer" });
  const outLines: string[] = [];
  outLines.push("# DB Information Workbook Report");
  outLines.push(`Path: ${wbPath}`);
  outLines.push("");
  outLines.push("## Sheets");
  for (const sName of wb.SheetNames) {
    outLines.push(`- ${sName}`);
  }
  outLines.push("");
  for (const sName of wb.SheetNames) {
    const sh = wb.Sheets[sName];
    const rows: any[] = XLSX.utils.sheet_to_json(sh, { defval: "", header: 1 });
    outLines.push(`## ${sName}`);
    if (!rows.length) {
      outLines.push("- empty");
      outLines.push("");
      continue;
    }
    const headers = (rows[0] as string[]).map((h) => String(h));
    outLines.push(`- headers: ${headers.join(" | ")}`);
    const preview = rows.slice(1, Math.min(rows.length, 11));
    outLines.push("- preview_rows:");
    for (const r of preview) {
      const vals = (r as any[]).map((v) => String(v));
      outLines.push(`  - ${vals.join(" | ")}`);
    }
    outLines.push("");
  }
  const outPath = path.resolve(process.cwd(), "scripts", "db-information-report.md");
  fs.writeFileSync(outPath, outLines.join("\n"));
  console.log(`Wrote: ${outPath}`);
}

inspect();
