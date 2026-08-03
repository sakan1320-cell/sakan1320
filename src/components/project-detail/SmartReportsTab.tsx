import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Plus, Calculator, BarChart3, Calendar, Download, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SmartReportsTabProps {
  projectId: string;
  branchId?: string | null;
  groupId?: string | null;
}

interface GeneratedReport {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  selectedFields: string[];
  weights: Record<string, number>;
  createdAt: string;
}

export const SmartReportsTab = ({ projectId, branchId, groupId }: SmartReportsTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  
  // Default generated report to simulate the HTML
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([
    {
      id: "default-1",
      title: isRtl ? "تقرير الأداء العام" : "General Performance Report",
      type: "comprehensive",
      startDate: "",
      endDate: "",
      selectedFields: ["attendance", "evaluation", "enjaz"],
      weights: { attendance: 34, evaluation: 33, enjaz: 33 },
      createdAt: new Date().toISOString()
    }
  ]);

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportType, setReportType] = useState("comprehensive");
  
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);
  
  const [projectDates, setProjectDates] = useState({ start: "", end: "" });

  useEffect(() => {
    const fetchProjectDates = async () => {
      const { data } = await supabase.from("projects").select("start_date, end_date").eq("id", projectId).single();
      if (data) {
        setProjectDates({
          start: data.start_date || "",
          end: data.end_date || ""
        });
      }
    };
    fetchProjectDates();
  }, [projectId]);

  const [selectedFields, setSelectedFields] = useState<string[]>(["attendance", "evaluation", "enjaz"]);
  const [weights, setWeights] = useState<Record<string, number>>({ attendance: 34, evaluation: 33, enjaz: 33 });

  const toggleField = (field: string) => {
    setSelectedFields(prev => {
      if (prev.includes(field)) {
        // Remove field and clear its weight to 0
        setWeights(w => ({ ...w, [field]: 0 }));
        return prev.filter(f => f !== field);
      } else {
        // Add field with a default weight
        setWeights(w => ({ ...w, [field]: 0 }));
        return [...prev, field];
      }
    });
  };

  const currentTotalWeight = selectedFields.reduce((sum, f) => sum + (weights[f] || 0), 0);

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle) {
      toast.error(isRtl ? "عنوان التقرير مطلوب" : "Report title is required");
      return;
    }
    if (selectedFields.length === 0) {
      toast.error(isRtl ? "يجب اختيار حقل واحد على الأقل" : "Select at least one field");
      return;
    }
    if (currentTotalWeight !== 100) {
      toast.error(isRtl ? "مجموع الأوزان للحقول المختارة يجب أن يساوي 100%" : "Total weights must equal 100%");
      return;
    }
    
    // We remove custom validation for startDate/endDate so empty means "from the beginning/until the end"
    
    const newReport: GeneratedReport = {
      id: Math.random().toString(36).substring(7),
      title: reportTitle,
      type: reportType,
      startDate: startDate,
      endDate: endDate,
      selectedFields: [...selectedFields],
      weights: { ...weights },
      createdAt: new Date().toISOString()
    };

    setGeneratedReports(prev => [newReport, ...prev]);
    setCreateOpen(false);
    toast.success(isRtl ? "تمت جدولة وإنشاء التقرير التفاعلي بنجاح دون التأثير على استقرار النظام." : "Report generated successfully.");
    
    // Reset form
    setReportTitle("");
    setReportType("comprehensive");
    setStartDate("");
    setEndDate(today);
    setSelectedFields(["attendance", "evaluation", "enjaz"]);
    setWeights({ attendance: 34, evaluation: 33, enjaz: 33 });
  };

  const deleteReport = (id: string) => {
    setGeneratedReports(prev => prev.filter(r => r.id !== id));
  };

  const fetchReportData = async (report: GeneratedReport) => {
    setLoadingMap(prev => ({ ...prev, [report.id]: true }));
    try {
      // 1. Get Participants
      let partsQuery = supabase
        .from("participants")
        .select("id, full_name, points")
        .eq("project_id", projectId)
        .eq("status", "active");
      if (groupId) partsQuery = partsQuery.eq("group_id", groupId);
      else if (branchId) partsQuery = partsQuery.eq("branch_id", branchId);
      const { data: parts } = await partsQuery;

      if (!parts || parts.length === 0) {
        toast.info(isRtl ? "لا يوجد مشاركون لحساب تقرير لهم" : "No participants to report on");
        return null;
      }

      // 2. Date Filter
      const startDateFilter = report.startDate || "";
      const endDateFilter = report.endDate || "";

      // 3. Process each participant
      const rows = await Promise.all(parts.map(async (p) => {
        let attQuery = supabase.from("attendance").select("status").eq("subject_id", p.id);
        if (startDateFilter) attQuery = attQuery.gte("date", startDateFilter);
        if (endDateFilter) attQuery = attQuery.lte("date", endDateFilter);
        const { data: att } = await attQuery;
        
        let attendanceRate = 100;
        if (att && att.length > 0) {
          const present = att.filter((a) => a.status === "present").length;
          attendanceRate = Math.round((present / att.length) * 100);
        }

        const evaluationScore = 100; // Placeholder simulated data
        const maxExpectedPoints = 200;
        const enjazScore = Math.min(100, Math.round(((p.points || 0) / maxExpectedPoints) * 100));

        const attW = report.selectedFields.includes("attendance") ? (report.weights.attendance || 0) : 0;
        const evalW = report.selectedFields.includes("evaluation") ? (report.weights.evaluation || 0) : 0;
        const enjazW = report.selectedFields.includes("enjaz") ? (report.weights.enjaz || 0) : 0;

        const weightedScore = Math.round(
          (attendanceRate * (attW / 100)) + 
          (evaluationScore * (evalW / 100)) +
          (enjazScore * (enjazW / 100))
        );

        let grade = "جيد جداً";
        if (weightedScore >= 90) grade = isRtl ? "ممتاز" : "Excellent";
        else if (weightedScore >= 80) grade = isRtl ? "جيد جداً" : "Very Good";
        else if (weightedScore >= 70) grade = isRtl ? "جيد" : "Good";
        else if (weightedScore >= 60) grade = isRtl ? "مقبول" : "Acceptable";
        else grade = isRtl ? "ضعيف" : "Needs Improvement";

        const row = [ p.full_name ];
        if (report.selectedFields.includes("attendance")) row.push(`${attendanceRate}%`);
        if (report.selectedFields.includes("evaluation")) row.push(`${evaluationScore}%`);
        if (report.selectedFields.includes("enjaz")) row.push(`${enjazScore}%`);
        row.push(`${weightedScore}%`, grade);
        
        return row;
      }));

      // 4. Build headers
      const headers = [isRtl ? "الاسم" : "Name"];
      if (report.selectedFields.includes("attendance")) headers.push(isRtl ? "نسبة الحضور" : "Attendance");
      if (report.selectedFields.includes("evaluation")) headers.push(isRtl ? "درجة التقييم" : "Evaluation");
      if (report.selectedFields.includes("enjaz")) headers.push(isRtl ? "نسبة إنجاز" : "Enjaz");
      headers.push(isRtl ? "الدرجة الموزونة (النهائية)" : "Weighted Score", isRtl ? "التقدير" : "Grade");
      
      return { headers, rows };
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setLoadingMap(prev => ({ ...prev, [report.id]: false }));
    }
  };

  const handleDownloadExcel = async (report: GeneratedReport) => {
    const data = await fetchReportData(report);
    if (!data) return;

    const csvContent = [
      data.headers.join(","),
      ...data.rows.map(r => r.map(c => `"${c}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${report.title}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(isRtl ? "تم تحميل التقرير كـ Excel بنجاح" : "Excel Report downloaded successfully");
  };

  const handleDownloadPDF = async (report: GeneratedReport) => {
    const data = await fetchReportData(report);
    if (!data) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="${isRtl ? 'rtl' : 'ltr'}" lang="${isRtl ? 'ar' : 'en'}">
          <head>
            <title>${report.title}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; direction: ${isRtl ? 'rtl' : 'ltr'}; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: ${isRtl ? 'right' : 'left'}; }
              th { background-color: #f8f9fa; font-weight: bold; }
              .header { text-align: center; margin-bottom: 30px; }
              @media print {
                @page { margin: 1cm; size: landscape; }
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${report.title}</h2>
              <p>${isRtl ? 'تاريخ استخراج التقرير:' : 'Generated on:'} ${new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}</p>
            </div>
            <table>
              <thead>
                <tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${data.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const getTypeName = (val: string) => {
    if (val === "comprehensive") return isRtl ? "شامل" : "Comprehensive";
    if (val === "attendance") return isRtl ? "مخصص للحضور" : "Attendance";
    return isRtl ? "مخصص للأداء" : "Performance";
  };

  const getTimeRangeName = (report: GeneratedReport) => {
    if (!report.startDate && !report.endDate) return isRtl ? "كامل البرنامج التدريبي" : "Whole Program";
    const start = report.startDate || (isRtl ? "البداية" : "Start");
    const end = report.endDate || (isRtl ? "النهاية" : "End");
    return `${start} - ${end}`;
  };

  const setQuickDate = (daysAgo: number | null) => {
    if (daysAgo === null) {
      setStartDate(projectDates.start);
      setEndDate(projectDates.end || today);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(today);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header matching HTML */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-primary-foreground p-3 rounded-xl flex">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{isRtl ? "التقارير الذكية" : "Smart Reports"}</h2>
            <p className="text-sm text-muted-foreground">{isRtl ? "إدارة وتحميل تقارير المشروع الشاملة" : "Manage and download comprehensive project reports"}</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 font-semibold shadow-md">
          <Plus className="w-4 h-4" />
          {isRtl ? "إنشاء تقرير جديد" : "Create New Report"}
        </Button>
      </div>

      {/* Reports Grid matching HTML */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {generatedReports.length === 0 ? (
          <div className="col-span-full py-12 text-center border rounded-2xl bg-card border-dashed">
            <p className="text-muted-foreground">{isRtl ? "لا توجد تقارير منشأة حالياً" : "No reports generated yet"}</p>
          </div>
        ) : (
          generatedReports.map((report) => (
            <div key={report.id} className="bg-card border rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group relative">
              <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteReport(report.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex justify-between items-start gap-3">
                <div className="flex gap-3 items-start">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-card-foreground">{report.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="inline-block bg-primary/15 text-foreground px-2 py-0.5 rounded-md text-xs font-semibold">
                        {getTypeName(report.type)}
                      </span>
                      <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-semibold">
                        {report.selectedFields.length} {isRtl ? "حقول" : "Fields"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Calendar className="w-4 h-4" />
                <span dir="ltr" className="font-mono text-xs rtl:text-right w-full">{getTimeRangeName(report)}</span>
              </div>

              <div className="flex gap-2 mt-auto">
                <Button 
                  onClick={() => handleDownloadExcel(report)} 
                  disabled={loadingMap[report.id]}
                  variant="outline" 
                  className="flex-1 gap-2 bg-secondary/50 hover:bg-secondary font-semibold"
                >
                  {loadingMap[report.id] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Excel
                </Button>
                <Button 
                  onClick={() => handleDownloadPDF(report)} 
                  disabled={loadingMap[report.id]}
                  variant="outline" 
                  className="flex-1 gap-2 bg-secondary/50 hover:bg-secondary font-semibold text-rose-600 border-rose-200 hover:border-rose-300 hover:bg-rose-50"
                >
                  {loadingMap[report.id] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  PDF
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal matching HTML */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          <div className="bg-card p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="mb-6 border-b pb-4 flex flex-row items-center justify-between">
              <DialogTitle className="text-xl">{isRtl ? "إعداد تقرير جديد للمشروع" : "Setup New Project Report"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateReport} className="space-y-6">
              <div className="space-y-2">
                <Label className="font-bold">{isRtl ? "عنوان التقرير" : "Report Title"}</Label>
                <Input
                  required
                  placeholder={isRtl ? "أدخل عنوان التقرير (مثال: تقرير الالتزام)" : "Enter report title"}
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">{isRtl ? "نوع التقرير المبدئي" : "Base Report Type"}</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comprehensive">{isRtl ? "تقرير شامل" : "Comprehensive Report"}</SelectItem>
                    <SelectItem value="attendance">{isRtl ? "تقرير الحضور فقط" : "Attendance Only Report"}</SelectItem>
                    <SelectItem value="performance">{isRtl ? "تقرير الأداء (إنجاز)" : "Performance Report"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Fields & Weights Section */}
              <div className="bg-slate-50 border border-border rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <Label className="font-bold text-sm text-slate-800">{isRtl ? "خصائص ومكونات التقرير (الحقول المختارة)" : "Report Fields & Weights"}</Label>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${currentTotalWeight === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {isRtl ? "المجموع:" : "Total:"} {currentTotalWeight}%
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Attendance Field */}
                  <div className={`border rounded-lg p-3 transition-colors ${selectedFields.includes("attendance") ? "bg-white border-primary/50 ring-1 ring-primary/20" : "bg-transparent border-dashed opacity-60"}`}>
                    <div className="flex items-center space-x-2 space-x-reverse mb-3">
                      <Checkbox 
                        id="field-attendance" 
                        checked={selectedFields.includes("attendance")} 
                        onCheckedChange={() => toggleField("attendance")}
                      />
                      <label htmlFor="field-attendance" className="text-sm font-semibold cursor-pointer">
                        {isRtl ? "مكون الحضور" : "Attendance"}
                      </label>
                    </div>
                    {selectedFields.includes("attendance") && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">{isRtl ? "الوزن النسبي (%)" : "Weight (%)"}</span>
                        <Input 
                          type="number" min="0" step="1" 
                          value={weights.attendance || ""} 
                          onChange={(e) => setWeights(p => ({ ...p, attendance: Number(e.target.value) }))} 
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Evaluation Field */}
                  <div className={`border rounded-lg p-3 transition-colors ${selectedFields.includes("evaluation") ? "bg-white border-primary/50 ring-1 ring-primary/20" : "bg-transparent border-dashed opacity-60"}`}>
                    <div className="flex items-center space-x-2 space-x-reverse mb-3">
                      <Checkbox 
                        id="field-evaluation" 
                        checked={selectedFields.includes("evaluation")} 
                        onCheckedChange={() => toggleField("evaluation")}
                      />
                      <label htmlFor="field-evaluation" className="text-sm font-semibold cursor-pointer">
                        {isRtl ? "مكون التقييم" : "Evaluation"}
                      </label>
                    </div>
                    {selectedFields.includes("evaluation") && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">{isRtl ? "الوزن النسبي (%)" : "Weight (%)"}</span>
                        <Input 
                          type="number" min="0" step="1" 
                          value={weights.evaluation || ""} 
                          onChange={(e) => setWeights(p => ({ ...p, evaluation: Number(e.target.value) }))} 
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Enjaz Field */}
                  <div className={`border rounded-lg p-3 transition-colors ${selectedFields.includes("enjaz") ? "bg-white border-primary/50 ring-1 ring-primary/20" : "bg-transparent border-dashed opacity-60"}`}>
                    <div className="flex items-center space-x-2 space-x-reverse mb-3">
                      <Checkbox 
                        id="field-enjaz" 
                        checked={selectedFields.includes("enjaz")} 
                        onCheckedChange={() => toggleField("enjaz")}
                      />
                      <label htmlFor="field-enjaz" className="text-sm font-semibold cursor-pointer">
                        {isRtl ? "مكون نظام إنجاز" : "Enjaz"}
                      </label>
                    </div>
                    {selectedFields.includes("enjaz") && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">{isRtl ? "الوزن النسبي (%)" : "Weight (%)"}</span>
                        <Input 
                          type="number" min="0" step="1" 
                          value={weights.enjaz || ""} 
                          onChange={(e) => setWeights(p => ({ ...p, enjaz: Number(e.target.value) }))} 
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                { currentTotalWeight !== 100 && (
                  <p className="text-xs text-rose-600 font-bold text-center mt-2 flex justify-center items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    {isRtl ? "تأكد من أن مجموع أوزان الحقول المفعلة يساوي 100 בדיוק" : "Ensure selected weights equal 100 exactly"}
                  </p>
                )}
              </div>

              {/* Time Range Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">{isRtl ? "اختيار سريع للتاريخ" : "Quick Date Selection"}</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setQuickDate(7)} 
                      className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    >
                      {isRtl ? "آخر 7 أيام" : "Last 7 Days"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setQuickDate(30)} 
                      className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    >
                      {isRtl ? "آخر 30 يوم" : "Last 30 Days"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setQuickDate(90)} 
                      className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    >
                      {isRtl ? "آخر 3 أشهر" : "Last 3 Months"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setQuickDate(null)} 
                      className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    >
                      {isRtl ? "كامل البرنامج" : "Whole Program"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="font-bold">{isRtl ? "تحديد نطاق التاريخ (مخصص)" : "Select Date Range (Custom)"}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{isRtl ? "من التاريخ" : "From Date"}</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="border-primary/40 focus:ring-primary/20" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{isRtl ? "إلى التاريخ" : "To Date"}</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="border-primary/40 focus:ring-primary/20" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-5 mt-6">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} className="bg-secondary/50">
                  {isRtl ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={currentTotalWeight !== 100 || selectedFields.length === 0} className="px-6 font-bold shadow-md gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {isRtl ? "حفظ وإنشاء التقرير" : "Save & Create"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

