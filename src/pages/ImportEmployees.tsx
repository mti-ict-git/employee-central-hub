import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  User,
  Globe,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  indonesiaTemplateColumns,
  expatTemplateColumns,
  indonesiaSampleData,
  expatSampleData,
  generateCSV,
  downloadCSV,
} from "@/lib/csvTemplates";

interface ParsedEmployee {
  data: Record<string, string>;
  errors: string[];
  isValid: boolean;
}

type ImportResult = {
  employee_id: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  action?: "inserted" | "updated" | "skipped" | "no_change";
};

const requiredFields = {
  indonesia: ["employee_id", "name", "gender", "nationality", "phone_number", "division", "department", "job_title", "join_date"],
  expat: ["employee_id", "name", "gender", "nationality", "phone_number", "division", "department", "job_title", "join_date"],
};

const normalizeDate = (v: string | undefined): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    const y = m[3];
    const dd = d1 > 12 ? d1 : d2;
    const mm = d1 > 12 ? d2 : d1;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return `${y}-${pad(mm)}-${pad(dd)}`;
  }
  return null;
};

const validateRow = (row: Record<string, string>, type: "indonesia" | "expat"): string[] => {
  const errors: string[] = [];
  const required = requiredFields[type];

  required.forEach((field) => {
    if (!row[field] || row[field].trim() === "") {
      errors.push(`${field} is required`);
    }
  });

  if (row.gender && !["Male", "Female"].includes(row.gender)) {
    errors.push("Gender must be 'Male' or 'Female'");
  }

  if (row.employment_status) {
    const normalized = String(row.employment_status)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_")
      .replace(/__+/g, "_");
    const mapped =
      normalized === "internship"
        ? "intern"
        : normalized === "permanent"
        ? "active"
        : normalized === "inactive" || normalized === "nonactive" || normalized === "not_active"
        ? "non_active"
        : normalized === "non_active"
        ? "non_active"
        : normalized;
    const allowed = ["suspended", "retired", "terminated", "non_active", "intern", "contract", "probation", "active"];
    if (!allowed.includes(mapped)) {
      errors.push("Invalid employment status");
    }
  }

  const dateFields = [
    "date_of_birth",
    "join_date",
    "first_join_date",
    "end_contract",
    "terminated_date",
    "passport_expiry",
    "kitas_expiry",
    "first_join_date_merdeka",
    "travel_in",
    "travel_out",
  ];
  dateFields.forEach((field) => {
    if (row[field] && !/^\d{4}-\d{2}-\d{2}$/.test(row[field])) {
      const n = normalizeDate(row[field]);
      if (n) {
        row[field] = n;
        return;
      }
      errors.push(`${field} should be in YYYY-MM-DD format`);
    }
  });

  if (row.grade && row.grade.trim() !== "") {
    const g = Number(row.grade);
    if (!Number.isFinite(g) || g < 7 || g > 22) {
      errors.push("grade must be between 7 and 22");
    }
  }

  if (row.status && row.status.trim() !== "") {
    const normalized = String(row.status).trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_").replace(/__+/g, "_");
    const mapped =
      normalized === "resigned" ? "resign" :
      normalized === "non_active" || normalized === "nonactive" ? "inactive" :
      normalized;
    const allowed = ["active", "inactive", "resign", "terminated"];
    if (!allowed.includes(mapped)) {
      errors.push("Invalid status");
    }
    if (mapped === "terminated") {
      if (!row.terminated_type || row.terminated_type.trim() === "") {
        errors.push("terminated_type is required when status is terminated");
      }
      if (!row.terminated_date || row.terminated_date.trim() === "") {
        errors.push("terminated_date is required when status is terminated");
      }
    }
  }

  return errors;
};

const ImportEmployees = () => {
  const navigate = useNavigate();
  const [employeeType, setEmployeeType] = useState<"indonesia" | "expat">("indonesia");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [onExist, setOnExist] = useState<"update" | "skip" | "error">("update");
  const [updateMode, setUpdateMode] = useState<"overwrite" | "only_filled">("only_filled");
  const [dryRun, setDryRun] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt"].includes(fileExtension || "")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ParsedEmployee[] = results.data.map((row: Record<string, string>) => {
          const errors = validateRow(row, employeeType);
          return {
            data: row,
            errors,
            isValid: errors.length === 0,
          };
        });
        setParsedData(parsed);
        setIsUploading(false);

        const validCount = parsed.filter((p) => p.isValid).length;
        const invalidCount = parsed.filter((p) => !p.isValid).length;

        toast({
          title: "File parsed successfully",
          description: `${validCount} valid, ${invalidCount} with errors out of ${parsed.length} records.`,
        });
      },
      error: (error) => {
        setIsUploading(false);
        toast({
          title: "Error parsing file",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  }, [employeeType]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDownloadTemplate = (type: "indonesia" | "expat", withSample: boolean) => {
    const columns = type === "indonesia" ? indonesiaTemplateColumns : expatTemplateColumns;
    const data = withSample
      ? type === "indonesia"
        ? indonesiaSampleData
        : expatSampleData
      : [];
    const csv = generateCSV(columns, data);
    const filename = withSample
      ? `employee_${type}_template_with_sample.csv`
      : `employee_${type}_template.csv`;
    downloadCSV(csv, filename);

    toast({
      title: "Template downloaded",
      description: `${filename} has been downloaded.`,
    });
  };

  const handleImport = async () => {
    const validRecords = parsedData.filter((p) => p.isValid);
    if (validRecords.length === 0) {
      toast({
        title: "No valid records",
        description: "Please fix the errors before importing.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const rows = validRecords.map(v => v.data);
      const params = new URLSearchParams();
      params.set("on_exist", onExist);
      params.set("update_mode", updateMode);
      if (dryRun) params.set("dry_run", "1");
      const qs = params.toString();
      const res = await apiFetch(`/employees/import${qs ? `?${qs}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const json: {
        success: number;
        failed: number;
        skipped?: number;
        inserted?: number;
        updated?: number;
        total: number;
        results?: ImportResult[];
        dry_run?: boolean;
      } = await res.json();

      toast({
        title: json.dry_run ? "Dry run completed" : "Import completed",
        description: `${json.inserted || 0} inserted, ${json.updated || 0} updated, ${json.skipped || 0} skipped, ${json.failed} failed out of ${json.total}.`,
      });
      const results: ImportResult[] = Array.isArray(json.results) ? (json.results as ImportResult[]) : [];
      if (results.some((r) => r.status === "failed")) {
        console.warn("Import results", results);
      }

      if (!json.dry_run) navigate("/employees");
    } catch (error) {
      toast({
        title: "Import failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setParsedData([]);
  };

  const validCount = parsedData.filter((p) => p.isValid).length;
  const invalidCount = parsedData.filter((p) => !p.isValid).length;

  return (
    <MainLayout title="Import Employees" subtitle="Bulk upload employee data from CSV">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/employees")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Employee List
        </Button>

        {/* Step 1: Select Type & Download Template */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                1
              </span>
              Download Template
            </CardTitle>
            <CardDescription>
              Select employee type and download the CSV template with the correct columns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Employee Type Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Employee Type</label>
                <Select
                  value={employeeType}
                  onValueChange={(v) => {
                    setEmployeeType(v as "indonesia" | "expat");
                    handleClearFile();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indonesia">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Indonesia Employee
                      </div>
                    </SelectItem>
                    <SelectItem value="expat">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Expatriate Employee
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDownloadTemplate(employeeType, false)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Empty Template
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleDownloadTemplate(employeeType, true)}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Template with Sample
                </Button>
              </div>
            </div>

            {/* Template Info */}
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Template Information
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• File format: CSV (comma-separated values)</li>
                <li>• Date format: YYYY-MM-DD (e.g., 2024-01-15)</li>
                <li>• Boolean fields: Use 0 for No, 1 for Yes</li>
                <li>
                  • Required fields:{" "}
                  <span className="font-medium text-foreground">
                    {requiredFields[employeeType].join(", ")}
                  </span>
                </li>
                <li>
                  • Total columns:{" "}
                  <span className="font-medium text-foreground">
                    {employeeType === "indonesia"
                      ? indonesiaTemplateColumns.length
                      : expatTemplateColumns.length}
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Upload File */}
        <Card className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                2
              </span>
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Upload your filled CSV template to preview and validate the data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">
                  Drag and drop your CSV file here
                </h3>
                <p className="text-muted-foreground mb-4">or click to browse</p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileSelect(selectedFile);
                  }}
                />
                <Button asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Select File
                  </label>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClearFile}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Summary */}
                {parsedData.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border p-4 text-center">
                      <p className="text-2xl font-bold">{parsedData.length}</p>
                      <p className="text-sm text-muted-foreground">Total Records</p>
                    </div>
                    <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                      <p className="text-2xl font-bold text-success">{validCount}</p>
                      <p className="text-sm text-muted-foreground">Valid</p>
                    </div>
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                      <p className="text-2xl font-bold text-destructive">{invalidCount}</p>
                      <p className="text-sm text-muted-foreground">With Errors</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Preview & Import */}
        {parsedData.length > 0 && (
          <Card className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  3
                </span>
                Preview & Import
              </CardTitle>
              <CardDescription>
                Review the parsed data and import valid records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium block">If employee exists</label>
                  <Select
                    value={onExist}
                    onValueChange={(v) => setOnExist(v === "skip" ? "skip" : v === "error" ? "error" : "update")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="skip">Skip</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Update behavior</label>
                  <Select
                    value={updateMode}
                    onValueChange={(v) => setUpdateMode(v === "overwrite" ? "overwrite" : "only_filled")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="only_filled">Update only filled columns</SelectItem>
                      <SelectItem value="overwrite">Overwrite with blanks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Dry run</label>
                  <div className="flex items-center gap-2 h-10 rounded-md border border-input px-3">
                    <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
                    <span className="text-sm text-muted-foreground">No database changes</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Join Date</TableHead>
                        <TableHead className="w-48">Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 50).map((row, index) => (
                        <TableRow
                          key={index}
                          className={cn(!row.isValid && "bg-destructive/5")}
                        >
                          <TableCell>
                            {row.isValid ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.data.employee_id || "-"}
                          </TableCell>
                          <TableCell>{row.data.name || "-"}</TableCell>
                          <TableCell>{row.data.department || "-"}</TableCell>
                          <TableCell>{row.data.job_title || "-"}</TableCell>
                          <TableCell>{row.data.join_date || "-"}</TableCell>
                          <TableCell>
                            {row.errors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {row.errors.slice(0, 2).map((err, i) => (
                                  <Badge
                                    key={i}
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    {err}
                                  </Badge>
                                ))}
                                {row.errors.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{row.errors.length - 2} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedData.length > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t border-border">
                    Showing first 50 records of {parsedData.length}
                  </div>
                )}
              </div>

              {/* Import Button */}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={handleClearFile}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {dryRun ? "Dry Run" : "Import"} {validCount} Employee{validCount !== 1 && "s"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default ImportEmployees;
