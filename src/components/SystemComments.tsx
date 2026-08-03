import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  created_by: string | null;
  profiles?: { full_name: string | null, email: string | null } | null;
}

export const SystemComments = ({ entityType, entityId }: { entityType: string, entityId: string }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { confirm, ConfirmDialogNode } = useConfirm();

  const load = async () => {
    // Note: If you don't have a foreign key set up explicitly for 'created_by' in 'system_comments' to 'profiles', 
    // we fetch profiles manually or assume the DB handles the view.
    // Given standard supabase schema, profiles table is often linked to auth.users.
    // If profiles isn't directly queryable this way, we'll gracefully fallback.
    const { data, error } = await supabase
      .from("system_comments")
      .select(`
        id, content, created_at, created_by
      `)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });
    
    if (!error && data) {
      // In a real app we'd join with profiles, but for safety in this refactor step, 
      // we'll just fetch profiles in a second query to avoid breaking if the FK isn't perfectly mapped.
      const userIds = Array.from(new Set(data.map(c => c.created_by).filter(Boolean)));
      let profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profData } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds as string[]);
        (profData || []).forEach(p => { profiles[p.id] = p; });
      }

      const enhanced = data.map(c => ({
        ...c,
        profiles: c.created_by ? profiles[c.created_by] : null
      }));
      setComments(enhanced as Comment[]);
    }
  };

  useEffect(() => {
    if (entityId) load();
  }, [entityId, entityType]);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("system_comments").insert([{
      entity_type: entityType,
      entity_id: entityId,
      content: newComment,
      created_by: user?.id,
    }]);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setNewComment("");
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm(t("common.deleteConfirm", "هل أنت متأكد من الحذف؟")))) return;
    const { error } = await supabase.from("system_comments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <Card>
      {ConfirmDialogNode}
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t("comments.title", "التعليقات")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">{t("comments.empty", "لا توجد تعليقات بعد")}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-muted/30 p-3 rounded-md text-sm group relative">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold">{c.profiles?.full_name || c.profiles?.email || t("common.user", "مستخدم")}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: i18n.language === 'ar' ? ar : enUS })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{c.content}</p>
                {user?.id === c.created_by && (
                  <button 
                    onClick={() => handleDelete(c.id)}
                    className="absolute top-2 left-2 rtl:right-auto rtl:left-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 p-1 rounded transition-all"
                    title={t("common.delete", "حذف")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea 
            value={newComment} 
            onChange={(e) => setNewComment(e.target.value)} 
            placeholder={t("comments.placeholder", "اكتب تعليقاً...")}
            className="min-h-[60px]"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAdd} disabled={loading || !newComment.trim()}>
            <Send className="h-4 w-4 rtl:rotate-180 me-2" />
            {t("comments.add", "إضافة")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
