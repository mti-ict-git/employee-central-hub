import { UseFormReturn } from "react-hook-form";
import { EmployeeFormData } from "@/lib/employeeSchema";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmploymentStepProps {
  form: UseFormReturn<EmployeeFormData>;
}

export function EmploymentStep({ form }: EmploymentStepProps) {
  const employeeType = form.watch("employee_type");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <h3 className="font-semibold mb-1">Employment Details</h3>
        <p className="text-sm text-muted-foreground">
          Configure the employee's position, department, and work details.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="employment_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employment Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                  <SelectItem value="non_active">Non Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {employeeType === "indonesia" && (
          <FormField
            control={form.control}
            name="locality_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Locality Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select locality" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Local">Local</SelectItem>
                    <SelectItem value="Non Local">Non Local</SelectItem>
                    <SelectItem value="Overseas">Overseas</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {employeeType === "expat" && (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="company_office"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Office</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Jakarta Office">Jakarta Office</SelectItem>
                    <SelectItem value="Morowali Office">Morowali Office</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="work_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Location</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Morowali">Morowali</SelectItem>
                    <SelectItem value="IMIP">IMIP</SelectItem>
                    <SelectItem value="Jakarta">Jakarta</SelectItem>
                    <SelectItem value="HO">HO</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {employeeType === "indonesia" && (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Morowali">Morowali</SelectItem>
                    <SelectItem value="Jakarta">Jakarta</SelectItem>
                    <SelectItem value="Surabaya">Surabaya</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branch_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch ID</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. MTI-SITE-01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          control={form.control}
          name="division"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Division *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ICT">ICT</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Operation">Operation</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Support Services">Support Services</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="section"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Section</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="IT Support">IT Support</SelectItem>
                  <SelectItem value="Networking">Networking</SelectItem>
                  <SelectItem value="System">System</SelectItem>
                  <SelectItem value="Mechanical">Mechanical</SelectItem>
                  <SelectItem value="Accounting">Accounting</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="job_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Title *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. ICT Supervisor" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="direct_report"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Direct Report (Supervisor)</FormLabel>
              <FormControl>
                <Input placeholder="Supervisor name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          control={form.control}
          name="grade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grade</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((g) => (
                    <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="position_grade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position Grade</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select position grade" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="NonStaff">Non-Staff</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="group_job_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Group Job Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. System Analyst" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
