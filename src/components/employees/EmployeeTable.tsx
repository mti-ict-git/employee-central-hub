import { useCallback, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
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
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Eye, GripVertical, Pencil, Pin, PinOff, Trash } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DraggableAttributes,
  type DragEndEvent,
  type SyntheticListenerMap,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useRBAC } from "@/hooks/useRBAC";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  resizable?: boolean;
  columnWidths?: Record<string, number>;
  onColumnResize?: (key: string, width: number) => void;
  sortState?: { key: string; direction: "asc" | "desc" } | null;
  onSortChange?: (key: string, direction: "asc" | "desc" | null) => void;
  pinState?: Record<string, "left" | "right" | undefined>;
  onPinChange?: (key: string, pin: "left" | "right" | null) => void;
  onReorderColumn?: (sourceKey: string, targetKey: string) => void;
}

type SortableHeaderCellProps = {
  id: string;
  className?: string;
  style?: CSSProperties;
  children: (props: { attributes: DraggableAttributes; listeners: SyntheticListenerMap | undefined; isDragging: boolean }) => ReactNode;
};

const SortableHeaderCell = ({ id, className, style, children }: SortableHeaderCellProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const mergedStyle = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
  } as CSSProperties;
  return (
    <TableHead ref={setNodeRef} className={cn(className, isDragging ? "opacity-60" : undefined)} style={mergedStyle}>
      {children({ attributes, listeners, isDragging })}
    </TableHead>
  );
};

export function EmployeeTable({ employees, onDelete, selectable = false, selected, onToggleSelect, onToggleAll, visibleColumns, onRowClick, resizable = false, columnWidths, onColumnResize, sortState, onSortChange, pinState, onPinChange, onReorderColumn }: EmployeeTableProps) {
  const { caps, typeAccess } = useRBAC();
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const columns = useMemo(() => (
    Array.isArray(visibleColumns) && visibleColumns.length
      ? visibleColumns
      : ["core.employee_id","core.name","type","employment.department","employment.job_title","employment.status"]
  ), [visibleColumns]);

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
    const flagStyleMap: Record<string, CSSProperties> = {
      indonesia: { background: "linear-gradient(180deg,#dc2626 50%,#ffffff 50%)" },
      china: { background: "#dc2626" },
      expat: { background: "#dc2626" },
      "people's republic of china": { background: "#dc2626" },
      prc: { background: "#dc2626" },
      philippines: { background: "linear-gradient(90deg,#1d4ed8 50%,#dc2626 50%)" },
      usa: { background: "linear-gradient(180deg,#ef4444 50%,#ffffff 50%)" },
      "united states": { background: "linear-gradient(180deg,#ef4444 50%,#ffffff 50%)" },
      "united states of america": { background: "linear-gradient(180deg,#ef4444 50%,#ffffff 50%)" },
      malaysia: { background: "linear-gradient(180deg,#ef4444 50%,#ffffff 50%)" },
      singapore: { background: "linear-gradient(180deg,#ef4444 50%,#ffffff 50%)" },
      japan: { background: "radial-gradient(circle at 50% 50%,#dc2626 35%,#ffffff 36%)" },
      korea: { background: "#ffffff" },
      "south korea": { background: "#ffffff" },
      india: { background: "linear-gradient(180deg,#f97316 33%,#ffffff 33% 66%,#16a34a 66%)" },
      australia: { background: "#1d4ed8" },
      vietnam: { background: "#dc2626" },
      thailand: { background: "linear-gradient(180deg,#1d4ed8 33%,#ffffff 33% 66%,#ef4444 66%)" },
      uk: { background: "#1d4ed8" },
      "united kingdom": { background: "#1d4ed8" },
    };
    const nationalityKey = typeof nationality === "string" ? nationality.trim().toLowerCase() : "";
    const flagStyle = nationalityKey && nationalityKey !== "-"
      ? (flagStyleMap[nationalityKey] ?? { background: "linear-gradient(180deg,#9ca3af 50%,#e5e7eb 50%)" })
      : undefined;

    return (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
          {initials || "??"}
        </div>
        <div>
          <p className="font-medium">{name || "-"}</p>
          <p className="text-xs text-muted-foreground">
            {flagStyle ? (
              <span
                className="mr-1 inline-flex h-3 w-4 rounded-sm border border-border/70"
                style={flagStyle}
                aria-hidden
              />
            ) : null}
            {nationality}
          </p>
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
      const [, column] = parts;
      const toTitle = (s: string) => s.replace(/[-_]+/g, " ").split(" ").filter(Boolean).map((w) => w[0] ? w[0].toUpperCase() + w.slice(1) : "").join(" ");
      return toTitle(column);
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
      if (section === "core" && column === "gender") {
        const genderRaw = typeof val === "string" ? val.trim().toLowerCase() : "";
        const isMale = genderRaw === "m" || genderRaw === "male" || genderRaw === "l" || genderRaw === "laki-laki";
        const isFemale = genderRaw === "f" || genderRaw === "female" || genderRaw === "p" || genderRaw === "perempuan";
        if (!isMale && !isFemale) return val ? String(val) : "-";
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              isMale ? "bg-sky-500/10 text-sky-600" : "bg-rose-500/10 text-rose-600",
            )}
          >
            <span className="text-[13px] leading-none" aria-hidden>
              {isMale ? "♂" : "♀"}
            </span>
            {isMale ? "Male" : "Female"}
          </span>
        );
      }
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

  const startResize = (event: MouseEvent<HTMLSpanElement>, key: string) => {
    if (!onColumnResize) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths?.[key] ?? (event.currentTarget.parentElement?.getBoundingClientRect().width ?? 160);
    const handleMove = (e: MouseEvent) => {
      const next = Math.max(120, Math.round(startWidth + e.clientX - startX));
      onColumnResize(key, next);
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const getWidthStyle = (key: string) => {
    const width = columnWidths?.[key];
    if (!width) return undefined;
    return { width, minWidth: width, maxWidth: width } as CSSProperties;
  };

  const columnWidth = useCallback((key: string) => columnWidths?.[key] ?? 160, [columnWidths]);

  const pinnedLeftOffsets = useMemo(() => {
    let offset = 0;
    const map: Record<string, number> = {};
    for (const key of columns) {
      if (pinState?.[key] === "left") {
        map[key] = offset;
        offset += columnWidth(key);
      }
    }
    return map;
  }, [columns, pinState, columnWidth]);

  const pinnedRightOffsets = useMemo(() => {
    let offset = 0;
    const map: Record<string, number> = {};
    for (let i = columns.length - 1; i >= 0; i -= 1) {
      const key = columns[i];
      if (pinState?.[key] === "right") {
        map[key] = offset;
        offset += columnWidth(key);
      }
    }
    return map;
  }, [columns, pinState, columnWidth]);

  const getPinnedStyle = (key: string) => {
    const pin = pinState?.[key];
    if (pin === "left") {
      return { position: "sticky", left: pinnedLeftOffsets[key] ?? 0, zIndex: 2 } as CSSProperties;
    }
    if (pin === "right") {
      return { position: "sticky", right: pinnedRightOffsets[key] ?? 0, zIndex: 2 } as CSSProperties;
    }
    return undefined;
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    onReorderColumn?.(String(event.active.id), String(event.over.id));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/95">
      <Table className="[&_tbody_tr:last-child]:border-b-0 table-fixed">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
            <TableHeader>
          <TableRow className="bg-muted/50">
            {selectable && (
              <TableHead className="w-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Checkbox
                  checked={selected && employees.every((e) => selected.has(e.core.employee_id)) && employees.length > 0}
                  onCheckedChange={(v) => onToggleAll && onToggleAll(Boolean(v))}
                />
              </TableHead>
            )}
            {columns.map((key) => {
              const sortDir = sortState?.key === key ? sortState.direction : null;
              const pin = pinState?.[key];
              const widthStyle = getWidthStyle(key);
              const pinnedStyle = getPinnedStyle(key);
              return (
                <SortableHeaderCell
                  key={key}
                  id={key}
                  className={cn(
                    "relative text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80",
                    resizable ? "pr-8" : "pr-6",
                    pin ? "bg-muted/50" : undefined
                  )}
                  style={pinnedStyle ? { ...widthStyle, ...pinnedStyle } : widthStyle}
                >
                  {({ attributes, listeners }) => (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className="-ml-1 inline-flex h-6 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted/40 hover:text-muted-foreground cursor-grab"
                          {...attributes}
                          {...listeners}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <span className="whitespace-normal break-words">{headerLabel(key)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52">
                            <DropdownMenuItem onSelect={() => onSortChange?.(key, "asc")}>
                              <ArrowUp className="mr-2 h-4 w-4" />
                              Asc
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onSortChange?.(key, "desc")}>
                              <ArrowDown className="mr-2 h-4 w-4" />
                              Desc
                            </DropdownMenuItem>
                            {sortDir ? (
                              <DropdownMenuItem onSelect={() => onSortChange?.(key, null)}>
                                <ArrowUp className="mr-2 h-4 w-4" />
                                Clear sort
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            {pin ? (
                              <DropdownMenuItem onSelect={() => onPinChange?.(key, null)}>
                                <PinOff className="mr-2 h-4 w-4" />
                                Unpin
                              </DropdownMenuItem>
                            ) : null}
                            {pin !== "left" ? (
                              <DropdownMenuItem onSelect={() => onPinChange?.(key, "left")}>
                                <Pin className="mr-2 h-4 w-4" />
                                Pin to left
                              </DropdownMenuItem>
                            ) : null}
                            {pin !== "right" ? (
                              <DropdownMenuItem onSelect={() => onPinChange?.(key, "right")}>
                                <Pin className="mr-2 h-4 w-4" />
                                Pin to right
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {resizable && (
                        <span
                          role="separator"
                          onMouseDown={(event) => startResize(event, key)}
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                        >
                          <span className="absolute right-0 top-1/2 h-6 w-px -translate-y-1/2 bg-border/80" />
                        </span>
                      )}
                    </>
                  )}
                </SortableHeaderCell>
              );
            })}
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
          </TableRow>
            </TableHeader>
          </SortableContext>
        </DndContext>
        <TableBody>
          {employees.map((employee) => (
            <TableRow 
              key={employee.core.employee_id}
              className={cn(
                "border-b border-border/60 transition-colors hover:bg-muted/40",
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
              {columns.map((key) => {
                const widthStyle = getWidthStyle(key);
                const pinnedStyle = getPinnedStyle(key);
                return (
                  <TableCell
                    key={key}
                    className={cn(
                      "py-3.5",
                      key === "core.employee_id" ? "font-semibold text-primary" : "text-foreground",
                      key === "core.gender" ? "text-center" : undefined,
                      pinState?.[key] ? "bg-card/95" : undefined
                    )}
                    style={pinnedStyle ? { ...widthStyle, ...pinnedStyle } : widthStyle}
                  >
                    {key === "core.employee_id" ? employee.core.employee_id
                      : key === "core.name" ? (
                        renderNameCell(employee)
                      ) : renderCell(employee, key)}
                  </TableCell>
                );
              })}
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-muted/60" asChild>
                    <Link to={`/employees/${employee.core.employee_id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {((employee.type === "indonesia" ? canEditIndonesia : canEditExpat)) && (
                    <Button variant="ghost" size="icon" className="rounded-lg hover:bg-muted/60" asChild>
                      <Link to={`/employees/${employee.core.employee_id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {onDelete && caps?.canDeleteEmployees && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
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
