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
  { username: "deprep", password: "P@ssw0rd.123", role: "dep_rep", displayName: "Department Representative" },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  superadmin: { label: "Super Admin", color: "bg-red-500" },
  admin: { label: "Admin", color: "bg-orange-500" },
  hr_general: { label: "HR General", color: "bg-blue-500" },
  finance: { label: "Finance", color: "bg-green-500" },
  dep_rep: { label: "Dept. Rep", color: "bg-purple-500" },
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Employee Master Data</h1>
          <p className="text-muted-foreground">Sign in to manage your workforce</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-3 pb-4">
            <img src="/mti-logo.png" alt="Merdeka Group" className="mx-auto h-24 md:h-28" />
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="sAMAccountName"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11"
                  autoComplete="username"
                />
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
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
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
                className="w-full h-11 text-base font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Authentication via Active Directory
              </p>
              
              {/* Development Test Accounts */}
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
  );
};

export default Auth;
