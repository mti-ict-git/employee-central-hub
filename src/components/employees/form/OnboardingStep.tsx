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

interface OnboardingStepProps {
  form: UseFormReturn<EmployeeFormData>;
}

export function OnboardingStep({ form }: OnboardingStepProps) {
  const employeeType = form.watch("employee_type");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <h3 className="font-semibold mb-1">Onboarding Information</h3>
        <p className="text-sm text-muted-foreground">
          Configure hiring details and schedule information.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="point_of_hire"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Point of Hire</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Jakarta" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="point_of_origin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Point of Origin</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Surabaya" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="schedule_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Schedule Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Shift">Shift</SelectItem>
                <SelectItem value="Non-Shift">Non-Shift</SelectItem>
                <SelectItem value="Office Hours">Office Hours</SelectItem>
                <SelectItem value="Roster 6:2">Roster 6:2</SelectItem>
                <SelectItem value="Roster 8:2">Roster 8:2</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {employeeType === "indonesia" && (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="first_join_date_merdeka"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Join Date (Merdeka Group)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="transfer_merdeka"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transfer Merdeka Group</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="first_join_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Join Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="join_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Join Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="end_contract"
        render={({ field }) => (
          <FormItem>
            <FormLabel>End Contract Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
