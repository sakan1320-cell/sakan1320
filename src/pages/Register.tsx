import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock, Paperclip } from "lucide-react";
import logo from "@/assets/logo.png";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(20),
  national_id: z.string().trim().max(30).optional().nullable(),
  requested_role: z.enum(["employee", "contractor", "project_manager", "branch_manager"]),
  notes: z.string().max(1000).optional().nullable(),
});

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", national_id: "",
    requested_role: "employee", notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [slug, setSlug] = useState("register");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "staff_registration")
        .maybeSingle();
      const v = (data?.value as any) ?? {};
      setEnabled(v.enabled !== false);
      const s = typeof v.slug === "string" && v.slug ? v.slug : "register";
      setSlug(s);
      // Redirect old /register to custom slug
      if (s !== "register" && window.location.pathname === "/register") {
        navigate(`/${s}`, { replace: true });
      }
      setLoadingSettings(false);
    })();
  }, [navigate]);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("common.error"));
      return;
    }
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(t("register.attachmentInvalid", "نوع الملف غير مدعوم"));
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error(t("register.attachmentTooLarge", "حجم الملف يتجاوز 5 ميجابايت"));
        return;
      }
    }
    setBusy(true);

    let attachment_url: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("staff-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { toast.error(upErr.message); setBusy(false); return; }
      attachment_url = path;
    }

    const { error } = await supabase.from("staff_registration_requests").insert([{
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      national_id: parsed.data.national_id || null,
      requested_role: parsed.data.requested_role,
      notes: parsed.data.notes || null,
      status: "pending",
      attachment_url,
    }]);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  if (loadingSettings) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center space-y-3">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <CardTitle>{t("register.closedTitle", "التسجيل مغلق حالياً")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{t("register.closedDesc", "لا يتم استقبال طلبات جديدة في الوقت الحالي.")}</p>
            <Link to="/"><Button variant="outline">{t("common.back", "رجوع")}</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center space-y-3">
          <img src={logo} alt={t("app.name")} className="h-16 w-16 object-contain" />
          <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("register.subtitle")}</p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-14 w-14 text-success" />
              <p className="font-medium">{t("register.success")}</p>
              <p className="text-sm text-muted-foreground">{t("register.successDesc")}</p>
              <Link to="/auth"><Button variant="outline" className="mt-2">{t("auth.login")}</Button></Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("register.fullName")} *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={120} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("register.email")} *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.phone")} *</Label>
                  <PhoneInputWithCountry
                    value={form.phone}
                    onChange={(val) => setForm({ ...form, phone: val })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("register.nationalId")}</Label>
                  <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.role")} *</Label>
                  <Select value={form.requested_role} onValueChange={(v) => setForm({ ...form, requested_role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">{t("roles.employee")}</SelectItem>
                      <SelectItem value="contractor">{t("roles.contractor")}</SelectItem>
                      <SelectItem value="project_manager">{t("roles.project_manager")}</SelectItem>
                      <SelectItem value="branch_manager">{t("roles.branch_manager")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("register.notes")}</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  {t("register.attachment", "المرفق (سيرة ذاتية أو مستند)")}
                </Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,image/jpeg,image/png"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("register.attachmentHint", "PDF / Word / صور — أقصى 5 ميجابايت")}
                </p>
              </div>
              <Button className="w-full" onClick={submit} disabled={busy}>
                {busy ? t("common.loading") : t("register.submit")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link to="/auth" className="underline">{t("auth.haveAccount")} {t("auth.login")}</Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
