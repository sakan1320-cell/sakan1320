import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Palette, Moon, Sun, Calendar, CheckCircle2, Monitor, Type, MousePointerClick, Check, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_COLORS = [
  { value: "238 50% 32%" }, // #29327A
  { value: "270 50% 40%" },
  { value: "160 60% 35%" },
  { value: "25 85% 50%" },
  { value: "350 65% 45%" },
];

const RADIUS_OPTIONS = [
  { name: "بدون", value: "0rem" },
  { name: "صغير", value: "0.3rem" },
  { name: "متوسط", value: "0.5rem" },
  { name: "كبير", value: "0.75rem" },
  { name: "كامل", value: "1rem" },
];

export default function Preferences() {
  const { theme, setTheme } = useTheme();
  
  const [activeColor, setActiveColor] = useState(localStorage.getItem("theme-primary") || THEME_COLORS[0].value);
  const [activeRadius, setActiveRadius] = useState(localStorage.getItem("theme-radius") || "0.65rem");
  const [hijriMode, setHijriMode] = useState(localStorage.getItem("calendar-hijri") === "true");

  useEffect(() => {
    localStorage.setItem("calendar-hijri", hijriMode.toString());
  }, [hijriMode]);

  const changeTheme = (color: string) => {
    document.documentElement.style.setProperty('--primary', color);
    localStorage.setItem("theme-primary", color);
    setActiveColor(color);
    window.dispatchEvent(new Event('storage'));
  };

  const changeRadius = (radius: string) => {
    document.documentElement.style.setProperty('--radius', radius);
    localStorage.setItem("theme-radius", radius);
    setActiveRadius(radius);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">المظهر</h1>
          <p className="text-muted-foreground mt-1">تخصيص الواجهة لتجربة استخدام مثالية ومريحة لك</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Controls Column */}
        <div className="md:col-span-7 space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-primary" />
                تخصيص الواجهة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
              
              {/* Layout row for Mode and Calendar */}
              <div className="grid grid-cols-2 gap-6">
                {/* Dark/Light Mode */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                      وضع الشاشة
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex-1 h-16 flex items-center justify-center p-4 rounded-xl border-2 transition-all", 
                        theme === "light" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      )}
                    >
                      <Sun className={cn("h-6 w-6", theme === "light" ? "text-orange-500" : "")} /> 
                    </button>
                    <button 
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex-1 h-16 flex items-center justify-center p-4 rounded-xl border-2 transition-all", 
                        theme === "dark" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      )}
                    >
                      <Moon className={cn("h-6 w-6", theme === "dark" ? "text-blue-500" : "")} /> 
                    </button>
                  </div>
                </div>

                {/* Calendar Type */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      نوع التقويم
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setHijriMode(false)}
                      className={cn(
                        "flex-1 h-16 flex items-center justify-center p-4 rounded-xl border-2 transition-all relative", 
                        !hijriMode ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      )}
                      title="ميلادي"
                    >
                      <span className={cn("font-bold text-sm", !hijriMode ? "text-primary" : "")}>ميلادي</span>
                      {!hijriMode && <CheckCircle2 className="w-4 h-4 text-primary absolute top-2 right-2" />}
                    </button>
                    <button 
                      onClick={() => setHijriMode(true)}
                      className={cn(
                        "flex-1 h-16 flex items-center justify-center p-4 rounded-xl border-2 transition-all relative", 
                        hijriMode ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      )}
                      title="هجري"
                    >
                      <span className={cn("font-bold text-sm", hijriMode ? "text-primary" : "")}>هجري</span>
                      {hijriMode && <CheckCircle2 className="w-4 h-4 text-primary absolute top-2 right-2" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Primary Color */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  لون النظام
                </h3>
                <div className="flex flex-wrap gap-4">
                  {THEME_COLORS.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => changeTheme(color.value)}
                      className={cn(
                        "flex items-center justify-center h-14 w-14 rounded-full border-4 shadow-sm transition-all",
                        activeColor === color.value ? "border-background ring-2 ring-primary ring-offset-2 scale-110" : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                      )}
                      style={{ backgroundColor: `hsl(${color.value})` }}
                    >
                      {activeColor === color.value && <Check className="h-6 w-6 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Type className="w-4 h-4 text-muted-foreground" />
                  انحناءات العناصر
                </h3>
                <div className="flex flex-wrap gap-3">
                  {RADIUS_OPTIONS.map(radius => (
                    <button
                      key={radius.name}
                      onClick={() => changeRadius(radius.value)}
                      className={cn(
                        "flex-1 min-w-[80px] h-12 flex items-center justify-center transition-all border-2 text-sm",
                        activeRadius === radius.value ? "border-primary bg-primary/10 text-primary font-bold shadow-sm" : "border-border hover:border-primary/50 text-muted-foreground bg-card"
                      )}
                      style={{ borderRadius: radius.value }}
                    >
                      {radius.name}
                    </button>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Preview Column */}
        <div className="md:col-span-5">
          <div className="sticky top-6">
            <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">شاشة المعاينة الحية</h3>
            <div 
              className="border-2 shadow-2xl bg-card overflow-hidden transition-all duration-300 relative group"
              style={{ borderRadius: `calc(${activeRadius} + 0.25rem)`, borderColor: `hsl(${activeColor} / 0.2)` }}
            >
              {/* Fake Mac Header */}
              <div className="h-8 bg-muted/40 border-b flex items-center px-3 gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
              </div>
              
              {/* Fake Content */}
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: `hsl(${activeColor})` }}>
                        <MousePointerClick className="w-4 h-4" />
                      </div>
                      الرئيسية
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">مرحباً بك</p>
                  </div>
                </div>

                {/* Rearranged Date Preview */}
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border" style={{ borderRadius: activeRadius }}>
                  <span className="text-xs text-muted-foreground">تاريخ اليوم</span>
                  <div className="text-xs font-bold flex items-center gap-1" style={{ color: `hsl(${activeColor})` }}>
                    <CalendarDays className="w-3 h-3" />
                    {hijriMode ? "15 رمضان 1445 هـ" : "25 مارس 2024 م"}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="h-2 bg-muted rounded-full w-full"></div>
                  <div className="h-2 bg-muted rounded-full w-5/6"></div>
                  <div className="h-2 bg-muted rounded-full w-4/6"></div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <div className="p-3 border bg-card shadow-sm flex flex-col gap-2 transition-all hover:border-primary/40 hover:shadow-md cursor-default" style={{ borderRadius: activeRadius }}>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary"></div>
                    </div>
                    <div className="text-sm font-bold">الأنشطة الأخيرة</div>
                    <div className="text-xs text-muted-foreground">3 تحديثات جديدة</div>
                  </div>
                  
                  <div className="p-3 border bg-card shadow-sm flex flex-col gap-2 transition-all hover:border-primary/40 hover:shadow-md cursor-default" style={{ borderRadius: activeRadius }}>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary"></div>
                    </div>
                    <div className="text-sm font-bold">رسائل هامة</div>
                    <div className="text-xs text-muted-foreground">لا توجد تنبيهات</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1 flex items-center justify-center h-10 text-sm font-medium text-white shadow-md transition-all cursor-default" style={{ backgroundColor: `hsl(${activeColor})`, borderRadius: activeRadius }}>
                    متابعة
                  </div>
                  <div className="flex-1 flex items-center justify-center h-10 text-sm font-medium border-2 transition-all cursor-default" style={{ borderRadius: activeRadius, borderColor: `hsl(${activeColor} / 0.5)` }}>
                    عرض المزيد
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
