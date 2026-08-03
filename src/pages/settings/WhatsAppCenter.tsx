import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendWhatsAppModal } from "@/components/whatsapp/SendWhatsAppModal";
import { Send, Settings, CheckCircle2, XCircle, MessageSquare, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Notifications from "./Notifications";

interface Template {
  id: string;
  key: string;
  name: string;
  channel: string;
  body_template: string;
  variables: string[];
  manual_variables: string[];
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
}

export default function WhatsAppCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_templates")
      .select("*")
      .eq("channel", "whatsapp")
      .order("usage_count", { ascending: false });

    if (error) {
      toast.error(t("errors.fetchFailed"));
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openSendModal = (key: string) => {
    setSelectedTemplateKey(key);
    setSendModalOpen(true);
  };

  return (
    <div dir="rtl" className="space-y-6 animate-in fade-in duration-500 bg-background/50 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-1">
            التواصل
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            إدارة قوالب واتساب وسجل الرسائل المرسلة
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/whatsapp-templates")}>
            <Settings className="w-4 h-4 me-2" />
            إدارة القوالب والمتغيرات
          </Button>
          <Button variant="outline" onClick={() => navigate("/whatsapp-automations")}>
            <Settings className="w-4 h-4 me-2" />
            إعدادات الرسائل التلقائية
          </Button>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60 rounded-xl mb-4">
          <TabsTrigger value="notifications" className="rounded-lg py-2.5 gap-1.5"><Bell className="h-4 w-4" />مركز الرسائل</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-lg py-2.5 gap-1.5"><MessageSquare className="h-4 w-4" />قوالب الرسائل</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>مكتبة القوالب (Templates)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم القالب</TableHead>
                      <TableHead>النوع (Key)</TableHead>
                      <TableHead>المتغيرات المطلوبة</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>عدد الاستخدام</TableHead>
                      <TableHead>إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-6">جاري التحميل...</TableCell></TableRow>
                    ) : templates.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-6">لا توجد قوالب</TableCell></TableRow>
                    ) : (
                      templates.map((tpl) => (
                        <TableRow key={tpl.id}>
                          <TableCell className="font-medium">{tpl.name}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-1 rounded">{tpl.key}</code></TableCell>
                          <TableCell className="max-w-[250px] flex flex-wrap gap-1">
                            {(tpl.variables || []).map((v) => (
                              <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
                            ))}
                            {(tpl.manual_variables || []).map((v) => (
                              <Badge key={v} variant="outline" className="text-[10px] border-primary/50">{v} (يدوي)</Badge>
                            ))}
                          </TableCell>
                          <TableCell>
                            {tpl.is_active ? (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle2 className="w-3 h-3 me-1" /> فعال</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 me-1" /> معطل</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{tpl.usage_count} مرة</div>
                            {tpl.last_used_at && (
                              <div className="text-xs text-muted-foreground">{new Date(tpl.last_used_at).toLocaleDateString("ar-SA")}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => openSendModal(tpl.key)}>
                              إرسال
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Notifications />
        </TabsContent>
      </Tabs>

      {sendModalOpen && (
        <SendWhatsAppModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
          defaultTemplate={selectedTemplateKey || ""}
          templates={templates}
          onSuccess={loadTemplates}
        />
      )}
    </div>
  );
}
