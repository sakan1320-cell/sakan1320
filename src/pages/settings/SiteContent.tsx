import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2, Plus, Trash2, Save, Languages, ArrowUp, ArrowDown,
  Layout, HelpCircle, Star, MessageSquare, Image, Palette, BarChart, Settings
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Section {
  id: string;
  section: string;
  title_ar: string | null;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  display_order: number;
  is_published: boolean;
}

interface CmsSection {
  id?: string;
  section_key: string;
  title_ar: string;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  content_ar: any;
  content_en: any;
  is_active: boolean;
}

const KEY_REGEX = /^[a-z][a-z0-9_]{1,40}$/;

export const SiteContent = () => {
  const { t, i18n } = useTranslation();
  const { hasPermission, isSystemAdmin, loading: authLoading } = useAuth();
  const fallbackRoute = useFallbackRoute();
  const { translate, translating } = useAutoTranslate();
  const { confirm, ConfirmDialogNode } = useConfirm();
  const isRtl = i18n.language === "ar";

  const [sections, setSections] = useState<Section[]>([]);
  const [cmsSections, setCmsSections] = useState<CmsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Dialog State
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    section: "",
    title_ar: "",
    title_en: "",
    body_ar: "",
    body_en: "",
  });

  // Features local state
  const [featuresList, setFeaturesList] = useState<any[]>([]);
  const [featuresHeader, setFeaturesHeader] = useState({
    title_ar: "لماذا تختار منصتنا؟",
    title_en: "Why Choose Our Platform?",
    subtitle_ar: "نقدم أفضل المزايا التعليمية والتربوية",
    subtitle_en: "We offer the best educational and developmental features",
  });

  // Stats local state
  const [statsList, setStatsList] = useState<any[]>([]);
  const [statsHeader, setStatsHeader] = useState({
    title_ar: "أرقامنا وإنجازاتنا",
    title_en: "Our Numbers & Achievements",
    subtitle_ar: "فخورون بما قدمناه من عطاء وإنجازات",
    subtitle_en: "Proud of our contributions and achievements",
  });

  const existingKeys = useMemo(() => new Set(sections.map((s) => s.section)), [sections]);

  const load = async () => {
    setLoading(true);
    try {
      const [secsRes, cmsRes] = await Promise.all([
        supabase.from("site_content").select("*").order("display_order"),
        supabase.from("cms_sections").select("*"),
      ]);

      setSections((secsRes.data as Section[]) ?? []);
      const cmsData = (cmsRes.data ?? []) as CmsSection[];
      setCmsSections(cmsData);

      // Parse Features
      const featSec = cmsData.find((c) => c.section_key === "features");
      if (featSec) {
        setFeaturesHeader({
          title_ar: featSec.title_ar || "",
          title_en: featSec.title_en || "",
          subtitle_ar: featSec.subtitle_ar || "",
          subtitle_en: featSec.subtitle_en || "",
        });
        setFeaturesList(featSec.content_ar?.items || []);
      }

      // Parse Stats
      const statSec = cmsData.find((c) => c.section_key === "statistics");
      if (statSec) {
        setStatsHeader({
          title_ar: statSec.title_ar || "",
          title_en: statSec.title_en || "",
          subtitle_ar: statSec.subtitle_ar || "",
          subtitle_en: statSec.subtitle_en || "",
        });
        setStatsList(statSec.content_ar?.items || []);
      }

    } catch (e) {
      toast.error(t("siteContent.loadFailed", "تعذّر تحميل المحتوى"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (authLoading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isSystemAdmin && !hasPermission("manage_homepage")) return <Navigate to={fallbackRoute} replace />;

  const update = (id: string, patch: Partial<Section>) =>
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const handleAutoTranslate = async (id: string) => {
    const section = sections.find(s => s.id === id);
    if (!section?.title_ar && !section?.body_ar) return;

    toast.info(t("common.translating", "جاري الترجمة..."));
    const [enTitle, enBody] = await Promise.all([
      section.title_ar ? translate(section.title_ar) : Promise.resolve(""),
      section.body_ar ? translate(section.body_ar) : Promise.resolve("")
    ]);

    update(id, { title_en: enTitle, body_en: enBody });
    toast.success(t("common.translationDone", "تمت الترجمة"));
  };

  const save = async (s: Section) => {
    setSaving(s.id);
    const { error } = await supabase.from("site_content").update({
      section: s.section,
      title_ar: s.title_ar, title_en: s.title_en,
      body_ar: s.body_ar, body_en: s.body_en,
      display_order: s.display_order,
      is_published: s.is_published,
    }).eq("id", s.id);
    setSaving(null);
    if (error) {
      if ((error as any).code === "23505") toast.error(t("siteContent.keyExists", "هذا المفتاح مستخدم بالفعل"));
      else toast.error(t("siteContent.saveFailed", "تعذّر الحفظ"));
    } else toast.success(t("common.success"));
  };

  const move = async (id: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sections.length - 1) return;

    const newSections = [...sections];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSections[idx], newSections[targetIdx]] = [newSections[targetIdx], newSections[idx]];

    const finalSections = newSections.map((s, i) => ({ ...s, display_order: i + 1 }));
    setSections(finalSections);

    for (const s of finalSections) {
      await supabase.from("site_content").update({ display_order: s.display_order }).eq("id", s.id);
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm(t("common.confirmDelete", "هل أنت متأكد من الحذف؟")))) return;
    const { error } = await supabase.from("site_content").delete().eq("id", id);
    if (error) toast.error(t("siteContent.saveFailed", "تعذّر الحذف"));
    else { toast.success(t("common.success")); load(); }
  };

  const normalizeKey = (raw: string) =>
    raw.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const submitAdd = async () => {
    const key = normalizeKey(form.section);
    if (!KEY_REGEX.test(key)) {
      toast.error(t("siteContent.keyInvalid", "مفتاح غير صالح. استخدم أحرف إنجليزية صغيرة وأرقام و _ فقط"));
      return;
    }
    if (existingKeys.has(key)) {
      toast.error(t("siteContent.keyExists", "هذا المفتاح مستخدم بالفعل"));
      return;
    }
    setAdding(true);
    const nextOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.display_order)) + 1 : 1;
    const { error } = await supabase.from("site_content").insert({
      section: key,
      title_ar: form.title_ar || null,
      title_en: form.title_en || null,
      body_ar: form.body_ar || null,
      body_en: form.body_en || null,
      display_order: nextOrder,
      is_published: true,
    });
    setAdding(false);
    if (error) {
      toast.error(t("siteContent.saveFailed", "تعذّر الحفظ"));
      return;
    }
    toast.success(t("common.success"));
    setAddOpen(false);
    load();
  };

  // Features actions
  const handleSaveFeatures = async () => {
    setSaving("features");
    const { error } = await supabase.from("cms_sections").upsert({
      section_key: "features",
      title_ar: featuresHeader.title_ar,
      title_en: featuresHeader.title_en,
      subtitle_ar: featuresHeader.subtitle_ar,
      subtitle_en: featuresHeader.subtitle_en,
      content_ar: { items: featuresList },
      content_en: { items: featuresList },
      is_active: true,
    }, { onConflict: "section_key" });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(t("common.success"));
  };

  const handleAddFeatureItem = () => {
    setFeaturesList([...featuresList, { icon: "✨", title_ar: "ميزة جديدة", title_en: "New Feature", desc_ar: "", desc_en: "" }]);
  };

  const handleRemoveFeatureItem = (idx: number) => {
    setFeaturesList(featuresList.filter((_, i) => i !== idx));
  };

  const handleUpdateFeatureItem = (idx: number, patch: any) => {
    setFeaturesList(featuresList.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  // Stats actions
  const handleSaveStats = async () => {
    setSaving("statistics");
    const { error } = await supabase.from("cms_sections").upsert({
      section_key: "statistics",
      title_ar: statsHeader.title_ar,
      title_en: statsHeader.title_en,
      subtitle_ar: statsHeader.subtitle_ar,
      subtitle_en: statsHeader.subtitle_en,
      content_ar: { items: statsList },
      content_en: { items: statsList },
      is_active: true,
    }, { onConflict: "section_key" });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(t("common.success"));
  };

  const handleAddStatItem = () => {
    setStatsList([...statsList, { icon: "📊", value: "100+", label_ar: "شريك نجاح", label_en: "Partners" }]);
  };

  const handleRemoveStatItem = (idx: number) => {
    setStatsList(statsList.filter((_, i) => i !== idx));
  };

  const handleUpdateStatItem = (idx: number, patch: any) => {
    setStatsList(statsList.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {ConfirmDialogNode}

      <Tabs defaultValue="cms_builder" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="cms_builder">{t("siteContent.builder", "المطور المرئي")}</TabsTrigger>
          <TabsTrigger value="hero_section">{t("siteContent.hero", "البانر الرئيسي")}</TabsTrigger>
          <TabsTrigger value="features_section">{t("siteContent.features", "المميزات")}</TabsTrigger>
          <TabsTrigger value="stats_section">{t("siteContent.statsTab", "الإحصائيات")}</TabsTrigger>
        </TabsList>

        {/* 1. VISUAL BUILDER (SITE_CONTENT TABLE) */}
        <TabsContent value="cms_builder" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">{t("siteContent.textBlocks", "مربعات النصوص والمقالات العامة")}</h2>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> {t("common.add", "إضافة قسم")}
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-6">
              {sections.map((s, idx) => (
                <Card key={s.id} className="overflow-hidden border-none shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 bg-muted/30 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(s.id, 'up')} disabled={idx === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(s.id, 'down')} disabled={idx === sections.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="rounded-md bg-background px-2 py-1 text-xs font-mono font-bold text-primary border border-primary/20">
                        {s.section}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={s.is_published} onCheckedChange={(v) => update(s.id, { is_published: v })} />
                        <span className="text-xs font-semibold">{s.is_published ? t("common.published", "منشور") : t("common.draft", "مسودة")}</span>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>{t("siteContent.titleAr", "العنوان (بالعربية)")}</Label>
                          <Input value={s.title_ar ?? ""} onChange={(e) => update(s.id, { title_ar: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("siteContent.bodyAr", "المحتوى (بالعربية)")}</Label>
                          <Textarea rows={5} value={s.body_ar ?? ""} onChange={(e) => update(s.id, { body_ar: e.target.value })} />
                        </div>
                      </div>

                      <div className="space-y-4 rounded-xl bg-secondary/20 p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("common.translation", "الترجمة الإنجليزية")}</Label>
                          <Button size="sm" variant="ghost" onClick={() => handleAutoTranslate(s.id)} disabled={translating} className="h-7 gap-1 text-[10px]">
                            <Languages className="h-3 w-3" /> {t("common.autoTranslate", "ترجمة تلقائية")}
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Input value={s.title_en ?? ""} onChange={(e) => update(s.id, { title_en: e.target.value })} placeholder="English Title" dir="ltr" className="bg-background" />
                        </div>
                        <div className="space-y-2">
                          <Textarea rows={5} value={s.body_en ?? ""} onChange={(e) => update(s.id, { body_en: e.target.value })} placeholder="English Body Content" dir="ltr" className="bg-background" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button onClick={() => save(s)} disabled={saving === s.id} className="min-w-[120px]">
                        {saving === s.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        {t("common.save", "حفظ القسم")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 3. FEATURES TAB */}
        <TabsContent value="features_section" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                {t("siteContent.featuresSection", "إدارة قسم مميزات المنصة")}
              </CardTitle>
              <CardDescription>
                {t("siteContent.featuresDesc", "إضافة وتعديل وترتيب البطاقات التي تستعرض مميزات وخدمات منصتكم")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 border-b pb-4">
                <div className="space-y-2">
                  <Label>{t("siteContent.featuresTitleAr", "العنوان الرئيسي للقسم (عربي)")}</Label>
                  <Input value={featuresHeader.title_ar} onChange={(e) => setFeaturesHeader({ ...featuresHeader, title_ar: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("siteContent.featuresSubAr", "العنوان الفرعي للقسم (عربي)")}</Label>
                  <Input value={featuresHeader.subtitle_ar} onChange={(e) => setFeaturesHeader({ ...featuresHeader, subtitle_ar: e.target.value })} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">{t("siteContent.featuresItems", "قائمة بطاقات المميزات")}</h3>
                  <Button size="sm" variant="outline" onClick={handleAddFeatureItem}>
                    <Plus className="h-4 w-4 me-1.5" />
                    {t("siteContent.addFeature", "إضافة ميزة")}
                  </Button>
                </div>

                {featuresList.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-6">{t("siteContent.noFeatures", "لم يتم إضافة مميزات بعد.")}</p>
                ) : (
                  <div className="space-y-4">
                    {featuresList.map((item, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl border bg-muted/10 items-start">
                        <div className="space-y-2 w-14 shrink-0">
                          <Label className="text-xs">{t("siteContent.icon", "الأيقونة")}</Label>
                          <Input className="text-center font-bold text-lg" value={item.icon} onChange={(e) => handleUpdateFeatureItem(idx, { icon: e.target.value })} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 flex-1">
                          <div className="space-y-2">
                            <Label className="text-xs">{t("siteContent.titleAr", "العنوان (عربي)")}</Label>
                            <Input value={item.title_ar} onChange={(e) => handleUpdateFeatureItem(idx, { title_ar: e.target.value })} />
                            <Label className="text-xs mt-1 block">{t("common.description", "الوصف (عربي)")}</Label>
                            <Textarea rows={2} value={item.desc_ar} onChange={(e) => handleUpdateFeatureItem(idx, { desc_ar: e.target.value })} />
                          </div>
                          <div className="space-y-2 bg-secondary/5 p-3 rounded-lg">
                            <Label className="text-xs">{t("siteContent.titleEn", "العنوان (إنجليزي)")}</Label>
                            <Input value={item.title_en} onChange={(e) => handleUpdateFeatureItem(idx, { title_en: e.target.value })} dir="ltr" />
                            <Label className="text-xs mt-1 block">{t("common.description", "الوصف (إنجليزي)")}</Label>
                            <Textarea rows={2} value={item.desc_en} onChange={(e) => handleUpdateFeatureItem(idx, { desc_en: e.target.value })} dir="ltr" />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="text-destructive self-center" onClick={() => handleRemoveFeatureItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveFeatures} disabled={saving === "features"}>
                  {saving === "features" ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                  {t("common.save", "حفظ قسم المميزات")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. STATS TAB */}
        <TabsContent value="stats_section" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5 text-primary" />
                {t("siteContent.statsHeader", "إدارة أرقام وإحصائيات المنصة")}
              </CardTitle>
              <CardDescription>
                {t("siteContent.statsDesc", "تحديث الأرقام التراكمية المعروضة في الصفحة الرئيسية لتسليط الضوء على إنجازاتكم")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 border-b pb-4">
                <div className="space-y-2">
                  <Label>{t("siteContent.statsTitleAr", "العنوان الرئيسي (عربي)")}</Label>
                  <Input value={statsHeader.title_ar} onChange={(e) => setStatsHeader({ ...statsHeader, title_ar: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("siteContent.statsSubAr", "العنوان الفرعي (عربي)")}</Label>
                  <Input value={statsHeader.subtitle_ar} onChange={(e) => setStatsHeader({ ...statsHeader, subtitle_ar: e.target.value })} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">{t("siteContent.statsList", "بطاقات العدادات الرقمية")}</h3>
                  <Button size="sm" variant="outline" onClick={handleAddStatItem}>
                    <Plus className="h-4 w-4 me-1.5" />
                    {t("siteContent.addStat", "إضافة عداد")}
                  </Button>
                </div>

                {statsList.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-6">{t("siteContent.noStats", "لم يتم إضافة إحصائيات بعد.")}</p>
                ) : (
                  <div className="space-y-4">
                    {statsList.map((item, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl border bg-muted/10 items-center">
                        <div className="space-y-2 w-14 shrink-0">
                          <Label className="text-xs">{t("siteContent.icon", "الأيقونة")}</Label>
                          <Input className="text-center font-bold text-lg" value={item.icon} onChange={(e) => handleUpdateStatItem(idx, { icon: e.target.value })} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 flex-1">
                          <div className="space-y-2">
                            <Label className="text-xs">{t("siteContent.value", "القيمة الرقمية (مثل 500+)")}</Label>
                            <Input value={item.value} onChange={(e) => handleUpdateStatItem(idx, { value: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("siteContent.labelAr", "العلامة (عربي)")}</Label>
                            <Input value={item.label_ar} onChange={(e) => handleUpdateStatItem(idx, { label_ar: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("siteContent.labelEn", "العلامة (إنجليزي)")}</Label>
                            <Input value={item.label_en} onChange={(e) => handleUpdateStatItem(idx, { label_en: e.target.value })} dir="ltr" />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => handleRemoveStatItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveStats} disabled={saving === "statistics"}>
                  {saving === "statistics" ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                  {t("common.save", "حفظ الإحصائيات")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("siteContent.addTitle", "إضافة قسم جديد")}</DialogTitle>
            <DialogDescription>{t("siteContent.addDesc", "أدخل اسم القسم بالإنجليزية (مثل about) لبدء إضافته للصفحة الرئيسية")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-section">{t("siteContent.key", "مفتاح القسم (Key)")}</Label>
              <Input
                id="new-section"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: normalizeKey(e.target.value) })}
                placeholder="e.g. hero, statistics"
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-title">{t("siteContent.titleAr", "العنوان المبدئي")}</Label>
              <Input
                id="new-title"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>{t("common.cancel")}</Button>
            <Button onClick={submitAdd} disabled={adding || !form.section}>
              {adding && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiteContent;
