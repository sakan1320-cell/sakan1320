import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

interface Project { id: string; name_ar: string; name_en: string | null; }
interface Branch { id: string; name_ar: string; project_id: string; }
interface AttendanceRow {
  id: string;
  project_id: string;
  branch_id: string | null;
  subject_type: "employee" | "participant";
  subject_id: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  created_at: string;
}

const AttendanceReport = () => {
  const { t, i18n } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [projectId, setProjectId] = useState<string>("_all");
  const [branchId, setBranchId] = useState<string>("_all");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState<string>("_all");
  const [typeFilter, setTypeFilter] = useState<string>("_all");

  const [rawRows, setRawRows] = useState<AttendanceRow[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("id, name_ar, name_en").order("name_ar").then(({ data }) => setProjects(data ?? []));
    supabase.from("project_branches").select("id, name_ar, project_id").order("name_ar").then(({ data }) => setBranches(data ?? []));
  }, []);

  const filteredBranches = useMemo(
    () => branches.filter((b) => projectId === "_all" || b.project_id === projectId),
    [branches, projectId],
  );

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("attendance")
      .select("id, project_id, branch_id, subject_type, subject_id, date, status, created_at")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });
    if (projectId !== "_all") q = q.eq("project_id", projectId);
    if (branchId !== "_all") q = q.eq("branch_id", branchId);
    if (typeFilter !== "_all") q = q.eq("subject_type", typeFilter as "employee" | "participant");
    const { data } = await q;
    const rows = (data ?? []) as AttendanceRow[];
    setRawRows(rows);

    const partIds = Array.from(new Set(rows.filter((r) => r.subject_type === "participant").map((r) => r.subject_id)));
    const empIds = Array.from(new Set(rows.filter((r) => r.subject_type === "employee").map((r) => r.subject_id)));
    const map = new Map<string, string>();
    if (partIds.length) {
      const { data: parts } = await supabase.from("participants").select("id, full_name").in("id", partIds);
      (parts ?? []).forEach((p) => map.set(`participant:${p.id}`, p.full_name));
    }
    if (empIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", empIds);
      (profs ?? []).forEach((p) => map.set(`employee:${p.id}`, p.full_name || p.email || p.id.slice(0, 8)));
    }
    setNameMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId, branchId, from, to, typeFilter]);

  const dedupedRows = useMemo(() => {
    const byKey = new Map<string, AttendanceRow>();
    rawRows.forEach((r) => {
      const key = `${r.subject_type}:${r.subject_id}:${r.date}`;
      const existing = byKey.get(key);
      if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
        byKey.set(key, r);
      }
    });
    let arr = Array.from(byKey.values());
    if (statusFilter !== "_all") arr = arr.filter((r) => r.status === statusFilter);
    arr.sort((a, b) => (a.date === b.date ? a.subject_id.localeCompare(b.subject_id) : (a.date < b.date ? 1 : -1)));
    return arr;
  }, [rawRows, statusFilter]);

  const summary = useMemo(() => {
    const total = dedupedRows.length;
    const present = dedupedRows.filter((r) => r.status === "present").length;
    const absent = dedupedRows.filter((r) => r.status === "absent").length;
    const late = dedupedRows.filter((r) => r.status === "late").length;
    const excused = dedupedRows.filter((r) => r.status === "excused").length;
    const absencePct = total ? Math.round((absent / total) * 100) : 0;
    return { total, present, absent, late, excused, absencePct };
  }, [dedupedRows]);

  const projectName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return "—";
    return i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar);
  };
  const branchName = (id: string | null) => id ? (branches.find((b) => b.id === id)?.name_ar ?? "—") : "—";

  const statusBadge = (s: AttendanceRow["status"]) => {
    const cls = {
      present: "bg-success/10 text-success border-success/20",
      late: "bg-warning/10 text-warning-foreground border-warning/20",
      absent: "bg-destructive/10 text-destructive border-destructive/20",
      excused: "bg-muted text-muted-foreground",
    }[s];
    return <Badge variant="outline" className={cls}>{t(`attendance.statuses.${s}`)}</Badge>;
  };

  const exportCsv = () => {
    const header = ["date", "name", "type", "project", "branch", "status"];
    const lines = [header.join(",")];
    dedupedRows.forEach((r) => {
      const name = nameMap.get(`${r.subject_type}:${r.subject_id}`) ?? r.subject_id;
      const row = [
        r.date,
        `"${name.replace(/"/g, '""')}"`,
        t(`attendance.types.${r.subject_type}`),
        `"${projectName(r.project_id).replace(/"/g, '""')}"`,
        `"${branchName(r.branch_id).replace(/"/g, '""')}"`,
        t(`attendance.statuses.${r.status}`),
      ];
      lines.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("attendance.project")}</label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setBranchId("_all"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("common.all")}</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{i18n.language === "ar" ? p.name_ar : (p.name_en || p.name_ar)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("attendance.branch")}</label>
            <Select value={branchId} onValueChange={setBranchId} disabled={projectId === "_all"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("common.all")}</SelectItem>
                {filteredBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("attendance.from")}</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("attendance.to")}</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("attendance.status")}</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("common.all")}</SelectItem>
                {(["present", "absent", "late", "excused"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`attendance.statuses.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("attendance.type")}</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t("common.all")}</SelectItem>
                <SelectItem value="employee">{t("attendance.types.employee")}</SelectItem>
                <SelectItem value="participant">{t("attendance.types.participant")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-6">
        {[
          { k: "total", v: summary.total, cls: "" },
          { k: "present", v: summary.present, cls: "text-success" },
          { k: "absent", v: summary.absent, cls: "text-destructive" },
          { k: "late", v: summary.late, cls: "text-warning-foreground" },
          { k: "excused", v: summary.excused, cls: "text-amber-600" },
          { k: "absenceRate", v: `${summary.absencePct}%`, cls: "text-destructive" },
        ].map((s) => (
          <Card key={s.k}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t(`attendance.summary.${s.k}`)}</p>
              <p className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv} disabled={dedupedRows.length === 0}>
          <Download className="h-4 w-4 me-2" />{t("attendance.exportCsv")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : dedupedRows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("attendance.noRecords")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("attendance.date")}</TableHead>
                  <TableHead>{t("attendance.name")}</TableHead>
                  <TableHead>{t("attendance.type")}</TableHead>
                  <TableHead>{t("attendance.project")}</TableHead>
                  <TableHead>{t("attendance.branch")}</TableHead>
                  <TableHead>{t("attendance.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dedupedRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground" dir="ltr">{r.date}</TableCell>
                    <TableCell className="font-medium">{nameMap.get(`${r.subject_type}:${r.subject_id}`) ?? r.subject_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline">{t(`attendance.types.${r.subject_type}`)}</Badge></TableCell>
                    <TableCell className="text-sm">{projectName(r.project_id)}</TableCell>
                    <TableCell className="text-sm">{branchName(r.branch_id)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReport;
