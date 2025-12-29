import path from "path";
import dotenv from "dotenv";
import sql from "mssql";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

type CardRow = {
  staffNo: string;
  accessLevel: number;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] || "";
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq >= 0) {
      args.set(a.slice(2, eq), a.slice(eq + 1));
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }

  return { args, flags };
}

function extractTagValue(xml: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return String(m[1] || "").trim();
}

function parseGetAllCardXml(xml: string): CardRow[] {
  const start = xml.indexOf("<DocumentElement");
  if (start < 0) return [];
  const end = xml.indexOf("</DocumentElement>");
  if (end < 0) return [];
  const doc = xml.slice(start, end + "</DocumentElement>".length);

  const cards: CardRow[] = [];
  const re = /<Card\b[^>]*>([\s\S]*?)<\/Card>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    const cardXml = m[0];
    const staffNo = extractTagValue(cardXml, "StaffNo");
    const accessLevelRaw = extractTagValue(cardXml, "AccessLevel");
    if (!staffNo || !accessLevelRaw) continue;
    const accessLevel = Number.parseInt(accessLevelRaw, 10);
    if (!Number.isFinite(accessLevel)) continue;
    cards.push({ staffNo, accessLevel });
  }
  return cards;
}

function computeResiden(accessLevel: number): boolean {
  if (accessLevel === 999) return false;
  return (accessLevel & 0x03) !== 0;
}

function getDbPool() {
  const server = process.env.DB_SERVER || "";
  const user = process.env.DB_USER || "";
  const password = process.env.DB_PASSWORD || "";
  const port = parseInt(process.env.DB_PORT || "1433", 10);
  const encrypt = (process.env.DB_ENCRYPT || "false").toLowerCase() === "true";
  const trustServerCertificate = (process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true";
  const database = process.env.DB_DATABASE || "";

  return new sql.ConnectionPool({
    server,
    user,
    password,
    database,
    port,
    options: {
      encrypt,
      trustServerCertificate,
    },
  });
}

async function updateBatch(pool: sql.ConnectionPool, items: { employee_id: string; residen: boolean }[]) {
  if (items.length === 0) return 0;

  const req = new sql.Request(pool);
  const tuples: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const idParam = `employee_id_${i}`;
    const resParam = `residen_${i}`;
    req.input(idParam, sql.VarChar(100), it.employee_id);
    req.input(resParam, sql.Bit(), it.residen ? 1 : 0);
    tuples.push(`(@${idParam}, @${resParam})`);
  }

  const q = `
    UPDATE ec
    SET ec.residen = v.residen
    FROM dbo.employee_core ec
    INNER JOIN (VALUES ${tuples.join(",")}) AS v(employee_id, residen)
      ON ec.employee_id = v.employee_id;
  `;
  const res = await req.query(q);
  const affected = (res.rowsAffected || []).reduce((a, b) => a + b, 0);
  return affected;
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const apply = flags.has("apply");
  const url =
    args.get("url") ||
    process.env.VAULTSITE_GETALLCARD_URL ||
    "http://10.60.10.6/Vaultsite/APIwebservice.asmx/GetAllCard";
  const staffNoFilter = args.get("staffNo") || args.get("staffno") || null;
  const batchSize = Math.max(1, Math.min(500, parseInt(args.get("batchSize") || "300", 10) || 300));

  const httpRes = await fetch(url, { method: "GET" });
  if (!httpRes.ok) throw new Error(`GetAllCard failed: ${httpRes.status} ${httpRes.statusText}`);
  const xml = await httpRes.text();
  const cards = parseGetAllCardXml(xml);
  const rows = staffNoFilter ? cards.filter((c) => c.staffNo === staffNoFilter) : cards;

  const byStaff = new Map<string, { residen: boolean; accessLevel: number }>();
  for (const r of rows) {
    byStaff.set(r.staffNo, { residen: computeResiden(r.accessLevel), accessLevel: r.accessLevel });
  }

  const updates = Array.from(byStaff.entries()).map(([employee_id, v]) => ({
    employee_id,
    residen: v.residen,
    accessLevel: v.accessLevel,
  }));

  console.log(`GetAllCard url: ${url}`);
  console.log(`Parsed cards: ${cards.length}`);
  if (staffNoFilter) console.log(`Filter staffNo: ${staffNoFilter}`);
  console.log(`Updates prepared: ${updates.length}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY_RUN"}`);
  console.log("");
  console.log(`Sample (first 10):`);
  for (const u of updates.slice(0, 10)) {
    console.log(`- ${u.employee_id}: accessLevel=${u.accessLevel} => residen=${u.residen ? 1 : 0}`);
  }
  console.log("");

  if (!apply) return;

  const pool = getDbPool();
  try {
    await pool.connect();
    let total = 0;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize).map((u) => ({ employee_id: u.employee_id, residen: u.residen }));
      total += await updateBatch(pool, batch);
    }
    console.log(`Rows updated: ${total}`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

