import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
  editData?: any;
}

const AVAILABLE_RESPONSIBILITIES = [
  { id: "finance_officer", label_ar: "إدارة الشؤون المالية", label_en: "Financial Management" },
  { id: "media_officer", label_ar: "تغطية إعلامية", label_en: "Media Coverage" },
  { id: "attendance_officer", label_ar: "متابعة الحضور", label_en: "Attendance Tracking" },
  { id: "monitoring_eval", label_ar: "تقييم ومتابعة", label_en: "Monitoring & Evaluation" },
  { id: "events_coordinator", label_ar: "تنسيق الفعاليات", label_en: "Events Coordination" },
  { id: "training_management", label_ar: "إدارة المسار التدريبي", label_en: "Training Track Management" },
  { id: "points_management", label_ar: "رصد النقاط والإنجاز", label_en: "Points & Achievement Tracking" },
];

export const AddMemberDialog = ({ open, onOpenChange, projectId, onSuccess, editData }: AddMemberDialogProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  // Form State
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const [branchId, setBranchId] = useState("none");
  const [groupId, setGroupId] = useState("none");
  
  // Array of objects { id: string, scope: "project" | "branch" | "group" }
  const [responsibilities, setResponsibilities] = useState<{id: string, scope: string}[]>([]);

  useEffect(() => {
    if (open) {
      loadDependencies();
      if (editData) {
        setUserId(editData.user_id);
        setRole(editData.project_role);
        setBranchId(editData.branch_id || "none");
        setGroupId(editData.group_id || "none");
        
        // Parse responsibilities format "roleId:scope" or just "roleId"
        const parsedResps = (editData.responsibilities || []).map((r: string) => {
          if (r.includes(":")) {
            const [id, scope] = r.split(":");
            return { id, scope };
          }
          return { id: r, scope: "project" };
        });
        setResponsibilities(parsedResps);
      } else {
        // Reset form
        setUserId("");
        setRole("member");
        setBranchId("none");
        setGroupId("none");
        setResponsibilities([]);
      }
    }
  }, [open, projectId, editData]);

  const loadDependencies = async () => {
    try {
      const [usersRes, branchesRes, { data: groupsData, error: groupsErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("project_branches").select("id, name_ar").eq("project_id", projectId),
        supabase
          .from("project_groups")
          .select("id, name_ar, branch_id")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
      ]);

      if (groupsErr) throw groupsErr;

      setUsers(usersRes.data || []);
      setBranches(branchesRes.data || []);
      setGroups(groupsData || []);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error(isRtl ? "يرجى اختيار الموظف" : "Please select an employee");
      return;
    }

    setLoading(true);
    
    // Format responsibilities as string array
    const formattedResps = responsibilities.map(r => `${r.id}:${r.scope}`);

    try {
      if (editData) {
        const { error } = await supabase.from("project_members").update({
          project_role: role,
          branch_id: (branchId === "none" || branchId === "all") ? null : branchId,
          group_id: groupId === "none" ? null : groupId,
          responsibilities: formattedResps,
        }).eq("id", editData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_members").insert({
          project_id: projectId,
          user_id: userId,
          project_role: role,
          branch_id: (branchId === "none" || branchId === "all") ? null : branchId,
          group_id: groupId === "none" ? null : groupId,
          responsibilities: formattedResps,
        });

        if (error) {
          if (error.code === "23505") {
            throw new Error(isRtl ? "هذا الموظف مكلف مسبقاً بهذا الدور في نفس النطاق" : "User already has this role in this scope");
          }
          throw error;
        }
      }

      toast.success(t("common.success", "تم الحفظ بنجاح"));
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = (respId: string, scope: string) => {
    if (scope === "none") {
      setResponsibilities(responsibilities.filter(r => r.id !== respId));
      return;
    }

    const existingIndex = responsibilities.findIndex(r => r.id === respId);
    
    // If clicking the currently selected scope, toggle it off (remove it)
    if (existingIndex >= 0 && responsibilities[existingIndex].scope === scope) {
      setResponsibilities(responsibilities.filter(r => r.id !== respId));
      return;
    }

    if (existingIndex >= 0) {
      const newResps = [...responsibilities];
      newResps[existingIndex].scope = scope;
      setResponsibilities(newResps);
    } else {
      setResponsibilities([...responsibilities, { id: respId, scope }]);
    }
  };

  const handleGroupChange = (val: string) => {
    setGroupId(val);
    if (val !== "none") {
      const selectedGroup = groups.find(g => g.id === val);
      if (selectedGroup && selectedGroup.branch_id) {
        setBranchId(selectedGroup.branch_id);
      }
    }
  };

  const handleBranchChange = (val: string) => {
    setBranchId(val);
    if (val !== "none" && val !== "all" && groupId !== "none") {
      const currentGroup = groups.find(g => g.id === groupId);
      if (currentGroup && currentGroup.branch_id && currentGroup.branch_id !== val) {
        setGroupId("none");
      }
    }
  };

  const filteredGroups = (branchId !== "none" && branchId !== "all")
    ? groups.filter(g => !g.branch_id || g.branch_id === branchId)
    : groups;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{editData ? (isRtl ? "تعديل عضو" : "Edit Member") : (isRtl ? "تعيين موظف في المشروع" : "Assign Employee to Project")}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-6">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{isRtl ? "الموظف" : "Employee"}</Label>
              <Select value={userId} onValueChange={setUserId} disabled={!!editData}>
                <SelectTrigger dir={isRtl ? "rtl" : "ltr"}>
                  <SelectValue placeholder={isRtl ? "اختر الموظف" : "Select employee"} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]" dir={isRtl ? "rtl" : "ltr"}>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email || "بدون اسم"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{isRtl ? "الدور في المشروع" : "Project Role"}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger dir={isRtl ? "rtl" : "ltr"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                  <SelectItem value="project_manager">مدير مشروع</SelectItem>
                  <SelectItem value="branch_manager">مدير فرع</SelectItem>
                  <SelectItem value="group_supervisor">مشرف مجموعة</SelectItem>
                  <SelectItem value="teacher">معلم</SelectItem>
                  <SelectItem value="trainer">مدرب</SelectItem>
                  <SelectItem value="attendance_officer">مسؤول تحضير</SelectItem>
                  <SelectItem value="finance_officer">مسؤول مالية</SelectItem>
                  <SelectItem value="media_officer">مسؤول إعلام</SelectItem>
                  <SelectItem value="member">عضو</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label>{isRtl ? "الفرع" : "Branch"}</Label>
                {branchId !== "none" && branchId !== "all" && (
                  <button 
                    type="button" 
                    onClick={() => handleBranchChange("none")} 
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {isRtl ? "إلغاء التحديد" : "Clear"}
                  </button>
                )}
              </div>
              <Select value={branchId} onValueChange={handleBranchChange} disabled={branches.length === 0}>
                <SelectTrigger dir={isRtl ? "rtl" : "ltr"}>
                  <SelectValue placeholder={branches.length === 0 ? (isRtl ? "لا توجد فروع" : "No branches") : ""} />
                </SelectTrigger>
                <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                  <SelectItem value="none">{isRtl ? "-- كافة المشروع --" : "-- Entire Project --"}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label>{isRtl ? "المجموعة" : "Group"}</Label>
                {groupId !== "none" && (
                  <button 
                    type="button" 
                    onClick={() => handleGroupChange("none")} 
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {isRtl ? "إلغاء التحديد" : "Clear"}
                  </button>
                )}
              </div>
              <Select value={groupId} onValueChange={handleGroupChange} disabled={filteredGroups.length === 0}>
                <SelectTrigger dir={isRtl ? "rtl" : "ltr"}>
                  <SelectValue placeholder={filteredGroups.length === 0 ? (isRtl ? "لا توجد مجموعات لهذا الفرع" : "No groups") : (isRtl ? "اختر مجموعة..." : "Select group...")} />
                </SelectTrigger>
                <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                  {filteredGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 pt-4 border-t">
              <Label className="text-sm font-bold text-primary">{isRtl ? "الصلاحيات الإضافية" : "Additional Permissions"}</Label>
              <div className="mt-2 border rounded-md overflow-hidden bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="py-2 px-3 text-start font-medium">{isRtl ? "الصلاحية" : "Permission"}</th>
                      <th className="py-2 px-3 text-center font-medium">{isRtl ? "المشروع" : "Project"}</th>
                      <th className="py-2 px-3 text-center font-medium">{isRtl ? "الفرع" : "Branch"}</th>
                      <th className="py-2 px-3 text-center font-medium">{isRtl ? "المجموعة" : "Group"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AVAILABLE_RESPONSIBILITIES.map((resp) => {
                      const currentResp = responsibilities.find(r => r.id === resp.id);
                      
                      return (
                        <tr key={resp.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-3 font-semibold text-xs whitespace-nowrap">
                            {isRtl ? resp.label_ar : resp.label_en}
                          </td>
                          {(["project", "branch", "group"] as const).map(scope => {
                            const isSelected = currentResp?.scope === scope;
                            const isDisabled = 
                              (scope === "branch" && branchId === "none") || 
                              (scope === "group" && groupId === "none");
                              
                            return (
                              <td key={scope} className="py-2 px-3 text-center" onClick={() => !isDisabled && handleScopeToggle(resp.id, scope)}>
                                <div className={`mx-auto flex h-4 w-4 items-center justify-center rounded-full border ${isDisabled ? 'opacity-30 cursor-not-allowed bg-muted' : 'cursor-pointer'} ${isSelected ? 'border-primary bg-primary' : 'border-primary/50 bg-background'}`}>
                                  {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "إلغاء")}
          </Button>
          <Button onClick={handleSave} disabled={loading || !userId}>
            {loading ? t("common.saving", "جاري الحفظ...") : t("common.save", "حفظ")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

