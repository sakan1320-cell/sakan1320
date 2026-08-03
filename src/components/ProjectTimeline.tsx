import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Flag } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
}

const statusColor: Record<string, string> = {
  new: "bg-muted",
  in_progress: "bg-primary",
  completed: "bg-success",
  overdue: "bg-destructive",
};

export const ProjectTimeline = ({ projectId, startDate, endDate }: Props) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    supabase
      .from("tasks")
      .select("id,title,status,due_date,created_at")
      .eq("project_id", projectId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setTasks((data ?? []) as Task[]));
  }, [projectId]);

  const events = [
    ...(startDate ? [{ date: startDate, type: "start" as const, label: t("projects.startDate") }] : []),
    ...(endDate ? [{ date: endDate, type: "end" as const, label: t("projects.endDate") }] : []),
    ...tasks.filter((t) => t.due_date).map((t) => ({ date: t.due_date!, type: "task" as const, label: t.title, status: t.status, id: t.id })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("projects.timelineEmpty")}</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <div className="relative ms-4 border-s-2 border-border ps-6 space-y-4">
        {events.map((e, i) => (
          <div key={i} className="relative">
            <div className={`absolute -start-[33px] top-1 h-4 w-4 rounded-full border-2 border-background ${
              e.type === "start" ? "bg-info" :
              e.type === "end" ? "bg-warning" :
              statusColor[(e as any).status] ?? "bg-muted"
            }`} />
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  {e.type === "task" ? <Flag className="h-4 w-4 shrink-0" /> : <CalendarIcon className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-sm font-medium">{e.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.type === "task" && (e as any).status && (
                    <Badge variant="outline" className="text-xs">{t(`tasks.statuses.${(e as any).status}`)}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground" dir="ltr">{e.date}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
