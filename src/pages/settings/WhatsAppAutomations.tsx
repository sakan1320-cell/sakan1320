import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, Clock, Users, ArrowRightLeft, Plus, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AutomationSetting {
  id: string;
  template_key: string;
  is_active: boolean;
  trigger_event: string;
  target_audience: string;
  delay_minutes: number;
}

const TRIGGERS: Record<string, string> = {
  registration_accepted: "عند قبول التسجيل",
  group_created: "عند إنشاء مجموعة",
  absence_recorded: "عند تسجيل الغياب",
  late_recorded: "عند تسجيل التأخر",
  task_assigned: "عند إسناد مهمة",
  certificate_issued: "عند صدور شهادة",
};

const AUDIENCES: Record<string, string> = {
  guardian: "ولي الأمر",
  participant: "المشارك",
  both: "ولي الأمر والمشارك",
};

export default function WhatsAppAutomations() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newAuto, setNewAuto] = useState({
    trigger_event: "",
    template_key: "",
    target_audience: "guardian",
    delay_minutes: 0,
  });
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{id: string; name_ar: string; whatsapp_automation_enabled: boolean}[]>([]);
  const [togglingProject, setTogglingProject] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    const [{ data: settingsData }, { data: tplData }, { data: projectsData }] = await Promise.all([
      supabase.from("whatsapp_automation_settings").select("*").order("created_at", { ascending: true }),
      supabase.from("notification_templates").select("key, name").eq("channel", "whatsapp").order("name"),
      supabase.from("projects").select("id, name_ar, whatsapp_automation_enabled").order("name_ar"),
    ]);
    setSettings(settingsData || []);
    setTemplates(tplData || []);
    setProjects(projectsData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const toggleProjectAutomation = async (projectId: string, current: boolean) => {
    setTogglingProject(projectId);
    const { error } = await supabase
      .from("projects")
      .update({ whatsapp_automation_enabled: !current })
      .eq("id", projectId);
    setTogglingProject(null);
    if (error) {
      toast.error("فشل تحديث الإعداد");
    } else {
      toast.success(!current ? "✅ تم تفعيل الأتمتة للمشروع" : "⏹ تم إيقاف الأتمتة للمشروع");
      setProjects(projects.map(p => p.id === projectId ? { ...p, whatsapp_automation_enabled: !current } : p));
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("whatsapp_automation_settings")
      .update({ is_active: !current })
      .eq("id", id);
      
    if (error) {
      toast.error(t("errors.saveFailed"));
    } else {
      toast.success(!current ? "تم تفعيل الأتمتة" : "تم تعطيل الأتمتة");
      setSettings(settings.map(s => s.id === id ? { ...s, is_active: !current } : s));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("whatsapp_automation_settings").delete().eq("id", id);
    if (error) toast.error("فشل الحذف");
    else {
      toast.success("تم حذف الحدث");
      setSettings(settings.filter(s => s.id !== id));
    }
  };

  const handleAddNew = async () => {
    if (!newAuto.trigger_event || !newAuto.template_key) {
      toast.error("يجب اختيار الحدث والقالب");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("whatsapp_automation_settings").insert({
      trigger_event: newAuto.trigger_event,
      template_key: newAuto.template_key,
      target_audience: newAuto.target_audience,
      delay_minutes: newAuto.delay_minutes,
      is_active: false,
    });
    setSaving(false);
    if (error) {
      toast.error("حدث خطأ: " + error.message);
    } else {
      toast.success("تمت إضافة الحدث بنجاح! فعّله من الجدول.");
      setAddingNew(false);
      setNewAuto({ trigger_event: "", template_key: "", target_audience: "guardian", delay_minutes: 0 });
      loadSettings();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إعدادات الرسائل التلقائية</h1>
          <p className="text-muted-foreground mt-1">التحكم في تشغيل وإيقاف القوالب التلقائية بناءً على أحداث النظام.</p>
        </div>
        <Button onClick={() => setAddingNew(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          إضافة حدث تلقائي
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
        <CardContent className="pt-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p>⚠️ <strong>تنبيه:</strong> الأحداث التلقائية تُرسل الرسائل فور وقوع الحدث دون تدخل بشري. تأكد من صحة إعداداتها قبل تفعيلها.</p>
          <p>✅ الرسائل التلقائية تعتمد على القوالب المعتمدة (APPROVED) من ChakraHQ وتصل لأي رقم بدون قيود الـ 24 ساعة.</p>
        </CardContent>
      </Card>

      {/* Projects automation toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-600" />
            تفعيل الأتمتة لكل مشروع
          </CardTitle>
          <CardDescription>
            الأتمتة لن تعمل لأي مشروع إلا بعد تفعيلها هنا. الأحداث المفعّلة في الجدول أدناه تُطبَّق فقط على المشاريع المفعّلة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المشروع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تفعيل / تعطيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">لا توجد مشاريع.</TableCell></TableRow>
                ) : projects.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name_ar}</TableCell>
                    <TableCell>
                      {p.whatsapp_automation_enabled
                        ? <Badge className="bg-green-100 text-green-700 border-green-200">مفعّلة</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">معطّلة</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.whatsapp_automation_enabled}
                        onCheckedChange={() => toggleProjectAutomation(p.id, p.whatsapp_automation_enabled)}
                        disabled={togglingProject === p.id}
                        dir="ltr"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> قائمة الأحداث التلقائية</CardTitle>
          <CardDescription>الرسائل التي ترسل تلقائياً دون تدخل بشري عند وقوع الحدث.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحدث (Trigger)</TableHead>
                  <TableHead>القالب المرتبط</TableHead>
                  <TableHead>المستهدف</TableHead>
                  <TableHead>التأخير الزمني</TableHead>
                  <TableHead>تفعيل / تعطيل</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6">جاري التحميل...</TableCell></TableRow>
                ) : settings.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد إعدادات. اضغط "إضافة حدث تلقائي".</TableCell></TableRow>
                ) : (
                  settings.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                          {TRIGGERS[s.trigger_event] || s.trigger_event}
                        </div>
                      </TableCell>
                      <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{s.template_key}</code></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex w-fit items-center gap-1">
                          <Users className="w-3 h-3" />
                          {AUDIENCES[s.target_audience] || s.target_audience}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {s.delay_minutes === 0 ? "فوري" : `بعد ${s.delay_minutes} دقيقة`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={s.is_active} 
                          onCheckedChange={() => toggleActive(s.id, s.is_active)} 
                          dir="ltr"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Add New Automation */}
      <Dialog open={addingNew} onOpenChange={v => !v && setAddingNew(false)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              إضافة حدث تلقائي جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>الحدث الذي يُشغّل الرسالة <span className="text-destructive">*</span></Label>
              <Select value={newAuto.trigger_event} onValueChange={v => setNewAuto({ ...newAuto, trigger_event: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الحدث..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGERS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>القالب المرتبط <span className="text-destructive">*</span></Label>
              <Select value={newAuto.template_key} onValueChange={v => setNewAuto({ ...newAuto, template_key: v })}>
                <SelectTrigger><SelectValue placeholder="اختر القالب..." /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستهدف بالرسالة</Label>
              <Select value={newAuto.target_audience} onValueChange={v => setNewAuto({ ...newAuto, target_audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التأخير الزمني (بالدقائق)</Label>
              <Input
                type="number"
                min={0}
                value={newAuto.delay_minutes}
                onChange={e => setNewAuto({ ...newAuto, delay_minutes: parseInt(e.target.value) || 0 })}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">0 = إرسال فوري عند وقوع الحدث</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddingNew(false)}>إلغاء</Button>
              <Button onClick={handleAddNew} disabled={saving}>
                <Save className="w-4 h-4 me-2" />
                {saving ? "جاري الحفظ..." : "إضافة"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
