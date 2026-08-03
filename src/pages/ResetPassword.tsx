import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const processed = useRef(false);

  useEffect(() => {
    let active = true;

    const processRecovery = async () => {
      try {
        // Check URL hash for recovery tokens (Supabase PKCE flow)
        const hash = window.location.hash;
        const search = window.location.search;
        const hasRecoveryToken = hash.includes("access_token") || hash.includes("type=recovery")
          || search.includes("type=recovery") || search.includes("token_hash");

        if (hasRecoveryToken && !processed.current) {
          processed.current = true;
          // Let Supabase client process the URL tokens automatically
          // Give it a moment to process
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Check if we have a valid session now
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) {
          console.error("[ResetPassword] session error:", sessionErr);
        }

        if (active) {
          if (session) {
            setReady(true);
          } else if (!hasRecoveryToken) {
            // No token in URL and no session = invalid access
            setError(t("auth.resetLinkExpired", "رابط إعادة التعيين غير صالح أو منتهي."));
          }
          setChecking(false);
        }
      } catch (err) {
        console.error("[ResetPassword] error:", err);
        if (active) {
          setError(t("auth.resetLinkExpired", "رابط إعادة التعيين غير صالح أو منتهي."));
          setChecking(false);
        }
      }
    };

    // Listen for auth state changes (recovery event)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        if (active) {
          setReady(true);
          setChecking(false);
          setError(null);
        }
      }
    });

    processRecovery();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error(t("auth.errors.weak_password", t("auth.weakPassword")));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordMismatch", "كلمات المرور غير متطابقة"));
      return;
    }

    setLoading(true);

    // Verify session is still valid
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      toast.error(t("auth.resetLinkExpired", "انتهت صلاحية رابط إعادة التعيين. اطلب رابطًا جديدًا."));
      setReady(false);
      setError(t("auth.resetLinkExpired", "انتهت صلاحية الجلسة. اطلب رابطًا جديدًا."));
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) {
      toast.error(updateErr.message);
      return;
    }

    // Clear is_password_setup_required flag if set
    if (session.user?.id) {
      await supabase.from("profiles")
        .update({ is_password_setup_required: false } as any)
        .eq("id", session.user.id);
    }

    localStorage.removeItem("demo_mode");
    toast.success(t("auth.passwordUpdated"));

    // Sign out and redirect to login for clean session
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader>
          <CardTitle>{t("auth.resetPassword")}</CardTitle>
          <CardDescription>
            {checking
              ? t("common.loading", "جاري التحميل...")
              : ready
                ? t("auth.newPassword")
                : error || t("auth.resetLinkExpired", "رابط إعادة التعيين غير صالح أو منتهي.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !ready ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("auth.resetLinkExpired", "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. يمكنك طلب رابط جديد.")}
              </p>
              <Button asChild className="w-full">
                <Link to="/auth?mode=forgot">{t("auth.sendResetLink", "طلب رابط جديد")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">{t("auth.login")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.newPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  {t("auth.passwordRules", "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("auth.confirmPassword", "تأكيد كلمة المرور")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                  disabled={loading}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">
                    {t("auth.passwordMismatch", "كلمات المرور غير متطابقة")}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading || password !== confirmPassword}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("auth.updatePassword")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
