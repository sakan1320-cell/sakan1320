import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PasswordStrengthIndicator } from "@/components/ui/PasswordStrengthIndicator";
import { Loader2, CheckCircle2, User, Lock, AtSign } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9._]{2,29}$/;
const RESERVED = ["admin", "root", "system", "support", "help", "api", "mail", "sakansa"];

const SetupAccount = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const isRtl = i18n.language === "ar";

  const [username, setUsername] = useState("");
  const [displayNameAr, setDisplayNameAr] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameOk, setUsernameOk] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (profile && !profile.is_password_setup_required) {
      navigate("/dashboard");
    }
    if (profile?.full_name) setDisplayNameAr(profile.full_name);
  }, [profile, navigate]);

  // Generate suggestions from email
  useEffect(() => {
    if (!user?.email) return;
    const base = user.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    setSuggestions([
      base,
      `${base}${Math.floor(Math.random() * 99) + 1}`,
      `${base}_${new Date().getFullYear()}`,
    ].filter(s => USERNAME_REGEX.test(s)));
  }, [user]);

  const validateUsername = useCallback(async (val: string) => {
    setUsernameOk(false);
    if (!val) { setUsernameError(null); return; }

    if (!USERNAME_REGEX.test(val)) {
      setUsernameError(t("auth.usernameInvalid", "يجب أن يبدأ بحرف إنجليزي، 3-30 حرفاً، بدون مسافات"));
      return;
    }
    if (RESERVED.includes(val.toLowerCase())) {
      setUsernameError(t("auth.usernameReserved", "هذا الاسم محجوز، اختر اسماً آخر"));
      return;
    }

    setCheckingUsername(true);
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("normalized_username", val.toLowerCase())
      .maybeSingle();

    setCheckingUsername(false);
    if (data && data.id !== user?.id) {
      setUsernameError(t("auth.usernameTaken", "هذا الاسم مستخدم بالفعل، جرب اسماً آخر"));
    } else {
      setUsernameError(null);
      setUsernameOk(true);
    }
  }, [user?.id, t]);

  useEffect(() => {
    const timer = setTimeout(() => { if (username) validateUsername(username); }, 500);
    return () => clearTimeout(timer);
  }, [username, validateUsername]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameError || !usernameOk) { toast.error(t("auth.fixUsernameFirst", "يرجى إصلاح اسم المستخدم أولاً")); return; }
    if (newPassword.length < 6) { toast.error(t("auth.errors.weak_password")); return; }
    if (newPassword !== confirmPassword) { toast.error(t("auth.passwordMismatch", "كلمات المرور غير متطابقة")); return; }

    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          normalized_username: username.trim().toLowerCase(),
          display_name_ar: displayNameAr.trim(),
          is_password_setup_required: false,
        } as any)
        .eq("id", user?.id);

      if (profileError) throw profileError;

      const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
      if (passError) throw passError;

      await refreshProfile();
      toast.success(t("auth.setupSuccess", "تم إعداد حسابك بنجاح! مرحباً بك 🎉"));
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white p-2 shadow-sm">
            <img src={logo} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">{t("auth.setupTitle", "مرحباً! أكمل إعداد حسابك")}</CardTitle>
          <CardDescription>{t("auth.setupDesc", "اختر اسم مستخدم فريداً وكلمة مرور آمنة للمتابعة")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username", "اسم المستخدم")}</Label>
              <div className="relative">
                <AtSign className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^a-zA-Z0-9._]/g, "");
                    setUsername(v);
                  }}
                  className={cn("ps-9", usernameError ? "border-destructive" : usernameOk ? "border-green-500" : "")}
                  placeholder="your.username"
                  required
                  dir="ltr"
                />
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {!checkingUsername && usernameOk && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>
              </div>
              {usernameError && <p className="text-xs font-medium text-destructive">{usernameError}</p>}
              {!usernameError && usernameOk && (
                <p className="text-xs text-green-600">{t("auth.usernameAvailable", "✓ هذا الاسم متاح")}</p>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && !usernameOk && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("auth.suggestions", "اقتراحات:")}  </span>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setUsername(s)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">{t("auth.displayName", "الاسم المعروض")}</Label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="displayName"
                  value={displayNameAr}
                  onChange={(e) => setDisplayNameAr(e.target.value)}
                  className="ps-9"
                  placeholder="الاسم الكامل"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.newPassword", "كلمة المرور الجديدة")}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ps-9"
                  required
                  minLength={6}
                />
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword", "تأكيد كلمة المرور")}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn("ps-9", confirmPassword && newPassword !== confirmPassword ? "border-destructive" : "")}
                  required
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">{t("auth.passwordMismatch", "كلمات المرور غير متطابقة")}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !!usernameError || !username || !usernameOk}
            >
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("auth.completeSetup", "إكمال الإعداد والدخول")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export default SetupAccount;
