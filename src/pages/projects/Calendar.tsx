import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCircle2, FolderKanban } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  type: "task" | "project_start" | "project_end";
  title: string;
  date: Date;
  status: string;
  meta?: any;
}

const SystemCalendar = () => {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [tasksRes, projectsRes] = await Promise.all([
      supabase.from("tasks").select("id, title, due_date, status, priority").not("due_date", "is", null),
      supabase.from("projects").select("id, name_ar, name_en, start_date, end_date, status")
    ]);

    const items: CalendarEvent[] = [];

    if (tasksRes.data) {
      tasksRes.data.forEach(task => {
        items.push({
          id: `task_${task.id}`,
          type: "task",
          title: task.title,
          date: parseISO(task.due_date),
          status: task.status,
          meta: task
        });
      });
    }

    if (projectsRes.data) {
      projectsRes.data.forEach(proj => {
        const title = i18n.language === "ar" ? proj.name_ar : (proj.name_en || proj.name_ar);
        if (proj.start_date) {
          items.push({
            id: `proj_start_${proj.id}`,
            type: "project_start",
            title: `${t("projects.startDate", "بداية مشروع")}: ${title}`,
            date: parseISO(proj.start_date),
            status: proj.status,
            meta: proj
          });
        }
        if (proj.end_date) {
          items.push({
            id: `proj_end_${proj.id}`,
            type: "project_end",
            title: `${t("projects.endDate", "نهاية مشروع")}: ${title}`,
            date: parseISO(proj.end_date),
            status: proj.status,
            meta: proj
          });
        }
      });
    }

    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    setEvents(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, [i18n.language]);

  const groupedEvents = useMemo(() => {
    const groups: { date: Date; items: CalendarEvent[] }[] = [];
    events.forEach(event => {
      const existing = groups.find(g => isSameDay(g.date, event.date));
      if (existing) {
        existing.items.push(event);
      } else {
        groups.push({ date: event.date, items: [event] });
      }
    });
    return groups;
  }, [events]);

  const getIcon = (type: string) => {
    switch (type) {
      case "task": return <CheckCircle2 className="h-4 w-4 text-info" />;
      case "project_start": return <FolderKanban className="h-4 w-4 text-success" />;
      case "project_end": return <FolderKanban className="h-4 w-4 text-warning" />;
      default: return <CalendarIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <CalendarIcon className="h-8 w-8" />
        {t("nav.calendar", "التقويم")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("calendar.upcoming", "المواعيد القادمة")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", "جاري التحميل...")}</p>
          ) : groupedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("calendar.empty", "لا توجد مواعيد مسجلة")}</p>
          ) : (
            <div className="space-y-6">
              {groupedEvents.map((group, idx) => (
                <div key={idx} className="relative">
                  <div className="sticky top-14 z-10 bg-card py-2 border-b mb-3">
                    <h3 className="font-semibold text-primary capitalize flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                      {format(group.date, "EEEE, d MMMM yyyy", { locale: i18n.language === 'ar' ? ar : enUS })}
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map(ev => (
                      <div key={ev.id} className="p-3 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {getIcon(ev.type)}
                            <Badge variant="outline" className="text-[10px] uppercase font-normal">{t(`calendar.types.${ev.type}`, { defaultValue: ev.type })}</Badge>
                          </div>
                          <p className="font-medium">{ev.title}</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                           <Badge variant="secondary" className="text-[10px]">{ev.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemCalendar;
