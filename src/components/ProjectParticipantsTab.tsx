import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, ArrowRightLeft, UserCheck, UserX, Award, ShieldAlert, MoreHorizontal, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ParticipantFormDialog, ParticipantRow } from "@/components/ParticipantFormDialog";
import { ProjectAttendanceTab } from "./ProjectAttendanceTab";
import { ProjectEnjazTab } from "./ProjectEnjazTab";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface ProjectParticipantsTabProps {
  projectId: string;
  branchId?: string | null;
  groupId?: string | null;
  isManager?: boolean;
}

interface RegistrationRequest {
  id: string;
  full_name: string;
  phone: string | null;
  national_id: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Project {
  id: string;
  name_ar: string;
  name_en: string | null;
}

export const ProjectParticipantsTab = ({ projectId, branchId, groupId, isManager = true }: ProjectParticipantsTabProps) => {
  const { t, i18n } = useTranslation();
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState("attendance");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialogNode } = useConfirm();

  // Form Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantRow | null>(null);

  // Move Dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetProject, setMoveTargetProject] = useState("");
  const [moveParticipantId, setMoveParticipantId] = useState("");

  // Reject Request Dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectRequestId, setRejectRequestId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [partsRes, reqsRes, projsRes] = await Promise.all([
        (() => {
          let q = supabase.from("participants").select("*").eq("project_id", projectId).order("points", { ascending: false });
          if (groupId) q = q.eq("group_id", groupId);
          else if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        supabase.from("project_registrations").select("*").eq("project_id", projectId).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("projects").select("id, name_ar, name_en").order("name_ar"),
      ]);

      setParticipants((partsRes.data ?? []) as unknown as ParticipantRow[]);
      setRequests((reqsRes.data ?? []) as RegistrationRequest[]);
      setProjects((projsRes.data ?? []) as Project[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
  const handleToggleStatus = async (p: ParticipantRow) => {
    const nextStatus = p.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("participants").update({ status: nextStatus }).eq("id", p.id);
    if (error) { toast.error("حدث خطأ أثناء تغيير الحالة. يرجى المحاولة مرة أخرى."); return; }
    await logAudit("update", "participant", p.id!, { status: nextStatus });
    toast.success(t("common.success"));
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!isManager) { toast.error("ليس لديك صلاحية حذف المشاركين."); return; }
    if (!(await confirm(t("participants.deleteConfirm", "هل أنت متأكد من حذف هذا المشارك؟")))) return;
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) { toast.error(friendlyError(error)); return; }
    await logAudit("delete", "participant", id);
    toast.success(t("common.success"));
    loadData();
  };

  const handleMove = async () => {
    if (!moveTargetProject) { toast.error(t("projects.selectProject", "يرجى اختيار المشروع")); return; }
    const { error } = await supabase.from("participants").update({ project_id: moveTargetProject, branch_id: null }).eq("id", moveParticipantId);
    if (error) { toast.error("حدث خطأ أثناء نقل المشارك. يرجى المحاولة مرة أخرى."); return; }
    await logAudit("update", "participant", moveParticipantId, { project_id: moveTargetProject });
    toast.success(t("common.success"));
    setMoveOpen(false);
    loadData();
  };

  const handleApproveRequest = async (req: RegistrationRequest) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. Create participant
    const { data: part, error: pErr } = await supabase.from("participants").insert([{
      full_name: req.full_name,
      phone: req.phone || "",
      national_id: req.national_id || "",
      project_id: projectId,
      status: "active",
      notes: req.notes,
      created_by: user?.id,
    }]).select().single();

    if (pErr) { toast.error("حدث خطأ أثناء إنشاء المشارك. يرجى المحاولة مرة أخرى."); return; }

    // 2. Update registration status
    const { error: rErr } = await supabase.from("project_registrations").update({
      status: "approved",
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", req.id);

    if (rErr) { toast.error("حدث خطأ أثناء تحديث حالة الطلب. يرجى المحاولة مرة أخرى."); return; }

    await logAudit("create", "participant", part.id, { approved_from_registration: req.id });
    toast.success(t("participants.import.approved", "تم قبول الطلب بنجاح"));
    loadData();
  };

  const handleRejectRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_registrations").update({
      status: "rejected",
      rejection_reason: rejectReason,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", rejectRequestId);

    if (error) { toast.error(error.message); return; }
    toast.success(t("common.success"));
    setRejectOpen(false);
    setRejectReason("");
    loadData();
  };

  const getLevelIcon = (points: number) => {
    if (points >= 500) return { icon: "👑", color: "text-[#9C27B0]" };
    if (points >= 300) return { icon: "🏆", color: "text-[#F44336]" };
    if (points >= 150) return { icon: "🏅", color: "text-[#FF9800]" };
    if (points >= 50) return { icon: "⭐", color: "text-[#FFC107]" };
    return { icon: "🌱", color: "text-[#8BC34A]" };
  };

  const filtered = participants.filter((p) =>
    !search ||
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? "").includes(search) ||
    (p.national_id ?? "").includes(search)
  );

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
          <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
            <TabsTrigger value="attendance" className="rounded-lg">
              {i18n.language === "ar" ? "تحضير المشاركون" : "Attendance"}
            </TabsTrigger>
            <TabsTrigger value="list" className="rounded-lg">
              {i18n.language === "ar" ? "عرض المشاركون" : "Participants List"}
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative rounded-lg">
              {t("projects.registrations", "طلبات التسجيل")}
              {requests.length > 0 && (
                <span className="ms-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "list" && (
            <Button size="sm" onClick={() => { setEditingParticipant(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 me-1.5" />
              {t("participants.new", "إضافة مشارك")}
            </Button>
          )}
        </div>

        {/* Tab 1: Participants List */}
        <TabsContent value="list" className="space-y-4 pt-2">
          <Input
            placeholder={t("common.search", "بحث...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />

          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("participants.empty", "لا يوجد مشاركون")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("participants.fullName", "اسم المشارك")}</TableHead>
                      <TableHead>{t("participants.nationalId", "رقم الهوية")}</TableHead>
                      <TableHead>{t("participants.phone", "رقم الجوال")}</TableHead>
                      <TableHead>المرحلة الدراسية</TableHead>
                      <TableHead>تاريخ الانضمام</TableHead>
                      <TableHead>{t("participants.status", "الحالة")}</TableHead>
                      <TableHead className="text-end">{t("common.actions", "الإجراءات")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.full_name}</TableCell>
                        <TableCell dir="ltr" className="font-mono text-xs">{p.national_id || "—"}</TableCell>
                        <TableCell dir="ltr">{p.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.custom_fields?.education_level || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleDateString("ar-SA") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "active" ? "default" : "secondary"}>
                            {t(`participants.statuses.${p.status}`, p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingParticipant(p); setFormOpen(true); }} className="gap-2 font-medium cursor-pointer">
                                <Eye className="h-4 w-4" />
                                عرض المشارك
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(p)} className="gap-2 cursor-pointer">
                                {p.status === "active" ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                {t("participants.changeStatus", "تغيير الحالة")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setMoveParticipantId(p.id!); setMoveTargetProject(""); setMoveOpen(true); }} className="gap-2 cursor-pointer">
                                <ArrowRightLeft className="h-4 w-4" />
                                {t("projects.moveParticipant", "نقل لمشروع آخر")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {isManager && (
                                <DropdownMenuItem onClick={() => handleDelete(p.id!)} className="text-destructive gap-2 cursor-pointer focus:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  حذف الطالب
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Registration Requests */}
        <TabsContent value="requests" className="pt-2">
          <Card>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">{t("projects.noRegistrations", "لا توجد طلبات تسجيل معلقة")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("participants.fullName", "الاسم")}</TableHead>
                      <TableHead>{t("participants.phone", "الهاتف")}</TableHead>
                      <TableHead>{t("participants.nationalId", "رقم الهوية")}</TableHead>
                      <TableHead>{t("common.email", "البريد")}</TableHead>
                      <TableHead>{t("participants.notes", "ملاحظات")}</TableHead>
                      <TableHead className="text-end">{t("common.actions", "الإجراءات")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell dir="ltr">{r.phone || "—"}</TableCell>
                        <TableCell dir="ltr" className="font-mono text-xs">{r.national_id || "—"}</TableCell>
                        <TableCell>{r.email || "—"}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{r.notes || "—"}</TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="default" onClick={() => handleApproveRequest(r)}>
                              {t("common.approve", "قبول")}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setRejectRequestId(r.id); setRejectReason(""); setRejectOpen(true); }}>
                              {t("common.reject", "رفض")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Tab: Attendance */}
        <TabsContent value="attendance" className="pt-2">
          <ProjectAttendanceTab projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Participant Form Dialog */}
      <ParticipantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editingParticipant}
        defaultProjectId={projectId}
        onSaved={loadData}
      />

      {/* Move Participant Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.moveParticipantTitle", "نقل المشارك لمشروع آخر")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("projects.selectProject", "اختر المشروع المستهدف")}</Label>
              <Select value={moveTargetProject} onValueChange={setMoveTargetProject}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("projects.selectProject", "اختر المشروع")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.filter((p) => p.id !== projectId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleMove}>{t("common.save", "حفظ وتعديل")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Request Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              {t("projects.rejectRequest", "رفض طلب التسجيل")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("projects.rejectionReason", "سبب الرفض")}</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1"
                placeholder={t("projects.rejectionReasonPh", "مثال: عدم ملاءمة الشروط، اكتمال الطاقة الاستيعابية")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleRejectRequest}>{t("common.reject", "رفض الطلب")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

