import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Paperclip, TrendingUp, TrendingDown, Wallet, Download } from "lucide-react";
import { toast } from "sonner";
import { FinanceFormDialog, FinanceTx } from "@/components/FinanceFormDialog";
import { logAudit } from "@/lib/audit";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Row extends FinanceTx { id: string; project_name?: string | null; attachment_count?: number }

const Finance = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [projects, setProjects] = useState<{ id: string; name_ar: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTx | null>(null);
  const [filter, setFilter] = useState({ from: "", to: "", direction: "all", project: "all", q: "" });
  const { confirm, ConfirmDialogNode } = useConfirm();

  const load = async () => {
    let q = supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false });
    if (filter.from) q = q.gte("transaction_date", filter.from);
    if (filter.to) q = q.lte("transaction_date", filter.to);
    if (filter.direction !== "all") q = q.eq("direction", filter.direction as "income" | "expense");
    if (filter.project !== "all") q = q.eq("project_id", filter.project);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as Row[];
    // attach project names + attachment counts
    const ids = list.map((r) => r.id);
    if (ids.length) {
      const { data: atts } = await supabase.from("system_attachments").select("entity_id").in("entity_id", ids).eq("entity_type", "finance_transaction");
      const counts: Record<string, number> = {};
      (atts ?? []).forEach((a: any) => counts[a.entity_id] = (counts[a.entity_id] ?? 0) + 1);
      list.forEach((r) => r.attachment_count = counts[r.id] ?? 0);
    }
    const projMap = Object.fromEntries(projects.map((p) => [p.id, p.name_ar]));
    list.forEach((r) => r.project_name = r.project_id ? projMap[r.project_id] : null);
    setRows(list);
  };

  useEffect(() => {
    supabase.from("projects").select("id, name_ar").order("name_ar").then(({ data }) => setProjects(data ?? []));
  }, []);
  useEffect(() => { load(); }, [filter, projects]);

  const filtered = useMemo(() => {
    if (!filter.q) return rows;
    const q = filter.q.toLowerCase();
    return rows.filter((r) =>
      (r.party ?? "").toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.category ?? "").toLowerCase().includes(q));
  }, [rows, filter.q]);

  const totals = useMemo(() => {
    const income = filtered.filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.amount), 0);
    const expense = filtered.filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.amount), 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const handleDelete = async (id: string) => {
    if (!(await confirm(t("finance.deleteConfirm")))) return;
    const { data: atts } = await supabase.from("system_attachments").select("file_path").eq("entity_id", id).eq("entity_type", "finance_transaction");
    if (atts?.length) await supabase.storage.from("finance-attachments").remove(atts.map((a) => a.file_path));
    const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit("delete", "finance_transaction", id);
    toast.success(t("finance.deleted"));
    load();
  };

  const downloadAtt = async (txId: string) => {
    const { data } = await supabase.from("system_attachments").select("file_path, file_name").eq("entity_id", txId).eq("entity_type", "finance_transaction");
    for (const a of data ?? []) {
      const { data: signed } = await supabase.storage.from("finance-attachments").createSignedUrl(a.file_path, 60);
      if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-background/50 p-4 md:p-8">
      {ConfirmDialogNode}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-1">
          {t("finance.title")}
        </h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="rounded-xl font-bold shadow-sm">
          <Plus className="h-4 w-4" />{t("finance.new")}
        </Button>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        {[
          { k: "income", v: totals.income, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-800/30", label: t("finance.income") },
          { k: "expense", v: totals.expense, icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-100 dark:border-red-800/30", label: t("finance.expense") },
          { k: "balance", v: totals.balance, icon: Wallet, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-100 dark:border-blue-800/30", label: t("finance.balance") },
        ].map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className={`p-6 rounded-3xl flex flex-col justify-between hover:-translate-y-1 transition-transform shadow-sm border ${s.bg} ${s.border}`}>
              <div className="bg-white dark:bg-card/50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm mb-6">
                <Icon className={`h-7 w-7 ${s.color}`} />
              </div>
              <div>
                <p className={`text-sm font-bold mb-1 opacity-80 ${s.color}`}>{s.label}</p>
                <p className={`text-4xl font-black ${s.color}`}>{fmt(s.v)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("common.search")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder={t("common.search")} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <Select value={filter.direction} onValueChange={(v) => setFilter({ ...filter, direction: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("finance.filterAll")}</SelectItem>
              <SelectItem value="income">{t("finance.income")}</SelectItem>
              <SelectItem value="expense">{t("finance.expense")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.project} onValueChange={(v) => setFilter({ ...filter, project: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("finance.filterAll")}</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          <Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("finance.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="p-3 text-start">{t("finance.date")}</th>
                    <th className="p-3 text-start">{t("finance.direction")}</th>
                    <th className="p-3 text-start">{t("finance.amount")}</th>
                    <th className="p-3 text-start">{t("finance.party")}</th>
                    <th className="p-3 text-start">{t("finance.project")}</th>
                    <th className="p-3 text-start">{t("finance.category")}</th>
                    <th className="p-3 text-start">{t("finance.description")}</th>
                    <th className="p-3 text-start">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">{r.transaction_date}</td>
                      <td className="p-3">
                        <Badge variant={r.direction === "income" ? "default" : "destructive"} className={r.direction === "income" ? "bg-success" : ""}>
                          {t(`finance.${r.direction}`)}
                        </Badge>
                      </td>
                      <td className={`p-3 font-medium ${r.direction === "income" ? "text-success" : "text-destructive"}`}>
                        {fmt(Number(r.amount))}
                      </td>
                      <td className="p-3">{r.party || "—"}</td>
                      <td className="p-3">{r.project_name || "—"}</td>
                      <td className="p-3">{r.category || "—"}</td>
                      <td className="p-3 max-w-xs truncate">{r.description || "—"}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {!!r.attachment_count && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadAtt(r.id)} title={`${r.attachment_count}`}>
                              <Paperclip className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(r); setOpen(true); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FinanceFormDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={load} />
    </div>
  );
};

export default Finance;
