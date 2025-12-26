import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function run() {
  const port = parseInt(process.env.BACKEND_PORT || process.env.SERVER_PORT || "8083", 10);
  const base = `http://localhost:${port}`;
  const token = jwt.sign(
    { sub: "smoke", username: "smoke_admin", roles: ["admin"] },
    String(process.env.JWT_SECRET),
    { expiresIn: "10m" },
  );
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const health = await fetch(`${base}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health || health.ok !== true) {
    console.log(JSON.stringify({ ok: false, step: "health", error: "BACKEND_NOT_REACHABLE", base }, null, 2));
    return;
  }

  const list = await fetch(`${base}/api/employees?limit=1&offset=0`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .catch(() => null);
  const existingId = list && list.items && list.items[0] && list.items[0].core ? list.items[0].core.employee_id : null;
  const rows = [
    {
      employee_id: existingId || "IMP_FALLBACK_1",
      name: "Import One",
      gender: "Male",
      nationality: "Indonesia",
      department: "ICT",
      job_title: "Engineer",
      employment_status: "permanent",
      join_date: "2024-01-15",
    },
    {
      employee_id: "IMP_NEW_2",
      name: "Import Two",
      gender: "Female",
      nationality: "Indonesia",
      department: "HR",
      job_title: "Officer",
      employment_status: "invalid_status",
      join_date: "2024-01-16",
    },
  ];

  const impRes = await fetch(`${base}/api/employees/import`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  const impJson = await impRes.json().catch(() => ({}));
  console.log(JSON.stringify({ ok: impRes.ok, import: impJson }, null, 2));
  if (!impRes.ok) return;

  const detailRes = await fetch(`${base}/api/employees/${encodeURIComponent(rows[0].employee_id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detailJson = await detailRes.json().catch(() => ({}));
  const employmentStatus =
    detailJson && detailJson.employment && detailJson.employment.employment_status
      ? String(detailJson.employment.employment_status)
      : null;
  console.log(JSON.stringify({ employee_id: rows[0].employee_id, employment_status: employmentStatus }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
