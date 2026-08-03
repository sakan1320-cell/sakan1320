import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Lock, CheckCircle2, Download, Upload, Link as LinkIcon, FileText, Settings, LayoutTemplate, FileBox, Globe, Video, PlaySquare } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableCourseItemCard } from "@/components/SortableCourseItemCard";

interface DynamicField {
  id: string;
  type: "text" | "link" | "file_download" | "assignment_upload" | "media_view";
  title: string;
  content?: string;
  is_required: boolean;
}

interface ProjectTrainingTabProps {
  projectId: string;
}

const getMediaType = (url?: string) => {
  if (!url) return 'unknown';
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'unknown';
};

export function ProjectTrainingTab({ projectId }: ProjectTrainingTabProps) {
  const { t, i18n } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const isRtl = i18n.language === "ar";
  
  const canManage = hasAnyRole(["system_admin", "executive", "assistant", "project_manager"]);
  const isParticipant = !hasAnyRole(["system_admin", "executive", "assistant", "project_manager", "staff"]); // simplified

  const [trainings, setTrainings] = useState<any[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<any[]>([]);
  const [openImport, setOpenImport] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [openCreate, setOpenCreate] = useState(false);
  const [newPathTitle, setNewPathTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit State
  const [openEdit, setOpenEdit] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any>(null);
  const [selectedNewType, setSelectedNewType] = useState<DynamicField["type"]>("text");

  // Participant state
  const [userProgress, setUserProgress] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadData = async () => {
    setLoading(true);
    const { data: trs } = await supabase.from("project_trainings").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setTrainings(trs || []);

    if (canManage) {
      const { data: lib } = await supabase.from("training_library").select("*").eq("is_published", true);
      setLibraryTemplates(lib || []);
    }

    if (isParticipant && trs && trs.length > 0) {
      // Get progress for the first training (assuming 1 active for demo)
      const trId = trs[0].id;
      const { data: prog } = await supabase.from("user_training_progress").select("*").eq("project_training_id", trId).eq("user_id", user?.id || "").maybeSingle();
      if (!prog) {
        const { data: newProg } = await supabase.from("user_training_progress").insert([{ project_training_id: trId, user_id: user?.id || "", item_progress_jsonb: {} }]).select().single();
        setUserProgress(newProg);
      } else {
        setUserProgress(prog);
      }
    }

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [projectId, user?.id]);

  const handleImport = async () => {
    if (!selectedTemplate) return toast.error(isRtl ? "يرجى اختيار قالب" : "Select a template");
    const template = libraryTemplates.find(t => t.id === selectedTemplate);
    if (!template) return;

    const payload = {
      project_id: projectId,
      library_id: template.id,
      title: template.title_ar,
      description: template.description,
      structure_jsonb: template.structure_jsonb,
      target_groups: [], // Global by default
    };

    const { error } = await supabase.from("project_trainings").insert([payload]);
    if (error) toast.error(error.message);
    else {
      toast.success(isRtl ? "تم استيراد الدورة بنجاح" : "Course imported successfully");
      setOpenImport(false);
      loadData();
    }
  };

  const handleCreateNewPath = async () => {
    if (!newPathTitle.trim()) return toast.error(isRtl ? "يرجى كتابة عنوان المسار" : "Please enter a title");
    
    const payload = {
      project_id: projectId,
      title: newPathTitle,
      description: "",
      structure_jsonb: [],
      target_groups: [],
    };

    const { error } = await supabase.from("project_trainings").insert([payload]);
    if (error) toast.error(error.message);
    else {
      toast.success(isRtl ? "تم إنشاء المسار بنجاح (كمسودة)" : "Path created successfully (Draft)");
      setOpenCreate(false);
      setNewPathTitle("");
      loadData();
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from("project_trainings").update({ is_published: !currentStatus }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(isRtl ? "تم تغيير حالة النشر بنجاح" : "Publish status updated");
      loadData();
    }
  };

  const handleCompleteItem = async (trainingId: string, itemId: string, isRequired: boolean) => {
    if (!userProgress) return;
    const progressJson = { ...userProgress.item_progress_jsonb };
    progressJson[itemId] = { status: "passed", completed_at: new Date().toISOString() };
    
    const { error } = await supabase.from("user_training_progress").update({ item_progress_jsonb: progressJson }).eq("id", userProgress.id);
    if (error) toast.error(error.message);
    else {
      toast.success(isRtl ? "تم إنجاز العنصر" : "Item completed");
      loadData();
    }
  };

  // Edit Methods
  const openEditDialog = (tr: any) => {
    setEditingTraining({ ...tr, structure_jsonb: tr.structure_jsonb || [] });
    setOpenEdit(true);
  };

  const addField = (type: DynamicField["type"]) => {
    const newField: DynamicField = {
      id: crypto.randomUUID(),
      type,
      title: isRtl ? "عنصر جديد" : "New Item",
      is_required: true,
      content: ""
    };
    setEditingTraining((prev: any) => ({ ...prev, structure_jsonb: [...prev.structure_jsonb, newField] }));
  };

  const removeField = (id: string) => {
    setEditingTraining((prev: any) => ({ ...prev, structure_jsonb: prev.structure_jsonb.filter((f: any) => f.id !== id) }));
  };

  const updateField = (id: string, updates: Partial<DynamicField>) => {
    setEditingTraining((prev: any) => ({
      ...prev,
      structure_jsonb: prev.structure_jsonb.map((f: any) => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setEditingTraining((prev: any) => {
      const items = prev.structure_jsonb;
      const oldIndex = items.findIndex((f: any) => f.id === active.id);
      const newIndex = items.findIndex((f: any) => f.id === over.id);
      return { ...prev, structure_jsonb: arrayMove(items, oldIndex, newIndex) };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTraining) return;
    const { error } = await supabase.from("project_trainings").update({
      structure_jsonb: editingTraining.structure_jsonb,
    }).eq("id", editingTraining.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRtl ? "تم حفظ مسار الدورة بنجاح" : "Course path saved successfully");
      setOpenEdit(false);
      loadData();
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{isRtl ? "مكتبة الدورات والمسارات التدريبية" : "Training Library & Paths"}</h2>
          <p className="text-muted-foreground">{isRtl ? "تابع دوراتك ومهامك التدريبية بشكل متسلسل" : "Follow your sequential training path"}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setOpenImport(true)}>
              <Download className="h-4 w-4" /> {isRtl ? "استيراد من المكتبة" : "Import"}
            </Button>
            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> {isRtl ? "إنشاء مسار جديد" : "Create New Path"}
            </Button>
          </div>
        )}
      </div>

      {trainings.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <BookOpen className="mb-4 h-12 w-12 opacity-20" />
            <p>{isRtl ? "لم يتم تخصيص أي مسارات تدريبية في هذا المشروع بعد." : "No training paths customized for this project yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {trainings.map(tr => {
            const structure = tr.structure_jsonb || [];
            let isLocked = false;

            return (
              <Card key={tr.id} className="border-border/50 shadow-sm overflow-hidden group">
                <CardHeader className="bg-primary/5 pb-4">
                  <CardTitle className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <LayoutTemplate className="h-5 w-5 text-primary" />
                      {tr.title}
                    </span>
                    <div className="flex items-center gap-3">
                      {!tr.is_published && canManage && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                          {isRtl ? "مسودة (غير منشور)" : "Draft (Unpublished)"}
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-background">{structure.length} {isRtl ? "عناصر" : "Items"}</Badge>
                      {canManage && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleTogglePublish(tr.id, tr.is_published)} className="h-8 px-2 text-muted-foreground hover:text-primary gap-1">
                            {tr.is_published ? <Lock className="h-4 w-4"/> : <Globe className="h-4 w-4"/>}
                            <span className="hidden sm:inline">{tr.is_published ? (isRtl ? "إلغاء النشر" : "Unpublish") : (isRtl ? "نشر للمستفيدين" : "Publish")}</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(tr)} className="h-8 px-2 text-muted-foreground hover:text-primary gap-1">
                            <Settings className="h-4 w-4" />
                            <span className="hidden sm:inline">{isRtl ? "تعديل المسار" : "Edit Path"}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {structure.map((item: any, idx: number) => {
                      const progress = userProgress?.item_progress_jsonb?.[item.id];
                      const isPassed = progress?.status === "passed";
                      
                      const showLock = isLocked;
                      if (item.is_required && !isPassed && !showLock) {
                        isLocked = true; // Lock all SUBSEQUENT items
                      }

                      return (
                        <div key={item.id || idx} className={`relative p-5 border rounded-xl shadow-sm transition-all duration-500 ${showLock ? "bg-muted/30 border-muted opacity-60" : isPassed ? "bg-green-50/50 border-green-200" : "bg-card border-primary/20 hover:border-primary"}`}>
                          {/* Sequential Badge */}
                          <div className={`absolute -top-3 -start-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm transition-colors ${showLock ? "bg-muted-foreground" : isPassed ? "bg-green-600" : "bg-primary"}`}>
                            {idx + 1}
                          </div>
                          
                          {/* Lock Icon Overlay */}
                          {showLock && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl rounded-ss-none">
                              <Lock className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex items-start gap-3 mb-4">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${isPassed ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
                              {item.type === "text" && <FileText className="h-5 w-5" />}
                              {item.type === "link" && <LinkIcon className="h-5 w-5" />}
                              {item.type === "file_download" && <Download className="h-5 w-5" />}
                              {item.type === "assignment_upload" && <Upload className="h-5 w-5" />}
                              {item.type === "media_view" && getMediaType(item.content) === 'video' && <Video className="h-5 w-5" />}
                              {item.type === "media_view" && getMediaType(item.content) !== 'video' && <PlaySquare className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm truncate">{item.title}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.is_required ? (isRtl ? "إجباري للعبور" : "Required to proceed") : (isRtl ? "اختياري" : "Optional")}</p>
                            </div>
                          </div>

                          {isPassed ? (
                            <div className="flex flex-col gap-2">
                              {item.type === "media_view" && item.content && (
                                <div className="w-full rounded-lg overflow-hidden border bg-black/5">
                                  {getMediaType(item.content) === 'video' && <video src={item.content} controls controlsList="nodownload" className="w-full aspect-video object-cover bg-black" onContextMenu={(e) => e.preventDefault()} />}
                                  {getMediaType(item.content) === 'image' && <img src={item.content} alt={item.title} className="w-full object-contain max-h-96 pointer-events-none" onContextMenu={(e) => e.preventDefault()} />}
                                  {getMediaType(item.content) === 'pdf' && <iframe src={`${item.content}#toolbar=0`} className="w-full h-96" />}
                                </div>
                              )}
                              <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-sm h-10 bg-green-100 rounded-md">
                                <CheckCircle2 className="h-4 w-4" /> {isRtl ? "تم الإنجاز" : "Passed"}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 w-full">
                              {item.type === "media_view" && !showLock && isParticipant && item.content && (
                                <div className="w-full rounded-lg overflow-hidden border bg-black/5 mb-2">
                                  {getMediaType(item.content) === 'video' && <video src={item.content} controls controlsList="nodownload" className="w-full aspect-video object-cover bg-black" onContextMenu={(e) => e.preventDefault()} />}
                                  {getMediaType(item.content) === 'image' && <img src={item.content} alt={item.title} className="w-full object-contain max-h-96 pointer-events-none" onContextMenu={(e) => e.preventDefault()} />}
                                  {getMediaType(item.content) === 'pdf' && <iframe src={`${item.content}#toolbar=0`} className="w-full h-96" />}
                                </div>
                              )}
                              <Button 
                                variant={item.type === "assignment_upload" ? "default" : "outline"} 
                                className="w-full h-10 gap-2"
                                disabled={showLock || !isParticipant}
                                onClick={() => {
                                  if (item.type === "link" || item.type === "file_download") window.open(item.content, "_blank");
                                  handleCompleteItem(tr.id, item.id, item.is_required);
                                }}
                              >
                                {item.type === "text" && (isRtl ? "قراءة المحتوى" : "Read Content")}
                                {item.type === "link" && (isRtl ? "فتح الرابط" : "Open Link")}
                                {item.type === "file_download" && (isRtl ? "تحميل الملف" : "Download File")}
                                {item.type === "assignment_upload" && (isRtl ? "رفع المهمة" : "Upload Assignment")}
                                {item.type === "media_view" && (isRtl ? "إكمال العرض" : "Finish Viewing")}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create New Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRtl ? "إنشاء مسار تدريبي جديد" : "Create New Training Path"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRtl ? "عنوان المسار" : "Path Title"}</Label>
              <Input value={newPathTitle} onChange={e => setNewPathTitle(e.target.value)} placeholder={isRtl ? "مثال: المسار التعريفي للمشروع..." : "e.g., Project Onboarding..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleCreateNewPath} className="gap-2"><Plus className="h-4 w-4" /> {isRtl ? "إنشاء وبدء البناء" : "Create & Start Building"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={openImport} onOpenChange={setOpenImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRtl ? "استيراد دورة من المكتبة المركزية" : "Import from Central Library"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRtl ? "اختر القالب المهيكل مسبقاً" : "Select Pre-structured Template"}</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={isRtl ? "اختر قالب..." : "Select template..."} />
                </SelectTrigger>
                <SelectContent>
                  {libraryTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title_ar}</SelectItem>
                  ))}
                  {libraryTemplates.length === 0 && <SelectItem value="none" disabled>{isRtl ? "لا توجد قوالب" : "No templates"}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenImport(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleImport} className="gap-2"><Download className="h-4 w-4" /> {isRtl ? "استيراد وحقن الدورة" : "Import & Inject Course"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Structure Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {isRtl ? "تعديل محتوى ومسار الدورة" : "Edit Course Path & Content"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <Label className="text-lg font-bold text-primary">{isRtl ? "المنشئ الديناميكي للمسار" : "Dynamic Path Builder"}</Label>
              
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
              {(!editingTraining?.structure_jsonb || editingTraining.structure_jsonb.length === 0) ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-card text-muted-foreground bg-muted/10">
                  {isRtl ? "قم بإضافة عناصر لبناء مسار الدورة من القائمة العلوية" : "Add items to build the course path from the menu above"}
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={(editingTraining.structure_jsonb || []).map((f: any) => f.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 relative pt-2">
                      {(editingTraining.structure_jsonb || []).map((field: any, index: number) => (
                        <SortableCourseItemCard
                          key={field.id || `field-${index}`}
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
          <DialogFooter className="p-6 pt-4 border-t bg-card">
            <Button variant="outline" onClick={() => setOpenEdit(false)} className="rounded-xl w-full sm:w-auto">{isRtl ? "إلغاء التعديلات" : "Cancel Changes"}</Button>
            <Button onClick={handleSaveEdit} className="gap-2 rounded-xl w-full sm:w-auto">
              <CheckCircle2 className="h-4 w-4" /> {isRtl ? "حفظ التعديلات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
