type Crud = { read: boolean; create: boolean; update: boolean; delete: boolean };

const perms: Record<string, { employees: Crud; manageUsers: boolean; reports?: { access: boolean; export: boolean } }> = {
  superadmin: { employees: { read: true, create: true, update: true, delete: true }, manageUsers: true, reports: { access: true, export: true } },
  admin: { employees: { read: true, create: true, update: true, delete: false }, manageUsers: true, reports: { access: true, export: true } },
  hr_general: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: true, export: false } },
  finance: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: true, export: true } },
  department_rep: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: true, export: false } },
  employee: { employees: { read: true, create: false, update: false, delete: false }, manageUsers: false, reports: { access: false, export: false } },
};

const sectionRead: Record<string, string[]> = {
  superadmin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  admin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  hr_general: ["core","contact","employment","onboard","checklist","notes"],
  finance: ["core","bank","insurance"],
  department_rep: ["core","employment"],
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
  const p = perms[role];
  if (!p) return false;
  return p[module][action];
}

export function canManageUsers(actorRole: string, targetRole?: string): boolean {
  const p = perms[actorRole];
  if (!p || !p.manageUsers) return false;
  if (actorRole !== "superadmin" && targetRole === "superadmin") return false;
  return true;
}

export function canCreateRole(actorRole: string, newRole: string): boolean {
  if (newRole === "superadmin") return actorRole === "superadmin";
  return perms[actorRole]?.manageUsers || false;
}

export function readSectionsFor(role: string): Set<string> {
  return new Set(sectionRead[role] || []);
}

export function writeSectionsFor(role: string): Set<string> {
  return new Set(sectionWrite[role] || []);
}

export function canAccessReport(role: string): boolean {
  const p = perms[role];
  return Boolean(p?.reports?.access);
}

export function canExportReport(role: string): boolean {
  const p = perms[role];
  return Boolean(p?.reports?.export);
}
