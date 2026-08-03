import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--info))", "hsl(var(--warning))"];

const Reports = () => {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [projectId, setProjectId] = useState("all");
  const [projects, setProjects] = useState<{ id: string; name_ar: string; status: string }[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);

  const setQuickPeriod = (p: typeof period) => {
    setPeriod(p);
    const now = new Date();
    if (p === "daily") setFrom(today);
    else if (p === "weekly") setFrom(new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10));
    else if (p === "monthly") setFrom(new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10));
    setTo(today);
  };

  useEffect(() => {
    supabase.from("projects").select("id, name_ar, status").then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    const load = async () => {
      let txQ = supabase.from("finance_transactions").select("*").gte("transaction_date", from).lte("transaction_date", to);
      let tkQ = supabase.from("tasks").select("*").gte("created_at", from).lte("created_at", to + "T23:59:59");
      let paQ = supabase.from("participants").select("*");
      if (projectId !== "all") {
        txQ = txQ.eq("project_id", projectId);
        tkQ = tkQ.eq("project_id", projectId);
        paQ = paQ.eq("project_id", projectId);
      }
      const [{ data: t1 }, { data: t2 }, { data: t3 }] = await Promise.all([txQ, tkQ, paQ]);
      setTx(t1 ?? []); setTasks(t2 ?? []); setParticipants(t3 ?? []);
    };
    load();
  }, [from, to, projectId]);

  const financeByDay = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {};
    tx.forEach((r) => {
      const d = r.transaction_date;
      if (!map[d]) map[d] = { date: d, income: 0, expense: 0 };
      map[d][r.direction as "income" | "expense"] += Number(r.amount);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [tx]);

  const tasksByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    tasks.forEach((tk) => m[tk.status] = (m[tk.status] ?? 0) + 1);
    return Object.entries(m).map(([k, v]) => ({ name: t(`tasks.statuses.${k}`), value: v }));
  }, [tasks, t]);

  const projectsByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach((p) => m[p.status] = (m[p.status] ?? 0) + 1);
    return Object.entries(m).map(([k, v]) => ({ name: t(`projects.statuses.${k}`), value: v }));
  }, [projects, t]);

  const projectRows = useMemo(() => {
    const list = projectId === "all" ? projects : projects.filter((p) => p.id === projectId);
    return list.map((p) => {
      const pTx = tx.filter((r) => r.project_id === p.id);
      const inc = pTx.filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.amount), 0);
      const exp = pTx.filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.amount), 0);
      const pTk = tasks.filter((tk) => tk.project_id === p.id);
      return {
        name: p.name_ar,
        status: t(`projects.statuses.${p.status}`),
        participants: participants.filter((pa) => pa.project_id === p.id).length,
        tasks: pTk.length,
        completed: pTk.filter((tk) => tk.status === "completed").length,
        net: inc - exp,
      };
    });
  }, [projects, tx, tasks, participants, projectId, t]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const excelProjectRows = projectRows.map(r => ({
      "المشروع": r.name,
      "الحالة": r.status,
      "عدد المشاركين": r.participants,
      "المهام الكلية": r.tasks,
      "المهام المنجزة": r.completed,
      "الصافي المالي": r.net
    }));

    const excelTx = tx.map(r => ({
      "المبلغ": r.amount,
      "النوع": r.direction === "income" ? "إيراد" : "مصروف",
      "البيان": r.description || "—",
      "التاريخ": r.transaction_date,
      "المشروع": projects.find(p => p.id === r.project_id)?.name_ar || "—"
    }));

    const excelFinanceByDay = financeByDay.map(r => ({
      "التاريخ": r.date,
      "الإيرادات": r.income,
      "المصروفات": r.expense,
      "الصافي": r.income - r.expense
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelProjectRows), "المشاريع");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelTx), "المعاملات المالية");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelFinanceByDay), "المالية اليومية");
    XLSX.writeFile(wb, `تقرير_سكن_${from}_${to}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    // Note: Standard jsPDF might not render Arabic perfectly without a custom font, 
    // but we are translating as requested.
    doc.text(`تقرير من ${from} إلى ${to}`, 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [["المشروع", "الحالة", "المشاركين", "المهام", "المنجزة", "الصافي"]],
      body: projectRows.map((r) => [r.name, r.status, r.participants, r.tasks, r.completed, r.net.toFixed(2)]),
      styles: { font: "helvetica", halign: "right" }, // fallback if no arabic font loaded
    });
    doc.save(`تقرير_سكن_${from}_${to}.pdf`);
  };

  const totals = {
    income: tx.filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.amount), 0),
    expense: tx.filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.amount), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">{t("reports.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />{t("reports.exportExcel")}</Button>
          <Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4" />{t("reports.exportPdf")}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={period} onValueChange={(v) => setQuickPeriod(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t("reports.daily")}</SelectItem>
              <SelectItem value="weekly">{t("reports.weekly")}</SelectItem>
              <SelectItem value="monthly">{t("reports.monthly")}</SelectItem>
              <SelectItem value="custom">{t("reports.custom")}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setPeriod("custom"); setFrom(e.target.value); }} />
          <Input type="date" value={to} onChange={(e) => { setPeriod("custom"); setTo(e.target.value); }} />
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("reports.allProjects")}</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("reports.overview")}</TabsTrigger>
          <TabsTrigger value="finance">{t("reports.financeReport")}</TabsTrigger>
          <TabsTrigger value="projects">{t("reports.projectsReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("charts.financeOverTime")}</CardTitle></CardHeader>
              <CardContent>
                {financeByDay.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("charts.noData")}</p> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={financeByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip /><Legend />
                      <Line type="monotone" dataKey="income" stroke="hsl(var(--success))" name={t("finance.income")} />
                      <Line type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" name={t("finance.expense")} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{t("charts.tasksByStatus")}</CardTitle></CardHeader>
              <CardContent>
                {tasksByStatus.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("charts.noData")}</p> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={tasksByStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                        {tasksByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("finance.totalIncome")}</div>
              <div className="text-2xl font-bold text-success">{totals.income.toFixed(2)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("finance.totalExpense")}</div>
              <div className="text-2xl font-bold text-destructive">{totals.expense.toFixed(2)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("finance.balance")}</div>
              <div className="text-2xl font-bold">{(totals.income - totals.expense).toFixed(2)}</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("charts.incomeVsExpense")}</CardTitle></CardHeader>
            <CardContent>
              {financeByDay.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("charts.noData")}</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={financeByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} />
                    <Tooltip /><Legend />
                    <Bar dataKey="income" fill="hsl(var(--success))" name={t("finance.income")} />
                    <Bar dataKey="expense" fill="hsl(var(--destructive))" name={t("finance.expense")} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("charts.projectsByStatus")}</CardTitle></CardHeader>
            <CardContent>
              {projectsByStatus.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("charts.noData")}</p> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={projectsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="p-3 text-start">{t("reports.projectName")}</th>
                    <th className="p-3 text-start">{t("reports.status")}</th>
                    <th className="p-3 text-start">{t("reports.participantsCount")}</th>
                    <th className="p-3 text-start">{t("reports.tasksCount")}</th>
                    <th className="p-3 text-start">{t("reports.completedTasks")}</th>
                    <th className="p-3 text-start">{t("reports.netBalance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="p-3">{r.status}</td>
                      <td className="p-3">{r.participants}</td>
                      <td className="p-3">{r.tasks}</td>
                      <td className="p-3">{r.completed}</td>
                      <td className={`p-3 font-medium ${r.net >= 0 ? "text-success" : "text-destructive"}`}>{r.net.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
