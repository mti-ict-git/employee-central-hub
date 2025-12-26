import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function run(id: string) {
  const port = parseInt(process.env.BACKEND_PORT || process.env.SERVER_PORT || "8083", 10);
  const base = `http://localhost:${port}`;
  const token = jwt.sign({ sub: "probe", username: "smoke_admin", roles: ["admin"] }, String(process.env.JWT_SECRET), {
    expiresIn: "5m",
  });
  const headers = { Authorization: `Bearer ${token}` };
  const res = await fetch(`${base}/api/employees/${encodeURIComponent(id)}`, { headers });
  const json = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ ok: res.ok, data: json }, null, 2));
}

const id = process.argv[2] || "MTI30002";
run(id).catch((e) => {
  console.error(e);
  process.exit(1);
});
