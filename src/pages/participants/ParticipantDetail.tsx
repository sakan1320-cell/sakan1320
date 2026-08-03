import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Phone, IdCard, Star, CheckCircle2, XCircle, ClipboardList, GraduationCap, Award, Loader2, TrendingUp, KeyRound, FolderOpen, Plus, X } from "lucide-react";
import { GamificationPanel } from "@/components/GamificationPanel";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Participant {
  id: string; full_name: string; national_id: string | null; phone: string | null;
  status: string; points: number; project_id: string | null; branch_id: string | null;
  group_id: string | null;
  guardian_name: string | null; guardian_phone: string | null;
  date_of_birth: string | null; gender: string | null; auth_user_id: string | null; staff_user_id: string | null;
}
interface Project { id: string; name_ar: string; name_en: string | null; }
interface Branch { id: string; name_ar: string; }
interface Group { id: string; name_ar: string; }
interface AttRow { id: string; status: string; date: string; }
interface PointRow { id: string; delta: number; reason: string | null; created_at: string; }
interface TaskRow { id: string; title: string; status: string; due_date: string | null; }
interface Enrollment { id: string; course_id: string; status: string; progress: number; enrolled_at: string; }
interface Course { id: string; title_ar: string; title_en: string | null; }
interface ParticipantProject { id: string; project_id: string; joined_at: string; project?: Project; }

const ParticipantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [p, setP] = useState<Participant | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [points, setPoints] = useState<PointRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [enrollments, setEnrollments] = useState<(Enrollment & { course?: Course })[]>([]);
  const [certCount, setCertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [linkedProjects, setLinkedProjects] = useState<ParticipantProject[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false);
  const [selectedProjectToAdd, setSelectedProjectToAdd] = useState<string>("");

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    const { data: pr } = await supabase.from("participants").select("*").eq("id", id).maybeSingle();
    if (!pr) { setLoading(false); return; }
    setP(pr as Participant);

    const promises: any[] = [
      supabase.from("attendance").select("id,status,date").eq("subject_id", pr.id).order("date", { ascending: false }).limit(100),
      supabase.from("participant_points_log").select("id,delta,reason,created_at").eq("participant_id", pr.id).order("created_at", { ascending: false }).limit(50),
    ];
    promises.unshift(
      pr.project_id
        ? supabase.from("projects").select("id,name_ar,name_en").eq("id", pr.project_id).maybeSingle()
        : Promise.resolve({ data: null })
    );

    // Load branch name
    if (pr.branch_id) {
      const { data: brData } = await supabase.from("project_branches").select("id,name_ar").eq("id", pr.branch_id).maybeSingle();
      setBranch(brData as Branch | null);
    } else {
      setBranch(null);
    }

    // Load group name
    if (pr.group_id) {
      const { data: grData } = await supabase.from("project_groups").select("id,name_ar").eq("id", pr.group_id).maybeSingle();
      setGroup(grData as Group | null);
    } else {
      setGroup(null);
    }

    // Load linked projects from participant_projects
    const { data: ppLinks } = await supabase.from("participant_projects").select("id,project_id,joined_at").eq("participant_id", pr.id);
    if (ppLinks && ppLinks.length > 0) {
      const projectIds = ppLinks.map(l => l.project_id);
      const { data: projectsData } = await supabase.from("projects").select("id,name_ar,name_en").in("id", projectIds);
      const projMap = new Map((projectsData ?? []).map(p => [p.id, p]));
      setLinkedProjects(ppLinks.map(l => ({ ...l, project: projMap.get(l.project_id) as Project | undefined })));
    } else {
      setLinkedProjects([]);
    }

    // Load all projects for the add dialog
    const { data: allPrj } = await supabase.from("projects").select("id,name_ar,name_en");
    setAllProjects((allPrj ?? []) as Project[]);
    const linkedUid = pr.staff_user_id || pr.auth_user_id;
    if (linkedUid) {
      promises.push(supabase.from("tasks").select("id,title,status,due_date").eq("assignee_id", linkedUid).order("created_at", { ascending: false }).limit(50));
      promises.push(supabase.from("lms_enrollments").select("id,course_id,status,progress,enrolled_at").eq("user_id", linkedUid).order("enrolled_at", { ascending: false }));
      promises.push(supabase.from("lms_certificates").select("id", { count: "exact", head: true }).eq("user_id", linkedUid));
    }
    const res = await Promise.all(promises);
    setProject((res[0] as any).data ?? null);
    setAttendance(((res[1] as any).data ?? []) as AttRow[]);
    setPoints(((res[2] as any).data ?? []) as PointRow[]);
    if (linkedUid) {
      setTasks(((res[3] as any).data ?? []) as TaskRow[]);
      const ens = ((res[4] as any).data ?? []) as Enrollment[];
      setCertCount((res[5] as any).count ?? 0);
      if (ens.length) {
        const { data: cs } = await supabase.from("lms_courses").select("id,title_ar,title_en").in("id", ens.map((e) => e.course_id));
        const map = new Map((cs ?? []).map((c: any) => [c.id, c]));
        setEnrollments(ens.map((e) => ({ ...e, course: map.get(e.course_id) as Course | undefined })));
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const linkedUid = p?.staff_user_id || p?.auth_user_id;
    if (!linkedUid) return;
    if (newPassword.length < 6) {
      toast.error(t("auth.errors.weak_password", "يجب أن تكون كلمة المرور 6 أحرف على الأقل"));
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.rpc("admin_change_user_password", {
        target_user_id: linkedUid,
        new_password: newPassword
      });
      if (error) throw error;

      await logAudit("change_password", "participant", p.id);
      toast.success(t("common.success", "تم حفظ التغييرات بنجاح"));
      setPasswordDialogOpen(false);
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.message || t("common.error"));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!p) return <p className="text-sm text-muted-foreground">{t("common.notFound", "غير موجود")}</p>;

  const present = attendance.filter((a) => a.status === "present").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const overdueTasks = tasks.filter((tk) => tk.status !== "completed" && tk.due_date && new Date(tk.due_date) < new Date()).length;
  const completedCourses = enrollments.filter((e) => e.status === "completed").length;
  const projectName = project ? (i18n.language === "ar" ? project.name_ar : (project.name_en || project.name_ar)) : "—";
  const linkedUid = p.staff_user_id || p.auth_user_id;

  const handleAddProject = async () => {
    if (!selectedProjectToAdd || !p) return;
    const { error } = await supabase.from("participant_projects").insert({
      participant_id: p.id,
      project_id: selectedProjectToAdd,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("common.success", "تم حفظ التغييرات بنجاح"));
    setAddProjectDialogOpen(false);
    setSelectedProjectToAdd("");
    loadData();
  };

  const handleRemoveProject = async (linkId: string) => {
    const { error } = await supabase.from("participant_projects").delete().eq("id", linkId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("common.success", "تم حفظ التغييرات بنجاح"));
    loadData();
  };

  const availableProjectsToAdd = allProjects.filter(ap => !linkedProjects.some(lp => lp.project_id === ap.id));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("common.back")}
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{p.full_name}</h1>
            <Badge variant={p.status === "active" ? "default" : "outline"}>{t(`participants.statuses.${p.status}`, p.status)}</Badge>
            <Badge variant="secondary"><Star className="h-3 w-3 me-1" />{p.points} {t("participants.points", "نقطة")}</Badge>
          </div>
          {linkedUid && hasPermission("change_user_password") && (
            <Button size="sm" variant="outline" onClick={() => setPasswordDialogOpen(true)}>
              <KeyRound className="h-4 w-4 me-1" />{t("auth.changePassword", "تغيير الرمز السري")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {p.phone && <span dir="ltr"><Phone className="inline h-3 w-3 me-1" />{p.phone}</span>}
          {p.national_id && <span dir="ltr"><IdCard className="inline h-3 w-3 me-1" />{p.national_id}</span>}
        </div>
        {/* Linked Projects */}
        {linkedProjects.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {linkedProjects.map(lp => (
              <Link key={lp.id} to={`/projects/${lp.project_id}`}>
                <Badge variant="secondary" className="gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {lp.project ? (i18n.language === "ar" ? lp.project.name_ar : (lp.project.name_en || lp.project.name_ar)) : lp.project_id}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CheckCircle2} label={t("attendance.present", "الحضور")} value={`${present}/${attendance.length}`} />
        <Stat icon={TrendingUp} label={t("attendance.rate", "نسبة الالتزام")} value={`${rate}%`} />
        <Stat icon={ClipboardList} label={t("tasks.overdue", "مهام متأخرة")} value={overdueTasks} />
        <Stat icon={Award} label={t("lms.certificatesIssued", "الشهادات")} value={certCount} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t("projects.overview", "نظرة عامة")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("nav.attendance")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("projects.tasks", "المهام")}</TabsTrigger>
          <TabsTrigger value="lms">{t("dashboard.tabs.lms", "التعلم")}</TabsTrigger>
          <TabsTrigger value="points">{t("participants.points", "النقاط")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <Info label={t("participants.guardianShort", "ولي الأمر")} value={p.guardian_name || "—"} />
              <Info label={t("participants.guardianPhone", "هاتف ولي الأمر")} value={p.guardian_phone || "—"} />
              <Info label={t("participants.dob", "تاريخ الميلاد")} value={p.date_of_birth || "—"} />
              <Info label={t("participants.gender", "الجنس")} value={p.gender || "—"} />
              <Info label={t("participants.branch", "الفرع")} value={branch?.name_ar || "—"} />
              <Info label={t("participants.group", "المجموعة")} value={group?.name_ar || "—"} />
            </CardContent>
          </Card>

          {/* المشاريع المرتبطة */}
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t("projects.title", "المشاريع")}</CardTitle>
              {availableProjectsToAdd.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setAddProjectDialogOpen(true)}>
                  <Plus className="h-4 w-4 me-1" />{t("common.add", "إضافة")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {linkedProjects.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("participants.noProject", "بدون مشروع")}</p>
              ) : (
                <div className="divide-y">
                  {linkedProjects.map(lp => (
                    <div key={lp.id} className="flex items-center justify-between p-3">
                      <Link to={`/projects/${lp.project_id}`} className="flex items-center gap-2 hover:text-primary">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                          {lp.project ? (i18n.language === "ar" ? lp.project.name_ar : (lp.project.name_en || lp.project.name_ar)) : lp.project_id}
                        </span>
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(lp.joined_at).toLocaleDateString()}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemoveProject(lp.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card><CardContent className="p-0">
            {attendance.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t("common.none")}</p> :
              <div className="divide-y">
                {attendance.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3">
                    <span className="text-sm">{a.date}</span>
                    <Badge variant={a.status === "present" ? "default" : a.status === "absent" ? "destructive" : "outline"}>
                      {t(`attendance.statuses.${a.status}`, a.status)}
                    </Badge>
                  </div>
                ))}
              </div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card><CardContent className="p-0">
            {tasks.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t("tasks.noTasksAssigned", "لا توجد مهام مسندة")}</p> :
              <div className="divide-y">
                {tasks.map((tk) => (
                  <div key={tk.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{tk.title}</div>
                      {tk.due_date && <div className="text-xs text-muted-foreground">{tk.due_date}</div>}
                    </div>
                    <Badge variant={tk.status === "completed" ? "default" : "outline"}>{t(`tasks.statuses.${tk.status}`, tk.status)}</Badge>
                  </div>
                ))}
              </div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="lms">
          <Card><CardContent className="p-0">
            {enrollments.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t("lms.noEnrollments", "لم يسجّل في أي دورة")}</p> :
              <div className="divide-y">
                {enrollments.map((e) => (
                  <Link key={e.id} to={`/courses/${e.course_id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.course ? (i18n.language === "ar" ? e.course.title_ar : (e.course.title_en || e.course.title_ar)) : e.course_id}</div>
                      <div className="text-xs text-muted-foreground">{t("lms.progress", "التقدم")}: {e.progress}%</div>
                    </div>
                    <Badge variant={e.status === "completed" ? "default" : "outline"}>{e.status}</Badge>
                  </Link>
                ))}
              </div>}
          </CardContent></Card>
          <p className="mt-2 text-xs text-muted-foreground">{completedCourses} {t("lms.completed", "أكمل")} · {certCount} {t("lms.certificatesIssued", "شهادة")}</p>
        </TabsContent>

        <TabsContent value="points" className="space-y-6 pt-2">
          {p.project_id ? (
            <GamificationPanel
              participantId={p.id}
              projectId={p.project_id}
              points={p.points}
              onPointsUpdated={loadData}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t("participants.noProject", "بدون مشروع")}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("participants.pointsHistory", "سجل حركة النقاط")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {points.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{t("common.none")}</p> :
                <div className="divide-y">
                  {points.map((pt) => (
                    <div key={pt.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{pt.reason || "—"}</div>
                        <div className="text-xs text-muted-foreground">{new Date(pt.created_at).toLocaleString()}</div>
                      </div>
                      <span className={pt.delta >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>{pt.delta >= 0 ? "+" : ""}{pt.delta}</span>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handlePasswordChange}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                {t("auth.changePassword", "تغيير الرمز السري")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("common.email", "البريد الإلكتروني")}</Label>
                <Input value={p?.email || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass">{t("auth.newPassword", "الرمز السري الجديد")}</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={changingPassword}>
                {t("common.cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {t("common.save", "حفظ")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Project Dialog */}
      <Dialog open={addProjectDialogOpen} onOpenChange={setAddProjectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {t("participants.addProject", "إضافة مشروع")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("projects.title", "المشاريع")}</Label>
              <Select value={selectedProjectToAdd} onValueChange={setSelectedProjectToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder={t("participants.selectProject", "اختر مشروعاً")} />
                </SelectTrigger>
                <SelectContent>
                  {availableProjectsToAdd.map(pr => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {i18n.language === "ar" ? pr.name_ar : (pr.name_en || pr.name_ar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddProjectDialogOpen(false)}>
              {t("common.cancel", "إلغاء")}
            </Button>
            <Button onClick={handleAddProject} disabled={!selectedProjectToAdd}>
              {t("common.add", "إضافة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) => (
  <Card><CardContent className="flex items-center gap-3 p-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
    <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-bold">{value}</div></div>
  </CardContent></Card>
);

const Info = ({ label, value }: { label: string; value: string }) => (
  <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>
);

export default ParticipantDetail;

