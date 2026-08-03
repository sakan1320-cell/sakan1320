import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase as sb } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X, CheckSquare, Paperclip, MessageSquare, History, Play, Plus,
  Trash2, User, Clock, Shield, Award, Link2, Youtube, Loader2, Send,
  ChevronRight, ChevronLeft, KanbanSquare, AlignLeft, ListTodo, Activity, Tag, Settings, Copy
} from "lucide-react";
import { toast } from "sonner";

const supabase = sb as any;

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onSaved: () => void;
  projects: any[];
}

export const TaskDetailDrawer = ({ taskId, onClose, onSaved, projects }: TaskDetailDrawerProps) => {
  const { t } = useTranslation();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  
  // Tab states
  const [checklists, setChecklists] = useState<any[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState<Record<string, string>>({});
  
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ytLink, setYtLink] = useState("");
  
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  
  const [logs, setLogs] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);

  // Load support info
  const loadUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");
    setUsers(data ?? []);
  };

  const loadAllTasks = async (projId: string) => {
    const { data } = await supabase.from("tasks").select("id, title").eq("project_id", projId);
    setAllTasks(data ?? []);
  };

  const loadStages = async (projId: string) => {
    const { data } = await supabase.from("workflow_stages").select("*").eq("project_id", projId).order("sort_order");
    setStages(data ?? []);
  };

  const loadLogs = async (id: string) => {
    const { data } = await supabase.from("task_activity_log").select("*").eq("task_id", id).order("created_at", { ascending: false });
    setLogs(data ?? []);
  };

  const loadRelations = async (id: string) => {
    const { data } = await supabase.from("task_relationships").select("*").or(`source_task_id.eq.${id},target_task_id.eq.${id}`);
    setRelations(data ?? []);
  };

  const loadChecklists = useCallback(async (id: string) => {
    const { data } = await supabase.from("task_checklists").select("*").eq("task_id", id).order("created_at");
    const checklistIds = (data ?? []).map((c: any) => c.id);
    
    if (checklistIds.length > 0) {
      const { data: items } = await supabase.from("task_checklist_items").select("*").in("checklist_id", checklistIds).order("sort_order");
      const mapped = (data ?? []).map((c: any) => ({
        ...c,
        items: (items ?? []).filter((it: any) => it.checklist_id === c.id)
      }));
      setChecklists(mapped);
    } else {
      setChecklists([]);
    }
  }, []);

  const loadAttachments = async (id: string) => {
    const { data } = await supabase.from("task_attachments").select("*").eq("task_id", id).order("uploaded_at", { ascending: false });
    setAttachments(data ?? []);
  };

  const loadComments = async (id: string) => {
    const { data } = await supabase.from("task_comments").select(`
      id, body, created_at, user_id, parent_id,
      profile:profiles!task_comments_user_id_fkey(full_name)
    `).eq("task_id", id).order("created_at", { ascending: true });
    setComments(data ?? []);
  };

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
    if (data) {
      setTask(data);
      await Promise.all([
        loadStages(data.project_id),
        loadAllTasks(data.project_id),
        loadChecklists(data.id),
        loadAttachments(data.id),
        loadComments(data.id),
        loadLogs(data.id),
        loadRelations(data.id)
      ]);
    }
    setLoading(false);
  }, [taskId, loadChecklists]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (taskId) {
      loadTask();
    } else {
      setTask(null);
    }
  }, [taskId, loadTask]);

  const handleUpdateField = async (field: string, val: any) => {
    if (!task) return;
    const oldVal = task[field];
    const { error } = await supabase.from("tasks").update({ [field]: val }).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTask({ ...task, [field]: val });
    onSaved();

    // Log Activity
    const actor = (await supabase.auth.getUser()).data.user;
    if (actor) {
      await supabase.from("task_activity_log").insert({
        task_id: task.id,
        actor_id: actor.id,
        action: `updated_${field}`,
        old_value: { [field]: oldVal },
        new_value: { [field]: val }
      });
      loadLogs(task.id);
    }
  };

  // Checklist Actions
  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim() || !task) return;
    const { data, error } = await supabase.from("task_checklists").insert({
      task_id: task.id,
      title: newChecklistTitle
    }).select().single();
    if (error) return toast.error(error.message);
    setNewChecklistTitle("");
    loadChecklists(task.id);
  };

  const handleAddChecklistItem = async (checklistId: string) => {
    const text = newChecklistItem[checklistId];
    if (!text?.trim() || !task) return;
    const { error } = await supabase.from("task_checklist_items").insert({
      checklist_id: checklistId,
      title: text,
      is_completed: false
    });
    if (error) return toast.error(error.message);
    setNewChecklistItem({ ...newChecklistItem, [checklistId]: "" });
    loadChecklists(task.id);
  };

  const handleToggleChecklistItem = async (itemId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("task_checklist_items").update({ is_completed: !currentStatus }).eq("id", itemId);
    if (error) return toast.error(error.message);
    loadChecklists(task!.id);
  };

  const handleAddAttachmentLink = async () => {
    if (!ytLink.trim() || !task) return;
    const isYt = ytLink.includes("youtube.com") || ytLink.includes("youtu.be");
    const { error } = await supabase.from("task_attachments").insert({
      task_id: task.id,
      file_name: isYt ? "رابط فيديو YouTube" : "رابط خارجي",
      file_url: ytLink,
      file_type: isYt ? "youtube" : "link"
    });
    if (error) return toast.error(error.message);
    setYtLink("");
    loadAttachments(task.id);
  };

  // Add Comment
  const handleAddComment = async (parentId: string | null = null) => {
    if (!commentText.trim() || !task) return;
    setSendingComment(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setSendingComment(false);

    const { error } = await supabase.from("task_comments").insert({
      task_id: task.id,
      user_id: userData.user.id,
      body: commentText,
      parent_id: parentId
    });

    if (error) toast.error(error.message);
    else {
      setCommentText("");
      loadComments(task.id);
    }
    setSendingComment(false);
  };

  // Attachments Upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${task.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from("task_attachments").insert({
        task_id: task.id,
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type || "application/octet-stream"
      });
      if (dbError) throw dbError;
      toast.success(t("common.success"));
      loadAttachments(task.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#F1F2F4] dark:bg-[#22272B] w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col relative shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute left-4 top-4 h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors z-50 text-[#44546F] dark:text-[#8C9BAB]"
          title={t("common.close", "إغلاق")}
        >
          <X className="h-5 w-5" />
        </button>

        {loading || !task ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar text-[#172B4D] dark:text-[#B6C2CF] pb-24">
              
              {/* Header: Icon + Title */}
              <div className="flex items-start gap-4 mb-8 pl-8">
                 <KanbanSquare className="h-6 w-6 mt-1.5 text-[#44546F] dark:text-[#8C9BAB] shrink-0" />
                 <div className="w-full">
                   <Input
                     className="text-2xl font-bold border-transparent bg-transparent hover:bg-white dark:hover:bg-[#101204] focus-visible:bg-white dark:focus-visible:bg-[#101204] focus-visible:ring-2 focus-visible:ring-primary px-3 py-1.5 h-auto rounded-lg -ml-3 shadow-none text-foreground"
                     value={task.title}
                     onChange={(e) => setTask({ ...task, title: e.target.value })}
                     onBlur={() => handleUpdateField("title", task.title)}
                   />
                   <p className="text-sm mt-1 px-3 text-[#44546F] dark:text-[#8C9BAB]">
                     في القائمة <span className="underline font-semibold cursor-pointer">{stages.find(s => s.id === task.workflow_stage_id)?.name_ar || "جديد"}</span>
                   </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Column (Main Content) - 3 cols width */}
                <div className="lg:col-span-3 space-y-10">
                   
                   {/* Description */}
                   <div className="flex items-start gap-4">
                      <AlignLeft className="h-6 w-6 text-[#44546F] dark:text-[#8C9BAB] shrink-0" />
                      <div className="w-full space-y-3">
                         <h3 className="font-bold text-lg text-foreground">الوصف</h3>
                         <Textarea
                           className="min-h-[100px] bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] border-none shadow-none rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background text-sm p-4 transition-colors text-foreground placeholder:text-[#44546F] dark:placeholder:text-[#8C9BAB]"
                           placeholder="أضف وصفاً أكثر تفصيلاً..."
                           value={task.description || ""}
                           onChange={(e) => setTask({ ...task, description: e.target.value })}
                           onBlur={() => handleUpdateField("description", task.description)}
                         />
                      </div>
                   </div>

                   {/* Checklists */}
                   {checklists.map((c) => (
                     <div key={c.id} className="flex items-start gap-4">
                        <CheckSquare className="h-6 w-6 text-[#44546F] dark:text-[#8C9BAB] shrink-0" />
                        <div className="w-full space-y-4">
                           <div className="flex items-center justify-between">
                              <h3 className="font-bold text-lg text-foreground">{c.title}</h3>
                              <Button variant="secondary" size="sm" className="bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] border-none">حذف</Button>
                           </div>
                           
                           {/* Progress Bar */}
                           <div className="flex items-center gap-3">
                             <span className="text-xs font-semibold text-[#44546F] dark:text-[#8C9BAB] w-8">
                               {c.items?.length ? Math.round((c.items.filter((i:any) => i.is_completed).length / c.items.length) * 100) : 0}%
                             </span>
                             <div className="h-2 w-full bg-[#091E420F] dark:bg-[#A6C5E20A] rounded-full overflow-hidden">
                               <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${c.items?.length ? (c.items.filter((i:any) => i.is_completed).length / c.items.length) * 100 : 0}%` }} />
                             </div>
                           </div>

                           <div className="space-y-2 pt-2">
                             {(c.items || []).map((item: any) => (
                               <div key={item.id} className="flex items-start gap-3 p-2 hover:bg-[#091E420F] dark:hover:bg-[#A6C5E20A] rounded-lg transition-colors group">
                                 <input
                                   type="checkbox"
                                   checked={item.is_completed}
                                   onChange={() => handleToggleChecklistItem(item.id, item.is_completed)}
                                   className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                                 />
                                 <span className={`text-sm flex-1 ${item.is_completed ? "line-through text-[#44546F] dark:text-[#8C9BAB]" : "text-foreground"}`}>
                                   {item.title}
                                 </span>
                               </div>
                             ))}
                             <div className="pt-2">
                               <Input
                                 placeholder="إضافة عنصر..."
                                 className="h-10 text-sm bg-transparent border-transparent hover:bg-[#091E420F] dark:hover:bg-[#A6C5E20A] focus-visible:bg-background focus-visible:ring-2 focus-visible:border-transparent transition-colors rounded-lg shadow-none"
                                 value={newChecklistItem[c.id] || ""}
                                 onChange={(e) => setNewChecklistItem({ ...newChecklistItem, [c.id]: e.target.value })}
                                 onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklistItem(c.id); }}
                               />
                             </div>
                           </div>
                        </div>
                     </div>
                   ))}
                   
                   {/* Activity / Comments */}
                   <div className="flex items-start gap-4">
                      <ListTodo className="h-6 w-6 text-[#44546F] dark:text-[#8C9BAB] shrink-0" />
                      <div className="w-full space-y-6">
                         <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg text-foreground">التعليقات والنشاط</h3>
                            <Button variant="secondary" size="sm" className="bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] border-none font-semibold">إظهار التفاصيل</Button>
                         </div>
                         
                         {/* Comment Input */}
                         <div className="flex items-start gap-3">
                           <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 font-bold text-primary shadow-sm mt-1">أ</div>
                           <div className="w-full bg-background dark:bg-[#101204] rounded-xl shadow-sm border border-border/50 overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
                             <Textarea 
                               className="bg-transparent border-none shadow-none min-h-[60px] resize-none focus-visible:ring-0 text-sm p-3" 
                               placeholder="اكتب تعليقاً..."
                               value={commentText}
                               onChange={(e) => setCommentText(e.target.value)}
                             />
                             <div className="px-3 py-2 bg-muted/20 border-t border-border/50 flex justify-end">
                               <Button size="sm" onClick={() => handleAddComment()} disabled={sendingComment || !commentText.trim()} className="h-8 px-4 font-bold rounded-lg">
                                 حفظ
                               </Button>
                             </div>
                           </div>
                         </div>

                         {/* Activity Feed */}
                         <div className="space-y-4 pt-4">
                           {comments.map((c) => (
                             <div key={c.id} className="flex gap-3">
                               <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary shadow-sm">
                                 {c.profile?.full_name?.charAt(0) || "U"}
                               </div>
                               <div className="space-y-1 w-full">
                                 <div className="flex items-baseline gap-2">
                                   <span className="font-bold text-sm text-foreground">{c.profile?.full_name || t("common.user")}</span>
                                   <span className="text-[11px] text-[#44546F] dark:text-[#8C9BAB]">{new Date(c.created_at).toLocaleString("ar-SA")}</span>
                                 </div>
                                 <div className="bg-background dark:bg-[#101204] rounded-lg p-3 shadow-sm border border-border/50 text-sm text-foreground inline-block">
                                   {c.body}
                                 </div>
                               </div>
                             </div>
                           ))}

                           {logs.slice(0, 5).map((log) => (
                             <div key={log.id} className="flex gap-3 items-start">
                               <div className="h-8 w-8 flex items-center justify-center shrink-0">
                                 <div className="h-2 w-2 rounded-full bg-[#44546F] dark:bg-[#8C9BAB]"></div>
                               </div>
                               <div className="text-sm text-[#172B4D] dark:text-[#B6C2CF] py-1.5">
                                 <span className="font-bold text-foreground">النظام</span> 
                                 <span className="mx-1">قام بـ {log.action.replace("updated_", "تحديث حقل ")}</span>
                                 <span className="text-[11px] text-[#44546F] dark:text-[#8C9BAB] mr-2">{new Date(log.created_at).toLocaleString("ar-SA", { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                   </div>
                </div>
                
                {/* Right Column (Sidebar Actions) - 1 col width */}
                <div className="space-y-6">
                   <div className="space-y-2">
                     <h4 className="text-[11px] font-bold text-[#44546F] dark:text-[#8C9BAB] uppercase tracking-wider">إضافة للبطاقة</h4>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg"><User className="h-4 w-4 ml-2"/> الأعضاء</Button>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg"><Tag className="h-4 w-4 ml-2"/> التسميات</Button>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg" onClick={() => {
                        const title = prompt("أدخل عنوان القائمة:");
                        if (title) { setNewChecklistTitle(title); setTimeout(handleAddChecklist, 100); }
                     }}><CheckSquare className="h-4 w-4 ml-2"/> قائمة مهام</Button>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg"><Clock className="h-4 w-4 ml-2"/> التواريخ</Button>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg"><Paperclip className="h-4 w-4 ml-2"/> المرفقات</Button>
                   </div>

                   <div className="space-y-2">
                     <h4 className="text-[11px] font-bold text-[#44546F] dark:text-[#8C9BAB] uppercase tracking-wider">الإجراءات</h4>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg"><Copy className="h-4 w-4 ml-2"/> نسخ البطاقة</Button>
                     <Button variant="secondary" className="w-full justify-start bg-[#091E420F] hover:bg-[#091E4224] dark:bg-[#A6C5E20A] dark:hover:bg-[#A6C5E214] text-[#172B4D] dark:text-[#B6C2CF] font-semibold border-none rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4 ml-2"/> حذف البطاقة</Button>
                   </div>
                </div>
              </div>
            </div>

            {/* Bottom Floating Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-background border border-border/50 shadow-xl rounded-full px-2 py-1.5 flex items-center gap-1 z-50">
              <Button variant="ghost" size="sm" className="rounded-full px-4 font-bold text-xs"><Shield className="h-3.5 w-3.5 ml-1.5" /> ترقيات (Power-ups)</Button>
              <div className="w-px h-4 bg-border"></div>
              <Button variant="ghost" size="sm" className="rounded-full px-4 font-bold text-xs"><Bot className="h-3.5 w-3.5 ml-1.5" /> الأتمتة</Button>
              <div className="w-px h-4 bg-border"></div>
              <Button variant="ghost" size="sm" className="rounded-full px-4 font-bold text-xs"><MessageSquare className="h-3.5 w-3.5 ml-1.5" /> التعليقات</Button>
            </div>
          </>
        )}
      </div>
      
      {/* Backdrop click to close */}
      <div className="absolute inset-0 z-[-1]" onClick={onClose}></div>
    </div>
  );
};
