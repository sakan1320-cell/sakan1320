import { useState, useEffect, useCallback } from "react";

export type AppFeatures = {
  dynamicRegistration: boolean;
  gamification: boolean;
  autoInsights: boolean;
  whatsapp: boolean; // Just for UI tracking
  cloudStorage: boolean; // Just for UI tracking
};

const DEFAULT_APPS: AppFeatures = {
  dynamicRegistration: true,
  gamification: true,
  autoInsights: true,
  whatsapp: false,
  cloudStorage: false,
};

export function useProjectApps(projectId?: string | null) {
  const getGlobalDefaults = (): AppFeatures => {
    try {
      const stored = localStorage.getItem("global_app_defaults");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to parse global_app_defaults:", e);
    }
    return DEFAULT_APPS;
  };

  const [globalDefaults, setGlobalDefaultsState] = useState<AppFeatures>(getGlobalDefaults());
  const [projectApps, setProjectAppsState] = useState<AppFeatures>(getGlobalDefaults());

  // Update Global Defaults
  const updateGlobalDefaults = useCallback((newDefaults: Partial<AppFeatures>) => {
    setGlobalDefaultsState(prev => {
      const updated = { ...prev, ...newDefaults };
      localStorage.setItem("global_app_defaults", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("project-apps-changed", { detail: { projectId: null } }));
      return updated;
    });
  }, []);

  // Sync Project Apps
  useEffect(() => {
    const syncApps = () => {
      // Reload defaults
      const defaults = getGlobalDefaults();
      setGlobalDefaultsState(defaults);

      if (!projectId) {
        setProjectAppsState(defaults);
        return;
      }

      const projectKey = `project_apps_${projectId}`;
      const stored = localStorage.getItem(projectKey);
      
      if (stored) {
        try {
          setProjectAppsState(JSON.parse(stored));
        } catch (e) {
          setProjectAppsState(defaults);
        }
      } else {
        // INHERIT FROM GLOBAL
        setProjectAppsState(defaults);
        localStorage.setItem(projectKey, JSON.stringify(defaults));
      }
    };

    syncApps();

    const handleSyncEvent = (e: Event) => {
      const ev = e as CustomEvent;
      // If the change belongs to this project context, or if it was a global default change
      if (!ev.detail || ev.detail.projectId === projectId || ev.detail.projectId === null) {
        syncApps();
      }
    };

    window.addEventListener("project-apps-changed", handleSyncEvent);
    return () => {
      window.removeEventListener("project-apps-changed", handleSyncEvent);
    };
  }, [projectId]);

  // Update Project Specific Apps
  const updateProjectApps = useCallback((newApps: Partial<AppFeatures>) => {
    if (!projectId) return;
    
    setProjectAppsState(prev => {
      const updated = { ...prev, ...newApps };
      localStorage.setItem(`project_apps_${projectId}`, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("project-apps-changed", { detail: { projectId } }));
      return updated;
    });
  }, [projectId]);

  return {
    globalDefaults,
    updateGlobalDefaults,
    projectApps: projectId ? projectApps : globalDefaults,
    updateProjectApps,
    isProjectContext: !!projectId
  };
}
