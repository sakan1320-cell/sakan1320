import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send } from "lucide-react";

interface Person {
  id: string;
  name: string;
  phone: string;
  kind: "employee" | "participant" | "guardian";
  project_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}

export const BulkNotificationDialog = ({ open, onOpenChange, onSent }: Props) => {
  const { t } = useTranslation();
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name_ar: string }>>([]);
  const [filterKind, setFilterKind] = useState<"all" | Person["kind"]>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [emp, part, projs] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone"),
        supabase.from("participants").select("id, full_name, phone, guardian_name, guardian_phone, project_id"),
        supabase.from("projects").select("id, name_ar").order("name_ar"),
      ]);
      const list: Person[] = [];
      (emp.data ?? []).forEach((r: any) => {
        if (r.phone) list.push({ id: `e:${r.id}`, name: r.full_name || r.email || "—", phone: r.phone, kind: "employee" });
      });
      (part.data ?? []).forEach((r: any) => {
        if (r.phone) list.push({ id: `p:${r.id}`, name: r.full_name, phone: r.phone, kind: "participant", project_id: r.project_id });
        if (r.guardian_phone) list.push({ id: `g:${r.id}`, name: r.guardian_name || `ولي أمر ${r.full_name}`, phone: r.guardian_phone, kind: "guardian", project_id: r.project_id });
      });
      setPeople(list);
      setProjects(projs.data ?? []);
    })();
  }, [open]);

  const filtered = people.filter((p) => {
    if (filterKind !== "all" && p.kind !== filterKind) return false;
    if (filterProject !== "all" && p.project_id !== filterProject) return false;
    return true;
  });

  const toggleAll = () => {
    if (filtered.every((p) => selected.has(p.id))) {
      const next = new Set(selected);
      filtered.forEach((p) => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((p) => next.add(p.id));
      setSelected(next);
    }
  };

  const send = async () => {
    if (selected.size === 0 || !body.trim()) { toast.error(t("common.required")); return; }
    setBusy(true);
    const recipients = people
      .filter((p) => selected.has(p.id))
      .map((p) => ({ phone: p.phone, name: p.name }));
    const { data, error } = await supabase.functions.invoke("send-bulk-notifications", {
      body: { recipients, body: body.trim(), channel },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("notifications.bulkResult", { sent: data?.sent ?? 0, failed: data?.failed ?? 0, total: data?.total ?? 0 }));
    setBody("");
    setSelected(new Set());
    onOpenChange(false);
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("notifications.bulkTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>{t("notifications.channel")}</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">{t("notifications.channels.whatsapp")}</SelectItem>
                  <SelectItem value="sms">{t("notifications.channels.sms")}</SelectItem>
                  <SelectItem value="email">{t("notifications.channels.email")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("notifications.audience")}</Label>
              <Select value={filterKind} onValueChange={(v) => setFilterKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="employee">{t("roles.employee")}</SelectItem>
                  <SelectItem value="participant">{t("roles.participant")}</SelectItem>
                  <SelectItem value="guardian">{t("roles.guardian")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("notifications.project")}</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center justify-between gap-3 border-b p-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">{t("notifications.selectAll")}</span>
              </div>
              <Badge variant="secondary">{selected.size} / {filtered.length}</Badge>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{t("common.none")}</p>
                ) : filtered.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(p.id); else next.delete(p.id);
                        setSelected(next);
                      }}
                    />
                    <span className="flex-1 text-sm">{p.name}</span>
                    <Badge variant="outline" className="text-xs">{t(`roles.${p.kind}`)}</Badge>
                    <span className="text-xs text-muted-foreground" dir="ltr">{p.phone}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <Label>{t("notifications.body")} *</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={send} disabled={busy || selected.size === 0 || !body.trim()}>
            <Send className="h-4 w-4 me-2" />{t("notifications.sendBulk")} ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
