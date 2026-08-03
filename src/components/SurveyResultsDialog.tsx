import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSurvey, SurveyField, SurveyResponse } from "@/types/surveys";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Loader2, Download, Pencil, ChevronDown, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Label } from "./ui/label";
import * as XLSX from "xlsx";

interface SurveyResponseWithUser extends SurveyResponse {
  profiles?: { full_name: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: ProjectSurvey;
  onEdit?: () => void;
  onStatusChanged?: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658'];

export const SurveyResultsDialog = ({ open, onOpenChange, survey, onEdit, onStatusChanged }: Props) => {
  const [responses, setResponses] = useState<SurveyResponseWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | "all">("all");
  const [isPublished, setIsPublished] = useState(survey.is_published || false);

  useEffect(() => {
    setIsPublished(survey.is_published || false);
  }, [survey]);

  const handleTogglePublish = async () => {
    const newStatus = !isPublished;
    const { error } = await supabase
      .from("project_surveys")
      .update({ is_published: newStatus })
      .eq("id", survey.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      setIsPublished(newStatus);
      toast.success(newStatus ? "تم النشر بنجاح" : "تم إلغاء النشر بنجاح");
      if (onStatusChanged) onStatusChanged();
    }
  };

  useEffect(() => {
    if (open && survey) {
      fetchResponses();
    }
  }, [open, survey]);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, profiles(full_name)")
        .eq("survey_id", survey.id);

      if (error) throw error;
      setResponses((data as any) || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    try {
      if (responses.length === 0) {
        toast.info("لا توجد ردود لتصديرها");
        return;
      }

      const fields = survey.fields || [];
      const headers = ["اسم المتدرب", "تاريخ التسليم", ...fields.map(f => f.label || "بدون عنوان")];
      
      const rows = responses.map(r => {
        const row = [
          r.profiles?.full_name || 'مستخدم غير معروف',
          new Date(r.submitted_at || Date.now()).toLocaleDateString('ar-SA')
        ];

        const answers = r.answers || {};

        fields.forEach(f => {
          let val = answers[f.id];
          if (Array.isArray(val)) val = val.join(" ، ");
          else if (typeof val === "object" && val !== null) val = Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(" | ");
          row.push(String(val || ''));
        });

        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "نتائج الاستبيان");
      
      const safeTitle = (survey.title_ar || 'استبيان').replace(/\s+/g, '_');
      XLSX.writeFile(wb, `نتائج_${safeTitle}.xlsx`);

      toast.success("تم تصدير ملف Excel بنجاح");
    } catch (e: any) {
      console.error("Export error:", e);
      toast.error("حدث خطأ أثناء التصدير: " + e.message);
    }
  };

  const renderSummaryChart = (field: SurveyField) => {
    if (responses.length === 0) return <div className="text-sm text-muted-foreground">لا توجد ردود بعد</div>;

    // Build data based on field type
    if (field.type === "radio" || field.type === "dropdown") {
      const counts: Record<string, number> = {};
      responses.forEach(r => {
        const val = r.answers[field.id];
        if (val) counts[val] = (counts[val] || 0) + 1;
      });
      const data = Object.keys(counts).map(key => ({ name: key, value: counts[key] }));

      if (data.length === 0) return <div className="text-sm text-muted-foreground">لا يوجد إجابات لهذا السؤال</div>;

      return (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (field.type === "checkboxes") {
      const counts: Record<string, number> = {};
      responses.forEach(r => {
        const vals = r.answers[field.id] || [];
        if (Array.isArray(vals)) {
          vals.forEach(val => {
            counts[val] = (counts[val] || 0) + 1;
          });
        }
      });
      const data = Object.keys(counts).map(key => ({ name: key, count: counts[key] }));

      if (data.length === 0) return <div className="text-sm text-muted-foreground">لا يوجد إجابات لهذا السؤال</div>;

      return (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (field.type === "linear_scale" || field.type === "star_rating") {
      const counts: Record<number, number> = {};
      const min = field.type === "linear_scale" ? (field.scale_min || 1) : 1;
      const max = field.type === "linear_scale" ? (field.scale_max || 10) : 5;
      
      for(let i = min; i <= max; i++) counts[i] = 0;

      responses.forEach(r => {
        const val = Number(r.answers[field.id]);
        if (!isNaN(val) && counts[val] !== undefined) {
          counts[val]++;
        }
      });
      const data = Object.keys(counts).map(key => ({ name: key, count: counts[Number(key)] }));

      return (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Text inputs
    if (field.type === "short_answer" || field.type === "paragraph") {
      const texts = responses.map(r => r.answers[field.id]).filter(Boolean);
      return (
        <div className="space-y-2 max-h-48 overflow-y-auto bg-muted/20 p-2 rounded">
          {texts.map((t, i) => (
            <div key={i} className="text-sm border-b p-2 last:border-0 bg-background rounded mb-1">{t}</div>
          ))}
          {texts.length === 0 && <div className="text-sm text-muted-foreground p-2">لا يوجد ردود نصية</div>}
        </div>
      );
    }

    return <div className="text-sm text-muted-foreground">الرسم البياني غير متوفر لهذا النوع ({field.type})</div>;
  };

  const renderIndividualResponse = () => {
    if (selectedUserId === "all") {
      return <div className="text-center text-muted-foreground py-10">الرجاء اختيار متدرب لعرض إجاباته</div>;
    }

    const res = responses.find(r => r.user_id === selectedUserId);
    if (!res) return null;

    return (
      <div className="space-y-6 pt-4">
        {survey.fields.map((field, idx) => {
          let answerDisplay: any = res.answers[field.id];
          
          if (Array.isArray(answerDisplay)) {
            answerDisplay = answerDisplay.join(" ، ");
          } else if (typeof answerDisplay === "object" && answerDisplay !== null) {
            answerDisplay = Object.entries(answerDisplay).map(([k, v]) => `${k}: ${v}`).join(" | ");
          } else if (answerDisplay === undefined || answerDisplay === null || answerDisplay === "") {
            answerDisplay = <span className="text-muted-foreground italic">لم يتم الإجابة</span>;
          }

          return (
            <div key={field.id} className="bg-card p-4 rounded-lg border shadow-sm">
              <Label className="text-sm font-bold flex items-center mb-2">
                <span className="text-primary me-2">{idx + 1}.</span>
                {field.label}
              </Label>
              <div className="ms-5 text-sm p-3 bg-muted/30 rounded-md whitespace-pre-wrap">
                {answerDisplay}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-0 shadow-2xl rounded-xl">
        <DialogHeader className="p-6 pb-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl text-primary font-bold">{survey.title_ar}</DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">حالة النشر:</span>
              <Switch 
                id="results-publish-switch"
                checked={isPublished} 
                onCheckedChange={handleTogglePublish} 
              />
            </div>
          </div>
          <DialogDescription className="text-base mt-2">
            إجمالي الردود: <span className="font-bold text-foreground">{responses.length}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="preview" className="w-full">
              <div className="flex flex-row items-center justify-between mb-6">
                <TabsList className="justify-start bg-card border shadow-sm">
                  <TabsTrigger value="preview" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">معاينة</TabsTrigger>
                  <TabsTrigger value="individual" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">الردود</TabsTrigger>
                  <TabsTrigger value="summary" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">الملخص</TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2 shadow-sm" disabled={responses.length === 0 || loading}>
                        التصدير
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={handleExportExcel} className="gap-2 cursor-pointer">
                        <Download className="w-4 h-4" />
                        تصدير Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <TabsContent value="summary" className="space-y-6">
                {survey.fields.map((field, idx) => (
                  <div key={field.id} className="bg-card border rounded-xl p-6 shadow-sm">
                    <Label className="text-lg font-bold mb-6 flex items-center border-b pb-3">
                      <span className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center me-3 text-sm">{idx + 1}</span>
                      {field.label}
                    </Label>
                    {renderSummaryChart(field)}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="individual">
                <div className="space-y-6 bg-card border rounded-xl p-6 shadow-sm">
                  <div className="max-w-md">
                    <Label className="mb-3 block font-bold text-base">اختر المتدرب (المستجيب)</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="h-12 border-primary/20">
                        <SelectValue placeholder="اختر شخصاً..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">-- اختر شخصاً لعرض إجاباته --</SelectItem>
                        {responses.map((r, i) => (
                          <SelectItem key={i} value={r.user_id}>
                            {r.profiles?.full_name || "مستخدم غير معروف"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-t pt-4">
                    {renderIndividualResponse()}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview">
                <div className="space-y-6 bg-card border rounded-xl p-6 shadow-sm">
                  {survey.description && (
                    <div className="text-muted-foreground mb-6 p-4 bg-muted/30 rounded-lg border">
                      {survey.description}
                    </div>
                  )}
                  {survey.fields.map((field, idx) => (
                    <div key={field.id} className="bg-background p-5 rounded-lg border shadow-sm">
                      <Label className="text-base font-bold flex items-center mb-2">
                        <span className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center me-2 text-xs">
                          {idx + 1}
                        </span>
                        {field.label}
                        {field.required && <span className="text-destructive ms-1">*</span>}
                      </Label>
                      {field.description && <p className="text-sm text-muted-foreground ms-8 mb-4">{field.description}</p>}
                      <div className="ms-8">
                        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded border border-dashed flex justify-between">
                          <span>نوع الحقل المقترح للمتدرب:</span>
                          <span className="font-mono bg-muted px-2 py-0.5 rounded">{field.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {onEdit && (
                    <div className="flex justify-center mt-8 pt-6 border-t">
                      <Button onClick={onEdit} size="lg" className="gap-2 px-8">
                        <Pencil className="w-5 h-5" />
                        الانتقال إلى وضع تعديل النموذج
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
