import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Save, Plus, Trash2, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    key: "",
    name: "",
    body_template: "",
    bodyVars: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("notification_templates").select("*").eq("channel", "whatsapp").order("name");
    if (error) {
      toast.error("حدث خطأ أثناء جلب القوالب");
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openEditor = (template: any) => {
    const config = template.variables_config || [];
    const meta = template.meta_components || { body: [], header: [], button_0: [] };
    
    if (config.length === 0) {
      (template.variables || []).forEach((v: string) => {
        config.push({ key: v, label_ar: v, type: "auto" });
        if (!meta.body) meta.body = [];
        if (!meta.body.includes(v)) meta.body.push(v);
      });
      (template.manual_variables || []).forEach((v: string) => {
        config.push({ key: v, label_ar: v, type: "manual" });
        if (!meta.body) meta.body = [];
        if (!meta.body.includes(v)) meta.body.push(v);
      });
    }

    setEditingTemplate({
      ...template,
      variables_config: [...config],
      meta_components: { ...meta }
    });
  };

  const handleSaveConfig = async () => {
    if (!editingTemplate) return;
    const autoVars = editingTemplate.variables_config.filter((v:any) => v.type === "auto").map((v:any) => v.key);
    const manualVars = editingTemplate.variables_config.filter((v:any) => v.type === "manual").map((v:any) => v.key);

    const { error } = await supabase.from("notification_templates")
      .update({
        variables_config: editingTemplate.variables_config,
        meta_components: editingTemplate.meta_components,
        variables: autoVars,
        manual_variables: manualVars
      })
      .eq("id", editingTemplate.id);

    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } else {
      toast.success("تم الحفظ بنجاح");
      setEditingTemplate(null);
      fetchTemplates();
    }
  };

  const addVariable = () => {
    setEditingTemplate({
      ...editingTemplate,
      variables_config: [
        ...editingTemplate.variables_config,
        { key: "new_var", label_ar: "متغير جديد", type: "manual" }
      ]
    });
  };

  const removeVariable = (idx: number) => {
    const newConfig = [...editingTemplate.variables_config];
    newConfig.splice(idx, 1);
    setEditingTemplate({ ...editingTemplate, variables_config: newConfig });
  };

  const updateVariable = (idx: number, field: string, value: string) => {
    const newConfig = [...editingTemplate.variables_config];
    newConfig[idx][field] = value;
    setEditingTemplate({ ...editingTemplate, variables_config: newConfig });
  };

  const updateMetaComponent = (component: string, value: string) => {
    const vars = value.split(",").map(s => s.trim()).filter(s => s);
    setEditingTemplate({
      ...editingTemplate,
      meta_components: {
        ...editingTemplate.meta_components,
        [component]: vars
      }
    });
  };

  const handleAddNewTemplate = async () => {
    if (!newTemplate.key.trim() || !newTemplate.name.trim()) {
      toast.error("يجب إدخال مفتاح القالب والاسم");
      return;
    }
    setSaving(true);
    const bodyVarsList = newTemplate.bodyVars.split(",").map(s => s.trim()).filter(s => s);
    const { error } = await supabase.from("notification_templates").insert({
      key: newTemplate.key.trim(),
      name: newTemplate.name.trim(),
      channel: "whatsapp",
      body_template: newTemplate.body_template,
      variables: [],
      manual_variables: bodyVarsList,
      meta_components: { body: bodyVarsList },
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("هذا المفتاح موجود مسبقاً، اختر مفتاحاً مختلفاً");
      } else {
        toast.error("حدث خطأ: " + error.message);
      }
    } else {
      toast.success("تم إضافة القالب بنجاح!");
      setAddingNew(false);
      setNewTemplate({ key: "", name: "", body_template: "", bodyVars: "" });
      fetchTemplates();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <LayoutTemplate className="w-8 h-8 text-primary" />
            إدارة قوالب واتساب
          </h1>
          <p className="text-gray-500 mt-2">إضافة وتهيئة قوالب واتساب المعتمدة من ChakraHQ</p>
        </div>
        <Button onClick={() => setAddingNew(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          إضافة قالب جديد
        </Button>
      </div>

      {/* Instruction card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300">💡 كيفية إضافة قالب جديد</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <p>1. أنشئ القالب في <strong>ChakraHQ</strong> باستخدام متغيرات رقمية مثل: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{{1}}"}</code> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{{2}}"}</code></p>
          <p>2. انتظر موافقة Meta (APPROVED).</p>
          <p>3. اضغط <strong>"+ إضافة قالب جديد"</strong> وأدخل المفتاح المطابق لاسم القالب في ChakraHQ.</p>
          <p>4. في حقل <strong>"ترتيب المتغيرات"</strong> أدخلها بالترتيب مفصولة بفاصلة مثل: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">1, 2, 3</code></p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم القالب</TableHead>
                <TableHead>مفتاح القالب (ChakraHQ)</TableHead>
                <TableHead>عدد المتغيرات</TableHead>
                <TableHead>الإعدادات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : templates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد قوالب. اضغط "إضافة قالب جديد".</TableCell></TableRow>
              ) : templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold">{t.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{t.key}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {((t.variables || []).length + (t.manual_variables || []).length)} متغير
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEditor(t)}>
                      <Settings className="w-4 h-4 me-2" />
                      تهيئة المتغيرات
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Add New Template */}
      <Dialog open={addingNew} onOpenChange={v => !v && setAddingNew(false)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              إضافة قالب واتساب جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>مفتاح القالب (Key) <span className="text-destructive">*</span></Label>
              <Input
                placeholder="مثال: late_alert أو my_new_template"
                value={newTemplate.key}
                onChange={e => setNewTemplate({ ...newTemplate, key: e.target.value.replace(/\s/g, "_") })}
                dir="ltr"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">يجب أن يطابق تماماً اسم القالب في ChakraHQ</p>
            </div>
            <div className="space-y-2">
              <Label>الاسم العربي (يظهر في النظام) <span className="text-destructive">*</span></Label>
              <Input
                placeholder="مثال: رسالة تأخر"
                value={newTemplate.name}
                onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ترتيب المتغيرات (Body) <span className="text-destructive">*</span></Label>
              <Input
                placeholder="مثال: 1, 2, 3, 4"
                value={newTemplate.bodyVars}
                onChange={e => setNewTemplate({ ...newTemplate, bodyVars: e.target.value })}
                dir="ltr"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                أدخل المتغيرات بالترتيب كما في القالب مفصولة بفاصلة. المتغير الأول هنا يقابل {"{{1}}"} في ChakraHQ.
              </p>
            </div>
            <div className="space-y-2">
              <Label>نص القالب (للمعاينة فقط - اختياري)</Label>
              <Textarea
                placeholder="عزيزي {{1}}، نفيدكم بتأخر {{2}}..."
                value={newTemplate.body_template}
                onChange={e => setNewTemplate({ ...newTemplate, body_template: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddingNew(false)}>إلغاء</Button>
              <Button onClick={handleAddNewTemplate} disabled={saving}>
                <Save className="w-4 h-4 me-2" />
                {saving ? "جاري الحفظ..." : "إضافة القالب"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Template Variables */}
      <Dialog open={!!editingTemplate} onOpenChange={(v) => !v && setEditingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعدادات قالب: {editingTemplate?.name}</DialogTitle>
          </DialogHeader>
          
          {editingTemplate && (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">المتغيرات (Variables)</h3>
                  <Button variant="outline" size="sm" onClick={addVariable}>
                    <Plus className="w-4 h-4 me-1" /> إضافة متغير
                  </Button>
                </div>
                
                {editingTemplate.variables_config.map((v: any, idx: number) => (
                  <div key={idx} className="flex gap-2 items-end bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
                    <div className="flex-1">
                      <Label>المفتاح (الاسم البرمجي)</Label>
                      <Input value={v.key} onChange={e => updateVariable(idx, "key", e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <Label>الشرح العربي (يظهر للمستخدم)</Label>
                      <Input value={v.label_ar} onChange={e => updateVariable(idx, "label_ar", e.target.value)} />
                    </div>
                    <div className="w-32">
                      <Label>النوع</Label>
                      <Select value={v.type} onValueChange={val => updateVariable(idx, "type", val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">تلقائي من النظام</SelectItem>
                          <SelectItem value="manual">إدخال يدوي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="destructive" size="icon" onClick={() => removeVariable(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">ربط مكونات Meta (Meta Components)</h3>
                <p className="text-sm text-muted-foreground">أدخل مفاتيح المتغيرات بالترتيب، مفصولة بفاصلة (,). اترك الحقل فارغاً إذا كان المكون لا يحتوي على متغيرات.</p>
                
                <div className="space-y-2">
                  <Label>النص الأساسي (Body)</Label>
                  <Input 
                    value={(editingTemplate.meta_components?.body || []).join(", ")} 
                    onChange={e => updateMetaComponent("body", e.target.value)}
                    placeholder="مثال: 1, 2, 3, 4"
                  />
                </div>
                <div className="space-y-2">
                  <Label>العنوان (Header)</Label>
                  <Input 
                    value={(editingTemplate.meta_components?.header || []).join(", ")} 
                    onChange={e => updateMetaComponent("header", e.target.value)}
                    placeholder="مثال: header_image_url"
                  />
                </div>
                <div className="space-y-2">
                  <Label>زر الرابط (Button 0)</Label>
                  <Input 
                    value={(editingTemplate.meta_components?.button_0 || []).join(", ")} 
                    onChange={e => updateMetaComponent("button_0", e.target.value)}
                    placeholder="مثال: 1"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveConfig} className="w-32">
                  <Save className="w-4 h-4 me-2" />
                  حفظ
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
