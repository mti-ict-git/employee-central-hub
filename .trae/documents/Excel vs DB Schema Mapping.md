## Goal
- Treat the Excel sheet (`DB Schema`) as the single source of truth and produce a mapping containing all Excel-defined fields (target count: 97 rows), showing whether each one exists in the current database schema.

## Key Changes
- Make the mapping Excel-centric: one mapping row per Excel field, regardless of whether a table is present in the DB.
- Do not drop rows without a table; include them with `status=table_missing`.
- Improve header detection to account for variations like:
  - `Column Name`, `Excel Column Name`, `Name`
  - `Existing Table Name`, `Existing Table`
  - `Mapping to Existing DB Schema`, `Column Mapping to Existing DB Schema`
- Add global suggestions when table is missing or column is not found:
  - For a given column name, search all tables and list the top 3 candidate `(table.column)` matches with similarity scores.

## Approach
1. Parse Excel rows using flexible header resolution and normalize values.
2. Build mapping entries for every Excel row:
   - `excel`: `schema` (default `dbo`), `table` (from mapping or existing table), `column` (from mapping or Excel column name), `excelName`, `usedColumnHeader`, `usedTableHeader`.
   - Attempt matches against `backend\scripts\schema.json`.
   - `status`: `column_matched | column_missing | table_only | table_missing`.
   - `suggestion`: include up to top 3 suggestions when not matched, with scores.
3. Produce outputs:
   - JSON: `backend\scripts\schema-mapping.json` (exactly 97 rows if the Excel has 97)
   - Markdown: `backend\scripts\schema-mapping.md` with summary counts focused on Excel coverage.

## Handling Multi-Table Inputs
- For entries like `employee_id` that reference multiple tables in Excel, either:
  - Split into separate logical rows per table programmatically, or
  - Keep a single row and include multiple suggestions per table; prefer splitting to preserve row count and clarity.

## Verification
- Confirm total rows equals 97 and report summary: counts for each `status`.
- Spot-check critical fields (e.g., `employee_core.name`, `employee_employment.department`, `employee_travel.passport_no`).
- Ensure unmatched entries carry useful suggestions to guide investigation.

## Deliverables
- Updated `schema-mapping.json` and `schema-mapping.md` reflecting all 97 Excel rows, clearly marking any not present in the database.
- Optional CSV export for stakeholders.

## Execution Steps
1. Ensure `backend\scripts\schema.json` exists and is current; update if needed.
2. Enhance the existing script to:
   - Flexible header resolution.
   - Do not skip missing-table rows.
   - Add global suggestion search and multi-suggestion output.
   - Split multi-table rows.
3. Regenerate the mapping and share the artifacts for review.