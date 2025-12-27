import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn } from "lucide-react";
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

  const toFriendlyAuthMessage = (raw: string, enteredUsername: string) => {
    const m = raw.toLowerCase();
    if (m.includes("user_not_found") || m.includes("data 525")) {
      return "We couldn’t find that account. Try your AD username (sAMAccountName).";
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
      return "You don’t have permission to access this application. Please contact an administrator.";
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
    <div className="min-h-screen grid md:grid-cols-[440px_1fr] bg-muted/30">
      <div className="flex items-center justify-center p-6 md:p-10 bg-card border-r border-border/50">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3">
            <img src="/mti-logo.png" alt="Merdeka Group" className="h-10" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Employee Hub</h1>
              <p className="text-xs text-muted-foreground">Login into your account</p>
            </div>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardContent className="pt-6">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Email address / Username</Label>
                  <div className="relative">
                    <Input
                      id="username"
                      type="text"
                      placeholder="alex@email.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-11 pl-11"
                      autoComplete="username"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      {/* envelope icon substitute */}
                      <span className="h-3 w-3 rounded-sm bg-primary" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-11 pr-10"
                      autoComplete="current-password"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <span className="h-3 w-3 rounded-sm bg-primary" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => toast({ title: "Contact your administrator to reset your password." })}
                  >
                    Forgot password?
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Login now
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Login now
                    </span>
                  )}
                </Button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-11 text-base font-medium border-primary text-primary"
                  onClick={() => toast({ title: "Request account", description: "Please contact your administrator." })}
                >
                  Signup now
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
                <p className="text-center text-sm text-muted-foreground">
                  Authentication via Active Directory
                </p>
                
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Test Accounts (Dev Only):</p>
                  <div className="space-y-1.5">
                    {MOCK_USERS.map((user) => (
                      <div 
                        key={user.username}
                        className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors"
                        onClick={() => {
                          setUsername(user.username);
                          setPassword(user.password);
                        }}
                      >
                        <span className="font-mono text-foreground">{user.username}</span>
                        <Badge 
                          variant="secondary" 
                          className={`${ROLE_LABELS[user.role].color} text-white text-[10px] px-1.5 py-0`}
                        >
                          {ROLE_LABELS[user.role].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Password: P@ssw0rd.123
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} Employee Master Data System. All rights reserved.
          </p>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-center p-6">
        <div className="relative w-full h-full max-w-3xl">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10" />
          <div className="relative z-10 h-full flex items-center justify-center">
            <img
              src="/illustrations/login-hero.png"
              alt="Secure access illustration"
              className="max-h-[520px] object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
