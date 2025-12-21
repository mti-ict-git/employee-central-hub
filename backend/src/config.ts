import path from "path";
import dotenv from "dotenv";

// Load root .env when running from backend directory
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const env = (key: string, fallback?: string): string => {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
};

export const CONFIG = {
  PORT: parseInt(process.env.BACKEND_PORT || process.env.SERVER_PORT || "8081", 10),
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8080",
  FRONTEND_URLS: (process.env.FRONTEND_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat([
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]),
  CORS_ALLOW_ALL: (process.env.CORS_ALLOW_ALL || "false").toLowerCase() === "true",

  JWT_SECRET: env("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",

  LDAP_URL: env("LDAP_URL"),
  LDAP_BASE_DN: env("LDAP_BASE_DN"),
  LDAP_BIND_DN: env("LDAP_BIND_DN"),
  LDAP_BIND_PASSWORD: env("LDAP_BIND_PASSWORD"),
  LDAP_USER_SEARCH_BASE: env("LDAP_USER_SEARCH_BASE", env("LDAP_BASE_DN")),
  LDAP_USER_SEARCH_FILTER: env("LDAP_USER_SEARCH_FILTER", "(sAMAccountName={username})"),
  LDAP_GROUP_SEARCH_BASE: env("LDAP_GROUP_SEARCH_BASE", env("LDAP_BASE_DN")),
  LDAP_TIMEOUT: parseInt(process.env.LDAP_TIMEOUT || "5000", 10),
  LDAP_CONNECT_TIMEOUT: parseInt(process.env.LDAP_CONNECT_TIMEOUT || "10000", 10),
  LDAP_TLS_REJECT_UNAUTHORIZED: (process.env.LDAP_TLS_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true",

  // Group → Role mapping from env lines 81-86
  GROUPS: {
    SUPERADMIN: env("LDAP_GROUP_SUPERADMIN"),
    ADMIN: env("LDAP_GROUP_ADMIN"),
    HR_GENERAL: env("LDAP_GROUP_HR_GENERAL"),
    FINANCE: env("LDAP_GROUP_FINANCE"),
    DEP_REP: env("LDAP_GROUP_DEP_REP"),
  },

  // Database (SQL Server)
  DB: {
    SERVER: env("DB_SERVER"),
    DATABASE: env("DB_DATABASE"),
    USER: env("DB_USER"),
    PASSWORD: env("DB_PASSWORD"),
    PORT: parseInt(process.env.DB_PORT || "1433", 10),
    ENCRYPT: (process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    TRUST_SERVER_CERTIFICATE: (process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true",
  },
};
