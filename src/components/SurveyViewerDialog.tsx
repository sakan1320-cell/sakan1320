import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectSurvey, SurveyField } from "@/types/surveys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: ProjectSurvey;
  onSubmitted?: () => void;
  isPreview?: boolean;
}

export const SurveyViewerDialog = ({ open, onOpenChange, survey, onSubmitted, isPreview = false }: Props) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const updateAnswer = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const validate = () => {
    for (const field of survey.fields) {
      if (field.required && (!answers[field.id] || answers[field.id].length === 0)) {
        toast.error(`حقل "${field.label}" مطلوب`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (isPreview) {
      toast.success("هذه مجرد معاينة. لن يتم حفظ الإجابات.");
      onOpenChange(false);
      return;
    }

    if (!validate()) return;
    if (!user) return toast.error("يجب تسجيل الدخول للإرسال");

    setLoading(true);
    try {
      const { error } = await supabase.from("survey_responses").insert([{
        survey_id: survey.id,
        user_id: user.id,
        answers
      }]);
      
      if (error) throw error;
      toast.success("تم تسليم الاستبيان بنجاح!");
      if (onSubmitted) onSubmitted();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: SurveyField) => {
    const value = answers[field.id];

    switch (field.type) {
      case "short_answer":
        return <Input value={value || ""} onChange={e => updateAnswer(field.id, e.target.value)} />;
      case "paragraph":
        return <Textarea rows={4} value={value || ""} onChange={e => updateAnswer(field.id, e.target.value)} />;
      case "radio":
        return (
          <RadioGroup value={value || ""} onValueChange={val => updateAnswer(field.id, val)}>
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value={opt} id={`${field.id}-${i}`} />
                <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case "checkboxes":
        return (
          <div className="space-y-2">
            {(field.options || []).map((opt, i) => {
              const checked = (value || []).includes(opt);
              return (
                <div key={i} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox 
                    id={`${field.id}-${i}`} 
                    checked={checked}
                    onCheckedChange={(c) => {
                      let arr = [...(value || [])];
                      if (c) arr.push(opt);
                      else arr = arr.filter(x => x !== opt);
                      updateAnswer(field.id, arr);
                    }}
                  />
                  <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
                </div>
              );
            })}
          </div>
        );
      case "dropdown":
        return (
          <Select value={value || ""} onValueChange={val => updateAnswer(field.id, val)}>
            <SelectTrigger><SelectValue placeholder="اختر من القائمة" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt, i) => (
                <SelectItem key={i} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "star_rating":
        const starMax = field.scale_max ?? 5;
        const stars = Array.from({ length: starMax }, (_, i) => i + 1);
        return (
          <div className="flex gap-2 flex-wrap">
            {stars.map(star => (
              <button
                key={star}
                type="button"
                className="group p-1 transition-all focus:outline-none hover:scale-110"
                onClick={() => updateAnswer(field.id, star)}
              >
                <Star 
                  className={`h-10 w-10 transition-colors ${
                    (value || 0) >= star 
                      ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" 
                      : "text-muted-foreground/30 group-hover:text-yellow-400/50"
                  }`}
                />
              </button>
            ))}
          </div>
        );
      case "linear_scale":
        const min = field.scale_min ?? 1;
        const max = field.scale_max ?? 10;
        const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <div className="pt-4 pb-2">
            <div className="flex flex-wrap justify-between gap-1 mb-4">
              {range.map(num => (
                <button
                  key={num}
                  onClick={() => updateAnswer(field.id, num)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all border-2 ${
                    value === num 
                      ? "bg-primary text-primary-foreground border-primary scale-110 shadow-md" 
                      : "bg-background text-muted-foreground border-muted hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground px-2">
              <span>{field.scale_min_label || "سيء جداً"}</span>
              <span>{field.scale_max_label || "ممتاز"}</span>
            </div>
          </div>
        );
      case "grid_matrix":
      case "checkbox_grid":
        const isRadio = field.type === "grid_matrix";
        return (
          <div className="overflow-hidden border rounded-xl shadow-sm bg-card mt-2">
            <table className="w-full text-sm text-center border-collapse">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="p-4 text-right font-semibold text-muted-foreground w-1/3">العبارة</th>
                  {(field.grid_cols || []).map((col, i) => (
                    <th key={i} className="p-4 font-semibold text-foreground border-l last:border-0 border-border/50 min-w-[80px]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(field.grid_rows || []).map((row, rIdx) => {
                  const rowVal = value?.[row] || (isRadio ? "" : []);
                  return (
                    <tr key={rIdx} className="hover:bg-primary/5 transition-colors group">
                      <td className="p-4 text-right font-medium text-foreground bg-background group-hover:bg-transparent transition-colors">
                        {row}
                      </td>
                      {(field.grid_cols || []).map((col, cIdx) => (
                        <td key={cIdx} className="p-0 border-l last:border-0 border-border/50 bg-background group-hover:bg-transparent transition-colors">
                          <label className="flex items-center justify-center w-full h-full cursor-pointer p-4 hover:bg-muted/50 transition-colors m-0">
                            {isRadio ? (
                              <input 
                                type="radio" 
                                name={`${field.id}_${rIdx}`} 
                                checked={rowVal === col}
                                onChange={() => updateAnswer(field.id, { ...(value || {}), [row]: col })}
                                className="h-5 w-5 accent-primary cursor-pointer border-muted-foreground"
                              />
                            ) : (
                              <input 
                                type="checkbox"
                                checked={rowVal.includes(col)}
                                onChange={(e) => {
                                  let arr = [...rowVal];
                                  if (e.target.checked) arr.push(col);
                                  else arr = arr.filter((x: string) => x !== col);
                                  updateAnswer(field.id, { ...(value || {}), [row]: arr });
                                }}
                                className="h-5 w-5 accent-primary cursor-pointer border-muted-foreground rounded"
                              />
                            )}
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div>غير مدعوم</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary">{survey.title_ar}</DialogTitle>
          {survey.description && <p className="text-muted-foreground mt-2">{survey.description}</p>}
        </DialogHeader>

        <div className="space-y-8 py-6">
          {survey.fields.map((field, idx) => (
            <div key={field.id} className="space-y-3 bg-card p-5 rounded-lg border shadow-sm">
              <div>
                <Label className="text-base font-bold flex items-center">
                  <span className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center me-2 text-xs">
                    {idx + 1}
                  </span>
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                {field.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 ms-8">{field.description}</p>
                )}
              </div>
              <div className="ms-8 pt-2">
                {renderField(field)}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          {!isPreview && <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>}
          <Button onClick={handleSubmit} disabled={loading && !isPreview} className="px-8">
            {isPreview ? "إغلاق المعاينة" : "إرسال الاستبيان"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
