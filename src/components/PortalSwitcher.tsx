import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const roleNames: Record<AppRole, string> = {
  system_admin: "مدير نظام",
  board: "مجلس الإدارة",
  executive: "إدارة تنفيذية",
  assistant: "مساعد إداري",
  project_manager: "مدير مشروع",
  branch_manager: "مدير فرع",
  employee: "موظف",
  contractor: "متعاقد",
  participant: "مشارك",
  guardian: "ولي أمر"
};
interface PortalSwitcherProps {
  children?: React.ReactNode;
}

export const PortalSwitcher = ({ children }: PortalSwitcherProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { roles, signOut, accessLevel } = useAuth();
  
  const mainRole = roles && roles.length > 0 ? roles[0] : "employee";

  // Display workspace type instead of role if applicable
  const displayRole = accessLevel === 'project' 
    ? "عضو مشروع" 
    : accessLevel === 'company' 
      ? "موظف إدارة" 
      : (roleNames[mainRole] || mainRole);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <Button size="sm" variant="outline" className="h-8 gap-2 rounded-full border-primary/20 hover:bg-primary/5 bg-background">
            <span className="text-xs font-bold text-primary">
              {displayRole}
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
        <div className="flex items-center justify-center gap-2 bg-secondary/30 p-1.5 rounded-md">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background shadow-sm rounded-full" 
            onClick={() => navigate("/")}
            title={t("common.publicPage", "الصفحة العامة")}
          >
            <Home className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background shadow-sm rounded-full" 
            onClick={async () => {
              await signOut();
              navigate("/auth");
            }}
            title={t("common.logout", "تسجيل الخروج")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
