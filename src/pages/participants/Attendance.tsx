import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { CheckCircle2, Search } from "lucide-react";

interface Project { id: string; name_ar: string; name_en: string | null; whatsapp_automation_enabled: boolean; start_date?: string | null; end_date?: string | null; }
interface Branch { id: string; name_ar: string; project_id: string; }
interface Group { id: string; name_ar: string; project_id: string; }
interface Participant { id: string; full_name: string; project_id: string; branch_id: string | null; group_id: string | null; }
interface Member { user_id: string; project_id: string; branch_id: string | null; }
interface Profile { id: string; full_name: string | null; email: string | null; }

type Status = "present" | "absent" | "late" | "excused";
type Row = {
  key: string;
  subject_type: "employee" | "participant";
  subject_id: string;
  name: string;
  project_id: string;
  project_name: string;
  status?: Status;
  group_id?: string | null;
  branch_id?: string | null;
};

const BulkSelectDropdown = ({ 
  projects, groups, branches, filteredList, selectedRows, setSelectedRows, isMarkedTable 
}: { 
  projects: Project[], groups: Group[], branches: Branch[], filteredList: Row[], selectedRows: string[], 
  setSelectedRows: React.Dispatch<React.SetStateAction<string[]>>, 
  isMarkedTable: boolean 
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <DropdownMenu open={open} onOpenChange={setOpen} dir="rtl">
        <DropdownMenuTrigger asChild>
          <div className="absolute inset-0 w-full h-full pointer-events-none" />
        </DropdownMenuTrigger>
        
        <div 
          className="flex items-center justify-center cursor-pointer p-3"
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Checkbox 
            checked={filteredList.length > 0 && filteredList.every(p => selectedRows.includes(p.key))}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedRows(prev => [...new Set([...prev, ...filteredList.map(p => p.key)])]);
              } else {
                setSelectedRows(prev => prev.filter(key => !filteredList.find(p => p.key === key)));
              }
            }}
          />
        </div>
        
        <DropdownMenuContent align="end" dir="rtl" className="w-56 text-xs shadow-xl rounded-xl">
          {projects.map(p => {
            const projBranches = branches.filter(b => b.project_id === p.id);
            const projGroups = groups.filter(g => g.project_id === p.id);

            if (projBranches.length === 0 && projGroups.length === 0) {
              return (
                <DropdownMenuItem key={p.id} onClick={() => {
                  const keys = filteredList.filter(r => r.project_id === p.id).map(r => r.key);
                  setSelectedRows(prev => [...new Set([...prev, ...keys])]);
                  toast.success(`تم تحديد ${keys.length} شخص`);
                  setOpen(false);
                }}>
                  {p.name_ar}
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuSub key={p.id}>
                <DropdownMenuSubTrigger className="text-xs p-0 w-full hover:bg-accent focus:bg-accent rounded-sm">
                  <div 
                    className="flex-1 py-1.5 px-2 cursor-pointer outline-none"
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation(); 
                      const keys = filteredList.filter(r => r.project_id === p.id).map(r => r.key);
                      setSelectedRows(prev => [...new Set([...prev, ...keys])]);
                      toast.success(`تم تحديد ${keys.length} شخص`);
                      setOpen(false); 
                    }}
                  >
                    {p.name_ar}
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent dir="rtl" className="text-xs rounded-xl shadow-xl max-h-64 overflow-y-auto">
                  {projBranches.map(b => {
                    if (projGroups.length === 0) {
                      return (
                        <DropdownMenuItem key={b.id} onClick={() => {
                          const keys = filteredList.filter(r => r.branch_id === b.id).map(r => r.key);
                          setSelectedRows(prev => [...new Set([...prev, ...keys])]);
                          toast.success(`تم تحديد ${keys.length} شخص`);
                          setOpen(false);
                        }}>
                          {b.name_ar}
                        </DropdownMenuItem>
                      );
                    }

                    return (
                      <DropdownMenuSub key={b.id}>
                        <DropdownMenuSubTrigger className="text-xs p-0 w-full hover:bg-accent focus:bg-accent rounded-sm">
                          <div 
                            className="flex-1 py-1.5 px-2 cursor-pointer outline-none"
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation(); 
                              const keys = filteredList.filter(r => r.branch_id === b.id).map(r => r.key);
                              setSelectedRows(prev => [...new Set([...prev, ...keys])]);
                              toast.success(`تم تحديد ${keys.length} شخص`);
                              setOpen(false); 
                            }}
                          >
                            {b.name_ar}
                          </div>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent dir="rtl" className="text-xs rounded-xl shadow-xl max-h-64 overflow-y-auto">
                          {projGroups.map(g => (
                            <DropdownMenuItem key={g.id} onClick={() => {
                              const keys = filteredList.filter(r => r.group_id === g.id).map(r => r.key);
                              setSelectedRows(prev => [...new Set([...prev, ...keys])]);
                              toast.success(`تم تحديد ${keys.length} شخص`);
                              setOpen(false);
                            }}>
                              {g.name_ar}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
          
          {isMarkedTable && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">تحديد حسب الحالة</DropdownMenuSubTrigger>
              <DropdownMenuSubContent dir="rtl" className="text-xs rounded-xl shadow-xl max-h-64 overflow-y-auto">
                {(["present", "absent", "late", "excused"] as const).map(s => (
                  <DropdownMenuItem key={s} onClick={() => {
                    const keys = filteredList.filter(p => p.status === s).map(p => p.key);
                    setSelectedRows(prev => [...new Set([...prev, ...keys])]);
                    setOpen(false);
                  }}>
                    {s === "present" ? "حاضر" : s === "absent" ? "غائب" : s === "late" ? "متأخر" : "مستأذن"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const Attendance = () => {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [notifiedToday, setNotifiedToday] = useState<Set<string>>(new Set());
  
  const [searchUnmarked, setSearchUnmarked] = useState("");
  const [searchMarked, setSearchMarked] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("projects").select("id, name_ar, name_en, whatsapp_automation_enabled, start_date, end_date").order("name_ar").then(({ data }) => setProjects(data ?? []));
    supabase.from("project_branches").select("id, name_ar, project_id").order("name_ar").then(({ data }) => setBranches(data ?? []));
    supabase.from("project_groups").select("id, name_ar, project_id").order("name_ar").then(({ data }) => setGroups(data ?? []));
  }, []);

  const loadNotifiedToday = async (currentDate: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("related_entity_id")
      .eq("channel", "whatsapp")
      .eq("related_entity_type", "participant")
      .eq("status", "sent")
      .in("template", ["absence_alert", "late_alert", "attendance_absence_notice", "late_arrival_notice"])
      .gte("created_at", `${currentDate}T00:00:00.000Z`)
      .lte("created_at", `${currentDate}T23:59:59.999Z`);
    const ids = new Set<string>((data || []).map(n => n.related_entity_id).filter(Boolean));
    setNotifiedToday(ids);
  };

  const loadPeople = async () => {
    if (projects.length === 0) return;
    setLoading(true);

    const projectMap = new Map<string, string>();
    projects.forEach(p => projectMap.set(p.id, p.name_ar));

    const [{ data: parts }, { data: members }, { data: existing }] = await Promise.all([
      supabase.from("participants").select("id, full_name, project_id, branch_id, group_id").eq("status", "active"),
      supabase.from("project_members").select("user_id, project_id, branch_id"),
      supabase.from("attendance").select("subject_type, subject_id, status, project_id").eq("date", date),
    ]);

    let profiles: Profile[] = [];
    const uids = (members ?? []).map((m) => m.user_id);
    if (uids.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", uids);
      profiles = data ?? [];
    }

    const existingMap = new Map<string, Status>();
    (existing ?? []).forEach((e) => existingMap.set(`${e.subject_type}:${e.subject_id}:${e.project_id}`, e.status as Status));

    const built: Row[] = [];
    (parts ?? []).forEach((p: Participant) => {
      const k = `participant:${p.id}:${p.project_id}`;
      built.push({
        key: k, subject_type: "participant", subject_id: p.id,
        name: p.full_name, status: existingMap.get(k),
        project_id: p.project_id, project_name: projectMap.get(p.project_id) || "-",
        branch_id: p.branch_id, group_id: p.group_id
      });
    });
    (members ?? []).forEach((m: Member) => {
      const prof = profiles.find((x) => x.id === m.user_id);
      const k = `employee:${m.user_id}:${m.project_id}`;
      built.push({
        key: k, subject_type: "employee", subject_id: m.user_id,
        name: prof?.full_name || prof?.email || m.user_id.slice(0, 8), status: existingMap.get(k),
        project_id: m.project_id, project_name: projectMap.get(m.project_id) || "-",
        branch_id: m.branch_id
      });
    });
    setRows(built);
    setLoading(false);
  };

  useEffect(() => { 
    if (projects.length > 0) {
      loadPeople(); 
      loadNotifiedToday(date);
    }
  }, [projects, date]);

  const handleAutomations = async (status: Status, targetKeys: string[]) => {
    if (status !== "absent" && status !== "late") return;
    try {
      const targetParticipants = rows.filter(r => targetKeys.includes(r.key) && r.subject_type === "participant");
      
      const triggerKey = status === "absent" ? "absence_recorded" : "late_recorded";
      const { data: automations } = await supabase
        .from("whatsapp_automation_settings")
        .select("*")
        .eq("is_active", true)
        .eq("trigger_event", triggerKey);
        
      if (!automations || automations.length === 0) return;

      let autoSent = 0;
      let alreadySent = 0;

      for (const row of targetParticipants) {
        if (notifiedToday.has(row.subject_id)) {
          alreadySent++;
          continue;
        }

        const projectData = projects.find(p => p.id === row.project_id);
        if (!projectData?.whatsapp_automation_enabled) continue;

        const automation = automations.find(a => a.project_id === row.project_id);
        if (!automation) continue;

        const { data: pData } = await supabase
          .from("participants")
          .select("full_name, guardian_phone, guardian_name")
          .eq("id", row.subject_id)
          .single();

        if (!pData?.guardian_phone) continue;

        const delay = automation.delay_minutes || 0;
        const sendFn = async () => {
          await supabase.functions.invoke("send-notification", {
            body: {
              template: automation.template_key,
              channel: "whatsapp",
              recipient_phone: pData.guardian_phone,
              recipient_name: pData.guardian_name || pData.full_name,
              related_entity_type: "participant",
              related_entity_id: row.subject_id,
              variables: {
                guardian_name: pData.guardian_name || "ولي الأمر",
                participant_name: pData.full_name,
                project_name: projectData?.name_ar || "",
                date,
                "1": pData.guardian_name || "ولي الأمر",
                "2": pData.full_name,
                "3": date,
                "4": projectData?.name_ar || "",
              },
            },
          });
        };

        if (delay > 0) {
          setTimeout(sendFn, delay * 60 * 1000);
        } else {
          await sendFn();
        }
        autoSent++;
        setNotifiedToday(prev => new Set([...prev, row.subject_id]));
      }

      if (autoSent > 0) toast.success(`📲 تم إرسال ${autoSent} رسالة واتساب تلقائي لأولياء الأمور`);
      if (alreadySent > 0) toast.info(`ℹ️ تم تخطي ${alreadySent} مشارك (تم مراسلتهم مسبقاً اليوم)`);

    } catch (e) {
      console.error("Automation error:", e);
    }
  };

  const handleSetStatus = async (key: string, status: Status) => {
    const row = rows.find(r => r.key === key);
    if (!row) return;

    setRows(rs => rs.map(r => r.key === key ? { ...r, status } : r));

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("attendance").upsert({
      subject_type: row.subject_type,
      subject_id: row.subject_id,
      project_id: row.project_id,
      date: date,
      status,
      check_in: status === "present" || status === "late" ? new Date().toISOString() : null,
      recorded_by: user?.id
    }, { onConflict: "subject_type,subject_id,date" });

    if (error) {
      toast.error("حدث خطأ أثناء حفظ التحضير: " + error.message);
      setRows(rs => rs.map(r => r.key === key ? { ...r, status: row.status } : r));
    } else {
      await logAudit("attendance_marked", "attendance", row.project_id, { date, subject_id: row.subject_id, status });
      handleAutomations(status, [key]);
    }
  };

  const handleBulkStatusChange = async (status: Status) => {
    const { data: { user } } = await supabase.auth.getUser();
    const targetKeys = [...selectedRows];
    
    const prevStates = Object.fromEntries(rows.filter(r => targetKeys.includes(r.key)).map(r => [r.key, r.status]));

    setRows(rs => rs.map(r => targetKeys.includes(r.key) ? { ...r, status } : r));
    setSelectedRows([]);

    const payloads = targetKeys.map(k => {
      const row = rows.find(r => r.key === k);
      return {
        subject_type: row!.subject_type,
        subject_id: row!.subject_id,
        project_id: row!.project_id,
        date: date,
        status,
        check_in: status === "present" || status === "late" ? new Date().toISOString() : null,
        recorded_by: user?.id
      };
    });

    const { error } = await supabase.from("attendance").upsert(payloads, { onConflict: "subject_type,subject_id,date" });

    if (error) {
      toast.error("حدث خطأ أثناء الحفظ الجماعي: " + error.message);
      setRows(rs => rs.map(r => targetKeys.includes(r.key) ? { ...r, status: prevStates[r.key] } : r));
    } else {
      toast.success("تم تسجيل الحضور للمجموعة بنجاح");
      handleAutomations(status, targetKeys);
    }
  };

  const unmarkedRows = rows.filter(r => !r.status).filter(r => r.name.toLowerCase().includes(searchUnmarked.toLowerCase()) || r.project_name.toLowerCase().includes(searchUnmarked.toLowerCase()));
  const markedRows = rows.filter(r => r.status).filter(r => r.name.toLowerCase().includes(searchMarked.toLowerCase()) || r.project_name.toLowerCase().includes(searchMarked.toLowerCase()));

  const renderTable = (
    list: Row[], 
    title: string, 
    searchQuery: string, 
    setSearchQuery: (val: string) => void,
    datePickerNode?: React.ReactNode
  ) => {
    return (
      <div className="space-y-3 mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2">
          <h3 className="font-bold text-lg">{title} <span className="text-muted-foreground text-sm font-normal">({list.length})</span></h3>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
            {datePickerNode}
            <div className="relative w-full sm:w-64 flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t("common.search", "بحث بالاسم أو المشروع...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-3 pr-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background text-sm"
              />
            </div>
          </div>
        </div>
        <div className="border border-border/50 rounded-2xl max-h-[500px] overflow-y-auto shadow-sm bg-card">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
              <TableRow className="border-none">
                <TableHead className="w-[50px] p-0 align-middle text-center">
                  <BulkSelectDropdown 
                    projects={projects}
                    groups={groups} 
                    branches={branches} 
                    filteredList={list} 
                    selectedRows={selectedRows} 
                    setSelectedRows={setSelectedRows} 
                    isMarkedTable={list.some(r => r.status)} 
                  />
                </TableHead>
                <TableHead className="font-bold align-middle">{t("attendance.name")}</TableHead>
                <TableHead className="font-bold align-middle">المشروع</TableHead>
                <TableHead className="font-bold align-middle">{t("attendance.type")}</TableHead>
                <TableHead className="text-center font-bold align-middle py-2">
                  <div>{t("attendance.status", "الحالة")}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(p => (
                <TableRow key={p.key} className={selectedRows.includes(p.key) ? "bg-muted/30" : ""}>
                  <TableCell className="w-[50px] p-0 align-middle">
                    <div className="flex items-center justify-center w-full h-full">
                      <Checkbox 
                        checked={selectedRows.includes(p.key)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRows(prev => [...prev, p.key]);
                          } else {
                            setSelectedRows(prev => prev.filter(key => key !== p.key));
                          }
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.name}
                      {p.subject_type === "participant" && notifiedToday.has(p.subject_id) && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1 text-xs px-1.5 py-0" variant="outline">
                          <CheckCircle2 className="w-3 h-3" />
                          تم الرسالة
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.project_name}</TableCell>
                  <TableCell><Badge variant="outline">{t(`attendance.types.${p.subject_type}`)}</Badge></TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
                      {(["present", "late", "absent", "excused"] as const).map(s => {
                        const selected = p.status === s;
                        const colors = {
                          present: "data-[state=active]:bg-emerald-600 data-[state=active]:text-white",
                          late: "data-[state=active]:bg-amber-500 data-[state=active]:text-white",
                          absent: "data-[state=active]:bg-destructive data-[state=active]:text-white",
                          excused: "data-[state=active]:bg-muted-foreground data-[state=active]:text-white"
                        }[s];
                        return (
                          <Button
                            key={s}
                            size="sm"
                            variant={selected ? "default" : "ghost"}
                            data-state={selected ? "active" : "inactive"}
                            onClick={() => handleSetStatus(p.key, s)}
                            className={`h-7 px-2.5 text-xs rounded-md ${colors}`}
                          >
                            {s === "present" ? "حاضر" : s === "late" ? "متأخر" : s === "absent" ? "غائب" : "مستأذن"}
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("common.noData", "لا توجد بيانات")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const DatePickerNode = (
    <Input
      type="date"
      className="rounded-xl h-9 bg-muted/50 border-transparent focus-visible:bg-background transition-colors w-auto text-sm"
      value={date}
      onChange={(e) => setDate(e.target.value)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t("attendance.title")}</h1>
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</CardContent></Card>
      ) : (
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          {unmarkedRows.length > 0 && renderTable(
            unmarkedRows, 
            t("attendance.unmarkedParticipants", "تسجيل الحضور"), 
            searchUnmarked, setSearchUnmarked, 
            DatePickerNode
          )}
          
          {renderTable(
            markedRows, 
            t("attendance.markedParticipants", "سجلات التحضير"), 
            searchMarked, setSearchMarked,
            unmarkedRows.length === 0 ? DatePickerNode : undefined
          )}
        </div>
      )}

      {selectedRows.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-card border border-border/50 shadow-2xl rounded-full px-6 py-4 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <span className="font-bold text-sm whitespace-nowrap">تم تحديد ({selectedRows.length})</span>
          <div className="flex gap-2 border-r pr-6 border-border/50">
            <Button size="sm" onClick={() => handleBulkStatusChange("present")} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">حاضر</Button>
            <Button size="sm" onClick={() => handleBulkStatusChange("absent")} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl">غائب</Button>
            <Button size="sm" onClick={() => handleBulkStatusChange("late")} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">متأخر</Button>
            <Button size="sm" onClick={() => handleBulkStatusChange("excused")} className="bg-muted-foreground hover:bg-muted-foreground/90 text-white rounded-xl">مستأذن</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])} className="rounded-xl text-muted-foreground hover:text-foreground">
            إلغاء
          </Button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
