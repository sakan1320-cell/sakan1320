
ALTER VIEW public.project_summary_view SET (security_invoker = true);
ALTER VIEW public.participant_summary_view SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.add_participant_points(UUID, INTEGER, TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_participant_status(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_project_health(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_participant_points(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_participant_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_project_health(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_participant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.participants
             WHERE project_id = NEW.project_id
               AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
               AND (national_id = NEW.national_id OR phone = NEW.phone)) THEN
    RAISE EXCEPTION 'duplicate_participant: رقم الهوية أو الجوال مكرر داخل نفس المشروع';
  END IF;
  RETURN NEW;
END$$;
