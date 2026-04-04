export type StoredAuthUser = {
  username?: string;
  displayName?: string;
  role?: string;
  roles?: string[];
};

export function readStoredAuthUser(): StoredAuthUser | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const roles = Array.isArray(obj.roles) ? obj.roles.map((r) => String(r)) : undefined;
    return {
      username: obj.username ? String(obj.username) : undefined,
      displayName: obj.displayName ? String(obj.displayName) : undefined,
      role: obj.role ? String(obj.role) : undefined,
      roles,
    };
  } catch {
    return null;
  }
}
