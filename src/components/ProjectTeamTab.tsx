import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddMemberDialog } from "./project-detail/AddMemberDialog";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface ProjectTeamTabProps {
  projectId: string;
}

interface TeamMember {
  id: string; // from project_members or participant_project_memberships, but we use project_members now
  user_id: string;
  project_id: string;
  branch_id: string | null;
  group_id: string | null;
  project_role: string;
  responsibilities: string[];
  profiles: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  project_branches: {
    name_ar: string;
  } | null;
  project_groups: {
    name_ar: string;
  } | null;
}

export const ProjectTeamTab = ({ projectId }: ProjectTeamTabProps) => {
  const { t, i18n } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { confirm, ConfirmDialogNode } = useConfirm();
  const [editMember, setEditMember] = useState<TeamMember | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, groupsRes] = await Promise.all([
        supabase
          .from("project_members")
          .select(`
            id, user_id, project_id, branch_id, group_id, project_role, responsibilities,
            profiles (full_name, email, phone),
            project_branches (name_ar)
          `)
          .eq("project_id", projectId),
        supabase
          .from("project_groups")
          .select("id, name_ar")
          .eq("project_id", projectId)
      ]);

      if (membersRes.error) throw membersRes.error;

      const groupsMap = new Map(groupsRes.data?.map(g => [g.id, g.name_ar]));

      const mappedData = membersRes.data?.map((m: any) => ({
        ...m,
        project_groups: m.group_id ? { name_ar: groupsMap.get(m.group_id) || "" } : null
      }));

      setMembers(mappedData as unknown as TeamMember[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (memberId: string) => {
    if (!(await confirm(t("common.deleteConfirm", "هل أنت متأكد من الحذف؟")))) return;
    const { error } = await supabase.from("project_members").delete().eq("id", memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("common.success", "تم بنجاح"));
      loadData();
    }
  };

  const roleLabels: Record<string, string> = {
    project_manager: "مدير مشروع",
    branch_manager: "مدير فرع",
    group_supervisor: "مشرف مجموعة",
    teacher: "معلم",
    trainer: "مدرب",
    attendance_officer: "مسؤول تحضير",
    finance_officer: "مسؤول مالية",
    media_officer: "مسؤول إعلام",
    member: "عضو",
  };

  const respLabels: Record<string, string> = {
    finance_officer: "إدارة الشؤون المالية",
    media_officer: "تغطية إعلامية",
    attendance_officer: "متابعة الحضور",
    monitoring_eval: "تقييم ومتابعة",
    events_coordinator: "تنسيق الفعاليات",
    training_management: "إدارة المسار التدريبي",
    points_management: "رصد النقاط والإنجاز",
  };

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{i18n.language === "ar" ? "إدارة فريق المشروع" : "Project Team"}</h2>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {i18n.language === "ar" ? "إضافة عضو" : "Add Member"}
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{i18n.language === "ar" ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{i18n.language === "ar" ? "الدور في المشروع" : "Role"}</TableHead>
                  <TableHead>{i18n.language === "ar" ? "الفرع" : "Branch"}</TableHead>
                  <TableHead>{i18n.language === "ar" ? "المجموعة" : "Group"}</TableHead>
                  <TableHead>{i18n.language === "ar" ? "صلاحيات إضافية" : "Additional Permissions"}</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">{t("common.loading", "جاري التحميل...")}</TableCell></TableRow>
                ) : members.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.noData", "لا توجد بيانات")}</TableCell></TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{m.profiles?.full_name || t("common.unknown")}</span>
                          <span className="text-xs text-muted-foreground">{m.profiles?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/5 text-primary">
                          {roleLabels[m.project_role] || m.project_role}
                        </Badge>
                      </TableCell>
                      <TableCell>{m.project_branches?.name_ar || "-"}</TableCell>
                      <TableCell>{m.project_groups?.name_ar || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.responsibilities.length > 0 ? (
                            m.responsibilities.map(r => {
                              const [id, scope] = r.includes(":") ? r.split(":") : [r, "project"];
                              let scopeLabel = "";
                              if (scope === "project") scopeLabel = " (كافة المشروع)";
                              if (scope === "branch") scopeLabel = " (الفرع)";
                              if (scope === "group") scopeLabel = " (المجموعة)";
                              
                              return (
                                <Badge key={r} variant="secondary" className="text-[10px]">
                                  {respLabels[id] || roleLabels[id] || id}{scopeLabel}
                                </Badge>
                              );
                            })
                          ) : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => { setEditMember(m); setIsAddOpen(true); }}>
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddMemberDialog 
        open={isAddOpen} 
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setEditMember(null);
        }} 
        projectId={projectId} 
        onSuccess={loadData} 
        editData={editMember}
      />
    </div>
  );
};

