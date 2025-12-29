type Crud = { read: boolean; create: boolean; update: boolean; delete: boolean };

const perms: Record<string, { employees: Crud; manageUsers: boolean; reports?: { access: boolean; export: boolean } }> = {
  superadmin: { employees: { read: true, create: true, update: true, delete: true }, manageUsers: true, reports: { access: true, export: true } },
  admin: { employees: { read: true, create: true, update: true, delete: false }, manageUsers: true, reports: { access: true, export: true } },
  hr_general: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: true, export: false } },
  finance: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: true, export: true } },
  department_rep: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: true, export: false } },
  employee: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: false, export: false } },
};

function normalizeRole(role: string): string {
  const s = String(role || "").trim().toLowerCase();
  if (s.includes("super")) return "superadmin";
  if (s === "admin") return "admin";
  if (s.includes("human resources") || s.includes("human resource")) return "hr_general";
  if (s.includes("hr")) return "hr_general";
  if (s.includes("finance")) return "finance";
  if (s.includes("dep")) return "department_rep";
  if (s.includes("employee")) return "employee";
  return s;
}

const sectionRead: Record<string, string[]> = {
  superadmin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  admin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  hr_general: ["core","contact","employment","onboard","checklist","notes"],
  finance: ["core","bank","insurance"],
  department_rep: ["core","employment","bank"],
  employee: ["core"],
};

const sectionWrite: Record<string, string[]> = {
  superadmin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  admin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  hr_general: ["contact","employment","notes"],
  finance: ["bank","insurance"],
  department_rep: [],
  employee: [],
};

export function can(role: string, action: keyof Crud, module: "employees"): boolean {
  const p = perms[normalizeRole(role)];
  if (!p) return false;
  return p[module][action];
}

export function canManageUsers(actorRole: string, targetRole?: string): boolean {
  const actor = normalizeRole(actorRole);
  const target = targetRole ? normalizeRole(targetRole) : undefined;
  const p = perms[actor];
  if (!p || !p.manageUsers) return false;
  if (target === "superadmin") return actor === "superadmin";
  return true;
}

export function canCreateRole(actorRole: string, newRole: string): boolean {
  const actor = normalizeRole(actorRole);
  const next = normalizeRole(newRole);
  if (next === "superadmin") return actor === "superadmin";
  return perms[actor]?.manageUsers || false;
}

export function readSectionsFor(role: string): Set<string> {
  return new Set(sectionRead[normalizeRole(role)] || []);
}

export function writeSectionsFor(role: string): Set<string> {
  return new Set(sectionWrite[normalizeRole(role)] || []);
}

export function canAccessReport(role: string): boolean {
  const p = perms[normalizeRole(role)];
  return Boolean(p?.reports?.access);
}

export function canExportReport(role: string): boolean {
  const p = perms[normalizeRole(role)];
  return Boolean(p?.reports?.export);
}
