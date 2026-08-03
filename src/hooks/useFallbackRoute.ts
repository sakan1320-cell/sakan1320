import { useAuth } from "@/contexts/AuthContext";
import { navigationConfig } from "@/lib/navigation";
import { useProjectApps } from "@/hooks/useProjectApps";

export const useFallbackRoute = () => {
  const { hasPermission, isSystemAdmin, hasRole } = useAuth();
  const { globalDefaults } = useProjectApps(null);

  const getFallbackRoute = () => {
    // Check if they are explicitly acting as a participant
    const activeRole = localStorage.getItem("last_active_role");
    const isActingAsParticipant = activeRole === "participant" || activeRole === "guardian";

    if (isActingAsParticipant || (hasRole("participant") && !hasRole("executive") && !hasRole("project_manager") && !hasRole("employee") && !isSystemAdmin)) {
      return "/portal";
    }

    for (const group of navigationConfig) {
      for (const item of group.items) {
        if (item.to === "/settings/registration-structure" && !globalDefaults.dynamicRegistration) continue;
        if (item.to === "/courses" && !globalDefaults.gamification) continue;
        
        if (isSystemAdmin) return item.to;
        if (!item.permission || hasPermission(item.permission)) {
          return item.to;
        }
      }
    }
    // Fallback if no permissions matched
    return "/";
  };

  return getFallbackRoute();
};
