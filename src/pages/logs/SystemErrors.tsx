import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, Copy, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

interface SystemError {
  id: string;
  message: string;
  stack_trace: string;
  url: string;
  user_id: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
  resolved: boolean;
  created_at: string;
}

const translateErrorMessage = (msg: string) => {
  if (!msg) return "خطأ غير معروف";
  const m = msg.toLowerCase();
  
  if (m.includes("schema cache")) return "خطأ في تزامن قاعدة البيانات (تحتاج تحديث Schema)";
  if (m.includes("network error") || m.includes("failed to fetch")) return "مشكلة في الاتصال بالشبكة أو الخادم";
  if (m.includes("jwt") || m.includes("token") || m.includes("unauthorized")) return "جلسة المستخدم انتهت أو غير مصرح له";
  if (m.includes("duplicate key")) return "هذا السجل موجود مسبقاً (تكرار في البيانات)";
  if (m.includes("violates row-level security")) return "تم رفض الوصول بسبب صلاحيات الحماية (RLS)";
  if (m.includes("null value in column")) return "فشل الحفظ: هناك حقل إلزامي مفقود";
  if (m.includes("timeout")) return "انتهى وقت محاولة الاتصال بالخادم";
  if (m.includes("is not a function")) return "خطأ برمجي: تعذر العثور على دالة تشغيل";
  if (m.includes("reading 'map'") || m.includes("properties of undefined") || m.includes("properties of null")) return "خطأ برمجي: محاولة قراءة بيانات فارغة غير موجودة";
  if (m.includes("unexpected token") || m.includes("json")) return "خطأ في قراءة صيغة البيانات الواردة";
  if (m.includes("relation") && m.includes("does not exist")) return "خطأ برمجي: الجدول أو الرابط غير موجود بقاعدة البيانات";
  
  return msg;
};

const SystemErrors = () => {
  const { t, i18n } = useTranslation();
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchErrors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_errors")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("حدث خطأ أثناء جلب الأخطاء");
    } else {
      setErrors(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const toggleStatus = async (id: string, currentResolved: boolean) => {
    const { error } = await supabase
      .from("system_errors")
      .update({ resolved: !currentResolved, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[SystemErrors] Error updating status:", error);
      toast.error(`فشل في تحديث حالة الخطأ: ${error.message}`);
    } else {
      toast.success(currentResolved ? "تم إعادة فتح المشكلة" : "تم تحديد الخطأ كمحلول");
      setErrors((prev) =>
        prev.map((err) => (err.id === id ? { ...err, resolved: !currentResolved } : err))
      );
    }
  };

  const markAllResolved = async () => {
    const unresolvedIds = errors.filter(e => !e.resolved).map(e => e.id);
    if (unresolvedIds.length === 0) {
      toast.info("جميع الأخطاء محلولة بالفعل");
      return;
    }
    
    const { error } = await supabase
      .from("system_errors")
      .update({ resolved: true, updated_at: new Date().toISOString() })
      .in("id", unresolvedIds);

    if (error) {
      console.error("[SystemErrors] Error resolving all:", error);
      toast.error(`فشل في تحديث حالة الأخطاء: ${error.message}`);
    } else {
      toast.success("تم تحديد كافة الأخطاء كمحلولة");
      setErrors((prev) =>
        prev.map((err) => ({ ...err, resolved: true }))
      );
    }
  };

  const copyErrorDetails = (err: SystemError) => {
    const report = `
تقرير تفاصيل الخطأ
--------------------
الوقت: ${format(new Date(err.created_at), "PPp", { locale: i18n.language === "ar" ? arSA : undefined })}
الرابط: ${err.url || "غير متوفر"}
المستخدم: ${err.profiles?.full_name || err.profiles?.email || err.user_id || "زائر غير مسجل"}
معرف المستخدم: ${err.user_id || "غير متوفر"}
رسالة الخطأ: ${err.message}
التفاصيل التقنية (Stack Trace):
${err.stack_trace || "لا توجد تفاصيل إضافية"}
--------------------
    `.trim();

    navigator.clipboard.writeText(report);
    toast.success("تم نسخ تفاصيل الخطأ بنجاح! يمكنك الآن لصقها للمطور الذكي.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سجل أخطاء النظام</h1>
          <p className="text-muted-foreground mt-2">
            إدارة ومتابعة السجلات التقنية للأعطال.
          </p>
        </div>
        <div className="flex gap-2">
          {errors.some(e => !e.resolved) && (
            <Button onClick={markAllResolved} variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 className="h-4 w-4 ml-2" />
              تحديد الكل كمحلول
            </Button>
          )}
          <Button onClick={fetchErrors} variant="outline" size="sm">
            تحديث <RefreshCw className="h-4 w-4 mr-2" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : errors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p>لا توجد أخطاء مسجلة حالياً. النظام يعمل باستقرار.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {errors.map((err) => (
            <Card key={err.id} className={err.resolved ? "opacity-75" : "border-destructive/50"}>
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {err.resolved ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">تم الحل</Badge>
                    ) : (
                      <Badge variant="destructive">يوجد مشكلة</Badge>
                    )}
                    <div className="flex flex-col">
                      <CardTitle className={`text-lg font-semibold ${err.resolved ? 'text-green-600' : 'text-destructive'}`} dir="rtl">
                        {translateErrorMessage(err.message)}
                      </CardTitle>
                      {translateErrorMessage(err.message) !== err.message && (
                        <span className="text-xs text-muted-foreground mt-1" dir="ltr">{err.message}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(err.created_at), "PPp", { locale: i18n.language === "ar" ? arSA : undefined })}
                    </span>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] break-all" dir="ltr">
                      {err.url || "رابط غير متوفر"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => copyErrorDetails(err)} className="text-muted-foreground hover:text-foreground bg-muted/30">
                    <Copy className="h-4 w-4 ml-2" />
                    نسخ التقرير للمطور
                  </Button>
                  <Button size="sm" variant={err.resolved ? "secondary" : "outline"} onClick={() => toggleStatus(err.id, err.resolved)}>
                    تحديث الحالة
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {err.stack_trace && (
                  <div className="mt-2 bg-muted/50 p-3 rounded-md overflow-auto max-h-40" dir="ltr">
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                      {err.stack_trace}
                    </pre>
                  </div>
                )}
                <div className="mt-4 pt-3 border-t flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    المستخدم: <span className="font-semibold text-foreground/80">{err.profiles?.full_name || err.profiles?.email || "غير معروف (زائر أو غير مسجل)"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground opacity-75">
                    معرف المستخدم (ID): <span className="font-mono">{err.user_id || "غير متوفر"}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemErrors;
