import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Status = "planned" | "in_progress" | "completed" | "stalled";

export interface BranchFormValue {
  id?: string;
  name_ar: string;
  name_en?: string | null;
  branch_manager_id?: string | null;
  status?: Status;
  start_date?: string | null;
  end_date?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  initial?: BranchFormValue;
  onSaved: (id: string, isNew: boolean) => void;
}

export const BranchFormDialog = ({ open, onOpenChange, projectId, initial, onSaved }: Props) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<BranchFormValue>({ name_ar: "", name_en: "", status: "planned", branch_manager_id: null, start_date: "", end_date: "" });
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { name_ar: "", name_en: "", status: "planned", branch_manager_id: null, start_date: "", end_date: "" });
      supabase.from("profiles").select("id, full_name, email").then(({ data }) => setUsers(data ?? []));
    }
  }, [open, initial]);

  const submit = async () => {
    if (!form.name_ar.trim()) { toast.error(t("common.required")); return; }
    setSaving(true);
    const payload = {
      project_id: projectId,
      name_ar: form.name_ar,
      name_en: form.name_en || null,
      branch_manager_id: form.branch_manager_id || null,
      status: form.status ?? "planned",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    let id = form.id;
    const isNew = !id;
    if (id) {
      const { error } = await supabase.from("project_branches").update(payload).eq("id", id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("project_branches").insert([payload]).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      id = data.id;
    }
    toast.success(t("common.success"));
    setSaving(false);
    onOpenChange(false);
    onSaved(id!, isNew);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? t("branches.edit") : t("branches.new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("branches.nameAr")} *</Label>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("branches.nameEn")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span></Label>
            <Input value={form.name_en ?? ""} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder={t("projects.nameEnHint", "يُولّد تلقائيًا إن تُرك فارغًا")} />
          </div>
          <div className="space-y-2">
            <Label>{t("projects.status")}</Label>
            <Select value={form.status ?? "planned"} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["planned","in_progress","completed","stalled"] as Status[]).map((s) => (
                  <SelectItem key={s} value={s}>{t(`projects.statuses.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("branches.manager")}</Label>
            <Select value={form.branch_manager_id ?? "none"} onValueChange={(v) => setForm({ ...form, branch_manager_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("projects.startDate")}</Label>
              <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("projects.endDate")}</Label>
              <Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
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
