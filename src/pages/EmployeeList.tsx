import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Columns, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Employee, EmployeeCore, EmployeeContact, EmployeeEmployment, EmployeeBank, EmployeeInsurance, EmployeeOnboard, EmployeeTravel, EmployeeChecklist, EmployeeNotes, EmployeeType } from "@/types/employee";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { apiFetch } from "@/lib/api";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchColumnAccess } from "@/lib/rbac";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type SortDirection = "asc" | "desc";
type SortState = { key: string; direction: SortDirection } | null;

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
  const [sortState, setSortState] = useState<SortState>(null);
  const [columnPins, setColumnPins] = useState<Record<string, "left" | "right" | undefined>>({});
  const [colSearch, setColSearch] = useState("");
  const [allowedColumns, setAllowedColumns] = useState<Array<{ key: string; section: string; column: string; label: string }>>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

  const displayedColumns = useMemo(() => {
    const left: string[] = [];
    const center: string[] = [];
    const right: string[] = [];
    for (const key of visibleColumns) {
      const pin = columnPins[key];
      if (pin === "left") left.push(key);
      else if (pin === "right") right.push(key);
      else center.push(key);
    }
    return [...left, ...center, ...right];
  }, [visibleColumns, columnPins]);

  const defaultColumnWidths = useMemo(() => {
    const base = 160;
    const map: Record<string, number> = {};
    for (const key of visibleColumns) {
      if (key === "core.name") {
        map[key] = 240;
      } else if (key === "employment.department") {
        map[key] = 200;
      } else if (key === "employment.job_title") {
        map[key] = 220;
      } else if (key === "core.employee_id") {
        map[key] = 180;
      } else if (key === "type") {
        map[key] = 140;
      } else {
        map[key] = base;
      }
    }
    return map;
  }, [visibleColumns]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      for (const key of visibleColumns) {
        const prevVal = prev[key];
        next[key] = typeof prevVal === "number" ? prevVal : defaultColumnWidths[key] ?? 160;
      }
      return next;
    });
  }, [visibleColumns, defaultColumnWidths]);
  const columnWidthsTotal = useMemo(() => (
    visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? defaultColumnWidths[key] ?? 160), 0)
  ), [visibleColumns, columnWidths, defaultColumnWidths]);
  const minTableWidth = useMemo(() => Math.max(1000, columnWidthsTotal + 240), [columnWidthsTotal]);
  const allowedKeySet = useMemo(() => new Set(allowedColumns.map((d) => d.key)), [allowedColumns]);
  const totalPages = useMemo(() => {
    if (serverTotal === null || serverTotal <= 0) {
      return Math.max(1, page + (remoteEmployees.length === pageSize ? 1 : 0));
    }
    return Math.max(1, Math.ceil(serverTotal / pageSize));
  }, [serverTotal, pageSize, page, remoteEmployees.length]);
  useEffect(() => {
    if (serverTotal !== null && page > totalPages) setPage(totalPages);
  }, [page, totalPages, serverTotal]);
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

  const sortedEmployees = useMemo(() => {
    if (!sortState) return filteredEmployees;
    const { key, direction } = sortState;
    const multiplier = direction === "asc" ? 1 : -1;
    const extractValue = (employee: Employee) => {
      if (key === "type") return employee.type ?? "";
      const [section, column] = key.split(".");
      const secObj = (employee as unknown as Record<string, Record<string, unknown> | undefined>)[section];
      if (!secObj) return "";
      const value = secObj[column];
      return value ?? "";
    };
    return [...filteredEmployees].sort((a, b) => {
      const av = extractValue(a);
      const bv = extractValue(b);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * multiplier;
      }
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
    });
  }, [filteredEmployees, sortState]);

  const totalCount = serverTotal ?? Math.max((page - 1) * pageSize + sortedEmployees.length, sortedEmployees.length);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  const columnLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const col of allowedColumns) {
      map[col.key] = col.label;
    }
    return map;
  }, [allowedColumns]);

  const formatColumnLabel = useCallback((key: string) => {
    const label = columnLabelMap[key];
    if (label) return label;
    const part = key.split(".").pop() ?? key;
    return part.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }, [columnLabelMap]);

  const skeletonColumns = useMemo(
    () => (displayedColumns.length
      ? displayedColumns
      : ["core.employee_id", "core.name", "type", "employment.department", "employment.job_title", "employment.status"]),
    [displayedColumns]
  );

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
      toast({
        title: "Data Berhasil Dihapus",
        description: (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm">Karyawan {employeeId} berhasil dihapus.</div>
              <div className="text-xs text-muted-foreground">Baru saja</div>
            </div>
          </div>
        ),
        className: "border-l-4 border-emerald-500/70 bg-background/95 shadow-xl",
      });
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
      for (const e of sortedEmployees) next.add(e.core.employee_id);
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
    const rows = sortedEmployees.map((e: Employee) => {
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
    const title = failed === 0 ? "Semua Data Terhapus" : "Hapus Selesai";
    toast({
      title,
      description: (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="text-sm">Berhasil hapus {success} data, gagal {failed}.</div>
            <div className="text-xs text-muted-foreground">Baru saja</div>
          </div>
        </div>
      ),
      className: "border-l-4 border-emerald-500/70 bg-background/95 shadow-xl",
    });
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

  const reorderColumn = async (sourceKey: string, targetKey: string) => {
    let nextOrder: string[] | null = null;
    setVisibleColumns((prev) => {
      if (sourceKey === targetKey) return prev;
      const sourcePin = columnPins[sourceKey] ?? null;
      const targetPin = columnPins[targetKey] ?? null;
      if (sourcePin !== targetPin) return prev;
      const sourceIndex = prev.indexOf(sourceKey);
      const targetIndex = prev.indexOf(targetKey);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const next = [...prev];
      next.splice(sourceIndex, 1);
      const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      next.splice(insertIndex, 0, sourceKey);
      nextOrder = next;
      return next;
    });
    if (!nextOrder) return;
    try {
      const res = await apiFetch(`/users/me/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "employee_list_columns", value: nextOrder }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
    } catch (e) { void e; }
  };

  const pinColumn = (key: string, pin: "left" | "right" | null) => {
    setColumnPins((prev) => {
      if (pin === null) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: pin };
    });
  };

  return (
    <MainLayout 
      title="Employee List" 
      subtitle={
        serverTotal !== null
          ? `${sortedEmployees.length} of ${serverTotal} employees`
          : `${sortedEmployees.length} employees found`
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
          <Button
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={selected.size === 0 || !caps?.canDeleteEmployees}
          >
            Delete Selected ({selected.size})
          </Button>
        </div>
      </div>
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="sm:max-w-[560px] p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <AlertDialogTitle className="text-base font-semibold text-foreground">Konfirmasi Penghapusan</AlertDialogTitle>
            <div className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
              Danger
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-semibold">Hapus karyawan terpilih?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground">
                    {selected.size > 0
                      ? `Tindakan ini akan menghapus ${selected.size} karyawan dan tidak dapat dibatalkan.`
                      : "Tindakan ini tidak dapat dibatalkan."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="text-sm text-muted-foreground">
                  Pastikan Anda benar-benar ingin menghapus. Data yang dihapus tidak bisa dipulihkan.
                </div>
              </div>
            </div>
          </div>
          <AlertDialogFooter className="border-t border-border px-6 py-4">
            <AlertDialogCancel className="h-9">Batal</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                className="h-9"
                variant="destructive"
                onClick={async () => {
                  setBulkDeleteOpen(false);
                  await handleBulkDelete();
                }}
              >
                Hapus
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-xl border border-border bg-card shadow-card animate-fade-in">
        <div className="border-b border-border px-4 py-4">
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
        <div style={{ animationDelay: '0.1s' }}>
          {loading && remoteEmployees.length === 0 ? (
            <div className="overflow-x-auto">
              <div style={{ minWidth: minTableWidth }}>
                <Table className="[&_tbody_tr:last-child]:border-b-0 table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </TableHead>
                      {skeletonColumns.map((key) => (
                        <TableHead
                          key={key}
                          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80"
                        >
                          {formatColumnLabel(key)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`} className="border-border/60">
                        <TableCell>
                          <Skeleton className="h-4 w-4 rounded-sm" />
                        </TableCell>
                        {skeletonColumns.map((key, colIndex) => (
                          <TableCell key={`${key}-${colIndex}`}>
                            <Skeleton
                              className={
                                colIndex % 3 === 0
                                  ? "h-4 w-24"
                                  : colIndex % 3 === 1
                                    ? "h-4 w-32"
                                    : "h-4 w-28"
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t border-border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">Failed to load employees ({error}).</p>
            </div>
          ) : sortedEmployees.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-2" ref={topScrollRef}>
                <div style={{ width: minTableWidth }} />
              </div>
              <div className="overflow-x-auto" ref={bodyScrollRef}>
                <div style={{ minWidth: minTableWidth }}>
                  <EmployeeTable
                    employees={sortedEmployees}
                    onDelete={handleDelete}
                    selectable
                    selected={selected}
                    onToggleSelect={toggleSelect}
                    onToggleAll={toggleSelectAll}
                    visibleColumns={displayedColumns}
                    resizable
                    columnWidths={columnWidths}
                    onColumnResize={(key, width) => {
                      setColumnWidths((prev) => ({ ...prev, [key]: width }));
                    }}
                    onRowClick={(employee) => navigate(`/employees/${employee.core.employee_id}`)}
                    sortState={sortState}
                    onSortChange={(key, direction) => {
                      if (!direction) {
                        setSortState(null);
                        return;
                      }
                      setSortState({ key, direction });
                    }}
                    pinState={columnPins}
                    onPinChange={pinColumn}
                    onReorderColumn={reorderColumn}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No employees found matching your criteria.</p>
              <Button variant="link" onClick={handleClearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
        {sortedEmployees.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
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
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{rangeStart} - {rangeEnd} of {totalCount}</span>
                <Pagination className="w-auto">
                  <PaginationContent className="gap-1">
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        aria-label="Previous page"
                        className={page <= 1 ? "h-8 w-8 pointer-events-none opacity-50" : "h-8 w-8"}
                        onClick={(event) => {
                          event.preventDefault();
                          if (page > 1) setPage(page - 1);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                    {pageItems.map((item, index) => (
                      <PaginationItem key={`${item}-${index}`}>
                        {item === "ellipsis" ? (
                          <PaginationEllipsis className="h-8 w-8" />
                        ) : (
                          <PaginationLink
                            href="#"
                            isActive={item === page}
                            className="h-8 w-8 text-xs"
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
                      <PaginationLink
                        href="#"
                        aria-label="Next page"
                        className={page >= totalPages ? "h-8 w-8 pointer-events-none opacity-50" : "h-8 w-8"}
                        onClick={(event) => {
                          event.preventDefault();
                          if (page < totalPages) setPage(page + 1);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default EmployeeList;
