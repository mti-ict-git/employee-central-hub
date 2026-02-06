import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Columns } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Employee, EmployeeCore, EmployeeContact, EmployeeEmployment, EmployeeBank, EmployeeInsurance, EmployeeOnboard, EmployeeTravel, EmployeeChecklist, EmployeeNotes, EmployeeType } from "@/types/employee";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { apiFetch } from "@/lib/api";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchColumnAccess } from "@/lib/rbac";

type EmployeeListAPIItem = {
  core?: Partial<EmployeeCore>;
  contact?: Partial<EmployeeContact>;
  employment?: Partial<EmployeeEmployment>;
  onboard?: Partial<EmployeeOnboard>;
  bank?: Partial<EmployeeBank>;
  insurance?: Partial<EmployeeInsurance>;
  travel?: Partial<EmployeeTravel>;
  checklist?: Partial<EmployeeChecklist>;
  notes?: Partial<EmployeeNotes>;
  type?: EmployeeType;
};

const EmployeeList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [remoteEmployees, setRemoteEmployees] = useState<Employee[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { caps, typeAccess, ready: rbacReady } = useRBAC();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(["core.employee_id","core.name","type","employment.department","employment.job_title","employment.status"]);
  const [colSearch, setColSearch] = useState("");
  const [allowedColumns, setAllowedColumns] = useState<Array<{ key: string; section: string; column: string; label: string }>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const preferredColumnOrder = useMemo(
    () => [
      "core.employee_id",
      "core.imip_id",
      "core.name",
      "core.gender",
      "core.place_of_birth",
      "core.date_of_birth",
      "core.age",
      "core.marital_status",
      "core.tax_status",
      "core.religion",
      "core.nationality",
      "core.blood_type",
      "contact.phone_number",
      "contact.emergency_contact_phone",
      "contact.email",
      "core.office_email",
      "core.ktp_no",
      "contact.address",
      "contact.city",
      "onboard.point_of_hire",
      "employment.locality_status",
      "onboard.point_of_origin",
      "core.education",
      "onboard.schedule_type",
      "onboard.first_join_date_merdeka",
      "onboard.transfer_merdeka",
      "onboard.first_join_date",
      "onboard.join_date",
      "employment.employment_status",
      "onboard.end_contract",
      "onboard.years_in_service",
      "core.branch_id",
      "core.branch",
      "employment.division",
      "employment.department",
      "employment.section",
      "employment.direct_report",
      "employment.job_title",
      "employment.position_grade",
      "employment.group_job_title",
      "employment.grade",
      "insurance.insurance_endorsement",
      "insurance.insurance_fpg",
      "insurance.insurance_owlexa",
      "contact.spouse_name",
      "contact.child_name_1",
      "contact.child_name_2",
      "contact.child_name_3",
      "core.kartu_keluarga_no",
      "bank.bank_name",
      "bank.account_name",
      "bank.account_no",
      "core.npwp",
      "insurance.social_insurance_no_alt",
      "insurance.bpjs_kes",
      "insurance.bpjs_kes_no_alt",
      "insurance.status_bpjs_kes",
      "insurance.fpg_no",
      "insurance.owlexa_no",
      "core.month_of_birthday",
    ],
    [],
  );
  const preferredOrderIndex = useMemo(() => new Map(preferredColumnOrder.map((key, index) => [key, index])), [preferredColumnOrder]);
  const orderColumns = useCallback((keys: string[]) => {
    const unique = Array.from(new Set(keys));
    return unique.sort((a, b) => {
      const ai = preferredOrderIndex.get(a);
      const bi = preferredOrderIndex.get(b);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [preferredOrderIndex]);

  const minTableWidth = useMemo(() => Math.max(1000, (visibleColumns?.length || 0) * 160 + 480), [visibleColumns]);
  const allowedKeySet = useMemo(() => new Set(allowedColumns.map((d) => d.key)), [allowedColumns]);
  const totalPages = useMemo(() => {
    if (!serverTotal || serverTotal <= 0) return 1;
    return Math.max(1, Math.ceil(serverTotal / pageSize));
  }, [serverTotal, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = useMemo(() => {
    const total = totalPages;
    const current = page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const items: Array<number | "ellipsis"> = [];
    const push = (value: number | "ellipsis") => {
      if (items[items.length - 1] === value) return;
      items.push(value);
    };
    push(1);
    if (current > 3) push("ellipsis");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) push(i);
    if (current < total - 2) push("ellipsis");
    push(total);
    return items;
  }, [page, totalPages]);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;
    let syncing = false;
    const syncFromTop = () => {
      if (syncing) return;
      syncing = true;
      body.scrollLeft = top.scrollLeft;
      syncing = false;
    };
    const syncFromBody = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = body.scrollLeft;
      syncing = false;
    };
    top.addEventListener("scroll", syncFromTop);
    body.addEventListener("scroll", syncFromBody);
    return () => {
      top.removeEventListener("scroll", syncFromTop);
      body.removeEventListener("scroll", syncFromBody);
    };
  }, [visibleColumns]);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelected(new Set());
        setRemoteEmployees([]);
        setServerTotal(null);
        const reqCols = visibleColumns.filter((c) => c !== "type").join(",");
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));
        if (reqCols) params.set("columns", reqCols);
        const q = search.trim();
        if (q) params.set("q", q);
        if (typeFilter !== "all") params.set("type", typeFilter);
        const res = await apiFetch(`/employees?${params.toString()}`, { signal: ctrl.signal, credentials: "include" });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const items: Employee[] = (data.items || []).map((e: EmployeeListAPIItem) => {
          const employeeId = String(e.core?.employee_id ?? "");
          const name = String(e.core?.name ?? "");
          const gender = (e.core?.gender ?? "Male") as "Male" | "Female";
          const core: EmployeeCore = {
            employee_id: employeeId,
            name,
            gender,
            ...((e.core || {}) as Partial<EmployeeCore>),
          };
          const contact: EmployeeContact = {
            employee_id: employeeId,
            ...((e.contact || {}) as Partial<EmployeeContact>),
          };
          const employment: EmployeeEmployment = {
            employee_id: employeeId,
            ...((e.employment || {}) as Partial<EmployeeEmployment>),
          };
          const onboard: EmployeeOnboard = {
            employee_id: employeeId,
            ...((e.onboard || {}) as Partial<EmployeeOnboard>),
          };
          const bank: EmployeeBank = {
            employee_id: employeeId,
            ...((e.bank || {}) as Partial<EmployeeBank>),
          };
          const insurance: EmployeeInsurance = {
            employee_id: employeeId,
            ...((e.insurance || {}) as Partial<EmployeeInsurance>),
          };
          const travel: EmployeeTravel = {
            employee_id: employeeId,
            ...((e.travel || {}) as Partial<EmployeeTravel>),
          };
          const checklist: EmployeeChecklist = {
            employee_id: employeeId,
            ...((e.checklist || {}) as Partial<EmployeeChecklist>),
          };
          const notes: EmployeeNotes = {
            employee_id: employeeId,
            ...((e.notes || {}) as Partial<EmployeeNotes>),
          };
          const typeById = (() => {
            const up = employeeId.toUpperCase();
            if (up.startsWith("MTIBJ")) return "expat";
            if (up.startsWith("MTI")) return "indonesia";
            return undefined;
          })();
          const typeServer = e.type === "indonesia" ? "indonesia" : "expat";
          const out: Employee = {
            core,
            contact,
            employment,
            onboard,
            bank,
            insurance,
            travel,
            checklist,
            notes,
            type: typeById || typeServer,
          };
          return out;
        });
        if (cancelled) return;
        setRemoteEmployees(items);
        const total = Number(data?.paging?.total ?? NaN);
        if (!isNaN(total)) {
          setServerTotal(total);
        } else {
          setServerTotal(null);
        }
      } catch (err: unknown) {
        const aborted =
          cancelled ||
          ctrl.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (aborted) return;
        setError(err instanceof Error ? err.message : "FAILED_TO_FETCH_EMPLOYEES");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [visibleColumns, search, typeFilter, page, pageSize]);

  useEffect(() => {
    const ctrl = new AbortController();
    const toTitle = (s: string) => s.replace(/[-_]+/g, " ").split(" ").filter(Boolean).map((w) => w[0] ? w[0].toUpperCase() + w.slice(1) : "").join(" ");
    const canonical = (section: string) => {
      let raw = String(section || "").trim();
      if (raw.includes(".")) raw = raw.split(".").pop() || raw;
      const lower = raw.toLowerCase();
      if (lower.startsWith("dbo ")) raw = raw.slice("dbo ".length);
      if (lower.startsWith("dbo_")) raw = raw.slice("dbo_".length);
      const withoutEmployeeWord = raw.startsWith("Employee ") ? raw.slice("Employee ".length) : raw;
      const trimmed = withoutEmployeeWord.trim();
      const lowered = trimmed.toLowerCase();
      if (lowered.startsWith("employee_")) return trimmed.slice("employee_".length).trim().toLowerCase();
      if (lowered.startsWith("employee ")) return trimmed.slice("employee ".length).trim().toLowerCase();
      return lowered;
    };
    const run = async () => {
      try {
        if (!rbacReady || !caps) return;
        const rows = await fetchColumnAccess();
        let mappingKeys: Set<string> | null = null;
        try {
          const mappingRes = await apiFetch(`/mapping/dbinfo`, { signal: ctrl.signal, credentials: "include" });
          const mappingData = await mappingRes.json().catch(() => []);
          if (mappingRes.ok) {
            const mappingRows = Array.isArray(mappingData) ? mappingData : [];
            const next = new Set<string>();
            for (const row of mappingRows) {
              const tableRaw = String(row?.excel?.table || row?.matched?.table || "");
              const columnRaw = String(row?.excel?.column || row?.matched?.column || "");
              const secKey = canonical(tableRaw);
              const colKey = String(columnRaw || "").trim().toLowerCase();
              if (!secKey || !colKey) continue;
              next.add(`${secKey}.${colKey}`);
            }
            mappingKeys = next;
          }
        } catch (e) { void e; }
        const set = new Set<string>();
        const defs: Array<{ key: string; section: string; column: string; label: string }> = [];
        const ensure = (key: string, section: string, column: string, label: string) => {
          if (set.has(key)) return;
          set.add(key);
          defs.push({ key, section, column, label });
        };
        for (const r of rows) {
          const secKey = canonical(r.section);
          const colKey = String(r.column || "").trim().toLowerCase();
          if (!caps.canColumn(secKey, colKey, "read")) continue;
          const dotted = `${secKey}.${colKey}`;
          if (mappingKeys && !mappingKeys.has(dotted)) continue;
          const label = `${toTitle(secKey)} • ${toTitle(colKey)}`;
          ensure(dotted, secKey, colKey, label);
        }
        ensure("core.employee_id", "core", "employee_id", "Core • Employee ID");
        ensure("core.name", "core", "name", "Core • Name");
        ensure("employment.department", "employment", "department", "Employment • Department");
        ensure("employment.job_title", "employment", "job_title", "Employment • Job Title");
        ensure("employment.status", "employment", "status", "Employment • Status");
        ensure("type", "core", "type", "Type");
        const orderedDefs = orderColumns(defs.map((d) => d.key)).map((key) => defs.find((d) => d.key === key)).filter(Boolean) as Array<{ key: string; section: string; column: string; label: string }>;
        setAllowedColumns(orderedDefs);
      } catch (e) { void e; }
    };
    run();
    return () => ctrl.abort();
  }, [rbacReady, caps, orderColumns]);

  useEffect(() => {
    if (!allowedColumns.length) return;
    const filtered = visibleColumns.filter((col) => col === "type" || allowedKeySet.has(col));
    const hasType = filtered.includes("type");
    const fallbackBase = ["core.employee_id","core.name"];
    const ordered = orderColumns(filtered.filter((col) => col !== "type"));
    const nextBase = ordered.length ? ordered : orderColumns(fallbackBase);
    const next = hasType ? nextBase.concat("type") : nextBase;
    const same = next.length === visibleColumns.length && next.every((val, idx) => val === visibleColumns[idx]);
    if (same) return;
    setVisibleColumns(next);
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const res = await apiFetch(`/users/me/preferences`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "employee_list_columns", value: next }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
      } catch (e) { void e; }
    };
    run();
    return () => ctrl.abort();
  }, [allowedColumns, allowedKeySet, visibleColumns, orderColumns]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const prefRes = await apiFetch(`/users/me/preferences?key=employee_list_columns`, { signal: ctrl.signal, credentials: "include" });
        if (!prefRes.ok) return;
        const prefs = await prefRes.json().catch(() => ({}));
        const cols = Array.isArray(prefs?.employee_list_columns) ? (prefs.employee_list_columns as string[]) : null;
        const defaults = ["core.employee_id","core.name","type","employment.department","employment.job_title","employment.status"];
        const next = (() => {
          if (cols && cols.length) {
            const migrated = cols.map((c) => {
              if (c === "employee_id") return "core.employee_id";
              if (c === "name") return "core.name";
              if (c === "department") return "employment.department";
              if (c === "job_title") return "employment.job_title";
              if (c === "status") return "employment.status";
              return c;
            });
            const sanitized = migrated.filter((c) => typeof c === "string" && c.length > 0);
            return sanitized.length ? sanitized : defaults;
          }
          return defaults;
        })();
        setVisibleColumns(next);
      } catch (e: unknown) { void e; }
    };
    run();
    return () => ctrl.abort();
  }, []);

  const filteredEmployees = useMemo(() => {
    const list = remoteEmployees.filter((employee) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          employee.core.name.toLowerCase().includes(searchLower) ||
          employee.core.employee_id.toLowerCase().includes(searchLower) ||
          employee.employment.department?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && employee.type !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const isActive = employee.employment.status === 'Active';
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }

      return true;
    });
    // Clean selection if filtered out
    const nextSelected = new Set(selected);
    for (const id of nextSelected) {
      if (!list.find((e) => e.core.employee_id === id)) {
        nextSelected.delete(id);
      }
    }
    if (nextSelected.size !== selected.size) setSelected(nextSelected);
    return list;
  }, [search, typeFilter, statusFilter, remoteEmployees, selected]);

  const handleDelete = async (employeeId: string) => {
    try {
      const res = await apiFetch(`/employees/${encodeURIComponent(employeeId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error || `HTTP_${res.status}`;
        throw new Error(msg);
      }
      setRemoteEmployees((prev) => prev.filter((e) => e.core.employee_id !== employeeId));
      toast({ title: "Deleted", description: `Employee ${employeeId} deleted` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete", variant: "destructive" });
    }
  };

  const toggleSelect = (employeeId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelected((prev) => {
      if (!checked) return new Set();
      const next = new Set(prev);
      for (const e of filteredEmployees) next.add(e.core.employee_id);
      return next;
    });
  };

  const handleExport = () => {
    const cols = visibleColumns;
    const headers = cols.map((key) => {
      const found = allowedColumns.find((d) => d.key === key);
      const label = found ? found.label : key;
      return label.replace(/\s*•\s*/g, " ").replace(/\s+/g, " ").trim();
    });
    const rows = filteredEmployees.map((e: Employee) => {
      return cols.map((key) => {
        if (key === "type") return e.type || "";
        const [section, column] = key.split(".");
        const secObj = (e as unknown as Record<string, unknown>)[section] as Record<string, unknown> | undefined;
        const v = secObj ? (secObj as Record<string, unknown>)[column] : undefined;
        const s = v === undefined || v === null ? "" : String(v);
        const q = s.replace(/"/g, '""');
        return `"${q}"`;
      }).join(",");
    });
    const csv = [headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `employees-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = window.confirm(`Delete ${ids.length} selected employees?`);
    if (!ok) return;
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const res = await apiFetch(`/employees/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        success++;
      } catch {
        failed++;
      }
    }
    setRemoteEmployees((prev) => prev.filter((e) => !selected.has(e.core.employee_id)));
    setSelected(new Set());
    toast({ title: "Bulk Delete", description: `Deleted ${success}, failed ${failed}` });
  };
  const handleClearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const toggleColumn = async (col: string, on: boolean) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (on) next.add(col);
      else next.delete(col);
      const arr = Array.from(next);
      return arr.length ? arr : ["core.employee_id","core.name","type"];
    });
    try {
      const nextArr = (on ? new Set([...visibleColumns, col]) : new Set(visibleColumns.filter((c) => c !== col)));
      const payload = Array.from(nextArr);
      const res = await apiFetch(`/users/me/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "employee_list_columns", value: payload }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
    } catch (e) { void e; }
  };

  const toggleAllColumns = async (on: boolean) => {
    const keys = allowedColumns.map((d) => d.key);
    const payload = on ? Array.from(new Set(keys)) : ["core.employee_id","core.name","type"];
    setVisibleColumns(payload);
    try {
      const res = await apiFetch(`/users/me/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "employee_list_columns", value: payload }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
    } catch (e) { void e; }
  };

  return (
    <MainLayout 
      title="Employee List" 
      subtitle={
        serverTotal !== null
          ? `${filteredEmployees.length} of ${serverTotal} employees`
          : `${filteredEmployees.length} employees found`
      }
    >
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          {caps?.canCreateEmployees && (
            <>
              <Button asChild>
                <Link to="/employees/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/employees/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Link>
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {(caps?.canManageUsers || caps?.canCreateEmployees) && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const ok = window.confirm("Run sync now? This will write updates to destination.");
                  if (!ok) return;
                  const r = await apiFetch(`/sync/run`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dry_run: false, limit: 1000, offset: 0 }),
                  });
                  const d = await r.json().catch(() => null);
                  if (!r.ok) throw new Error(d?.error || `HTTP_${r.status}`);
                  const s = d?.stats;
                  const msg = s ? `Inserted ${s.inserted}, Updated ${s.updated}, Skipped ${s.skipped}` : "Sync completed";
                  toast({ title: "Manual Sync", description: msg });
                } catch (e: unknown) {
                  toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to run sync", variant: "destructive" });
                }
              }}
            >
              Sync
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border border-border p-0 w-72">
              <div className="p-2 sticky top-0 z-10 bg-popover">
                <Input
                  placeholder="Search columns..."
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                />
              </div>
              <DropdownMenuCheckboxItem
                checked={allowedColumns.length > 0 && allowedColumns.every((d) => visibleColumns.includes(d.key))}
                onCheckedChange={(on) => toggleAllColumns(Boolean(on))}
              >
                All Columns
              </DropdownMenuCheckboxItem>
              <div className="max-h-96 overflow-auto">
                {allowedColumns
                  .filter((def) => {
                    if (!colSearch) return true;
                    const q = colSearch.toLowerCase();
                    return def.label.toLowerCase().includes(q) || def.section.toLowerCase().includes(q) || def.column.toLowerCase().includes(q);
                  })
                  .map((def) => (
                    <DropdownMenuCheckboxItem
                      key={def.key}
                      checked={visibleColumns.includes(def.key)}
                      onCheckedChange={(on) => toggleColumn(def.key, Boolean(on))}
                    >
                      {def.label}
                    </DropdownMenuCheckboxItem>
                  ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toggleSelectAll(true)}>
            Select All
          </Button>
          <Button variant="outline" onClick={() => setSelected(new Set())}>
            Clear Selection
          </Button>
          <Button variant="destructive" onClick={handleBulkDelete} disabled={selected.size === 0 || !caps?.canDeleteEmployees}>
            Delete Selected ({selected.size})
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 animate-fade-in">
        <EmployeeFilters
          search={search}
          onSearchChange={handleSearchChange}
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Table */}
      <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {loading && remoteEmployees.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-muted-foreground">Loading employees...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-muted-foreground">Failed to load employees ({error}).</p>
          </div>
        ) : filteredEmployees.length > 0 ? (
          <>
            <div className="overflow-x-auto mb-2" ref={topScrollRef}>
              <div style={{ width: minTableWidth }} />
            </div>
            <div className="overflow-x-auto" ref={bodyScrollRef}>
              <div style={{ minWidth: minTableWidth }}>
                <EmployeeTable
                  employees={filteredEmployees}
                  onDelete={handleDelete}
                  selectable
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleSelectAll}
                  visibleColumns={visibleColumns}
                  onRowClick={(employee) => navigate(`/employees/${employee.core.employee_id}`)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-muted-foreground">No employees found matching your criteria.</p>
            <Button variant="link" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        )}
        {filteredEmployees.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {serverTotal ? `Page ${page} of ${totalPages}` : `Page ${page}`}
            </div>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {pageItems.map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {item === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={item === page}
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default EmployeeList;
