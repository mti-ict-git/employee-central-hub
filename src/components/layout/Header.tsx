import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, User, Settings, LogOut, Shield, HelpCircle, Sun, Moon, PanelLeft, PanelRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { apiFetch } from "@/lib/api";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  superadmin: { label: "Super Admin", color: "bg-red-500" },
  admin: { label: "Admin", color: "bg-orange-500" },
  hr_general: { label: "HR General", color: "bg-blue-500" },
  finance: { label: "Finance", color: "bg-green-500" },
  dep_rep: { label: "Dept. Rep", color: "bg-purple-500" },
};

export function Header({ title, subtitle, onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    toast({ title: "Logged out", description: "You have been logged out successfully." });
    navigate("/auth");
  };

  const toggleTheme = async () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;
    try {
      const res = await apiFetch(`/users/me/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: "theme", value: next }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const msg = typeof body === "object" && body !== null && "error" in body && typeof (body as { error?: unknown }).error === "string"
          ? String((body as { error?: unknown }).error)
          : `HTTP_${res.status}`;
        throw new Error(msg);
      }
    } catch (err: unknown) {
      toast({
        title: "Failed to Save Theme",
        description: err instanceof Error ? err.message : "FAILED_TO_SAVE_THEME",
        variant: "destructive",
      });
    }
  };

  const roleInfo = user?.role ? ROLE_LABELS[user.role] : null;
  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onToggleSidebar}
            className="h-9 w-9"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <PanelRight className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </Button>
        )}
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="w-64 pl-9"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => {
            toggleTheme().catch(() => {});
          }}
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 p-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium leading-none">{user?.displayName || "User"}</p>
                  {roleInfo && (
                    <Badge className={`${roleInfo.color} text-white text-[10px] px-1.5 py-0`}>
                      {roleInfo.label}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{user?.email || "user@example.com"}</p>
                <p className="text-xs text-muted-foreground font-mono">@{user?.username || "user"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              <span>Security</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Help & Support</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
