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
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as JwtPayload;
    const roles = Array.isArray((decoded as any).roles) ? (decoded as any).roles : [];
    req.user = {
      sub: String((decoded as any).sub || ""),
      username: String((decoded as any).username || ""),
      displayName: (decoded as any).displayName,
      email: (decoded as any).email,
      roles,
      provider: (decoded as any).provider,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

export function requireRole(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = req.user?.roles || [];
    if (!roles.length) return res.status(403).json({ error: "FORBIDDEN" });
    if (roles.some((r) => allowed.includes(r))) return next();
    return res.status(403).json({ error: "FORBIDDEN" });
  };
}
