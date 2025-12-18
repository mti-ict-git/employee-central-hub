import { Router } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { authenticate } from "../auth/ldap";
import { CONFIG } from "../config";
import type { AuthSuccess } from "../types";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "USERNAME_PASSWORD_REQUIRED" });
    }

    const user = await authenticate(username, password);

    if (!user.roles || user.roles.length === 0) {
      // Deny login if user is not in any mapped group
      return res.status(403).json({ error: "USER_NOT_IN_ALLOWED_GROUPS" });
    }

    const jwtPayload = {
        sub: user.dn,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        provider: "ad",
      };
    const options: SignOptions = { expiresIn: CONFIG.JWT_EXPIRES_IN as StringValue };
    const token = jwt.sign(jwtPayload, CONFIG.JWT_SECRET as Secret, options);

    const responsePayload: AuthSuccess = {
      token,
      user: {
        dn: user.dn,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        roles: user.roles,
        provider: "ad",
      },
    };

    return res.json(responsePayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AUTH_FAILED";
    const code = message === "USER_NOT_FOUND" ? 404 : 401;
    return res.status(code).json({ error: message });
  }
});