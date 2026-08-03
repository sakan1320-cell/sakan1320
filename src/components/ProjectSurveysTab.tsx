import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectSurvey, SurveyResponse } from "@/types/surveys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Library, Pencil, Trash2, Users, CheckCircle2, BarChart2, MoreVertical, Send, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SurveyBuilderDialog } from "./SurveyBuilderDialog";
import { GlobalSurveyLibraryDialog } from "./GlobalSurveyLibraryDialog";
import { SurveyViewerDialog } from "./SurveyViewerDialog";
import { SurveyResultsDialog } from "./SurveyResultsDialog";
import { useConfirm } from "@/components/ui/confirm-dialog";

export const ProjectSurveysTab = ({ projectId }: { projectId: string }) => {
  const { user, isAdmin, roles } = useAuth();
  const [surveys, setSurveys] = useState<ProjectSurvey[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, SurveyResponse>>({});
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [builderOpen, setBuilderOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  
  const [activeSurvey, setActiveSurvey] = useState<ProjectSurvey | null>(null);
  const [activeTab, setActiveTab] = useState<string>("participants");
  const { confirm, ConfirmDialogNode } = useConfirm();

  const isTeamMember = roles?.some(r => ["system_admin", "board", "executive", "assistant", "project_manager", "branch_manager", "employee", "contractor"].includes(r)) || false;
  const isParticipant = roles?.includes("participant") || false;

  useEffect(() => {
    if (roles && roles.length > 0) {
      if (roles.includes("participant")) {
        setActiveTab("participants");
      } else {
        setActiveTab("team");
      }
    }
  }, [roles]);

  const load = async (silent = surveys.length > 0) => {
    if (!silent) setLoading(true);
    try {
      const { data: s } = await supabase
        .from("project_surveys")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_template", false)
        .order("created_at", { ascending: false });
      
      const updatedSurveys = (s as ProjectSurvey[]) || [];
      setSurveys(updatedSurveys);

      if (activeSurvey) {
        const currentActive = updatedSurveys.find(x => x.id === activeSurvey.id);
        if (currentActive) {
          setActiveSurvey(currentActive);
        }
      }

      if (user) {
        const { data: r } = await supabase
          .from("survey_responses")
          .select("*")
          .eq("user_id", user.id)
          .in("survey_id", updatedSurveys.map(x => x.id));
        
        const respMap: Record<string, SurveyResponse> = {};
        r?.forEach(res => { respMap[res.survey_id] = res as SurveyResponse; });
        setMyResponses(respMap);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId, user]);

  const handleDelete = async (id: string) => {
    if (!(await confirm("هل أنت متأكد من حذف هذا الاستبيان؟"))) return;
    const { error } = await supabase.from("project_surveys").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("تم الحذف بنجاح");
      load();
    }
  };

  const handleTogglePublish = async (survey: ProjectSurvey) => {
    const newStatus = !survey.is_published;
    const { error } = await supabase
      .from("project_surveys")
      .update({ is_published: newStatus })
      .eq("id", survey.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(newStatus ? "تم النشر بنجاح" : "تم إلغاء النشر بنجاح");
      load();
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">جاري التحميل...</div>;

  const renderSurveysList = (target: "team" | "participants") => {
    const filtered = surveys.filter(s => {
      if ((s.target_audience || "participants") !== target) return false;
      if (!isAdmin && !s.is_published) return false;
      return true;
    });

    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 py-20 text-center bg-muted/20 rounded-3xl border border-dashed">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">لا توجد استبيانات متاحة في هذا القسم حالياً.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(s => {
          const hasResponded = !!myResponses[s.id];
          return (
            <div 
              key={s.id} 
              className={`bg-card flex flex-col h-full transition-all duration-300 rounded-3xl border border-border/50 shadow-sm p-5 group ${isAdmin || !hasResponded ? 'hover:shadow-xl hover:-translate-y-1 cursor-pointer' : ''}`}
              onClick={() => {
                if (isAdmin) {
                  setActiveSurvey(s);
                  setResultsOpen(true);
                } else if (!hasResponded) {
                  setActiveSurvey(s);
                  setViewerOpen(true);
                }
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <Badge variant={s.is_published ? "default" : "secondary"}>
                        {s.is_published ? "منشور" : "مسودة"}
                      </Badge>
                    )}
                    {!isAdmin && hasResponded && (
                      <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                        <CheckCircle2 className="h-3 w-3 me-1" /> مكتمل
                      </Badge>
                    )}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -me-2 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setActiveSurvey(s); setBuilderOpen(true); }}>
                            <Pencil className="h-4 w-4 me-2" />
                            تعديل الاستبيان
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTogglePublish(s)}>
                            {s.is_published ? (
                              <>
                                <EyeOff className="h-4 w-4 me-2" />
                                إلغاء النشر
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 me-2" />
                                نشر الآن
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4 me-2" />
                            حذف الاستبيان
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors">{s.title_ar}</h3>
                  {s.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{s.description}</p>}
                </div>
              
              {!isAdmin && hasResponded && (
                <div className="mt-auto pt-6 border-t border-border/50 flex gap-2">
                  <Button className="w-full rounded-xl font-bold" variant="secondary" disabled>تم الإرسال</Button>
                </div>
              )}
              {!isAdmin && !hasResponded && (
                <div className="mt-auto pt-6 border-t border-border/50 flex gap-2">
                  <Button className="w-full rounded-xl font-bold" variant="default" onClick={(e) => { e.stopPropagation(); setActiveSurvey(s); setViewerOpen(true); }}>بدء الاستبيان</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {ConfirmDialogNode}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-3xl border border-border/50 shadow-sm">
        <h2 className="text-xl font-black bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">الاستبيانات</h2>
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setLibraryOpen(true)} className="rounded-xl font-bold">
              <Library className="h-4 w-4 me-2" />
              مكتبة القوالب
            </Button>
            <Button onClick={() => { setActiveSurvey(null); setBuilderOpen(true); }} className="rounded-xl font-bold shadow-sm">
              <Plus className="h-4 w-4 me-2" />
              استبيان جديد
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isAdmin && (
          <TabsList className="bg-muted p-1 rounded-lg">
            <TabsTrigger value="participants">استبيانات المشاركين</TabsTrigger>
            <TabsTrigger value="team">استبيانات فريق العمل</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="participants" className="space-y-4">
          {renderSurveysList("participants")}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {renderSurveysList("team")}
        </TabsContent>
      </Tabs>

      {builderOpen && (
        <SurveyBuilderDialog 
          open={builderOpen} 
          onOpenChange={setBuilderOpen} 
          projectId={projectId}
          initialSurvey={activeSurvey}
          onSaved={load} 
        />
      )}

      {libraryOpen && (
        <GlobalSurveyLibraryDialog 
          open={libraryOpen} 
          onOpenChange={setLibraryOpen}
          projectId={projectId}
          onImported={load}
        />
      )}

      {viewerOpen && activeSurvey && (
        <SurveyViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          survey={activeSurvey}
          onSubmitted={load}
        />
      )}

      {resultsOpen && activeSurvey && (
        <SurveyResultsDialog
          open={resultsOpen}
          onOpenChange={setResultsOpen}
          survey={activeSurvey}
          onEdit={() => {
            setResultsOpen(false);
            setBuilderOpen(true);
          }}
          onStatusChanged={load}
        />
      )}
    </div>
  );
};
