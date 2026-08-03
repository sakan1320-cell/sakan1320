import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, UserPlus, Paperclip } from "lucide-react";


interface Request {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  national_id: string | null;
  requested_role: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  rejection_reason: string | null;
  attachment_url: string | null;
}

const StaffRequests = () => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["executive", "assistant"]);
  const fallbackRoute = useFallbackRoute();
  const [rows, setRows] = useState<Request[]>([]);
  const [tab, setTab] = useState("pending");
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("staff_registration_requests").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Request[]);
  };

  useEffect(() => { if (canManage) load(); }, [canManage]);

  const approve = async (r: Request) => {
    const { data, error } = await supabase.functions.invoke("approve-staff-request", {
      body: { request_id: r.id },
    });
    if (error || !data?.success) {
      toast.error(error?.message || data?.error || t("common.error"));
      return;
    }
    toast.success(t("staffRequests.approved"));
    load();
  };

  const reject = async (r: Request) => {
    const { error } = await supabase
      .from("staff_registration_requests")
      .update({ status: "rejected", rejection_reason: reason[r.id] || null, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("staffRequests.rejected"));
    load();
  };

  if (!canManage) {
    return <Navigate to={fallbackRoute} replace />;
  }

  const filtered = rows.filter((r) => r.status === tab);

  return (
    <div className="space-y-6">

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            {t("staffRequests.pending")}
            {rows.filter((r) => r.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ms-2">{rows.filter((r) => r.status === "pending").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">{t("staffRequests.approvedTab")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("staffRequests.rejectedTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{t("staffRequests.empty")}</CardContent></Card>
          ) : (
            filtered.map((r) => (
              <Card key={r.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">{r.full_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.email} · <span dir="ltr">{r.phone}</span>
                    </p>
                  </div>
                  <Badge variant="outline">{t(`roles.${r.requested_role}`)}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {r.national_id && <p className="text-sm"><strong>{t("register.nationalId")}:</strong> {r.national_id}</p>}
                  {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                  {r.rejection_reason && <p className="text-sm text-destructive"><strong>{t("staffRequests.rejectionReason")}:</strong> {r.rejection_reason}</p>}
                  {r.attachment_url && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const { data, error } = await supabase.storage
                        .from("staff-attachments")
                        .createSignedUrl(r.attachment_url!, 300);
                      if (error || !data?.signedUrl) { toast.error(error?.message || t("common.error")); return; }
                      window.open(data.signedUrl, "_blank");
                    }}>
                      <Paperclip className="h-4 w-4 me-1" />
                      {t("staffRequests.viewAttachment", "عرض المرفق")}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>

                  {r.status === "pending" && (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea
                        placeholder={t("staffRequests.rejectionReason")}
                        rows={2}
                        value={reason[r.id] ?? ""}
                        onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approve(r)}>
                          <UserPlus className="h-4 w-4 me-1" />{t("staffRequests.approve")}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => reject(r)}>
                          <X className="h-4 w-4 me-1" />{t("staffRequests.reject")}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffRequests;
