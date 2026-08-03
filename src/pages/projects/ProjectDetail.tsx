import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Building2, Calendar, Users, GraduationCap, TrendingUp, BarChart2, 
  MessageSquare, ClipboardCheck, Trophy, Settings, ChevronRight, ChevronLeft, Lightbulb,
  Wallet, Folder, ClipboardList, Clock, ShieldAlert
} from "lucide-react";
import { SystemComments } from "@/components/SystemComments";
import { ProjectTasksTab } from "@/components/ProjectTasksTab";
import { ProjectAttendanceTab } from "@/components/ProjectAttendanceTab";
import { ProjectTrainingTab } from "@/components/ProjectTrainingTab";
import { ProjectParticipantsTab } from "@/components/ProjectParticipantsTab";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Project specific custom tabs
import { PerformanceTab } from "@/components/project-detail/PerformanceTab";
import { SmartReportsTab } from "@/components/project-detail/SmartReportsTab";
import { SettingsAndToolsTab } from "@/components/project-detail/SettingsAndToolsTab";
import { BranchesAndGroupsTab } from "@/components/project-detail/BranchesAndGroupsTab";
import { AutoInsights } from "@/components/AutoInsights";

import { ProjectFinanceTab } from "@/components/ProjectFinanceTab";
import { ProjectFilesTab } from "@/components/ProjectFilesTab";
import { ProjectSurveysTab } from "@/components/ProjectSurveysTab";
import { ProjectEnjazTab } from "@/components/ProjectEnjazTab";
import { ProjectCalendarSettingsTab } from "@/components/ProjectCalendarSettingsTab";
import { ProjectPerformanceCompositeTab } from "@/components/ProjectPerformanceCompositeTab";
import { ProjectContentCompositeTab } from "@/components/ProjectContentCompositeTab";
import { ProjectSettingsCompositeTab } from "@/components/ProjectSettingsCompositeTab";

interface ProjectRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  description: string | null;
  budget: number | null;
  status: string;
  created_at: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planned: "outline", in_progress: "default", completed: "secondary", stalled: "destructive",
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [memberBranchId, setMemberBranchId] = useState<string | null>(null);
  const [memberGroupId, setMemberGroupId] = useState<string | null>(null);
  
  // Navigation states
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "performance";
  const setActiveTab = (tab: string) => {
    setSearchParams(prev => {
      prev.set("tab", tab);
      return prev;
    }, { replace: true });
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const load = async () => {
    if (!id) return;
    if (!project) setProjectLoading(true);
    const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    setProject(p as ProjectRow | null);
    setProjectLoading(false);

    if (user && p) {
      const { data: m } = await supabase
        .from("project_members")
        .select("project_role, branch_id, group_id")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
        
      if (m) {
        setMemberRole(m.project_role);
        setMemberBranchId(m.branch_id);
        setMemberGroupId(m.group_id);
      }
    }
  };

  useEffect(() => { load(); }, [id]);

  if (projectLoading) return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (!project) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{t("projects.notFound", "المشروع غير موجود")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("projects.notFoundDesc", "لم يتم العثور على هذا المشروع أو ليس لديك صلاحية الوصول إليه.")}</p>
      </div>
      <button onClick={() => navigate("/projects")} className="text-sm text-primary underline underline-offset-4">
        {t("projects.backToList", "العودة لقائمة المشاريع")}
      </button>
    </div>
  );
  const name = i18n.language === "ar" ? project.name_ar : (project.name_en || project.name_ar);

  const isManager = memberRole === "project_manager" || (isAdmin && !memberRole);
  const isBranchManager = memberRole === "branch_manager";

  const sidebarItems = [
    { id: "performance", label: i18n.language === "ar" ? "الأداء" : "Performance", icon: TrendingUp },
    { id: "participants", label: i18n.language === "ar" ? "المشاركون" : "Participants", icon: Users },
    ...(project.enjaz_enabled !== false ? [{ id: "enjaz", label: i18n.language === "ar" ? "إنجاز" : "Enjaz", icon: Trophy }] : []),
    { id: "content", label: i18n.language === "ar" ? "المحتوى" : "Content", icon: Folder },
    { id: "tasks", label: i18n.language === "ar" ? "المهام" : "Tasks", icon: ClipboardCheck },
    ...(isManager || isBranchManager ? [{ id: "reports", label: i18n.language === "ar" ? "التقارير" : "Reports", icon: BarChart2 }] : []),
    ...(isManager ? [{ id: "finance", label: i18n.language === "ar" ? "المالية" : "Finance", icon: Wallet }] : []),
    ...(isManager ? [{ id: "settings", label: i18n.language === "ar" ? "الإعدادات" : "Settings", icon: Settings }] : []),
  ];

  const headerPortal = document.getElementById("header-center-portal");

  return (
    <div className="space-y-6 mt-4 lg:mt-6">
      {/* Top Header injected into AppShell via Portal */}
      {headerPortal && createPortal(
        <div className="flex items-center gap-2 max-w-full overflow-hidden w-full px-2 lg:px-0">
          <h1 className="text-sm sm:text-base lg:text-lg font-bold truncate shrink" title={name}>{name}</h1>
          <Badge variant={statusVariant[project.status]} className="shrink-0 text-[10px] sm:text-xs hidden sm:inline-flex">{t(`projects.statuses.${project.status}`)}</Badge>
        </div>,
        headerPortal
      )}

      {/* Main Workspace: Left Sidebar (Second in DOM for RTL left-align, Content first) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start relative w-full font-sans">
        
        {/* Content Area (Left/Center in LTR, Right/Center in RTL) */}
        <div className="flex-1 w-full order-2 lg:order-1 transition-all duration-300 min-h-[500px]">
          <div className="bg-card rounded-3xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 md:p-6 w-full">
            {activeTab === "performance" && <ProjectPerformanceCompositeTab projectId={project.id} branchId={memberBranchId} groupId={memberGroupId} />}
            {activeTab === "tasks" && <ProjectTasksTab projectId={project.id} branchId={memberBranchId} groupId={memberGroupId} />}
            {activeTab === "participants" && <ProjectParticipantsTab projectId={project.id} branchId={memberBranchId} groupId={memberGroupId} isManager={isManager || isBranchManager} />}
            {activeTab === "finance" && <ProjectFinanceTab projectId={project.id} />}
            {activeTab === "content" && <ProjectContentCompositeTab projectId={project.id} branchId={memberBranchId} groupId={memberGroupId} isManager={isManager || isBranchManager} />}
            {activeTab === "enjaz" && <ProjectEnjazTab projectId={project.id} defaultTab="rewards" branchId={memberBranchId} groupId={memberGroupId} isManager={isManager || isBranchManager} />}
            {activeTab === "reports" && <SmartReportsTab projectId={project.id} branchId={memberBranchId} groupId={memberGroupId} />}
            {activeTab === "settings" && <ProjectSettingsCompositeTab projectId={project.id} onProjectUpdated={load} />}
          </div>
        </div>

        {/* App Sidebar (Island) */}
        {/* App Sidebar (Island) */}
        <TooltipProvider>
          <div 
            className={cn(
              "fixed start-0 top-[70px] bottom-4 flex items-center z-50 transition-all duration-500 ease-in-out pointer-events-none",
              sidebarCollapsed ? "-translate-x-[82px] rtl:translate-x-[82px]" : "translate-x-0"
            )}
          >
            {/* Floating Dock Container */}
            <div className="bg-background/60 border border-border/30 shadow-sm p-2 rounded-[20px] flex flex-col items-center gap-2 relative z-20 pointer-events-auto max-h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 hover:scale-110 shrink-0",
                          isActive ? "bg-primary text-primary-foreground shadow-md font-bold" : "text-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                        title={item.label}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        {isActive && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side={i18n.language === "ar" ? "right" : "left"} className="font-bold text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Toggle Collapse Tab Button */}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="bg-background/60 border border-border/30 border-s-0 shadow-sm rounded-e-2xl py-4 px-2 flex items-center justify-center hover:brightness-110 transition-all z-10 shrink-0 pointer-events-auto"
              title={sidebarCollapsed ? t("common.expand", "إظهار") : t("common.collapse", "إخفاء")}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              )}
            </button>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default ProjectDetail;
