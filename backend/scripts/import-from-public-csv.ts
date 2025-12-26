import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

function parseCSV(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const lines = raw.split(/\r?\n/);
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((line) => line.split(","));
  return { header, rows };
}

async function run() {
  const port = parseInt(process.env.BACKEND_PORT || process.env.SERVER_PORT || "8083", 10);
  const base = `http://localhost:${port}`;
  const token = jwt.sign({ sub: "smoke", username: "smoke_admin", roles: ["admin"] }, String(process.env.JWT_SECRET), {
    expiresIn: "10m",
  });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const csvPath = path.resolve(process.cwd(), "../public/employee_indonesia_template_with_sample.csv");
  const { header, rows } = parseCSV(csvPath);

  const idx = (name: string) => header.indexOf(name);
  const mapRow = (cols: string[]) => ({
    employee_id: cols[idx("employee_id")] || "",
    name: cols[idx("name")] || "",
    gender: cols[idx("gender")] || "",
    nationality: cols[idx("nationality")] || "",
    department: cols[idx("department")] || "",
    job_title: cols[idx("job_title")] || "",
    employment_status: cols[idx("employment_status")] || "",
    join_date: cols[idx("join_date")] || "",
  });

  const payload = rows.map(mapRow);
  const res = await fetch(`${base}/api/employees/import`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ ok: res.ok, import: json }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
