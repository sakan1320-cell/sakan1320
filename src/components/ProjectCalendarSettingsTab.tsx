import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, ChevronDown, Loader2, Save, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectCalendarSettingsTabProps {
  projectId: string;
}

const WEEKDAYS = [
  { id: 0, label: "الأحد", labelEn: "Sunday" },
  { id: 1, label: "الإثنين", labelEn: "Monday" },
  { id: 2, label: "الثلاثاء", labelEn: "Tuesday" },
  { id: 3, label: "الأربعاء", labelEn: "Wednesday" },
  { id: 4, label: "الخميس", labelEn: "Thursday" },
  { id: 5, label: "الجمعة", labelEn: "Friday" },
  { id: 6, label: "السبت", labelEn: "Saturday" },
];

// Reorder weekdays to start from Saturday for Arabic display
const ARABIC_WEEKDAYS = [
  { id: 6, label: "السبت", labelEn: "Saturday" },
  { id: 0, label: "الأحد", labelEn: "Sunday" },
  { id: 1, label: "الإثنين", labelEn: "Monday" },
  { id: 2, label: "الثلاثاء", labelEn: "Tuesday" },
  { id: 3, label: "الأربعاء", labelEn: "Wednesday" },
  { id: 4, label: "الخميس", labelEn: "Thursday" },
  { id: 5, label: "الجمعة", labelEn: "Friday" },
];

export const ProjectCalendarSettingsTab = ({ projectId }: ProjectCalendarSettingsTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [excludedWeekdays, setExcludedWeekdays] = useState<number[]>([]);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  
  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  useEffect(() => {
    const loadProjectSettings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("excluded_weekdays, excluded_dates, start_date, end_date")
        .eq("id", projectId)
        .maybeSingle();

      if (error) {
        toast.error(t("common.error"));
      } else if (data) {
        setExcludedWeekdays(data.excluded_weekdays || []);
        setExcludedDates(data.excluded_dates || []);
        setStartDate(data.start_date || null);
        setEndDate(data.end_date || null);
      }
      setLoading(false);
    };

    loadProjectSettings();
  }, [projectId, t]);

  const handleWeekdayToggle = (dayId: number) => {
    setExcludedWeekdays(prev => 
      prev.includes(dayId) ? prev.filter(id => id !== dayId) : [...prev, dayId]
    );
  };

  const handleDayClick = (dateStr: string, isOutOfRange: boolean) => {
    if (isOutOfRange) {
      toast.warning(isRtl ? "هذا التاريخ خارج نطاق فترة المشروع" : "This date is outside the project duration");
      return;
    }

    setExcludedDates(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        excluded_weekdays: excludedWeekdays,
        excluded_dates: excludedDates,
        start_date: startDate,
        end_date: endDate,
        updated_at: new Date().toISOString()
      })
      .eq("id", projectId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRtl ? "تم حفظ إعدادات التقويم بنجاح" : "Calendar settings saved successfully");
    }
  };

  // Generate calendar days
  const startDayOfMonth = new Date(year, month, 1).getDay(); // Sunday=0, Saturday=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Calculate padding days to align grid to Arabic week starting Saturday
  // Saturday index in ARABIC_WEEKDAYS is 6, Sunday is 0, etc.
  // Shift padding accordingly
  const getArabicPadding = (dayIndex: number) => {
    // dayIndex: 0 (Sun) -> padding = 1, 1 (Mon) -> 2, 2 (Tue) -> 3, 3 (Wed) -> 4, 4 (Thu) -> 5, 5 (Fri) -> 6, 6 (Sat) -> 0
    return (dayIndex + 1) % 7;
  };
  
  const paddingDays = getArabicPadding(startDayOfMonth);
  
  const monthName = currentDate.toLocaleString(isRtl ? 'ar-EG' : 'en-US', { month: 'long' });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleMonthChange = (m: string) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(parseInt(m));
    setCurrentDate(newDate);
  };

  const handleYearChange = (y: string) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(parseInt(y));
    setCurrentDate(newDate);
  };

  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const years = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 10 + i);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  let totalDays: number | null = null;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end >= start) {
      let count = 0;
      let current = new Date(start);
      let limit = 3650; // Max 10 years to prevent infinite loops
      
      while (current <= end && limit > 0) {
        limit--;
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const dayOfWeek = current.getDay();

        const isDefaultWorkday = !excludedWeekdays.includes(dayOfWeek);
        const isOverridden = excludedDates.includes(dateStr);
        const isWorkingDay = isDefaultWorkday ? !isOverridden : isOverridden;

        if (isWorkingDay) {
          count++;
        }
        
        current.setDate(current.getDate() + 1);
      }
      totalDays = count;
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                {t("projects.calendarSettings", "أيام المشروع")}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Project Duration Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-bold text-primary">
                {isRtl ? "بداية المشروع" : "Project Start Date"}
              </Label>
              <input
                id="start-date"
                type="date"
                value={startDate || ""}
                onChange={(e) => setStartDate(e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-bold text-primary">
                {isRtl ? "نهاية المشروع" : "Project End Date"}
              </Label>
              <input
                id="end-date"
                type="date"
                value={endDate || ""}
                onChange={(e) => setEndDate(e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          {/* Section 2: Calendar View */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                {t("projects.holidays", "أيام العمل")}
              </h3>
              
              {totalDays !== null && (
                <div className="flex items-center bg-muted/40 px-4 py-1.5 rounded-lg border border-border/50">
                  <span className="text-sm font-bold text-foreground">
                    {isRtl ? `${totalDays} أيام` : `${totalDays} Days`}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 bg-muted/40 p-1.5 rounded-lg border border-border/50">
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-md" onClick={isRtl ? nextMonth : prevMonth}>
                  {isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-9 text-sm font-bold min-w-[120px] text-center flex items-center justify-center gap-1 hover:bg-primary/10 hover:text-primary text-foreground rounded-md px-2 transition-colors">
                      <span>{monthName} {year}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="center">
                    <div className="flex gap-2">
                      <Select value={month.toString()} onValueChange={handleMonthChange}>
                        <SelectTrigger className="w-[110px]">
                          <SelectValue placeholder={isRtl ? "الشهر" : "Month"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px]">
                          {(isRtl ? MONTHS_AR : MONTHS_EN).map((m, idx) => (
                            <SelectItem key={idx} value={idx.toString()}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={year.toString()} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-[90px]">
                          <SelectValue placeholder={isRtl ? "السنة" : "Year"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px]">
                          {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-md" onClick={isRtl ? prevMonth : nextMonth}>
                  {isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs font-bold px-2.5 border-primary/20 hover:bg-primary/5 text-primary"
                  onClick={() => setCurrentDate(new Date())}
                >
                  {isRtl ? "اليوم" : "Today"}
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-border/80 rounded-xl overflow-hidden shadow-sm bg-background">
              {/* Day Headers with Bulk Toggle */}
              <div className="grid grid-cols-7 border-b border-border/80 bg-muted/30 text-center">
                {ARABIC_WEEKDAYS.map((day) => {
                  const checked = !excludedWeekdays.includes(day.id);
                  return (
                    <div 
                      key={day.id} 
                      onClick={() => handleWeekdayToggle(day.id)}
                      className={`py-3 flex flex-col items-center justify-center cursor-pointer select-none transition-colors border-s border-border/20 first:border-s-0
                        ${checked 
                          ? "hover:bg-emerald-500/10 bg-emerald-500/5" 
                          : "bg-muted/50 hover:bg-muted/70 opacity-60"
                        }`}
                      title={isRtl ? "تفعيل/تعطيل كل أيام " + day.label : "Toggle all " + day.labelEn}
                    >
                      <span className={`text-xs font-bold uppercase tracking-wider ${checked ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {isRtl ? day.label : day.labelEn.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 text-center">
                {/* Padding Days */}
                {Array.from({ length: paddingDays }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="h-20 border-b border-r border-border/40 bg-muted/10 opacity-30" />
                ))}

                {/* Month Days */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateObject = new Date(year, month, dayNum);
                  const dayOfWeek = dateObject.getDay();
                  
                  // Format as YYYY-MM-DD in local time zone
                  const y = dateObject.getFullYear();
                  const m = String(dateObject.getMonth() + 1).padStart(2, '0');
                  const d = String(dateObject.getDate()).padStart(2, '0');
                  const dateStr = `${y}-${m}-${d}`;

                  const isDefaultWorkday = !excludedWeekdays.includes(dayOfWeek);
                  const isOverridden = excludedDates.includes(dateStr);
                  const isWorkingDay = isDefaultWorkday ? !isOverridden : isOverridden;

                  const isBeforeStart = startDate ? dateStr < startDate : false;
                  const isAfterEnd = endDate ? dateStr > endDate : false;
                  const isOutOfRange = isBeforeStart || isAfterEnd;

                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isToday = dateStr === todayStr;

                  return (
                    <div 
                      key={dayNum} 
                      onClick={() => handleDayClick(dateStr, isOutOfRange)}
                      className={`h-20 border-b border-r border-border/50 relative flex flex-col items-center justify-between p-2 cursor-pointer transition-all select-none
                        ${isToday ? "ring-2 ring-primary ring-offset-1 z-10 shadow-sm" : ""}
                        ${isOutOfRange || !isWorkingDay 
                          ? "bg-muted/30 hover:bg-muted/40" 
                          : "hover:bg-primary/5 bg-background"
                        }`}
                    >
                      <span className={`text-sm font-bold rounded-full h-7 w-7 flex items-center justify-center
                        ${isToday
                          ? "bg-primary text-white"
                          : isOutOfRange || !isWorkingDay
                            ? "text-muted-foreground bg-muted" 
                            : "text-foreground bg-emerald-500/10 text-emerald-700"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {(isOutOfRange || !isWorkingDay) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/5 pointer-events-none">
                          <span className="text-[10px] text-muted-foreground bg-muted/80 border px-1.5 py-0.5 rounded font-medium shadow-sm">
                            {isRtl ? "خارج البرنامج" : "Non-program"}
                          </span>
                        </div>
                      )}

                      <span className="text-[10px] font-medium text-muted-foreground mt-auto">
                        {!isOutOfRange && isWorkingDay && (isRtl ? "يوم عمل" : "Workday")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t pt-5">
            <Button 
              size="lg" 
              onClick={handleSave} 
              disabled={saving}
              className="px-8 text-base font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              {saving ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  {t("common.loading", "جارٍ الحفظ…")}
                </>
              ) : (
                <>
                  <Save className="ml-2 h-5 w-5" />
                  {t("common.save", "حفظ التغييرات")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
