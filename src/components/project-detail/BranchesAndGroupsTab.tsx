import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Building2, Folder, Layers, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { GroupParticipantsDialog } from "./GroupParticipantsDialog";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface BranchesAndGroupsTabProps {
  projectId: string;
}

interface Branch {
  id: string;
  name_ar: string;
  name_en: string | null;
  status: "planned" | "in_progress" | "completed" | "stalled";
}

interface EnjazGroup {
  id: string;
  name_ar: string;
  branch_id: string | null;
  created_at: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planned: "outline", in_progress: "default", completed: "secondary", stalled: "destructive",
};

export const BranchesAndGroupsTab = ({ projectId }: BranchesAndGroupsTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { confirm, ConfirmDialogNode } = useConfirm();
  
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<EnjazGroup[]>([]);

  // Dialog states for Branch
  const [branchOpen, setBranchOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    name_ar: "",
    name_en: "",
    status: "in_progress" as "planned" | "in_progress" | "completed" | "stalled",
  });

  // Dialog states for Group
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EnjazGroup | null>(null);
  const [groupForm, setGroupForm] = useState({
    name_ar: "",
    branch_id: "none",
  });

  // Dialog state for Participants
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsGroup, setParticipantsGroup] = useState<EnjazGroup | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchesRes, groupsRes] = await Promise.all([
        supabase.from("project_branches").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("project_groups").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);

      setBranches((branchesRes.data ?? []) as Branch[]);
      setGroups((groupsRes.data ?? []) as EnjazGroup[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save/Create Branch
  const handleSaveBranch = async () => {
    if (!branchForm.name_ar) {
      toast.error(isRtl ? "اسم الفرع مطلوب" : "Branch name is required");
      return;
    }

    try {
      if (editingBranch) {
        const { error } = await supabase
          .from("project_branches")
          .update({
            name_ar: branchForm.name_ar,
            name_en: branchForm.name_en || null,
            status: branchForm.status,
          })
          .eq("id", editingBranch.id);

        if (error) throw error;
        await logAudit("update", "branch", editingBranch.id);
        toast.success(isRtl ? "تم تحديث الفرع بنجاح" : "Branch updated successfully");
      } else {
        const { data, error } = await supabase
          .from("project_branches")
          .insert([{
            project_id: projectId,
            name_ar: branchForm.name_ar,
            name_en: branchForm.name_en || null,
            status: branchForm.status,
          }])
          .select()
          .single();

        if (error) throw error;
        await logAudit("create", "branch", data.id);
        toast.success(isRtl ? "تم إضافة الفرع بنجاح" : "Branch created successfully");
      }
      setBranchOpen(false);
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (b: Branch) => {
    if (!(await confirm(isRtl ? "هل أنت متأكد من حذف هذا الفرع؟" : "Are you sure you want to delete this branch?"))) return;
    try {
      const { error } = await supabase.from("project_branches").delete().eq("id", b.id);
      if (error) throw error;
      await logAudit("delete", "branch", b.id);
      toast.success(isRtl ? "تم حذف الفرع بنجاح" : "Branch deleted");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Drag and Drop for Groups
  const handleDropGroup = async (e: React.DragEvent, targetBranchId: string | null) => {
    e.preventDefault();
    const groupId = e.dataTransfer.getData("groupId");
    if (!groupId) return;

    try {
      const { error } = await supabase
        .from("project_groups")
        .update({ branch_id: targetBranchId })
        .eq("id", groupId);

      if (error) throw error;
      toast.success(isRtl ? "تم نقل المجموعة بنجاح" : "Group moved successfully");
      loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Save/Create Group
  const handleSaveGroup = async () => {
    if (!groupForm.name_ar) {
      toast.error(isRtl ? "اسم المجموعة مطلوب" : "Group name is required");
      return;
    }

    const branchIdVal = groupForm.branch_id === "none" ? null : groupForm.branch_id;

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("project_groups")
          .update({
            name_ar: groupForm.name_ar,
            branch_id: branchIdVal,
          })
          .eq("id", editingGroup.id);

        if (error) throw error;
        toast.success(isRtl ? "تم تحديث المجموعة بنجاح" : "Group updated successfully");
      } else {
        const { error } = await supabase
          .from("project_groups")
          .insert([{
            project_id: projectId,
            name_ar: groupForm.name_ar,
            branch_id: branchIdVal,
          }]);

        if (error) throw error;
        toast.success(isRtl ? "تم إضافة المجموعة بنجاح" : "Group created successfully");
      }
      setGroupOpen(false);
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (g: EnjazGroup) => {
    if (!(await confirm(isRtl ? "هل أنت متأكد من حذف هذه المجموعة؟" : "Are you sure you want to delete this group?"))) return;
    try {
      const { error } = await supabase.from("project_groups").delete().eq("id", g.id);
      if (error) throw error;
      toast.success(isRtl ? "تم حذف المجموعة بنجاح" : "Group deleted");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openBranchDialog = (b: Branch | null = null) => {
    if (b) {
      setEditingBranch(b);
      setBranchForm({
        name_ar: b.name_ar,
        name_en: b.name_en || "",
        status: b.status,
      });
    } else {
      setEditingBranch(null);
      setBranchForm({
        name_ar: "",
        name_en: "",
        status: "in_progress",
      });
    }
    setBranchOpen(true);
  };

  const openGroupDialog = (g: EnjazGroup | null = null) => {
    if (g) {
      setEditingGroup(g);
      setGroupForm({
        name_ar: g.name_ar,
        branch_id: g.branch_id || "none",
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name_ar: "",
        branch_id: "none",
      });
    }
    setGroupOpen(true);
  };

  const openParticipantsDialog = (g: EnjazGroup) => {
    setParticipantsGroup(g);
    setParticipantsOpen(true);
  };

  if (loading) return <div className="text-center py-6">{isRtl ? "جاري تحميل الهيكل التنظيمي..." : "Loading structure..."}</div>;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {ConfirmDialogNode}
      <div className="flex flex-wrap items-center justify-start gap-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openBranchDialog()}>
            <Plus className="h-4 w-4 me-1.5" />
            {isRtl ? "فرع جديد" : "New Branch"}
          </Button>
          <Button variant="default" size="sm" onClick={() => openGroupDialog()}>
            <Plus className="h-4 w-4 me-1.5" />
            {isRtl ? "مجموعة جديدة" : "New Group"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Render branches with their groups nested inside */}
        {branches.map((b) => {
          const branchGroups = groups.filter((g) => g.branch_id === b.id);
          return (
            <Card 
              key={b.id} 
              className="border hover:shadow-md transition-all rounded-xl overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropGroup(e, b.id)}
            >
              <CardHeader className="bg-secondary/40 p-4 pb-3 flex flex-row justify-between items-start space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {b.name_ar}
                  </CardTitle>
                  <Badge variant={statusVariant[b.status]} className="text-[10px] py-0 px-1.5">
                    {b.status === "in_progress" ? (isRtl ? "نشط" : "Active") : 
                     b.status === "stalled" ? (isRtl ? "غير نشط" : "Inactive") : 
                     t(`projects.statuses.${b.status}`)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openBranchDialog(b)} className="h-7 w-7">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDeleteBranch(b)} className="h-7 w-7 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{isRtl ? `المجموعات التابعة (${branchGroups.length})` : `Attached Groups (${branchGroups.length})`}</span>
                </div>
                {branchGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">{isRtl ? "لا توجد مجموعات تابعة لهذا الفرع" : "No groups in this branch"}</p>
                ) : (
                  <div className="space-y-2">
                    {branchGroups.map((g) => (
                      <div 
                        key={g.id} 
                        draggable 
                        onDragStart={(e) => e.dataTransfer.setData("groupId", g.id)}
                        className="flex justify-between items-center p-2 rounded-lg bg-background border text-sm cursor-grab active:cursor-grabbing hover:border-primary/50"
                      >
                        <span className="font-medium">{g.name_ar}</span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openParticipantsDialog(g)} className="h-6 w-6 text-primary">
                            <UserPlus className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openGroupDialog(g)} className="h-6 w-6">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(g)} className="h-6 w-6 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Unassigned Groups Section */}
        <Card 
          className="border hover:shadow-md transition-all rounded-xl overflow-hidden border-dashed"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDropGroup(e, null)}
        >
            <CardHeader className="bg-amber-500/10 p-4 pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                <Folder className="h-4 w-4" />
                {isRtl ? "مجموعات غير مصنفة" : "Unassigned Groups"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {groups.filter((g) => !g.branch_id).length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
                  {isRtl ? "اسحب المجموعات وأفلتها هنا لفصلها عن الفرع" : "Drag and drop groups here to unassign them"}
                </div>
              ) : (
                groups.filter((g) => !g.branch_id).map((g) => (
                  <div 
                    key={g.id} 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData("groupId", g.id)}
                    className="flex justify-between items-center p-2 rounded-lg bg-background border text-sm cursor-grab active:cursor-grabbing hover:border-amber-500/50"
                  >
                    <span className="font-medium">{g.name_ar}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openParticipantsDialog(g)} className="h-6 w-6 text-primary">
                        <UserPlus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openGroupDialog(g)} className="h-6 w-6">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(g)} className="h-6 w-6 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
      </div>

      {/* Branch Dialog */}
      <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? (isRtl ? "تعديل الفرع" : "Edit Branch") : (isRtl ? "إضافة فرع جديد" : "Add Branch")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{isRtl ? "اسم الفرع" : "Branch Name"}</Label>
              <Input 
                value={branchForm.name_ar} 
                onChange={(e) => setBranchForm(prev => ({ ...prev, name_ar: e.target.value }))}
                placeholder={isRtl ? "اكتب اسم الفرع هنا..." : "Enter branch name..."}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "الحالة التشغيلية" : "Status"}</Label>
              <Select 
                value={branchForm.status} 
                onValueChange={(v: any) => setBranchForm(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">{isRtl ? "نشط" : "Active"}</SelectItem>
                  <SelectItem value="stalled">{isRtl ? "غير نشط" : "Inactive"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveBranch}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? (isRtl ? "تعديل المجموعة" : "Edit Group") : (isRtl ? "إضافة مجموعة جديدة" : "Add Group")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{isRtl ? "اسم المجموعة" : "Group Name"}</Label>
              <Input 
                value={groupForm.name_ar} 
                onChange={(e) => setGroupForm(prev => ({ ...prev, name_ar: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "ربط بالفرع المكاني" : "Link to Spatial Branch"}</Label>
              <Select 
                value={groupForm.branch_id} 
                onValueChange={(v) => setGroupForm(prev => ({ ...prev, branch_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isRtl ? "بدون تحديد فرع" : "No branch selection"}</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveGroup}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Participants Dialog */}
      <GroupParticipantsDialog
        projectId={projectId}
        group={participantsGroup}
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        onSaved={loadData}
      />
    </div>
  );
};

