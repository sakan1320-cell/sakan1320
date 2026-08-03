import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlusCircle, HelpCircle, MessageCircle, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  requester_name?: string;
}

const CATEGORY_MAP: Record<string, string> = {
  general: "عام",
  technical: "مشكلة تقنية",
  billing: "المالية",
  account: "الحساب",
  content: "المحتوى التعليمي",
  other: "أخرى"
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "منخفضة", color: "bg-muted text-muted-foreground" },
  normal: { label: "عادية", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "عالية", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "عاجلة", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "مفتوحة", icon: AlertCircle, color: "text-blue-500" },
  in_progress: { label: "قيد المعالجة", icon: Clock, color: "text-orange-500" },
  waiting: { label: "بانتظار الرد", icon: MessageCircle, color: "text-yellow-500" },
  resolved: { label: "محلولة", icon: CheckCircle2, color: "text-green-500" },
  closed: { label: "مغلقة", icon: CheckCircle2, color: "text-muted-foreground" },
};

const SupportTickets = () => {
  const { t, i18n } = useTranslation();
  const { user, isSystemAdmin, hasPermission } = useAuth();
  const isRtl = i18n.language === "ar";
  const isAdmin = isSystemAdmin || hasPermission("manage_tickets");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Create Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    let q = supabase
      .from("support_tickets")
      .select("id, title, category, priority, status, created_at, profiles:requester_id(full_name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      q = q.eq("requester_id", user?.id);
    }

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
    } else {
      setTickets((data || []).map((t: any) => ({
        ...t,
        requester_name: t.profiles?.full_name || "Unknown"
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [isAdmin, user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        requester_id: user.id,
        title: title.trim(),
        body: body.trim(),
        category,
      } as any);

      if (error) throw error;
      toast.success(t("support.created", "تم إنشاء التذكرة بنجاح"));
      setIsCreateOpen(false);
      setTitle("");
      setBody("");
      setCategory("general");
      loadTickets();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("support.title", "تذاكر الدعم الفني")}</h1>
          <p className="text-muted-foreground">
            {isAdmin ? t("support.adminDesc", "إدارة تذاكر الدعم المقدمة من المستخدمين") : t("support.userDesc", "تتبع حالات تذاكر الدعم الخاصة بك أو أنشئ تذكرة جديدة")}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
            <PlusCircle className="me-2 h-4 w-4" />
            {t("support.newTicket", "تذكرة جديدة")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <HelpCircle className="mb-4 h-12 w-12 opacity-20" />
            <p>{t("support.empty", "لا توجد تذاكر حالياً")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map(ticket => {
            const statusCfg = STATUS_MAP[ticket.status] || STATUS_MAP.open;
            const prioCfg = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.normal;
            const StatusIcon = statusCfg.icon;

            return (
              <Card key={ticket.id} className="transition-shadow hover:shadow-md cursor-pointer border-none shadow-sm">
                <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn("h-4 w-4", statusCfg.color)} />
                      <h3 className="font-semibold text-lg leading-tight">{ticket.title}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span>#{ticket.id.split("-")[0]}</span>
                      {isAdmin && <span>بواسطة: {ticket.requester_name}</span>}
                      <span>{CATEGORY_MAP[ticket.category] || ticket.category}</span>
                      <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: isRtl ? ar : undefined })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", prioCfg.color)}>
                      {prioCfg.label}
                    </span>
                    <span className={cn("text-sm font-medium", statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("support.createTitle", "إنشاء تذكرة دعم جديدة")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("support.category", "التصنيف")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger dir={isRtl ? "rtl" : "ltr"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("common.title", "العنوان")}</Label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder={t("support.titlePlaceholder", "مشكلة في تسجيل الدخول...")}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>{t("support.details", "التفاصيل")}</Label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t("support.detailsPlaceholder", "اشرح المشكلة بالتفصيل هنا...")}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={submitting}>
                {t("common.cancel", "إلغاء")}
              </Button>
              <Button type="submit" disabled={submitting || !title || !body}>
                {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("common.send", "إرسال")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportTickets;
