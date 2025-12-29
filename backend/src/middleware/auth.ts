import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { CONFIG } from "../config";

export type AppUser = {
  sub: string;
  username: string;
  displayName?: string;
  email?: string;
  roles: string[];
  provider?: string;
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

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const h = String(req.headers.authorization || "");
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "AUTH_REQUIRED" });
  if (process.env.NODE_ENV !== "production" && token.startsWith("dev-mock-token-")) {
    const role = token.slice("dev-mock-token-".length).trim() || "user";
    req.user = {
      sub: `dev-${role}-001`,
      username: "dev",
      roles: [normalizeRole(role)],
      provider: "DEV",
    };
    return next();
  }
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as JwtPayload;
    const decodedRoles = (decoded as JwtPayload & { roles?: unknown }).roles;
    const roles = Array.isArray(decodedRoles) ? decodedRoles.map((r) => normalizeRole(String(r))) : [];
    req.user = {
      sub: String((decoded as JwtPayload & { sub?: unknown }).sub || ""),
      username: String((decoded as JwtPayload & { username?: unknown }).username || ""),
      displayName: (decoded as JwtPayload & { displayName?: unknown }).displayName as string | undefined,
      email: (decoded as JwtPayload & { email?: unknown }).email as string | undefined,
      roles,
      provider: (decoded as JwtPayload & { provider?: unknown }).provider as string | undefined,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

export function requireRole(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = (req.user?.roles || []).map(normalizeRole);
    const allowedNorm = allowed.map(normalizeRole);
    if (!roles.length) return res.status(403).json({ error: "FORBIDDEN" });
    if (roles.some((r) => allowedNorm.includes(r))) return next();
    return res.status(403).json({ error: "FORBIDDEN" });
  };
}
