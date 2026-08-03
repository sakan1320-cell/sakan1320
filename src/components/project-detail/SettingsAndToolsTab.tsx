import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectCalendarSettingsTab } from "@/components/ProjectCalendarSettingsTab";
import { Switch } from "@/components/ui/switch";
import { Trophy, Settings, Calendar, Award, Star, Trash2, Copy, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface SettingsAndToolsTabProps {
  projectId: string;
  onProjectUpdated: () => void;
}

export const SettingsAndToolsTab = ({ projectId, onProjectUpdated }: SettingsAndToolsTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialogNode } = useConfirm();
  const [projectRaw, setProjectRaw] = useState<any>(null);

  // Mock state for features
  const [features, setFeatures] = useState({
    enjaz: true,
    attendance: true,
    tasks: true,
    finance: true
  });

  const toggleFeature = async (key: keyof typeof features) => {
    const newValue = !features[key];
    
    if (key === "enjaz") {
      setFeatures(prev => ({ ...prev, [key]: newValue }));
      try {
        const { error } = await supabase
          .from("projects")
          .update({ enjaz_enabled: newValue })
          .eq("id", projectId);
          
        if (error) throw error;
        toast.success(isRtl ? "تم حفظ حالة نظام الإنجاز في المشروع" : "Enjaz status saved for this project");
        onProjectUpdated();
      } catch (e) {
        toast.error((e as Error).message);
        setFeatures(prev => ({ ...prev, [key]: !newValue })); // revert on error
      }
    } else {
      toast.info(isRtl ? "هذه الخاصية ستتاح قريباً" : "This feature will be available soon");
    }
  };
  
  // Card 1: Project Metadata
  const [projectForm, setProjectForm] = useState({
    name_ar: "",
    name_en: "",
    description: "",
    budget: "",
    status: "",
    category: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [projRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle()
      ]);

      if (projRes.data) {
        const p = projRes.data;
        setProjectRaw(p);
        setProjectForm({
          name_ar: p.name_ar || "",
          name_en: p.name_en || "",
          description: p.description || "",
          budget: p.budget ? p.budget.toString() : "",
          status: p.status || "planned",
          category: p.category || "",
        });
        setFeatures(prev => ({ ...prev, enjaz: p.enjaz_enabled ?? true }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Save Project General Form
  const handleSaveProject = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name_ar: projectForm.name_ar,
          name_en: projectForm.name_en || null,
          description: projectForm.description || null,
          budget: projectForm.budget ? Number(projectForm.budget) : null,
          status: projectForm.status,
          category: projectForm.category || null,
        })
        .eq("id", projectId);

      if (error) throw error;
      toast.success(isRtl ? "تم تحديث إعدادات البرنامج بنجاح" : "Project settings updated successfully");
      onProjectUpdated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Danger Zone: Duplicate
  const handleDuplicate = async () => {
    if (!projectRaw) return;
    if (!(await confirm(t("projects.duplicateConfirm", "هل تريد تكرار هذا المشروع؟")))) return;
    try {
      const { id: _id, created_at: _ca, ...rest } = projectRaw;
      const payload = { 
        ...rest, 
        name_ar: `${projectRaw.name_ar} (${t("projects.copy", "نسخة")})`, 
        name_en: projectRaw.name_en ? `${projectRaw.name_en} (Copy)` : null, 
        status: "planned" 
      };
      const { data, error } = await supabase.from("projects").insert([payload]).select("id").single();
      if (error) throw error;
      await logAudit("create", "project", data.id, { duplicated_from: projectId });
      toast.success(isRtl ? "تم تكرار المشروع بنجاح" : "Project duplicated successfully");
      navigate(`/projects/${data.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Danger Zone: Delete
  const handleDeleteProject = async () => {
    if (!(await confirm(t("projects.deleteConfirm", "هل أنت متأكد من حذف هذا المشروع نهائياً؟ لا يمكن استرجاع البيانات.")))) return;
    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      await logAudit("delete", "project", projectId);
      toast.success(isRtl ? "تم حذف المشروع بنجاح" : "Project deleted successfully");
      navigate("/projects");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) return <div className="text-center py-6">{isRtl ? "جاري تحميل الأدوات الإدارية..." : "Loading admin tools..."}</div>;

  return (
    <div className="space-y-8 font-sans" dir="rtl">
      {ConfirmDialogNode}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Card 1: General Project Settings */}
        <Card className="border shadow-md rounded-xl p-5 space-y-4">
          <CardHeader className="p-0 pb-3 border-b flex flex-row items-center gap-2 space-y-0">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{isRtl ? "إعدادات البرنامج العام للمشروع" : "General Project Settings"}</CardTitle>
              <CardDescription className="text-xs">{isRtl ? "تعديل المعلومات والبيانات الوصفية الأساسية للمشروع" : "Modify metadata and general project settings"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-4">
            <div className="space-y-2">
              <Label>{isRtl ? "اسم المشروع" : "Project Name"}</Label>
              <Input 
                value={projectForm.name_ar} 
                onChange={(e) => setProjectForm(prev => ({ ...prev, name_ar: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "الوصف التعريفي للمشروع" : "Description"}</Label>
              <Input 
                value={projectForm.description} 
                onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{isRtl ? "الميزانية المخصصة" : "Budget"}</Label>
                <Input 
                  type="number"
                  value={projectForm.budget} 
                  onChange={(e) => setProjectForm(prev => ({ ...prev, budget: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "التصنيف" : "Category"}</Label>
                <Input 
                  value={projectForm.category} 
                  onChange={(e) => setProjectForm(prev => ({ ...prev, category: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "حالة المشروع" : "Status"}</Label>
                <Select 
                  value={projectForm.status} 
                  onValueChange={(v) => setProjectForm(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">{isRtl ? "جديد" : "New"}</SelectItem>
                    <SelectItem value="stalled">{isRtl ? "التهيئة" : "Preparation"}</SelectItem>
                    <SelectItem value="in_progress">{isRtl ? "التنفيذ" : "Execution"}</SelectItem>
                    <SelectItem value="completed">{isRtl ? "منفذ" : "Executed"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSaveProject} disabled={saving} className="w-full mt-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin me-1.5" /> : null}
              {isRtl ? "حفظ التعديلات العامة" : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Workdays Calendar */}
        <Card className="border shadow-md rounded-xl p-5 space-y-4">

          <CardContent className="p-0 pt-3">
            <ProjectCalendarSettingsTab projectId={projectId} />
          </CardContent>
        </Card>

        {/* Card 3: Features (الخصائص) */}
        <Card className="border shadow-md rounded-xl p-5 space-y-4 lg:col-span-2">
          <CardHeader className="p-0 pb-3 border-b flex flex-row items-center gap-2 space-y-0">
            <CheckCircle2 className="h-5 w-5 text-indigo-500" />
            <div>
              <CardTitle className="text-base">{isRtl ? "الخصائص" : "Features"}</CardTitle>
              <CardDescription className="text-xs">{isRtl ? "قم بتفعيل أو إيقاف خصائص النظام المتاحة للمشروع" : "Enable or disable available system features for this project"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className={`cursor-pointer transition-colors border-2 ${features.enjaz ? "border-primary/50 bg-primary/5" : "border-transparent"}`} onClick={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                toggleFeature("enjaz");
              }}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${features.enjaz ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">{isRtl ? "إنجاز" : "Enjaz"}</h3>
                      <p className="text-xs text-muted-foreground">{isRtl ? "النقاط، المبادرات، والمتجر" : "Points, Initiatives, and Store"}</p>
                    </div>
                  </div>
                  <Switch checked={features.enjaz} onCheckedChange={() => toggleFeature("enjaz")} />
                </CardContent>
              </Card>

              <Card className={`relative overflow-hidden cursor-pointer transition-colors border-2 ${features.attendance ? "border-primary/50 bg-primary/5 opacity-70" : "border-transparent opacity-50"}`} onClick={() => toggleFeature("attendance")}>
                <div className="absolute top-2 end-2">
                  <span className="bg-muted-foreground/10 text-muted-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">{isRtl ? "قريباً" : "Soon"}</span>
                </div>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${features.attendance ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">{isRtl ? "نظام الحضور" : "Attendance System"}</h3>
                      <p className="text-xs text-muted-foreground">{isRtl ? "إدارة حضور المشتركات" : "Manage participants attendance"}</p>
                    </div>
                  </div>
                  <Switch checked={features.attendance} disabled />
                </CardContent>
              </Card>

              <Card className={`relative overflow-hidden cursor-pointer transition-colors border-2 ${features.tasks ? "border-primary/50 bg-primary/5 opacity-70" : "border-transparent opacity-50"}`} onClick={() => toggleFeature("tasks")}>
                <div className="absolute top-2 end-2">
                  <span className="bg-muted-foreground/10 text-muted-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">{isRtl ? "قريباً" : "Soon"}</span>
                </div>
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${features.tasks ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">{isRtl ? "المهام الإدارية" : "Admin Tasks"}</h3>
                      <p className="text-xs text-muted-foreground">{isRtl ? "مهام الفريق والخطط" : "Team tasks and plans"}</p>
                    </div>
                  </div>
                  <Switch checked={features.tasks} disabled />
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Danger Zone & Project Management (منطقة الخطر) */}
        <Card className="border border-destructive/30 shadow-md rounded-xl p-5 space-y-4 lg:col-span-2 bg-destructive/5">
          <CardHeader className="p-0 pb-3 border-b border-destructive/20 flex flex-row items-center gap-2 space-y-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-base text-destructive">{isRtl ? "إعدادات الحذف والتعديل وإدارة المشروع (منطقة الخطر)" : "Danger Zone & Project Management"}</CardTitle>
              <CardDescription className="text-xs text-destructive/80">{isRtl ? "الإجراءات الحساسة الخاصة بحذف وتكرار وهيكلة المشروع" : "Critical actions including project deletion and duplication"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-3 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[240px] space-y-2">
              <h4 className="text-sm font-semibold">{isRtl ? "تكرار المشروع" : "Duplicate Project"}</h4>
              <p className="text-xs text-muted-foreground">{isRtl ? "نسخ هيكلة وبيانات المشروع لإنشاء نسخة مطابقة تحت التخطيط" : "Copy settings and structure of this project to a new planned project"}</p>
              <Button variant="outline" size="sm" onClick={handleDuplicate} className="flex items-center gap-1.5 mt-2">
                <Copy className="h-4 w-4" />
                {isRtl ? "تكرار هذا المشروع" : "Duplicate Project"}
              </Button>
            </div>

            <div className="flex-1 min-w-[240px] space-y-2 border-t md:border-t-0 md:border-s pt-4 md:pt-0 md:ps-6">
              <h4 className="text-sm font-semibold text-destructive">{isRtl ? "حذف المشروع نهائياً" : "Delete Project Permanently"}</h4>
              <p className="text-xs text-muted-foreground">{isRtl ? "سيتم حذف المشروع وكل المجموعات والمشاركين التابعين له بشكل دائم" : "Permanently erase this project and all its associated data (participants, groups, tasks)"}</p>
              <Button variant="destructive" size="sm" onClick={handleDeleteProject} className="flex items-center gap-1.5 mt-2">
                <Trash2 className="h-4 w-4" />
                {isRtl ? "حذف المشروع نهائياً" : "Delete Project"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
