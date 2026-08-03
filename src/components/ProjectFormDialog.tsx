import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Status = "planned" | "in_progress" | "completed" | "stalled";
type ProjectMode = "external" | "internal" | "mixed";

export interface ProjectFormValue {
  id?: string;
  name_ar: string;
  name_en?: string | null;
  description?: string | null;
  manager_id?: string | null;
  has_branches: boolean;
  status: Status;
  budget?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  category?: string | null;
  is_public?: boolean;
  project_mode?: ProjectMode;
  enjaz_enabled?: boolean;
}

const PROJECT_CATEGORIES = ["education", "training", "volunteer", "social", "health", "other"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ProjectFormValue;
  onSaved: (id: string) => void;
}

export const ProjectFormDialog = ({ open, onOpenChange, initial, onSaved }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState<ProjectFormValue>({
    name_ar: "", name_en: "", description: "", has_branches: false,
    status: "planned", budget: 0, start_date: "", end_date: "", manager_id: null, category: null, is_public: false, project_mode: "external", enjaz_enabled: false,
  });
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { name_ar: "", name_en: "", description: "", has_branches: false, status: "planned", budget: 0, start_date: "", end_date: "", manager_id: null, category: null, is_public: false, project_mode: "external", enjaz_enabled: false });
      supabase.from("profiles").select("id, full_name, email").then(({ data }) => setUsers(data ?? []));
    }
  }, [open, initial]);

  const submit = async () => {
    if (!form.name_ar.trim()) { toast.error(t("common.required")); return; }
    if (form.name_ar.length > 255) { toast.error(t("projects.nameTooLong", "اسم المشروع يجب ألا يتجاوز 255 حرفاً")); return; }
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      toast.error(t("projects.dateError", "تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية"));
      return;
    }
    setSaving(true);
    const payload = {
      name_ar: form.name_ar,
      name_en: form.name_en || null,
      description: form.description || null,
      manager_id: form.manager_id || null,
      has_branches: form.has_branches,
      status: form.status,
      budget: form.budget ? Number(form.budget) : 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      category: form.category || null,
      is_public: !!form.is_public,
      project_mode: form.project_mode || "external",
      enjaz_enabled: !!form.enjaz_enabled,
    };
    let id = form.id;
    if (id) {
      const { error } = await supabase.from("projects").update(payload).eq("id", id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("projects").insert([{ ...payload, created_by: user?.id }]).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      id = data.id;
    }
    toast.success(t("common.success"));
    setSaving(false);
    onOpenChange(false);
    onSaved(id!);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? t("projects.edit") : t("projects.new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("projects.nameAr")} *</Label>
            <Input maxLength={255} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("projects.nameEn")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span></Label>
            <Input value={form.name_en ?? ""} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder={t("projects.nameEnHint", "يُولّد تلقائيًا إن تُرك فارغًا")} />
          </div>
          <div className="space-y-2">
            <Label>{t("projects.description")}</Label>
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("projects.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["planned","in_progress","completed","stalled"] as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>{t(`projects.statuses.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("projects.budget")}</Label>
              <Input type="number" min={0} value={form.budget ?? 0} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("projects.startDate")}</Label>
              <Input type="date" max={form.end_date || undefined} value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("projects.endDate")}</Label>
              <Input type="date" min={form.start_date || undefined} value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("projects.category")}</Label>
              <Select value={form.category ?? "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {PROJECT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{t(`projects.categories.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("projects.manager")}</Label>
              <Select value={form.manager_id ?? "none"} onValueChange={(v) => setForm({ ...form, manager_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("projects.mode", "وضع المشروع")}</Label>
            <Select value={form.project_mode ?? "external"} onValueChange={(v) => setForm({ ...form, project_mode: v as ProjectMode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="external">{t("projects.modes.external", "خارجي (مشاركون)")}</SelectItem>
                <SelectItem value="internal">{t("projects.modes.internal", "داخلي (موظفون)")}</SelectItem>
                <SelectItem value="mixed">{t("projects.modes.mixed", "مختلط")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("projects.modeHint", "الداخلي مخصص لتطوير الموظفين كمشاركين")}</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="hasBranches">{t("projects.hasBranches")}</Label>
            <Switch id="hasBranches" checked={form.has_branches} onCheckedChange={(v) => setForm({ ...form, has_branches: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isPublic">{t("projects.isPublic", "نشر في الصفحة الرئيسية")}</Label>
              <p className="text-xs text-muted-foreground mt-1">{t("projects.isPublicHint", "يظهر كبرنامج قادم للزوار")}</p>
            </div>
            <Switch id="isPublic" checked={!!form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="enjazEnabled">{t("projects.enjazEnabled", "تفعيل نظام التحفيز إنجاز")}</Label>
              <p className="text-xs text-muted-foreground mt-1">{t("projects.enjazEnabledHint", "يُفعل نظام النقاط والمجموعات والمهام والجوائز للمشاركات")}</p>
            </div>
            <Switch id="enjazEnabled" checked={!!form.enjaz_enabled} onCheckedChange={(v) => setForm({ ...form, enjaz_enabled: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={saving}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
