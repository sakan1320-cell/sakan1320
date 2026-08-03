import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pencil, Eye, Minus, ChevronDown, HelpCircle } from "lucide-react";

// ─── أنواع ────────────────────────────────────────────────────────────────────
type AccessLevel = "none" | "view" | "edit" | "custom";

// ─── الأدوار ──────────────────────────────────────────────────────────────────
const ALL_ROLES: AppRole[] = [
  "executive", "assistant", "board", "project_manager",
  "branch_manager", "employee", "contractor", "participant", "guardian",
];



const PROJECT_CATEGORIES = [
  "projects", "tasks", "attendance", "finance", "finances",
  "reports", "templates", "surveys", "workflows", "branches",
  "automations", "guardians", "staff", "lms", "participants", "gamification",
];

// ─── جدول أزواج الصلاحيات ────────────────────────────────────────────────────
// view: مفتاح قاعدة البيانات لمستوى المشاهدة (undefined = لا يوجد مشاهدة)
// edit: مفتاح قاعدة البيانات لمستوى التعديل الكامل
// hasView: true  → دورة: none → view → edit → none
// hasView: false → دورة: none → edit → none   (تُخفى حالة مشاهد تماماً)
interface PermPair {
  view?: string;
  edit: string;
  label: string;
  category: string;
  hasView: boolean; // هل منطقياً ممكن مشاهدة بدون تعديل؟
}

const PERMISSION_PAIRS: Record<string, PermPair> = {
  // ══════════════════════════════════════════════════
  // قسم: إدارة المشاريع
  // ══════════════════════════════════════════════════
  projects:         { view: "view_projects",              edit: "manage_projects",               label: "المشاريع (إنشاء وتعديل وحذف)",      category: "projects",      hasView: true  },
  project_budget:   { view: "view_project_budget",        edit: "manage_project_budget",         label: "ميزانية المشروع",                    category: "projects",      hasView: true  },
  project_team:     { view: "view_project_team",          edit: "manage_project_team",           label: "فريق المشروع (الأعضاء)",            category: "projects",      hasView: true  },
  project_files:    { view: "view_project_files",         edit: "manage_project_files",          label: "ملفات ومرفقات المشروع",             category: "projects",      hasView: true  },
  project_perf:     { view: "view_project_performance",   edit: "view_project_performance",      label: "أداء وإنجاز المشروع",               category: "projects",      hasView: false },
  project_settings: {                                      edit: "manage_project_settings",       label: "إعدادات المشروع",                    category: "projects",      hasView: false },

  // ══════════════════════════════════════════════════
  // قسم: إدارة المهام
  // ══════════════════════════════════════════════════
  tasks:            { view: "view_tasks",                 edit: "manage_tasks",                  label: "المهام (إنشاء وتعديل)",             category: "tasks",         hasView: true  },
  tasks_assign:     {                                      edit: "assign_tasks",                  label: "تعيين المهام للمستخدمين",           category: "tasks",         hasView: false },
  tasks_comments:   { view: "view_task_comments",         edit: "manage_task_comments",          label: "تعليقات المهام",                    category: "tasks",         hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الحضور والغياب
  // ══════════════════════════════════════════════════
  attendance:       { view: "view_attendance",            edit: "manage_attendance",             label: "تسجيل الحضور والغياب",              category: "attendance",    hasView: true  },
  attendance_rpt:   { view: "view_attendance_reports",    edit: "export_attendance",             label: "تقارير الحضور وتصديرها",            category: "attendance",    hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الشؤون المالية
  // ══════════════════════════════════════════════════
  finance:          { view: "view_finance",               edit: "manage_finance",                label: "المعاملات المالية",                 category: "finance",       hasView: true  },
  finance_attach:   { view: "view_finance_attachments",   edit: "manage_finance_attachments",    label: "مرفقات المالية",                    category: "finance",       hasView: true  },
  finance_export:   { view: "view_finance",               edit: "export_finance",                label: "تصدير التقارير المالية",            category: "finance",       hasView: false },
  project_budget_v: { view: "view_project_budget",        edit: "manage_project_budget",         label: "ميزانية المشروع (داخل المشروع)",    category: "finance",       hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: التقارير والإحصائيات
  // ══════════════════════════════════════════════════
  reports:          { view: "view_reports",               edit: "export_reports",                label: "التقارير العامة وتصديرها",          category: "reports",       hasView: true  },
  statistics:       { view: "view_statistics",            edit: "view_statistics",               label: "الإحصائيات والمؤشرات",              category: "reports",       hasView: false },
  smart_reports:    { view: "view_smart_reports",         edit: "manage_smart_reports",          label: "التقارير الذكية للمشروع",           category: "reports",       hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: القوالب
  // ══════════════════════════════════════════════════
  task_templates:   { view: "view_task_templates",        edit: "manage_task_templates",         label: "قوالب المهام",                      category: "templates",     hasView: true  },
  proj_templates:   { view: "view_project_templates",     edit: "manage_project_templates",      label: "قوالب المشاريع",                   category: "templates",     hasView: true  },
  notif_templates:  { view: "view_notification_templates",edit: "manage_notification_templates", label: "قوالب الرسائل والرسائل",          category: "templates",     hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الاستبيانات
  // ══════════════════════════════════════════════════
  surveys:          { view: "view_surveys",               edit: "manage_surveys",                label: "الاستبيانات (إنشاء وتعديل)",        category: "surveys",       hasView: true  },
  survey_results:   { view: "view_survey_results",        edit: "export_survey_results",         label: "نتائج الاستبيانات وتصديرها",        category: "surveys",       hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: قواعد الأتمتة
  // ══════════════════════════════════════════════════
  automations:      { view: "view_automations",           edit: "manage_automations",            label: "قواعد الأتمتة",                     category: "automations",   hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الفروع
  // ══════════════════════════════════════════════════
  branches:         { view: "view_branches",              edit: "manage_branches",               label: "الفروع والمجموعات",                 category: "branches",      hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: أولياء الأمور
  // ══════════════════════════════════════════════════
  guardians:        { view: "view_guardians",             edit: "manage_guardians",              label: "أولياء الأمور",                     category: "guardians",     hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: طلبات التوظيف
  // ══════════════════════════════════════════════════
  staff_req:        { view: "view_staff_requests",        edit: "manage_staff_requests",         label: "طلبات الانضمام والتوظيف",           category: "staff",         hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: التعلم الإلكتروني (LMS)
  // ══════════════════════════════════════════════════
  lms_courses:      { view: "view_courses",               edit: "manage_courses",                label: "الدورات التدريبية",                 category: "lms",           hasView: true  },
  lms_quiz:         { view: "view_quizzes",               edit: "manage_quizzes",                label: "الاختبارات والتقييمات",             category: "lms",           hasView: true  },
  lms_grades:       {                                      edit: "grade_activities",              label: "تقييم أنشطة المشاركين",             category: "lms",           hasView: false },
  lms_adv:          {                                      edit: "manage_lms_advanced",           label: "خيارات التعلم المتقدمة",            category: "lms",           hasView: false },
  lms_project:      { view: "view_project_training",      edit: "manage_project_training",       label: "تدريب المشروع",                     category: "lms",           hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: المشاركون
  // ══════════════════════════════════════════════════
  participants:     { view: "view_participants",           edit: "manage_participants",           label: "المشاركون (إضافة وتعديل)",          category: "participants",  hasView: true  },
  part_export:      { view: "view_participants",           edit: "export_participants",           label: "تصدير بيانات المشاركين",            category: "participants",  hasView: false },
  part_points:      { view: "view_participant_points",     edit: "manage_participant_points",     label: "نقاط التلعيب للمشاركين",            category: "participants",  hasView: true  },
  part_edit_req:    { view: "view_participants",           edit: "manage_participants",           label: "طلبات تعديل الملفات الشخصية",       category: "participants",  hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: التلعيب (Gamification)
  // ══════════════════════════════════════════════════
  gamification:     { view: "view_gamification",          edit: "manage_gamification",           label: "نظام التلعيب والإنجازات",           category: "gamification",  hasView: true  },
  badges:           { view: "view_gamification",          edit: "manage_badges",                 label: "الشارات والجوائز",                  category: "gamification",  hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: المستخدمون والصلاحيات
  // ══════════════════════════════════════════════════
  users:            { view: "view_users",                 edit: "manage_users",                  label: "المستخدمون (إضافة وتعديل)",         category: "users",         hasView: true  },
  roles_perm:       { view: "view_roles",                 edit: "manage_permissions",            label: "الأدوار والصلاحيات",                category: "users",         hasView: true  },
  user_creds:       {                                      edit: "manage_user_credentials",       label: "بيانات دخول المستخدمين",            category: "users",         hasView: false },
  change_pass:      {                                      edit: "change_user_password",          label: "تغيير كلمة مرور المستخدم",          category: "users",         hasView: false },

  // ══════════════════════════════════════════════════
  // قسم: الرسائل
  // ══════════════════════════════════════════════════
  notifications:    { view: "view_notifications",         edit: "manage_notifications",          label: "الرسائل والتنبيهات",              category: "notifications", hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الواتساب
  // ══════════════════════════════════════════════════
  whatsapp_view:    { view: "view_whatsapp",              edit: "manage_whatsapp",               label: "مركز واتساب وقوالبه",               category: "whatsapp",      hasView: true  },
  whatsapp_send:    {                                      edit: "send_whatsapp",                 label: "إرسال رسائل واتساب",                category: "whatsapp",      hasView: false },
  whatsapp_auto:    { view: "view_automations",           edit: "manage_automations",            label: "رسائل واتساب التلقائية",            category: "whatsapp",      hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الإعدادات العامة
  // ══════════════════════════════════════════════════
  settings:         { view: "view_settings",              edit: "manage_settings",               label: "الإعدادات العامة للنظام",           category: "settings",      hasView: true  },
  translations:     {                                      edit: "manage_translations",           label: "الترجمات واللغات",                  category: "settings",      hasView: false },
  reg_structure:    {                                      edit: "manage_settings",               label: "هيكلة بيانات التسجيل",              category: "settings",      hasView: false },

  // ══════════════════════════════════════════════════
  // قسم: إدارة الموقع
  // ══════════════════════════════════════════════════
  site_content:     { view: "view_site",                  edit: "manage_site_content",           label: "محتوى الموقع الإلكتروني",           category: "site",          hasView: true  },
  homepage:         {                                      edit: "manage_homepage",               label: "الصفحة الرئيسية للموقع",            category: "site",          hasView: false },

  // ══════════════════════════════════════════════════
  // قسم: الاتصالات والدعم
  // ══════════════════════════════════════════════════
  messages:         { view: "view_messages",              edit: "manage_messages",               label: "الرسائل الداخلية",                  category: "communication", hasView: true  },
  tickets:          { view: "view_support",               edit: "manage_tickets",                label: "تذاكر الدعم الفني",                 category: "technical",     hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: سجلات النظام
  // ══════════════════════════════════════════════════
  audit:            { view: "view_audit",                 edit: "view_audit",                    label: "سجل العمليات (Audit Log)",          category: "admin",         hasView: false },
  sys_errors:       { view: "view_system_errors",         edit: "manage_system_errors",          label: "سجل أخطاء النظام",                  category: "admin",         hasView: true  },

  // ══════════════════════════════════════════════════
  // قسم: الحساب الشخصي
  // ══════════════════════════════════════════════════
  dashboard:        { view: "view_dashboard",             edit: "view_dashboard",                label: "لوحة التحكم الرئيسية",              category: "system",        hasView: false },
  own_profile:      {                                      edit: "edit_own_profile",              label: "تعديل الملف الشخصي",               category: "account",       hasView: false },
};

// ─── ترجمة أسماء الفئات ───────────────────────────────────────────────────────
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  projects: "إدارة المشاريع",       tasks: "إدارة المهام",
  attendance: "الحضور والغياب",     finance: "الشؤون المالية",
  reports: "التقارير والإحصائيات",  templates: "القوالب والنماذج",
  surveys: "الاستبيانات",           automations: "قواعد الأتمتة",
  branches: "الفروع والمجموعات",    guardians: "أولياء الأمور",
  staff: "طلبات التوظيف والانضمام", lms: "نظام التعلم الإلكتروني",
  participants: "المشاركون والكوادر",users: "المستخدمون والصلاحيات",
  notifications: "الرسائل والتنبيهات", whatsapp: "خدمات واتساب",
  settings: "الإعدادات العامة",     site: "إدارة الموقع",
  communication: "الاتصالات الداخلية", technical: "الدعم الفني",
  admin: "سجلات وأمن النظام",       system: "لوحة التحكم",
  account: "الحساب الشخصي",         workflows: "سير العمل",
  gamification: "التلعيب والإنجازات",
  other: "أخرى",
};

function getSubKeys(pair: PermPair) {
  if (!pair.edit || !pair.edit.startsWith("manage_")) return null;
  const base = pair.edit.replace("manage_", "");
  return {
    create: `create_${base}`,
    update: `update_${base}`,
    delete: `delete_${base}`
  };
}

// ─── دوران المستوى (مع مراعاة hasView) ──────────────────────────────────────
function nextLevel(current: AccessLevel, hasView: boolean): AccessLevel {
  if (current === "custom") return "none";
  if (!hasView) {
    return current === "none" ? "edit" : "none";
  }
  const map: Record<Exclude<AccessLevel, "custom">, AccessLevel> = { none: "view", view: "edit", edit: "none" };
  return map[current];
}

// ─── أيقونة المستوى ───────────────────────────────────────────────────────────
function LevelIcon({ level }: { level: AccessLevel }) {
  if (level === "edit") return <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (level === "custom") return (
    <div className="relative inline-block">
      <Pencil className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <span className="absolute -top-1 -right-1 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
      </span>
    </div>
  );
  if (level === "view") return <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground/30" />;
}

// ─── دليل الرموز ─────────────────────────────────────────────────────────────
function Legend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground transition-colors" title="دليل الرموز">
          <HelpCircle className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-4 shadow-lg rounded-xl border bg-card z-50">
        <div className="flex flex-col gap-3 text-sm">
          <span className="font-bold text-foreground border-b pb-2">دليل رموز الصلاحيات:</span>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <Pencil className="h-4 w-4" /> تعديل كامل
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
              <div className="relative inline-block">
                <Pencil className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </div>
              تعديل جزئي مخصص
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400">
              <Eye className="h-4 w-4" /> مشاهدة فقط
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Minus className="h-4 w-4" /> بلا صلاحية
            </span>
          </div>
          <div className="text-muted-foreground italic border-t pt-3 mt-1 text-center text-xs">
            (انقر للتبديل، أو اضغط مطولاً للتخصيص)
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── زر الدوران ──────────────────────────────────────────────────────────────
interface CycleBtnProps {
  level: AccessLevel;
  hasView: boolean;
  onCycle: () => void;
  subKeys?: { create: string; update: string; delete: string } | null;
  currentPermissions: Set<string>;
  onToggleSubKey: (subKeyName: "create" | "update" | "delete", currentlyGranted: boolean) => void;
}

function CycleBtn({
  level,
  hasView,
  onCycle,
  subKeys,
  currentPermissions,
  onToggleSubKey
}: CycleBtnProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const timerRef = useRef<any>(null);

  const handleMouseDown = () => {
    if (!subKeys) return;
    timerRef.current = setTimeout(() => {
      setPopoverOpen(true);
    }, 600);
  };

  const handleMouseUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasFullEdit = level === "edit";
  const isCreateGranted = hasFullEdit || (subKeys ? currentPermissions.has(subKeys.create) : false);
  const isUpdateGranted = hasFullEdit || (subKeys ? currentPermissions.has(subKeys.update) : false);
  const isDeleteGranted = hasFullEdit || (subKeys ? currentPermissions.has(subKeys.delete) : false);

  const title =
    level === "edit" ? "تعديل كامل — انقر للتغيير، اضغط مطولاً للتفاصيل" :
    level === "custom" ? "تعديل مخصص — انقر للتغيير، اضغط مطولاً للتفاصيل" :
    level === "view" ? "مشاهدة فقط — انقر للتغيير" :
    "بلا صلاحية — انقر للتغيير";

  const mainButton = (
    <button
      type="button"
      onClick={onCycle}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      className="inline-flex items-center justify-center p-1 rounded transition-transform hover:scale-125 select-none"
      title={title}
    >
      <LevelIcon level={level} />
    </button>
  );

  if (!subKeys || level === "none" || level === "view") {
    return mainButton;
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild onClick={(e) => e.preventDefault()}>
        {mainButton}
      </PopoverTrigger>
      <PopoverContent className="w-[100px] p-1.5 shadow-md rounded-lg border bg-card text-foreground z-50" align="center" side="bottom">
        <div>
          <h4 className="font-bold text-[10px] border-b pb-0.5 mb-1 text-muted-foreground text-center">مخصص</h4>
          <div className="space-y-0.5">
            <label className="flex items-center gap-1 text-[11px] font-medium cursor-pointer hover:bg-muted/30 p-0.5 rounded transition-colors select-none">
              <Checkbox
                checked={isCreateGranted}
                onCheckedChange={() => onToggleSubKey("create", isCreateGranted)}
                className="h-3.5 w-3.5"
              />
              <span>إضافة</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] font-medium cursor-pointer hover:bg-muted/30 p-0.5 rounded transition-colors select-none">
              <Checkbox
                checked={isUpdateGranted}
                onCheckedChange={() => onToggleSubKey("update", isUpdateGranted)}
                className="h-3.5 w-3.5"
              />
              <span>تعديل</span>
            </label>
            <label className="flex items-center gap-1 text-[11px] font-medium cursor-pointer hover:bg-muted/30 p-0.5 rounded transition-colors select-none">
              <Checkbox
                checked={isDeleteGranted}
                onCheckedChange={() => onToggleSubKey("delete", isDeleteGranted)}
                className="h-3.5 w-3.5"
              />
              <span>حذف</span>
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── جدول الصلاحيات ───────────────────────────────────────────────────────────
interface PermTableProps {
  grouped: Record<string, { key: string; pair: PermPair }[]>;
  roles: string[];
  getLevel: (role: string, pairKey: string) => AccessLevel;
  onCycle: (role: string, pairKey: string, pair: PermPair, current: AccessLevel) => void;
  getRolePermSet: (role: string) => Set<string>;
  onToggleSubKey: (role: string, pairKey: string, pair: PermPair, subKeyName: "create" | "update" | "delete", currentlyGranted: boolean) => void;
}

function PermTable({ grouped, roles, getLevel, onCycle, getRolePermSet, onToggleSubKey }: PermTableProps) {
  return (
    <>
      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-base text-primary">
              {CATEGORY_TRANSLATIONS[cat] || cat}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-start p-2 min-w-[160px]">الصلاحية</th>
                  {roles.map(r => (
                    <th key={r} className="p-2 text-xs text-center whitespace-nowrap">
                      {r === "executive" ? "تنفيذي" : r === "assistant" ? "مساعد" : r === "board" ? "مجلس" :
                       r === "project_manager" ? "مدير مشروع" : r === "branch_manager" ? "مدير فرع" :
                       r === "employee" ? "موظف" : r === "contractor" ? "متعاقد" :
                       r === "participant" ? "مشارك" : r === "guardian" ? "ولي أمر" : r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(({ key: pairKey, pair }) => (
                  <tr key={pairKey} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="p-2 font-medium">
                      {pair.label}
                      {!pair.hasView && (
                        <span className="ms-1 text-[10px] text-muted-foreground opacity-60">(تعديل فقط)</span>
                      )}
                    </td>
                    {roles.map(r => {
                      const level = getLevel(r, pairKey);
                      const subKeys = getSubKeys(pair);
                      const currentPermissions = getRolePermSet(r);
                      return (
                        <td key={r} className="p-2 text-center">
                          <CycleBtn
                            level={level}
                            hasView={pair.hasView}
                            onCycle={() => onCycle(r, pairKey, pair, level)}
                            subKeys={subKeys}
                            currentPermissions={currentPermissions}
                            onToggleSubKey={(subKey, granted) => onToggleSubKey(r, pairKey, pair, subKey, granted)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────────────────────────────────────
const Permissions = () => {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const isExecutive = hasRole("executive");
  const fallbackRoute = useFallbackRoute();

  // ── State ─────────────────────────────────────────────────────────────────
  const [rolePermsDB, setRolePermsDB] = useState<Map<string, Set<string>>>(new Map());
  const [permLevels, setPermLevels] = useState<Map<string, AccessLevel>>(new Map());

  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [userPermLevels, setUserPermLevels] = useState<Map<string, AccessLevel>>(new Map());
  const [userPermsDB, setUserPermsDB] = useState<Set<string>>(new Set());

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [{ data: rp }, { data: u }] = await Promise.all([
      supabase.from("role_permissions").select("role, permission_key"),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);

    const dbMap = new Map<string, Set<string>>();
    (rp ?? []).forEach((r: any) => {
      if (!dbMap.has(r.role)) dbMap.set(r.role, new Set());
      dbMap.get(r.role)!.add(r.permission_key);
    });
    setRolePermsDB(dbMap);
    setUsers(u ?? []);

    try {
      const stored = localStorage.getItem("sakansa_perm_levels_v2");
      if (stored) {
        const parsed = JSON.parse(stored);
        const lMap = new Map<string, AccessLevel>();
        Object.keys(parsed).forEach(k => lMap.set(k, parsed[k] as AccessLevel));
        setPermLevels(lMap);
      }
    } catch (e) {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── صلاحيات المستخدم المحدد ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) { 
      setUserPermLevels(new Map()); 
      setUserPermsDB(new Set()); 
      return; 
    }
    supabase.from("user_permissions")
      .select("permission_key, granted")
      .eq("user_id", selectedUser)
      .then(({ data }) => {
        // بناء خريطة pairKey → level من مفاتيح DB
        const keyToPair: Record<string, { pairKey: string; isView: boolean }> = {};
        Object.entries(PERMISSION_PAIRS).forEach(([pk, pair]) => {
          if (pair.view) keyToPair[pair.view] = { pairKey: pk, isView: true };
          keyToPair[pair.edit] = { pairKey: pk, isView: false };
        });

        const activeKeys = new Set<string>();
        const m = new Map<string, AccessLevel>();
        
        (data ?? []).forEach((r: any) => {
          if (!r.granted) return;
          activeKeys.add(r.permission_key);
          const info = keyToPair[r.permission_key];
          if (!info) return;
          const existing = m.get(info.pairKey);
          if (info.isView && existing !== "edit") m.set(info.pairKey, "view");
          if (!info.isView) m.set(info.pairKey, "edit");
        });

        // تحقق من الصلاحيات المخصصة (CRUD) للمستخدم
        Object.entries(PERMISSION_PAIRS).forEach(([pk, pair]) => {
          const subKeys = getSubKeys(pair);
          if (subKeys) {
            const hasCreate = activeKeys.has(subKeys.create);
            const hasUpdate = activeKeys.has(subKeys.update);
            const hasDelete = activeKeys.has(subKeys.delete);
            const hasFull = activeKeys.has(pair.edit);
            if (hasFull) {
              m.set(pk, "edit");
            } else if (hasCreate || hasUpdate || hasDelete) {
              const hasAll = hasCreate && hasUpdate && hasDelete;
              m.set(pk, hasAll ? "edit" : "custom");
            }
          }
        });

        setUserPermLevels(m);
        setUserPermsDB(activeKeys);
      });
  }, [selectedUser]);

  // ── حفظ مستوى في DB (role_permissions) ───────────────────────────────────
  const setPermInDB = useCallback(async (role: string, permKey: string, grant: boolean) => {
    if (!ALL_ROLES.includes(role as AppRole)) return;
    const r = role as AppRole;
    if (grant) {
      await supabase.from("role_permissions")
        .upsert([{ role: r, permission_key: permKey }], { onConflict: "role,permission_key" });
      setRolePermsDB(m => {
        const c = new Map(m);
        if (!c.has(r)) c.set(r, new Set());
        c.get(r)!.add(permKey);
        return c;
      });
    } else {
      await supabase.from("role_permissions")
        .delete().eq("role", r).eq("permission_key", permKey);
      setRolePermsDB(m => {
        const c = new Map(m);
        c.get(r)?.delete(permKey);
        return c;
      });
    }
  }, []);

  // ── تبديل الصلاحية الفرعية للدور في قاعدة البيانات ────────────────────────
  const toggleSubKey = useCallback(async (
    role: string,
    pairKey: string,
    pair: PermPair,
    subKeyName: "create" | "update" | "delete",
    currentlyGranted: boolean
  ) => {
    const subKeys = getSubKeys(pair);
    if (!subKeys) return;

    const currentRoleSet = rolePermsDB.get(role) || new Set();
    const hasFullEdit = currentRoleSet.has(pair.edit);

    const isCreateGranted = hasFullEdit || currentRoleSet.has(subKeys.create);
    const isUpdateGranted = hasFullEdit || currentRoleSet.has(subKeys.update);
    const isDeleteGranted = hasFullEdit || currentRoleSet.has(subKeys.delete);

    const nextCreate = subKeyName === "create" ? !currentlyGranted : isCreateGranted;
    const nextUpdate = subKeyName === "update" ? !currentlyGranted : isUpdateGranted;
    const nextDelete = subKeyName === "delete" ? !currentlyGranted : isDeleteGranted;

    const nextLevelVal: AccessLevel = (nextCreate && nextUpdate && nextDelete)
      ? "edit"
      : (nextCreate || nextUpdate || nextDelete)
      ? "custom"
      : pair.view && currentRoleSet.has(pair.view)
      ? "view"
      : "none";

    const cellKey = `${role}:${pairKey}`;

    // تحديث الواجهة فوراً (Optimistic UI)
    setPermLevels(m => {
      const c = new Map(m);
      if (nextLevelVal === "none") c.delete(cellKey);
      else c.set(cellKey, nextLevelVal);
      const toSave: Record<string, string> = {};
      c.forEach((v, k) => { toSave[k] = v; });
      localStorage.setItem("sakansa_perm_levels_v2", JSON.stringify(toSave));
      return c;
    });

    setRolePermsDB(m => {
      const c = new Map(m);
      const rSet = new Set(c.get(role) || new Set());
      rSet.delete(pair.edit);
      rSet.delete(subKeys.create);
      rSet.delete(subKeys.update);
      rSet.delete(subKeys.delete);
      if (nextCreate && nextUpdate && nextDelete) {
        rSet.add(pair.edit);
      } else {
        if (nextCreate) rSet.add(subKeys.create);
        if (nextUpdate) rSet.add(subKeys.update);
        if (nextDelete) rSet.add(subKeys.delete);
      }
      if ((nextCreate || nextUpdate || nextDelete) && pair.view) {
        rSet.add(pair.view);
      }
      c.set(role, rSet);
      return c;
    });

    // تنفيذ طلبات قاعدة البيانات بالتوازي
    const cleanupPromises = [
      supabase.from("role_permissions").delete().eq("role", role).eq("permission_key", pair.edit),
      supabase.from("role_permissions").delete().eq("role", role).eq("permission_key", subKeys.create),
      supabase.from("role_permissions").delete().eq("role", role).eq("permission_key", subKeys.update),
      supabase.from("role_permissions").delete().eq("role", role).eq("permission_key", subKeys.delete)
    ];
    await Promise.all(cleanupPromises);

    const insertPromises = [];
    const insertDB = (key: string) => supabase.from("role_permissions").upsert([{ role, permission_key: key }], { onConflict: "role,permission_key" });

    if (nextCreate && nextUpdate && nextDelete) {
      insertPromises.push(insertDB(pair.edit));
    } else {
      if (nextCreate) insertPromises.push(insertDB(subKeys.create));
      if (nextUpdate) insertPromises.push(insertDB(subKeys.update));
      if (nextDelete) insertPromises.push(insertDB(subKeys.delete));
    }

    if ((nextCreate || nextUpdate || nextDelete) && pair.view) {
      insertPromises.push(insertDB(pair.view));
    }

    await Promise.all(insertPromises);

    // toast.success("تم تحديث الصلاحيات المخصصة للدور");
  }, [rolePermsDB]);

  // ── تبديل الصلاحية الفرعية للمستخدم في قاعدة البيانات ────────────────────
  const toggleUserSubKey = useCallback(async (
    pairKey: string,
    pair: PermPair,
    subKeyName: "create" | "update" | "delete",
    currentlyGranted: boolean
  ) => {
    if (!selectedUser) return;
    const subKeys = getSubKeys(pair);
    if (!subKeys) return;

    const hasFullEdit = userPermsDB.has(pair.edit);
    const isCreateGranted = hasFullEdit || userPermsDB.has(subKeys.create);
    const isUpdateGranted = hasFullEdit || userPermsDB.has(subKeys.update);
    const isDeleteGranted = hasFullEdit || userPermsDB.has(subKeys.delete);

    const nextCreate = subKeyName === "create" ? !currentlyGranted : isCreateGranted;
    const nextUpdate = subKeyName === "update" ? !currentlyGranted : isUpdateGranted;
    const nextDelete = subKeyName === "delete" ? !currentlyGranted : isDeleteGranted;

    const nextLevelVal: AccessLevel = (nextCreate && nextUpdate && nextDelete)
      ? "edit"
      : (nextCreate || nextUpdate || nextDelete)
      ? "custom"
      : pair.view && userPermsDB.has(pair.view)
      ? "view"
      : "none";

    // تحديث الواجهة فوراً (Optimistic UI)
    setUserPermLevels(m => {
      const c = new Map(m);
      if (nextLevelVal === "none") c.delete(pairKey);
      else c.set(pairKey, nextLevelVal);
      return c;
    });

    setUserPermsDB(prev => {
      const nextSet = new Set(prev);
      nextSet.delete(pair.edit);
      nextSet.delete(subKeys.create);
      nextSet.delete(subKeys.update);
      nextSet.delete(subKeys.delete);

      if (nextCreate && nextUpdate && nextDelete) {
        nextSet.add(pair.edit);
      } else {
        if (nextCreate) nextSet.add(subKeys.create);
        if (nextUpdate) nextSet.add(subKeys.update);
        if (nextDelete) nextSet.add(subKeys.delete);
      }
      if ((nextCreate || nextUpdate || nextDelete) && pair.view) {
        nextSet.add(pair.view);
      }
      return nextSet;
    });

    // تنفيذ طلبات قاعدة البيانات بالتوازي
    const deleteUserKey = (key: string) => supabase.from("user_permissions").delete().eq("user_id", selectedUser).eq("permission_key", key);
    const insertUserKey = (key: string) => supabase.from("user_permissions").upsert([{ user_id: selectedUser, permission_key: key, granted: true }], { onConflict: "user_id,permission_key" });

    await Promise.all([
      deleteUserKey(pair.edit),
      deleteUserKey(subKeys.create),
      deleteUserKey(subKeys.update),
      deleteUserKey(subKeys.delete)
    ]);

    const insertPromises = [];
    if (nextCreate && nextUpdate && nextDelete) {
      insertPromises.push(insertUserKey(pair.edit));
    } else {
      if (nextCreate) insertPromises.push(insertUserKey(subKeys.create));
      if (nextUpdate) insertPromises.push(insertUserKey(subKeys.update));
      if (nextDelete) insertPromises.push(insertUserKey(subKeys.delete));
    }

    if ((nextCreate || nextUpdate || nextDelete) && pair.view) {
      insertPromises.push(insertUserKey(pair.view));
    }

    await Promise.all(insertPromises);

    // toast.success("تم تحديث الصلاحيات المخصصة للمستخدم");
  }, [selectedUser, userPermsDB]);

  // ── دوران صلاحية الدور ────────────────────────────────────────────────────
  const cycleRoleLevel = useCallback(async (
    role: string,
    pairKey: string,
    pair: PermPair,
    currentLevel: AccessLevel
  ) => {
    if (!isExecutive) return;
    const next = nextLevel(currentLevel, pair.hasView);

    // تحديث DB للأدوار الأساسية
    if (ALL_ROLES.includes(role as AppRole)) {
      if (next === "none") {
        if (pair.view) await setPermInDB(role, pair.view, false);
        if (pair.view !== pair.edit) await setPermInDB(role, pair.edit, false);
        const subKeys = getSubKeys(pair);
        if (subKeys) {
          await setPermInDB(role, subKeys.create, false);
          await setPermInDB(role, subKeys.update, false);
          await setPermInDB(role, subKeys.delete, false);
        }
      } else if (next === "view" && pair.view) {
        await setPermInDB(role, pair.view, true);
        if (pair.view !== pair.edit) await setPermInDB(role, pair.edit, false);
        const subKeys = getSubKeys(pair);
        if (subKeys) {
          await setPermInDB(role, subKeys.create, false);
          await setPermInDB(role, subKeys.update, false);
          await setPermInDB(role, subKeys.delete, false);
        }
      } else {
        // edit
        if (pair.view) await setPermInDB(role, pair.view, true);
        await setPermInDB(role, pair.edit, true);
        const subKeys = getSubKeys(pair);
        if (subKeys) {
          await setPermInDB(role, subKeys.create, false);
          await setPermInDB(role, subKeys.update, false);
          await setPermInDB(role, subKeys.delete, false);
        }
      }
    }

    // تحديث local state
    const cellKey = `${role}:${pairKey}`;
    setPermLevels(m => {
      const c = new Map(m);
      if (next === "none") c.delete(cellKey);
      else c.set(cellKey, next);
      const toSave: Record<string, string> = {};
      c.forEach((v, k) => { toSave[k] = v; });
      localStorage.setItem("sakansa_perm_levels_v2", JSON.stringify(toSave));
      return c;
    });

    toast.success("تم الحفظ");
  }, [isExecutive, setPermInDB]);

  // ── دوران صلاحية المستخدم ─────────────────────────────────────────────────
  const cycleUserLevel = useCallback(async (pairKey: string, pair: PermPair, currentLevel: AccessLevel) => {
    if (!isExecutive || !selectedUser) return;
    const next = nextLevel(currentLevel, pair.hasView);

    const deleteUserKey = async (key: string) => {
      await supabase.from("user_permissions").delete().eq("user_id", selectedUser).eq("permission_key", key);
    };

    if (next === "none") {
      if (pair.view) await deleteUserKey(pair.view);
      if (pair.view !== pair.edit) await deleteUserKey(pair.edit);
      const subKeys = getSubKeys(pair);
      if (subKeys) {
        await deleteUserKey(subKeys.create);
        await deleteUserKey(subKeys.update);
        await deleteUserKey(subKeys.delete);
      }
    } else if (next === "view" && pair.view) {
      await supabase.from("user_permissions").upsert(
        [{ user_id: selectedUser, permission_key: pair.view, granted: true }],
        { onConflict: "user_id,permission_key" }
      );
      if (pair.view !== pair.edit) await deleteUserKey(pair.edit);
      const subKeys = getSubKeys(pair);
      if (subKeys) {
        await deleteUserKey(subKeys.create);
        await deleteUserKey(subKeys.update);
        await deleteUserKey(subKeys.delete);
      }
    } else {
      if (pair.view) await supabase.from("user_permissions").upsert(
        [{ user_id: selectedUser, permission_key: pair.view, granted: true }],
        { onConflict: "user_id,permission_key" }
      );
      await supabase.from("user_permissions").upsert(
        [{ user_id: selectedUser, permission_key: pair.edit, granted: true }],
        { onConflict: "user_id,permission_key" }
      );
      const subKeys = getSubKeys(pair);
      if (subKeys) {
        await deleteUserKey(subKeys.create);
        await deleteUserKey(subKeys.update);
        await deleteUserKey(subKeys.delete);
      }
    }

    setUserPermsDB(prev => {
      const nextSet = new Set(prev);
      if (next === "none") {
        if (pair.view) nextSet.delete(pair.view);
        nextSet.delete(pair.edit);
        const subKeys = getSubKeys(pair);
        if (subKeys) {
          nextSet.delete(subKeys.create);
          nextSet.delete(subKeys.update);
          nextSet.delete(subKeys.delete);
        }
      } else if (next === "view" && pair.view) {
        nextSet.add(pair.view);
        nextSet.delete(pair.edit);
        const subKeys = getSubKeys(pair);
        if (subKeys) {
          nextSet.delete(subKeys.create);
          nextSet.delete(subKeys.update);
          nextSet.delete(subKeys.delete);
        }
      } else {
        if (pair.view) nextSet.add(pair.view);
        nextSet.add(pair.edit);
        const subKeys = getSubKeys(pair);
        if (subKeys) {
          nextSet.delete(subKeys.create);
          nextSet.delete(subKeys.update);
          nextSet.delete(subKeys.delete);
        }
      }
      return nextSet;
    });

    setUserPermLevels(m => {
      const c = new Map(m);
      if (next === "none") c.delete(pairKey);
      else c.set(pairKey, next);
      return c;
    });
    toast.success("تم الحفظ");
  }, [isExecutive, selectedUser, userPermsDB]);

  // ── حساب المستوى من DB للأدوار ────────────────────────────────────────────
  const getRoleLevel = useCallback((role: string, pairKey: string): AccessLevel => {
    const cellKey = `${role}:${pairKey}`;
    if (permLevels.has(cellKey)) return permLevels.get(cellKey)!;
    const pair = PERMISSION_PAIRS[pairKey];
    if (!pair) return "none";
    const roleSet = rolePermsDB.get(role);
    if (!roleSet) return "none";
    if (roleSet.has(pair.edit)) return "edit";

    const subKeys = getSubKeys(pair);
    if (subKeys) {
      const hasCreate = roleSet.has(subKeys.create);
      const hasUpdate = roleSet.has(subKeys.update);
      const hasDelete = roleSet.has(subKeys.delete);
      if (hasCreate || hasUpdate || hasDelete) {
        return (hasCreate && hasUpdate && hasDelete) ? "edit" : "custom";
      }
    }

    if (pair.view && roleSet.has(pair.view)) return "view";
    return "none";
  }, [permLevels, rolePermsDB]);

  // ── تجميع حسب الفئة ──────────────────────────────────────────────────────
  const { projectGrouped, systemGrouped } = useMemo(() => {
    const proj: Record<string, { key: string; pair: PermPair }[]> = {};
    const sys: Record<string, { key: string; pair: PermPair }[]> = {};
    Object.entries(PERMISSION_PAIRS).forEach(([k, v]) => {
      const target = PROJECT_CATEGORIES.includes(v.category) ? proj : sys;
      (target[v.category] ??= []).push({ key: k, pair: v });
    });
    return { projectGrouped: proj, systemGrouped: sys };
  }, []);

  if (!isExecutive) return <Navigate to={fallbackRoute} replace />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Tabs defaultValue="roles" dir="rtl">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="roles">الدور</TabsTrigger>
            <TabsTrigger value="users">المستخدم</TabsTrigger>
          </TabsList>
          <Legend />
        </div>

        {/* ── تبويب الدور ─────────────────────────────────────────── */}
        <TabsContent value="roles" className="mt-6">
          <Tabs defaultValue="system" className="w-full" dir="rtl">
            <TabsList className="mb-6 bg-muted/50 w-full justify-start p-1 h-auto rounded-lg flex-wrap">
              <TabsTrigger value="system" className="py-2 px-6 flex-1 sm:flex-none">العامة</TabsTrigger>
              <TabsTrigger value="projects" className="py-2 px-6 flex-1 sm:flex-none">المشاريع</TabsTrigger>
            </TabsList>
            
            <TabsContent value="system" className="m-0">
              <div className="space-y-4">
                <PermTable
                  grouped={systemGrouped}
                  roles={ALL_ROLES}
                  getLevel={getRoleLevel}
                  onCycle={cycleRoleLevel}
                  getRolePermSet={(r) => rolePermsDB.get(r) || new Set()}
                  onToggleSubKey={toggleSubKey}
                />
              </div>
            </TabsContent>

            <TabsContent value="projects" className="m-0">
              <div className="space-y-4">
                <PermTable
                  grouped={projectGrouped}
                  roles={ALL_ROLES}
                  getLevel={getRoleLevel}
                  onCycle={cycleRoleLevel}
                  getRolePermSet={(r) => rolePermsDB.get(r) || new Set()}
                  onToggleSubKey={toggleSubKey}
                />
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── تبويب المستخدم ──────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <Select value={selectedUser} onValueChange={setSelectedUser} dir="rtl">
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستخدماً" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedUser && (
            <>
              <p className="text-xs text-muted-foreground px-1">
                الصلاحيات أدناه تُضاف فوق صلاحيات الدور — يمكنك منح أو تقييد صلاحيات استثنائية.
              </p>

              <Tabs defaultValue="system" className="w-full mt-4" dir="rtl">
                <TabsList className="mb-6 bg-muted/50 w-full justify-start p-1 h-auto rounded-lg flex-wrap">
                  <TabsTrigger value="system" className="py-2 px-6 flex-1 sm:flex-none">العامة</TabsTrigger>
                  <TabsTrigger value="projects" className="py-2 px-6 flex-1 sm:flex-none">المشاريع</TabsTrigger>
                </TabsList>

                {[
                  { grouped: systemGrouped, tabValue: "system" },
                  { grouped: projectGrouped, tabValue: "projects" },
                ].map(({ grouped, tabValue }) => (
                  <TabsContent key={tabValue} value={tabValue} className="space-y-3 m-0">
                    {Object.entries(grouped).map(([cat, items]) => (
                      <Card key={cat}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {CATEGORY_TRANSLATIONS[cat] || cat}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 p-4">
                          {items.map(({ key: pairKey, pair }) => {
                            const level = userPermLevels.get(pairKey) ?? "none";
                            return (
                              <div
                                key={pairKey}
                                className="flex items-center justify-between gap-3 rounded-lg border p-2.5 hover:bg-muted/10 transition-colors"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-medium text-sm">{pair.label}</span>
                                  {!pair.hasView && (
                                    <div className="text-[10px] text-muted-foreground opacity-60">(تعديل فقط)</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={
                                    level === "edit"
                                      ? "text-emerald-600 dark:text-emerald-400 font-semibold text-xs"
                                      : level === "custom"
                                      ? "text-amber-600 dark:text-amber-400 font-semibold text-xs"
                                      : level === "view"
                                      ? "text-blue-600 dark:text-blue-400 font-semibold text-xs"
                                      : "text-muted-foreground text-xs"
                                  }>
                                    {level === "edit" ? "تعديل كامل" : level === "custom" ? "تعديل مخصص" : level === "view" ? "مشاهدة" : "بلا صلاحية"}
                                  </span>
                                  <CycleBtn
                                    level={level}
                                    hasView={pair.hasView}
                                    onCycle={() => cycleUserLevel(pairKey, pair, level)}
                                    subKeys={getSubKeys(pair)}
                                    currentPermissions={userPermsDB}
                                    onToggleSubKey={(subKey, granted) => toggleUserSubKey(pairKey, pair, subKey, granted)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Permissions;
