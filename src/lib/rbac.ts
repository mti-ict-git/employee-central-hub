export type ModuleName = "employees" | "users" | "reports";
export type ActionName = "read" | "create" | "update" | "delete" | "manage_users" | "export";

export type RolePermission = { role: string; module: ModuleName; action: ActionName; allowed: boolean };
export type ColumnAccess = { role: string; section: string; column: string; read: boolean; write: boolean };

const defaultPermissions: RolePermission[] = [
  { role: "superadmin", module: "employees", action: "read", allowed: true },
  { role: "superadmin", module: "employees", action: "create", allowed: true },
  { role: "superadmin", module: "employees", action: "update", allowed: true },
  { role: "superadmin", module: "employees", action: "delete", allowed: true },
  { role: "superadmin", module: "users", action: "manage_users", allowed: true },
  { role: "superadmin", module: "reports", action: "read", allowed: true },
  { role: "superadmin", module: "reports", action: "export", allowed: true },

  { role: "admin", module: "employees", action: "read", allowed: true },
  { role: "admin", module: "employees", action: "create", allowed: true },
  { role: "admin", module: "employees", action: "update", allowed: true },
  { role: "admin", module: "employees", action: "delete", allowed: false },
  { role: "admin", module: "users", action: "manage_users", allowed: true },
  { role: "admin", module: "reports", action: "read", allowed: true },
  { role: "admin", module: "reports", action: "export", allowed: true },

  { role: "hr_general", module: "employees", action: "read", allowed: true },
  { role: "finance", module: "employees", action: "read", allowed: true },
  { role: "dep_rep", module: "employees", action: "read", allowed: true },
];

const defaultReadSections: Record<string, string[]> = {
  superadmin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  admin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  hr_general: ["core","contact","employment","onboard","checklist","notes"],
  finance: ["core","bank","insurance"],
  dep_rep: ["core","employment"],
  employee: ["core"],
};

const defaultWriteSections: Record<string, string[]> = {
  superadmin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  admin: ["core","contact","employment","bank","insurance","onboard","travel","checklist","notes"],
  hr_general: ["contact","employment","notes"],
  finance: ["bank","insurance"],
  dep_rep: [],
  employee: [],
};

export async function fetchPermissions(): Promise<RolePermission[]> {
  try {
    const res = await fetch(`/api/rbac/permissions`, { credentials: "include" });
    if (res.ok) return await res.json();
  } catch (err) {
    return defaultPermissions;
  }
  return defaultPermissions;
}

export async function fetchColumnAccess(): Promise<ColumnAccess[]> {
  try {
    const res = await fetch(`/api/rbac/columns`, { credentials: "include" });
    if (res.ok) return await res.json();
  } catch (err) {
    return [];
  }
  const out: ColumnAccess[] = [];
  return out;
}

function computeColumnMaps(roles: string[], cols: ColumnAccess[]) {
  const readMap: Record<string, Set<string>> = {};
  const writeMap: Record<string, Set<string>> = {};
  for (const role of roles) {
    for (const ca of cols) {
      if (ca.role !== role) continue;
      if (ca.read) {
        if (!readMap[ca.section]) readMap[ca.section] = new Set();
        readMap[ca.section].add(ca.column);
      }
      if (ca.write) {
        if (!writeMap[ca.section]) writeMap[ca.section] = new Set();
        writeMap[ca.section].add(ca.column);
      }
    }
  }
  return { readMap, writeMap };
}

export function computeCapabilities(roles: string[], permissions: RolePermission[], columns: ColumnAccess[] = []) {
  const can = (module: ModuleName, action: ActionName) =>
    roles.some((role) => permissions.some((p) => p.role === role && p.module === module && p.action === action && p.allowed));
  const union = (map: Record<string, string[]>) => {
    const set = new Set<string>();
    for (const role of roles) for (const s of map[role] || []) set.add(s);
    return set;
  };
  const readSections = union(defaultReadSections);
  const writeSections = union(defaultWriteSections);
  const { readMap, writeMap } = computeColumnMaps(roles, columns);
  const canColumn = (section: string, column: string, mode: "read" | "write") => {
    const set = mode === "read" ? readMap[section] : writeMap[section];
    if (set && set.has(column)) return true;
    return mode === "read" ? readSections.has(section) : writeSections.has(section);
  };
  return {
    canReadEmployees: can("employees", "read"),
    canCreateEmployees: can("employees", "create"),
    canUpdateEmployees: can("employees", "update"),
    canDeleteEmployees: can("employees", "delete"),
    canManageUsers: can("users", "manage_users"),
    canAccessReport: can("reports", "read"),
    canExportReport: can("reports", "export"),
    readSections,
    writeSections,
    can,
    canColumn,
  };
}
