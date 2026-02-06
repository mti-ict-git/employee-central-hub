import { useState } from "react";
import { Employee } from "@/types/employee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Eye, Pencil, Trash } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useRBAC } from "@/hooks/useRBAC";
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

interface EmployeeTableProps {
  employees: Employee[];
  onDelete?: (employeeId: string) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (employeeId: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
  visibleColumns?: string[];
  onRowClick?: (employee: Employee) => void;
}

export function EmployeeTable({ employees, onDelete, selectable = false, selected, onToggleSelect, onToggleAll, visibleColumns, onRowClick }: EmployeeTableProps) {
  const { caps, typeAccess } = useRBAC();
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const columns = Array.isArray(visibleColumns) && visibleColumns.length
    ? visibleColumns
    : ["core.employee_id","core.name","type","employment.department","employment.job_title","employment.status"];

  const renderNameCell = (employee: Employee) => {
    const rawName: unknown = (employee.core as { name: unknown }).name;
    const name = typeof rawName === "string" ? rawName : "";
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const rawNationality: unknown = (employee.core as { nationality?: unknown }).nationality;
    const nationality = typeof rawNationality === "string" && rawNationality.length > 0 ? rawNationality : "-";

    return (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
          {initials || "??"}
        </div>
        <div>
          <p className="font-medium">{name || "-"}</p>
          <p className="text-xs text-muted-foreground">{nationality}</p>
        </div>
      </div>
    );
  };

  const editableColumnsBySection: Record<string, string[]> = {
    core: [
      "imip_id",
      "name",
      "gender",
      "place_of_birth",
      "date_of_birth",
      "marital_status",
      "religion",
      "nationality",
      "blood_type",
      "ktp_no",
      "kartu_keluarga_no",
      "npwp",
      "tax_status",
      "education",
      "office_email",
      "id_card_mti",
      "field",
      "branch_id",
      "branch",
    ],
    contact: [
      "phone_number",
      "email",
      "address",
      "city",
      "spouse_name",
      "child_name_1",
      "child_name_2",
      "child_name_3",
      "emergency_contact_name",
      "emergency_contact_phone",
    ],
    employment: [
      "employment_status",
      "status",
      "division",
      "department",
      "section",
      "job_title",
      "grade",
      "position_grade",
      "group_job_title",
      "direct_report",
      "company_office",
      "work_location",
      "locality_status",
      "blacklist_mti",
      "blacklist_imip",
    ],
    onboard: [
      "point_of_hire",
      "point_of_origin",
      "schedule_type",
      "first_join_date_merdeka",
      "transfer_merdeka",
      "first_join_date",
      "join_date",
      "end_contract",
    ],
    bank: [
      "bank_name",
      "account_name",
      "account_no",
      "bank_code",
      "icbc_bank_account_no",
      "icbc_username",
    ],
    insurance: [
      "bpjs_tk",
      "bpjs_kes",
      "status_bpjs_kes",
      "insurance_endorsement",
      "insurance_owlexa",
      "insurance_fpg",
      "fpg_no",
      "owlexa_no",
      "social_insurance_no_alt",
      "bpjs_kes_no_alt",
    ],
    travel: [
      "passport_no",
      "name_as_passport",
      "passport_expiry",
      "kitas_no",
      "kitas_expiry",
      "kitas_address",
      "imta",
      "rptka_no",
      "rptka_position",
      "job_title_kitas",
      "travel_in",
      "travel_out",
    ],
    checklist: [
      "passport_checklist",
      "kitas_checklist",
      "imta_checklist",
      "rptka_checklist",
      "npwp_checklist",
      "bpjs_kes_checklist",
      "bpjs_tk_checklist",
      "bank_checklist",
    ],
    notes: ["batch", "note"],
  };

  const canWriteForType = (employeeType: "indonesia" | "expat", section: string, column: string) => {
    if (!caps) return false;
    if (column === "employee_id") return false;
    const key = String(section || "").toLowerCase();
    const applicable = typeAccess?.[employeeType]?.[key]?.[column];
    if (applicable === false) return false;
    return caps.canColumn(section, column, "write");
  };

  const computeCanEditForType = (employeeType: "indonesia" | "expat") => {
    if (!caps) return false;
    for (const [section, cols] of Object.entries(editableColumnsBySection)) {
      for (const col of cols) {
        if (canWriteForType(employeeType, section, col)) return true;
      }
    }
    return false;
  };

  const canEditIndonesia = computeCanEditForType("indonesia");
  const canEditExpat = computeCanEditForType("expat");

  const headerLabel = (key: string) => {
    if (key === "type") return "Type";
    const parts = key.split(".");
    if (parts.length === 2) {
      const [section, column] = parts;
      const toTitle = (s: string) => s.replace(/[-_]+/g, " ").split(" ").filter(Boolean).map((w) => w[0] ? w[0].toUpperCase() + w.slice(1) : "").join(" ");
      return `${toTitle(section)} • ${toTitle(column)}`;
    }
    return key;
  };

  const renderCell = (employee: Employee, key: string) => {
    if (key === "type") {
      return (
        <Badge variant={employee.type === 'indonesia' ? 'default' : 'warning'}>
          {employee.type === 'indonesia' ? 'Indonesia' : 'Expatriate'}
        </Badge>
      );
    }
    const parts = key.split(".");
    if (parts.length === 2) {
      const [section, column] = parts as [string, string];
      const isSectionKey = (s: string): s is keyof Employee =>
        s === "core" || s === "contact" || s === "employment" || s === "onboard" || s === "bank" || s === "insurance" || s === "travel" || s === "checklist" || s === "notes";
      if (!isSectionKey(section)) return "-";
      const sectionObj = employee[section] as unknown as Record<string, unknown> | undefined;
      const val: unknown = sectionObj ? sectionObj[column] : undefined;
      if (section === "employment" && column === "status") {
        const statusStr = typeof val === "string" ? val : undefined;
        return (
          <Badge 
            className={cn(
              statusStr === 'Active' 
                ? "bg-success/10 text-success hover:bg-success/20" 
                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
            )}
          >
            {statusStr || 'Unknown'}
          </Badge>
        );
      }
      if (typeof val === "string" && val.length > 0) return val as string;
      if (typeof val === "number") return String(val as number);
      if (typeof val === "boolean") return (val as boolean) ? "Yes" : "No";
      return "-";
    }
    return "-";
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={selected && employees.every((e) => selected.has(e.core.employee_id)) && employees.length > 0}
                  onCheckedChange={(v) => onToggleAll && onToggleAll(Boolean(v))}
                />
              </TableHead>
            )}
            {columns.map((key) => (
              <TableHead key={key} className="font-semibold">{headerLabel(key)}</TableHead>
            ))}
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow 
              key={employee.core.employee_id}
              className={cn(
                "transition-colors hover:bg-muted/30",
                onRowClick ? "cursor-pointer" : undefined
              )}
              onClick={() => onRowClick && onRowClick(employee)}
            >
              {selectable && (
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected ? selected.has(employee.core.employee_id) : false}
                    onCheckedChange={(v) => onToggleSelect && onToggleSelect(employee.core.employee_id, Boolean(v))}
                  />
                </TableCell>
              )}
              {columns.map((key) => (
                <TableCell key={key} className={key === "core.employee_id" ? "font-medium text-primary" : undefined}>
                  {key === "core.employee_id" ? employee.core.employee_id
                    : key === "core.name" ? (
                      renderNameCell(employee)
                    ) : renderCell(employee, key)}
                </TableCell>
              ))}
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/employees/${employee.core.employee_id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {((employee.type === "indonesia" ? canEditIndonesia : canEditExpat)) && (
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/employees/${employee.core.employee_id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {onDelete && caps?.canDeleteEmployees && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeleteTarget(employee);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
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
                  <AlertDialogTitle className="text-xl font-semibold">Hapus karyawan?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground">
                    {deleteTarget?.core?.employee_id
                      ? `Tindakan ini akan menghapus karyawan ${deleteTarget.core.employee_id} dan tidak dapat dibatalkan.`
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
                onClick={() => {
                  if (!deleteTarget || !onDelete) {
                    setDeleteTarget(null);
                    return;
                  }
                  onDelete(deleteTarget.core.employee_id);
                  setDeleteTarget(null);
                }}
              >
                Hapus
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
