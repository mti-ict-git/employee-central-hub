

# Add "Anniversaries" Under Employee Management

## What changes

Add a new child menu item **"Anniversaries"** under the **Employee Management** collapsible group in the sidebar, linking to `/employees/anniversaries`.

## Sidebar update (`src/components/layout/Sidebar.tsx`)

Add to the `Employee Management` children array:

```text
Employee Management
  ├─ Employee List        /employees
  ├─ Add Employee         /employees/new
  ├─ Import Data          /employees/import
  └─ Anniversaries (NEW)  /employees/anniversaries   icon: Cake
```

No role restriction — visible to all users who can see Employee Management.

## New page placeholder

Create `src/pages/Anniversaries.tsx` with a placeholder layout matching the previously approved UX design (tabs for This Week / This Month / History, filters by type and department).

## Route registration (`src/App.tsx`)

Add route: `/employees/anniversaries` → `Anniversaries` page.

## Build error fix (`src/components/employees/EmployeeTable.tsx`)

Fix the three TypeScript errors:
- Remove `SyntheticListenerMap` import from `@dnd-kit/core`
- Fix mouse event type mismatches on lines 369 and 376

## Files modified

1. `src/components/layout/Sidebar.tsx` — add Anniversaries nav item
2. `src/pages/Anniversaries.tsx` — new page (scaffold with mock data)
3. `src/App.tsx` — add route
4. `src/components/employees/EmployeeTable.tsx` — fix build errors

