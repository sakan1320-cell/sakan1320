import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Save, MoveUp, MoveDown, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";

interface ExternalAppearanceSettings {
  colors: {
    primary: string;
    header_bg: string;
    header_text: string;
    footer_bg: string;
    footer_text: string;
  };
  typography: {
    font_family: string;
  };
  hero: {
    title: string;
    subtitle: string;
    btn_text: string;
    btn_link: string;
    bg_type: "gradient" | "image";
    bg_gradient: string;
    bg_image_url: string;
    overlay_opacity: number;
  };
  login: {
    title: string;
    subtitle: string;
  };
}

const DEFAULT_EXTERNAL_APPEARANCE: ExternalAppearanceSettings = {
  colors: {
    primary: "#29327A",
    header_bg: "#ffffff",
    header_text: "#1e293b",
    footer_bg: "#0f172a",
    footer_text: "#cbd5e1"
  },
  typography: { font_family: "Cairo" },
  hero: {
    title: "منصة سكنسا لإدارة المشاريع",
    subtitle: "المنصة المتكاملة لإدارة الكوادر والمشاريع",
    btn_text: "ابدأ الآن",
    btn_link: "/auth",
    bg_type: "gradient",
    bg_gradient: "from-primary/90 to-primary/70",
    bg_image_url: "",
    overlay_opacity: 50
  },
  login: {
    title: "تسجيل الدخول",
    subtitle: "مرحباً بك في منصة سكنسا"
  }
};

interface LandingSettings {
  header_links: Array<{ id: string, label_ar: string, label_en: string, url: string, order_index: number }>;
  business_platform_btn: { label_ar: string, label_en: string, target_url: string };
  popup_alert: { is_enabled: boolean, image_url: string, action_url: string };
  about_us: { text_ar: string, text_en: string, section_is_visible: boolean };
  news_cards: Array<{ id: string, title_ar: string, title_en: string, desc_ar: string, desc_en: string, image_url: string }>;
  partners_carousel: string[];
  social_media_links: { twitter: string, linkedin: string, facebook: string, instagram: string };
}

const DEFAULT_SETTINGS: LandingSettings = {
  header_links: [],
  business_platform_btn: { label_ar: "تسجيل الدخول", label_en: "Login", target_url: "/auth" },
  popup_alert: { is_enabled: false, image_url: "", action_url: "" },
  about_us: { text_ar: "", text_en: "", section_is_visible: true },
  news_cards: [],
  partners_carousel: [],
  social_media_links: { twitter: "", linkedin: "", facebook: "", instagram: "" }
};

export const LandingConfigSettings = () => {
  const { i18n } = useTranslation();
  
  const [settings, setSettings] = useState<LandingSettings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<LandingSettings | null>(null);
  
  const [appearance, setAppearance] = useState<ExternalAppearanceSettings>(DEFAULT_EXTERNAL_APPEARANCE);
  const [initialAppearance, setInitialAppearance] = useState<ExternalAppearanceSettings | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("landing_page_settings")
          .select("*")
          .eq("id", "00000000-0000-0000-0000-000000000000")
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          const loadedSettings = {
            header_links: data.header_links || [],
            business_platform_btn: data.business_platform_btn || DEFAULT_SETTINGS.business_platform_btn,
            popup_alert: data.popup_alert || DEFAULT_SETTINGS.popup_alert,
            about_us: data.about_us || DEFAULT_SETTINGS.about_us,
            news_cards: data.news_cards || [],
            partners_carousel: data.partners_carousel || [],
            social_media_links: data.social_media_links || DEFAULT_SETTINGS.social_media_links
          };
          setSettings(loadedSettings);
          setInitialSettings(loadedSettings);
        }

        const { data: appData, error: appError } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "external_appearance")
          .maybeSingle();

        if (appData?.value) {
          const app = appData.value as unknown as ExternalAppearanceSettings;
          setAppearance(app);
          setInitialAppearance(app);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const uploadImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const processedSettings: LandingSettings = {
        ...settings,
        header_links: settings.header_links.map(link => ({
          ...link,
          label_en: link.label_en || link.label_ar
        })),
        about_us: {
          ...settings.about_us,
          text_en: settings.about_us.text_en || settings.about_us.text_ar
        },
        news_cards: settings.news_cards.map(news => ({
          ...news,
          title_en: news.title_en || news.title_ar,
          desc_en: news.desc_en || news.desc_ar
        }))
      };

      const { error: error1 } = await supabase.from("landing_page_settings").upsert({
        id: "00000000-0000-0000-0000-000000000000",
        ...processedSettings,
      });
      if (error1) throw error1;

      const { error: error2 } = await supabase.from("app_settings").upsert({
        key: "external_appearance",
        value: appearance as any,
        updated_at: new Date().toISOString()
      });
      if (error2) throw error2;

      setInitialSettings(processedSettings);
      setInitialAppearance(appearance);
      
      toast.success("تم الحفظ بنجاح");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof LandingSettings>(key: K, value: LandingSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateAppearance = <K extends keyof ExternalAppearanceSettings>(key: K, value: Partial<ExternalAppearanceSettings[K]>) => {
    setAppearance(prev => ({ ...prev, [key]: { ...prev[key], ...value } }));
  };

  const formatUrl = (value: string) => {
    let url = value.trim();
    if (url && !url.startsWith('http') && !url.startsWith('/')) {
      url = `https://${url}`;
    }
    return url;
  };

  const hasChanges = initialSettings && initialAppearance && 
    (JSON.stringify(settings) !== JSON.stringify(initialSettings) || JSON.stringify(appearance) !== JSON.stringify(initialAppearance));

  if (loading) {
    return <div className="flex p-12 justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {hasChanges && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[99999] animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-300" dir="rtl">
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur-xl p-2 rounded-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border border-border/50 ring-1 ring-black/5 dark:ring-white/10">
            <Button 
              onClick={() => { 
                if (initialSettings) setSettings(initialSettings); 
                if (initialAppearance) setAppearance(initialAppearance); 
              }} 
              variant="secondary" 
              size="sm"
              className="rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors h-10 px-4 text-sm font-medium"
            >
              تراجع
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              size="icon"
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md h-10 w-10 transition-transform active:scale-95"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>,
        document.body
      )}

      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <h2 className="text-xl font-bold">تخصيص الواجهة</h2>
      </div>

      <Tabs defaultValue="popup" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto">
          <TabsTrigger value="appearance">المظهر الخارجي</TabsTrigger>
          <TabsTrigger value="popup">الإعلانات</TabsTrigger>
          <TabsTrigger value="header">القائمة</TabsTrigger>
          <TabsTrigger value="content">المحتوى</TabsTrigger>
          <TabsTrigger value="social">التواصل</TabsTrigger>
        </TabsList>

        {/* APPEARANCE AND HERO TAB */}
        <TabsContent value="appearance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تخصيص المظهر الخارجي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-4">
                <h3 className="font-bold border-b pb-2">ألوان المنصة والخطوط</h3>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>اللون الرئيسي</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={appearance.colors.primary} onChange={(e) => updateAppearance("colors", { primary: e.target.value })} className="w-16 h-10 p-1" />
                      <Input value={appearance.colors.primary} onChange={(e) => updateAppearance("colors", { primary: e.target.value })} className="w-full" dir="ltr" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>خلفية الشريط العلوي</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={appearance.colors.header_bg} onChange={(e) => updateAppearance("colors", { header_bg: e.target.value })} className="w-16 h-10 p-1" />
                      <Input value={appearance.colors.header_bg} onChange={(e) => updateAppearance("colors", { header_bg: e.target.value })} className="w-full" dir="ltr" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>خلفية الفوتر</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={appearance.colors.footer_bg} onChange={(e) => updateAppearance("colors", { footer_bg: e.target.value })} className="w-16 h-10 p-1" />
                      <Input value={appearance.colors.footer_bg} onChange={(e) => updateAppearance("colors", { footer_bg: e.target.value })} className="w-full" dir="ltr" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>نوع الخط الافتراضي</Label>
                    <select
                      value={appearance.typography.font_family}
                      onChange={(e) => updateAppearance("typography", { font_family: e.target.value })}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="Cairo">Cairo</option>
                      <option value="Tajawal">Tajawal</option>
                      <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                      <option value="Almarai">Almarai</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-bold border-b pb-2">إعدادات شاشة الدخول</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>عنوان بطاقة الدخول</Label>
                    <Input value={appearance.login.title} onChange={(e) => updateAppearance("login", { title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>النص الترحيبي الفرعي</Label>
                    <Input value={appearance.login.subtitle} onChange={(e) => updateAppearance("login", { subtitle: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-bold border-b pb-2">البانر الترحيبي</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>العنوان الرئيسي</Label>
                      <Input value={appearance.hero.title} onChange={(e) => updateAppearance("hero", { title: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>العنوان الفرعي</Label>
                      <Textarea value={appearance.hero.subtitle} onChange={(e) => updateAppearance("hero", { subtitle: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>نص الزر</Label>
                        <Input value={appearance.hero.btn_text} onChange={(e) => updateAppearance("hero", { btn_text: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>رابط الزر</Label>
                        <Input value={appearance.hero.btn_link} onChange={(e) => updateAppearance("hero", { btn_link: formatUrl(e.target.value) })} dir="ltr" placeholder="https://example.com" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>نوع خلفية البانر</Label>
                      <select
                        value={appearance.hero.bg_type}
                        onChange={(e) => updateAppearance("hero", { bg_type: e.target.value as any })}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="gradient">تدرج لوني مجرد</option>
                        <option value="image">صورة مخصصة</option>
                      </select>
                    </div>

                    {appearance.hero.bg_type === "gradient" && (
                      <div className="space-y-2">
                        <Label>تدرج الخلفية (Tailwind CSS classes)</Label>
                        <Input value={appearance.hero.bg_gradient} onChange={(e) => updateAppearance("hero", { bg_gradient: e.target.value })} dir="ltr" />
                        <p className="text-xs text-muted-foreground">مثال: from-primary/90 to-primary/70</p>
                      </div>
                    )}

                    {appearance.hero.bg_type === "image" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>الصورة المخصصة للبانر</Label>
                          <div className="flex gap-3 items-center">
                            {appearance.hero.bg_image_url && (
                              <img src={appearance.hero.bg_image_url} alt="Hero" className="h-10 w-16 object-cover rounded border" />
                            )}
                            <div className="relative flex-1">
                              <Input 
                                type="file" 
                                accept="image/*" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    setUploading("hero_bg");
                                    const base64 = await uploadImageFile(file);
                                    updateAppearance("hero", { bg_image_url: base64 });
                                  } catch (error) {
                                    toast.error("فشل رفع الصورة");
                                  } finally {
                                    setUploading(null);
                                  }
                                }} 
                                disabled={uploading === "hero_bg"}
                              />
                              {uploading === "hero_bg" && <Loader2 className="absolute top-2.5 left-2.5 h-5 w-5 animate-spin text-muted-foreground" />}
                            </div>
                            {appearance.hero.bg_image_url && (
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                onClick={() => updateAppearance("hero", { bg_image_url: "" })}
                                title="حذف الصورة"
                                disabled={uploading === "hero_bg"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>نسبة التعتيم فوق الصورة (Opacity %)</Label>
                          <Input type="number" min="0" max="100" value={appearance.hero.overlay_opacity} onChange={(e) => updateAppearance("hero", { overlay_opacity: Number(e.target.value) })} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* POPUP TAB */}
        <TabsContent value="popup" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">الإعلان المنبثق</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/20">
                <Label className="font-bold text-base">تفعيل الإعلان</Label>
                <Switch 
                  checked={settings.popup_alert.is_enabled} 
                  onCheckedChange={(v) => updateSetting("popup_alert", { ...settings.popup_alert, is_enabled: v })} 
                />
              </div>

              <div className="space-y-3 border p-4 rounded-lg bg-card">
                <Label className="font-semibold text-sm">الصورة</Label>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <Input
                    type="file"
                    accept="image/*"
                    className="cursor-pointer max-w-xs"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploading("popup");
                        const dataUrl = await uploadImageFile(file);
                        updateSetting("popup_alert", { ...settings.popup_alert, image_url: dataUrl });
                        toast.success("تم اختيار الصورة بنجاح");
                      } catch {
                        toast.error("فشل رفع الصورة");
                      } finally {
                        setUploading(null);
                      }
                    }}
                  />
                  {uploading === "popup" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>

                {settings.popup_alert.image_url && (
                  <div className="mt-2 rounded-lg border overflow-hidden w-64 h-auto relative bg-slate-100 dark:bg-slate-900 p-2">
                    <img src={settings.popup_alert.image_url} alt="Preview" className="w-full h-auto object-cover rounded" />
                    <Button
                      variant="destructive" size="sm"
                      className="mt-2 w-full gap-1"
                      onClick={() => updateSetting("popup_alert", { ...settings.popup_alert, image_url: "" })}
                    >
                      <Trash2 className="h-4 w-4" /> إزالة
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>رابط التوجيه</Label>
                <Input 
                  value={settings.popup_alert.action_url} 
                  onChange={(e) => updateSetting("popup_alert", { ...settings.popup_alert, action_url: formatUrl(e.target.value) })} 
                  placeholder="https://example.com" 
                  dir="ltr"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HEADER LINKS TAB */}
        <TabsContent value="header" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">القائمة العلوية</CardTitle>
              <Button size="sm" onClick={() => {
                const newLinks = [...settings.header_links, { id: crypto.randomUUID(), label_ar: "رابط جديد", label_en: "", url: "#", order_index: settings.header_links.length }];
                updateSetting("header_links", newLinks);
              }} className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة رابط
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...settings.header_links].sort((a,b) => a.order_index - b.order_index).map((link, idx) => (
                  <div key={link.id} className="flex flex-wrap md:flex-nowrap gap-3 items-center p-3 border rounded-lg bg-card shadow-sm">
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => {
                        const newLinks = [...settings.header_links];
                        const temp = newLinks[idx].order_index;
                        newLinks[idx].order_index = newLinks[idx - 1].order_index;
                        newLinks[idx - 1].order_index = temp;
                        updateSetting("header_links", newLinks);
                      }}>
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === settings.header_links.length - 1} onClick={() => {
                        const newLinks = [...settings.header_links];
                        const temp = newLinks[idx].order_index;
                        newLinks[idx].order_index = newLinks[idx + 1].order_index;
                        newLinks[idx + 1].order_index = temp;
                        updateSetting("header_links", newLinks);
                      }}>
                        <MoveDown className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <div className="space-y-1">
                        <Label className="text-xs">اسم الرابط</Label>
                        <Input value={link.label_ar} onChange={(e) => {
                          const newLinks = [...settings.header_links];
                          newLinks[idx].label_ar = e.target.value;
                          updateSetting("header_links", newLinks);
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">رابط التوجيه</Label>
                        <Input value={link.url} dir="ltr" onChange={(e) => {
                          const newLinks = [...settings.header_links];
                          newLinks[idx].url = formatUrl(e.target.value);
                          updateSetting("header_links", newLinks);
                        }} placeholder="https://example.com" />
                      </div>
                    </div>

                    <Button variant="destructive" size="icon" className="shrink-0" onClick={() => {
                      updateSetting("header_links", settings.header_links.filter(l => l.id !== link.id));
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {settings.header_links.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
                    لا توجد روابط مضافة
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTENT & PARTNERS TAB */}
        <TabsContent value="content" className="mt-4 space-y-4">
          {/* ABOUT US */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">عن المنصة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/20">
                <Label className="font-bold">إظهار القسم</Label>
                <Switch 
                  checked={settings.about_us.section_is_visible} 
                  onCheckedChange={(v) => updateSetting("about_us", { ...settings.about_us, section_is_visible: v })} 
                />
              </div>
              <div className="space-y-2">
                <Label>النص التعريفي</Label>
                <Textarea 
                  rows={4}
                  value={settings.about_us.text_ar} 
                  onChange={(e) => updateSetting("about_us", { ...settings.about_us, text_ar: e.target.value })} 
                />
              </div>
            </CardContent>
          </Card>

          {/* NEWS CARDS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">الأخبار</CardTitle>
              <Button size="sm" onClick={() => {
                const newCards = [...settings.news_cards, { id: crypto.randomUUID(), title_ar: "", title_en: "", desc_ar: "", desc_en: "", image_url: "" }];
                updateSetting("news_cards", newCards);
              }}>
                <Plus className="h-4 w-4 me-2" />
                إضافة خبر
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.news_cards.map((news, idx) => (
                <div key={news.id} className="p-4 border rounded-lg bg-card shadow-sm space-y-3 relative">
                  <Button variant="destructive" size="icon" className="absolute top-4 end-4" onClick={() => {
                    updateSetting("news_cards", settings.news_cards.filter(n => n.id !== news.id));
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  <div className="space-y-2 w-11/12">
                    <Label className="text-sm font-semibold">العنوان</Label>
                    <Input 
                      value={news.title_ar} 
                      onChange={(e) => {
                        const newCards = [...settings.news_cards];
                        newCards[idx].title_ar = e.target.value;
                        updateSetting("news_cards", newCards);
                      }} 
                    />
                  </div>
                  
                  <div className="space-y-2 w-11/12">
                    <Label className="text-sm font-semibold">التفاصيل</Label>
                    <Textarea 
                      value={news.desc_ar} 
                      rows={3} 
                      onChange={(e) => {
                        const newCards = [...settings.news_cards];
                        newCards[idx].desc_ar = e.target.value;
                        updateSetting("news_cards", newCards);
                      }} 
                    />
                  </div>

                  <div className="space-y-2 w-11/12 border p-3 rounded-lg bg-secondary/10">
                    <Label className="text-sm font-semibold">الصورة</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        className="cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setUploading(`news_${news.id}`);
                            const dataUrl = await uploadImageFile(file);
                            const newCards = [...settings.news_cards];
                            newCards[idx].image_url = dataUrl;
                            updateSetting("news_cards", newCards);
                            toast.success("تم اختيار الصورة بنجاح");
                          } catch {
                            toast.error("فشل رفع الصورة");
                          } finally {
                            setUploading(null);
                          }
                        }}
                      />
                      {uploading === `news_${news.id}` && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    </div>
                    {news.image_url && (
                      <div className="mt-2 h-32 w-48 border rounded overflow-hidden">
                        <img src={news.image_url} alt="News" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {settings.news_cards.length === 0 && (
                <div className="text-center py-6 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
                  لا توجد أخبار مضافة
                </div>
              )}
            </CardContent>
          </Card>

          {/* PARTNERS */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">الشركاء</CardTitle>
              <Button size="sm" onClick={() => {
                updateSetting("partners_carousel", [...settings.partners_carousel, ""]);
              }}>
                <Plus className="h-4 w-4 me-2" />
                إضافة شريك
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.partners_carousel.map((url, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-3 items-center border p-3 rounded-lg">
                  <div className="h-12 w-12 shrink-0 bg-secondary/30 rounded flex items-center justify-center border overflow-hidden">
                    {url ? <img src={url} alt="Partner Logo" className="max-h-full max-w-full object-contain p-1" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    className="cursor-pointer max-w-xs"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploading(`partner_${idx}`);
                        const dataUrl = await uploadImageFile(file);
                        const newUrls = [...settings.partners_carousel];
                        newUrls[idx] = dataUrl;
                        updateSetting("partners_carousel", newUrls);
                        toast.success("تم اختيار الصورة بنجاح");
                      } catch {
                        toast.error("فشل رفع الشعار");
                      } finally {
                        setUploading(null);
                      }
                    }}
                  />
                  {uploading === `partner_${idx}` && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  <Button variant="destructive" size="icon" className="ms-auto" onClick={() => {
                    const newUrls = [...settings.partners_carousel];
                    newUrls.splice(idx, 1);
                    updateSetting("partners_carousel", newUrls);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {settings.partners_carousel.length === 0 && (
                <div className="text-center py-6 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
                  لا يوجد شركاء مضافين
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOCIAL MEDIA TAB */}
        <TabsContent value="social" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">التواصل الاجتماعي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>X</Label>
                  <Input value={settings.social_media_links.twitter} dir="ltr" placeholder="https://x.com/..." onChange={(e) => updateSetting("social_media_links", { ...settings.social_media_links, twitter: formatUrl(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input value={settings.social_media_links.linkedin} dir="ltr" placeholder="https://linkedin.com/..." onChange={(e) => updateSetting("social_media_links", { ...settings.social_media_links, linkedin: formatUrl(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input value={settings.social_media_links.facebook} dir="ltr" placeholder="https://facebook.com/..." onChange={(e) => updateSetting("social_media_links", { ...settings.social_media_links, facebook: formatUrl(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={settings.social_media_links.instagram} dir="ltr" placeholder="https://instagram.com/..." onChange={(e) => updateSetting("social_media_links", { ...settings.social_media_links, instagram: formatUrl(e.target.value) })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
