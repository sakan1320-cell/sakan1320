import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase as sb } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import {
  KanbanSquare, TableProperties, CalendarDays, BarChart4, Bot,
  Clock, Plus, Filter, Search, ChevronRight, Layers, FileDown,
  User, CheckSquare, Calendar, ChevronLeft, Briefcase, Eye, Settings,
  PieChartIcon, CheckCircle2, AlertCircle, Activity, MoreHorizontal, ChevronDown, FilePlus, X,
  Copy, MoveRight, ArrowRightLeft, Archive
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const supabase = sb as any;

export const TaskWorkflowDashboard = ({ projectId }: { projectId?: string } = {}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { user, isAdmin } = useAuth();

  // Scope: current user's membership info across all projects
  const [myMemberships, setMyMemberships] = useState<{ project_id: string; project_role: string; branch_id: string | null; group_id: string | null }[]>([]);
  const [scopeLoaded, setScopeLoaded] = useState(false);

  // Data states
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjId, setSelectedProjId] = useState<string>(projectId || "");
  const [stages, setStages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [watchedStages, setWatchedStages] = useState<string[]>([]);
  const [moveCardsStageId, setMoveCardsStageId] = useState<string | null>(null);
  const [targetStageIdForMove, setTargetStageIdForMove] = useState<string>("");
  
  // Filter/UI States
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [activeTab, setActiveTab] = useState("kanban");
  
  // Selected task detail state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  // Create / Edit modal states
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskStage, setNewTaskStage] = useState("");
  
  const [isNewStageOpen, setIsNewStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageWip, setNewStageWip] = useState(0);

  // New Automation states
  const [isNewAutoOpen, setIsNewAutoOpen] = useState(false);
  const [autoName, setAutoName] = useState("");
  const [autoTrigger, setAutoTrigger] = useState("task_completed");
  const [autoPoints, setAutoPoints] = useState(10);
  const [quickTableTaskTitle, setQuickTableTaskTitle] = useState("");
  const [quickStageInput, setQuickStageInput] = useState<Record<string, string>>({});

  const handleUpdateTaskStage = async (taskId: string, newStageId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, workflow_stage_id: newStageId } : t));
    const { error } = await supabase.from("tasks").update({ workflow_stage_id: newStageId }).eq("id", taskId);
    if (error) {
      toast.error(error.message);
      loadDashboardData();
    } else {
      toast.success("تم تحديث المرحلة بنجاح!");
    }
  };

  const handleUpdateTaskPriority = async (taskId: string, newPriority: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
    const { error } = await supabase.from("tasks").update({ priority: newPriority }).eq("id", taskId);
    if (error) {
      toast.error(error.message);
      loadDashboardData();
    } else {
      toast.success("تم تحديث الأولوية بنجاح!");
    }
  };

  const handleInlineQuickAdd = async (title: string, stageId?: string) => {
    if (!title.trim() || !selectedProjId) return;
    const targetStage = stageId || (stages.length > 0 ? stages[0].id : null);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      project_id: selectedProjId,
      workflow_stage_id: targetStage,
      status: "new",
      priority: "medium",
      position: 1000
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("تم إدراج المهمة بنجاح!");
      loadDashboardData();
    }
  };


  // Fetch initial info
  const loadProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("name_ar");
    const allProjects = data ?? [];

    // Show all projects to admins; others see only their own or managed projects
    const myProjectIds = myMemberships.map(m => m.project_id);
    const visible = isAdmin
      ? allProjects
      : allProjects.filter(p => p.manager_id === user?.id || myProjectIds.includes(p.id));

    const allOption = { id: "ALL", name_ar: "مهامي", name_en: "My Tasks" };
    setProjects([allOption, ...visible]);
    
    if (projectId) {
      setSelectedProjId(projectId);
    } else {
      setSelectedProjId("ALL");
    }
  };

  const loadProjectMembers = async (projId: string) => {
    if (!projId) return;
    const membership = myMemberships.find(m => m.project_id === projId);
    const isManager = !membership || membership.project_role === "project_manager";
    const isBranchManager = membership?.project_role === "branch_manager";

    // Fetch project members joined with their profiles
    let q = supabase
      .from("project_members")
      .select("user_id, project_role, branch_id, group_id, profiles(id, full_name)")
      .eq("project_id", projId);

    // Scope to branch if branch manager
    if (isBranchManager && membership?.branch_id) {
      q = q.eq("branch_id", membership.branch_id);
    } else if (!isManager && !isBranchManager && membership?.group_id) {
      // Teachers only see members of their group
      q = q.eq("group_id", membership.group_id);
    }

    const { data } = await q;
    const mapped = (data || []).map((m: any) => ({
      id: m.profiles?.id || m.user_id,
      full_name: m.profiles?.full_name || "-",
    }));
    setUsers(mapped);
  };

  // Load current user's memberships first, then scope projects
  useEffect(() => {
    const loadScope = async () => {
      if (!user) { setScopeLoaded(true); return; }
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id, project_role, branch_id, group_id")
        .eq("user_id", user.id);
      setMyMemberships(memberships || []);
      setScopeLoaded(true);
    };
    loadScope();
  }, [user]);

  useEffect(() => {
    if (!scopeLoaded) return;
    loadProjects();
  }, [scopeLoaded]);

  const loadDashboardData = async () => {
    if (!selectedProjId) return;
    // Reload project members when project changes
    loadProjectMembers(selectedProjId);
    setLoading(true);
    try {
      // 1. Fetch Stages
      let stgQuery = supabase.from("workflow_stages").select("*").order("sort_order");
      if (selectedProjId !== "ALL") {
        stgQuery = stgQuery.eq("project_id", selectedProjId);
      } else {
        // We will build stages dynamically from tasks later for ALL view
        stgQuery = stgQuery.limit(0); 
      }
      let { data: rawStg } = await stgQuery;
      let stg = rawStg || [];

      if (selectedProjId !== "ALL" && stg.length === 0) {
        // If no stages exist yet, create default stages
        const defaults = [
          { project_id: selectedProjId, name_ar: "جديد", name_en: "New", color: "#64748B", sort_order: 1, wip_limit: 10 },
          { project_id: selectedProjId, name_ar: "قيد التنفيذ", name_en: "In Progress", color: "#0EA5E9", sort_order: 2, wip_limit: 5 },
          { project_id: selectedProjId, name_ar: "تحت المراجعة", name_en: "Under Review", color: "#F59E0B", sort_order: 3, wip_limit: 3 },
          { project_id: selectedProjId, name_ar: "مكتمل", name_en: "Completed", color: "#10B981", sort_order: 4, wip_limit: 0 }
        ];
        const { data: created } = await supabase.from("workflow_stages").insert(defaults).select();
        stg = created || [];
      }
      if (selectedProjId !== "ALL") {
        setStages(stg);
      }

      // 2. Fetch Tasks - scoped to the user's role
      let tasksQuery = supabase.from("tasks").select("*, workflow_stages(name_ar)");
      
      if (selectedProjId !== "ALL") {
        tasksQuery = tasksQuery.eq("project_id", selectedProjId);
        const membership = myMemberships.find(m => m.project_id === selectedProjId);
        const isManager = !membership || membership.project_role === "project_manager";
        const isBranchManager = membership?.project_role === "branch_manager";
        
        if (!isManager && !isBranchManager && user) {
          // Teachers and group supervisors only see tasks assigned to them
          tasksQuery = tasksQuery.eq("assignee_id", user.id);
        } else if (isBranchManager && membership?.branch_id) {
          tasksQuery = tasksQuery.eq("branch_id", membership.branch_id);
        }
      } else {
        // In ALL view, fetch ALL tasks assigned to the user regardless of project
        if (user) {
          tasksQuery = tasksQuery.eq("assignee_id", user.id);
        } else {
          tasksQuery = tasksQuery.eq("project_id", "none");
        }
      }
      
      const { data: tks } = await tasksQuery;
      let mappedTks = tks ?? [];
      
      if (selectedProjId === "ALL") {
        mappedTks = mappedTks.map((t: any) => ({
          ...t,
          real_workflow_stage_id: t.workflow_stage_id,
          workflow_stage_id: t.workflow_stages?.name_ar || t.workflow_stage_id || "غير مصنف"
        }));
        
        // Dynamically build stages for ALL view based on the tasks we found
        const uniqueStageNames = Array.from(new Set(mappedTks.map((t: any) => t.workflow_stage_id)));
        const dynamicStages = uniqueStageNames.map((name, idx) => ({
          id: name,
          name_ar: name,
          color: "#64748B", // standard generic color
          sort_order: idx
        }));
        setStages(dynamicStages);
      }
      
      setTasks(mappedTks);

      // 3. Fetch Automations
      if (selectedProjId !== "ALL") {
        const { data: aut } = await supabase.from("task_automations").select("*").eq("project_id", selectedProjId);
        setAutomations(aut ?? []);
      } else {
        setAutomations([]);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjId) {
      loadDashboardData();
    }
  }, [selectedProjId]);

  // Tasks Filter Logic
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAssignee = selectedAssignee ? t.assignee_id === selectedAssignee : true;
    const matchesPriority = selectedPriority ? t.priority === selectedPriority : true;
    return matchesSearch && matchesAssignee && matchesPriority;
  });

  // Kanban Drag & Drop handlers using @hello-pangea/dnd
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return; // No change
    }

    // Optimistically update the UI
    const newTasks = Array.from(tasks);
    const taskIndex = newTasks.findIndex(t => t.id === draggableId);
    if (taskIndex === -1) return;
    
    const task = newTasks[taskIndex];

    if (selectedProjId === "ALL") {
      // In ALL view, destination.droppableId is the stage name (e.g. "مكتمل")
      const targetStageName = destination.droppableId;
      task.workflow_stage_id = targetStageName; // Optimistic update
      setTasks(newTasks);

      try {
        let stageQuery = supabase.from("workflow_stages").select("id").eq("name_ar", targetStageName);
        if (task.project_id) {
           stageQuery = stageQuery.eq("project_id", task.project_id);
        } else {
           stageQuery = stageQuery.is("project_id", null);
        }
        
        const { data: stgData } = await stageQuery;
        
        let targetStageId;
        if (stgData && stgData.length > 0) {
          targetStageId = stgData[0].id;
        } else {
          // Create the stage for this project!
          const { data: newStg, error: createError } = await supabase.from("workflow_stages").insert({
            name_ar: targetStageName,
            name_en: targetStageName,
            project_id: task.project_id || null,
            color: "#0EA5E9",
            sort_order: 99
          }).select();
          
          if (createError) throw createError;
          targetStageId = newStg[0].id;
        }

        const { error } = await supabase.from("tasks").update({ workflow_stage_id: targetStageId }).eq("id", draggableId);
        if (error) throw error;
        toast.success("تم تحديث مرحلة المهمة بنجاح!");
      } catch (err: any) {
        toast.error(err.message);
        loadDashboardData(); // Revert on error
      }
      return;
    }

    // Normal project view: destination.droppableId is the actual UUID
    task.workflow_stage_id = destination.droppableId;
    setTasks(newTasks);

    // Persist to DB
    try {
      const { error } = await supabase.from("tasks").update({ workflow_stage_id: destination.droppableId }).eq("id", draggableId);
      if (error) {
        toast.error(error.message);
        loadDashboardData(); // Revert on error
      }
    } catch (err: any) {
      toast.error(err.message);
      loadDashboardData(); // Revert on error
    }
  };

  const handleCopyList = async (stage: any) => {
    try {
      const { error } = await supabase.from("workflow_stages").insert({
        project_id: selectedProjId,
        name_ar: stage.name_ar + " (نسخة)",
        name_en: stage.name_en ? stage.name_en + " (Copy)" : null,
        color: stage.color,
        sort_order: stage.sort_order + 1,
        wip_limit: stage.wip_limit
      });
      if (error) throw error;
      toast.success("تم نسخ القائمة بنجاح");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleArchiveList = async (stage: any, taskCount: number) => {
    if (taskCount > 0) {
      toast.error("لا يمكن أرشفة قائمة تحتوي على بطاقات. قم بنقلها أولاً.");
      return;
    }
    if (!window.confirm("هل أنت متأكد من أرشفة هذه القائمة؟")) return;
    try {
      const { error } = await supabase.from("workflow_stages").delete().eq("id", stage.id);
      if (error) throw error;
      toast.success("تمت أرشفة القائمة");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleArchiveAllCards = async (stageId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف جميع البطاقات في هذه القائمة؟")) return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("workflow_stage_id", stageId);
      if (error) throw error;
      toast.success("تمت أرشفة البطاقات");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMoveAllCards = async () => {
    if (!moveCardsStageId || !targetStageIdForMove) return;
    try {
      const { error } = await supabase.from("tasks").update({ workflow_stage_id: targetStageIdForMove }).eq("workflow_stage_id", moveCardsStageId);
      if (error) throw error;
      toast.success("تم نقل البطاقات");
      setMoveCardsStageId(null);
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Add Task
  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !selectedProjId) return;
    let stageId = newTaskStage || (stages.length > 0 ? stages[0].id : null);
    let finalProjId = selectedProjId === "ALL" ? null : selectedProjId;

    if (selectedProjId === "ALL" && stageId) {
      // Find or create global stage (project_id is null) matching the name
      let { data: stgData } = await supabase.from("workflow_stages").select("id").eq("name_ar", stageId).is("project_id", null);
      if (stgData && stgData.length > 0) {
        stageId = stgData[0].id;
      } else {
        const { data: newStg } = await supabase.from("workflow_stages").insert({
          name_ar: stageId,
          name_en: stageId,
          project_id: null,
          color: "#0EA5E9",
          sort_order: 99
        }).select();
        if (newStg && newStg.length > 0) stageId = newStg[0].id;
      }
    }
    
    const { data, error } = await supabase.from("tasks").insert({
      title: newTaskTitle,
      description: newTaskDesc,
      project_id: finalProjId,
      workflow_stage_id: stageId,
      status: "new",
      priority: "medium",
      position: 1000,
      assignee_id: user?.id // Default assign to me in ALL view
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("common.success"));
      setIsNewTaskOpen(false);
      setNewTaskTitle("");
      setNewTaskDesc("");
      loadDashboardData();
    }
  };

  // Add Workflow Stage
  const handleAddStage = async () => {
    if (!newStageName.trim() || !selectedProjId) return;
    const nextOrder = stages.length + 1;
    let finalProjId = selectedProjId === "ALL" ? null : selectedProjId;

    const { error } = await supabase.from("workflow_stages").insert({
      project_id: finalProjId,
      name_ar: newStageName,
      sort_order: nextOrder,
      wip_limit: newStageWip || 0
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("common.success"));
      setIsNewStageOpen(false);
      setNewStageName("");
      setNewStageWip(0);
      loadDashboardData();
    }
  };

  // Add Automation
  const handleAddAutomation = async () => {
    if (!autoName.trim() || !selectedProjId) return;
    const rule = {
      project_id: selectedProjId,
      name: autoName,
      trigger_event: autoTrigger,
      conditions: [],
      actions: [{ type: "award_points", value: autoPoints }]
    };

    const { error } = await supabase.from("task_automations").insert(rule);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("common.success"));
      setIsNewAutoOpen(false);
      setAutoName("");
      loadDashboardData();
    }
  };

  // Dashboard Chart Calculations
  const getPriorityData = () => {
    const priorityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
    filteredTasks.forEach((tk) => {
      priorityCounts[tk.priority] = (priorityCounts[tk.priority] || 0) + 1;
    });
    return [
      { name: "منخفضة", value: priorityCounts.low, color: "#94A3B8" },
      { name: "متوسطة", value: priorityCounts.medium, color: "#0EA5E9" },
      { name: "مرتفعة", value: priorityCounts.high, color: "#F59E0B" },
      { name: "عاجلة", value: priorityCounts.urgent, color: "#EF4444" }
    ];
  };

  const getStageStats = () => {
    return stages.map(s => {
      const count = filteredTasks.filter(t => t.workflow_stage_id === s.id).length;
      return { name: s.name_ar, count };
    });
  };

  return (
    <div className="space-y-4">
      {/* Single Row Trello Style Header */}
      <div className="bg-primary text-primary-foreground flex flex-col md:flex-row md:items-center justify-between px-4 py-2.5 rounded-xl shadow-sm gap-4">
        {/* Title and Views (Right side in RTL) */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Project Selector */}
          <div className="relative flex items-center group">
            <select
              value={selectedProjId}
              onChange={(e) => setSelectedProjId(e.target.value)}
              className="appearance-none font-black text-lg bg-transparent hover:bg-primary-foreground/10 px-3 py-1 pl-8 rounded-md transition-colors border-none outline-none text-primary-foreground cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-foreground bg-background">{p.name_ar}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-2.5 h-4 w-4 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="w-px h-5 bg-primary-foreground/30 hidden md:block"></div>

          {/* View Switcher (All views) */}
          <div className="flex items-center gap-1 bg-black/10 dark:bg-black/20 p-1 rounded-lg overflow-x-auto max-w-[80vw] md:max-w-full hide-scrollbar">
            <Button title="لوحة المهام" variant="ghost" size="icon" onClick={() => setActiveTab("kanban")} className={`h-8 w-8 rounded-md shrink-0 ${activeTab === 'kanban' ? 'bg-background text-primary shadow-sm' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}>
              <KanbanSquare className="h-4 w-4" />
            </Button>
            <Button title="الجدول" variant="ghost" size="icon" onClick={() => setActiveTab("table")} className={`h-8 w-8 rounded-md shrink-0 ${activeTab === 'table' ? 'bg-background text-primary shadow-sm' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}>
              <TableProperties className="h-4 w-4" />
            </Button>
            <Button title="التقويم" variant="ghost" size="icon" onClick={() => setActiveTab("calendar")} className={`h-8 w-8 rounded-md shrink-0 ${activeTab === 'calendar' ? 'bg-background text-primary shadow-sm' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}>
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button title="المخطط الزمني" variant="ghost" size="icon" onClick={() => setActiveTab("timeline")} className={`h-8 w-8 rounded-md shrink-0 ${activeTab === 'timeline' ? 'bg-background text-primary shadow-sm' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}>
              <Clock className="h-4 w-4" />
            </Button>
            <Button title="الإحصائيات" variant="ghost" size="icon" onClick={() => setActiveTab("analytics")} className={`h-8 w-8 rounded-md shrink-0 ${activeTab === 'analytics' ? 'bg-background text-primary shadow-sm' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}>
              <BarChart4 className="h-4 w-4" />
            </Button>
            <Button title="الأتمتة" variant="ghost" size="icon" onClick={() => setActiveTab("automations")} className={`h-8 w-8 rounded-md shrink-0 ${activeTab === 'automations' ? 'bg-background text-primary shadow-sm' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}>
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions and Filters (Left side in RTL) */}
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          
          <div className="relative">
            <Button 
              title="تصفية"
              variant="ghost" 
              size="icon" 
              onClick={() => setIsFilterOpen(!isFilterOpen)} 
              className={`h-8 w-8 shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground rounded-md font-bold ${isFilterOpen ? "bg-primary-foreground/20" : ""}`}
            >
              <Filter className="h-4 w-4" />
            </Button>
            
            {isFilterOpen && (
              <div className="absolute top-full mt-2 left-0 right-auto w-72 bg-card border border-border/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-0 text-foreground">
                <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                  <span className="font-bold text-sm">تصفية البطاقات</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setIsFilterOpen(false)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-3 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#44546F] dark:text-[#8C9BAB]">الأعضاء</Label>
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="">أي عضو</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#44546F] dark:text-[#8C9BAB]">الأولوية</Label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="">جميع الأولويات</option>
                      <option value="low">منخفضة</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">مرتفعة</option>
                      <option value="urgent">عاجلة</option>
                    </select>
                  </div>
                  
                  {/* Search inside filter for cleaner UI */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label className="text-xs font-bold text-[#44546F] dark:text-[#8C9BAB]">بحث بالكلمات</Label>
                    <div className="relative">
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="ابحث عن بطاقة..."
                        className="h-9 w-full rounded-md bg-muted/40 text-xs pr-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* TAB CONTENT: KANBAN */}
        <TabsContent value="kanban" className="focus:outline-none bg-primary/10 dark:bg-primary/5 border border-primary/10 rounded-xl p-4 min-h-[75vh] mt-0 flex flex-col">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 select-none snap-x snap-mandatory hide-scrollbar flex-1 items-start" dir="rtl">
              {stages.map((stage) => {
                const stageTasks = filteredTasks.filter(t => t.workflow_stage_id === stage.id).sort((a, b) => a.position - b.position);
                
                return (
                  <div
                    key={stage.id}
                    className="w-[272px] shrink-0 snap-start bg-card dark:bg-muted/30 rounded-xl p-2 shadow-sm flex flex-col transition-all duration-300 max-h-[65vh] border border-border/50"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-2 px-2 py-1">
                      <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {stage.name_ar}
                        {watchedStages.includes(stage.id) && <Eye className="h-3 w-3 text-primary opacity-70" />}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-muted/80 rounded-md">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 font-medium text-sm border-border/50 shadow-xl" dir="rtl">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => { setNewTaskStage(stage.id); setIsNewTaskOpen(true); }}>
                            <Plus className="h-4 w-4 ml-2 opacity-70" /> إضافة بطاقة
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopyList(stage)}>
                            <Copy className="h-4 w-4 ml-2 opacity-70" /> نسخ القائمة
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => { setMoveCardsStageId(stage.id); setTargetStageIdForMove(""); }}>
                            <ArrowRightLeft className="h-4 w-4 ml-2 opacity-70" /> نقل جميع البطاقات...
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => {
                            if (watchedStages.includes(stage.id)) {
                              setWatchedStages(watchedStages.filter(id => id !== stage.id));
                              toast.success("تم إلغاء متابعة القائمة");
                            } else {
                              setWatchedStages([...watchedStages, stage.id]);
                              toast.success("أنت الآن تتابع هذه القائمة");
                            }
                          }}>
                            <Eye className="h-4 w-4 ml-2 opacity-70" /> {watchedStages.includes(stage.id) ? "إلغاء المتابعة" : "متابعة"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleArchiveList(stage, stageTasks.length)}>
                            <Archive className="h-4 w-4 ml-2 opacity-70" /> أرشفة القائمة
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleArchiveAllCards(stage.id)}>
                            <Archive className="h-4 w-4 ml-2 opacity-70" /> أرشفة جميع البطاقات...
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Tasks Container */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 space-y-2 overflow-y-auto px-1 custom-scrollbar pb-1 ${snapshot.isDraggingOver ? 'bg-primary/5 rounded-lg' : ''}`}
                        >
                          {stageTasks.map((tk, index) => {
                            const assignee = users.find(u => u.id === tk.assignee_id);
                            return (
                              <Draggable key={tk.id} draggableId={tk.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`bg-background dark:bg-card/50 border border-border/50 rounded-lg p-3 shadow-sm hover:ring-2 hover:ring-primary transition-all duration-200 group relative ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary scale-[1.02] rotate-1 z-50' : ''}`}
                                    style={provided.draggableProps.style}
                                    onClick={() => setSelectedTaskId(tk.id)}
                                  >
                                    <h4 className="font-medium text-sm text-foreground leading-relaxed pr-1 text-right">{tk.title}</h4>
                                    
                                    {(tk.description || tk.due_date || assignee) && (
                                      <div className="flex items-center gap-2 mt-2 pt-1 flex-wrap">
                                        {tk.description && <span className="text-muted-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></span>}
                                        
                                        {tk.due_date && (
                                          <span className={`text-[10px] font-medium flex items-center gap-1 px-1.5 rounded ${new Date(tk.due_date) < new Date() ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' : 'text-muted-foreground'}`}>
                                            <Clock className="h-3 w-3" />
                                            {new Date(tk.due_date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                                          </span>
                                        )}
                                        
                                        <div className="flex-1"></div>
                                        
                                        {assignee && (
                                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]" title={assignee.full_name}>
                                            {assignee.full_name.charAt(0)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                    
                    {/* Add a card */}
                    <div className="pt-2 px-1 pb-1">
                      <Button 
                        variant="ghost" 
                        className="w-full flex justify-between items-center text-muted-foreground hover:bg-muted/80 hover:text-foreground font-medium h-8 px-2 rounded-lg transition-colors"
                        onClick={() => { setNewTaskStage(stage.id); setIsNewTaskOpen(true); }}
                      >
                        <div className="flex items-center"><Plus className="h-4 w-4 ml-1" /> إضافة بطاقة</div>
                      </Button>
                    </div>
                  </div>
                );
              })}

            {/* Add another list */}
            <div className="w-[272px] shrink-0 snap-start">
              <Button 
                variant="ghost" 
                className="w-full justify-start bg-primary/10 hover:bg-primary/20 text-primary font-medium h-10 px-3 rounded-xl transition-colors backdrop-blur-sm border border-primary/20"
                onClick={() => setIsNewStageOpen(true)}
              >
                <Plus className="h-4 w-4 ml-2" /> إضافة قائمة أخرى
              </Button>
            </div>
            </div>
          </DragDropContext>
        </TabsContent>

        {/* TAB CONTENT: TABLE */}
        <TabsContent value="table" className="focus:outline-none">
          <Card className="rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50 text-muted-foreground font-bold">
                    <th className="p-4 pr-6">المهمة</th>
                    <th className="p-4">المرحلة</th>
                    <th className="p-4">المسؤول</th>
                    <th className="p-4">الأولوية</th>
                    <th className="p-4">تاريخ الاستحقاق</th>
                    <th className="p-4">النقاط</th>
                    <th className="p-4">الإنجاز</th>
                    <th className="p-4 text-center pl-6">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Quick Add Row */}
                  <tr className="bg-primary/5 border-b border-border/50">
                    <td colSpan={8} className="p-3 px-6">
                      <div className="flex items-center gap-3">
                        <Plus className="h-5 w-5 text-primary shrink-0" />
                        <Input
                          placeholder="أدخل عنوان المهمة واضغط Enter للإضافة..."
                          className="h-10 text-sm bg-background/50 rounded-xl border-transparent focus-visible:bg-background flex-1 transition-colors"
                          value={quickTableTaskTitle}
                          onChange={(e) => setQuickTableTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && quickTableTaskTitle.trim()) {
                              handleInlineQuickAdd(quickTableTaskTitle);
                              setQuickTableTaskTitle("");
                            }
                          }}
                        />
                        <Button size="sm" className="h-10 px-5 rounded-xl text-sm shrink-0 font-bold shadow-sm" onClick={() => {
                          if (quickTableTaskTitle.trim()) {
                            handleInlineQuickAdd(quickTableTaskTitle);
                            setQuickTableTaskTitle("");
                          }
                        }}>إضافة سريعة</Button>
                      </div>
                    </td>
                  </tr>

                  {filteredTasks.map((tk) => {
                    const assignee = users.find(u => u.id === tk.assignee_id);
                    const stage = stages.find(s => s.id === tk.workflow_stage_id);
                    return (
                      <tr key={tk.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                        <td className="p-4 pr-6 font-bold text-foreground">
                          <button onClick={() => setSelectedTaskId(tk.id)} className="hover:text-primary transition-colors text-right flex flex-col">
                            <span>{tk.title}</span>
                            {tk.description && <span className="text-xs text-muted-foreground font-normal line-clamp-1 mt-0.5">{tk.description}</span>}
                          </button>
                        </td>
                        <td className="p-4">
                          <select
                            value={tk.workflow_stage_id || ""}
                            onChange={(e) => handleUpdateTaskStage(tk.id, e.target.value)}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-border/50 bg-background/50 hover:bg-background transition-colors text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                            style={{ color: stage?.color || undefined }}
                          >
                            {stages.map((stg) => (
                              <option key={stg.id} value={stg.id}>{stg.name_ar}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 text-muted-foreground font-semibold text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px]">
                              {assignee ? assignee.full_name.charAt(0) : <User className="h-3 w-3" />}
                            </div>
                            {assignee?.full_name || "غير معين"}
                          </div>
                        </td>
                        <td className="p-4">
                          <select
                            value={tk.priority || "medium"}
                            onChange={(e) => handleUpdateTaskPriority(tk.id, e.target.value)}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-border/50 bg-background/50 hover:bg-background transition-colors text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                          >
                            <option value="urgent">⚠️ عاجل</option>
                            <option value="high">🔥 مرتفع</option>
                            <option value="medium">⚡ متوسط</option>
                            <option value="low">💤 منخفض</option>
                          </select>
                        </td>
                        <td className="p-4 text-muted-foreground font-semibold text-sm">{tk.due_date ? new Date(tk.due_date).toLocaleDateString("ar-SA", { year: 'numeric', month: 'short', day: 'numeric' }) : "—"}</td>
                        <td className="p-4 font-black text-primary bg-primary/5 rounded-lg m-2 inline-block px-3">{tk.points || 0}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3 w-full max-w-[120px]">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden shrink-0 shadow-inner">
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${tk.progress_percent}%` }} />
                            </div>
                            <span className="text-xs font-bold w-8">{tk.progress_percent}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-center pl-6">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setSelectedTaskId(tk.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB CONTENT: TIMELINE */}
        <TabsContent value="timeline" className="focus:outline-none">
          <Card className="p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
               <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">المخطط الزمني للمشروع</h3>
                <p className="text-sm text-muted-foreground">تفاصيل المهام وتواريخ الاستحقاق ونسبة الإنجاز</p>
              </div>
            </div>
            <div className="space-y-4">
              {filteredTasks.map((tk) => {
                const stage = stages.find(s => s.id === tk.workflow_stage_id);
                return (
                  <div key={tk.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors gap-4 text-sm">
                    <div className="min-w-0 md:w-1/3">
                      <span className="font-bold text-foreground block truncate text-base mb-1">{tk.title}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: `${stage?.color || "#64748B"}20`, color: stage?.color || "#64748B" }}>
                        {stage?.name_ar || "جديد"}
                      </span>
                    </div>
                    
                    <div className="flex-1 w-full relative h-8 bg-muted/30 rounded-xl overflow-hidden flex items-center px-3 shadow-inner">
                      <div className="h-full absolute left-0 top-0 bg-primary/20 border-r-4 border-primary transition-all duration-500" style={{ width: `${tk.progress_percent}%` }} />
                      <span className="relative z-10 text-xs font-black text-primary-foreground drop-shadow-md">{tk.progress_percent}% مكتمل</span>
                    </div>

                    <div className="text-xs font-bold text-muted-foreground shrink-0 flex flex-col items-end gap-1 bg-background px-3 py-1.5 rounded-xl border border-border/50">
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> البدء: {tk.start_date || "—"}</span>
                      <span className="flex items-center gap-1.5 text-primary"><Clock className="h-3 w-3" /> الاستحقاق: {tk.due_date || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* TAB CONTENT: CALENDAR */}
        <TabsContent value="calendar" className="focus:outline-none">
          <Card className="p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="grid grid-cols-7 gap-2 text-center font-black text-sm mb-4 pb-4 border-b border-border/50 text-muted-foreground">
              <div>الأحد</div><div>الإثنين</div><div>الثلاثاء</div><div>الأربعاء</div><div>الخميس</div><div>الجمعة</div><div>السبت</div>
            </div>
            <div className="grid grid-cols-7 gap-3 min-h-[500px]">
              {Array.from({ length: 35 }).map((_, i) => {
                const dayNum = (i % 30) + 1;
                const dayTasks = filteredTasks.filter(t => t.due_date && new Date(t.due_date).getDate() === dayNum);
                const isToday = dayNum === new Date().getDate();
                
                return (
                  <div key={i} className={`border border-border/50 rounded-2xl p-2 min-h-[100px] flex flex-col space-y-2 transition-colors ${isToday ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-card hover:bg-muted/10'}`}>
                    <div className="flex justify-between items-center px-1">
                      <span className={`text-sm font-black w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground'}`}>
                        {dayNum}
                      </span>
                      {dayTasks.length > 0 && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 rounded-md">{dayTasks.length} مهام</span>}
                    </div>
                    
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                      {dayTasks.map(tk => (
                        <div key={tk.id} onClick={() => setSelectedTaskId(tk.id)} className="bg-background border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground text-xs p-1.5 rounded-xl font-bold cursor-pointer truncate shadow-sm transition-colors relative group">
                          {tk.priority === "urgent" && <span className="absolute right-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 bg-red-500 rounded-full group-hover:bg-red-200"></span>}
                          <span className={tk.priority === "urgent" ? "pr-3" : ""}>{tk.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* TAB CONTENT: ANALYTICS */}
        <TabsContent value="analytics" className="space-y-6 focus:outline-none">
          {/* Top Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-card to-muted/20">
              <CardContent className="space-y-2 p-0">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                  <Layers className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground font-bold">إجمالي المهام</span>
                <div className="text-4xl font-black text-foreground">{filteredTasks.length}</div>
              </CardContent>
            </Card>

            <Card className="text-center p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-card to-emerald-500/5">
              <CardContent className="space-y-2 p-0">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground font-bold">المهام المكتملة</span>
                <div className="text-4xl font-black text-emerald-500">
                  {filteredTasks.filter(t => {
                    const stage = stages.find(s => s.id === t.workflow_stage_id);
                    return stage?.name_ar.includes("مكتمل") || t.status === "completed";
                  }).length}
                </div>
              </CardContent>
            </Card>

            <Card className="text-center p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-card to-red-500/5">
              <CardContent className="space-y-2 p-0">
                <div className="h-10 w-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-2">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground font-bold">المهام العاجلة</span>
                <div className="text-4xl font-black text-red-500">{filteredTasks.filter(t => t.priority === "urgent").length}</div>
              </CardContent>
            </Card>

            <Card className="text-center p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-card to-sky-500/5">
              <CardContent className="space-y-2 p-0">
                <div className="h-10 w-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500 mx-auto mb-2">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground font-bold">متوسط الإنجاز</span>
                <div className="text-4xl font-black text-sky-500">
                  {filteredTasks.length > 0 ? Math.round(filteredTasks.reduce((acc, t) => acc + (t.progress_percent || 0), 0) / filteredTasks.length) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
              <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <BarChart4 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base">المهام حسب مراحل تدفق العمل</h3>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getStageStats()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6 rounded-3xl border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
              <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <PieChartIcon className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base">توزيع المهام حسب مستوى الأهمية</h3>
              </div>
              <div className="h-72 flex justify-center items-center w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={getPriorityData()} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {getPriorityData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB CONTENT: AUTOMATIONS */}
        <TabsContent value="automations" className="space-y-6 focus:outline-none">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/80 backdrop-blur-md p-6 rounded-3xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="space-y-1">
              <h3 className="font-black text-xl text-foreground flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" /> قواعد محرك الأتمتة (Butler Automations)
              </h3>
              <p className="text-sm text-muted-foreground font-medium">قم بإدارة القواعد التلقائية لتوزيع النقاط والرسائل التلقائية للفريق.</p>
            </div>

            <Dialog open={isNewAutoOpen} onOpenChange={setIsNewAutoOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl font-bold h-11 px-6 shadow-md w-full md:w-auto">
                  <Plus className="h-4 w-4 me-1.5" /> إضافة قاعدة أتمتة
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl border-border/50 shadow-2xl">
                <DialogHeader><DialogTitle className="text-xl font-black">إنشاء قاعدة أتمتة جديدة</DialogTitle></DialogHeader>
                <div className="space-y-5 pt-4">
                  <div className="space-y-2">
                    <Label className="font-bold">اسم القاعدة</Label>
                    <Input className="rounded-xl h-11 bg-muted/30 border-transparent focus-visible:bg-background transition-colors" placeholder="مثال: مكافأة النقاط عند الاكتمال..." value={autoName} onChange={(e) => setAutoName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">عند حدوث الحدث التالي (Trigger)</Label>
                    <select
                      value={autoTrigger}
                      onChange={(e) => setAutoTrigger(e.target.value)}
                      className="flex h-11 w-full rounded-xl border-transparent bg-muted/30 px-3 py-1.5 text-sm font-semibold transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="task_completed">عند اكتمال المهمة بنجاح</option>
                      <option value="due_date_passed">عند مرور تاريخ الاستحقاق</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">نقاط المكافأة الممنوحة للمسؤول</Label>
                    <Input className="rounded-xl h-11 bg-muted/30 border-transparent focus-visible:bg-background transition-colors" type="number" value={autoPoints} onChange={(e) => setAutoPoints(Number(e.target.value))} />
                  </div>
                  <Button className="w-full font-bold rounded-xl h-11 shadow-md mt-2" onClick={handleAddAutomation}>حفظ القاعدة وتفعيلها</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {automations.length === 0 ? (
              <div className="col-span-full bg-muted/20 border border-border/50 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
                <Bot className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground font-bold">لا توجد قواعد أتمتة مضافة بعد لهذا المشروع.</p>
              </div>
            ) : (
              automations.map((a) => (
                <Card key={a.id} className="p-5 flex flex-col items-start justify-between border-border/50 shadow-sm rounded-3xl hover:shadow-md transition-shadow gap-4 group cursor-pointer relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                  
                  <div className="space-y-3 w-full relative z-10">
                    <div className="flex items-center justify-between w-full">
                      <div className="font-black text-lg text-foreground flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                          <Bot className="h-4 w-4" />
                        </div>
                        {a.name}
                      </div>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20 font-bold shadow-none">نشط</Badge>
                    </div>
                    
                    <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-2 border border-border/50">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-semibold">عند حدوث:</span>
                        <Badge variant="outline" className="text-xs font-bold bg-background shadow-sm border-border/50">{a.trigger_event === "task_completed" ? "اكتمال المهمة" : "تجاوز موعد الاستحقاق"}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground font-semibold">الإجراء:</span>
                        <span className="font-bold text-primary flex items-center gap-1">توزيع {a.actions?.[0]?.value || 0} نقطة للمسؤول <CheckCircle2 className="h-3 w-3" /></span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Drawer details */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onSaved={loadDashboardData}
        projects={projects}
      />

        {/* Move All Cards Dialog */}
        <Dialog open={!!moveCardsStageId} onOpenChange={(o) => !o && setMoveCardsStageId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>نقل جميع البطاقات</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Label>اختر القائمة الوجهة:</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={targetStageIdForMove}
                onChange={(e) => setTargetStageIdForMove(e.target.value)}
              >
                <option value="">-- اختر القائمة --</option>
                {stages.filter((s) => s.id !== moveCardsStageId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name_ar}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMoveCardsStageId(null)}>إلغاء</Button>
              <Button onClick={handleMoveAllCards} disabled={!targetStageIdForMove}>نقل البطاقات</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default TaskWorkflowDashboard;
