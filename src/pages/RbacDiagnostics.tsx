import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ColumnInfo = { COLUMN_NAME: string; DATA_TYPE: string };

export default function RbacDiagnostics() {
  const [rpCols, setRpCols] = useState<ColumnInfo[]>([]);
  const [rpSample, setRpSample] = useState<Record<string, unknown>[]>([]);
  const [rolesCols, setRolesCols] = useState<ColumnInfo[]>([]);
  const [rolesSample, setRolesSample] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const expectedRP = ["role","module","action","allowed"];
  const load = async () => {
    try {
      setLoading(true);
      const [rp, rs] = await Promise.all([
        apiFetch(`/rbac/schema/role_permissions`, { credentials: "include" }),
        apiFetch(`/rbac/schema/roles`, { credentials: "include" }),
      ]);
      const rpData = await rp.json().catch(() => ({ columns: [], sample: [] }));
      const rsData = await rs.json().catch(() => ({ columns: [], sample: [] }));
      setRpCols(rpData.columns || []);
      setRpSample(rpData.sample || []);
      setRolesCols(rsData.columns || []);
      setRolesSample(rsData.sample || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const rpNames = rpCols.map(c => c.COLUMN_NAME.toLowerCase());
  const missing = expectedRP.filter(n => !rpNames.includes(n));
  return (
    <MainLayout title="RBAC Diagnostics" subtitle="Inspect database schemas and sample data">
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex justify-end mb-4">
          <Button onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
        </div>
        <h3 className="text-sm font-semibold mb-2">role_permissions columns</h3>
        <div className="text-xs mb-4">
          {rpCols.length ? rpCols.map(c => (
            <span key={c.COLUMN_NAME} className="inline-block mr-2 mb-1 px-2 py-1 rounded bg-muted">{c.COLUMN_NAME} ({c.DATA_TYPE})</span>
          )) : <span className="text-muted-foreground">No columns detected</span>}
        </div>
        <p className="text-xs mb-4">Expected columns: role, module, action, allowed</p>
        {missing.length > 0 && (
          <p className="text-xs text-destructive mb-4">Missing expected columns: {missing.join(", ")}</p>
        )}
        <h3 className="text-sm font-semibold mb-2">role_permissions sample</h3>
        <div className="text-xs mb-6">
          {rpSample.length ? (
            <pre className="rounded bg-muted p-3 overflow-auto">{JSON.stringify(rpSample, null, 2)}</pre>
          ) : <span className="text-muted-foreground">No rows</span>}
        </div>

        <h3 className="text-sm font-semibold mb-2">roles columns</h3>
        <div className="text-xs mb-4">
          {rolesCols.length ? rolesCols.map(c => (
            <span key={c.COLUMN_NAME} className="inline-block mr-2 mb-1 px-2 py-1 rounded bg-muted">{c.COLUMN_NAME} ({c.DATA_TYPE})</span>
          )) : <span className="text-muted-foreground">No columns detected</span>}
        </div>
        <h3 className="text-sm font-semibold mb-2">roles sample</h3>
        <div className="text-xs">
          {rolesSample.length ? (
            <pre className="rounded bg-muted p-3 overflow-auto">{JSON.stringify(rolesSample, null, 2)}</pre>
          ) : <span className="text-muted-foreground">No rows</span>}
        </div>
      </div>
    </MainLayout>
  );
}
