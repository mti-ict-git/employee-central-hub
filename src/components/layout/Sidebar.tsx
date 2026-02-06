import { cn } from "@/lib/utils";
import { 
  Users, 
  LayoutDashboard, 
  UserPlus, 
  FileText, 
  Settings as SettingsIcon,
  Building2,
  Upload,
  Columns3
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState, type ComponentType } from "react";
import { useRBAC } from "@/hooks/useRBAC";

type IconType = ComponentType<{ className?: string }>;

type NavItem = {
  name: string;
  href?: string;
  icon?: IconType;
  children?: { name: string; href: string; icon?: IconType; roles?: string[] }[];
};

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Employee Management',
    icon: Users,
    children: [
      { name: 'Employee List', href: '/employees', icon: Users },
      { name: 'Add Employee', href: '/employees/new', icon: UserPlus },
      { name: 'Import Data', href: '/employees/import', icon: Upload },
    ],
  },
  { name: 'Reports', href: '/reports', icon: FileText },
  {
    name: 'Settings',
    icon: SettingsIcon,
    children: [
      { name: 'General', href: '/settings', icon: SettingsIcon },
      { name: 'User Management', href: '/settings/users', icon: Users, roles: ['admin', 'superadmin'] },
      { name: 'Role Matrix Permission', href: '/settings/admin-permissions', icon: SettingsIcon, roles: ['admin', 'superadmin'] },
      { name: 'Add Column', href: '/settings/columns/new', icon: Columns3, roles: ['admin', 'superadmin'] },
      { name: 'RBAC Diagnostics', href: '/settings/rbac-diagnostics', icon: SettingsIcon, roles: ['superadmin'] },
      { name: 'Data Sync', href: '/settings/sync', icon: SettingsIcon, roles: ['admin', 'superadmin'] },
    ],
  },
]; 

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const { caps } = useRBAC();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.role) setRole(String(parsed.role).toLowerCase());
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar shadow-2xl transform transition-transform duration-200 ease-linear",
      collapsed ? "-translate-x-full" : "translate-x-0",
    )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/70 bg-sidebar/95 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-sm">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">HRIS</h1>
            <p className="text-xs text-sidebar-foreground/70">Employee Master Data</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 px-3 py-4">
          {navigation.map((item) => {
            // Simple link item
            if (!item.children && item.href) {
              const isActive = location.pathname === item.href;
              if (item.name === 'Reports' && caps && !caps.canAccessReport) return null;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  )}
                >
                  <span className={cn(
                    "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                  )} />
                  {item.icon && <item.icon className="h-5 w-5" />}
                  {item.name}
                </Link>
              );
            }

            // Grouped section
            const allowedRoles = (item.children || []).map((c) => ({ ...c, roles: (c.roles || []).map((r) => String(r).toLowerCase()) }));
            let visibleChildren = allowedRoles.filter((child) => {
              if (!child.roles || child.roles.length === 0) return true;
              return role ? child.roles.includes(role) : false;
            });
            if (item.name === 'Employee Management' && caps) {
              visibleChildren = visibleChildren.filter((child) => {
                if (child.href === '/employees/new') return caps.canCreateEmployees;
                if (child.href === '/employees/import') return caps.canCreateEmployees;
                return true;
              });
            }

            if (visibleChildren.length === 0) return null;

            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.name}
                </div>
                {visibleChildren.map((child) => {
                  const isActive = location.pathname === child.href;
                  return (
                    <Link
                      key={child.name}
                      to={child.href}
                      className={cn(
                        "group relative ml-6 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/15 text-primary shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                      )}
                    >
                      <span className={cn(
                        "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                      )} />
                      {child.icon && <child.icon className="h-4 w-4" />}
                      {child.name}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border/70 p-4">
          <div className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/60 p-3">
            <p className="text-xs font-semibold text-sidebar-foreground">Version 1.0.0</p>
            <p className="text-xs text-sidebar-foreground/70">© {new Date().getFullYear()} Merdeka Group</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
