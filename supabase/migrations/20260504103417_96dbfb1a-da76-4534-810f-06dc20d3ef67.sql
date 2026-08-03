
-- Realtime: only admins can subscribe to any realtime channel (notifications RLS already restricts row access to admins)
DROP POLICY IF EXISTS "realtime_admin_only_select" ON realtime.messages;
CREATE POLICY "realtime_admin_only_select" ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[]));

-- Revoke EXECUTE on trigger functions from anon/public (they only run via triggers, not as RPCs)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_attendance_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_lms_completion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_duplicate_participant() FROM PUBLIC, anon, authenticated;
