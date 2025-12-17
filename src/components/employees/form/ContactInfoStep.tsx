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

interface ContactInfoStepProps {
  form: UseFormReturn<EmployeeFormData>;
}

export function ContactInfoStep({ form }: ContactInfoStepProps) {
  const employeeType = form.watch("employee_type");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <h3 className="font-semibold mb-1">Contact Information</h3>
        <p className="text-sm text-muted-foreground">
          Enter the employee's contact details and identification numbers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="phone_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Phone *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. 081234567890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="e.g. john@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (KTP)</FormLabel>
              <FormControl>
                <Input placeholder="Enter full address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Jakarta Barat" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Identification - mainly for Indonesia */}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="ktp_no"
          render={({ field }) => (
            <FormItem>
              <FormLabel>KTP No</FormLabel>
              <FormControl>
                <Input placeholder="e.g. 3174XXXXXXXX" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {employeeType === "indonesia" && (
          <FormField
            control={form.control}
            name="kartu_keluarga_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kartu Keluarga No</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 3275XXXXXXXX" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {/* Family Information - mainly for Indonesia */}
      {employeeType === "indonesia" && (
        <>
          <div className="border-t border-border pt-6 mt-6">
            <h4 className="font-medium mb-4">Family Information</h4>
          </div>

          <FormField
            control={form.control}
            name="spouse_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spouse Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter spouse name if married" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="child_name_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Child 1 Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Child name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="child_name_2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Child 2 Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Child name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="child_name_3"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Child 3 Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Child name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="border-t border-border pt-6 mt-6">
            <h4 className="font-medium mb-4">Emergency Contact</h4>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="emergency_contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Contact name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emergency_contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Contact phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
