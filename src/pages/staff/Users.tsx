import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, X, Pencil, KeyRound, Loader2, Building, FolderKanban, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { UserFormDialog, UserFormInitial } from "@/components/UserFormDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StaffRequests from "./StaffRequests";

const ALL_ROLES: AppRole[] = [
  "system_admin","board","executive","assistant","project_manager",
  "branch_manager","employee","contractor","participant","guardian"
];

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  roles: AppRole[];
  company_ids: string[];
  project_ids: string[];
}

interface WorkspaceItem {
  id: string;
  name: string;
}

const Users = () => {
  const { t } = useTranslation();
  const { isSystemAdmin, hasPermission } = useAuth();
  const fallbackRoute = useFallbackRoute();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addingRole, setAddingRole] = useState<Record<string, AppRole>>({});
  const [addingAffiliation, setAddingAffiliation] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserFormInitial | null>(null);

  // Workspaces
  const [companies, setCompanies] = useState<WorkspaceItem[]>([]);
  const [projects, setProjects] = useState<WorkspaceItem[]>([]);

  // Password change state
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Note: Only system admins or authorized HR should access this global page
  const canManage = isSystemAdmin || hasPermission("manage_users");

  const load = async () => {
    try {
      const [
        { data: profiles }, 
        { data: roles },
        { data: comps },
        { data: projs },
        { data: compMembers },
        { data: projMembers }
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("companies").select("id, name"),
        supabase.from("projects").select("id, name_ar"),
        supabase.from("company_members").select("user_id, company_id"),
        supabase.from("project_members").select("user_id, project_id")
      ]);

      setCompanies((comps ?? []).map(c => ({ id: c.id, name: c.name })));
      setProjects((projs ?? []).map(p => ({ id: p.id, name: p.name_ar })));

      const byUserRoles: Record<string, AppRole[]> = {};
      (roles ?? []).forEach((r) => {
        byUserRoles[r.user_id] = byUserRoles[r.user_id] ?? [];
        byUserRoles[r.user_id].push(r.role as AppRole);
      });

      const compMap: Record<string, string[]> = {};
      (compMembers ?? []).forEach(m => {
        compMap[m.user_id] = compMap[m.user_id] || [];
        compMap[m.user_id].push(m.company_id);
      });

      const projMap: Record<string, string[]> = {};
      (projMembers ?? []).forEach(m => {
        projMap[m.user_id] = projMap[m.user_id] || [];
        projMap[m.user_id].push(m.project_id);
      });

      setUsers((profiles ?? []).map((p) => ({ 
        ...p, 
        roles: byUserRoles[p.id] ?? [],
        company_ids: compMap[p.id] || [],
        project_ids: projMap[p.id] || []
      })));
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  useEffect(() => { if (canManage) load(); }, [canManage]);

  const addRole = async (userId: string) => {
    const role = addingRole[userId];
    if (!role) return;
    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role }]);
    if (error) { toast.error(error.message); return; }
    await logAudit("assign_role", "user", userId, { role });
    toast.success(t("common.success"));
    load();
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) { toast.error(error.message); return; }
    await logAudit("remove_role", "user", userId, { role });
    load();
  };

  const toggleCompany = async (userId: string, isChecked: boolean) => {
    try {
      if (isChecked) {
        if (companies.length === 0) throw new Error("عذراً، جاري تحميل بيانات النظام. الرجاء تحديث الصفحة (F5).");
        const { error } = await supabase.from("company_members").insert({ user_id: userId, company_id: companies[0].id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_members").delete().eq("user_id", userId);
        if (error) throw error;
      }
      toast.success(t("common.success", "تم تحديث التبعية بنجاح"));
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    }
  };

  const toggleProject = async (userId: string, projectId: string, isChecked: boolean) => {
    try {
      if (isChecked) {
        const { error } = await supabase.from("project_members").insert({ user_id: userId, project_id: projectId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_members").delete().eq("user_id", userId).eq("project_id", projectId);
        if (error) throw error;
      }
      toast.success(t("common.success", "تم تحديث التبعية بنجاح"));
      load();
    } catch (e: any) {
      toast.error(e.message || t("common.error"));
    }
  };

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (u: UserRow) => {
    setEditing({ id: u.id, full_name: u.full_name, email: u.email, phone: u.phone });
    setDialogOpen(true);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    if (newPassword.length < 6) {
      toast.error(t("auth.errors.weak_password", "يجب أن تكون كلمة المرور 6 أحرف على الأقل"));
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.rpc("admin_change_user_password", {
        target_user_id: passwordTarget.id,
        new_password: newPassword
      });
      if (error) throw error;
      
      await logAudit("change_password", "user", passwordTarget.id);
      toast.success(t("common.success", "تم حفظ التغييرات بنجاح"));
      setPasswordDialogOpen(false);
      setNewPassword("");
      setPasswordTarget(null);
    } catch (error: any) {
      toast.error(error.message || t("common.error"));
    } finally {
      setChangingPassword(false);
    }
  };

  if (!canManage) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return (
    <div dir="rtl" className="space-y-6 animate-in fade-in duration-500 bg-background/50 p-4 md:p-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <h1 className="text-3xl font-bold tracking-tight">الموظفون</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />{t("users.newUser", "موظف جديد")}
        </Button>
      </div>
      
      <Tabs defaultValue="users" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 rounded-xl mb-4">
          <TabsTrigger value="users" className="rounded-lg py-2.5 gap-1.5"><UserCheck className="h-4 w-4" />جميع الموظفين</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg py-2.5 gap-1.5"><UserPlus className="h-4 w-4" />طلبات الانضمام</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="grid gap-4">
        {users.map((u) => (
          <Card key={u.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 bg-muted/30 pb-4">
              <div>
                <CardTitle className="text-lg">{u.full_name || u.email}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{u.email} {u.phone && `· ${u.phone}`}</p>
                
                {/* Current Affiliation Display */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {u.company_ids.length > 0 && (
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                      <Building className="w-3 h-3 me-1" />
                      إدارة
                    </Badge>
                  )}
                  {u.project_ids.map(pid => (
                    <Badge key={pid} variant="default" className="bg-amber-600 hover:bg-amber-700">
                      <FolderKanban className="w-3 h-3 me-1" />
                      مشروع: {projects.find(p => p.id === pid)?.name || "غير معروف"}
                    </Badge>
                  ))}
                  {u.company_ids.length === 0 && u.project_ids.length === 0 && (
                    <Badge variant="outline" className="text-muted-foreground">
                      بدون تبعية (لا يرى بيانات)
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {hasPermission("change_user_password") && (
                  <Button size="sm" variant="outline" onClick={() => { setPasswordTarget(u); setPasswordDialogOpen(true); }}>
                    <KeyRound className="h-4 w-4 me-1" />{t("auth.changePassword", "تغيير الرمز السري")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                  <Pencil className="h-4 w-4" />{t("common.edit")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              
              {/* Affiliation Section */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">التبعية الإدارية والمشاريع</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {u.company_ids.length === 0 && u.project_ids.length === 0 && <span className="text-sm text-muted-foreground">{t("common.none")}</span>}
                  
                  {u.company_ids.length > 0 && (
                    <Badge variant="secondary" className="gap-1 px-2 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                      <Building className="w-3 h-3 me-1" /> إدارة
                      <button onClick={() => toggleCompany(u.id, false)} className="hover:text-destructive ms-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  
                  {u.project_ids.map((pid) => (
                    <Badge key={pid} variant="secondary" className="gap-1 px-2 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                      <FolderKanban className="w-3 h-3 me-1" /> {projects.find(p => p.id === pid)?.name || "مشروع محدد"}
                      <button onClick={() => toggleProject(u.id, pid, false)} className="hover:text-destructive ms-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                
                <div className="flex gap-2 max-w-md">
                  <Select
                    value={addingAffiliation[u.id] ?? ""}
                    onValueChange={(v) => setAddingAffiliation({ ...addingAffiliation, [u.id]: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="إسناد تبعية..." /></SelectTrigger>
                    <SelectContent>
                      {u.company_ids.length === 0 && (
                        <SelectItem value="company_HQ">إدارة عامة</SelectItem>
                      )}
                      {projects.filter(p => !u.project_ids.includes(p.id)).map((p) => (
                        <SelectItem key={p.id} value={`project_${p.id}`}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    onClick={async () => {
                      const val = addingAffiliation[u.id];
                      if (!val) return;
                      if (val === "company_HQ") {
                        await toggleCompany(u.id, true);
                      } else if (val.startsWith("project_")) {
                        await toggleProject(u.id, val.replace("project_", ""), true);
                      }
                      setAddingAffiliation({ ...addingAffiliation, [u.id]: "" });
                    }} 
                    disabled={!addingAffiliation[u.id]}
                  >
                    <Plus className="h-4 w-4" />{t("common.add")}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border my-2"></div>

              {/* Roles Section */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">الصلاحيات التقنية</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {u.roles.length === 0 && <span className="text-sm text-muted-foreground">{t("common.none")}</span>}
                  {u.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="gap-1 px-2 py-1">
                      {t(`roles.${r}`)}
                      <button onClick={() => removeRole(u.id, r)} className="hover:text-destructive ms-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 max-w-md">
                  <Select
                    value={addingRole[u.id] ?? ""}
                    onValueChange={(v) => setAddingRole({ ...addingRole, [u.id]: v as AppRole })}
                  >
                    <SelectTrigger><SelectValue placeholder={t("users.addRole", "إضافة صلاحية...")} /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                        <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => addRole(u.id)} disabled={!addingRole[u.id]}>
                    <Plus className="h-4 w-4" />{t("common.add")}
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        ))}
      </div>
      </TabsContent>

      <TabsContent value="requests">
        <StaffRequests />
      </TabsContent>
    </Tabs>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={load}
      />

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
                <Input value={passwordTarget?.email || ""} disabled className="bg-muted" />
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
    </div>
  );
};

export default Users;

