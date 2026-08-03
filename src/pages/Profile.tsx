import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";

const Profile = () => {
  const { t } = useTranslation();
  const { user, roles } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone, username").eq("id", user.id).maybeSingle().then(({ data }) => {
      setFullName(data?.full_name ?? "");
      setPhone(data?.phone ?? "");
      setUsername(data?.username ?? "");
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ 
      full_name: fullName, 
      phone, 
      username: username.trim(),
      normalized_username: username.trim().toLowerCase()
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("profile.updated"));
  };

  const updatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(t("auth.errors.weak_password", "كلمة المرور يجب أن تتكون من 6 أحرف على الأقل"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.passwordMismatch", "كلمات المرور غير متطابقة"));
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("auth.passwordUpdated", "تم تحديث كلمة المرور بنجاح"));
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
      <Card>
        <CardHeader><CardTitle>{t("common.profile")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("common.email")}</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>{t("auth.fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("auth.username", "اسم المستخدم")}</Label>
            <Input 
              value={username} 
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))} 
              placeholder="username123"
              dir="ltr"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("profile.usernameHint", "يمكنك استخدامه لتسجيل الدخول بدلاً من البريد الإلكتروني.")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("common.phone")}</Label>
            <PhoneInputWithCountry value={phone} onChange={setPhone} />
          </div>
          <div className="space-y-2">
            <Label>{t("nav.users")}</Label>
            <div className="flex flex-wrap gap-2">
              {roles.length === 0 && <span className="text-sm text-muted-foreground">{t("common.none")}</span>}
              {roles.map((r) => <Badge key={r} variant="secondary">{t(`roles.${r}`)}</Badge>)}
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-lg">{t("auth.updatePassword", "تغيير كلمة المرور")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("auth.newPassword", "كلمة المرور الجديدة")}</Label>
            <Input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="••••••••"
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">
              {t("auth.passwordRules", "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("auth.confirmPassword", "تأكيد كلمة المرور")}</Label>
            <Input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="••••••••"
              minLength={6}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">
                {t("auth.passwordMismatch", "كلمات المرور غير متطابقة")}
              </p>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={updatePassword} 
            disabled={changingPassword || !newPassword || newPassword !== confirmPassword}
          >
            {changingPassword && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("auth.updatePassword", "تحديث كلمة المرور")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
