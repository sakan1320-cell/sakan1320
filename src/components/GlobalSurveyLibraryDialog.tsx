import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectSurvey } from "@/types/surveys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, DownloadCloud } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onImported: () => void;
}

export const GlobalSurveyLibraryDialog = ({ open, onOpenChange, projectId, onImported }: Props) => {
  const [templates, setTemplates] = useState<ProjectSurvey[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("project_surveys")
        .select("*")
        .eq("is_template", true)
        .order("created_at", { ascending: false });
      setTemplates((data as ProjectSurvey[]) || []);
    };
    fetchTemplates();
  }, [open]);

  const handleImport = async (template: ProjectSurvey) => {
    setLoading(true);
    try {
      const payload = {
        project_id: projectId,
        title_ar: `${template.title_ar} (نسخة مستوردة)`,
        description: template.description,
        is_template: false,
        fields: template.fields,
      };

      const { error } = await supabase.from("project_surveys").insert([payload]);
      if (error) throw error;
      
      toast.success("تم استيراد القالب بنجاح!");
      onImported();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>مكتبة الاستبيانات المركزية</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {templates.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 border rounded-lg bg-muted/20">
              لا توجد قوالب محفوظة في المكتبة المركزية حالياً.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map(t => (
                <Card key={t.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> {t.title_ar}
                    </CardTitle>
                    {t.description && <CardDescription className="line-clamp-2">{t.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="pt-0 flex justify-end">
                    <Button size="sm" onClick={() => handleImport(t)} disabled={loading}>
                      <DownloadCloud className="h-4 w-4 me-2" /> استيراد للمشروع
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
