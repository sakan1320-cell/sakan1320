import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, X, Twitter, Linkedin, Facebook, Instagram, Globe } from "lucide-react";
import logo from "@/assets/logo.png";
import { Card, CardContent } from "@/components/ui/card";

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

const Landing = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";
  
  const [settings, setSettings] = useState<LandingSettings>(DEFAULT_SETTINGS);
  const [appearance, setAppearance] = useState<ExternalAppearanceSettings>(DEFAULT_EXTERNAL_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);

  // Helper to convert HEX to HSL for Tailwind CSS variable
  const hexToHsl = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    }
    r /= 255; g /= 255; b /= 255;
    const cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
    let h = 0, s = 0, l = 0;
    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return `${h} ${s}% ${l}%`;
  };

  useEffect(() => {
    // Dynamically set dir attribute when language changes
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
    
    // Apply Dynamic Appearance
    if (appearance) {
      document.documentElement.style.fontFamily = `"${appearance.typography?.font_family || 'Cairo'}", sans-serif`;
      
      if (appearance.colors?.primary) {
        try {
          const hslValue = hexToHsl(appearance.colors.primary);
          document.documentElement.style.setProperty('--primary', hslValue);
        } catch (e) {}
      } else {
        document.documentElement.style.removeProperty('--primary');
      }
    }
  }, [isRtl, i18n.language, appearance]);

  const toggleLanguage = () => {
    const newLang = isRtl ? "en" : "ar";
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("landing_page_settings")
          .select("*")
          .eq("id", "00000000-0000-0000-0000-000000000000")
          .maybeSingle();
        
        if (data) {
          setSettings({
            appearance: data.appearance || DEFAULT_SETTINGS.appearance,
            hero_section: data.hero_section || DEFAULT_SETTINGS.hero_section,
            header_links: data.header_links || [],
            business_platform_btn: data.business_platform_btn || DEFAULT_SETTINGS.business_platform_btn,
            popup_alert: data.popup_alert || DEFAULT_SETTINGS.popup_alert,
            about_us: data.about_us || DEFAULT_SETTINGS.about_us,
            news_cards: data.news_cards || [],
            partners_carousel: data.partners_carousel || [],
            social_media_links: data.social_media_links || DEFAULT_SETTINGS.social_media_links
          });

          // Check popup
          if (data.popup_alert?.is_enabled && data.popup_alert?.image_url) {
            const hasSeenPopup = sessionStorage.getItem("landing_popup_seen");
            if (!hasSeenPopup) {
              setShowPopup(true);
            }
          }
        }

        const { data: appData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "external_appearance")
          .maybeSingle();

        if (appData?.value) {
          setAppearance(appData.value as unknown as ExternalAppearanceSettings);
        }
      } catch (e) {
        console.warn("Could not fetch landing settings");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    const channel1 = supabase.channel('public:landing_page_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_page_settings' }, (payload) => {
        const data = payload.new as any;
        if (data) {
          setSettings({
            header_links: data.header_links || [],
            business_platform_btn: data.business_platform_btn || DEFAULT_SETTINGS.business_platform_btn,
            popup_alert: data.popup_alert || DEFAULT_SETTINGS.popup_alert,
            about_us: data.about_us || DEFAULT_SETTINGS.about_us,
            news_cards: data.news_cards || [],
            partners_carousel: data.partners_carousel || [],
            social_media_links: data.social_media_links || DEFAULT_SETTINGS.social_media_links
          });
        }
      })
      .subscribe();

    const channel2 = supabase.channel('public:app_settings_appearance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: "key=eq.external_appearance" }, (payload) => {
        const data = payload.new as any;
        if (data && data.value) {
          setAppearance(data.value as ExternalAppearanceSettings);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, []);

  const closePopup = () => {
    setShowPopup(false);
    sessionStorage.setItem("landing_popup_seen", "true");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sorting header links by order_index
  const sortedLinks = [...settings.header_links].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Popup Alert */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative max-w-2xl w-full rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <button 
              onClick={closePopup}
              className="absolute top-4 end-4 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <a 
              href={settings.popup_alert?.action_url || "#"} 
              target={settings.popup_alert?.action_url?.startsWith('http') ? "_blank" : "_self"}
              className="block cursor-pointer"
              onClick={() => {
                if (!settings.popup_alert?.action_url) closePopup();
              }}
            >
              <img 
                src={settings.popup_alert.image_url} 
                alt="Alert" 
                className="w-full h-auto object-cover"
              />
            </a>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b shadow-sm" style={{ backgroundColor: appearance?.colors?.header_bg || '#ffffff', color: appearance?.colors?.header_text || '#1e293b' }}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo at the START */}
          <div className="flex shrink-0 items-center">
            <img src={logo} alt="Logo" className="h-12 w-auto object-contain" />
          </div>

          {/* Navigation Links in the CENTER (Hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-8 mx-auto">
            {sortedLinks.map((link) => (
              <a 
                key={link.id} 
                href={link.url}
                className="text-sm font-semibold transition-colors opacity-90 hover:opacity-100 hover:text-primary"
              >
                {isRtl ? link.label_ar : link.label_en}
              </a>
            ))}
          </nav>

          {/* Action Buttons at the END */}
          <div className="flex items-center gap-3 shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleLanguage}
              className="font-bold gap-2 opacity-80 hover:opacity-100 hover:bg-black/5"
            >
              <Globe className="h-4 w-4" />
              {isRtl ? 'En' : 'عربي'}
            </Button>
            
            <Button 
              onClick={() => navigate(settings.business_platform_btn.target_url || "/auth")}
              className="font-bold text-primary-foreground px-6 rounded-md shadow-md bg-primary hover:bg-primary/90"
            >
              {isRtl ? "تسجيل الدخول" : "Login"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1">
        
        {/* Hero Section */}
        {appearance?.hero?.title && (
          <section 
            className={`relative overflow-hidden py-32 px-4 text-white ${appearance.hero.bg_type === 'gradient' ? `bg-gradient-to-br ${appearance.hero.bg_gradient}` : ''}`}
            style={appearance.hero.bg_type === 'image' && appearance.hero.bg_image_url ? {
              backgroundImage: `url(${appearance.hero.bg_image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : {}}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black" style={{ opacity: (appearance.hero.overlay_opacity ?? 50) / 100 }}></div>
            
            <div className="relative max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                {appearance.hero.title}
              </h1>
              <p className="text-lg md:text-2xl opacity-90 max-w-2xl mx-auto leading-relaxed">
                {appearance.hero.subtitle}
              </p>
              <div className="pt-8">
                <Button 
                  size="lg" 
                  onClick={() => navigate(appearance.hero.btn_link || "/auth")}
                  className="bg-white text-slate-900 hover:bg-slate-100 font-bold text-lg px-10 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-105"
                >
                  {appearance.hero.btn_text}
                </Button>
              </div>
            </div>
          </section>
        )}
        {/* About Us Section */}
        {settings.about_us.section_is_visible && (settings.about_us.text_ar || settings.about_us.text_en) && (
          <section className="py-20 px-4 bg-white text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-black mb-6 text-slate-800">
                {isRtl ? "من نحن" : "About Us"}
              </h2>
              <p className="text-lg leading-relaxed text-slate-600">
                {isRtl ? settings.about_us.text_ar : settings.about_us.text_en}
              </p>
            </div>
          </section>
        )}

        {/* News Cards Section */}
        {settings.news_cards.length > 0 && (
          <section className="py-16 px-4 bg-slate-50">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold mb-10 text-center text-slate-800">
                {isRtl ? "أحدث الأخبار" : "Latest News"}
              </h2>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {settings.news_cards.map((news) => (
                  <Card key={news.id} className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow bg-white rounded-xl">
                    {news.image_url && (
                      <div className="h-48 w-full overflow-hidden">
                        <img src={news.image_url} alt={isRtl ? news.title_ar : news.title_en} className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold mb-3 text-slate-800">
                        {isRtl ? news.title_ar : news.title_en}
                      </h3>
                      <p className="text-slate-600 line-clamp-3 text-sm leading-relaxed">
                        {isRtl ? news.desc_ar : news.desc_en}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Partners Carousel Section */}
        {settings.partners_carousel.length > 0 && (
          <section className="py-16 bg-white overflow-hidden border-y border-slate-100">
            <div className="max-w-7xl mx-auto px-4 text-center">
              <h2 className="text-xl font-bold mb-8 text-slate-400 uppercase tracking-widest">
                {isRtl ? "شركاء النجاح" : "Our Partners"}
              </h2>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                {settings.partners_carousel.map((logoUrl, i) => (
                  <img key={i} src={logoUrl} alt="Partner" className="h-12 md:h-16 w-auto object-contain" />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-12" style={{ backgroundColor: appearance?.colors?.footer_bg || '#0f172a', color: appearance?.colors?.footer_text || '#cbd5e1' }}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-4">
            <img src={logo} alt="Logo" className="h-10 w-auto brightness-0 invert opacity-80" />
            <span className="text-sm font-medium">
              © {new Date().getFullYear()} {isRtl ? "سكن" : "Sakan"}. {isRtl ? "جميع الحقوق محفوظة" : "All rights reserved."}
            </span>
          </div>

          {/* Social Icons dynamically hidden if empty */}
          <div className="flex gap-4 items-center">
            {settings.social_media_links.twitter && (
              <a href={settings.social_media_links.twitter} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            )}
            {settings.social_media_links.facebook && (
              <a href={settings.social_media_links.facebook} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {settings.social_media_links.instagram && (
              <a href={settings.social_media_links.instagram} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {settings.social_media_links.linkedin && (
              <a href={settings.social_media_links.linkedin} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
