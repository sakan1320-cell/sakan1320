import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { 
  LayoutDashboard, 
  FolderKanban, 
  ListChecks, 
  Calendar,
  Settings2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Users,
  Activity
} from "lucide-react";

export function FloatingDock() {
  const { t } = useTranslation();
  const { isSystemAdmin } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Define dock items
  const dockItems = [
    { name: "الرئيسية", icon: Activity, path: "/dashboard", roles: ["all"] },
    { name: "المشاريع", icon: FolderKanban, path: "/projects", roles: ["all"] },
    { name: "المستفيدون", icon: Users, path: "/participants", roles: ["all"] },
    { name: "العمليات", icon: LayoutDashboard, path: "/training-library", roles: ["admin"] },
    { name: "التفضيلات والمظهر", icon: Settings2, path: "/preferences", roles: ["all"] },
  ];

  // Filter items based on role
  const visibleItems = dockItems.filter(item => {
    if (item.roles.includes("all")) return true;
    if (item.roles.includes("admin") && isSystemAdmin) return true;
    return false;
  });

  return (
    <>
      <div 
        className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out flex flex-col items-center ${isCollapsed ? 'bottom-[-60px]' : 'bottom-4'}`}
      >
        {/* Toggle Collapse Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-card border border-border shadow-md rounded-t-xl px-4 py-1 flex items-center justify-center hover:bg-muted transition-colors z-10"
          title={isCollapsed ? "إظهار شريط التنقل" : "إخفاء شريط التنقل"}
        >
          {isCollapsed ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Dock Container */}
        <div className="bg-background/60 border border-border/30 shadow-sm p-1.5 rounded-[18px] flex items-center gap-1 relative z-20">
          {visibleItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = item.path && location.pathname.startsWith(item.path);

            if (item.action) {
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className="group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 hover:bg-primary/10 hover:scale-110"
                  title={item.name}
                >
                  <Icon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              );
            }

            return (
              <Link
                key={index}
                to={item.path!}
                className={`group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 hover:scale-110 ${isActive ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                title={item.name}
              >
                <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </div>
      </div>

    </>
  );
}
