import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, ListChecks } from "lucide-react";
import { TaskFormDialog, TaskFormValue } from "./TaskFormDialog";
import { SystemTimeline } from "./SystemTimeline";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Status = "new" | "in_progress" | "completed" | "overdue";
type Priority = "low" | "medium" | "high" | "urgent";

interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  branch_id: string | null;
  assignee_id: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
}

const priorityColors: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/20 text-warning-foreground",
  urgent: "bg-destructive/15 text-destructive",
};

const statusOrder: Status[] = ["new", "in_progress", "completed", "overdue"];

export const TaskList = ({ projectId, branchId, groupId }: { projectId?: string; branchId?: string | null; groupId?: string | null }) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskFormValue | null>(null);
  const [view, setView] = useState<"list" | "board" | "timeline">("list");
  const { confirm, ConfirmDialogNode } = useConfirm();

  const load = async () => {
    let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (projectId) q = q.eq("project_id", projectId);
    // If scoped to a branch (or group which implies a branch), filter tasks by branch_id
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    setTasks((data ?? []) as Task[]);
  };

  useEffect(() => { load(); }, [projectId, branchId, groupId]);

  const handleDelete = async (id: string) => {
    if (!(await confirm(t("common.confirmDelete")))) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit("delete", "task", id);
    load();
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit("update", "task", id, { status });
    load();
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropColumn = async (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const tk = tasks.find((t) => t.id === id);
    if (!tk || tk.status === status) return;
    setTasks((curr) => curr.map((t) => (t.id === id ? { ...t, status } : t)));
    await updateStatus(id, status);
  };

  const renderTask = (tk: Task, draggable = false) => (
    <div
      key={tk.id}
      className="bg-card hover:bg-muted/30 border border-border/50 rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing p-4"
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart(e, tk.id) : undefined}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-bold text-foreground/90 leading-tight flex-1">{tk.title}</h4>
          <div className="flex gap-1 shrink-0 bg-muted/50 rounded-lg p-0.5">
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-card" onClick={() => { setEditing(tk); setOpen(true); }}>
              <Edit className="h-3.5 w-3.5 text-blue-500" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-card" onClick={() => handleDelete(tk.id)}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        </div>
        {tk.description && <p className="text-xs text-muted-foreground line-clamp-2">{tk.description}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[tk.priority]}`}>
            {t(`tasks.priorities.${tk.priority}`)}
          </span>
          {tk.due_date && <Badge variant="outline" className="text-xs">{tk.due_date}</Badge>}
        </div>
        {!draggable && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40 mt-2">
            {statusOrder.filter((s) => s !== tk.status).map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(tk.id, s)}
                className="text-[10px] font-bold text-muted-foreground bg-muted/40 hover:bg-muted rounded-md px-2 py-1 transition-colors"
              >
                → {t(`tasks.statuses.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}
      <div className="flex items-center justify-between gap-2 bg-card p-2 rounded-3xl shadow-sm border border-border/50">
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "board" | "timeline")} className="w-full">
          <div className="flex items-center justify-between w-full">
            <TabsList className="bg-transparent border-none">
              <TabsTrigger value="list">{t("tasks.view.list")}</TabsTrigger>
              <TabsTrigger value="board">{t("tasks.view.board")}</TabsTrigger>
              <TabsTrigger value="timeline">{t("common.timeline", "السجل")}</TabsTrigger>
            </TabsList>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-xl font-bold shadow-sm h-10 px-4 mr-2">
              <Plus className="h-4 w-4" />{t("tasks.new")}
            </Button>
          </div>
        </Tabs>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center bg-muted/20 rounded-3xl border border-dashed">
          <ListChecks className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">{t("tasks.empty")}</p>
        </div>
      ) : view === "list" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((tk) => renderTask(tk, false))}
        </div>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statusOrder.map((s) => (
            <div
              key={s}
              className="space-y-4 bg-muted/20 p-4 rounded-3xl border border-border/50"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => onDropColumn(e, s)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${s === 'completed' ? 'bg-emerald-500' : s === 'new' ? 'bg-blue-500' : s === 'in_progress' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                  {t(`tasks.statuses.${s}`)}
                </h3>
                <Badge variant="outline" className="bg-background rounded-full px-2.5">{tasks.filter((tk) => tk.status === s).length}</Badge>
              </div>
              <div className="space-y-3 min-h-[200px] transition-colors">
                {tasks.filter((tk) => tk.status === s).map((tk) => renderTask(tk, true))}
              </div>
            </div>
          ))}
        </div>
      ) : view === "timeline" ? (
        <Card className="border">
          <CardContent className="p-6">
            <SystemTimeline entityType="project" entityId={projectId!} />
          </CardContent>
        </Card>
      ) : null}

      <TaskFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing ?? undefined}
        defaultProjectId={projectId}
        onSaved={async (id, isNew) => { await logAudit(isNew ? "create" : "update", "task", id); load(); }}
      />
    </div>
  );
};
