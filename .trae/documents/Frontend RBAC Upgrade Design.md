## Alignment With Existing Tables
- Existing tables: `roles`, `role_permissions`, `role_column_access`.
- Map to frontend models:
  - roles → list of role keys: `superadmin`, `admin`, `hr_general`, `finance`, `dep_rep`, `employee` (or DB canonical names)
  - role_permissions → per-role module actions: `{ module: 'employees'|'users'|'reports', action: 'read'|'create'|'update'|'delete'|'manage_users'|'export', allowed: boolean }`
  - role_column_access → per-role field access: `{ section: 'core'|'contact'|'employment'|'bank'|'insurance'|'onboard'|'travel'|'checklist'|'notes', column: string, read: boolean, write: boolean }`
- Frontend derives capabilities strictly from API data backed by these tables; no hard-coded policy beyond sensible defaults if API unavailable.

## Frontend Architecture
- Add `src/lib/rbac.ts` with types and transformers that consume API results and produce capability helpers.
- Add `useRBAC()` hook returning:
  - CRUD booleans for employees/users/reports
  - `readSections` and `writeSections` as Sets per role(s)
  - methods: `can(action, module)`, `canColumn(section, column, mode)`
- Add `<Can when={boolean}>...</Can>` component to gate UI elements.

## Pages and Gating
- Sidebar: hide links (Employees create/import, Settings→Users, Reports) using `useRBAC()`.
- EmployeeList: hide “Add Employee” and table actions (Edit/Delete) per permissions; reflect disabled state with tooltips.
- EmployeeDetail: hide sections not in `readSections`; hide “Edit” if no update.
- EditEmployee: show only tabs in `readSections`; render inputs read-only if column write is false; guard Save with update permission.
- UserManagement: route gated to roles with `manage_users`; inside page, disable actions targeting superadmin unless actor is superadmin; filter role options accordingly.
- Reports: show page when `read` allowed; disable Export when `export` false.
- New Admin Permissions page (read-only initially): matrix view mirroring your screenshot, powered by `role_permissions` data.
- Optional Column Access page: grid to visualize `role_column_access` by section/column with read/write indicators.

## API Integration (No Frontend Hard-coding)
- Expect backend endpoints (to be added server-side) that read existing tables:
  - `GET /api/rbac/roles` → list of roles
  - `GET /api/rbac/permissions` → role_permissions
  - `GET /api/rbac/columns` → role_column_access
- Frontend `useRBAC()` loads and caches this data; fallback to minimal safe defaults if fetch fails.

## Data Flow
- On login, frontend stores `auth_user.roles[]` (already done).
- `useRBAC()` pulls the DB-driven policy and computes effective capabilities for the user’s roles (union of allowed actions).
- UI gates based on these capabilities; server remains source-of-truth and will enforce.

## UX Details
- Tooltips explaining disabled actions due to permissions.
- Consistent badges or labels indicating current role(s) on header.
- Read-only fields styled with muted foreground to indicate non-editability.

## Testing
- Simulate roles by switching `auth_user.roles[]` and verify UI changes.
- Validate sections hidden/disabled per `role_column_access` for hr_general and finance as primary test cases.

## Deliverables
- `rbac.ts`, `useRBAC` hook, `Can` component.
- Updated Employees, Users, Reports pages with gating.
- Admin Permissions matrix page (read-only).

## Request for Confirmation
- Confirm role names in `roles` match our current set or provide mapping.
- Confirm `role_permissions` modules/actions naming so the UI can bind accurately.
- Confirm section mapping in `role_column_access` (by table/column) to UI sections listed above.
- Once confirmed, I will implement the frontend gating and pages, wired to those APIs.