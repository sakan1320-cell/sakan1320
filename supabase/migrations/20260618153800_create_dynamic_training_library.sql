-- ==========================================
-- Migration: Create Dynamic Training Library
-- ==========================================

-- 1. Create central Training Library table
CREATE TABLE IF NOT EXISTS public.training_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_ar TEXT NOT NULL,
    title_en TEXT,
    description TEXT,
    cover_url TEXT,
    structure_jsonb JSONB DEFAULT '[]'::jsonb NOT NULL,
    is_published BOOLEAN DEFAULT false NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create Project Trainings table (Instances of templates injected into projects)
CREATE TABLE IF NOT EXISTS public.project_trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    library_id UUID REFERENCES public.training_library(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    structure_jsonb JSONB DEFAULT '[]'::jsonb NOT NULL,
    target_groups JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of group_ids. If empty, means global.
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create User Training Progress table (Tracks progression through strict prerequisites and assignments)
CREATE TABLE IF NOT EXISTS public.user_training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_training_id UUID NOT NULL REFERENCES public.project_trainings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_progress_jsonb JSONB DEFAULT '{}'::jsonb NOT NULL,
    status TEXT DEFAULT 'in_progress' NOT NULL CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(project_training_id, user_id)
);

-- Enable RLS
ALTER TABLE public.training_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_progress ENABLE ROW LEVEL SECURITY;

-- Setup Admin Policies for training_library
CREATE POLICY "Everyone can view published templates"
ON public.training_library FOR SELECT
USING (is_published = true OR public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant']));

CREATE POLICY "Admins can manage training_library"
ON public.training_library FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant']));

-- Setup Policies for project_trainings
CREATE POLICY "Users can view project trainings if they have access to the project"
ON public.project_trainings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.participant_project_memberships ppm 
    WHERE ppm.project_id = project_trainings.project_id 
    AND ppm.participant_id IN (SELECT id FROM public.participants WHERE auth_user_id = auth.uid())
  )
  OR public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant', 'project_manager'])
);

CREATE POLICY "Admins and PMs can manage project trainings"
ON public.project_trainings FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant', 'project_manager']));

-- Setup Policies for user_training_progress
CREATE POLICY "Users can view and manage their own progress"
ON public.user_training_progress FOR ALL
USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant', 'project_manager']));

-- Updated At Triggers
CREATE TRIGGER update_training_library_timestamp
    BEFORE UPDATE ON public.training_library
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_project_trainings_timestamp
    BEFORE UPDATE ON public.project_trainings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_user_training_progress_timestamp
    BEFORE UPDATE ON public.user_training_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
