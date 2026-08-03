import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, AreaChart, Area, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { 
  FolderKanban, 
  Building2, 
  UserCheck, 
  Wallet, 
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target
} from "lucide-react";
import { OperationalToday } from "@/components/OperationalToday";

interface Stats {
  projects: number; branches: number; tasks: number; myTasks: number;
  completed: number; users: number; participants: number; notificationsWeek: number;
  income: number; expense: number;
  enrollments: number; certificates: number; courses: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, hasAnyRole } = useAuth();
  const isRtl = i18n.language === "ar";
  
  const [stats, setStats] = useState<Stats>({ projects: 0, branches: 0, tasks: 0, myTasks: 0, completed: 0, users: 0, participants: 0, notificationsWeek: 0, income: 0, expense: 0, enrollments: 0, certificates: 0, courses: 0 });
  const [recentProjects, setRecentProjects] = useState<Array<{ id: string; name_ar: string; name_en: string | null; status: string }>>([]);
  const [myTasks, setMyTasks] = useState<Array<{ id: string; title: string; status: string; due_date: string | null }>>([]);
  const [tasksByStatus, setTasksByStatus] = useState<Array<{ name: string; value: number }>>([]);
  const [financeByDay, setFinanceByDay] = useState<Array<{ date: string; income: number; expense: number }>>([]);

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const tables = ["participants", "projects", "lms_courses", "lms_learning_paths", "messages", "support_tickets", "audit_log"];
      const results = await Promise.all(
        tables.map(async (table) => {
          const { error } = await supabase.from(table).select("count", { count: "exact", head: true });
          return { table, status: error ? "missing" : "ok" };
        })
      );
      const missing = results.filter(r => r.status === "missing").map(r => r.table);
      return { ok: missing.length === 0, missing, total: tables.length, available: tables.length - missing.length };
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const load = async () => {
      const days = 0;
      const fromDate = new Date(Date.now() - days * 86400000).toISOString();
      const fromDateOnly = fromDate.slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [pj, br, tk, mine, done, pa, nt, allTasks, fin, en, cert, co] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("project_branches").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", user!.id).neq("status", "completed"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("tasks").select("status"),
        supabase.from("finance_transactions").select("transaction_date, direction, amount"),
        supabase.from("lms_enrollments").select("id", { count: "exact", head: true }),
        supabase.from("lms_certificates").select("id", { count: "exact", head: true }),
        supabase.from("lms_courses").select("id", { count: "exact", head: true }),
      ]);

      let usersCount = 0;
      if (isAdmin) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        usersCount = count ?? 0;
      }

      const income = (fin.data ?? []).filter((r: any) => r.direction === "income").reduce((s: number, r: any) => s + Number(r.amount), 0);
      const expense = (fin.data ?? []).filter((r: any) => r.direction === "expense").reduce((s: number, r: any) => s + Number(r.amount), 0);

      setStats({
        projects: pj.count ?? 0, branches: br.count ?? 0, tasks: tk.count ?? 0,
        myTasks: mine.count ?? 0, completed: done.count ?? 0, users: usersCount,
        participants: pa.count ?? 0, notificationsWeek: nt.count ?? 0, income, expense,
        enrollments: en.count ?? 0, certificates: cert.count ?? 0, courses: co.count ?? 0,
      });

      const tm: Record<string, number> = {};
      (allTasks.data ?? []).forEach((tk: any) => tm[tk.status] = (tm[tk.status] ?? 0) + 1);
      setTasksByStatus(Object.entries(tm).map(([k, v]) => ({ name: t(`tasks.statuses.${k}`), value: v })));

      const fmap: Record<string, { date: string; income: number; expense: number }> = {};
      const recentFin = (fin.data ?? []).filter((r: any) => r.transaction_date >= fromDateOnly);
      recentFin.forEach((r: any) => {
        if (!fmap[r.transaction_date]) fmap[r.transaction_date] = { date: r.transaction_date, income: 0, expense: 0 };
        fmap[r.transaction_date][r.direction as "income" | "expense"] += Number(r.amount);
      });
      setFinanceByDay(Object.values(fmap).sort((a, b) => a.date.localeCompare(b.date)));

      const { data: pjList } = await supabase.from("projects").select("id, name_ar, name_en, status").order("created_at", { ascending: false }).limit(5);
      setRecentProjects(pjList ?? []);
      const { data: tkList } = await supabase.from("tasks").select("id, title, status, due_date").eq("assignee_id", user!.id).neq("status", "completed").order("due_date", { ascending: true, nullsFirst: false }).limit(5);
      setMyTasks(tkList ?? []);
    };
    if (user) load();
  }, [user, isAdmin, t]);

  return (
    <div className="space-y-3 p-2 md:p-4 animate-in fade-in duration-700 bg-background/50">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            أهلاً بك، {user?.email?.split('@')[0] || t("common.user")}
          </h1>
        </div>
      </div>

      {healthLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse mb-2">
          <Activity className="h-4 w-4 animate-spin" /> جاري التحقق من سلامة النظام...
        </div>
      )}

      {/* Operational Today */}
      <div className="p-3 md:p-4 rounded-3xl overflow-hidden shadow-sm border bg-card/40 backdrop-blur-md">
        <OperationalToday />
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        
        {/* Finance Overview (Span 2) */}
        {hasAnyRole(["executive", "assistant", "board"]) && (
        <Card className="col-span-1 md:col-span-2 lg:col-span-2 overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-gradient-to-br from-card to-muted/20 rounded-3xl relative">
          <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              المؤشرات المالية
              <div className="bg-background p-2 rounded-full shadow-sm">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-6">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">صافي الرصيد الحالي</p>
                <p className="text-5xl font-black text-foreground tracking-tight">{(stats.income - stats.expense).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3 pb-1">
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm">
                  <ArrowUpRight className="h-4 w-4" /> {stats.income.toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 text-red-700 bg-red-100/80 px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm">
                  <ArrowDownRight className="h-4 w-4" /> {stats.expense.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="h-[180px] w-full mt-4">
              {financeByDay.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground/60 text-sm font-medium bg-muted/10 rounded-2xl border border-dashed">لم تُسجل أي حركات مالية اليوم</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financeByDay} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* My Tasks (Span 1 or 2) */}
        <Card className="col-span-1 md:col-span-1 lg:col-span-2 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              المهام قيد التنفيذ
              <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 px-3">{stats.myTasks}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">لا توجد مهام تتطلب إجراءً حالياً.</p>
              </div>
            ) : null}
            {myTasks.slice(0, 4).map(tk => (
              <Link key={tk.id} to="/tasks" className="group flex items-start gap-4 p-4 rounded-2xl hover:bg-muted/60 hover:shadow-sm transition-all border border-transparent hover:border-border/50">
                <div className="mt-0.5 bg-primary/10 p-2.5 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
                  <Target className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors truncate">{tk.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground font-medium">
                    <Clock className="h-3.5 w-3.5 opacity-70" />
                    <span>{tk.due_date || "بدون تاريخ استحقاق"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Micro-Stats Bento Blocks */}
        <div className="col-span-1 md:col-span-3 lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 p-6 rounded-3xl flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-sm border border-blue-100 dark:border-blue-800/30">
            <div className="bg-white dark:bg-blue-900/50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-6">
              <FolderKanban className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-blue-800/70 dark:text-blue-300 font-bold mb-1">{t("dashboard.stats.projects")}</p>
              <p className="text-4xl font-black text-blue-900 dark:text-blue-100">{stats.projects}</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 p-6 rounded-3xl flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-sm border border-amber-100 dark:border-amber-800/30">
            <div className="bg-white dark:bg-amber-900/50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-6">
              <UserCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-amber-800/70 dark:text-amber-300 font-bold mb-1">{t("nav.participants")}</p>
              <p className="text-4xl font-black text-amber-900 dark:text-amber-100">{stats.participants}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 p-6 rounded-3xl flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-sm border border-emerald-100 dark:border-emerald-800/30">
            <div className="bg-white dark:bg-emerald-900/50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-6">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-800/70 dark:text-emerald-300 font-bold mb-1">المهام المنجزة</p>
              <p className="text-4xl font-black text-emerald-900 dark:text-emerald-100">{stats.completed}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 p-6 rounded-3xl flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-sm border border-purple-100 dark:border-purple-800/30">
            <div className="bg-white dark:bg-purple-900/50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-6">
              <UserCheck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-purple-800/70 dark:text-purple-300 font-bold mb-1">{isRtl ? "المستخدمين" : "Users"}</p>
              <p className="text-4xl font-black text-purple-900 dark:text-purple-100">{stats.users}</p>
            </div>
          </div>
        </div>

        {/* Projects Overview (Span 2) */}
        {hasAnyRole(["executive", "assistant", "board", "project_manager", "branch_manager"]) && (
        <Card className="col-span-1 md:col-span-1 lg:col-span-2 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg"><FolderKanban className="h-4 w-4 text-primary" /></div>
              المشاريع الجارية
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                {recentProjects.length === 0 && (
                  <div className="py-8 text-center bg-muted/20 rounded-xl border border-dashed text-muted-foreground font-medium text-sm">
                    لا توجد مشاريع مضافة مؤخراً
                  </div>
                )}
                {recentProjects.slice(0,4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-sm border border-border/50">
                        <FolderKanban className="h-5 w-5 text-muted-foreground/70" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground/90">{isRtl ? p.name_ar : (p.name_en || p.name_ar)}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                           <p className="text-xs text-muted-foreground font-medium">{t(`projects.statuses.${p.status}`)}</p>
                        </div>
                      </div>
                    </div>
                    <Link to={`/projects/${p.id}`} className="text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors">
                      التفاصيل
                    </Link>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
        )}

        {/* Tasks Chart (Span 2) */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-2 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card rounded-3xl flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg"><Activity className="h-4 w-4 text-primary" /></div>
              تحليل سير المهام
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center pb-6">
            {tasksByStatus.length === 0 ? (
              <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-muted/20 rounded-2xl border border-dashed text-muted-foreground font-medium text-sm">
                لا تتوفر بيانات لعرض التحليل
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={tasksByStatus} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={70} outerRadius={90} paddingAngle={8} stroke="none" cornerRadius={6}>
                    {tasksByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                    itemStyle={{ fontWeight: 'bold', color: '#333' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: '600', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
};

export default Dashboard;
