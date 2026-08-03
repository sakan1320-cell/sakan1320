import { 
  LayoutDashboard, FolderKanban, ListChecks, Users, ScrollText, 
  UserCheck, ClipboardCheck, Bell, Wallet, BarChart3,
  Shield, UserPlus, FileText, Settings, GraduationCap, Calendar,
  MessageSquare, HelpCircle, FileEdit, Route, AlertTriangle, Activity, Briefcase
} from "lucide-react";

export interface NavItem {
  to: string;
  label_key: string;
  label_fallback: string;
  icon: any;
  permission?: string;
  end?: boolean;
}

export interface NavGroup {
  label_key: string;
  label_fallback: string;
  icon: any;
  items: NavItem[];
  permission?: string;
}

export const navigationConfig: NavGroup[] = [
  {
    label_key: "nav.workspace",
    label_fallback: "الرئيسية",
    icon: Activity,
    items: [
      { to: "/dashboard", label_key: "nav.dashboard", label_fallback: "لوحة التحكم", icon: Activity, end: true, permission: "view_dashboard" }
    ]
  },
  {
    label_key: "nav.communication",
    label_fallback: "التواصل",
    icon: MessageSquare,
    items: [
      { to: "/whatsapp-center", label_key: "nav.whatsappCenter", label_fallback: "التواصل", icon: MessageSquare, permission: "view_notifications" },
    ]
  },
  {
    label_key: "nav.projects",
    label_fallback: "المشاريع",
    icon: FolderKanban,
    items: [
      { to: "/projects", label_key: "nav.projects_list", label_fallback: "المشاريع", icon: FolderKanban, permission: "view_projects" },
    ]
  },
  {
    label_key: "nav.operations",
    label_fallback: "العمليات",
    icon: LayoutDashboard,
    items: [
      { to: "/training-library", label_key: "nav.trainingLibrary", label_fallback: "مكتبة الدورات", icon: GraduationCap, permission: "view_projects" },
    ]
  },
  {
    label_key: "nav.crm",
    label_fallback: "المستفيدون",
    icon: Users,
    items: [
      { to: "/participants", label_key: "nav.participants", label_fallback: "إدارة المستفيدين", icon: Users, end: true, permission: "view_participants" }
    ]
  },
  {
    label_key: "nav.staff",
    label_fallback: "الموظفون",
    icon: Briefcase,
    items: [
      { to: "/users", label_key: "nav.users", label_fallback: "الموظفون", icon: UserCheck, permission: "manage_users" },
    ]
  },
  {
    label_key: "nav.finance",
    label_fallback: "المالية",
    icon: Wallet,
    items: [
      { to: "/finance", label_key: "nav.finance_dashboard", label_fallback: "المالية", icon: Wallet, permission: "view_finance" },
    ]
  },
  {
    label_key: "nav.reports",
    label_fallback: "التقارير",
    icon: BarChart3,
    items: [
      { to: "/reports", label_key: "nav.reports_dashboard", label_fallback: "التقارير", icon: BarChart3, permission: "view_reports" },
    ]
  },
  {
    label_key: "nav.system",
    label_fallback: "الإعدادات العامة",
    icon: Settings,
    items: [
      { to: "/settings", label_key: "nav.settings", label_fallback: "الإعدادات العامة", icon: Settings, permission: "manage_settings" },
    ]
  }
];
