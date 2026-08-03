import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, TrendingUp, Save, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import React from "react";

interface Row {
  id: string;
  status: string;
  date: string;
  subject_type: string;
}

const BulkSelectDropdown = ({ 
  groups, branches, filteredList, selectedRows, setSelectedRows, isMarkedTable, attendanceState 
}: { 
  groups: any[], branches: any[], filteredList: any[], selectedRows: string[], 
  setSelectedRows: React.Dispatch<React.SetStateAction<string[]>>, 
  isMarkedTable: boolean, attendanceState: Record<string, string> 
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <DropdownMenu open={open} onOpenChange={setOpen}>
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
            checked={filteredList.length > 0 && filteredList.every(p => selectedRows.includes(p.id))}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedRows(prev => [...new Set([...prev, ...filteredList.map(p => p.id)])]);
              } else {
                setSelectedRows(prev => prev.filter(id => !filteredList.find(p => p.id === id)));
              }
            }}
          />
        </div>
        
        <DropdownMenuContent align="end" className="w-40 text-xs shadow-xl rounded-xl">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">تحديد حسب المجموعة</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="text-xs rounded-xl shadow-xl">
              {groups.map(g => (
                <DropdownMenuItem key={g.id} onClick={() => {
                  const ids = filteredList.filter(p => p.group_id === g.id).map(p => p.id);
                  setSelectedRows(prev => [...new Set([...prev, ...ids])]);
                  setOpen(false);
                }}>
                  {g.name_ar}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">تحديد حسب الفرع</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="text-xs rounded-xl shadow-xl">
              {branches.map(b => (
                <DropdownMenuItem key={b.id} onClick={() => {
                  const ids = filteredList.filter(p => p.branch_id === b.id).map(p => p.id);
                  setSelectedRows(prev => [...new Set([...prev, ...ids])]);
                  setOpen(false);
                }}>
                  {b.name_ar}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {isMarkedTable && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">تحديد حسب الحالة</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="text-xs rounded-xl shadow-xl">
                {(["present", "absent", "late", "excused"] as const).map(s => (
                  <DropdownMenuItem key={s} onClick={() => {
                    const ids = filteredList.filter(p => attendanceState[p.id] === s).map(p => p.id);
                    setSelectedRows(prev => [...new Set([...prev, ...ids])]);
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

export const ProjectAttendanceTab = ({ projectId }: { projectId: string }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attendanceState, setAttendanceState] = useState<Record<string, "present" | "absent" | "late" | "excused">>({});

  const [projectDates, setProjectDates] = useState<{ start: string | null; end: string | null; excluded_weekdays?: number[] | null; excluded_dates?: string[] | null }>({ start: null, end: null });
  const [loading, setLoading] = useState(true);
  const [sortUnmarked, setSortUnmarked] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'full_name', direction: 'asc' });
  const [sortMarked, setSortMarked] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'full_name', direction: 'asc' });
  const [searchUnmarked, setSearchUnmarked] = useState("");
  const [searchMarked, setSearchMarked] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [attRes, partsRes, projRes, groupsRes, branchesRes] = await Promise.all([
      supabase.from("attendance").select("id,status,date,subject_type,subject_id").eq("project_id", projectId).order("date", { ascending: false }).limit(500),
      supabase.from("participants").select("id,full_name,branch_id,group_id").eq("project_id", projectId).eq("status", "active"),
      supabase.from("projects").select("start_date, end_date, excluded_weekdays, excluded_dates").eq("id", projectId).single(),
      supabase.from("project_groups").select("id,name_ar").eq("project_id", projectId),
      supabase.from("project_branches").select("id,name_ar").eq("project_id", projectId)
    ]);
    
    let validRows = (attRes.data ?? []) as Row[];
    if (projRes.data) {
      setProjectDates({ 
        start: projRes.data.start_date, 
        end: projRes.data.end_date,
        excluded_weekdays: projRes.data.excluded_weekdays,
        excluded_dates: projRes.data.excluded_dates
      });
      
      const { start_date, end_date, excluded_weekdays, excluded_dates } = projRes.data;
      validRows = validRows.filter(row => {
        if (start_date && row.date < start_date) return false;
        if (end_date && row.date > end_date) return false;
        if (excluded_dates?.includes(row.date)) return false;
        if (excluded_weekdays?.includes(new Date(row.date).getDay())) return false;
        return true;
      });
    }

    setRows(validRows);
    setParticipants(partsRes.data ?? []);
    setGroups(groupsRes.data ?? []);
    setBranches(branchesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    const fetchDateAttendance = async () => {
      const { data } = await supabase.from("attendance")
        .select("subject_id, status")
        .eq("project_id", projectId)
        .eq("date", attendanceDate)
        .eq("subject_type", "participant");
      const attState: Record<string, "present" | "absent" | "late" | "excused"> = {};
      (data ?? []).forEach(d => {
        attState[d.subject_id] = d.status as "present" | "absent" | "late" | "excused";
      });
      setAttendanceState(attState);
    };
    fetchDateAttendance();
  }, [projectId, attendanceDate]);

  const validateAttendanceDate = () => {
    if (projectDates.start && attendanceDate < projectDates.start) {
      return t("attendance.invalidDateStart", "لا يمكن التحضير قبل تاريخ بداية البرنامج");
    }
    const today = new Date().toISOString().slice(0, 10);
    if (attendanceDate > today) {
      return t("attendance.invalidFutureDate", "لا يمكن التحضير لتاريخ مستقبلي");
    }
    if (projectDates.end && attendanceDate > projectDates.end) {
      return t("attendance.invalidDateEnd", "لا يمكن التحضير بعد تاريخ نهاية البرنامج");
    }
    if (projectDates.excluded_dates?.includes(attendanceDate)) {
      return t("attendance.invalidDateExcluded", "عذراً، هذا اليوم إجازة");
    }
    if (projectDates.excluded_weekdays?.includes(new Date(attendanceDate).getDay())) {
      return t("attendance.invalidWeekday", "عذراً، هذا اليوم غير مجدول ضمن أيام العمل");
    }
    return null;
  };

  const handleSetAttendanceStatus = async (participantId: string, status: "present" | "absent" | "late" | "excused") => {
    const errorMsg = validateAttendanceDate();
    if (errorMsg) return toast.error(errorMsg);

    const prevStatus = attendanceState[participantId];
    const isRemoving = prevStatus === status;

    // Optimistic UI Update
    setAttendanceState(prev => {
      if (isRemoving) {
        const newState = { ...prev };
        delete newState[participantId];
        return newState;
      }
      return { ...prev, [participantId]: status };
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (isRemoving) {
      const { error } = await supabase.from("attendance")
        .delete()
        .eq("subject_type", "participant")
        .eq("subject_id", participantId)
        .eq("project_id", projectId)
        .eq("date", attendanceDate);

      if (error) {
        toast.error("حدث خطأ أثناء إلغاء التحضير: " + error.message);
        setAttendanceState(prev => {
          if (prevStatus) return { ...prev, [participantId]: prevStatus };
          return prev;
        });
      }
    } else {
      const { error } = await supabase.from("attendance").upsert({
        subject_type: "participant",
        subject_id: participantId,
        project_id: projectId,
        date: attendanceDate,
        status,
        recorded_by: user?.id
      }, { onConflict: "subject_type,subject_id,date" });

      if (error) {
        toast.error("حدث خطأ أثناء حفظ التحضير: " + error.message);
        setAttendanceState(prev => {
          if (prevStatus) return { ...prev, [participantId]: prevStatus };
          const newState = { ...prev };
          delete newState[participantId];
          return newState;
        });
      }
    }
  };

  const handleBulkStatusChange = async (status: "present" | "absent" | "late" | "excused") => {
    const errorMsg = validateAttendanceDate();
    if (errorMsg) return toast.error(errorMsg);

    const { data: { user } } = await supabase.auth.getUser();
    const prevStates = { ...attendanceState };
    const targetRows = [...selectedRows];
    
    const payloads = targetRows.map(partId => ({
      subject_type: "participant",
      subject_id: partId,
      project_id: projectId,
      date: attendanceDate,
      status,
      recorded_by: user?.id
    }));

    setAttendanceState(prev => {
      const newState = { ...prev };
      targetRows.forEach(id => {
        newState[id] = status;
      });
      return newState;
    });
    setSelectedRows([]);

    const { error } = await supabase.from("attendance").upsert(payloads, { onConflict: "subject_type,subject_id,date" });

    if (error) {
      toast.error("حدث خطأ أثناء الحفظ الجماعي: " + error.message);
      setAttendanceState(prev => {
        const reverted = { ...prev };
        targetRows.forEach(id => {
          if (prevStates[id]) {
            reverted[id] = prevStates[id];
          } else {
            delete reverted[id];
          }
        });
        return reverted;
      });
    } else {
      toast.success("تم تسجيل الحضور للمجموعة بنجاح");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const total = rows.length;
  const rate = total ? Math.round((present / total) * 100) : 0;
  
  const markedParticipants = participants.filter(p => attendanceState[p.id]);
  const unmarkedParticipants = participants.filter(p => !attendanceState[p.id]);

  const renderTable = (list: any[], title: string, showSelectAll: boolean, sortConfig: { key: string, direction: 'asc' | 'desc' }, setSortConfig: (conf: any) => void, searchQuery: string, setSearchQuery: (q: string) => void, isMarkedTable: boolean, datePickerNode?: React.ReactNode) => {
    let filteredList = list.filter(p => {
      if (searchQuery && !(p.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

    filteredList.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'group') {
        aVal = groups.find(g => g.id === a.group_id)?.name_ar || "";
        bVal = groups.find(g => g.id === b.group_id)?.name_ar || "";
      } else if (sortConfig.key === 'branch') {
        aVal = branches.find(br => br.id === a.branch_id)?.name_ar || "";
        bVal = branches.find(br => br.id === b.branch_id)?.name_ar || "";
      }

      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      
      return sortConfig.direction === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    const toggleSort = (key: string) => {
      if (sortConfig.key === key) {
        setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
      } else {
        setSortConfig({ key, direction: 'asc' });
      }
    };
    
    const SortIcon = ({ columnKey }: { columnKey: string }) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown className="ms-1 h-3 w-3 inline-block opacity-50" />;
      return sortConfig.direction === 'asc' ? <ArrowUp className="ms-1 h-3 w-3 inline-block text-emerald-600" /> : <ArrowDown className="ms-1 h-3 w-3 inline-block text-emerald-600" />;
    };

    return (
    <div className="space-y-3 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2">
        <h3 className="font-bold text-lg">{title} <span className="text-muted-foreground text-sm font-normal">({list.length})</span></h3>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
          {datePickerNode}
          <div className="relative w-full sm:w-64 flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t("common.search", "بحث بالاسم...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-3 pr-9 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background text-sm"
            />
          </div>
        </div>
      </div>
      <div className="border border-border/50 rounded-2xl max-h-96 overflow-y-auto shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
            <TableRow className="border-none">
              <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('full_name')}>
                {t("participants.participant", "المشارك")}
                <SortIcon columnKey="full_name" />
              </TableHead>
              <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('group')}>
                المجموعة
                <SortIcon columnKey="group" />
              </TableHead>
              <TableHead className="font-bold align-middle cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('branch')}>
                الفرع
                <SortIcon columnKey="branch" />
              </TableHead>
              <TableHead className="text-center font-bold align-middle py-2">
                <div>{t("attendance.status", "حالة الحضور")}</div>
              </TableHead>
              <TableHead className="w-[50px] p-0 align-middle">
                <BulkSelectDropdown 
                  groups={groups} 
                  branches={branches} 
                  filteredList={filteredList} 
                  selectedRows={selectedRows} 
                  setSelectedRows={setSelectedRows} 
                  isMarkedTable={isMarkedTable} 
                  attendanceState={attendanceState} 
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.map(p => (
              <TableRow key={p.id} className={selectedRows.includes(p.id) ? "bg-muted/30" : ""}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{groups.find(g => g.id === p.group_id)?.name_ar || "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{branches.find(b => b.id === p.branch_id)?.name_ar || "-"}</TableCell>
                <TableCell className="text-center">
                  <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
                    {(["present", "late", "absent", "excused"] as const).map(s => {
                      const selected = attendanceState[p.id] === s;
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
                          onClick={() => handleSetAttendanceStatus(p.id, s)}
                          className={`h-7 px-2.5 text-xs rounded-md ${colors}`}
                        >
                          {s === "present" ? "حاضر" : s === "late" ? "متأخر" : s === "absent" ? "غائب" : "مستأذن"}
                        </Button>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="w-[50px] p-0 align-middle">
                  <div className="flex items-center justify-center w-full h-full">
                    <Checkbox 
                      checked={selectedRows.includes(p.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRows(prev => [...prev, p.id]);
                        } else {
                          setSelectedRows(prev => prev.filter(id => id !== p.id));
                        }
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredList.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">{t("common.noData", "لا توجد بيانات")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Stat icon={CheckCircle2} label={t("attendance.present", "الحضور")} value={present} tone="success" />
        <Stat icon={XCircle} label={t("attendance.absent", "الغياب")} value={absent} tone="danger" />
        <Stat icon={TrendingUp} label={t("attendance.rate", "نسبة الالتزام")} value={`${rate}%`} tone="success" />
      </div>
      <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
        <div className="space-y-6">
          {unmarkedParticipants.length > 0 && renderTable(
            unmarkedParticipants, 
            t("attendance.unmarkedParticipants", "تسجيل الحضور"), 
            true, sortUnmarked, setSortUnmarked, searchUnmarked, setSearchUnmarked, false,
            <Input 
              type="date" 
              className="rounded-xl h-9 bg-muted/50 border-transparent focus-visible:bg-background transition-colors w-auto text-sm"
              value={attendanceDate} 
              onChange={(e) => setAttendanceDate(e.target.value)} 
              min={projectDates.start || undefined}
              max={projectDates.end && projectDates.end < new Date().toISOString().slice(0, 10) ? projectDates.end : new Date().toISOString().slice(0, 10)}
            />
          )}
          {renderTable(
            markedParticipants, 
            t("attendance.markedParticipants", "سجلات التحضير"), 
            false, sortMarked, setSortMarked, searchMarked, setSearchMarked, true,
            unmarkedParticipants.length === 0 ? (
              <Input 
                type="date" 
                className="rounded-xl h-9 bg-muted/50 border-transparent focus-visible:bg-background transition-colors w-auto text-sm"
                value={attendanceDate} 
                onChange={(e) => setAttendanceDate(e.target.value)} 
                min={projectDates.start || undefined}
                max={projectDates.end && projectDates.end < new Date().toISOString().slice(0, 10) ? projectDates.end : new Date().toISOString().slice(0, 10)}
              />
            ) : undefined
          )}

        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-card border border-border/50 shadow-2xl rounded-full px-6 py-4 flex items-center gap-6 z-50 animate-in slide-in-from-top-10 fade-in duration-300">
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

const Stat = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone: "success" | "danger" }) => {
  const isSuccess = tone === "success";
  const color = isSuccess ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const bg = isSuccess ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20";
  const border = isSuccess ? "border-emerald-100 dark:border-emerald-800/30" : "border-red-100 dark:border-red-800/30";

  return (
    <div className={`p-3 rounded-2xl flex items-center gap-3 hover:-translate-y-1 transition-transform shadow-sm border ${bg} ${border}`}>
      <div className="bg-white dark:bg-card/50 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className={`text-xs font-bold mb-0.5 opacity-80 ${color}`}>{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  );
};

