import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, Shield, Users, Building2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

// Mock users for development
const MOCK_USERS = [
  { username: "admin", password: "P@ssw0rd.123", role: "superadmin", displayName: "Super Administrator" },
  { username: "hradmin", password: "P@ssw0rd.123", role: "admin", displayName: "HR Administrator" },
  { username: "hruser", password: "P@ssw0rd.123", role: "hr_general", displayName: "HR Staff" },
  { username: "finance", password: "P@ssw0rd.123", role: "finance", displayName: "Finance Staff" },
  { username: "deprep", password: "P@ssw0rd.123", role: "department_rep", displayName: "Department Representative" },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  superadmin: { label: "Super Admin", color: "bg-red-500" },
  admin: { label: "Admin", color: "bg-orange-500" },
  hr_general: { label: "HR General", color: "bg-blue-500" },
  finance: { label: "Finance", color: "bg-green-500" },
  department_rep: { label: "Dept. Rep", color: "bg-purple-500" },
};

const Auth = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expired = sessionStorage.getItem("auth_session_expired");
    if (!expired) return;
    sessionStorage.removeItem("auth_session_expired");
    toast({ title: "Session expired", description: "You have been logged out due to inactivity." });
  }, [toast]);

  const toFriendlyAuthMessage = (raw: string, enteredUsername: string) => {
    const m = raw.toLowerCase();
    if (m.includes("user_not_found") || m.includes("data 525")) {
      return "We couldn't find that account. Try your AD username (sAMAccountName).";
    }
    if (m.includes("invalid credentials") || m.includes("data 52e")) {
      return "Incorrect username or password. Check your AD username (sAMAccountName) and try again.";
    }
    if (m.includes("data 532")) {
      return "Your password has expired. Please change it or contact IT.";
    }
    if (m.includes("data 533")) {
      return "Your account is disabled. Please contact IT support.";
    }
    if (m.includes("data 773")) {
      return "You must change your password before you can sign in.";
    }
    if (m.includes("data 775")) {
      return "Your account is locked due to too many attempts. Please contact IT.";
    }
    if (m.includes("data 701")) {
      return "Your account has expired. Please contact IT support.";
    }
    if (m.includes("insufficient_access") || m.includes("insufficient permissions")) {
      return "You don't have permission to access this application. Please contact an administrator.";
    }
    if (m.includes("acceptsecuritycontext") || m.includes("dsid")) {
      const emailHint = enteredUsername.includes("@")
        ? " Tip: use your AD username (sAMAccountName), not email."
        : "";
      return `Sign-in failed. Please verify your username and password.${emailHint}`;
    }
    return raw;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Validation Error",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Development mock login
      const mockUser = MOCK_USERS.find(u => u.username === username && u.password === password);
      if (mockUser) {
        const user = {
          id: `dev-${mockUser.role}-001`,
          username: mockUser.username,
          displayName: mockUser.displayName,
          email: `${mockUser.username}@dev.local`,
          role: mockUser.role,
          roles: [mockUser.role],
        };
        localStorage.setItem("auth_token", `dev-mock-token-${mockUser.role}`);
        localStorage.setItem("auth_user", JSON.stringify(user));
        localStorage.setItem("auth_last_activity", String(Date.now()));
        console.info(`${user.displayName || user.username || "unknown"} is logged in with role ${user.role || "unknown"}`);
        const roleInfo = ROLE_LABELS[mockUser.role];
        toast({ 
          title: "Login Successful", 
          description: `Welcome, ${mockUser.displayName}! Role: ${roleInfo.label}` 
        });
        navigate("/");
        return;
      }

      // Production: Active Directory login
      const res = await apiFetch(`/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Login failed");
      }
      localStorage.setItem("auth_token", data.token);
      // Map AD roles array to single role for display
      const primaryRole = data.user.roles?.[0] || "user";
      const userWithRole = {
        ...data.user,
        role: primaryRole,
        roles: Array.isArray(data.user.roles) ? data.user.roles : [primaryRole],
      };
      localStorage.setItem("auth_user", JSON.stringify(userWithRole));
      localStorage.setItem("auth_last_activity", String(Date.now()));
      console.info(`${userWithRole.displayName || userWithRole.username || "unknown"} is logged in with role ${userWithRole.role || "unknown"}`);
      const roleInfo = ROLE_LABELS[primaryRole];
      toast({ 
        title: "Login Successful", 
        description: `Welcome, ${data.user.displayName || data.user.username}!${roleInfo ? ` Role: ${roleInfo.label}` : ''}` 
      });
      navigate("/");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Invalid credentials or access denied.";
      const friendly = toFriendlyAuthMessage(raw, username);
      toast({ title: "Authentication Failed", description: friendly, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding & Info */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-[hsl(220,25%,12%)] via-[hsl(220,25%,16%)] to-[hsl(217,32%,20%)]">
        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-40 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
          </div>
          {/* Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo & Title */}
          <div>
            <div className="flex items-center gap-4 mb-16">
              <div className="h-14 w-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <img src="/mti-logo.png" alt="Merdeka Group" className="h-10 w-10 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Merdeka Group</h1>
                <p className="text-white/60 text-sm">Employee Master Data System</p>
              </div>
            </div>

            {/* Hero Text */}
            <div className="max-w-lg">
              <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
                Centralized HR
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Data Management
                </span>
              </h2>
              <p className="text-white/70 text-lg leading-relaxed">
                Secure access to employee records, streamlined workflows, and comprehensive data insights for your organization.
              </p>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 max-w-md">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Enterprise Security</h3>
                <p className="text-white/60 text-sm">Active Directory integration with role-based access control</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 max-w-md">
              <div className="h-12 w-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Multi-Role Access</h3>
                <p className="text-white/60 text-sm">HR, Finance, and Department views with granular permissions</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 max-w-md">
              <div className="h-12 w-12 rounded-lg bg-success/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Cross-Company Data</h3>
                <p className="text-white/60 text-sm">Unified platform for all Merdeka Group entities</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Merdeka Group. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <img src="/mti-logo.png" alt="Merdeka Group" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Employee Hub</h1>
              <p className="text-muted-foreground text-sm">Merdeka Group</p>
            </div>
          </div>

          {/* Login Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Sign in with your corporate credentials</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username or Email
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your AD username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 pl-12 text-base bg-muted/50 border-border/60 focus:bg-background transition-colors"
                  autoComplete="username"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                  onClick={() => toast({ title: "Password Reset", description: "Contact your IT administrator to reset your password." })}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-12 pr-12 text-base bg-muted/50 border-border/60 focus:bg-background transition-colors"
                  autoComplete="current-password"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Sign in
                </span>
              )}
            </Button>
          </form>

          {/* AD Info */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Secured with Active Directory</span>
            </div>
          </div>

          {/* Dev Test Accounts */}
          <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Development Mode</p>
            </div>
            <div className="space-y-2">
              {MOCK_USERS.map((user) => (
                <button 
                  key={user.username}
                  type="button"
                  className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-background border border-transparent hover:border-border/50 transition-all cursor-pointer"
                  onClick={() => {
                    setUsername(user.username);
                    setPassword(user.password);
                  }}
                >
                  <span className="font-mono text-foreground">{user.username}</span>
                  <Badge 
                    variant="secondary" 
                    className={`${ROLE_LABELS[user.role].color} text-white text-[10px] px-2 py-0.5`}
                  >
                    {ROLE_LABELS[user.role].label}
                  </Badge>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3 font-mono">
              Password: P@ssw0rd.123
            </p>
          </div>

          {/* Request Access */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have access?{" "}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => toast({ title: "Request Access", description: "Please contact your HR administrator to request system access." })}
              >
                Request access
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
