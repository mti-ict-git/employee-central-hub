## Goals & Scope

* One-direction sync from `EmployeeWorkflow.dbo.MTIUsers` (source) to `MTIMasterEmployeeDB` (destination).

* Identifier matching: `employee_id` or `StaffNo`.

* If a source user doesn’t exist in destination: add minimal destination records.

* If a destination user doesn’t exist in source: mark as “Not in RanHR” in UI.

## Environment Variables

Add source DB credentials to `.env` alongside existing destination DB vars:

* `SRC_DB_SERVER`

* `SRC_DB_DATABASE=EmployeeWorkflow`

* `SRC_DB_USER`

* `SRC_DB_PASSWORD`

* `SRC_DB_PORT=1433`

* `SRC_DB_ENCRYPT=false` (or true per infra)

* `SRC_DB_TRUST_SERVER_CERTIFICATE=true`
  Destination continues using existing `DB_*` vars.

## Data Mapping (Initial Default)

Source table: `EmployeeWorkflow.dbo.MTIUsers` → Destination tables/fields:

* Identity

  * `StaffNo` or `employee_id` → `employee_core.employee_id`

  * `employee_name` → `employee_core.name`

  * `gender` → `employee_core.gender` (M/F mapping if needed)

* Employment

  * `division` → `employee_employment.division`

  * `department` → `employee_employment.department`

  * `section` → `employee_employment.section`

  * `position_title` → `employee_employment.job_title`

  * `grade_interval` → `employee_employment.grade`

  * `day_type` → `employee_onboard.schedule_type` (or `employee_employment.schedule_type` if preferred)

* Contact

  * `phone` → `employee_contact.phone_number`

* Access/Badge (optional)

  * `CardNo` → `employee_core.id_card_mti` (boolean Y/N if presence) or store in notes

  * `AccessLevel`, `Name`, `FirstName`, `LastName` → `employee_notes` or auxiliary columns if required

* Work pattern (optional)

  * `time_in`, `time_out`, `next_day` → stored in `employee_notes` initially unless a destination field exists

Note: Ignore mapping when not available in destination column

## Sync Rules

* Match by `employee_id` if present, else `StaffNo` as fallback.

* Upsert per section:

  * Create missing destination `employee_core` row with `employee_id`, `name`, `gender`.

  * Update destination sections with non-empty source values.

  * Do not delete destination rows in a one-way sync.

* Missing in source (but present in destination): mark as `notInRanHR = true` in API responses for employee list and detail (derived flag), and show badge “Not in RanHR”. No DB deletion.

## Backend Implementation

* New source connection pool using `SRC_DB_*` envs.

* Service: `syncService` with steps:

  1. Load source users (paged) from `EmployeeWorkflow.dbo.MTIUsers`.
  2. Build index keyed by `employee_id/StaffNo`.
  3. For each source user:

     * Resolve destination record; upsert mapped fields into `employee_core`, `employee_employment`, `employee_contact`, `employee_onboard`.
  4. Compute set of destination employee\_ids not present in source; expose `notInRanHR` in API responses.

* Endpoints (admin-only):

  * `GET /api/sync/config` → { schedule, enabled, mapping }

  * `PUT /api/sync/config` → update schedule/mapping (persist in DB)

  * `POST /api/sync/run` → triggers sync, supports `{ dry_run?: boolean, limit?: number, offset?: number }`

  * `GET /api/sync/status` → last run summary (count added/updated/skipped/missing, errors)

* Persistence:

  * Table `sync_config` (singleton): schedule cron (e.g., `0 2 * * *`), enabled, mapping JSON.

  * Table `sync_runs`: id, started\_at, finished\_at, success, stats JSON, error, duration.

* Safety:

  * Transactions per employee upsert; batched commits.

  * Dry-run mode to preview effects.

  * Robust logging and error captures.

## UI Implementation

* New page: Settings → “Data Sync” (admin/superadmin only):

  * Show last run summary.

  * Configure schedule (cron), enable/disable.

  * Edit field mapping (table/column pairs) with sensible defaults.

  * Manual “Run Sync” button (with dry-run toggle).

* Employee List:

  * Add “Manual Sync” button near export.

  * Badge for employees flagged `Not in RanHR`.

* Reports (optional): add a simple “Sync Report” section listing added/updated/missing counts.

## Not in RanHR Flagging

* API layer adds `not_in_ranhr: boolean` when destination employee\_id not present in source index.

* UI displays a badge and optionally filters.

## Scheduling

* Use node cron (`node-cron`) or `setInterval` with persisted cron string.

* Scheduler reads `sync_config` on server start; runs when enabled.

* Protect with admin-only toggles.

## Testing & Rollout

* Dry-run sync in dev against a limited page size.

* Verify adds/updates on a sample set; validate mapping correctness.

* Enable schedule after manual verification.

* Add metrics in `sync_runs` for audit.

## Next Steps

* I will implement: source pool, sync service/endpoints, config persistence, UI page/buttons, and API-derived `not_in_ranhr` flag.

* Assumptions: the default mapping above; you can adjust mapping later in the Settings page.

