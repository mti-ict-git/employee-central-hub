import { UseFormReturn } from "react-hook-form";
import { EmployeeFormData } from "@/lib/employeeSchema";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface BankInsuranceStepProps {
  form: UseFormReturn<EmployeeFormData>;
}

export function BankInsuranceStep({ form }: BankInsuranceStepProps) {
  const employeeType = form.watch("employee_type");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <h3 className="font-semibold mb-1">Bank & Insurance</h3>
        <p className="text-sm text-muted-foreground">
          Configure bank account and insurance details.
        </p>
      </div>

      {/* Bank Details */}
      <div className="border-b border-border pb-6">
        <h4 className="font-medium mb-4">Bank Account</h4>
        
        {employeeType === "indonesia" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRI">BRI</SelectItem>
                        <SelectItem value="BNI">BNI</SelectItem>
                        <SelectItem value="BCA">BCA</SelectItem>
                        <SelectItem value="Mandiri">Mandiri</SelectItem>
                        <SelectItem value="ICBC">ICBC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Account holder name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account No</FormLabel>
                    <FormControl>
                      <Input placeholder="Account number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="bank_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Code</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank code" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="014">014 - BCA</SelectItem>
                        <SelectItem value="009">009 - BNI</SelectItem>
                        <SelectItem value="002">002 - BRI</SelectItem>
                        <SelectItem value="008">008 - Mandiri</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icbc_bank_account_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ICBC Bank Account No</FormLabel>
                    <FormControl>
                      <Input placeholder="ICBC account number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="icbc_username"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>ICBC Username</FormLabel>
                  <FormControl>
                    <Input placeholder="ICBC username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>

      {/* Tax */}
      <div className="border-b border-border pb-6">
        <h4 className="font-medium mb-4">Tax Information</h4>
        <FormField
          control={form.control}
          name="npwp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NPWP</FormLabel>
              <FormControl>
                <Input placeholder="e.g. 09.123.456.7-890.000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* BPJS */}
      <div className="border-b border-border pb-6">
        <h4 className="font-medium mb-4">BPJS Information</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="bpjs_tk"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BPJS TK No</FormLabel>
                <FormControl>
                  <Input placeholder="BPJS Ketenagakerjaan number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bpjs_kes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BPJS KES No</FormLabel>
                <FormControl>
                  <Input placeholder="BPJS Kesehatan number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status_bpjs_kes"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>Status BPJS Kesehatan</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Non Active">Non Active</SelectItem>
                  <SelectItem value="PBI">PBI</SelectItem>
                  <SelectItem value="Not Registered">Not Registered</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Insurance Cards */}
      <div>
        <h4 className="font-medium mb-4">Insurance Cards</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="insurance_endorsement"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Insurance Endorsement</FormLabel>
                  <FormDescription>
                    Has endorsement coverage
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="insurance_owlexa"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Insurance Card Owlexa</FormLabel>
                  <FormDescription>
                    Has Owlexa card
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="insurance_fpg"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Insurance Card FPG</FormLabel>
                  <FormDescription>
                    Has FPG card
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
