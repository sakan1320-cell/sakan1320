import { supabase } from "@/integrations/supabase/client";

export const logAudit = async (
  action: string,
  entity_type: string,
  entity_id?: string,
  metadata?: Record<string, unknown>
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_log").insert([{
    user_id: user.id,
    action,
    entity_type,
    entity_id: entity_id ?? undefined,
    metadata: (metadata as never) ?? undefined,
  }]);
};
