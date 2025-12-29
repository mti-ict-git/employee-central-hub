import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, UserCog, Shield, KeyRound, Trash, Pencil, RefreshCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

const UserManagement = () => {
  const [activeTab, setActiveTab] = useState("manage");
  const [users, setUsers] = useState<Array<{
    id: number;
    username: string;
    displayName: string;
    department: string;
    role: string;
    status: "active" | "inactive";
    source: "LOCAL" | "DOMAIN";
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/users?limit=2000`, { signal: ctrl.signal, credentials: "include" });
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setUsers(items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "FAILED_TO_FETCH_USERS");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, []);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<null | {
    id: number;
    username: string;
    displayName: string;
    role: string;
    department: string;
    status: "active" | "inactive";
    source: "LOCAL" | "DOMAIN";
  }>(null);
  const canSeeSuperadmin = (() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
      const parsed = stored ? JSON.parse(stored) : null;
      const rolesRaw: string[] = Array.isArray(parsed?.roles) ? parsed.roles : (parsed?.role ? [parsed.role] : []);
      const roles = rolesRaw.map((r) => String(r || "").trim().toLowerCase());
      return roles.some((r) => r.includes("super"));
    } catch {
      return false;
    }
  })();
  const roleOptions = [
    ...(canSeeSuperadmin ? [{ value: "SUPERADMIN", label: "Super Admin" }] : []),
    { value: "ADMIN", label: "Admin" },
    { value: "HR GENERAL", label: "HR General" },
    { value: "FINANCE", label: "Finance" },
    { value: "DEP REP", label: "Dep Rep" },
  ];
  const normalizeRole = (r: string): string => {
    const s = r.trim().toLowerCase().replace(/\s+/g, "_");
    if (s.includes("super")) return "SUPERADMIN";
    if (s === "admin") return "ADMIN";
    if (s === "hr_general" || s.includes("hr")) return "HR GENERAL";
    if (s === "finance") return "FINANCE";
    if (s === "dep_rep" || s.includes("dep")) return "DEP REP";
    return r.toUpperCase();
  };
  const openEdit = (u: { id: number; username: string; displayName: string; role: string; department: string; status: "active" | "inactive"; source: "LOCAL" | "DOMAIN" }) => {
    setEditUser({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: normalizeRole(u.role),
      department: u.department,
      status: u.status,
      source: u.source,
    });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!editUser) return;
    try {
      const res = await apiFetch(`/users/${editUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editUser.displayName,
          role: editUser.role,
          department: editUser.department,
          status: editUser.status,
        }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...editUser } : u)));
      setEditOpen(false);
      toast({ title: "Updated", description: "User information updated" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update user", variant: "destructive" });
    }
  };
  const changeRole = async (userId: number, currentRole: string) => {
    const next = window.prompt("Enter new role", currentRole) || "";
    const role = next.trim();
    if (!role || role === currentRole) return;
    try {
      const res = await apiFetch(`/users/${userId}/role`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast({ title: "Role Updated", description: `Role changed to ${role}` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update role", variant: "destructive" });
    }
  };
  const toggleLock = async (userId: number, status: "active" | "inactive") => {
    const lock = status === "active";
    try {
      const res = await apiFetch(`/users/${userId}/lock`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lock }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const nextStatus: "active" | "inactive" = lock ? "inactive" : "active";
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
      toast({ title: lock ? "User Deactivated" : "User Activated", description: `User status is ${nextStatus}` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update status", variant: "destructive" });
    }
  };
  const deleteUser = async (userId: number, label: string) => {
    const ok = window.confirm(`Delete user ${label}?`);
    if (!ok) return;
    try {
      const res = await apiFetch(`/users/${userId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: "Deleted", description: `User ${label} deleted` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete user", variant: "destructive" });
    }
  };
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<null | { id: number; username: string; source: "LOCAL" | "DOMAIN" }>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const openReset = (userId: number, username: string, source: "LOCAL" | "DOMAIN") => {
    if (source !== "LOCAL") {
      toast({ title: "Not Allowed", description: "Password reset is only available for LOCAL users", variant: "destructive" });
      return;
    }
    setResetUser({ id: userId, username, source });
    setNewPassword("");
    setConfirmPassword("");
    setResetOpen(true);
  };
  const doResetPassword = async () => {
    if (!resetUser) return;
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Weak Password", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    try {
      const res = await apiFetch(`/users/${resetUser.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      setResetOpen(false);
      toast({ title: "Password Reset", description: `Password for @${resetUser.username} updated` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reset password", variant: "destructive" });
    }
  };
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState<{
    source: "LOCAL" | "DOMAIN";
    username: string;
    displayName: string;
    role: string;
    department: string;
    status: "active" | "inactive";
    password?: string;
  }>({
    source: "LOCAL",
    username: "",
    displayName: "",
    role: "ADMIN",
    department: "",
    status: "active",
    password: "",
  });
  const openAddUser = () => {
    setNewUser({ source: "LOCAL", username: "", displayName: "", role: "ADMIN", department: "", status: "active", password: "" });
    setAddOpen(true);
  };
  const createUser = async () => {
    if (!newUser.username || !newUser.displayName || !newUser.role || !newUser.department) {
      toast({ title: "Validation", description: "Fill all required fields", variant: "destructive" });
      return;
    }
    if (newUser.source === "LOCAL" && (!newUser.password || newUser.password.length < 8)) {
      toast({ title: "Validation", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    try {
      const res = await apiFetch(`/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUser.username,
          displayName: newUser.displayName,
          role: newUser.role,
          department: newUser.department,
          source: newUser.source,
          status: newUser.status,
          password: newUser.source === "LOCAL" ? newUser.password : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP_${res.status}`);
      setUsers((prev) => [{ id: data.id, username: data.username, displayName: data.displayName, department: data.department, role: data.role, status: data.status, source: data.source }, ...prev]);
      setAddOpen(false);
      toast({ title: "User Created", description: `@${data.username}` });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create user", variant: "destructive" });
    }
  };
  return (
    <MainLayout title="User Management" subtitle="Manage users, roles, and permissions">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger value="manage" className="gap-2">
            <UserCog className="h-4 w-4" />
            Manage Users Account
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Roles & Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manage">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="font-semibold">System Users</span>
            </div>
            <Button onClick={openAddUser}>
              Add User
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Manage user accounts, roles, and permissions</CardTitle>
              <CardDescription>Local users and Active Directory users</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
                  <p className="text-muted-foreground">Loading users...</p>
                </div>
              ) : error ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
                  <p className="text-muted-foreground">Failed to load users ({error}).</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => {
                    const isCritical = u.role.toUpperCase() === "SUPERADMIN";
                    return (
                      <div key={`${u.id}-${u.username}`} className={`flex items-center justify-between rounded-xl border ${isCritical ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"} p-4`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isCritical ? "bg-destructive/10" : "bg-primary/10"}`}>
                            <Users className={`h-5 w-5 ${isCritical ? "text-destructive" : "text-primary"}`} />
                          </div>
                          <div>
                            <p className="font-medium">{u.displayName}</p>
                            <p className="text-sm text-muted-foreground">@{u.username} • {u.department}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isCritical ? "destructive" : "secondary"}>{u.role}</Badge>
                          <Badge className="bg-blue-500/10 text-blue-600">{u.status}</Badge>
                          <Badge className={u.source === "DOMAIN" ? "bg-pink-500/10 text-pink-600" : "bg-muted text-foreground"}>{u.source}</Badge>
                          <Button variant="outline" size="icon" title="Edit" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Reset Password" disabled={u.source !== "LOCAL"} onClick={() => openReset(u.id, u.username, u.source)}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title={u.status === "active" ? "Deactivate" : "Activate"} onClick={() => toggleLock(u.id, u.status)}>
                            <RefreshCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" title="Delete" onClick={() => deleteUser(u.id, u.username)}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {users.length === 0 && (
                    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
                      <p className="text-muted-foreground">No users found.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>Configure roles and access control</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Define role membership and column-level permissions. Integration with AD groups is supported.
                </p>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted p-3">
                <p className="text-sm">
                  Authentication: <span className="font-semibold">{editUser.source === "DOMAIN" ? "Domain" : "Local"}</span>
                  {editUser.source === "DOMAIN" && <> (AD: {editUser.username})</>}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editUser.displayName} onChange={(e) => setEditUser({ ...editUser, displayName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editUser.role} onValueChange={(v) => setEditUser({ ...editUser, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={editUser.department} onChange={(e) => setEditUser({ ...editUser, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editUser.status} onValueChange={(v) => setEditUser({ ...editUser, status: v as "active" | "inactive" })}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Update User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new Local account. Domain users are auto-provisioned on first login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted p-3">
              <p className="text-sm">Authentication: <span className="font-semibold">Local</span></p>
              <p className="text-xs text-muted-foreground">Domain users do not need to be added here; they are created automatically when they sign in and belong to configured AD groups.</p>
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newUser.status} onValueChange={(v) => setNewUser({ ...newUser, status: v as "active" | "inactive" })}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newUser.source === "LOCAL" && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={createUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for the selected user (LOCAL only)</DialogDescription>
          </DialogHeader>
          {resetUser && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted p-3">
                <p className="text-sm">User: @{resetUser.username}</p>
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={doResetPassword} disabled={!newPassword || !confirmPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default UserManagement;
