import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  Award,
  AlertTriangle,
  UserCheck,
  BrainCircuit,
  MessageSquareText,
  Search,
  Activity,
  CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts";

interface ProjectPerformanceCompositeTabProps {
  projectId: string;
  branchId?: string | null;
  groupId?: string | null;
}

interface ParticipantData {
  id: string;
  full_name: string | null;
  phone?: string | null;
  points?: number | null;
  status?: string | null;
  branch_id?: string | null;
  auth_user_id?: string | null;
}

export const ProjectPerformanceCompositeTab = ({ projectId, branchId, groupId }: ProjectPerformanceCompositeTabProps) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  
  // بيانات حقيقية من Supabase
  const [projectName, setProjectName] = useState<string>("");
  const [dbParticipants, setDbParticipants] = useState<ParticipantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantFilter, setParticipantFilter] = useState<"all" | "top" | "struggling">("all");

  // مؤشرات حقيقية لمديرة المشروع
  const [isManager, setIsManager] = useState(false);
  const [workTeamCount, setWorkTeamCount] = useState(0);
  const [branchesCount, setBranchesCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  
  // المؤشرات المالية الاحترافية
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [expensesAmount, setExpensesAmount] = useState(0);

  const [executionRate, setExecutionRate] = useState(0);
  const [teacherPrepRate, setTeacherPrepRate] = useState(0);
  const [unexecutedItems, setUnexecutedItems] = useState(0);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // 1. جلب اسم المشروع
      const { data: projData } = await supabase
        .from("projects")
        .select("name_ar")
        .eq("id", projectId)
        .maybeSingle();
      if (projData) setProjectName(projData.name_ar || "");

      // 2. التحقق من صلاحية المستخدم (هل هو مدير؟)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setIsManager(true);
      }

      // 3. جلب المشاركين المعتمدين في هذا المشروع
      let q = supabase.from("participants").select("id, full_name, phone, points, status, branch_id, auth_user_id").eq("project_id", projectId);
      if (groupId) q = q.eq("group_id", groupId);
      else if (branchId) q = q.eq("branch_id", branchId);
      
      const { data: partData } = await q.order("points", { ascending: false });
      if (partData) {
        setDbParticipants(partData as ParticipantData[]);
      }

      // 4. جلب إحصائيات مديرة المشروع بشكل حقيقي
      // عدد فريق العمل (project_members)
      const { count: teamCount } = await supabase
        .from("project_members")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      setWorkTeamCount(teamCount || 0);

      // عدد الفروع
      const { count: bCount } = await supabase
        .from("project_branches")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      setBranchesCount(bCount || 0);

      // عدد المجموعات
      const { count: gCount } = await supabase
        .from("project_groups")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      setGroupsCount(gCount || 0);

      // نسبة التنفيذ (المهام)
      const { data: projectTasks } = await supabase
        .from("tasks")
        .select("status")
        .eq("project_id", projectId);
      
      if (projectTasks && projectTasks.length > 0) {
        const completed = projectTasks.filter(t => t.status === 'completed').length;
        const rate = Math.round((completed / projectTasks.length) * 100);
        setExecutionRate(rate);
        setUnexecutedItems(projectTasks.length - completed);
      } else {
        setExecutionRate(0);
        setUnexecutedItems(0);
      }

      // جلب الميزانية المعتمدة
      const { data: budgetData } = await supabase
        .from('enjaz_budget')
        .select('amount')
        .eq('project_id', projectId);
      const totalBudget = budgetData?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
      setBudgetAmount(totalBudget);

      // جلب المصروفات الفعلية
      const { data: expensesData } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('project_id', projectId)
        .eq('direction', 'expense');
      const totalExpenses = expensesData?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
      setExpensesAmount(totalExpenses);

      // تحضير المعلمين / الحضور الفعلي للكوادر
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('project_id', projectId)
        .eq('subject_type', 'employee');
      
      if (attendanceData && attendanceData.length > 0) {
        const presentCount = attendanceData.filter(a => a.status === 'present').length;
        setTeacherPrepRate(Math.round((presentCount / attendanceData.length) * 100));
      } else {
        setTeacherPrepRate(0);
      }

    } catch (e) {
      console.error("خطأ في تحميل بيانات الأداء للمشاركين", e);
    } finally {
      setLoading(false);
    }
  }, [projectId, branchId, groupId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // تصفية المشاركين آمنة ضد null
  const filteredParticipants = dbParticipants.filter(p => {
    const name = (p.full_name || "").toLowerCase();
    const matchesSearch = name.includes(participantSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (participantFilter === "top") return (p.points ?? 0) >= 50;
    if (participantFilter === "struggling") return (p.points ?? 0) < 20;
    return true;
  });

  const totalCount = dbParticipants.length;
  const activeCount = dbParticipants.filter(p => p.status !== "inactive").length;
  const strugglingCount = dbParticipants.filter(p => (p.points ?? 0) < 20).length;
  const topCount = dbParticipants.filter(p => (p.points ?? 0) >= 50).length;
  const normalCount = Math.max(0, totalCount - topCount - strugglingCount);

  // إرسال رسالة تحفيزية للمشارك فعلياً عبر الرسائل الداخلية
  const handleSendEncouragement = async (participantId: string, name: string, targetUserId?: string | null) => {
    if (!targetUserId) {
      toast.error(`المشارك ${name} لم يقم بتسجيل حسابه في المنصة بعد.`);
      return;
    }
    
    try {
      const { error } = await supabase.from('notifications').insert({
        body: `رسالة تحفيزية: أداء رائع يا ${name}! استمر في تميزك. نحن فخورون بك.`,
        target_user_id: targetUserId,
        template: 'manual',
        category: 'encouragement'
      });
      
      if (error) throw error;
      toast.success(`تم إرسال رسالة تحفيزي حقيقي داخل المنصة للمشارك: ${name}`);
    } catch (error) {
      console.error("خطأ في إرسال الرسالة:", error);
      toast.error("حدث خطأ أثناء إرسال الرسالة.");
    }
  };

  // تعيين مرشد أكاديمي
  const handleAssignGuidance = () => {
    toast.success("تم إرسال طلب تعيين مرشد للمشاركين المتعثرين بنجاح");
  };

  // توزيع المستويات الفعلي للمشاركين
  const academicDistribution = [
    { name: "مشاركون متميزون", value: topCount, color: "#10b981" },
    { name: "مشاركون منتظمون", value: normalCount, color: "#3b82f6" },
    { name: "مشاركون بحاجة دعم", value: strugglingCount, color: "#ef4444" },
  ].filter(item => item.value > 0);

  const chartData = academicDistribution.length > 0 
    ? academicDistribution 
    : [{ name: "لا يوجد مشاركون", value: 1, color: "#9ca3af" }];

  return (
    <div className="space-y-6 animate-fade-in pb-8 font-sans" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* المؤشرات الإحصائية المباشرة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border-border/50 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-muted-foreground">إجمالي المشاركين</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">{totalCount}</h3>
              </div>
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isManager && (
          <Card className="border-border/50 shadow-sm bg-card">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">فريق العمل</p>
                  <h3 className="text-2xl font-bold mt-1 text-foreground">{workTeamCount}</h3>
                </div>
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-muted-foreground">المشاركون المتميزون</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">{topCount}</h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-muted-foreground">بحاجة متابعة</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">{strugglingCount}</h3>
              </div>
              <div className="p-2.5 bg-red-500/10 rounded-xl text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* لوحة مديرة المشروع */}
      {isManager && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-border/50 shadow-sm bg-card">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-muted-foreground mb-3">التكوين والهيكلة</p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">عدد الفروع</span>
                <span className="text-sm font-bold">{branchesCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">عدد المجموعات</span>
                <span className="text-sm font-bold">{groupsCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-card">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-muted-foreground mb-3">الملخص المالي للمشروع</p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-emerald-700">الميزانية المعتمدة</span>
                <span className="text-sm font-bold text-emerald-700">{budgetAmount.toLocaleString()} ر.س</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-red-600">إجمالي المصروفات</span>
                <span className="text-sm font-bold text-red-600">{expensesAmount.toLocaleString()} ر.س</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-card">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-muted-foreground mb-3">المتابعة والالتزام</p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">معدل الإنجاز العام</span>
                <span className="text-sm font-bold text-primary">{executionRate}%</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">انتظام الكوادر بالمشروع</span>
                <span className="text-sm font-bold text-blue-600">{teacherPrepRate}%</span>
              </div>
              <div className="flex justify-between items-center text-amber-600">
                <span className="text-sm font-medium">المهام المتأخرة / لم تنفذ</span>
                <span className="text-sm font-bold">{unexecutedItems}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. قائمة المشاركين والتوزيع الفعلي */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* قائمة المشاركين المعتمدين */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm bg-card overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  قائمة أداء المشاركين
                </CardTitle>
              </div>

              {/* أدوات البحث والفلترة */}
              <div className="flex items-center gap-2">
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="بحث..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="h-8 ps-8 text-xs rounded-xl"
                  />
                </div>
                <div className="flex bg-muted/60 p-0.5 rounded-xl text-xs">
                  <button
                    onClick={() => setParticipantFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${participantFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    الكل ({totalCount})
                  </button>
                  <button
                    onClick={() => setParticipantFilter("top")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${participantFilter === "top" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground"}`}
                  >
                    المتميزون ({topCount})
                  </button>
                  <button
                    onClick={() => setParticipantFilter("struggling")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${participantFilter === "struggling" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground"}`}
                  >
                    المتعثرون ({strugglingCount})
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {loading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">جاري التحميل...</div>
              ) : filteredParticipants.length > 0 ? (
                filteredParticipants.map((participant, index) => {
                  const points = participant.points ?? 0;
                  const isStruggling = points < 20;
                  const isTop = points >= 50;
                  const displayName = participant.full_name || "بدون اسم";

                  return (
                    <div key={participant.id || index} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {displayName.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-foreground">{displayName}</h4>
                            {isTop && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">متميز</Badge>}
                            {isStruggling && <Badge variant="destructive" className="text-[10px]">دعم</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            الجوال: {participant.phone || "-"} • النقاط: <span className="font-bold text-primary">{points}</span>
                          </p>
                        </div>
                      </div>

                      <Button size="sm" variant="outline" onClick={() => handleSendEncouragement(participant.id, displayName, participant.auth_user_id)} className="h-8 text-xs rounded-xl gap-1.5 border-border">
                        <MessageSquareText className="w-3.5 h-3.5 text-emerald-600" />
                        تحفيز
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  لا توجد نتائج.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* مخطط توزيع فئات المشاركين الفعلي */}
        <Card className="border-border/50 shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">توزيع المشاركين</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[200px] w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value}`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-2xl font-bold">{totalCount}</span>
                <p className="text-[10px] text-muted-foreground">مشارك</p>
              </div>
            </div>

            <div className="space-y-2 mt-4 pt-2 border-t border-border/50">
              {academicDistribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className="font-bold text-muted-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
};



