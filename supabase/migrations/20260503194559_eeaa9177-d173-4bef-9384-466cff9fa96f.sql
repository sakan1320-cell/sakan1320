
-- Project mode enum
DO $$ BEGIN
  CREATE TYPE public.project_mode AS ENUM ('external','internal','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_mode public.project_mode NOT NULL DEFAULT 'external';

-- Participants: link to staff user, points
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_user_id uuid,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_participants_staff_user ON public.participants(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_mode ON public.projects(project_mode);

-- Points history (manual adjustments with reason)
CREATE TABLE IF NOT EXISTS public.participant_points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_points_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "points_log_select" ON public.participant_points_log;
CREATE POLICY "points_log_select" ON public.participant_points_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id AND public.can_access_project(auth.uid(), p.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id AND (p.auth_user_id = auth.uid() OR p.staff_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "points_log_insert" ON public.participant_points_log;
CREATE POLICY "points_log_insert" ON public.participant_points_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id AND public.can_access_project(auth.uid(), p.project_id)
    )
  );

-- Allow staff who are linked as participants to view their participant record
DROP POLICY IF EXISTS participants_select ON public.participants;
CREATE POLICY participants_select ON public.participants
  FOR SELECT USING (
    public.can_access_project(auth.uid(), project_id)
    OR auth_user_id = auth.uid()
    OR staff_user_id = auth.uid()
  );
