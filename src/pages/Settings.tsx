import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Bell, Shield, Palette, Globe, Save, KeyRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "next-themes";

type ThemePref = "light" | "dark" | "system";

type PalettePref = "corporate" | "emerald" | "violet" | "rose" | "amber";

const PALETTE_CLASS_BY_PREF: Record<Exclude<PalettePref, "corporate">, string> = {
  emerald: "theme-emerald",
  violet: "theme-violet",
  rose: "theme-rose",
  amber: "theme-amber",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeThemePref(value: unknown): ThemePref | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "light" || v === "dark" || v === "system") return v;
  return null;
}

function normalizePalettePref(value: unknown): PalettePref | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "corporate" || v === "default" || v === "blue") return "corporate";
  if (v === "emerald" || v === "violet" || v === "rose" || v === "amber") return v;
  return null;
}

function applyPalettePref(pref: PalettePref) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const allClasses = new Set<string>(Object.values(PALETTE_CLASS_BY_PREF));
  for (const c of allClasses) root.classList.remove(c);
  if (pref === "corporate") return;
  root.classList.add(PALETTE_CLASS_BY_PREF[pref]);
}

function readPalettePrefFromDom(): PalettePref {
  if (typeof document === "undefined") return "corporate";
  const root = document.documentElement;
  for (const [pref, cls] of Object.entries(PALETTE_CLASS_BY_PREF)) {
    if (root.classList.contains(cls)) return pref as Exclude<PalettePref, "corporate">;
  }
  return "corporate";
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

const Settings = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [palettePref, setPalettePref] = useState<PalettePref>(() => readPalettePrefFromDom());
  const [savingPrefs, setSavingPrefs] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    const next = normalizeThemePref(theme) || "system";
    setThemePref(next);
  }, [theme]);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      const res = await apiFetch(`/users/me/preferences`, { signal: ctrl.signal, credentials: "include" });
      if (!res.ok) return;
      const body = (await res.json().catch(() => null)) as unknown;
      if (!isRecord(body)) return;
      const pref = normalizeThemePref(body.theme);
      if (pref) {
        setTheme(pref);
        setThemePref(pref);
      }

      const palette = normalizePalettePref(body.palette);
      if (palette) {
        applyPalettePref(palette);
        setPalettePref(palette);
      }
    };

    run().catch(() => {});
    return () => ctrl.abort();
  }, [setTheme]);

  const handleSaveProfile = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile settings have been saved successfully.",
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notifications Updated",
      description: "Your notification preferences have been saved.",
    });
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      const saveOne = async (key: string, value: unknown) => {
        const res = await apiFetch(`/users/me/preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ key, value }),
        });
        const body = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          const msg = isRecord(body) && typeof body.error === "string" && body.error.trim() ? body.error : `HTTP_${res.status}`;
          throw new Error(msg);
        }
      };

      await saveOne("theme", themePref);
      await saveOne("palette", palettePref);
      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved successfully.",
      });
    } catch (e: unknown) {
      toast({
        title: "Failed to Save Preferences",
        description: e instanceof Error ? e.message : "FAILED_TO_SAVE_PREFERENCES",
        variant: "destructive",
      });
    } finally {
      setSavingPrefs(false);
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
    <MainLayout title="Settings" subtitle="Manage your account settings and preferences">
      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  View and update your account profile details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{user?.displayName || "User"}</h3>
                    <p className="text-sm text-muted-foreground">@{user?.username || "user"}</p>
                    {roleInfo && (
                      <Badge className={`${roleInfo.color} text-white`}>
                        {roleInfo.label}
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      defaultValue={user?.displayName || ""}
                      placeholder="Your display name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      defaultValue={user?.username || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      defaultValue={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Email is managed by Active Directory</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications" className="text-base">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email notifications for important updates
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-notifications" className="text-base">Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications in your browser
                      </p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weekly-digest" className="text-base">Weekly Digest</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly summary of activity
                      </p>
                    </div>
                    <Switch
                      id="weekly-digest"
                      checked={weeklyDigest}
                      onCheckedChange={setWeeklyDigest}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveNotifications} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your account security and authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <KeyRound className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">
                          Managed via Active Directory
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => {
                      toast({
                        title: "Password Change",
                        description: "Please contact your system administrator to change your password.",
                      });
                    }}>
                      Change Password
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Not Available</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-medium">Active Sessions</p>
                        <p className="text-sm text-muted-foreground">
                          Manage your active login sessions
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => {
                      toast({
                        title: "Session Management",
                        description: "You are currently logged in on 1 device.",
                      });
                    }}>
                      View Sessions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Application Preferences</CardTitle>
                <CardDescription>
                  Customize your application experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="id">Bahasa Indonesia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                        <SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem>
                        <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select
                      value={themePref}
                      onValueChange={(v) => {
                        const next = normalizeThemePref(v) || "system";
                        setThemePref(next);
                        setTheme(next);
                      }}
                    >
                      <SelectTrigger id="theme">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose your preferred color theme
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="palette">Color Palette</Label>
                    <Select
                      value={palettePref}
                      onValueChange={(v) => {
                        const next = normalizePalettePref(v) || "corporate";
                        setPalettePref(next);
                        applyPalettePref(next);
                      }}
                    >
                      <SelectTrigger id="palette">
                        <SelectValue placeholder="Select palette" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <SelectItem value="corporate">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                            Corporate (Blue)
                          </span>
                        </SelectItem>
                        <SelectItem value="emerald">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                            Emerald
                          </span>
                        </SelectItem>
                        <SelectItem value="violet">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                            Violet
                          </span>
                        </SelectItem>
                        <SelectItem value="rose">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                            Rose
                          </span>
                        </SelectItem>
                        <SelectItem value="amber">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                            Amber
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose the primary accent color used across the app
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSavePreferences} className="flex items-center gap-2" disabled={savingPrefs}>
                    <Save className="h-4 w-4" />
                    {savingPrefs ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;
