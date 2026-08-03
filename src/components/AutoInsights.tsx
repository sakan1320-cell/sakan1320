import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, UserX, Clock, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface Insight {
  id: string;
  type: "warning" | "info" | "danger";
  icon: React.ElementType;
  title: string;
  description: string;
  recommendation?: string;
}

interface AutoInsightsProps {
  projectId?: string;
}

export const AutoInsights = ({ projectId }: AutoInsightsProps) => {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list: Insight[] = [];
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);

      // 1) Attendance drop this week vs previous
      let attThisQuery = supabase.from("attendance").select("status").gte("date", weekAgo);
      let attPrevQuery = supabase.from("attendance").select("status").gte("date", twoWeeksAgo).lt("date", weekAgo);
      
      if (projectId) {
        attThisQuery = attThisQuery.eq("project_id", projectId);
        attPrevQuery = attPrevQuery.eq("project_id", projectId);
      }
      
      const { data: attThis } = await attThisQuery;
      const { data: attPrev } = await attPrevQuery;

      const presentThis = (attThis ?? []).filter((a: any) => a.status === "present").length;
      const totalThis = (attThis ?? []).length;
      const presentPrev = (attPrev ?? []).filter((a: any) => a.status === "present").length;
      const totalPrev = (attPrev ?? []).length;
      const rateThis = totalThis ? presentThis / totalThis : 0;
      const ratePrev = totalPrev ? presentPrev / totalPrev : 0;
      if (totalPrev > 0 && rateThis < ratePrev - 0.1) {
        list.push({
          id: "att_drop",
          type: "warning",
          icon: TrendingDown,
          title: t("insights.attDrop", "انخفاض في الحضور هذا الأسبوع"),
          description: t("insights.attDropDesc", "نسبة الحضور انخفضت بمقدار {{n}}% مقارنة بالأسبوع السابق", {
            n: Math.round((ratePrev - rateThis) * 100),
          }),
          recommendation: t("insights.attDropRec", "ينصح بإرسال تنبيهات للمشاركين المتغيبين"),
        });
      }

      // 2) Overdue tasks
      const todayStr = today.toISOString().slice(0, 10);
      let overdueQuery = supabase
        .from("tasks").select("id", { count: "exact", head: true })
        .lt("due_date", todayStr).neq("status", "completed");
        
      if (projectId) {
        overdueQuery = overdueQuery.eq("project_id", projectId);
      }
      const { count: overdue } = await overdueQuery;
      
      if ((overdue ?? 0) > 0) {
        list.push({
          id: "overdue",
          type: "danger",
          icon: Clock,
          title: t("insights.overdue", "مهام متأخرة"),
          description: t("insights.overdueDesc", "{{n}} مهمة تجاوزت تاريخ الاستحقاق", { n: overdue }),
          recommendation: t("insights.overdueRec", "ينصح بمراجعة المهام وإعادة جدولتها"),
        });
      }

      // 3) Inactive participants (no attendance for 30 days)
      const monthAgo = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      let partsQuery = supabase
        .from("participants").select("id, full_name, status").eq("status", "active");
        
      if (projectId) {
        partsQuery = partsQuery.eq("project_id", projectId);
      }
      const { data: parts } = await partsQuery;
      
      const ids = (parts ?? []).map((p: any) => p.id);
      if (ids.length) {
        let recentQuery = supabase
          .from("attendance").select("subject_id").in("subject_id", ids).gte("date", monthAgo);
        if (projectId) {
          recentQuery = recentQuery.eq("project_id", projectId);
        }
        const { data: recent } = await recentQuery;
        
        const recentSet = new Set((recent ?? []).map((r: any) => r.subject_id));
        const inactive = (parts ?? []).filter((p: any) => !recentSet.has(p.id));
        if (inactive.length > 0) {
          list.push({
            id: "inactive",
            type: "warning",
            icon: UserX,
            title: t("insights.inactive", "مشاركون غير نشطين"),
            description: t("insights.inactiveDesc", "{{n}} مشارك بدون حضور خلال آخر 30 يومًا", { n: inactive.length }),
            recommendation: t("insights.inactiveRec", "ينصح بالتواصل وإضافة نشاط جديد"),
          });
        }
      }

      // 4) Stuck projects (active but no recent tasks completion)
      let projQuery = supabase
        .from("projects").select("id, name_ar").eq("status", "in_progress");
      if (projectId) {
        projQuery = projQuery.eq("id", projectId);
      }
      const { data: projects } = await projQuery;
      
      for (const p of (projects ?? []) as any[]) {
        const { count: recentDone } = await supabase
          .from("tasks").select("id", { count: "exact", head: true })
          .eq("project_id", p.id).eq("status", "completed").gte("updated_at", monthAgo);
        const { count: total } = await supabase
          .from("tasks").select("id", { count: "exact", head: true }).eq("project_id", p.id);
        if ((total ?? 0) > 5 && (recentDone ?? 0) === 0) {
          list.push({
            id: `stuck_${p.id}`,
            type: "danger",
            icon: AlertTriangle,
            title: t("insights.stuck", "مشروع متعثّر"),
            description: t("insights.stuckDesc", 'لم يتم إنجاز أي مهمة في "{{name}}" خلال 30 يومًا', { name: p.name_ar }),
            recommendation: t("insights.stuckRec", "ينصح بمراجعة المشروع مع المدير"),
          });
        }
      }

      setInsights(list);
      setLoading(false);
    })();
  }, [t, projectId]);

  if (loading) return <div className="text-center text-xs py-4 text-muted-foreground">{t("common.loading", "جاري التحليل...")}</div>;
  if (insights.length === 0) {
    return (
      <Card className="border shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            {t("insights.title", "رؤى تلقائية")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("insights.allGood", "كل المؤشرات ضمن المعدل الطبيعي لهذا المشروع ✅")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          {t("insights.title", "رؤى تلقائية")}
          <Badge variant="secondary">{insights.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((i) => {
          const Icon = i.icon;
          const color = i.type === "danger" ? "text-destructive" : i.type === "warning" ? "text-warning" : "text-primary";
          return (
            <div key={i.id} className="flex gap-3 rounded-md border p-3 bg-background">
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
              <div className="space-y-1">
                <div className="font-medium text-sm">{i.title}</div>
                <div className="text-xs text-muted-foreground">{i.description}</div>
                {i.recommendation && (
                  <div className="text-xs text-primary">💡 {i.recommendation}</div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
