import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Clock, Filter, RefreshCw, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface EditRequest {
  id: string;
  participant_id: string;
  requester_id: string;
  requested_changes: Record<string, any>;
  status: "pending" | "approved" | "rejected" | "modified";
  reviewer_id: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  // Joined
  participant_name?: string;
}

const STATUS_CONFIG = {
  pending:  { label: "قيد المراجعة", labelEn: "Pending",  icon: Clock,       color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "مقبول",        labelEn: "Approved",  icon: CheckCircle, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "مرفوض",        labelEn: "Rejected",  icon: XCircle,     color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  modified: { label: "معدّل",         labelEn: "Modified",  icon: RefreshCw,   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "الاسم الكامل",
  phone: "رقم الجوال",
  email: "البريد الإلكتروني",
  date_of_birth: "تاريخ الميلاد",
  national_id: "رقم الهوية",
  notes: "ملاحظات",
};

const ProfileEditRequests = () => {
  const { t, i18n } = useTranslation();
  const { user, isSystemAdmin, hasPermission } = useAuth();
  const isRtl = i18n.language === "ar";
  const isAdmin = isSystemAdmin || hasPermission("manage_participants");

  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [selected, setSelected] = useState<EditRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (selected) {
      supabase
        .from("participants")
        .select("*")
        .eq("id", selected.participant_id)
        .maybeSingle()
        .then(({ data }) => {
          setCurrentParticipant(data);
        });
    } else {
      setCurrentParticipant(null);
    }
  }, [selected]);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("profile_edit_requests")
      .select("*, participants(full_name)")
      .order("created_at", { ascending: false });

    if (!isAdmin) q = q.eq("requester_id", user?.id);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);

    const { data, error } = await q;
    if (error) toast.error(error.message);
    else {
      setRequests((data ?? []).map((r: any) => ({
        ...r,
        participant_name: r.participants?.full_name,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handleAction = async (action: "approved" | "rejected" | "modified", modifiedChanges?: Record<string, any>) => {
    if (!selected) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("profile_edit_requests")
        .update({
          status: action,
          reviewer_id: user?.id,
          review_notes: reviewNotes || null,
          rejection_reason: action === "rejected" ? rejectionReason : null,
          reviewed_at: new Date().toISOString(),
          ...(modifiedChanges ? { requested_changes: modifiedChanges } : {}),
        } as any)
        .eq("id", selected.id);

      if (error) throw error;

      // If approved, apply changes to the participant record
      if (action === "approved" || action === "modified") {
        const changes = modifiedChanges || selected.requested_changes;
        const allowedFields = ["full_name", "phone", "date_of_birth", "notes"];
        const safeChanges = Object.fromEntries(
          Object.entries(changes).filter(([k]) => allowedFields.includes(k))
        );

        if (Object.keys(safeChanges).length > 0) {
          await supabase
            .from("participants")
            .update(safeChanges as any)
            .eq("id", selected.participant_id);
        }
      }

      // Audit log
      await supabase.from("audit_log").insert({
        entity_type: "profile_edit_request",
        entity_id: selected.id,
        action: `edit_request_${action}`,
        user_id: user?.id,
        metadata: { review_notes: reviewNotes, rejection_reason: rejectionReason },
      } as any);

      toast.success(t("common.success"));
      setSelected(null);
      setReviewNotes("");
      setRejectionReason("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("profileEditRequests.title", isAdmin ? "طلبات تعديل البيانات" : "طلباتي لتعديل البيانات")}
          </h1>
          <p className="text-muted-foreground">
            {t("profileEditRequests.desc", "مراجعة وإدارة طلبات تعديل البيانات الشخصية للمشاركين")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all", "الكل")}</SelectItem>
              <SelectItem value="pending">{STATUS_CONFIG.pending.label}</SelectItem>
              <SelectItem value="approved">{STATUS_CONFIG.approved.label}</SelectItem>
              <SelectItem value="rejected">{STATUS_CONFIG.rejected.label}</SelectItem>
              <SelectItem value="modified">{STATUS_CONFIG.modified.label}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="outline" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <CheckCircle className="mb-4 h-12 w-12 opacity-20" />
            <p>{t("profileEditRequests.empty", "لا توجد طلبات بهذا الفلتر")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => {
            const cfg = STATUS_CONFIG[req.status];
            const StatusIcon = cfg.icon;
            return (
              <Card key={req.id} className="overflow-hidden border-none shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      {isAdmin && req.participant_name && (
                        <p className="font-semibold">{req.participant_name}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(req.requested_changes).map(([field, value]) => (
                          <span key={field} className="rounded-lg border bg-muted/50 px-2 py-0.5 text-xs">
                            <span className="font-medium">{FIELD_LABELS[field] || field}:</span>{" "}
                            <span className="text-muted-foreground">{String(value)}</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: isRtl ? ar : undefined })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {isRtl ? cfg.label : cfg.labelEn}
                      </span>
                      {isAdmin && req.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => setSelected(req)}>
                          <Eye className="me-1 h-3.5 w-3.5" />
                          {t("common.review", "مراجعة")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {req.rejection_reason && (
                    <div className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {t("profileEditRequests.reason", "سبب الرفض:")} {req.rejection_reason}
                    </div>
                  )}
                  {req.review_notes && req.status !== "rejected" && (
                    <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      {t("profileEditRequests.reviewNote", "ملاحظة المراجع:")} {req.review_notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("profileEditRequests.reviewTitle", "مراجعة طلب التعديل")}</DialogTitle>
            <DialogDescription>
              {selected?.participant_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("profileEditRequests.requestedChanges", "التعديلات المطلوبة (مقارنة البيانات القديمة بالجديدة)")}
              </p>
              <div className="grid grid-cols-3 gap-2 border-b pb-1 text-xs font-bold text-muted-foreground">
                <span>{t("profileEditRequests.field", "الحقل")}</span>
                <span>{t("profileEditRequests.oldValue", "القيمة السابقة")}</span>
                <span>{t("profileEditRequests.newValue", "القيمة الجديدة")}</span>
              </div>
              {selected && Object.entries(selected.requested_changes).map(([field, value]) => {
                const oldValue = currentParticipant ? currentParticipant[field] : "...";
                return (
                  <div key={field} className="grid grid-cols-3 gap-2 border-b py-2 text-sm items-center">
                    <span className="font-medium text-xs">{FIELD_LABELS[field] || field}</span>
                    <span className="text-destructive line-through text-xs truncate" title={String(oldValue || "")}>
                      {String(oldValue || "—")}
                    </span>
                    <span className="text-success font-semibold text-xs truncate" title={String(value || "")}>
                      {String(value || "—")}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label>{t("profileEditRequests.reviewNotes", "ملاحظات (اختياري)")}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                placeholder={t("profileEditRequests.reviewNotesPlaceholder", "أضف ملاحظاتك هنا...")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("profileEditRequests.rejectionReason", "سبب الرفض (في حالة الرفض)")}</Label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t("profileEditRequests.rejectionPlaceholder", "اكتب سبب الرفض...")}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={() => handleAction("rejected")}
              disabled={processing || !rejectionReason}
              className="w-full sm:w-auto"
            >
              {processing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("common.reject", "رفض")}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("approved")}
              disabled={processing}
              className="w-full sm:w-auto text-green-600 border-green-200 hover:bg-green-50"
            >
              {processing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("common.approve", "قبول")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileEditRequests;
