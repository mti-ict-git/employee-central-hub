import { cn } from "@/lib/utils";
import { 
  Users, 
  LayoutDashboard, 
  UserPlus, 
  FileText, 
  Settings,
  Building2,
  Upload
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { ComponentType } from "react";

type IconType = ComponentType<{ className?: string }>;

type NavItem = {
  name: string;
  href?: string;
  icon?: IconType;
  children?: { name: string; href: string; icon?: IconType }[];
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
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">HRIS</h1>
            <p className="text-xs text-sidebar-foreground/70">Employee Master Data</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            // Simple link item
            if (!item.children && item.href) {
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  {item.icon && <item.icon className="h-5 w-5" />}
                  {item.name}
                </Link>
              );
            }

            // Grouped section
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase text-sidebar-foreground/70">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.name}
                </div>
                {item.children?.map((child) => {
                  const isActive = location.pathname === child.href ||
                    (child.href !== '/' && location.pathname.startsWith(child.href));
                  return (
                    <Link
                      key={child.name}
                      to={child.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ml-6",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
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
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs font-medium text-sidebar-foreground">Version 1.0.0</p>
            <p className="text-xs text-sidebar-foreground/70">© 2024 Merdeka Group</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
