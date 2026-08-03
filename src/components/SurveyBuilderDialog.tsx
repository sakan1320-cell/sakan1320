import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSurvey, SurveyField, SurveyFieldType } from "@/types/surveys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, GripVertical, Save, Info, Eye } from "lucide-react";
import { SurveyViewerDialog } from "./SurveyViewerDialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialSurvey: ProjectSurvey | null;
  onSaved: () => void;
}

export const SurveyBuilderDialog = ({ open, onOpenChange, projectId, initialSurvey, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<SurveyField[]>([]);
  const [isTemplate, setIsTemplate] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [targetAudience, setTargetAudience] = useState<"team" | "participants">("participants");

  useEffect(() => {
    if (initialSurvey) {
      setTitle(initialSurvey.title_ar || "");
      setDescription(initialSurvey.description || "");
      setFields(initialSurvey.fields || []);
      setIsTemplate(initialSurvey.is_template || false);
      setIsPublished(initialSurvey.is_published || false);
      setTargetAudience(initialSurvey.target_audience || "participants");
    } else {
      setTitle("");
      setDescription("");
      setFields([]);
      setIsTemplate(false);
      setIsPublished(false);
      setTargetAudience("participants");
    }
  }, [initialSurvey, open]);

  const generateId = () => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const addField = () => {
    setFields([...fields, {
      id: generateId(),
      type: "short_answer",
      label: "سؤال جديد",
      required: false
    }]);
  };

  const updateField = (id: string, updates: Partial<SurveyField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSave = async (saveAsTemplate = false) => {
    if (!title.trim()) {
      return toast.error("يرجى إدخال عنوان الاستبيان");
    }
    
    setLoading(true);
    try {
      const payload = {
        project_id: saveAsTemplate ? null : projectId,
        title_ar: title,
        description,
        is_template: saveAsTemplate,
        fields,
        is_published: isPublished,
        target_audience: targetAudience,
      };

      if (initialSurvey && !saveAsTemplate) {
        const { error } = await supabase.from("project_surveys").update(payload).eq("id", initialSurvey.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_surveys").insert([payload]);
        if (error) throw error;
      }

      toast.success(saveAsTemplate ? "تم حفظ القالب بنجاح" : "تم حفظ الاستبيان بنجاح");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialSurvey ? "تعديل الاستبيان" : "بناء استبيان جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
            <div>
              <Label>عنوان الاستبيان *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: استبيان رضا المشاركين" />
            </div>
            <div>
              <Label>الوصف (اختياري)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>الفئة المستهدفة</Label>
                <Select 
                  value={targetAudience} 
                  onValueChange={(val: "team" | "participants") => setTargetAudience(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الفئة المستهدفة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participants">المشاركون</SelectItem>
                    <SelectItem value="team">فريق العمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch 
                  id="builder-publish-switch"
                  checked={isPublished} 
                  onCheckedChange={setIsPublished} 
                />
                <Label htmlFor="builder-publish-switch" className="cursor-pointer font-medium">نشر الاستبيان للمستهدفين</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">حقول الاستبيان</h3>
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4 me-2" /> إضافة حقل
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-4 transition-all hover:border-primary/50">
                <div className="flex gap-4 items-start">
                  <div className="mt-2 text-muted-foreground cursor-move">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>نص السؤال <span className="text-destructive">*</span></Label>
                        <Input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          نوع الحقل 
                          <span title="يحدد شكل الإجابة للمشارك"><Info className="h-4 w-4 text-muted-foreground cursor-help" /></span>
                        </Label>
                        <Select value={field.type} onValueChange={(val: SurveyFieldType) => updateField(field.id, { type: val })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short_answer">إجابة قصيرة</SelectItem>
                            <SelectItem value="paragraph">فقرة نصية</SelectItem>
                            <SelectItem value="radio">خيارات متعددة (اختيار واحد)</SelectItem>
                            <SelectItem value="checkboxes">مربعات اختيار (متعدد)</SelectItem>
                            <SelectItem value="dropdown">قائمة منسدلة</SelectItem>
                            <SelectItem value="linear_scale">مقياس خطي</SelectItem>
                            <SelectItem value="star_rating">تقييم بالنجوم</SelectItem>
                            <SelectItem value="grid_matrix">شبكة خيارات (Grid Matrix)</SelectItem>
                            <SelectItem value="checkbox_grid">شبكة مربعات (Checkbox Grid)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>نص مساعد / وصفي (اختياري)</Label>
                      <Input 
                        value={field.description || ""} 
                        onChange={e => updateField(field.id, { description: e.target.value })} 
                        placeholder="نص يظهر أسفل السؤال لتوضيح المطلوب..."
                        className="text-sm bg-muted/50"
                      />
                    </div>

                    {/* Options builder for radio, checkboxes, dropdown */}
                    {["radio", "checkboxes", "dropdown"].includes(field.type) && (
                      <div className="space-y-3 ps-4 border-s-2 border-primary/20 py-2">
                        <Label className="text-muted-foreground">الخيارات المتاحة</Label>
                        {(field.options || [""]).map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <Input 
                              value={opt} 
                              onChange={e => {
                                const newOpts = [...(field.options || [""])];
                                newOpts[i] = e.target.value;
                                updateField(field.id, { options: newOpts });
                              }} 
                            />
                            <Button size="icon" variant="ghost" onClick={() => {
                              const newOpts = (field.options || [""]).filter((_, idx) => idx !== i);
                              updateField(field.id, { options: newOpts });
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => updateField(field.id, { options: [...(field.options || []), "خيار جديد"] })}>
                          <Plus className="h-3 w-3 me-1" /> إضافة خيار
                        </Button>
                      </div>
                    )}
                    {/* Linear scale builder */}
                    {field.type === "linear_scale" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ps-4 border-s-2 border-primary/20 py-2">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">القيمة الدنيا (0 أو 1)</Label>
                          <Select 
                            value={String(field.scale_min ?? 1)} 
                            onValueChange={v => updateField(field.id, { scale_min: Number(v) })}
                          >
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">القيمة العليا (2 إلى 10)</Label>
                          <Select 
                            value={String(field.scale_max ?? 10)} 
                            onValueChange={v => updateField(field.id, { scale_max: Number(v) })}
                          >
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {[2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">تسمية القيمة الدنيا (مثال: ضعيف جداً)</Label>
                          <Input value={field.scale_min_label || ""} onChange={e => updateField(field.id, { scale_min_label: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">تسمية القيمة العليا (مثال: ممتاز)</Label>
                          <Input value={field.scale_max_label || ""} onChange={e => updateField(field.id, { scale_max_label: e.target.value })} />
                        </div>
                      </div>
                    )}
                    {/* Star Rating builder */}
                    {field.type === "star_rating" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ps-4 border-s-2 border-primary/20 py-2">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">عدد النجوم (الحد الأقصى)</Label>
                          <Select 
                            value={String(field.scale_max ?? 5)} 
                            onValueChange={v => updateField(field.id, { scale_max: Number(v) })}
                          >
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {[3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {/* Grid Matrix builder */}
                    {["grid_matrix", "checkbox_grid"].includes(field.type) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ps-4 border-s-2 border-primary/20 py-2">
                        {/* Rows Builder */}
                        <div className="space-y-3">
                          <Label className="text-muted-foreground font-semibold">الصفوف (العبارات أو الأسئلة الفرعية)</Label>
                          {(field.grid_rows || [""]).map((row, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-2">
                              <Input 
                                value={row} 
                                onChange={e => {
                                  const newRows = [...(field.grid_rows || [""])];
                                  newRows[rIdx] = e.target.value;
                                  updateField(field.id, { grid_rows: newRows });
                                }} 
                                placeholder={`العبارة ${rIdx + 1}`}
                              />
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => {
                                  const newRows = (field.grid_rows || [""]).filter((_, idx) => idx !== rIdx);
                                  updateField(field.id, { grid_rows: newRows });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="secondary" onClick={() => updateField(field.id, { grid_rows: [...(field.grid_rows || []), ""] })}>
                            <Plus className="h-3 w-3 me-1" /> إضافة صف
                          </Button>
                        </div>

                        {/* Cols Builder */}
                        <div className="space-y-3">
                          <Label className="text-muted-foreground font-semibold">الأعمدة (التقييمات أو الخيارات)</Label>
                          {(field.grid_cols || [""]).map((col, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-2">
                              <Input 
                                value={col} 
                                onChange={e => {
                                  const newCols = [...(field.grid_cols || [""])];
                                  newCols[cIdx] = e.target.value;
                                  updateField(field.id, { grid_cols: newCols });
                                }} 
                                placeholder={`الخيار ${cIdx + 1}`}
                              />
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => {
                                  const newCols = (field.grid_cols || [""]).filter((_, idx) => idx !== cIdx);
                                  updateField(field.id, { grid_cols: newCols });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="secondary" onClick={() => updateField(field.id, { grid_cols: [...(field.grid_cols || []), ""] })}>
                            <Plus className="h-3 w-3 me-1" /> إضافة عمود
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={field.required} 
                          onCheckedChange={c => updateField(field.id, { required: c })} 
                        />
                        <Label className="cursor-pointer">حقل إلزامي</Label>
                      </div>
                      
                      <div className="flex-1" />
                      
                      <Button size="sm" variant="destructive" onClick={() => removeField(field.id)}>
                        <Trash2 className="h-4 w-4 me-2" /> حذف الحقل
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={loading}>
            حفظ كقالب في المكتبة
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4 me-2" />
              معاينة
            </Button>
            <Button onClick={() => handleSave(false)} disabled={loading}>
              <Save className="h-4 w-4 me-2" />
              حفظ الاستبيان
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      
      {previewOpen && (
        <SurveyViewerDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          survey={{
            id: initialSurvey?.id || "preview-id",
            project_id: projectId,
            title_ar: title || "بدون عنوان",
            title_en: null,
            description,
            is_template: false,
            fields,
            created_at: new Date().toISOString(),
            created_by: "preview-user"
          }}
          isPreview={true}
        />
      )}
    </Dialog>
  );
};
