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

## 2026-01-04 23:32:37 WIB — Local dev moved to port 8081

- Updated Vite dev server port to 8081 to avoid 8080 conflicts.
- Updated backend default `FRONTEND_URL` and allowed CORS origins to include 8081.

## 2025-12-24 23:16:57 — Employee Edit Permissions Hardening

- Fixed a double-commit bug in the employee update transaction (`backend/src/routes/employees.ts:618–641`).
- Normalized `type_column_access` and `role_column_access` column keys to lowercase in the frontend RBAC index to avoid case-mismatch permission leaks (`src/lib/rbac.ts:93–148`).

## 2025-12-24 23:30:36 — Edit Employee Crash Fix

- Fixed `EditEmployee` crashing when API omits nested sections (e.g. missing `employment`) by normalizing the fetched employee payload (`src/pages/EditEmployee.tsx:124–159`).

## 2025-12-24 23:47:22 — Department Rep Bank Write 403 Fix

- Fixed `PUT /api/employees/:id` write checks to support normalized `role_column_access` schemas (`backend/src/routes/employees.ts:66–180`).
- This unblocks per-column write permissions (e.g. `department_rep` editing `bank.*`) when RBAC is stored using `role_id` + `column_id` with `column_catalog` joins.

## 2025-12-25 00:11:12 — Department Rep Role Alias Support

- Fixed `PUT /api/employees/:id` RBAC write checks to accept `dep_rep` role rows as `department_rep` (`backend/src/routes/employees.ts:94–126`).

## 2025-12-25 00:30:51 — Integrity Checks

- Ran `npm run lint` (0 errors; warnings only).
- Ran `npx tsc --noEmit -p tsconfig.json` and `npm --prefix backend run typecheck` — passed.
- Ran `npm --prefix backend run build` — passed.

## 2025-12-25 09:01:57 — Department Rep Bank Write Fix

- Fixed `buildWriteAccess` to apply role filtering for normalized RBAC schema (`role_id`/`column_id`) and include `dep_rep` alias (`backend/src/routes/employees.ts:94–164`).
- Ran `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, and `npm --prefix backend run typecheck` — passed.

## 2025-12-25 09:26:28 +08:00 — Employment Status Constraint Alignment

- Confirmed DB check constraint for `employee_employment.employment_status` and allowed values.
- Normalized `employment_status` on write and return a clear `400` for invalid values (`backend/src/routes/employees.ts`).
- Updated frontend enums/options to match backend constraint (`src/lib/employeeSchema.ts`, `src/pages/EditEmployee.tsx`, `src/components/employees/form/EmploymentStep.tsx`).
- Updated CSV template samples and mock data to use canonical values (`src/lib/csvTemplates.ts`, `src/data/mockEmployees.ts`).

## 2025-12-25 10:04:38 â€” Column Access Employment Status Group Fix

- Moved `employment_status` mapping to `employee_employment` so it appears under Employment in Column Access (`backend/scripts/dbinfo-mapping.json`).
- Kept legacy column-write permissions working by honoring existing Onboarding grants for `employment_status` updates (`backend/src/routes/employees.ts`).

## 2025-12-25 10:44:13 +08:00 â€” Employment Status Column RBAC Enforcement

- Enforced per-column read filtering for Employee Details via `role_column_access` and type rules (`backend/src/routes/employees.ts`).
- Limited legacy `employment_status` write fallback to cases without an explicit Employment column rule (`backend/src/routes/employees.ts`).
- Normalized Column Access section labels and expanded HR role alias normalization (`src/pages/ColumnAccess.tsx`, `src/hooks/useRBAC.ts`, `src/lib/rbac.ts`).

## 2025-12-25 11:34:05 — Employment Status RBAC Leak Fix

- Fixed `employment_status` read/write gating to honor an explicit Onboard deny when no Employment column rule exists (`backend/src/routes/employees.ts:717–742`, `backend/src/routes/employees.ts:1429–1453`).
- This prevents `hr_general` users from seeing `employment.employment_status` in `GET /api/employees/:id` when Column Access disabled it under Onboarding.

## 2025-12-25 13:36:00 +08:00 — Employee Detail Employment Status UI Hide

- Hid the Employment Status row when the API omits `employment.employment_status` due to RBAC (`src/pages/EmployeeDetail.tsx:358–368`).
- Rechecked `hr_general` API response: `employment_status` is not present in `GET /api/employees/:id` payload.

## 2026-01-05 09:01:34 WIB — Dashboard Accurate Employee Counts

- Added `GET /api/employees/stats` to compute total/active/inactive/indonesia/expat using DB aggregates and department-rep scoping (`backend/src/routes/employees.ts`).
- Updated Dashboard to fetch stats from the new endpoint while keeping employee list fetch limited to 500 (`src/pages/Index.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-01-05 09:15:13 WIB — Dashboard Full Department Distribution

- Extended `GET /api/employees/stats` to return department counts from the database (`backend/src/routes/employees.ts`).
- Updated Dashboard Department Distribution to render the backend department list (not the first 500 employees) (`src/pages/Index.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-01-05 10:45:11 WIB — Employee Detail 500 Fix (Missing Column-Access Tables)

- Prevented `GET /api/employees/:id` from failing when `dbo.column_access_assignments` / `dbo.column_access_templates` tables are missing (`backend/src/routes/employees.ts`).
- Improved Employee Detail page to surface API error messages instead of only `HTTP_<status>` (`src/pages/EmployeeDetail.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-01-05 12:15:21 WIB — Theme Preference (Dark/Light/System) Saved to User Profile

- Added global theme support via `next-themes` ThemeProvider (`src/main.tsx`).
- Loaded saved theme from `GET /api/users/me/preferences?key=theme` on app start (`src/App.tsx`).
- Wired Settings > Preferences > Theme to apply instantly and save to DB via `PUT /api/users/me/preferences` (`src/pages/Settings.tsx`).

## 2026-01-05 12:38:56 WIB — Cleanup and Integrity Check

- Removed `any` usage in Reports route parsing and made row parsing safer (`backend/src/routes/reports.ts`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-01-05 14:30:28 WIB — Switchable Theme + Color Palette Preferences

- Added a header theme toggle (Light/Dark) that persists to user preferences (`src/components/layout/Header.tsx`).
- Added Color Palette selection under Settings → Preferences and persisted it as `palette` (`src/pages/Settings.tsx`).
- Applied saved palette globally on app start and added palette CSS tokens (`src/App.tsx`, `src/index.css`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 19:59:27 WITA — Collapsible Sidebar Menus

- Made Employee Management and Settings groups expandable/collapsible from the sidebar (`src/components/layout/Sidebar.tsx`).
- Added tooltips for collapsed sidebar items to keep navigation usable (`src/components/layout/Sidebar.tsx`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 20:06:08 WITA — Sidebar Uniform Font & Alignment

- Unified all nav items (group headers and child links) to use `text-sm` for consistent font sizing across the sidebar.
- Aligned group header text inside the flex container using a consistent `text-sm font-medium` class; the uppercase label styling was moved to an inner `<span>` so it doesn't affect the parent button's vertical alignment.
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 20:08:27 WITA — Sidebar Alignment Refinement

- Standardized row heights and line-heights for top-level links, group headers, and child items (`src/components/layout/Sidebar.tsx`).
- Unified icon sizing and prevented group title wrapping to keep icon/text/chevron alignment consistent.
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 20:39:58 WITA — SharePoint Sync Settings (Graph Device Code)

- Added SharePoint Sync configuration UI under Settings → Data Sync with fields for tenant/client/site/file and polling settings (`src/pages/SyncSettings.tsx`).
- Extended sync configuration API to persist `sharepoint` JSON in `dbo.sync_config` and return it from `GET /api/sync/config` (`backend/src/routes/sync.ts`).
- Added migration-safe schema handling for `sync_config.sharepoint` column creation when missing (`backend/src/routes/sync.ts`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 20:50:29 WITA — SharePoint Device Code Generation Endpoint

- Added `POST /api/sync/sharepoint/device-code` to request Microsoft login device code using configured tenant/client and delegated `Files.Read` scope (`backend/src/routes/sync.ts`).
- Updated Data Sync UI to generate and display `user_code`, verification URL, expiry, and copy action so the system provides the code directly (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 20:53:39 WITA — SharePoint Sync Save Button

- Added an explicit **Save SharePoint Settings** button in SharePoint Sync section to persist config before generating device code (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 20:56:23 WITA — SharePoint Save Reliability Fix

- Added dedicated SharePoint config endpoints (`GET/PUT /api/sync/config/sharepoint`) to isolate SharePoint persistence from general sync settings (`backend/src/routes/sync.ts`).
- Updated SharePoint Save button to use the dedicated endpoint with loading state and forced reload after save (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 21:01:01 WITA — SharePoint Save Backward-Compatibility Fallback

- Added frontend fallback: if `PUT /api/sync/config/sharepoint` is unavailable (404/405), save automatically falls back to `PUT /api/sync/config` with SharePoint payload (`src/pages/SyncSettings.tsx`).
- This prevents save failures when backend route version lags behind frontend deployment.
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 21:07:28 WITA — SharePoint Auth Listener + Connection Tester

- Added `POST /api/sync/sharepoint/auth-status` to exchange device code and verify Graph/SharePoint access, returning state (`PENDING`, `CONNECTED`, `FAILED`) (`backend/src/routes/sync.ts`).
- Added UI controls for **Check Connection** and **Start Listener/Stop Listener** with live status text (`ESTABLISHED` when connected) in Data Sync (`src/pages/SyncSettings.tsx`).
- Added file-access verification against configured site/drive/path after successful token exchange to confirm document load connectivity (`backend/src/routes/sync.ts`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 21:17:49 WITA — Auth Status Error Normalization

- Normalized SharePoint auth-status API responses so expected auth/config issues return structured state (`PENDING`/`FAILED`) instead of HTTP 400/502 where possible (`backend/src/routes/sync.ts`).
- Improved failure details from Microsoft Graph/Azure responses so UI shows actionable error text (invalid client, site resolve failed, file access failed, etc.) (`backend/src/routes/sync.ts`).
- Updated frontend connection checker to surface backend `message` details and stabilize callback/listener dependencies (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 21:47:18 WITA — Simplified Share-Link Download for Review

- Added support for storing `share_url` in SharePoint sync config so the real shared file link can be saved and reused (`src/pages/SyncSettings.tsx`, `backend/src/routes/sync.ts`).
- Added `POST /api/sync/sharepoint/download-file` to exchange device code, resolve Graph share link, download file bytes, and save the file locally under `storage/sharepoint-review` for review (`backend/src/routes/sync.ts`).
- Added UI fields/actions: **Shared File URL (Actual link)** and **Download File For Review**, including downloaded file metadata and local saved path display (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 21:54:09 WITA — Share URL Persistence + Simpler UI

- Prevented share URL from being cleared after save by applying returned payload defensively and preserving current value when backend response omits `share_url` (`src/pages/SyncSettings.tsx`).
- Simplified SharePoint form: moved Site URL / Drive ID / File Path under optional advanced section, leaving main flow focused on Tenant ID + Client ID + Shared File URL (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 21:57:26 WITA — Persist Share URL with Frontend Fallback

- Added local fallback persistence for SharePoint shared URL using `localStorage` key `sync_sharepoint_share_url` to avoid losing the field when backend response/version omits `share_url` (`src/pages/SyncSettings.tsx`).
- Load now hydrates shared URL from database first, then local fallback if database value is empty (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-20 22:02:51 WITA — Fix Device Code Already Redeemed on Download

- Added backend token cache column `sharepoint_auth` in `dbo.sync_config` to store access/refresh token and expiry for SharePoint sync (`backend/src/routes/sync.ts`).
- `auth-status` now saves token cache after successful device-code exchange so follow-up actions do not redeem the same device code again (`backend/src/routes/sync.ts`).
- `download-file` now uses cached valid token first, then refresh-token flow, and only falls back to device-code exchange when needed (`backend/src/routes/sync.ts`).
- Added explicit handling for already-redeemed device code (`AADSTS54005`/invalid_grant) to return a clear pending message instead of hard failure (`backend/src/routes/sync.ts`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-20 22:10:45 WITA — Align Check Connection with Cached Auth

- Updated `POST /api/sync/sharepoint/auth-status` to use cached access token first, then refresh token, then fallback to device-code exchange (`backend/src/routes/sync.ts`).
- Removed strict requirement for always providing fresh `device_code` in check flow; now returns `PENDING` reauth message only when cache is unusable and no valid code is available (`backend/src/routes/sync.ts`).
- Added share-link based connection validation in auth-status when `share_url` is configured, making Check Connection useful for simple shared-link flow (`backend/src/routes/sync.ts`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 07:46:52 WITA — Restart-Safe SharePoint Action Buttons

- Exposed auth-cache availability in sync config APIs (`sharepoint_auth_cached`, `sharepoint_auth_expires_at`) so frontend can detect persisted auth after app restart (`backend/src/routes/sync.ts`).
- Updated Check Connection / Start Listener / Download button enable logic to allow actions when auth cache exists, even if in-memory device code is empty after refresh (`src/pages/SyncSettings.tsx`).
- Removed hard backend requirement for `device_code` in download flow when cached/refresh token can be used (`backend/src/routes/sync.ts`).
- Added UI status line for auth cache availability to make token state explicit (`src/pages/SyncSettings.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 08:22:16 WITA — Fixed Download Output Filename

- Changed SharePoint review download to always overwrite the same local file: `storage/sharepoint-review/sharepoint-review.xlsx` for consistent downstream processing (`backend/src/routes/sync.ts`).
- API response now returns `file_name` as fixed filename and `source_file_name` as original SharePoint item name (`backend/src/routes/sync.ts`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 14:04:51 WITA — Future-Ready Mapping Placeholders

- Added unresolved mapping placeholders for future Excel columns (office email, month of birthday, bank/insurance/travel extras, etc.) in the master mapping JSON so HR can fill them when available (`backend/scripts/schema-mapping-final.json`).
- Updated mapping summary counts to reflect new unresolved entries (`backend/scripts/schema-mapping-final.json`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-21 14:11:57 WITA — Mapping Cleanup

- Removed duplicate placeholder entries in schema-mapping JSON while keeping unique future columns (ID Card MTI, Residen, ICBC Bank Account No, Owlexa No, Name as Passport, Job Title KITAS) (`backend/scripts/schema-mapping-final.json`).
- Recomputed mapping summary counts after cleanup (`backend/scripts/schema-mapping-final.json`).
- Ran `npm run lint` and `npx tsc --noEmit` — passed (warnings only).

## 2026-03-21 14:23:58 WITA — SharePoint Mapping Reference File

- Generated `backend/scripts/sharepoint-mapping.json` from “Master Data - Database Schema Proposed - Rev. 002.xlsx” Sheet2 (ignored last two columns) to provide exact Excel header mapping reference for SharePoint sync.
- SharePoint config save now loads this mapping file into `dbo.sync_config.mapping` when SharePoint sync is enabled (`backend/src/routes/sync.ts`).
- Updated README to document mapping reference location (`README.md`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 14:43:03 WITA — Mapping Preview UI

- Added `GET /api/sync/sharepoint/mapping-preview` endpoint to serve mapping JSON for UI review (`backend/src/routes/sync.ts`).
- Added SharePoint Mapping Preview section to Data Sync page with group selector and unmapped count (`src/pages/SyncSettings.tsx`).
- Updated README with mapping preview endpoint (`README.md`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 15:02:21 WITA — SharePoint Sync Run + Source Selector

- Added `POST /api/sync/run-sharepoint` to read the downloaded Excel file, apply mapping, and upsert employee tables (`backend/src/routes/sync.ts`).
- Added sync source selector (RanHR vs SharePoint) to Employee List Sync button (`src/pages/EmployeeList.tsx`).
- Updated README with SharePoint sync run endpoint (`README.md`).

## 2026-03-21 15:18:17 WITA — Employee List Sync Progress

- Added running state and elapsed time indicator for manual sync in Employee List (shows “Sync running” badge and disables button while running) (`src/pages/EmployeeList.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 15:23:40 WITA — Sync UI Error Fixes

- Fixed missing Badge import in Employee List to prevent runtime ReferenceError (`src/pages/EmployeeList.tsx`).
- Moved drag-and-drop context wrapper outside of table markup to resolve invalid DOM nesting warning (`src/components/employees/EmployeeTable.tsx`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 16:00:40 WITA — SharePoint Sync File Path Fix

- Fixed SharePoint sync run file path to avoid duplicate `backend/` segment when resolving `sharepoint-review.xlsx` (`backend/src/routes/sync.ts`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).

## 2026-03-21 16:06:11 WITA — Dashboard Active/Inactive Logic

- Updated employee stats calculation to use `employee_employment.employment_status` with fallback to `employee_employment.status` for active count (`backend/src/routes/employees.ts`).
- Ran `npm run lint`, `npx tsc --noEmit`, and `npm --prefix backend run typecheck` — passed (warnings only).
