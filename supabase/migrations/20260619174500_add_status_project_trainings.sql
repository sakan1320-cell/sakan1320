-- Add is_published column to project_trainings to support draft mode for PMs
ALTER TABLE public.project_trainings ADD COLUMN is_published BOOLEAN DEFAULT false NOT NULL;

-- Update RLS policy to hide unpublished courses from participants
DROP POLICY IF EXISTS "Users can view project trainings if they have access to the project" ON public.project_trainings;

CREATE POLICY "Users can view project trainings if they have access to the project"
ON public.project_trainings FOR SELECT
USING (
  (
    is_published = true AND EXISTS (
      SELECT 1 FROM public.participant_project_memberships ppm 
      WHERE ppm.project_id = project_trainings.project_id 
      AND ppm.participant_id IN (SELECT id FROM public.participants WHERE auth_user_id = auth.uid())
    )
  )
  OR public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant', 'project_manager'])
);
