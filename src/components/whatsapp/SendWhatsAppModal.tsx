import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Template {
  id: string;
  key: string;
  name: string;
  body_template: string;
  variables: string[];
  manual_variables: string[];
}

interface RecipientOption {
  id: string;
  kind: "employee" | "participant" | "guardian";
  name: string;
  phone: string;
}

export function SendWhatsAppModal({ open, onOpenChange, defaultTemplate, templates, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTemplate: string;
  templates: Template[];
  onSuccess?: () => void;
}) {
  const [templateKey, setTemplateKey] = useState(defaultTemplate);
  const [mode, setMode] = useState<"manual" | "existing">("existing");
  const [localPhone, setLocalPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  
  const [manualVars, setManualVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const selectedTemplate = templates.find(t => t.key === templateKey);

  useEffect(() => {
    if (open) loadRecipients();
  }, [open]);

  useEffect(() => {
    // Reset variables when template changes
    setManualVars({});
  }, [templateKey]);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    const [emp, part, guard] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone"),
      supabase.from("participants").select("id, full_name, phone"),
      supabase.from("guardians").select("id, full_name, phone"),
    ]);
    const opts: RecipientOption[] = [];
    (emp.data ?? []).forEach((r: any) => r.phone && opts.push({ id: `employee:${r.id}`, kind: "employee", name: r.full_name || r.email || "—", phone: r.phone }));
    (part.data ?? []).forEach((r: any) => r.phone && opts.push({ id: `participant:${r.id}`, kind: "participant", name: r.full_name, phone: r.phone }));
    (guard.data ?? []).forEach((r: any) => r.phone && opts.push({ id: `guardian:${r.id}`, kind: "guardian", name: r.full_name, phone: r.phone }));
    setRecipients(opts);
    setLoadingRecipients(false);
  };

  const finalPhone = useMemo(() => {
    if (mode === "existing") {
      const sel = recipients.find(r => r.id === selectedRecipientId);
      return sel ? (sel.phone.startsWith("+") ? sel.phone : `+966${sel.phone.replace(/\D/g,"").replace(/^0+/,"")}`) : "";
    }
    const raw = localPhone.trim();
    return raw ? (raw.startsWith("+") ? raw : `+${raw}`) : "";
  }, [mode, selectedRecipientId, localPhone, recipients]);

  const finalName = useMemo(() => {
    if (mode === "existing") return recipients.find(r => r.id === selectedRecipientId)?.name || "";
    return recipientName;
  }, [mode, selectedRecipientId, recipientName, recipients]);

  const handleSend = async () => {
    if (!finalPhone) return toast.error("يرجى تحديد رقم المستلم");
    if (!selectedTemplate) return toast.error("القالب غير موجود");

    // Check manual variables
    for (const v of selectedTemplate.manual_variables || []) {
      if (!manualVars[v] || !manualVars[v].trim()) return toast.error(`يرجى تعبئة المتغير المطلوب: ${v}`);
    }

    setSending(true);

    const relatedType = mode === "existing" && selectedRecipientId.startsWith("participant:") ? "participant" : undefined;
    const relatedId = relatedType ? selectedRecipientId.split(":")[1] : undefined;

    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: {
        template: templateKey,
        channel: "whatsapp",
        recipient_phone: finalPhone,
        recipient_name: finalName || null,
        variables: manualVars,
        related_entity_type: relatedType,
        related_entity_id: relatedId,
      },
    });
    setSending(false);

    if (error) return toast.error(error.message);
    if (data?.status !== "sent") return toast.error(data?.error || "فشل الإرسال");
    
    toast.success("تم إرسال الرسالة بنجاح");
    if (onSuccess) onSuccess();
    onOpenChange(false);
  };

  const generatePreview = () => {
    if (!selectedTemplate) return "";
    let body = selectedTemplate.body_template;
    for (const v of selectedTemplate.manual_variables || []) {
      body = body.replace(`{${v}}`, manualVars[v] || `[${v}]`);
    }
    for (const v of selectedTemplate.variables || []) {
      if (v === "participant_name") body = body.replace(`{${v}}`, finalName || "[اسم المشترك]");
      // Other auto-vars won't preview accurately here without DB, so we show placeholders
      else if (!selectedTemplate.manual_variables?.includes(v)) body = body.replace(`{${v}}`, `[${v}]`);
    }
    return body;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>إرسال رسالة واتساب</DialogTitle>
          <DialogDescription>تأكد من اختيار القالب المناسب وتعبئة المتغيرات إن وجدت.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-1">
          <div className="space-y-4 py-2">
            <div>
              <Label>القالب (Template)</Label>
              <Select value={templateKey} onValueChange={setTemplateKey}>
                <SelectTrigger><SelectValue placeholder="اختر القالب..." /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border p-3 space-y-3 bg-muted/20">
              <Label className="text-sm font-semibold">المستلم</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">من النظام</TabsTrigger>
                  <TabsTrigger value="manual">رقم جديد</TabsTrigger>
                </TabsList>
                <TabsContent value="existing" className="pt-2">
                  <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId} disabled={loadingRecipients}>
                    <SelectTrigger><SelectValue placeholder="اختر من القائمة..." /></SelectTrigger>
                    <SelectContent>
                      {recipients.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="manual" className="pt-2 space-y-2">
                  <div>
                    <Label className="text-xs">الاسم (اختياري)</Label>
                    <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">الرقم *</Label>
                    <PhoneInputWithCountry value={localPhone} onChange={setLocalPhone} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {selectedTemplate && selectedTemplate.manual_variables?.length > 0 ? (
              <div className="space-y-3">
                <Label className="font-semibold text-primary">المتغيرات اليدوية المطلوبة:</Label>
                {selectedTemplate.manual_variables.map((v: string) => {
                  const config = (selectedTemplate as any).variables_config?.find((c: any) => c.key === v);
                  const label = config?.label_ar || v;
                  return (
                    <div key={v}>
                      <Label className="text-xs text-muted-foreground mb-1 block capitalize">{label}</Label>
                      {v.includes("note") || v.includes("message") ? (
                        <Textarea 
                          value={manualVars[v] || ""} 
                          onChange={e => setManualVars({...manualVars, [v]: e.target.value})} 
                          placeholder={`إدخال ${label}...`} 
                        />
                      ) : (
                        <Input 
                          value={manualVars[v] || ""} 
                          onChange={e => setManualVars({...manualVars, [v]: e.target.value})} 
                          placeholder={`إدخال ${label}...`} 
                          dir={v.includes("link") || v.includes("url") ? "ltr" : "rtl"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : selectedTemplate ? (
              <div className="text-sm text-muted-foreground p-2 border border-dashed rounded-md bg-muted/10 text-center">
                لا يوجد متغيرات يدوية لهذا القالب. سيتم سحب البيانات تلقائياً.
              </div>
            ) : null}

            {previewMode && (
              <div className="bg-primary/5 p-4 rounded-md border border-primary/20 whitespace-pre-wrap text-sm leading-relaxed mt-4">
                <div className="font-semibold mb-2 text-primary text-xs">معاينة الرسالة:</div>
                {generatePreview()}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <Button variant="ghost" onClick={() => setPreviewMode(!previewMode)}>
            <Eye className="w-4 h-4 me-2" />
            {previewMode ? "إخفاء المعاينة" : "معاينة الرسالة"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>إلغاء</Button>
            <Button onClick={handleSend} disabled={sending || !finalPhone}>
              {sending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {!sending && <Send className="w-4 h-4 me-2" />}
              إرسال
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
