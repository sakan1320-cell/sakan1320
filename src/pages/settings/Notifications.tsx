import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Send, Info, Check, ChevronsUpDown, User, Users, Shield, AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BulkNotificationDialog } from "@/components/BulkNotificationDialog";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { cn } from "@/lib/utils";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";

interface Notification {
  id: string;
  channel: string;
  recipient_phone: string | null;
  recipient_name: string | null;
  body: string;
  template: string;
  status: string;
  created_at: string;
  error: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
}

type RecipientKind = "employee" | "participant" | "guardian";
interface RecipientOption {
  id: string;
  kind: RecipientKind;
  name: string;
  phone: string; // E.164 if possible
}

// Common country dial codes (extend as needed)
const COUNTRY_CODES: { code: string; label: string; flag: string }[] = [
  { code: "+966", label: "السعودية", flag: "🇸🇦" },
  { code: "+971", label: "الإمارات", flag: "🇦🇪" },
  { code: "+965", label: "الكويت", flag: "🇰🇼" },
  { code: "+974", label: "قطر", flag: "🇶🇦" },
  { code: "+973", label: "البحرين", flag: "🇧🇭" },
  { code: "+968", label: "عُمان", flag: "🇴🇲" },
  { code: "+962", label: "الأردن", flag: "🇯🇴" },
  { code: "+20",  label: "مصر",     flag: "🇪🇬" },
  { code: "+1",   label: "أمريكا/كندا", flag: "🇺🇸" },
  { code: "+44",  label: "بريطانيا", flag: "🇬🇧" },
];

// Strip leading zeros and any non-digits from the local part
const sanitizeLocal = (s: string) => s.replace(/\D+/g, "").replace(/^0+/, "");

// Try to split an existing E.164 number into (dial, local)
const splitE164 = (full: string): { dial: string; local: string } | null => {
  const trimmed = full.trim();
  if (!trimmed.startsWith("+")) return null;
  const match = COUNTRY_CODES.find((c) => trimmed.startsWith(c.code));
  if (!match) return null;
  return { dial: match.code, local: trimmed.slice(match.code.length) };
};

const Notifications = () => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const fallbackRoute = useFallbackRoute();
  const [rows, setRows] = useState<Notification[]>([]);

  // Manual entry
  const [dial, setDial] = useState<string>("+966");
  const [localPhone, setLocalPhone] = useState<string>("");
  const [recipientName, setRecipientName] = useState("");

  // Existing recipient
  const [mode, setMode] = useState<"manual" | "existing">("manual");
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  // Message
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState<string>("late_alert");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [sending, setSending] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as Notification[]);
  };

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const [emp, part, guard] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone"),
        supabase.from("participants").select("id, full_name, phone"),
        supabase.from("guardians").select("id, full_name, phone"),
      ]);
      const opts: RecipientOption[] = [];
      (emp.data ?? []).forEach((r: any) => {
        if (r.phone) opts.push({ id: `employee:${r.id}`, kind: "employee", name: r.full_name || r.email || "—", phone: r.phone });
      });
      (part.data ?? []).forEach((r: any) => {
        if (r.phone) opts.push({ id: `participant:${r.id}`, kind: "participant", name: r.full_name, phone: r.phone });
      });
      (guard.data ?? []).forEach((r: any) => {
        if (r.phone) opts.push({ id: `guardian:${r.id}`, kind: "guardian", name: r.full_name, phone: r.phone });
      });
      setRecipients(opts);
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => { load(); loadRecipients(); }, []);

  // Realtime subscription on notifications
  useEffect(() => {
    const channel = supabase
      .channel("notifications-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        if (payload.eventType === "UPDATE" && payload.new) {
          setRows((rs) => rs.map((r) => (r.id === (payload.new as Notification).id ? { ...r, ...(payload.new as Notification) } : r)));
        } else if (payload.eventType === "INSERT" && payload.new) {
          setRows((rs) => [payload.new as Notification, ...rs].slice(0, 100));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const selected = recipients.find((r) => r.id === selectedId);

  const finalPhone = useMemo(() => {
    if (mode === "existing") {
      if (!selected) return "";
      if (selected.phone.trim().startsWith("+")) return selected.phone.trim();
      return `${dial}${sanitizeLocal(selected.phone)}`;
    }
    // Manual entry: ensure '+' prefix for E.164 format
    const raw = localPhone.trim();
    if (!raw) return "";
    return raw.startsWith("+") ? raw : `+${raw}`;
  }, [mode, selected, dial, localPhone]);

  const finalName = mode === "existing" ? (selected?.name ?? "") : recipientName.trim();

  if (!hasAnyRole(["executive", "assistant", "board"])) {
    return <Navigate to={fallbackRoute} replace />;
  }

  const send = async () => {
    if (!finalPhone || !body.trim()) return toast.error(t("common.required"));
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: {
        template: template,
        channel,
        // Ensure phone is in correct format
        recipient_phone: finalPhone,
        recipient_name: finalName || null,
        body: body.trim(),
      },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    if (data?.status !== "sent") {
      return toast.error(data?.error || t("notifications.deliveryFailed"));
    }
    toast.success(t("notifications.sent"));
    setBody(""); setRecipientName(""); setLocalPhone(""); setSelectedId("");
    load();
  };

  const statusBadge = (s: string) => {
    const cls =
      s === "read" ? "bg-success/15 text-success border-success/30"
      : s === "delivered" ? "bg-primary/10 text-primary border-primary/20"
      : s === "sent" ? "bg-muted text-foreground border-border"
      : s === "failed" || s === "undelivered" ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-muted text-muted-foreground";
    const key = `notifications.statuses.${s}`;
    return <Badge variant="outline" className={cls}>{t(key, { defaultValue: s })}</Badge>;
  };

  const kindIcon = (k: RecipientKind) =>
    k === "employee" ? <User className="h-3.5 w-3.5" />
    : k === "participant" ? <Users className="h-3.5 w-3.5" />
    : <Shield className="h-3.5 w-3.5" />;

  const kindLabel = (k: RecipientKind) =>
    k === "employee" ? "موظف" : k === "participant" ? "مشترك" : "ولي أمر";



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3 flex-wrap mb-4">
        <Button onClick={() => setBulkOpen(true)}>
          <Send className="h-4 w-4 me-2" />{t("notifications.bulkTitle")}
        </Button>
      </div>



      <Card>
        <CardHeader><CardTitle className="text-lg">{t("notifications.sendManual")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>{t("notifications.channel")}</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">{t("notifications.channels.whatsapp")}</SelectItem>
                <SelectItem value="sms">{t("notifications.channels.sms")}</SelectItem>
                <SelectItem value="email">{t("notifications.channels.email")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>القالب (Template)</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="late_alert">تأخر (late_alert)</SelectItem>
                <SelectItem value="absence_alert">غياب (absence_alert)</SelectItem>
                <SelectItem value="group_invite_link_concise">دعوة مجموعة مختصرة</SelectItem>
                <SelectItem value="project_launch_notification">إطلاق مشروع</SelectItem>
                <SelectItem value="group_invitation">دعوة مجموعة</SelectItem>
                <SelectItem value="attendance_absence_notice">رسالة غياب/حضور</SelectItem>
                <SelectItem value="closing_ceremony_invitation">حفل ختامي</SelectItem>
                <SelectItem value="participant_note">ملاحظة مشارك</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "existing")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">إدخال رقم جديد</TabsTrigger>
                <TabsTrigger value="existing">اختيار من القائمة</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-3 pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>{t("notifications.recipientName")}</Label>
                    <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("notifications.recipientPhone")} *</Label>
                    <PhoneInputWithCountry
                      value={localPhone}
                      onChange={setLocalPhone}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="existing" className="space-y-3 pt-3">
                <div>
                  <Label>ابحث عن مستلم (موظف / مشترك / ولي أمر)</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selected ? (
                          <span className="flex items-center gap-2">
                            {kindIcon(selected.kind)}
                            <span>{selected.name}</span>
                            <span className="text-muted-foreground text-xs" dir="ltr">{selected.phone}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {loadingRecipients ? "جارٍ التحميل…" : "اختر مستلمًا…"}
                          </span>
                        )}
                        <ChevronsUpDown className="ms-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const q = search.toLowerCase();
                          return value.toLowerCase().includes(q) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="ابحث بالاسم أو الرقم…" />
                        <CommandList>
                          <CommandEmpty>لا توجد نتائج.</CommandEmpty>
                          {(["employee", "participant", "guardian"] as RecipientKind[]).map((kind) => {
                            const items = recipients.filter((r) => r.kind === kind);
                            if (items.length === 0) return null;
                            return (
                              <CommandGroup key={kind} heading={kindLabel(kind)}>
                                {items.map((r) => (
                                  <CommandItem
                                    key={r.id}
                                    value={`${r.name} ${r.phone} ${kindLabel(r.kind)}`}
                                    onSelect={() => {
                                      setSelectedId(r.id);
                                      setPickerOpen(false);
                                    }}
                                  >
                                    <Check className={cn("me-2 h-4 w-4", selectedId === r.id ? "opacity-100" : "opacity-0")} />
                                    <span className="flex items-center gap-2 flex-1">
                                      {kindIcon(r.kind)}
                                      <span>{r.name}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground" dir="ltr">{r.phone}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            );
                          })}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selected && !selected.phone.trim().startsWith("+") && (
                    <div className="mt-2">
                      <Label className="text-xs">رمز الدولة (لأن الرقم المخزّن محلي)</Label>
                      <Select value={dial} onValueChange={setDial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="me-2">{c.flag}</span>{c.label} <span dir="ltr" className="text-muted-foreground ms-1">({c.code})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {finalPhone && (
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">→ {finalPhone}</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="md:col-span-2">
            <Label>{t("notifications.body")} *</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={send} disabled={sending || !finalPhone}>
              <Send className="h-4 w-4 me-2" />{t("notifications.send")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("notifications.log")}</CardTitle>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 me-2" />{t("notifications.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("notifications.when")}</TableHead>
                  <TableHead>{t("notifications.recipient")}</TableHead>
                  <TableHead>{t("notifications.template")}</TableHead>
                  <TableHead>{t("notifications.channel")}</TableHead>
                  <TableHead>{t("notifications.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((n) => {
                  const isFail = n.status === "failed" || n.status === "undelivered";
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="font-medium">{n.recipient_name || "—"}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{n.recipient_phone}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{t(`notifications.templates.${n.template}`)}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{t(`notifications.channels.${n.channel}`)}</Badge></TableCell>
                      <TableCell>
                        {isFail && n.error ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{statusBadge(n.status)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-xs font-semibold mb-1">{t("notifications.failureReason")}</p>
                              <p className="text-xs whitespace-pre-wrap break-words">{n.error}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : statusBadge(n.status)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BulkNotificationDialog open={bulkOpen} onOpenChange={setBulkOpen} onSent={load} />
    </div>
  );
};

export default Notifications;
