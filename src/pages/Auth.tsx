import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { isStaffRoles, resolveHomeRoute, fetchHasParticipantRecord } from "@/hooks/usePortalEligibility";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, ChevronDown, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";

interface ExternalAppearanceSettings {
  colors: { primary: string; };
  typography: { font_family: string; };
  login: { title: string; subtitle: string; };
}

type Mode = "login" | "signup" | "forgot";

const roleNames: Record<AppRole, string> = {
  system_admin: "مدير نظام",
  board: "مجلس الإدارة",
  executive: "إدارة تنفيذية",
  assistant: "مساعد إداري",
  project_manager: "مدير مشروع",
  branch_manager: "مدير فرع",
  employee: "موظف",
  contractor: "متعاقد",
  participant: "مشارك",
  guardian: "ولي أمر"
};

const SmoothLoginCard = ({ 
  profile, 
  roles, 
  onContinue, 
  onSwitchAccount 
}: { 
  profile: any, 
  roles: AppRole[], 
  onContinue: (role: AppRole) => void, 
  onSwitchAccount: () => void 
}) => {
  const { t } = useTranslation();
  
  const [selectedRole, setSelectedRole] = useState<AppRole>(() => {
    const lastRole = localStorage.getItem("last_active_role") as AppRole;
    if (lastRole && roles.includes(lastRole)) return lastRole;
    
    const staffRoles = roles.filter(r => r !== "participant" && r !== "guardian");
    return staffRoles.length > 0 ? staffRoles[0] : (roles[0] || "participant");
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col items-center space-y-3 py-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative">
        <Avatar className="h-16 w-16 border-2 border-white shadow-md ring-2 ring-primary/20 transition-all hover:scale-105">
          <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || ""} />
          <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
            {getInitials(profile?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-base font-bold">{profile?.full_name || t("app.greeting", "مرحباً")}</h3>
        
        {roles.length > 1 ? (
          <div className="group relative inline-block text-sm text-muted-foreground mt-1 cursor-pointer">
            <div className="flex items-center justify-center gap-1 bg-secondary/50 px-3 py-1 rounded-full hover:bg-secondary transition-colors">
              <span className="font-medium text-foreground">{roleNames[selectedRole] || selectedRole}</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
            </div>
            
            <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t("auth.switchRole", "تبديل الصلاحية")}
                </div>
                {roles.filter(r => r !== selectedRole).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className="w-full text-start px-2 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {roleNames[role] || role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-muted-foreground mt-1">
            {roleNames[selectedRole] || selectedRole}
          </div>
        )}
      </div>

      <div className="w-full pt-1">
        <Button 
          type="button" 
          onClick={() => onContinue(selectedRole)}
          className="w-full h-11 text-sm font-bold shadow-sm transition-all"
        >
          {t("auth.continue", "متابعة")}
        </Button>
      </div>
    </div>
  );
};

const Auth = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>((params.get("mode") as Mode) || "login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [resolvingDestination, setResolvingDestination] = useState(false);
  const [appearance, setAppearance] = useState<ExternalAppearanceSettings | null>(null);
  const [showSmoothLogin, setShowSmoothLogin] = useState(true);
  
  const { signOut } = useAuth();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });

    const fetchAppearance = async () => {
      try {
        const { data } = await supabase.from("app_settings").select("value").eq("key", "external_appearance").maybeSingle();
        if (data?.value) {
          const app = data.value as unknown as ExternalAppearanceSettings;
          setAppearance(app);
          if (app.typography?.font_family) {
            document.documentElement.style.fontFamily = `"${app.typography.font_family}", sans-serif`;
          }
          if (app.colors?.primary) {
            let hex = app.colors.primary;
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) { r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); } 
            else if (hex.length === 7) { r = parseInt(hex[1] + hex[2], 16); g = parseInt(hex[3] + hex[4], 16); b = parseInt(hex[5] + hex[6], 16); }
            r /= 255; g /= 255; b /= 255;
            const cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
            let h = 0, s = 0, l = 0;
            if (delta === 0) h = 0; else if (cmax === r) h = ((g - b) / delta) % 6; else if (cmax === g) h = (b - r) / delta + 2; else h = (r - g) / delta + 4;
            h = Math.round(h * 60); if (h < 0) h += 360;
            l = (cmax + cmin) / 2; s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
            s = +(s * 100).toFixed(1); l = +(l * 100).toFixed(1);
            document.documentElement.style.setProperty('--primary', `${h} ${s}% ${l}%`);
          }
        }
      } catch (e) {}
    };

    fetchAppearance();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      document.documentElement.style.removeProperty('--primary');
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchProfile = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(p);
      const { data: rs } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (rs) setRoles(rs.map(r => r.role as AppRole));
    };
    fetchProfile();
  }, [session?.user?.id]);

  useEffect(() => {
    const p = params.get("portal");
    if (!p) return;
    localStorage.setItem("last_active_portal", p);
    const nextParams = new URLSearchParams(params);
    nextParams.delete("portal");
    const search = nextParams.toString();
    navigate(`/auth${search ? `?${search}` : ""}`, { replace: true });
  }, [navigate, params]);

  const handleSmoothLoginContinue = async (role: AppRole) => {
    if (!session?.user?.id) return;
    localStorage.setItem("last_active_role", role);
    const portal = (role === "participant" || role === "guardian") ? "participant" : "staff";
    localStorage.setItem("last_active_portal", portal);
    
    setResolvingDestination(true);
    const dest = await resolveDestination(session.user.id);
    navigate(dest, { replace: true });
  };

  const translateAuthError = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) return t("auth.errors.invalid_credentials");
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already")) return t("auth.errors.user_already_registered");
    if (m.includes("email not confirmed")) return t("auth.errors.email_not_confirmed");
    if (m.includes("password") && (m.includes("short") || m.includes("at least") || m.includes("weak") || m.includes("6 characters"))) return t("auth.errors.weak_password");
    if (m.includes("invalid email") || (m.includes("email") && m.includes("invalid"))) return t("auth.errors.email_invalid");
    if (m.includes("rate limit") || m.includes("too many")) return t("auth.errors.rate_limit");
    if (m.includes("fetch") || m.includes("network")) return t("auth.errors.network");
    if (m.includes("missing oauth secret") || m.includes("unsupported provider") || m.includes("provider not enabled")) return t("auth.errors.oauth_not_configured");
    return raw || t("auth.errors.generic");
  };

  const resolveDestination = async (uid?: string) => {
    if (!uid) return "/auth";
    const { data: rs } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const rls = (rs ?? []).map((r) => r.role as string);
    const isStaff = isStaffRoles(rls);
    const isParticipant = await fetchHasParticipantRecord(uid);
    const lastPortal = localStorage.getItem("last_active_portal") as "staff" | "participant" | null;
    return resolveHomeRoute({ isStaff, isParticipant, lastPortal });
  };

  const resolveEmailIdentifier = async (value: string) => {
    if (value.includes("@")) return value;
    const { data: userData, error } = await supabase.rpc("get_user_email_by_identifier", {
      _identifier: value,
    });
    if (error || typeof userData !== "string" || !userData) {
      throw new Error(t("auth.errors.invalid_credentials"));
    }
    return userData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const loginEmail = await resolveEmailIdentifier(identifier.trim());
        const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        localStorage.removeItem("demo_mode");
        toast.success(t("auth.loginSuccess", "تم تسجيل الدخول بنجاح"));
        navigate(await resolveDestination(data.user?.id), { replace: true });
      } else if (mode === "signup") {
        const email = identifier.trim();
        if (password.length < 6) {
          toast.error(t("auth.errors.weak_password"));
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        toast.success(t("auth.signupSuccess", "تم إنشاء الحساب. يمكنك تسجيل الدخول من نفس الصفحة."));
        setMode("login");
      } else {
        const resetEmail = await resolveEmailIdentifier(identifier.trim());
        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("auth.resetSent"));
        setMode("login");
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "";
      toast.error(translateAuthError(raw));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || resolvingDestination) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <div className="absolute top-4 right-4 z-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white p-1.5 shadow-md border border-border/50 overflow-hidden">
          <img src={logo} alt={t("app.name")} className="h-full w-full object-contain" />
        </div>
      </div>
      <Card className="w-full max-w-md shadow-elegant relative z-20">
        <CardHeader className="space-y-1 text-center pt-8">
          <div>
            <CardTitle className="text-2xl">{appearance?.login?.title || t("auth.login", "تسجيل الدخول")}</CardTitle>
            {appearance?.login?.subtitle && (
              <CardDescription className="mt-2 text-sm text-muted-foreground">{appearance.login.subtitle}</CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {session && profile && roles && roles.length > 0 && showSmoothLogin && (
            <>
              <SmoothLoginCard 
                profile={profile}
                roles={roles}
                onContinue={handleSmoothLoginContinue}
                onSwitchAccount={async () => {
                  await signOut();
                  setShowSmoothLogin(false);
                }}
              />
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-semibold">{t("auth.or") || "أو"}</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="identifier">
                {mode === "signup" ? t("common.email") : t("auth.usernameOrEmail", "اسم المستخدم أو البريد أو رقم الهوية")}
              </Label>
              <Input
                id="identifier"
                type={mode === "signup" ? "email" : "text"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "signup" ? "example@mail.com" : t("auth.loginPlaceholder", "رقم الهوية / اسم المستخدم / البريد")}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("common.password")}</Label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                      {t("auth.forgot")}
                    </button>
                  )}
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" && t("auth.login")}
              {mode === "signup" && t("auth.signup")}
              {mode === "forgot" && t("auth.sendResetLink")}
            </Button>

            {mode !== "forgot" && (
              <>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("auth.or") || "أو"}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const { error } = await supabase.auth.signInWithOAuth({
                          provider: "google",
                          options: { redirectTo: window.location.origin },
                        });
                        if (error) throw error;
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : t("auth.invalid"));
                        setLoading(false);
                      }
                    }}
                  >
                    <svg className="ms-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t("auth.google", "الدخول عبر Google")}
                  </Button>
                </div>
              </>
            )}
            {mode === "forgot" && (
              <div className="text-center">
                <button type="button" onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
                  {t("auth.login")}
                </button>
              </div>
            )}
            <div className="text-center">
              <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
                ← {t("auth.backHome", "العودة للصفحة الرئيسية")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
