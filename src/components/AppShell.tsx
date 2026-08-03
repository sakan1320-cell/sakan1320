import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, FolderKanban, ListChecks, Users, ScrollText, LogOut,
  User as UserIcon, Menu, UserCheck, ClipboardCheck, Bell, Wallet, BarChart3,
  Shield, UserPlus, FileText, Settings as SettingsIcon, ChevronDown, ChevronLeft, ChevronRight, Briefcase, GraduationCap, Calendar as CalendarIcon, Home,
  ArrowLeft, ArrowRight
} from "lucide-react";
import { getDisplayName } from "@/lib/utils/display";
import logo from "@/assets/logo.png";
import { PortalSwitcher } from "./PortalSwitcher";
import { FloatingDock } from "./FloatingDock";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { navigationConfig } from "@/lib/navigation";
import { HeaderActions } from "@/components/layout/HeaderActions";

import { useProjectApps } from "@/hooks/useProjectApps";

export const AppShell = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut, hasPermission, isSystemAdmin, accessLevel } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { globalDefaults } = useProjectApps(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const handleScroll = useCallback((currentScrollY: number) => {
    if (currentScrollY > 10 && currentScrollY > lastScrollY.current) {
      setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY.current - 2 || currentScrollY <= 10) {
      setIsHeaderVisible(true);
    }
    lastScrollY.current = currentScrollY;
  }, []);

  const handleContainerScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    handleScroll(scrollContainerRef.current.scrollTop);
  }, [handleScroll]);

  useEffect(() => {
    const handleWindowScroll = () => {
      handleScroll(window.scrollY);
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [handleScroll]);

  const isRtl = i18n.language === "ar";
  
  // Detect if on project detail page (e.g. /projects/uuid)
  const isProjectDetail = location.pathname.startsWith("/projects/") && location.pathname.split("/").filter(Boolean).length === 2;

  // Unified Permission-driven Navigation Builder
  const domains = navigationConfig.map(group => {
    const filteredItems = group.items.filter(item => {
      // Hide pages dynamically if their associated app center module is disabled
      if (item.to === "/settings/registration-structure" && !globalDefaults.dynamicRegistration) return false;
      if (item.to === "/courses" && !globalDefaults.gamification) return false;

      if (isSystemAdmin) return true;

      // Workspace Isolation: Restrict project-only users
      if (accessLevel === "project") {
        const allowedProjectRoutes = ["/dashboard", "/projects", "/tasks", "/calendar"];
        if (!allowedProjectRoutes.includes(item.to)) return false;
      } else if (accessLevel === "none") {
        return false;
      }

      if (!item.permission) return true;
      return hasPermission(item.permission);
    });

    return {
      ...group,
      items: filteredItems,
      show: filteredItems.length > 0 && (isSystemAdmin || !group.permission || hasPermission(group.permission))
    };
  }).filter(d => d.show);



  const NavItem = ({ to, label_key, label_fallback, icon: Icon, end }: any) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-bold"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{String(t(label_key, label_fallback))}</span>
    </NavLink>
  );



  const IslandSidebar = () => (
    <div 
      className={cn(
        "flex fixed start-0 top-[70px] bottom-4 z-40 transition-all duration-500 ease-in-out items-center justify-start pointer-events-none",
        sidebarCollapsed ? "-translate-x-[72px] rtl:translate-x-[72px]" : "translate-x-0"
      )}
    >
      <div className="bg-background/60 border border-border/30 shadow-sm p-2 rounded-[20px] flex flex-col gap-2 relative pointer-events-auto max-h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {domains.map((group) => {
            const Icon = group.icon;
            const isActive = group.items.some(item => location.pathname.startsWith(item.to));
            
            if (group.items.length === 1) {
              const item = group.items[0];
              return (
                <NavLink
                  key={group.label_key}
                  to={item.to}
                  title={String(t(item.label_key, item.label_fallback))}
                  className={cn(
                    "group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 hover:scale-110 shrink-0",
                    isActive ? "bg-primary text-primary-foreground shadow-md font-bold" : "text-foreground hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </NavLink>
              );
            }

            return (
              <Popover key={group.label_key}>
                <PopoverTrigger asChild>
                  <button
                    title={String(t(group.label_key, group.label_fallback))}
                    className={cn(
                      "group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 hover:scale-110 shrink-0",
                      isActive ? "bg-primary text-primary-foreground shadow-md font-bold" : "text-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  side={isRtl ? "left" : "right"} 
                  align="start" 
                  sideOffset={16}
                  className="w-56 p-2 shadow-xl rounded-xl border bg-card/95 z-50"
                >
                  <div className="mb-2 px-2 pb-2 border-b text-xs font-bold text-foreground/80 uppercase tracking-wider">
                    {t(group.label_key, group.label_fallback)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.items.map(item => (
                      <NavItem key={item.to} {...item} />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}

          <div className="w-6 h-px bg-border/50 my-0.5 shrink-0" />

          <NavLink
            to="/profile"
            title={String(i18n.language === "ar"
              ? profile?.display_name_ar || profile?.full_name || profile?.username || user?.email
              : profile?.display_name_en || profile?.full_name || profile?.username || user?.email)}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-300 hover:scale-110 shrink-0",
                isActive ? "bg-primary text-primary-foreground shadow-md font-bold" : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )
            }
          >
            <UserIcon className="h-[18px] w-[18px]" />
          </NavLink>

        </div>

        {/* Toggle Collapse Tab Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="bg-background/60 border border-border/30 border-s-0 shadow-sm rounded-e-2xl py-4 px-2 flex items-center justify-center hover:brightness-110 transition-all z-10 shrink-0 pointer-events-auto"
          title={sidebarCollapsed ? t("common.expand", "إظهار") : t("common.collapse", "إخفاء")}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
          )}
        </button>
      </div>
  );

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const checkNavigation = () => {
      const nav = (window as any).navigation;
      if (nav) {
        setCanGoBack(nav.canGoBack);
        setCanGoForward(nav.canGoForward);
      } else {
        const idx = window.history.state?.idx;
        setCanGoBack(typeof idx === 'number' && idx > 0);
        setCanGoForward(false);
      }
    };
    checkNavigation();
    window.addEventListener('popstate', checkNavigation);
    return () => window.removeEventListener('popstate', checkNavigation);
  }, [location]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Global Top Bar - Floating Style */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 flex h-14 shrink-0 items-center justify-between gap-3 px-4 lg:px-6 pointer-events-none transition-transform duration-500 ease-in-out",
        isHeaderVisible ? "translate-y-0" : "-translate-y-[150%]"
      )}>
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Logo & Portal Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <PortalSwitcher>
              <button className="flex h-11 w-11 items-center justify-center rounded-full bg-background/60 shadow-sm border border-border/30 p-1.5 transition-all duration-300 hover:scale-110 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <img src={logo} alt={t("app.name")} className="h-full w-full object-contain rounded-full mix-blend-multiply dark:mix-blend-screen" />
              </button>
            </PortalSwitcher>
          </div>

        </div>

        {/* Dynamic Portal Target for Page Titles */}
        <div id="header-center-portal" className="flex-1 flex items-center justify-center lg:justify-start lg:ms-4 gap-2 overflow-hidden pointer-events-auto" />
        
        {/* Centered Browser Navigation Controls */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background/60 shadow-sm border border-border/30 rounded-full px-2 py-1 pointer-events-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-7 w-7 hover:bg-muted rounded-full transition-colors", !canGoBack && "opacity-50 pointer-events-none")} 
            onClick={() => navigate(-1)} 
            title={t("common.back", "رجوع")}
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-7 w-7 hover:bg-muted rounded-full transition-colors", !canGoForward && "opacity-50 pointer-events-none")} 
            onClick={() => navigate(1)} 
            title={t("common.forward", "للأمام")}
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
        
        {/* Right Header Actions (Unified Notifications) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 pointer-events-auto bg-background/60 shadow-sm border border-border/30 rounded-full px-2 py-1">
          <HeaderActions />
        </div>
      </header>

      {/* Main Content Area (Sidebar + Main Content) */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Island sidebar */}
        {!isProjectDetail && <IslandSidebar />}

        {/* Page Content */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background transition-all duration-500"
        >
          <main className={cn(
            "flex-1 py-4 lg:py-6 animate-fade-in pb-24 transition-all duration-500",
            !isProjectDetail ? "px-4 lg:px-6" : "px-4 lg:px-10 xl:px-16"
          )}>
            <Outlet />
          </main>
        </div>
      </div>

      <FloatingDock />
    </div>
  );
};
