2025-12-17 16:05 — Repo learning and architecture mapping

Summary
- Explored Vite + React + TypeScript stack with Tailwind and shadcn UI.
- Mapped routing in `src/App.tsx` for dashboard, list/detail, add, and import pages.
- Reviewed layouts (`MainLayout`, `Sidebar`, `Header`) and global theming via CSS variables in `src/index.css` and `tailwind.config.ts`.
- Examined data models (`src/types/employee.ts`) and mock dataset (`src/data/mockEmployees.ts`).
- Studied multi-step Add Employee form and Zod schemas in `src/lib/employeeSchema.ts` with step-level validation.
- Analyzed CSV import flow in `src/pages/ImportEmployees.tsx` and helpers in `src/lib/csvTemplates.ts` (templates, samples, CSV generation/download).
- Verified feedback patterns using custom `use-toast` and Radix `Toast`, with `sonner` variant also available.

Key Findings
- React Router defines core navigation; `NavLink` wrapper enables active/pending styles.
- React Query is initialized but not yet used for data fetching—future backend integration candidate.
- The import page validates required fields, enums, and date formats; currently simulates backend import.
- Theming is robust via CSS variables; sidebar and component tokens are consistent across dark/light.

Next Opportunities
- Wire real backend APIs (REST/GraphQL) for employee CRUD and import processing.
- Leverage React Query for server state and optimistic updates.
- Add accessibility enhancements to tables and action buttons (aria labels).
- Consider a theme provider alignment for `sonner` or stick to Radix toast for consistency.

Actions Taken Today
- Read and documented architecture, routing, models, forms, CSV import, and UI foundations.
Wednesday, December 17, 2025 4:09:32 PM - Frontend dev server started at http://localhost:8080/


Wednesday, December 17, 2025 4:12:44 PM - Sidebar: Grouped Employee List, Add Employee, and Import Data under Employee Management.


Wednesday, December 17, 2025 4:14:25 PM - Lint fix: Replaced ny with typed icon component in Sidebar; type check passed.


Wednesday, December 17, 2025 4:20:53 PM - Created backend folder with README anchor.


Wednesday, December 17, 2025 4:24:46 PM - Secured env handling: added .env to .gitignore and created .env.example.

## 2025-12-17 16:32:49 +08:00 — AD Login Integration (Backend + Frontend)

- Added a backend Express (TypeScript) server under `backend/` with `/api/auth/login`.
- Implemented LDAP bind + user lookup using `.env` settings (`LDAP_URL`, `LDAP_*`, lines 81–86 for group→role mapping).
- Mapped AD groups to roles: `superadmin`, `admin`, `hr_general`, `finance`, `department_rep`.
- Issued JWT on successful login using `JWT_SECRET` and `JWT_EXPIRES_IN`.
- Enabled CORS for `FRONTEND_URL` and added Vite proxy for `/api` → `http://localhost:8081`.
- Updated `src/pages/Auth.tsx` to call `/api/auth/login` with `username` and `password`.
- Ran integrity checks: `npx tsc --noEmit` (frontend) and `npm run typecheck` (backend) — both passed.
- Verified UI loads via `http://localhost:8080/` and tested login request path.

## 2025-12-17 22:18:23 +08:00 — LDAP Type Fix

- Replaced `any` types in `backend/src/auth/ldap.ts` with ldapjs interfaces (`SearchCallbackResponse`, `SearchEntry`, `Attribute`).
- Ran backend type check (`npm run typecheck`) — passed.

## 2025-12-17 22:20:53 +08:00 — Auth Route ESLint Cleanup

- Removed `any` usage in `backend/src/routes/auth.ts` catch block by typing as `unknown` and narrowing with `instanceof Error`.
- Fixed `expiresIn` typing without `any` by importing `StringValue` from `ms` and casting `CONFIG.JWT_EXPIRES_IN` accordingly.
- Ran backend type check (`npm run typecheck`) — passed.

## 2025-12-18 09:46:20 +08:00 — Combined Dev Script and Ports

- Added `dev:full` script in root `package.json` using `concurrently` to run web and API together.
- Set Vite dev server to fixed port `8080` with `strictPort` to prevent auto-switching.
- Configured backend dev to use `BACKEND_PORT=8083` via `cross-env` to avoid collision with frontend proxy target `8081`.
- Verified both servers start: frontend at `http://localhost:8080/`, backend at `http://localhost:8083`.

## 2025-12-18 09:51:41 +08:00 — Proxy Aligned to Backend

- Updated `vite.config.ts` proxy target to `http://localhost:8083` to match backend dev port.
- Restarted combined dev servers and verified frontend at `http://localhost:8080/` and backend at `http://localhost:8083`.
- Opened preview to smoke-test the login page; no asset errors.

## 2025-12-18 09:55:44 +08:00 — Auth Guard for Protected Routes

- Added `src/components/auth/RequireAuth.tsx` to enforce login for protected pages.
- Wrapped routes (`/`, `/employees`, `/employees/new`, `/employees/import`, `/employees/:id`) with the auth guard.
- Confirmed unauthenticated users are redirected to `/auth`.
- Ran `npx tsc --noEmit` for integrity; compilation passed.
- Started a dedicated dev server on `http://localhost:8084/` and validated login routing in the browser.

## 2025-12-18 10:04:17 +08:00 — AD Login Test (Credentials Provided)

- Backend dev server confirmed running on `http://localhost:8083`.
- Tested `/api/auth/login` with provided credentials.
- Using `username = widji.santoso` (sAMAccountName) succeeded; received JWT and role mapping `superadmin`.
- Using full email as username returned `USER_NOT_FOUND` with current `LDAP_USER_SEARCH_FILTER` default.
- Recommendation pending: allow email/UPN by setting `LDAP_USER_SEARCH_FILTER=(|(sAMAccountName={username})(userPrincipalName={username})(mail={username}))` in `.env`.

## 2025-12-18 11:43:55 — Sidebar User Management and Role Guard

- Added "User Management" submenu under Settings in the sidebar.
- Implemented role-based visibility; only `admin` and `superadmin` see the submenu.
- Created placeholder page `src/pages/UserManagement.tsx` with Shadcn UI and responsive grid.
- Added guarded route `/settings/users` using `RequireAuth` and new `RequireRole` guard.
- Implemented `src/components/auth/RequireRole.tsx` to restrict route access based on `auth_user.role` in `localStorage`.
- Ran `npx tsc --noEmit` — passed successfully.
- Launched dev server at `http://localhost:8086/` and validated sidebar visibility and route access.

## 2025-12-18 11:45:48 — Lint Fix in Auth Page

- Replaced `catch (err: any)` with `catch (err: unknown)` in `src/pages/Auth.tsx`.
- Narrowed error using `err instanceof Error` to extract message safely.
- Ensures compliance with `@typescript-eslint/no-explicit-any` and improves type safety.
- Ran `npx tsc --noEmit` — compilation succeeded with exit code 0.

## 2025-12-18 11:49:18 — Friendly Authentication Errors

- Improved login error messages in `src/pages/Auth.tsx`.
- Added mapper for common LDAP codes: 525 (user not found), 52e (invalid credentials), 532 (password expired), 533 (disabled), 701 (account expired), 773 (must change password), 775 (locked).
- When technical strings like `AcceptSecurityContext`/`DSID` appear, show user-friendly guidance and suggest using sAMAccountName if email is entered.
- Retained a safe fallback for unexpected errors.
- Ran `npx tsc --noEmit` — compilation passed.
- Previewed via `http://localhost:8086/` to validate toasts.

## 2025-12-18 11:56:20 — Backend MSSQL Schema Scan

- Added `backend/scripts/scan-schema.ts` to connect to MSSQL using `.env` values (`DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`).

## 2025-12-18 12:09:11 — Excel → DB Schema Mapping and Typing Fix

- Parsed `public/Comben Master Data Column Assignment.xlsx` (sheet `DB Schema`) and generated mapping to scanned MSSQL schema.
- Saved outputs:
  - `backend/scripts/schema-mapping.json`
  - `backend/scripts/schema-mapping.md`
- Resolved ESM import for `xlsx` by using `xlsx/xlsx.mjs` and reading the workbook via Node `fs` buffer.
- Added TypeScript module declaration `backend/scripts/types/xlsx-xlsx-mjs.d.ts` to align typings with `xlsx` package exports.
- Ran `npm run typecheck` — passed successfully.
- Next: Use mapping results to drive API scaffolding for tables with `column_matched` status and ask for endpoint preferences (REST/GraphQL, entities, auth, pagination).

## 2025-12-18 15:02:12 — Excel Parser Header Alignment

- Updated `backend/scripts/map-schema-from-excel.ts` to use explicit headers:
  - `Column Name` (trimmed)
  - `Mapping to Existing DB Schema`
  - `Existing Table Name`
- Parser now derives `schema.table.column` from the mapping header, with fallbacks to existing table + column name, defaulting schema to `dbo` when absent.
- Re-ran mapping and regenerated outputs:
  - `backend/scripts/schema-mapping.json`
  - `backend/scripts/schema-mapping.md`
- Ran `npm run typecheck` — backend compilation passed.
- Implemented schema extraction for tables, columns (type, nullability, lengths/precision), primary keys, and foreign keys via `INFORMATION_SCHEMA` queries.
- Added npm script `scan:schema` in `backend/package.json` using `tsx` to run the scanner.
- Executed the scan successfully and saved outputs:
  - `backend/scripts/schema.json`
  - `backend/scripts/schema-report.md`
- Ran TypeScript integrity check with `npx tsc --noEmit` at repo root — succeeded with exit code 0.

## 2025-12-18 12:01:20 — Backend MSSQL Typings and Typecheck

- Installed `@types/mssql` as a dev dependency in `backend` to resolve `ts(7016)` missing declaration errors for `mssql`.
- Updated `backend/tsconfig.json` to include the `scripts` directory so `backend/scripts/scan-schema.ts` is typechecked.
- Ran backend typecheck with `npm run typecheck` — succeeded with exit code 0.
- Verified editor warnings cleared for `import sql from "mssql"` in `scan-schema.ts`.

## 2025-12-18 12:03:12 — Scan Script Type Safety Update

- Replaced `Record<string, any>` in `backend/scripts/scan-schema.ts` with explicit interfaces: `ColumnDef`, `ForeignKeyDef`, `TableDef`, and `SchemaMap`.
- Adjusted markdown generation to iterate keys for type-safe access to table definitions.
- Ran backend typecheck (`npm run typecheck`) — succeeded with exit code 0.
- Re-ran schema scan (`npm run scan:schema`) — outputs regenerated successfully with no runtime errors.

## 2025-12-18 15:32:07 +08:00 — Mapping Report Enhancements

- Enhanced `backend/scripts/map-schema-from-excel.ts` to include:
  - `total_rows_parsed` in summary
  - Per-status counts (column_matched, column_missing, table_only, table_missing)
  - Per-table coverage: totals, matched, missing, and table-only
  - Top 20 unmatched items with nearest suggestions (Levenshtein-based similarity)
  - Per-row “used headers” for table/column (Mapping vs Column Name vs Existing Table Name)
- Regenerated outputs:
  - `backend/scripts/schema-mapping.json`
  - `backend/scripts/schema-mapping.md`
 - Ran backend typecheck (`npm run typecheck`) — succeeded with exit code 0.

## 2025-12-24 20:51:41 +08:00 — RBAC Architecture Walkthrough

- Mapped RBAC end-to-end across backend and frontend.
- Backend JWT carries `roles` decoded by auth middleware (`backend/src/middleware/auth.ts:27–36`).
- Route guards use `requireRole(["admin","superadmin"])` for admin endpoints (`backend/src/routes/rbac.ts:210`, `backend/src/routes/rbac.ts:681`).
- Policy functions define CRUD, user management, and report permissions (`backend/src/policy.ts:30–64`).
- Employees API enforces role CRUD and filters response sections using static policy + `role_column_access` (`backend/src/routes/employees.ts:11–27`, `backend/src/routes/employees.ts:1022–1079`).
- RBAC DB adapters support `role_permissions`, `role_column_access`, and `type_column_access` with schema normalization and fallbacks (`backend/src/routes/rbac.ts:44–114`, `backend/src/routes/rbac.ts:568–679`, `backend/src/routes/rbac.ts:181–239`).
- LDAP maps AD groups → roles via env (`backend/src/auth/ldap.ts:76–87`, `backend/src/config.ts:45–52`).
- Frontend computes capabilities from backend data and defaults (`src/lib/rbac.ts:177–214`) and exposes `canColumn` for per-field visibility.
- UI guards: `RequireAuth` protects routes; `RequireRole` restricts admin pages (`src/App.tsx:87–116`, `src/components/auth/RequireRole.tsx:10–35`).
- Admin UI to edit permissions and column/type access: `src/pages/AdminPermissions.tsx`.

## 2025-12-24 21:01:33 — Frontend Login Logging

- Added a log on app load when an auth session exists (`src/App.tsx:50–69`).
- Added a log on successful login (mock + AD) (`src/pages/Auth.tsx:72–136`).
- Log format: `<name> is logged in with role <role>`.

## 2025-12-24 22:21:54 +08:00 — Employee Detail Contact Visibility

- Fixed employee detail section filtering to respect `role_column_access` regardless of `can_read` vs `can_view` schema.
- This ensures roles with Contact column read access receive the `contact` section in `/api/employees/:id` responses.

