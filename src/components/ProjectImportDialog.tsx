import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

const TEMPLATE_HEADERS = [
  "name_ar", "name_en", "description", "category",
  "status", "budget", "start_date", "end_date", "has_branches",
];

const VALID_STATUS = ["planned", "in_progress", "completed", "stalled"];

export const ProjectImportDialog = ({ open, onOpenChange, onDone }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; total: number; errors: string[] } | null>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ["مشروع تعليمي", "Education Project", "وصف اختياري", "education", "planned", 50000, "2026-01-01", "2026-12-31", "false"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "projects");
    XLSX.writeFile(wb, "projects_template.xlsx");
  };

  const run = async () => {
    if (!file) { toast.error(t("projects.importPickFile")); return; }
    setBusy(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      if (rows.length === 0) { toast.error(t("projects.importEmpty")); setBusy(false); return; }

      const errors: string[] = [];
      let created = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name_ar = String(r.name_ar ?? "").trim();
        if (!name_ar) { errors.push(`${t("participants.import.row")} ${i + 2}: name_ar`); continue; }
        const status = VALID_STATUS.includes(r.status) ? r.status : "planned";
        const payload = {
          name_ar,
          name_en: r.name_en ? String(r.name_en).trim() : null,
          description: r.description ? String(r.description) : null,
          category: r.category ? String(r.category).trim() : null,
          status,
          budget: r.budget ? Number(r.budget) : 0,
          start_date: r.start_date ? String(r.start_date) : null,
          end_date: r.end_date ? String(r.end_date) : null,
          has_branches: String(r.has_branches ?? "").toLowerCase() === "true",
          created_by: user?.id ?? null,
        };
        const { error } = await supabase.from("projects").insert([payload]);
        if (error) errors.push(`${t("participants.import.row")} ${i + 2}: ${error.message}`);
        else created++;
      }

      setResult({ created, failed: errors.length, total: rows.length, errors: errors.slice(0, 10) });
      if (created > 0) toast.success(t("projects.importDone", { created, failed: errors.length }));
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("projects.importTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("projects.importIntro")}</p>
          <Button variant="outline" onClick={downloadTemplate} className="w-full">
            <Download className="h-4 w-4 me-2" />{t("projects.downloadTemplate")}
          </Button>
          <div className="space-y-2">
            <Label>{t("projects.importFile")}</Label>
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {result && (
            <div className="rounded-md border p-3 text-sm">
              <p>{t("participants.import.summary", { created: result.created, skipped: 0, failed: result.failed, total: result.total })}</p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc ms-5 text-xs text-destructive">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={run} disabled={busy || !file}>
            <Upload className="h-4 w-4 me-2" />{t("projects.runImport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
