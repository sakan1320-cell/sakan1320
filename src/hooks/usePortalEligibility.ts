import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/contexts/AuthContext";

const STAFF_ROLES: AppRole[] = [
  "system_admin", "board", "executive", "assistant",
  "project_manager", "branch_manager", "employee", "contractor",
];

export const isStaffRoles = (roles: string[]) =>
  roles.some((r) => (STAFF_ROLES as string[]).includes(r));

export const resolveHomeRoute = ({
  isStaff,
  isParticipant,
  lastPortal,
}: { isStaff: boolean; isParticipant: boolean; lastPortal?: string | null }) => {
  if (isStaff && isParticipant) {
    if (lastPortal === "staff") return "/dashboard";
    if (lastPortal === "participant") return "/portal";
    return "/dashboard"; // Default to dashboard for dual roles if no preference
  }
  if (isStaff) return "/dashboard";
  if (isParticipant) return "/portal";
  return "/auth";
};

export const fetchHasParticipantRecord = async (userId: string) => {
  const { data } = await supabase
    .from("participants")
    .select("id")
    .eq("auth_user_id", userId)
    .limit(1);
  return (data ?? []).length > 0;
};

export const usePortalEligibility = () => {
  const { user, roles, loading } = useAuth();
  const [isParticipant, setIsParticipant] = useState(false);
  const [ready, setReady] = useState(false);

  const isStaff = isStaffRoles(roles);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) { setIsParticipant(false); setReady(true); return; }
    (async () => {
      const has = await fetchHasParticipantRecord(user.id);
      if (!cancelled) { setIsParticipant(has); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [user, loading, roles.join(",")]);

  const setLastPortal = useCallback((portal: "staff" | "participant") => {
    localStorage.setItem("last_active_portal", portal);
  }, []);

  const getLastPortal = useCallback(() => {
    return localStorage.getItem("last_active_portal");
  }, []);

  return { 
    isStaff, 
    isParticipant, 
    ready: ready && !loading,
    setLastPortal,
    getLastPortal,
    getHomeRoute: () => resolveHomeRoute({ isStaff, isParticipant, lastPortal: getLastPortal() })
  };
};
