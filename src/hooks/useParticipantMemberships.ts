import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Membership {
  id: string;
  project_id: string;
  branch_id: string | null;
  status: "active" | "archived" | "transferred" | "waitlisted";
  enrollment_source: string;
  enrolled_at: string;
  archived_at: string | null;
  project_name?: string;
  branch_name?: string;
}

export const useParticipantMemberships = (participantId?: string) => {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemberships = async () => {
    if (!participantId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const { data, error } = await supabase
      .from("participant_project_memberships")
      .select(`
        id, project_id, branch_id, status, enrollment_source, enrolled_at, archived_at,
        projects ( name_ar, name_en ),
        project_branches ( name_ar, name_en )
      `)
      .eq("participant_id", participantId)
      .order("enrolled_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setMemberships((data || []).map((m: any) => ({
        id: m.id,
        project_id: m.project_id,
        branch_id: m.branch_id,
        status: m.status,
        enrollment_source: m.enrollment_source,
        enrolled_at: m.enrolled_at,
        archived_at: m.archived_at,
        project_name: m.projects?.name_ar,
        branch_name: m.project_branches?.name_ar,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMemberships();
  }, [participantId]);

  const updateStatus = async (membershipId: string, status: Membership["status"]) => {
    const { error } = await supabase
      .from("participant_project_memberships")
      .update({ 
        status,
        ...(status === "archived" ? { archived_at: new Date().toISOString() } : { archived_at: null })
      } as any)
      .eq("id", membershipId);

    if (error) {
      toast.error(error.message);
      return false;
    }
    await fetchMemberships();
    return true;
  };

  return {
    memberships,
    loading,
    refresh: fetchMemberships,
    updateStatus,
  };
};
