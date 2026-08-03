import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemComments } from "./SystemComments";
import { SystemTimeline } from "./SystemTimeline";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "new" | "in_progress" | "completed" | "overdue";

export interface TaskFormValue {
  id?: string;
  title: string;
  description?: string | null;
  project_id?: string;
  branch_id?: string | null;
  assignee_id?: string | null;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TaskFormValue;
  defaultProjectId?: string;
  onSaved: (id: string, isNew: boolean) => void;
}

export const TaskFormDialog = ({ open, onOpenChange, initial, defaultProjectId, onSaved }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState<TaskFormValue>({
    title: "", description: "", priority: "medium", status: "new",
    project_id: defaultProjectId, branch_id: null, assignee_id: null, due_date: "",
  });
  const [projects, setProjects] = useState<Array<{ id: string; name_ar: string; name_en: string | null }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name_ar: string; name_en: string | null }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? {
        title: "", description: "", priority: "medium", status: "new",
        project_id: defaultProjectId, branch_id: null, assignee_id: null, due_date: "",
      });
      Promise.all([
        supabase.from("projects").select("id, name_ar, name_en"),
        supabase.from("profiles").select("id, full_name, email"),
      ]).then(([pj, us]) => {
        setProjects(pj.data ?? []);
        setUsers(us.data ?? []);
      });
    }
  }, [open, initial, defaultProjectId]);

  useEffect(() => {
    if (form.project_id) {
      supabase.from("project_branches").select("id, name_ar, name_en").eq("project_id", form.project_id).then(({ data }) => setBranches(data ?? []));
    } else {
      setBranches([]);
    }
  }, [form.project_id]);

  const submit = async () => {
    if (!form.title.trim() || !form.project_id) { toast.error(t("common.required")); return; }
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      project_id: form.project_id,
      branch_id: form.branch_id || null,
      assignee_id: form.assignee_id || null,
      priority: form.priority ?? "medium",
      status: form.status ?? "new",
      due_date: form.due_date || null,
    };
    let id = form.id;
    const isNew = !id;
    if (id) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("tasks").insert([{ ...payload, created_by: user?.id }]).select("id").single();
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? t("tasks.edit") : t("tasks.new")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="details">{t("common.details", "التفاصيل")}</TabsTrigger>
            <TabsTrigger value="comments" disabled={!form.id}>{t("comments.title", "التعليقات")}</TabsTrigger>
            <TabsTrigger value="timeline" disabled={!form.id}>{t("events.timeline", "الخط الزمني")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4">
            <div className="space-y-2">
              <Label>{t("tasks.titleField")} *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("tasks.description")}</Label>
              <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("tasks.project")} *</Label>
              <Select value={form.project_id ?? ""} onValueChange={(v) => setForm({ ...form, project_id: v, branch_id: null })} disabled={!!defaultProjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {branches.length > 0 && (
              <div className="space-y-2">
                <Label>{t("tasks.branch")}</Label>
                <Select value={form.branch_id ?? "none"} onValueChange={(v) => setForm({ ...form, branch_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none")}</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("tasks.priority")}</Label>
                <Select value={form.priority ?? "medium"} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["low","medium","high","urgent"] as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>{t(`tasks.priorities.${p}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
                <Select value={form.status ?? "new"} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["new","in_progress","completed","overdue"] as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{t(`tasks.statuses.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("tasks.dueDate")}</Label>
                <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("tasks.assignee")}</Label>
                <Select value={form.assignee_id ?? "none"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none")}</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {form.id && (
            <>
              <TabsContent value="comments" className="mt-0">
                <SystemComments entityType="task" entityId={form.id} />
              </TabsContent>
              <TabsContent value="timeline" className="mt-0">
                <SystemTimeline entityType="task" entityId={form.id} />
              </TabsContent>
            </>
          )}
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={saving}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
