import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Image as ImageIcon, Video, FilePdf, Play, Trash2, Plus, Download,
  ExternalLink, Copy, Link as LinkIcon, Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { logAudit } from "@/lib/audit";

interface ProjectFilesTabProps {
  projectId: string;
  isTrainerBag?: boolean;
  isManager?: boolean;
}

interface ProjectFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: "document" | "image" | "video" | "pdf" | "youtube";
  file_size: number;
  youtube_url: string | null;
  description: string | null;
  created_at: string;
}

export const ProjectFilesTab = ({ projectId, isTrainerBag = false, isManager = true }: ProjectFilesTabProps) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const { confirm, ConfirmDialogNode } = useConfirm();
  const [open, setOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "youtube">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Preview state
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const filtered = isTrainerBag 
        ? (data || []).filter(f => f.description?.includes("#trainer_bag"))
        : (data || []).filter(f => !f.description?.includes("#trainer_bag"));
      setFiles((filtered || []) as ProjectFile[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t("common.copied", "تم النسخ بنجاح"));
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleUpload = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (uploadType === "youtube") {
      if (!title.trim() || !youtubeUrl.trim()) {
        toast.error(t("common.required", "يرجى تعبئة الحقول المطلوبة"));
        return;
      }
      const ytId = getYoutubeId(youtubeUrl);
      if (!ytId) {
        toast.error(t("lms.invalidYoutubeUrl", "رابط يوتيوب غير صحيح"));
        return;
      }

      setUploading(true);
      try {
        const { error } = await supabase.from("project_files").insert([{
          project_id: projectId,
          file_name: title,
          file_url: `https://www.youtube.com/embed/${ytId}`,
          file_type: "youtube",
          youtube_url: youtubeUrl,
          file_size: null,
          description: (description || "") + (isTrainerBag ? " #trainer_bag" : ""),
          uploaded_by: user?.id,
        }]);

        if (error) throw error;
        toast.success(t("common.success"));
        setOpen(false);
        resetForm();
        loadFiles();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading(false);
      }
    } else {
      if (!selectedFile) {
        toast.error(t("common.pickFile", "يرجى اختيار ملف أولاً"));
        return;
      }

      setUploading(true);
      try {
        const ext = selectedFile.name.split(".").pop();
        const path = `${projectId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, selectedFile);

        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage
          .from("project-files")
          .getPublicUrl(path);

        // Determine file type category
        let fileType: ProjectFile["file_type"] = "document";
        if (selectedFile.type.startsWith("image/")) fileType = "image";
        else if (selectedFile.type.startsWith("video/")) fileType = "video";
        else if (selectedFile.type === "application/pdf") fileType = "pdf";

        const { error } = await supabase.from("project_files").insert([{
          project_id: projectId,
          file_name: title || selectedFile.name,
          file_url: publicUrl,
          file_type: fileType,
          file_size: selectedFile.size,
          description: (description || "") + (isTrainerBag ? " #trainer_bag" : ""),
          uploaded_by: user?.id,
        }]);

        if (error) throw error;
        toast.success(t("common.success"));
        setOpen(false);
        resetForm();
        loadFiles();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    if (!(await confirm(t("common.confirmDelete", "هل أنت متأكد من الحذف؟")))) return;

    try {
      // If it's a storage file, delete from bucket
      if (file.file_type !== "youtube") {
        const path = file.file_url.split("/").slice(-2).join("/"); // Get path in bucket
        await supabase.storage.from("project-files").remove([path]);
      }

      const { error } = await supabase.from("project_files").delete().eq("id", file.id);
      if (error) throw error;

      await logAudit("delete", "project_file", file.id);
      toast.success(t("common.success"));
      loadFiles();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setYoutubeUrl("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image": return <ImageIcon className="h-8 w-8 text-emerald-500" />;
      case "video": return <Video className="h-8 w-8 text-blue-500" />;
      case "pdf": return <FileText className="h-8 w-8 text-rose-500" />;
      case "youtube": return <Play className="h-8 w-8 text-red-500" />;
      default: return <FileText className="h-8 w-8 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {ConfirmDialogNode}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {isTrainerBag ? (t("projects.trainer_bag") || "حقيبة المدرب") : t("projects.files", "ملفات ووسائط المشروع")}
        </h2>
        {isManager && (
          <Button size="sm" className="rounded-xl font-bold shadow-sm h-10 px-4" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 me-1.5" />
            {t("common.add", "إضافة")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center bg-muted/20 rounded-3xl border border-dashed">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">{t("projects.noFiles", "لا توجد ملفات مرفوعة للمشروع بعد.")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {files.map((file) => (
            <div key={file.id} className="bg-card rounded-3xl overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-border/50 shadow-sm flex flex-col">
              {/* Media Preview Box */}
              <div className="h-40 bg-muted/40 flex items-center justify-center relative overflow-hidden">
                {isManager && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 start-2 h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {file.file_type === "image" ? (
                  <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : file.file_type === "youtube" ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <img
                      src={`https://img.youtube.com/vi/${getYoutubeId(file.youtube_url || "")}/hqdefault.jpg`}
                      alt={file.file_name}
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                    <div className="z-10 h-12 w-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                      <Play className="h-6 w-6 fill-current" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {getFileIcon(file.file_type)}
                    <span className="text-xs font-semibold text-muted-foreground uppercase">{file.file_type}</span>
                  </div>
                )}

                {/* Hover overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                  <Button size="sm" variant="secondary" onClick={() => setPreviewFile(file)}>
                    {file.file_type === "youtube" ? t("common.watch", "مشاهدة") : t("common.preview", "معاينة")}
                  </Button>
                  {file.file_type !== "youtube" && (
                    <Button size="icon" variant="secondary" className="h-8 w-8" asChild>
                      <a href={file.file_url} download target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Text info */}
              <div className="p-4 space-y-2 border-t border-border/50 bg-background/50 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-foreground/90 text-sm line-clamp-1 flex-1" title={file.file_name}>
                    {file.file_name}
                  </div>
                </div>
                {file.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{file.description}</p>
                )}
                <div className="flex-1"></div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
                    {new Date(file.created_at).toLocaleDateString("ar-SA")}
                  </span>
                  <div className="flex items-center gap-2">
                    {file.file_type !== "youtube" && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {(file.file_size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopyLink(file.youtube_url || file.file_url)}
                        className="hover:text-primary p-1 bg-muted/50 rounded-md transition-colors"
                        title={t("common.copyLink", "نسخ الرابط")}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        href={file.youtube_url || file.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary p-1 bg-muted/50 rounded-md transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload/Add Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("projects.addFile", "إضافة ملف أو وسائط")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("projects.uploadType", "نوع الإضافة")}</Label>
              <Select
                value={uploadType}
                onValueChange={(v) => setUploadType(v as "file" | "youtube")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">{t("projects.uploadFile", "ملف (صورة، فيديو، PDF، مستند)")}</SelectItem>
                  <SelectItem value="youtube">{t("projects.youtubeVideo", "فيديو يوتيوب (YouTube)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("projects.fileTitle", "العنوان / الاسم")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
                placeholder={uploadType === "youtube" ? "عنوان فيديو اليوتيوب" : "اختياري - اسم للملف المرفوع"}
              />
            </div>

            {uploadType === "youtube" ? (
              <div>
                <Label>{t("projects.youtubeUrl", "رابط فيديو يوتيوب")}</Label>
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="mt-1"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
            ) : (
              <div>
                <Label>{t("projects.pickFile", "اختر الملف")}</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="mt-1 cursor-pointer"
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                />
              </div>
            )}

            <div>
              <Label>{t("common.description", "الوصف")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                placeholder="نبذة مختصرة أو ملاحظات عن هذا الملف"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin me-2" />
                  {t("common.uploading", "جاري الرفع...")}
                </>
              ) : (
                t("common.save", "حفظ")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(v) => { if (!v) setPreviewFile(null); }}>
        {previewFile && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center pr-6">
                <span>{previewFile.file_name}</span>
                {previewFile.description && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {previewFile.description}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center p-2 min-h-[300px]">
              {previewFile.file_type === "image" && (
                <img src={previewFile.file_url} alt={previewFile.file_name} className="max-w-full max-h-[70vh] rounded-md object-contain" />
              )}

              {previewFile.file_type === "youtube" && (
                <div className="w-full aspect-video rounded-md overflow-hidden bg-black">
                  <iframe
                    src={previewFile.file_url}
                    title={previewFile.file_name}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              )}

              {previewFile.file_type === "video" && (
                <video src={previewFile.file_url} controls className="max-w-full max-h-[70vh] rounded-md" />
              )}

              {previewFile.file_type === "pdf" && (
                <iframe src={previewFile.file_url} title={previewFile.file_name} className="w-full h-[60vh] rounded-md" />
              )}

              {previewFile.file_type === "document" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <FileText className="h-16 w-16 text-primary" />
                  <p className="text-sm font-medium">{t("projects.noPreview", "معاينة الملف غير متوفرة لهذا النوع من المستندات.")}</p>
                  <Button asChild>
                    <a href={previewFile.file_url} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 me-2" />
                      {t("common.download", "تحميل الملف")}
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
