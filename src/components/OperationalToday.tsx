import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, AlertTriangle, UserX, Bell } from "lucide-react";
import { Link } from "react-router-dom";

interface TodayStats {
  attendanceToday: number;
  overdueTasks: number;
  inactiveParticipants: number;
  notificationsToday: number;
}

export const OperationalToday = () => {
  const { t } = useTranslation();
  const [s, setS] = useState<TodayStats>({ attendanceToday: 0, overdueTasks: 0, inactiveParticipants: 0, notificationsToday: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      const [att, ov, inact, nt] = await Promise.all([
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).lt("due_date", today).neq("status", "completed"),
        supabase.from("participants").select("id", { count: "exact", head: true }).neq("status", "active"),
        supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", startToday.toISOString()),
      ]);
      setS({
        attendanceToday: att.count ?? 0,
        overdueTasks: ov.count ?? 0,
        inactiveParticipants: inact.count ?? 0,
        notificationsToday: nt.count ?? 0,
      });
    })();
  }, []);

  const Item = ({ icon: Icon, label, value, color, to }: any) => (
    <Link to={to} className="block">
      <Card className="shadow-card hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-3 p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground truncate">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t("dashboard.today.title")}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Item icon={CalendarCheck} label={t("dashboard.today.attendance")} value={s.attendanceToday} color="bg-success/10 text-success" to="/attendance" />
        <Item icon={AlertTriangle} label={t("dashboard.today.overdue")} value={s.overdueTasks} color="bg-destructive/10 text-destructive" to="/tasks" />
        <Item icon={UserX} label={t("dashboard.today.inactive")} value={s.inactiveParticipants} color="bg-warning/10 text-warning" to="/participants" />
        <Item icon={Bell} label={t("dashboard.today.notifs")} value={s.notificationsToday} color="bg-info/10 text-info" to="/notifications" />
      </div>
    </div>
  );
};
