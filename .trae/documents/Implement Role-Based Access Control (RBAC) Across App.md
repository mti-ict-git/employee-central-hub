## Current Position
- Frontend: page-level gating only at `/settings/users` via `RequireRole`. Most actions and pages are accessible if authenticated.
- Role data: UI stores a single `role` (primary), backend JWT includes `roles[]` from AD or local DB.
- Backend: no authorization middleware; employee and user routes accept any authenticated requests; no field/column filtering.
- Reports: no dedicated routes or RBAC.

## RBAC Objectives
1. Employee Management: enforce Read/Create/Update/Delete per role.
2. Column Access: per-role field visibility and mutability, server-enforced.
3. User Management: superadmin full control; admin manages everyone except superadmin, can create admins; others no access.
4. Reports: per-role access and export rights.

## Roles
- `superadmin`, `admin`, `hr_general`, `finance`, `dep_rep`, `employee` (optional viewer)
- No implicit inheritance; permissions are explicit per role.

## Permission Matrix (Administration Module)
- Read / Create / Update / Delete / Manage Users
- superadmin: on for all
- admin: Read on; Create/Update on; Delete off; Manage Users on (except superadmin targets)
- hr_general: Read on; Create/Update off; Delete off; Manage Users off
- finance: Read on; Create/Update off; Delete off; Manage Users off
- dep_rep: Read on; rest off
- employee: Read on (limited UI); rest off

## Column/Section Policies (Employee record)
Define per-section read/write by role:
- Sections: `core`, `contact`, `employment`, `bank`, `insurance`, `onboard`, `travel`, `checklist`, `notes`
- superadmin: read/write all
- admin: read/write all (except destructive ops if we choose to restrict delete)
- hr_general: read `core, contact, employment, onboard, checklist, notes`; write `contact, employment, notes`
- finance: read `core, bank, insurance`; write `bank, insurance`
- dep_rep: read `core, employment`; write none
- employee: read `core` (self) if enabled; write none
Server returns filtered fields on GET and rejects/ignores disallowed fields on write.

## Backend Design
- Add `authMiddleware` to validate JWT, attach `req.user` (`id`, `roles[]`).
- Add `requireRole(roles)` and `requirePermission(action, module)` helpers.
- Implement `policy.ts`:
  - `can(action, module, user)` for CRUD and manage-users.
  - `employeeFieldPolicy[role] = { read: Set<string>, write: Set<string> }` per-section.
  - `canManageUsers(actorRole, targetRole)` and `canCreateRole(actorRole, newRole)`.
- Apply to routes:
  - Employees: GET filter payload; POST/PUT/PATCH allow only writable fields; DELETE guarded by `can('delete','employees')`.
  - Users: route-level checks; block any operation on `superadmin` unless actor is `superadmin`; allow admin to create admins, but not superadmins.
  - Reports: `GET /api/reports/:id` and `GET /api/reports/:id/export` gated by `canAccessReport`, `canExportReport`.
- Add audit logging for user management and employee writes (who, when, fields changed).

## Storage Options
- Code-defined JSON config (fast to ship):
```json
{
  "permissions": {
    "superadmin": {"employees": {"read": true, "create": true, "update": true, "delete": true}, "manageUsers": true},
    "admin": {"employees": {"read": true, "create": true, "update": true, "delete": false}, "manageUsers": true},
    "hr_general": {"employees": {"read": true, "create": false, "update": false, "delete": false}},
    "finance": {"employees": {"read": true}},
    "dep_rep": {"employees": {"read": true}},
    "employee": {"employees": {"read": true}}
  },
  "employeeFieldPolicy": {
    "hr_general": {"read": ["core","contact","employment","onboard","checklist","notes"], "write": ["contact","employment","notes"]},
    "finance": {"read": ["core","bank","insurance"], "write": ["bank","insurance"]}
  }
}
```
- DB-driven (for ops control): tables `rbac_role`, `rbac_permission`, `rbac_role_permission`, `rbac_field_policy`. Cache in memory with periodic refresh.

## Frontend Changes
- Use JWT `roles[]` (not just single role) to compute capabilities; keep `primaryRole` for display.
- Gate page routes and buttons with capabilities: hide Create/Update/Delete where not allowed.
- Column-level UI: use the same `employeeFieldPolicy` map to hide inputs and read-only fields client-side; backend remains source of truth.
- Add an admin UI page “System Administration Permissions” (like your image) to view/edit policies when DB-driven.

## Reports RBAC
- Catalog reports with IDs and required roles/permissions.
- Enforce in backend; reflect in UI (hide tabs/links and export buttons per role).

## Implementation Steps
1. Middleware and helpers.
2. Policy module with CRUD and field rules.
3. Integrate policy into employees and users routes; add audit logging.
4. Reports router with RBAC checks.
5. Frontend: adopt `roles[]`, gate actions, and apply column visibility.
6. Optional: build admin policy editor (DB-backed), seed roles/permissions.

## Confirmation
- Confirm the permission toggles per role (matrix above).
- Confirm section read/write lists per role, especially hr_general and finance.
- Decide code-defined vs DB-driven policies for first version.
- Confirm audit log requirements and retention.
