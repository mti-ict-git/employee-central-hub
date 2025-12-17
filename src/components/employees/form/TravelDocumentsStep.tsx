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
import { AlertCircle } from "lucide-react";

interface TravelDocumentsStepProps {
  form: UseFormReturn<EmployeeFormData>;
}

export function TravelDocumentsStep({ form }: TravelDocumentsStepProps) {
  const employeeType = form.watch("employee_type");

  if (employeeType !== "expat") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
          <h3 className="font-semibold mb-1">Travel Documents</h3>
          <p className="text-sm text-muted-foreground">
            Travel document information for expatriate employees.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium text-lg mb-2">Not Applicable</h3>
          <p className="text-muted-foreground max-w-md">
            Travel documents are only required for Expatriate employees. 
            This step will be skipped for Indonesia employees.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <h3 className="font-semibold mb-1">Travel Documents</h3>
        <p className="text-sm text-muted-foreground">
          Enter passport, KITAS, and work permit information for expatriate employees.
        </p>
      </div>

      {/* Passport Information */}
      <div className="border-b border-border pb-6">
        <h4 className="font-medium mb-4">Passport Information</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="passport_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Passport No</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. A1234567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name_as_passport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name as Passport</FormLabel>
                <FormControl>
                  <Input placeholder="Full name as per passport" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="passport_expiry"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>Passport Expiry Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* KITAS Information */}
      <div className="border-b border-border pb-6">
        <h4 className="font-medium mb-4">KITAS Information</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="kitas_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>KITAS No</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. KITAS8899" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="kitas_expiry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>KITAS Expiry Date</FormLabel>
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
          name="kitas_address"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>KITAS Address</FormLabel>
              <FormControl>
                <Input placeholder="Address as per KITAS" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="job_title_kitas"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>Job Title (Based on KITAS)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job title" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Engineer">Engineer</SelectItem>
                  <SelectItem value="Specialist">Specialist</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Work Permit Information */}
      <div>
        <h4 className="font-medium mb-4">Work Permit (IMTA/RPTKA)</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="imta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IMTA No</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. IMTA778899" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rptka_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RPTKA No</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. RPTKA556677" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="rptka_position"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>RPTKA Position</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select RPTKA position" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Foreign Expert">Foreign Expert</SelectItem>
                  <SelectItem value="Engineer">Engineer</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
