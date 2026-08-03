-- Create participant_projects junction table for many-to-many relationship
-- between participants and projects.
-- joined_at is set only on creation (default now()), never updated.

CREATE TABLE IF NOT EXISTS public.participant_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role text,
  joined_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (participant_id, project_id)
);

-- Enable RLS
ALTER TABLE public.participant_projects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read participant_projects
CREATE POLICY "Authenticated users can read participant_projects"
  ON public.participant_projects FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert for authorized roles (system_admin, executive, assistant, project_manager, branch_manager)
CREATE POLICY "Authorized roles can insert participant_projects"
  ON public.participant_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('system_admin', 'executive', 'assistant', 'project_manager', 'branch_manager')
    )
  );

-- Allow update for authorized roles
CREATE POLICY "Authorized roles can update participant_projects"
  ON public.participant_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('system_admin', 'executive', 'assistant', 'project_manager', 'branch_manager')
    )
  );

-- Allow delete for authorized roles
CREATE POLICY "Authorized roles can delete participant_projects"
  ON public.participant_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('system_admin', 'executive', 'assistant', 'project_manager', 'branch_manager')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_participant_projects_participant_id ON public.participant_projects(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_projects_project_id ON public.participant_projects(project_id);

-- Migrate existing project_id relationships into participant_projects
-- This ensures existing data is preserved
INSERT INTO public.participant_projects (participant_id, project_id, joined_at)
SELECT id, project_id, created_at
FROM public.participants
WHERE project_id IS NOT NULL
ON CONFLICT (participant_id, project_id) DO NOTHING;
