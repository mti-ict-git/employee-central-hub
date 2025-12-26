import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

function parseCSV(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const lines = raw.split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = (cols[i] || "").trim();
    return obj;
  });
  return { header, rows };
}

async function run() {
  const port = parseInt(process.env.BACKEND_PORT || process.env.SERVER_PORT || "8083", 10);
  const base = `http://localhost:${port}`;
  const token = jwt.sign({ sub: "smoke", username: "smoke_admin", roles: ["admin"] }, String(process.env.JWT_SECRET), {
    expiresIn: "10m",
  });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const csvPath = path.resolve(process.cwd(), "../public/import_indonesia.csv");
  const { rows } = parseCSV(csvPath);

  const res = await fetch(`${base}/api/employees/import`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  const json = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ ok: res.ok, import: json }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
