import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export interface FinanceTx {
  id?: string;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  transaction_date: string;
  party: string | null;
  project_id: string | null;
  branch_id: string | null;
  category: string | null;
  description: string | null;
  notes: string | null;
}

interface Project { id: string; name_ar: string }
interface Branch { id: string; name_ar: string; project_id: string }
interface Att { id: string; file_name: string; file_path: string }

export const FinanceFormDialog = ({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: FinanceTx | null;
  onSaved: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tx, setTx] = useState<FinanceTx>(blank());
  const [files, setFiles] = useState<File[]>([]);
  const [existingAtt, setExistingAtt] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false);

  function blank(): FinanceTx {
    return { direction: "expense", amount: 0, currency: "SAR",
      transaction_date: new Date().toISOString().slice(0, 10),
      party: "", project_id: null, branch_id: null,
      category: "", description: "", notes: "" };
  }

  useEffect(() => {
    if (!open) return;
    setTx(initial ?? blank());
    setFiles([]);
    supabase.from("projects").select("id, name_ar").order("name_ar").then(({ data }) => setProjects(data ?? []));
    supabase.from("project_branches").select("id, name_ar, project_id").then(({ data }) => setBranches(data ?? []));
    if (initial?.id) {
      supabase.from("system_attachments").select("id, file_name, file_path").eq("entity_id", initial.id).eq("entity_type", "finance_transaction")
        .then(({ data }) => setExistingAtt(data ?? []));
    } else setExistingAtt([]);
  }, [open, initial]);

  const filteredBranches = branches.filter((b) => !tx.project_id || b.project_id === tx.project_id);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const valid = list.filter((f) => f.size <= 20 * 1024 * 1024);
    if (valid.length < list.length) toast.error("بعض الملفات تجاوزت 20MB");
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeNewFile = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const removeExisting = async (a: Att) => {
    await supabase.storage.from("finance-attachments").remove([a.file_path]);
    await supabase.from("system_attachments").delete().eq("id", a.id);
    setExistingAtt((p) => p.filter((x) => x.id !== a.id));
  };

  const handleSave = async () => {
    if (!tx.amount || tx.amount <= 0) { toast.error(t("finance.amount") + " > 0"); return; }
    setBusy(true);
    try {
      const payload = {
        ...tx,
        party: tx.party || null,
        category: tx.category || null,
        description: tx.description || null,
        notes: tx.notes || null,
        project_id: tx.project_id || null,
        branch_id: tx.branch_id || null,
      };
      let txId = tx.id;
      if (tx.id) {
        const { error } = await supabase.from("finance_transactions").update(payload).eq("id", tx.id);
        if (error) throw error;
        await logAudit("update", "finance_transaction", tx.id);
      } else {
        const { data, error } = await supabase.from("finance_transactions")
          .insert([{ ...payload, created_by: user!.id }]).select("id").single();
        if (error) throw error;
        txId = data.id;
        await logAudit("create", "finance_transaction", txId);
      }
      // Upload new files
      for (const f of files) {
        const path = `${txId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("finance-attachments").upload(path, f);
        if (upErr) { toast.error(upErr.message); continue; }
        await supabase.from("system_attachments").insert([{
          entity_type: "finance_transaction", entity_id: txId, file_path: path, file_name: f.name,
          mime_type: f.type, size_bytes: f.size, uploaded_by: user!.id,
        }]);
      }
      toast.success(t("finance.saved"));
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx.id ? t("finance.edit") : t("finance.new")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("finance.direction")} *</Label>
            <Select value={tx.direction} onValueChange={(v) => setTx({ ...tx, direction: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t("finance.income")}</SelectItem>
                <SelectItem value="expense">{t("finance.expense")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("finance.amount")} *</Label>
            <Input type="number" step="0.01" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>{t("finance.currency")}</Label>
            <Input value={tx.currency} onChange={(e) => setTx({ ...tx, currency: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("finance.date")} *</Label>
            <Input type="date" value={tx.transaction_date} onChange={(e) => setTx({ ...tx, transaction_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("finance.party")}</Label>
            <Input value={tx.party ?? ""} onChange={(e) => setTx({ ...tx, party: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("finance.category")}</Label>
            <Input value={tx.category ?? ""} onChange={(e) => setTx({ ...tx, category: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("finance.project")}</Label>
            <Select value={tx.project_id ?? "none"} onValueChange={(v) => setTx({ ...tx, project_id: v === "none" ? null : v, branch_id: null })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("finance.noProject")}</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("finance.branch")}</Label>
            <Select value={tx.branch_id ?? "none"} onValueChange={(v) => setTx({ ...tx, branch_id: v === "none" ? null : v })} disabled={!tx.project_id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {filteredBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("finance.description")}</Label>
            <Textarea value={tx.description ?? ""} onChange={(e) => setTx({ ...tx, description: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("finance.notes")}</Label>
            <Textarea value={tx.notes ?? ""} onChange={(e) => setTx({ ...tx, notes: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("finance.attachments")}</Label>
            <div className="flex flex-wrap gap-2">
              {existingAtt.map((a) => (
                <Badge key={a.id} variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />{a.file_name}
                  <button onClick={() => removeExisting(a)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {files.map((f, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {f.name}
                  <button onClick={() => removeNewFile(i)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-input px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />{t("finance.uploadFile")}
              <input type="file" multiple className="hidden" onChange={handleFiles} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={busy}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
