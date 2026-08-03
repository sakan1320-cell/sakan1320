import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const AttendanceLayout = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const tabs = [
    { to: "/attendance", label: t("attendance.tabEntry"), end: true },
    { to: "/attendance/report", label: t("attendance.tabReport"), end: false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border">
        {tabs.map((tab) => {
          const active = tab.end ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
            </NavLink>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
};

export default AttendanceLayout;
