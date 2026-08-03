-- Create Project Groups if not exists
CREATE TABLE IF NOT EXISTS public.project_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.project_branches(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on groups
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_project_groups" ON public.project_groups;
CREATE POLICY "admin_all_project_groups" ON public.project_groups 
FOR ALL USING (public.is_system_admin(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['executive', 'assistant']::public.app_role[]));

DROP POLICY IF EXISTS "members_view_project_groups" ON public.project_groups;
CREATE POLICY "members_view_project_groups" ON public.project_groups 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = project_groups.project_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_groups.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_branches b WHERE b.id = project_groups.branch_id AND b.branch_manager_id = auth.uid())
);

-- Modify project_members
-- Drop old constraint safely
ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_project_id_branch_id_user_id_key;

-- Add new columns safely
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.project_groups(id) ON DELETE CASCADE;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS project_role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS responsibilities TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

-- Ensure a user doesn't have the EXACT same role in the exact same scope multiple times
ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_assignment_unique;
ALTER TABLE public.project_members ADD CONSTRAINT project_members_assignment_unique 
UNIQUE NULLS NOT DISTINCT (project_id, branch_id, group_id, user_id, project_role);

-- Create a helper function for checking responsibilities
CREATE OR REPLACE FUNCTION public.has_project_responsibility(_user_id UUID, _project_id UUID, _responsibility TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE user_id = _user_id 
    AND project_id = _project_id 
    AND _responsibility = ANY(responsibilities)
  );
$$;

-- Create a helper function for checking project role
CREATE OR REPLACE FUNCTION public.has_project_role(_user_id UUID, _project_id UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE user_id = _user_id 
    AND project_id = _project_id 
    AND project_role = _role
  );
$$;
