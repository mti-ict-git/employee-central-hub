import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Columns } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { Employee } from "@/types/employee";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { apiFetch } from "@/lib/api";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { fetchColumnAccess } from "@/lib/rbac";

const EmployeeList = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [remoteEmployees, setRemoteEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { caps, typeAccess, ready: rbacReady } = useRBAC();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(["core.employee_id","core.name","type","employment.department","employment.job_title","employment.status"]);
  const [colSearch, setColSearch] = useState("");
  const [allowedColumns, setAllowedColumns] = useState<Array<{ key: string; section: string; column: string; label: string }>>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/employees?limit=500`, { signal: ctrl.signal, credentials: "include" });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const data = await res.json();
        const items: Employee[] = (data.items || []).map((e: { core: { employee_id: string; name: string; nationality?: string | null; imip_id?: string | null; branch?: string | null; branch_id?: string | null }; employment: { department?: string | null; status?: string | null; job_title?: string | null }; type?: string }) => ({
          core: { employee_id: e.core.employee_id, name: e.core.name, imip_id: e.core.imip_id, branch: e.core.branch, branch_id: e.core.branch_id, nationality: e.core.nationality },
          contact: { phone_number: "", email: "", address: "", city: "", spouse_name: "", child_name_1: "", child_name_2: "", child_name_3: "", emergency_contact_name: "", emergency_contact_phone: "" },
          employment: { employment_status: "", status: e.employment.status, division: "", department: e.employment.department, section: "", job_title: e.employment.job_title || "", grade: "", position_grade: "", group_job_title: "", direct_report: "", company_office: "", work_location: "", locality_status: "", terminated_date: "", terminated_type: "", terminated_reason: "" },
          onboard: { point_of_hire: "", point_of_origin: "", schedule_type: "", first_join_date_merdeka: "", transfer_merdeka: "", first_join_date: "", join_date: "", end_contract: "", years_in_service: 0 },
          bank: { bank_name: "", account_name: "", account_no: "", bank_code: "", icbc_bank_account_no: "", icbc_username: "" },
          insurance: { insurance_endorsement: "", insurance_owlexa: "", insurance_fpg: "", fpg_no: "", owlexa_no: "", bpjs_tk: "", bpjs_kes: "", status_bpjs_kes: "", social_insurance_no_alt: "", bpjs_kes_no_alt: "" },
          travel: { passport_no: "", name_as_passport: "", passport_expiry: "", kitas_no: "", kitas_expiry: "", kitas_address: "", imta: "", rptka_no: "", rptka_position: "", job_title_kitas: "", travel_in: "", travel_out: "" },
          checklist: { passport_checklist: false, kitas_checklist: false, imta_checklist: false, rptka_checklist: false, npwp_checklist: false, bpjs_kes_checklist: false, bpjs_tk_checklist: false, bank_checklist: false },
          notes: { batch: "", note: "" },
          type: (e.type === "indonesia" ? "indonesia" : "expat"),
        }));
        setRemoteEmployees(items);
        try {
          const prefRes = await apiFetch(`/users/me/preferences?key=employee_list_columns`, { signal: ctrl.signal, credentials: "include" });
          if (prefRes.ok) {
            const prefs = await prefRes.json().catch(() => ({}));
            const cols = Array.isArray(prefs?.employee_list_columns) ? prefs.employee_list_columns as string[] : null;
            const defaults = ["core.employee_id","core.name","type","employment.department","employment.job_title","employment.status"];
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
              if (sanitized.length) setVisibleColumns(sanitized);
              else setVisibleColumns(defaults);
            } else {
              setVisibleColumns(defaults);
            }
          }
        } catch (e) { void e; }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "FAILED_TO_FETCH_EMPLOYEES");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const toTitle = (s: string) => s.replace(/[-_]+/g, " ").split(" ").filter(Boolean).map((w) => w[0] ? w[0].toUpperCase() + w.slice(1) : "").join(" ");
    const canonical = (section: string) => {
      const raw = String(section || "");
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
          const label = `${toTitle(secKey)} • ${toTitle(colKey)}`;
          ensure(dotted, secKey, colKey, label);
        }
        ensure("core.employee_id", "core", "employee_id", "Core • Employee ID");
        ensure("core.name", "core", "name", "Core • Name");
        ensure("employment.department", "employment", "department", "Employment • Department");
        ensure("employment.job_title", "employment", "job_title", "Employment • Job Title");
        ensure("employment.status", "employment", "status", "Employment • Status");
        ensure("type", "core", "type", "Type");
        setAllowedColumns(defs);
      } catch (e) { void e; }
    };
    run();
    return () => ctrl.abort();
  }, [rbacReady, caps]);

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

  return (
    <MainLayout 
      title="Employee List" 
      subtitle={`${filteredEmployees.length} employees found`}
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
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Columns className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover border border-border">
              <div className="p-2">
                <Input
                  placeholder="Search columns..."
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                />
              </div>
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
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Table */}
      <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-muted-foreground">Loading employees...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-muted-foreground">Failed to load employees ({error}).</p>
          </div>
        ) : filteredEmployees.length > 0 ? (
          <EmployeeTable
            employees={filteredEmployees}
            onDelete={handleDelete}
            selectable
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleSelectAll}
            visibleColumns={visibleColumns}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-muted-foreground">No employees found matching your criteria.</p>
            <Button variant="link" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default EmployeeList;
