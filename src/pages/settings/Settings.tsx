import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoPopover } from "@/components/ui/info-popover";
import { LandingConfigSettings } from "@/components/LandingConfigSettings";
import { useProjectApps } from "@/hooks/useProjectApps";
import { 
  Loader2, Save, Globe, Shield, UserPlus, 
  Palette, Database, Lock, Settings as SettingsIcon,
  Search, Copy, ExternalLink, Languages, Settings2, LayoutTemplate,
  MessageCircle, Moon, Sun, Calendar, CalendarDays, CheckCircle2,
  FileText, ScrollText
} from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppSettings } from "@/hooks/useWhatsAppSettings";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsappService";
import { useTheme } from "next-themes";
import Permissions from "./Permissions";
import SiteContent from "./SiteContent";
import AuditLog from "../logs/AuditLog";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { hasPermission, isSystemAdmin, loading: authLoading } = useAuth();
  const { globalDefaults } = useProjectApps(null);
  const fallbackRoute = useFallbackRoute();
  
  const { theme, setTheme } = useTheme();
  const { settings: waSettings, saveSettings: setWaSettings } = useWhatsAppSettings();
  const [testPhone, setTestPhone] = useState("");
  const [testTemplateName, setTestTemplateName] = useState("sakan_test_5");
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);

  const handleTestWhatsApp = async () => {
    if (!testPhone || !testTemplateName) {
      toast.error("يرجى إدخال رقم الهاتف واسم القالب للاختبار");
      return;
    }

    const mapping = Object.entries(testParams).filter(([_, v]) => v.trim() !== "").map(([k, v]) => ({
      schemaPropertyName: k,
      schemaPropertyValue: v.trim()
    }));

    setIsTesting(true);
    try {
      await sendWhatsAppTemplateMessage(testPhone, testTemplateName, waSettings, mapping);
      toast.success("تم إرسال القالب التجريبي بنجاح!");
    } catch (e: any) {
      toast.error("فشل الإرسال: " + e.message);
    } finally {
      setIsTesting(false);
    }
  };

  const [activeTab, setActiveTab] = useState("landing_config");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [waTemplates, setWaTemplates] = useState<{name: string, key: string, variables: string[], manual_variables: string[]}[]>([]);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("app_settings").select("*");
    if (error) {
      toast.error(t("common.error"));
    } else {
      const s: Record<string, any> = {};
      data?.forEach(item => { s[item.key] = item.value; });
      setSettings(s);
    }
    
    const { data: tData } = await supabase.from("notification_templates").select("name, key, variables, manual_variables").eq("channel", "whatsapp");
    setWaTemplates(tData || []);
    
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) loadSettings();
  }, [authLoading]);

  if (authLoading || loading) return <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isSystemAdmin && !hasPermission("manage_settings")) return <Navigate to={fallbackRoute} replace />;

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSetting = async (key: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ 
        key, 
        value: settings[key], 
        updated_at: new Date().toISOString(),
        updated_by: (await supabase.auth.getUser()).data.user?.id
      });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("common.success"));
  };

  const RegistrationSettings = () => {
    const config = settings["staff_registration"] || { enabled: true, slug: "register" };
    const fullUrl = `${window.location.origin}/${config.slug}`;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Label className="text-base">{t("settings.staffReg.title", "تسجيل الموظفين الذاتي")}</Label>
            <InfoPopover text={t("settings.staffReg.desc", "السماح للموظفين بتسجيل حساباتهم بأنفسهم عبر رابط مخصص دون الحاجة لإضافتهم يدوياً من قبل الإدارة")} />
          </div>
          <Switch 
            checked={config.enabled} 
            onCheckedChange={(v) => updateSetting("staff_registration", { ...config, enabled: v })} 
          />
        </div>

        <div className="space-y-2">
          <Label>{t("settings.staffReg.slug", "رابط الصفحة (Slug)")}</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" dir="ltr">/</span>
            <Input 
              value={config.slug} 
              onChange={(e) => updateSetting("staff_registration", { ...config, slug: e.target.value })}
              className="max-w-xs"
              placeholder="register"
              dir="ltr"
            />
          </div>
        </div>

        <div className="rounded-lg bg-secondary/30 p-4">
          <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("settings.staffReg.link", "رابط التقديم المباشر")}</Label>
          <div className="flex items-center gap-2">
            <Input value={fullUrl} readOnly className="bg-background" dir="ltr" />
            <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(fullUrl); toast.success(t("common.copied")); }}>
              <Copy className="h-4 w-4" />
            </Button>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="outline">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>

        {globalDefaults.dynamicRegistration && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Label className="text-base">{t("settings.staffReg.structure", "نموذج تسجيل الموظفين")}</Label>
              <InfoPopover text={t("settings.staffReg.structureDesc", "إدارة الحقول المطلوبة عند تسجيل الموظفين لأنفسهم (مثل القسم، المسمى الوظيفي)")} />
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/settings/registration-structure'}>
              <Settings2 className="mr-2 h-4 w-4" /> {t("common.manage", "إدارة")}
            </Button>
          </div>
        )}

        <Button onClick={() => saveSetting("staff_registration")} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="ml-2 h-4 w-4" />
          {t("common.save", "حفظ التغييرات")}
        </Button>
      </div>
    );
  };

  const LocalizationSettings = () => {
    const config = settings["localization"] || { default_lang: "ar", auto_translate: true };
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>{t("settings.loc.default", "اللغة الافتراضية للنظام")}</Label>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={config.default_lang}
            onChange={(e) => updateSetting("localization", { ...config, default_lang: e.target.value })}
          >
            <option value="ar">العربية (Arabic)</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Label className="text-base">{t("settings.loc.autoTranslate", "الترجمة التلقائية")}</Label>
            <InfoPopover text={t("settings.loc.autoTranslateDesc", "تفعيل الترجمة التلقائية للمحتوى المدخل من قبل المستخدمين (مثل الملاحظات والمهام)")} />
          </div>
          <Switch 
            checked={config.auto_translate} 
            onCheckedChange={(v) => updateSetting("localization", { ...config, auto_translate: v })} 
          />
        </div>

        <Button onClick={() => saveSetting("localization")} disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="ml-2 h-4 w-4" />
          {t("common.save")}
        </Button>
      </div>
    );
  };

  const THEME_COLORS = [
    { name: "أزرق سكن (الافتراضي)", value: "238 50% 32%" }, // #29327A
    { name: "أرجواني", value: "270 50% 40%" },
    { name: "أخضر زمردي", value: "160 60% 35%" },
    { name: "برتقالي", value: "25 85% 50%" },
    { name: "أحمر داكن", value: "350 65% 45%" },
  ];

  const RADIUS_OPTIONS = [
    { name: "بدون", value: "0rem" },
    { name: "صغير", value: "0.3rem" },
    { name: "متوسط", value: "0.5rem" },
    { name: "كبير", value: "0.75rem" },
    { name: "كامل", value: "1rem" },
  ];

  const AdvancedSettings = () => {
    const selectedTpl = waTemplates.find(t => t.key === testTemplateName);
    const varsToFill = Array.from(new Set([...(selectedTpl?.variables || []), ...(selectedTpl?.manual_variables || [])]));
    
    return (
    <div className="space-y-12">

      {/* WhatsApp Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-2">
          <MessageCircle className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-bold">إعدادات ربط API واتساب</h3>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Client ID</Label>
            <Input placeholder="أدخل Client ID" value={waSettings.clientId} onChange={e => setWaSettings({ clientId: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Client Secret</Label>
            <Input placeholder="أدخل Client Secret" type="password" value={waSettings.clientSecret} onChange={e => setWaSettings({ clientSecret: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Access Token</Label>
            <Input placeholder="أدخل رمز الوصول (Access Token)" type="password" value={waSettings.accessToken} onChange={e => setWaSettings({ accessToken: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Plugin ID</Label>
            <Input placeholder="مثال: ext-plugin-xxxx" value={waSettings.pluginId} onChange={e => setWaSettings({ pluginId: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input placeholder="معرف الرقم الخاص بواتساب" value={waSettings.phoneNumberId} onChange={e => setWaSettings({ phoneNumberId: e.target.value })} />
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-muted/20 space-y-4 mt-6">
          <h4 className="font-bold text-lg border-b pb-2">اختبار إرسال رسالة</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <PhoneInputWithCountry value={testPhone} onChange={setTestPhone} />
            </div>
            <div className="space-y-2">
              <Label>القالب (Template Name)</Label>
              <Select value={testTemplateName} onValueChange={setTestTemplateName}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القالب" />
                </SelectTrigger>
                <SelectContent>
                  {waTemplates.map(t => (
                    <SelectItem key={t.key} value={t.key}>{t.name} ({t.key})</SelectItem>
                  ))}
                  {waTemplates.length === 0 && <SelectItem value="sakan_test_5">sakan_test_5 (الافتراضي)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {varsToFill.length > 0 && (
              <div className="space-y-3 md:col-span-2 border-t pt-4">
                <Label className="font-bold text-primary">المتغيرات المطلوبة للقالب ({testTemplateName})</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {varsToFill.map(v => (
                    <div key={v} className="space-y-1.5">
                      <Label className="text-xs" dir="ltr">{v}</Label>
                      <Input 
                        placeholder={`أدخل قيمة لـ ${v}`} 
                        value={testParams[v] || ""} 
                        onChange={e => setTestParams({...testParams, [v]: e.target.value})} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {varsToFill.length === 0 && testTemplateName && (
               <div className="md:col-span-2 text-sm text-muted-foreground p-2 bg-muted/20 rounded">
                 لا يوجد متغيرات ديناميكية مسجلة لهذا القالب.
               </div>
            )}
          </div>
          <Button onClick={handleTestWhatsApp} disabled={isTesting} className="w-full sm:w-auto">
            {isTesting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إرسال رسالة تجريبية
          </Button>
        </div>
      </div>
    </div>
    );
  };



  const tabs = [
    { id: "landing_config", label: t("settings.tabs.landing", "الواجهة"), icon: LayoutTemplate },
    { id: "auth", label: t("settings.tabs.auth", "الأمان والدخول"), icon: Shield },
    { id: "registration", label: t("settings.tabs.registration", "التسجيل"), icon: UserPlus },
    { id: "permissions", label: "الصلاحيات", icon: Shield },
    { id: "site_content", label: "محتوى الموقع", icon: FileText },
    { id: "localization", label: t("settings.tabs.localization", "لغة النظام الافتراضية"), icon: Languages },
    ...(globalDefaults.dynamicRegistration ? [{ id: "registration-structure", label: t("settings.tabs.regStructure", "هيكلة بيانات التسجيل"), icon: Database, isLink: true, href: "/settings/registration-structure" }] : []),
    { id: "audit", label: "سجل النظام", icon: ScrollText },
    { id: "advanced", label: t("settings.tabs.advanced", "متقدم"), icon: Database },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("nav.settings", "مركز إعدادات النظام")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle", "إدارة كافة جوانب وسلوكيات منصة سكنسا")}</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input 
            placeholder={t("common.search", "بحث في الإعدادات...")} 
            className="pl-9 rtl:pl-3 rtl:pr-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.isLink && tab.href) window.location.href = tab.href;
                else setActiveTab(tab.id);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent",
                activeTab === tab.id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary" : "")} />
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="space-y-6">
          <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = tabs.find(t => t.id === activeTab)?.icon || SettingsIcon;
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
                <CardTitle>{tabs.find(t => t.id === activeTab)?.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {activeTab === "landing_config" && <LandingConfigSettings />}
              {activeTab === "registration" && <RegistrationSettings />}
              {activeTab === "localization" && <LocalizationSettings />}
              {activeTab === "advanced" && <AdvancedSettings />}
              {activeTab === "permissions" && <Permissions />}
              {activeTab === "site_content" && <SiteContent />}
              {activeTab === "audit" && <AuditLog />}
              {activeTab === "auth" && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Lock className="mb-4 h-12 w-12 opacity-20" />
                  <p>{t("settings.comingSoon", "إعدادات الأمان ومزودي الخدمة")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-warning-foreground">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold">{t("settings.safety.title", "تنبيه الأمان")}</h4>
                <p className="mt-1 text-xs opacity-80">{t("settings.safety.desc", "تغيير هذه الإعدادات يؤثر على جميع مستخدمي النظام فوراً. يرجى الحذر عند تعديل الروابط أو إعدادات الأمان.")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export default Settings;
