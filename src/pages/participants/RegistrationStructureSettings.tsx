import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InfoPopover } from "@/components/ui/info-popover";
import { ParticipantFormDialog } from "@/components/ParticipantFormDialog";
import { Loader2, Plus, ChevronDown, ChevronUp, Trash2, GripVertical, Eye, Type, Hash, Calendar, List, ToggleLeft } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableFieldCard } from "@/components/SortableFieldCard";

export interface FormField {
  id: string;
  name_ar: string;
  field_type: string;
  is_required: boolean;
  min_length: number | null;
  max_length: number | null;
  regex_pattern: string | null;
  options_array: any | null;
  order_index: number;
  system_key: string | null;
  is_active: boolean;
  tab_section: string;
}

const FIELD_TYPES = [
  { value: "text", label: "نص (Text)", icon: Type },
  { value: "number", label: "رقم (Number)", icon: Hash },
  { value: "date", label: "تاريخ (Date)", icon: Calendar },
  { value: "select", label: "قائمة (Dropdown)", icon: List },
  { value: "boolean", label: "تفعيل (نعم/لا)", icon: ToggleLeft },
];

const RegistrationStructureSettings = () => {
  const { t, i18n } = useTranslation();
  const { hasPermission, isSystemAdmin } = useAuth();
  const fallbackRoute = useFallbackRoute();
  const isRtl = i18n.language === "ar";
  
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { confirm, ConfirmDialogNode } = useConfirm();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [busy, setBusy] = useState(false);
  
  // Form State
  const [nameAr, setNameAr] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [minLength, setMinLength] = useState("");
  const [maxLength, setMaxLength] = useState("");
  const [regexPattern, setRegexPattern] = useState("");
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [tabSection, setTabSection] = useState("info");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fieldTypeLabels: Record<string, string> = {
    text: isRtl ? "نص" : "Text",
    number: isRtl ? "رقم" : "Number",
    date: isRtl ? "تاريخ" : "Date",
    select: isRtl ? "قائمة خيارات" : "Select",
    boolean: isRtl ? "تفعيل" : "Boolean",
  };

  const loadFields = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("registration_form_fields")
      .select("*")
      .order("order_index", { ascending: true });
      
    if (error) toast.error(error.message);
    else setFields(data as any);
    setLoading(false);
  };

  useEffect(() => { loadFields(); }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);
    
    const newFields = arrayMove(fields, oldIndex, newIndex);
    setFields(newFields); // Optimistic UI update

    // Auto-save to Supabase
    const updates = newFields.map((f, index) => ({
      id: f.id,
      order_index: index,
    }));
    
    // Perform individual updates since bulk upsert might complain about missing fields
    let hasError = false;
    for (const update of updates) {
      const { error } = await supabase.from("registration_form_fields").update({ order_index: update.order_index }).eq("id", update.id);
      if (error) hasError = true;
    }

    if (hasError) {
      toast.error(isRtl ? "فشل حفظ الترتيب" : "Failed to save order");
      loadFields(); // Rollback
    } else {
      toast.success(isRtl ? "تم حفظ الترتيب الجديد" : "Order saved");
    }
  };

  if (!isSystemAdmin && !hasPermission("manage_settings")) {
    return <Navigate to={fallbackRoute} replace />;
  }

  const handleOpenDialog = (field?: FormField, defaultType?: string) => {
    if (field) {
      setEditingField(field);
      setNameAr(field.name_ar);
      setFieldType(field.field_type);
      setIsRequired(field.is_required);
      setMinLength(field.min_length ? field.min_length.toString() : "");
      setMaxLength(field.max_length ? field.max_length.toString() : "");
      setRegexPattern(field.regex_pattern || "");
      
      if (field.system_key === 'gender') setOptionsList(["ذكر", "أنثى"]);
      else if (field.system_key === 'guardian_relation') setOptionsList(["أب", "أم", "ولي أمر", "أخرى"]);
      else if (field.system_key === 'project_id') setOptionsList(["(قائمة المشاريع)"]);
      else setOptionsList(field.options_array ? (field.options_array as string[]) : []);
      
      setNewOption("");
      setAdvancedOpen(!!(field.min_length || field.max_length || field.regex_pattern));
      setIsActive(field.is_active ?? true);
      setTabSection(field.tab_section || "info");
    } else {
      setEditingField(null);
      setNameAr("");
      setFieldType(defaultType || "text");
      setIsRequired(false);
      setMinLength("");
      setMaxLength("");
      setRegexPattern("");
      setOptionsList([]);
      setNewOption("");
      setAdvancedOpen(false);
      setIsActive(true);
      setTabSection("info");
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nameAr.trim()) return toast.error(isRtl ? "اسم الحقل مطلوب" : "Name is required");
    
    setBusy(true);
    const payload = {
      name_ar: nameAr,
      field_type: fieldType,
      is_required: isRequired,
      min_length: minLength ? parseInt(minLength) : null,
      max_length: maxLength ? parseInt(maxLength) : null,
      regex_pattern: regexPattern || null,
      options_array: fieldType === "select" && !editingField?.system_key ? optionsList : null,
      is_active: isActive,
      tab_section: tabSection,
    };

    if (editingField) {
      const { error } = await supabase.from("registration_form_fields").update(payload as any).eq("id", editingField.id);
      if (error) toast.error(error.message);
      else { toast.success(isRtl ? "تم التحديث بنجاح" : "Updated successfully"); setIsDialogOpen(false); loadFields(); }
    } else {
      const { error } = await supabase.from("registration_form_fields").insert([{ ...payload, order_index: fields.length } as any]);
      if (error) toast.error(error.message);
      else { toast.success(isRtl ? "تمت الإضافة بنجاح" : "Added successfully"); setIsDialogOpen(false); loadFields(); }
    }
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm(isRtl ? "هل أنت متأكد من الحذف؟" : "Are you sure?"))) return;
    setBusy(true);
    const { error } = await supabase.from("registration_form_fields").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(isRtl ? "تم الحذف" : "Deleted"); setIsDialogOpen(false); loadFields(); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {ConfirmDialogNode}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{isRtl ? "إعدادات هيكلة بيانات التسجيل" : "Registration Form Structure"}</h1>
          <p className="text-muted-foreground">{isRtl ? "تحكم ديناميكياً بالحقول المتاحة، أضف حقولاً جديدة، ورتبها بالسحب والإفلات." : "Dynamically manage registration fields, add new ones, and drag-and-drop to reorder."}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <Button variant="outline" onClick={() => setIsPreviewOpen(true)} className="w-full sm:w-auto rounded-xl gap-2 text-primary border-primary/50 hover:bg-primary/5">
            <Eye className="h-4 w-4" /> {isRtl ? "معاينة النموذج" : "Preview Form"}
          </Button>
          
          <Button onClick={() => handleOpenDialog(undefined, "text")} className="w-full sm:w-auto rounded-xl gap-2">
            <Plus className="h-4 w-4" /> {isRtl ? "إضافة حقل جديد" : "Add New Field"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="rounded-2xl border-none shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-xl flex items-center justify-between">
              {isRtl ? "الحقول الحالية (Form Builder)" : "Current Fields"}
              <Badge variant="outline" className="bg-background">{fields.length} {isRtl ? "حقول" : "Fields"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {fields.length === 0 ? (
              <div className="p-16 text-center border-2 border-dashed rounded-xl border-muted-foreground/20 text-muted-foreground bg-muted/10">
                {isRtl ? "لا توجد حقول. استخدم القائمة العلوية لإضافة حقلك الأول." : "No fields found. Use the dropdown above to add one."}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {fields.map((field) => (
                      <SortableFieldCard
                        key={field.id}
                        id={field.id}
                        name={field.name_ar}
                        type={field.field_type}
                        isRequired={field.is_required}
                        onEdit={() => handleOpenDialog(field)}
                        onDelete={() => handleDelete(field.id)}
                        canDelete={!field.system_key}
                        isRtl={isRtl}
                        fieldTypeLabels={fieldTypeLabels}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}

      {/* Editing Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingField ? (isRtl ? "تعديل الحقل" : "Edit Field") : (isRtl ? "إضافة حقل جديد" : "Add New Field")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 py-4 max-h-[70vh] overflow-y-auto px-2">
            <div className="space-y-2">
              <Label>{isRtl ? "اسم الحقل" : "Field Name"} <span className="text-destructive">*</span></Label>
              <Input placeholder={isRtl ? "مثال: التخصص، رقم الهوية" : "e.g., Major, ID Number"} value={nameAr} onChange={e => setNameAr(e.target.value)} className="rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isRtl ? "نوع الحقل" : "Field Type"}</Label>
                <Select value={fieldType} onValueChange={setFieldType} disabled={!!editingField?.system_key}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "القسم" : "Tab Section"}</Label>
                <Select value={tabSection} onValueChange={setTabSection}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">{isRtl ? "معلومات المشترك" : "Participant Info"}</SelectItem>
                    <SelectItem value="guardian">{isRtl ? "ولي الأمر" : "Guardian"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {fieldType === "select" && (
              <div className="space-y-4 border rounded-xl p-4 bg-muted/5">
                <Label>{isRtl ? "خيارات القائمة" : "Dropdown Options"}</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder={isRtl ? "أضف خياراً جديداً..." : "Add option..."} 
                    value={newOption} 
                    onChange={e => setNewOption(e.target.value)} 
                    disabled={!!editingField?.system_key}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!editingField?.system_key && newOption.trim() && !optionsList.includes(newOption.trim())) {
                          setOptionsList([...optionsList, newOption.trim()]);
                          setNewOption("");
                        }
                      }
                    }}
                    className="rounded-lg bg-background" 
                  />
                  <Button 
                    type="button" variant="secondary" className="rounded-lg shrink-0" disabled={!!editingField?.system_key}
                    onClick={() => {
                      if (!editingField?.system_key && newOption.trim() && !optionsList.includes(newOption.trim())) {
                        setOptionsList([...optionsList, newOption.trim()]);
                        setNewOption("");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 rtl:ml-1 ltr:mr-1" /> {isRtl ? "إضافة" : "Add"}
                  </Button>
                </div>
                
                {optionsList.length > 0 && (
                  <div className="space-y-2">
                    {optionsList.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-background">
                        <span className="text-sm">{opt}</span>
                        {!editingField?.system_key && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setOptionsList(optionsList.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
              <Label className="cursor-pointer">{isRtl ? "حقل إلزامي (Required)" : "Required Field"}</Label>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} disabled={['full_name', 'national_id', 'phone'].includes(editingField?.system_key || '')} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
              <Label className="cursor-pointer">{isRtl ? "إظهار الحقل (Active)" : "Field is Active"}</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="border rounded-xl overflow-hidden bg-card">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-bold">{isRtl ? "الإعدادات المتقدمة" : "Advanced Settings"}</span>
                  {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 space-y-4 border-t bg-muted/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isRtl ? "الحد الأدنى للطول" : "Min Length"}</Label>
                      <Input type="number" value={minLength} onChange={e => setMinLength(e.target.value)} disabled={!!editingField?.system_key} className="rounded-lg bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRtl ? "الحد الأقصى للطول" : "Max Length"}</Label>
                      <Input type="number" value={maxLength} onChange={e => setMaxLength(e.target.value)} disabled={!!editingField?.system_key} className="rounded-lg bg-background" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? "نمط التحقق (Regex)" : "Regex Pattern"}</Label>
                    <Input placeholder="^[0-9]{10}$" value={regexPattern} onChange={e => setRegexPattern(e.target.value)} disabled={!!editingField?.system_key} className="rounded-lg font-mono text-left bg-background" dir="ltr" />
                  </div>
              </CollapsibleContent>
            </Collapsible>

            {editingField && !editingField.system_key && (
              <div className="pt-4 mt-4 border-t flex justify-end">
                <Button variant="ghost" className="text-destructive hover:bg-destructive hover:text-white transition-colors gap-2" onClick={() => handleDelete(editingField.id)}>
                  <Trash2 className="h-4 w-4" /> {isRtl ? "حذف الحقل" : "Delete Field"}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full sm:w-auto">{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} disabled={busy} className="rounded-xl w-full sm:w-auto gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "حفظ الحقل" : "Save Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParticipantFormDialog 
        open={isPreviewOpen} 
        onOpenChange={setIsPreviewOpen} 
        onSaved={() => {}} 
        previewMode={true} 
      />
    </div>
  );
};

export default RegistrationStructureSettings;
