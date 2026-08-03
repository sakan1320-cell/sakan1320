import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DynamicField {
  id: string;
  type: "text" | "link" | "file_download" | "assignment_upload" | "media_view";
  title: string;
  content?: string;
  is_required: boolean;
}

interface SortableCourseItemCardProps {
  field: DynamicField;
  index: number;
  isRtl: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<DynamicField>) => void;
}

export function SortableCourseItemCard({ field, index, isRtl, onRemove, onUpdate }: SortableCourseItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id || `fallback-${index}` });
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `course-items/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from("project-files").upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from("project-files").getPublicUrl(filePath);
      onUpdate(field.id, { content: data.publicUrl });
      toast.success(isRtl ? "تم الرفع بنجاح" : "Uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(isRtl ? "فشل الرفع" : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-stretch mb-4 border rounded-xl bg-card shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary group ${isDragging ? "border-primary ring-1 ring-primary shadow-lg" : "border-border/60"}`}
    >
      {/* Absolute Number Badge */}
      <div className="absolute -top-3 -start-3 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-sm z-10">
        {index + 1}
      </div>

      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="flex items-center justify-center w-10 cursor-grab active:cursor-grabbing hover:text-primary transition-colors touch-none bg-muted/10 border-e rounded-s-xl"
      >
        <GripVertical className="h-5 w-5 opacity-40 hover:opacity-100" />
      </div>

      {/* Card Content */}
      <div className="flex-1 p-5 relative">
        <Button 
          type="button"
          variant="ghost" 
          size="icon" 
          className="absolute top-2 end-2 text-destructive opacity-50 hover:opacity-100 hover:bg-destructive/10 transition-all rounded-full h-8 w-8" 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(field.id); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        
        <div className="grid md:grid-cols-3 gap-5 pe-10">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isRtl ? "عنوان العنصر" : "Item Title"}</Label>
            <Input placeholder={isRtl ? "عنصر جديد" : "New Item"} value={field.title} onChange={e => onUpdate(field.id, { title: e.target.value })} className="bg-background h-10" />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isRtl ? "نوع العنصر" : "Type"}</Label>
            <Select value={field.type} onValueChange={(v: any) => onUpdate(field.id, { type: v })}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{isRtl ? "نص إرشادي" : "Text"}</SelectItem>
                <SelectItem value="link">{isRtl ? "رابط لقاء/خارجي" : "Link"}</SelectItem>
                <SelectItem value="file_download">{isRtl ? "ملف للتحميل" : "File Download"}</SelectItem>
                <SelectItem value="assignment_upload">{isRtl ? "مهمة (يتطلب رفع)" : "Assignment"}</SelectItem>
                <SelectItem value="media_view">{isRtl ? "عرض وسائط (فيديو، صورة، PDF)" : "View Media"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <div className="flex items-center gap-3 h-10 border rounded-md px-4 bg-background">
              <Switch checked={field.is_required} onCheckedChange={v => onUpdate(field.id, { is_required: v })} />
              <Label className="text-xs cursor-pointer">{isRtl ? "إجباري للعبور للمرحلة التالية" : "Required to proceed"}</Label>
            </div>
          </div>

          {(field.type === "link" || field.type === "file_download" || field.type === "text" || field.type === "media_view") && (
            <div className="md:col-span-3 space-y-1.5 pt-2">
              <Label className="text-xs text-muted-foreground">
                {field.type === "text" ? (isRtl ? "النص" : "Text Content") : 
                 (field.type === "link" ? (isRtl ? "الرابط (URL)" : "URL") : 
                 (isRtl ? "الملف المرفوع" : "Uploaded File"))}
              </Label>
              {field.type === "text" ? (
                <Textarea rows={2} value={field.content || ""} onChange={e => onUpdate(field.id, { content: e.target.value })} className="bg-background resize-y" />
              ) : field.type === "link" ? (
                <Input dir="ltr" value={field.content || ""} onChange={e => onUpdate(field.id, { content: e.target.value })} className="bg-background font-mono text-sm" placeholder="https://" />
              ) : (
                <div className="flex gap-2 items-center">
                  {field.content ? (
                    <div className="flex-1 bg-muted/50 rounded-md p-2 text-sm truncate font-mono" dir="ltr" title={field.content}>
                      {field.content.split('/').pop()?.split('?')[0] || "File uploaded"}
                    </div>
                  ) : (
                    <div className="flex-1 bg-muted/20 border border-dashed rounded-md p-2 text-sm text-muted-foreground text-center">
                      {isRtl ? "لم يتم رفع ملف بعد" : "No file uploaded yet"}
                    </div>
                  )}
                  <div className="relative shrink-0">
                    <Input 
                      type="file" 
                      accept={field.type === "media_view" ? "video/*,image/*,application/pdf" : "*"} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={handleFileUpload} 
                      disabled={isUploading} 
                    />
                    <Button type="button" variant={field.content ? "outline" : "secondary"} className="gap-2 w-full min-w-[120px]" disabled={isUploading}>
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {field.content ? (isRtl ? "تغيير الملف" : "Change File") : (isRtl ? "رفع ملف" : "Upload")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
