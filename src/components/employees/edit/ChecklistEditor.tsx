import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Info } from "lucide-react";
import type { EmployeeChecklist, EmployeeType, EmployeeStatus } from "@/types/employee";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChecklistItem {
  key: keyof Omit<EmployeeChecklist, 'employee_id'>;
  label: string;
  description: string;
  showForIndActive: boolean;
  showForIndInactive: boolean;
  showForExpActive: boolean;
  showForExpInactive: boolean;
}

// Based on the Excel checklist mapping
const checklistItems: ChecklistItem[] = [
  {
    key: 'passport_checklist',
    label: 'Passport',
    description: 'Passport document has been collected and verified',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'kitas_checklist',
    label: 'KITAS',
    description: 'KITAS (Limited Stay Permit) document verified',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'imta_checklist',
    label: 'IMTA',
    description: 'IMTA (Work Permit) has been processed',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'rptka_checklist',
    label: 'RPTKA',
    description: 'RPTKA (Foreign Workforce Utilization Plan) approved',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'npwp_checklist',
    label: 'NPWP',
    description: 'Tax ID number registered and verified',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'bpjs_kes_checklist',
    label: 'BPJS Kesehatan',
    description: 'Health insurance (BPJS KES) enrollment completed',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'bpjs_tk_checklist',
    label: 'BPJS Ketenagakerjaan',
    description: 'Employment insurance (BPJS TK) enrollment completed',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
  {
    key: 'bank_checklist',
    label: 'Bank Account',
    description: 'Bank account for salary payment set up',
    showForIndActive: false,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: false,
  },
];

// Insurance items from the Excel file
interface InsuranceChecklistItem {
  key: 'insurance_endorsement' | 'insurance_owlexa' | 'insurance_fpg';
  label: string;
  description: string;
  showForIndActive: boolean;
  showForIndInactive: boolean;
  showForExpActive: boolean;
  showForExpInactive: boolean;
}

const insuranceItems: InsuranceChecklistItem[] = [
  {
    key: 'insurance_endorsement',
    label: 'Insurance Endorsement',
    description: 'Employee added to company insurance policy',
    showForIndActive: true,
    showForIndInactive: false,
    showForExpActive: true,
    showForExpInactive: true,
  },
  {
    key: 'insurance_owlexa',
    label: 'Insurance Card Owlexa',
    description: 'Owlexa insurance card issued',
    showForIndActive: true,
    showForIndInactive: true,
    showForExpActive: true,
    showForExpInactive: true,
  },
  {
    key: 'insurance_fpg',
    label: 'Insurance Card FPG',
    description: 'FPG insurance card issued',
    showForIndActive: true,
    showForIndInactive: true,
    showForExpActive: true,
    showForExpInactive: true,
  },
];

// Blacklist items
interface BlacklistItem {
  key: 'blacklist_mti' | 'blacklist_imip';
  label: string;
  description: string;
  showForIndActive: boolean;
  showForIndInactive: boolean;
  showForExpActive: boolean;
  showForExpInactive: boolean;
}

const blacklistItems: BlacklistItem[] = [
  {
    key: 'blacklist_mti',
    label: 'Blacklist MTI',
    description: 'Employee is blacklisted from MTI',
    showForIndActive: false,
    showForIndInactive: true,
    showForExpActive: false,
    showForExpInactive: false,
  },
  {
    key: 'blacklist_imip',
    label: 'Blacklist IMIP',
    description: 'Employee is blacklisted from IMIP',
    showForIndActive: false,
    showForIndInactive: true,
    showForExpActive: false,
    showForExpInactive: false,
  },
];

interface ChecklistEditorProps {
  checklist: EmployeeChecklist;
  insurance: {
    insurance_endorsement?: boolean;
    insurance_owlexa?: boolean;
    insurance_fpg?: boolean;
  };
  employment: {
    blacklist_mti?: boolean;
    blacklist_imip?: boolean;
  };
  core: {
    id_card_mti?: boolean;
  };
  employeeType: EmployeeType;
  employeeStatus: EmployeeStatus;
  canWrite?: (section: string, column: string) => boolean;
  onChecklistChange: (key: keyof EmployeeChecklist, value: boolean) => void;
  onInsuranceChange: (key: 'insurance_endorsement' | 'insurance_owlexa' | 'insurance_fpg', value: boolean) => void;
  onEmploymentChange: (key: 'blacklist_mti' | 'blacklist_imip', value: boolean) => void;
  onCoreChange: (key: 'id_card_mti', value: boolean) => void;
}

export const ChecklistEditor = ({
  checklist,
  insurance,
  employment,
  core,
  employeeType,
  employeeStatus,
  canWrite,
  onChecklistChange,
  onInsuranceChange,
  onEmploymentChange,
  onCoreChange,
}: ChecklistEditorProps) => {
  const isApplicable = (item: { 
    showForIndActive: boolean; 
    showForIndInactive: boolean; 
    showForExpActive: boolean; 
    showForExpInactive: boolean; 
  }) => {
    if (employeeType === 'indonesia' && employeeStatus === 'active') return item.showForIndActive;
    if (employeeType === 'indonesia' && employeeStatus === 'inactive') return item.showForIndInactive;
    if (employeeType === 'expat' && employeeStatus === 'active') return item.showForExpActive;
    if (employeeType === 'expat' && employeeStatus === 'inactive') return item.showForExpInactive;
    return false;
  };

  const applicableChecklistItems = checklistItems.filter(isApplicable);
  const applicableInsuranceItems = insuranceItems.filter(isApplicable);
  const applicableBlacklistItems = blacklistItems.filter(isApplicable);
  const showIdCardMti = (employeeType === 'indonesia' && employeeStatus === 'inactive');

  const completedCount = 
    applicableChecklistItems.filter(item => checklist[item.key]).length +
    applicableInsuranceItems.filter(item => insurance[item.key]).length;
  
  const totalCount = applicableChecklistItems.length + applicableInsuranceItems.length;

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={employeeType === 'indonesia' ? 'default' : 'secondary'}>
            {employeeType === 'indonesia' ? 'Indonesia' : 'Expatriate'}
          </Badge>
          <Badge 
            className={cn(
              employeeStatus === 'active' 
                ? "bg-success/10 text-success" 
                : "bg-destructive/10 text-destructive"
            )}
          >
            {employeeStatus === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        {totalCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {completedCount} / {totalCount} completed
          </span>
        )}
      </div>

      {/* Document Checklist */}
      {applicableChecklistItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Document Checklist</CardTitle>
            </div>
            <CardDescription>
              Track required documents for this employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {applicableChecklistItems.map((item) => (
                <ChecklistItemRow
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  checked={!!checklist[item.key]}
                  disabled={canWrite ? !canWrite("checklist", String(item.key)) : false}
                  onChange={(checked) => {
                    if (canWrite && !canWrite("checklist", String(item.key))) return;
                    onChecklistChange(item.key, checked);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insurance Checklist */}
      {applicableInsuranceItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Insurance Status</CardTitle>
            </div>
            <CardDescription>
              Insurance enrollment and card status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {applicableInsuranceItems.map((item) => (
                <ChecklistItemRow
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  checked={!!insurance[item.key]}
                  disabled={canWrite ? !canWrite("insurance", item.key) : false}
                  onChange={(checked) => {
                    if (canWrite && !canWrite("insurance", item.key)) return;
                    onInsuranceChange(item.key, checked);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ID Card MTI */}
      {showIdCardMti && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">ID Card</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ChecklistItemRow
              label="ID Card MTI"
              description="MTI ID Card has been issued"
              checked={!!core.id_card_mti}
              disabled={canWrite ? !canWrite("core", "id_card_mti") : false}
              onChange={(checked) => {
                if (canWrite && !canWrite("core", "id_card_mti")) return;
                onCoreChange('id_card_mti', checked);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Blacklist Items */}
      {applicableBlacklistItems.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base text-destructive">Blacklist Status</CardTitle>
            </div>
            <CardDescription>
              Blacklist flags for terminated employees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {applicableBlacklistItems.map((item) => (
                <ChecklistItemRow
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  checked={!!employment[item.key]}
                  disabled={canWrite ? !canWrite("employment", item.key) : false}
                  onChange={(checked) => {
                    if (canWrite && !canWrite("employment", item.key)) return;
                    onEmploymentChange(item.key, checked);
                  }}
                  variant="destructive"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {applicableChecklistItems.length === 0 && 
       applicableInsuranceItems.length === 0 && 
       applicableBlacklistItems.length === 0 &&
       !showIdCardMti && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No checklist items applicable for this employee type and status.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface ChecklistItemRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

const ChecklistItemRow = ({ label, description, checked, onChange, variant = 'default', disabled = false }: ChecklistItemRowProps) => (
  <TooltipProvider>
    <div 
      className={cn(
        "flex items-start space-x-3 rounded-lg border p-4 transition-colors",
        checked 
          ? variant === 'destructive' 
            ? "border-destructive/50 bg-destructive/5" 
            : "border-primary/50 bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
    >
      <Checkbox 
        checked={checked} 
        onCheckedChange={onChange}
        disabled={disabled}
        className={cn(
          "mt-0.5",
          variant === 'destructive' && "data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
        )}
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Label className={cn("font-medium", !disabled && "cursor-pointer")}>{label}</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  </TooltipProvider>
);
