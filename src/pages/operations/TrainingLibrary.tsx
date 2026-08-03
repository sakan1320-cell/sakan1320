import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, BookOpen, Trash2, Pencil, Link as LinkIcon, FileText, Upload, FileBox, LayoutTemplate, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableCourseItemCard } from "@/components/SortableCourseItemCard";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface DynamicField {
  id: string;
  type: "text" | "link" | "file_download" | "assignment_upload" | "video";
  title: string;
  content?: string;
  is_required: boolean;
}

interface Template {
  id: string;
  title_ar: string;
  title_en: string | null;
  description: string | null;
  cover_url: string | null;
  is_published: boolean;
  structure_jsonb: DynamicField[];
}

const emptyTemplate: Partial<Template> = {
  title_ar: "", title_en: "", description: "", cover_url: "", is_published: false, structure_jsonb: []
};

const pointerSensorOptions = { activationConstraint: { distance: 5 } };
const keyboardSensorOptions = { coordinateGetter: sortableKeyboardCoordinates };

const TrainingLibrary = () => {
  const { t, i18n } = useTranslation();
  const { user, isSystemAdmin, hasAnyRole } = useAuth();
  const { confirm, ConfirmDialogNode } = useConfirm();
  const isRtl = i18n.language === "ar";
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Template>>(emptyTemplate);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedNewType, setSelectedNewType] = useState<DynamicField["type"]>("text");

  const isAdmin = hasAnyRole(["system_admin", "executive", "assistant"]);

  const uploadImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Memoize sensors using constant options
  const sensors = useSensors(
    useSensor(PointerSensor, pointerSensorOptions),
    useSensor(KeyboardSensor, keyboardSensorOptions)
  );

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("training_library").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) toast.error(error.message);
    else setTemplates(data as Template[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    if (!form.title_ar?.trim()) {
      toast.error(isRtl ? "عنوان الحقيبة (عربي) مطلوب" : "Title (AR) is required");
      return;
    }
    const payload = {
      title_ar: form.title_ar,
      title_en: form.title_en || null,
      description: form.description || null,
      cover_url: form.cover_url || null,
      is_published: !!form.is_published,
      structure_jsonb: form.structure_jsonb || [],
    };

    let error;
    if (form.id) {
      const { error: err } = await supabase.from("training_library").update(payload).eq("id", form.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("training_library").insert([{ ...payload, created_by: user?.id }]);
      error = err;
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRtl ? "تم الحفظ بنجاح" : "Saved successfully");
      setOpen(false);
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!(await confirm(isRtl ? "هل أنت متأكد من حذف هذه الحقيبة؟" : "Are you sure?"))) return;
    const { error } = await supabase.from("training_library").delete().eq("id", id);
    if (error) toast.error(error.message);
    else fetchTemplates();
  };

  const addField = (type: DynamicField["type"]) => {
    const newField: DynamicField = {
      id: crypto.randomUUID(),
      type,
      title: isRtl ? "عنصر جديد" : "New Item",
      is_required: true,
      content: ""
    };
    setForm(prev => ({ ...prev, structure_jsonb: [...(prev.structure_jsonb || []), newField] }));
  };

  const removeField = (id: string) => {
    setForm(prev => ({ ...prev, structure_jsonb: (prev.structure_jsonb || []).filter(f => f.id !== id) }));
  };

  const updateField = (id: string, updates: Partial<DynamicField>) => {
    setForm(prev => ({
      ...prev,
      structure_jsonb: (prev.structure_jsonb || []).map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setForm(prev => {
      const items = prev.structure_jsonb || [];
      const oldIndex = items.findIndex(f => f.id === active.id);
      const newIndex = items.findIndex(f => f.id === over.id);
      return { ...prev, structure_jsonb: arrayMove(items, oldIndex, newIndex) };
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {ConfirmDialogNode}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutTemplate className="h-8 w-8 text-primary" />
            {isRtl ? "مكتبة الدورات والمسارات التدريبية" : "Training Courses & Paths Library"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isRtl ? "المستودع المركزي لقوالب الحقائب التدريبية الجاهزة ليتم تخصيصها داخل المشاريع." : "Central repository for training templates to be customized inside projects."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm(emptyTemplate); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            {isRtl ? "إنشاء قالب جديد" : "Create New Template"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <BookOpen className="mb-4 h-12 w-12 opacity-20" />
            <p>{isRtl ? "لا توجد قوالب في المكتبة حالياً." : "No templates in library."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map(tpl => (
            <Card key={tpl.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 relative border-border/50">
              <div className="h-40 relative bg-gradient-to-br from-primary/10 to-primary/5">
                {tpl.cover_url ? (
                  <img src={tpl.cover_url} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileBox className="h-16 w-16 text-primary/20" />
                  </div>
                )}
                {!tpl.is_published && (
                  <Badge variant="secondary" className="absolute top-2 start-2 bg-background/80 backdrop-blur-sm">
                    {isRtl ? "مسودة" : "Draft"}
                  </Badge>
                )}
              </div>
              <CardContent className="p-5">
                <h3 className="font-bold text-lg mb-2 line-clamp-1">{isRtl ? tpl.title_ar : (tpl.title_en || tpl.title_ar)}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                  {tpl.description || (isRtl ? "لا يوجد وصف" : "No description")}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {(tpl.structure_jsonb || []).length} {isRtl ? "عناصر" : "Items"}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => { setForm(tpl); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" /> {isRtl ? "تعديل" : "Edit"}
                    </Button>
                    <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive hover:text-white transition-colors" onClick={() => deleteTemplate(tpl.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{form.id ? (isRtl ? "تعديل قالب التدريب" : "Edit Training Template") : (isRtl ? "إنشاء قالب تدريب جديد" : "Create Training Template")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRtl ? "العنوان (عربي) *" : "Title (AR) *"}</Label>
                <Input value={form.title_ar || ""} onChange={e => setForm({...form, title_ar: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "العنوان (إنجليزي)" : "Title (EN)"}</Label>
                <Input value={form.title_en || ""} onChange={e => setForm({...form, title_en: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{isRtl ? "الوصف" : "Description"}</Label>
                <Textarea value={form.description || ""} rows={2} onChange={e => setForm({...form, description: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "صورة الغلاف" : "Cover Image"}</Label>
                <div className="flex gap-3 items-center">
                  {form.cover_url && (
                    <img src={form.cover_url} alt="Cover" className="h-10 w-16 object-cover rounded border" />
                  )}
                  <div className="relative flex-1">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="bg-background"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setUploading(true);
                          const base64 = await uploadImageFile(file);
                          setForm({...form, cover_url: base64});
                        } catch (error) {
                          toast.error(isRtl ? "فشل رفع الصورة" : "Failed to upload image");
                        } finally {
                          setUploading(false);
                        }
                      }} 
                      disabled={uploading}
                    />
                    {uploading && <Loader2 className="absolute top-2.5 left-2.5 h-5 w-5 animate-spin text-muted-foreground" />}
                  </div>
                  {form.cover_url && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => setForm({...form, cover_url: ""})}
                      disabled={uploading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center gap-2 h-10 border rounded-md px-3 bg-background">
                  <Switch checked={form.is_published || false} onCheckedChange={v => setForm({...form, is_published: v})} />
                  <Label className="cursor-pointer">{isRtl ? "نشر القالب في المكتبة العامة" : "Publish to Library"}</Label>
                </div>
              </div>
            </div>

            <div className="border-t pt-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <Label className="text-lg font-bold text-primary">{isRtl ? "منشئ محتوى ومسار الدورة (بناء ديناميكي)" : "Dynamic Course Path Builder"}</Label>
                
                <div className="flex items-center w-full sm:w-auto border rounded-xl overflow-hidden bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                  <Select value={selectedNewType} onValueChange={(v: any) => setSelectedNewType(v)}>
                    <SelectTrigger className="border-0 focus:ring-0 rounded-none w-[170px] bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground"/><span>{isRtl ? "نص إرشادي" : "Text"}</span></div></SelectItem>
                      <SelectItem value="link"><div className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-muted-foreground"/><span>{isRtl ? "رابط خارجي/لقاء" : "Link"}</span></div></SelectItem>
                      <SelectItem value="file_download"><div className="flex items-center gap-2"><Upload className="h-4 w-4 text-muted-foreground"/><span>{isRtl ? "ملف للتحميل" : "File Download"}</span></div></SelectItem>
                      <SelectItem value="assignment_upload"><div className="flex items-center gap-2"><FileBox className="h-4 w-4 text-muted-foreground"/><span>{isRtl ? "مهمة (رفع ملف)" : "Assignment Upload"}</span></div></SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button onClick={() => addField(selectedNewType)} className="rounded-none border-0 gap-1 px-4 h-10 hover:bg-primary/90">
                    <Plus className="h-4 w-4" /> {isRtl ? "إضافة عنصر" : "Add Item"}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {(!form.structure_jsonb || form.structure_jsonb.length === 0) ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl bg-card text-muted-foreground bg-muted/10">
                    {isRtl ? "قم بإضافة عناصر لبناء مسار الدورة من القائمة العلوية" : "Add items to build the course path from the menu above"}
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={(form.structure_jsonb || []).map(f => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 relative pt-2">
                        {(form.structure_jsonb || []).map((field, index) => (
                          <SortableCourseItemCard
                            key={field.id}
                            field={field}
                            index={index}
                            isRtl={isRtl}
                            onRemove={removeField}
                            onUpdate={updateField}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t bg-card">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl w-full sm:w-auto">{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} className="gap-2 rounded-xl w-full sm:w-auto"><LayoutTemplate className="h-4 w-4" /> {isRtl ? "حفظ القالب" : "Save Template"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingLibrary;
