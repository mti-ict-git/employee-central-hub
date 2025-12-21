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
import { Eye, Pencil, Trash } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useRBAC } from "@/hooks/useRBAC";

interface EmployeeTableProps {
  employees: Employee[];
  onDelete?: (employeeId: string) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (employeeId: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
}

export function EmployeeTable({ employees, onDelete, selectable = false, selected, onToggleSelect, onToggleAll }: EmployeeTableProps) {
  const { caps } = useRBAC();
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
            <TableHead className="font-semibold">Employee ID</TableHead>
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Department</TableHead>
            <TableHead className="font-semibold">Job Title</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow 
              key={employee.core.employee_id}
              className="transition-colors hover:bg-muted/30"
            >
              {selectable && (
                <TableCell>
                  <Checkbox
                    checked={selected ? selected.has(employee.core.employee_id) : false}
                    onCheckedChange={(v) => onToggleSelect && onToggleSelect(employee.core.employee_id, Boolean(v))}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium text-primary">
                {employee.core.employee_id}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                    {employee.core.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium">{employee.core.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.core.nationality}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={employee.type === 'indonesia' ? 'default' : 'secondary'}>
                  {employee.type === 'indonesia' ? 'Indonesia' : 'Expatriate'}
                </Badge>
              </TableCell>
              <TableCell>{employee.employment.department || '-'}</TableCell>
              <TableCell>{employee.employment.job_title || '-'}</TableCell>
              <TableCell>
                <Badge 
                  className={cn(
                    employee.employment.status === 'Active' 
                      ? "bg-success/10 text-success hover:bg-success/20" 
                      : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  )}
                >
                  {employee.employment.status || 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/employees/${employee.core.employee_id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {caps?.canUpdateEmployees && (
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
                        const ok = window.confirm(`Delete employee ${employee.core.employee_id}?`);
                        if (!ok) return;
                        onDelete(employee.core.employee_id);
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
    </div>
  );
}
