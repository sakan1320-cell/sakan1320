-- Migration: Workspace Isolation (Company vs Project Memberships)

-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Create Company Members Table
CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'employee',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- 3. Add company_id to projects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='company_id') THEN
        ALTER TABLE public.projects ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create Project Members Table
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 5. Helper Functions for Fast RLS Checks
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid() AND company_id = _company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = auth.uid() AND project_id = _project_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_access_project(_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  _company_id UUID;
BEGIN
  -- If direct project member
  IF public.is_project_member(_project_id) THEN
    RETURN TRUE;
  END IF;

  -- Or if company member of the project's company
  SELECT company_id INTO _company_id FROM public.projects WHERE id = _project_id;
  IF _company_id IS NOT NULL AND public.is_company_member(_company_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'system_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Apply Default Policies

-- Companies: Visible to members or system admins
CREATE POLICY "Companies access policy" 
ON public.companies FOR ALL 
USING ( public.is_company_member(id) OR public.is_system_admin() );

-- Company Members: Visible to company members or system admins
CREATE POLICY "Company members access policy" 
ON public.company_members FOR ALL 
USING ( public.is_company_member(company_id) OR public.is_system_admin() );

-- Project Members: Visible to users who can access the project or system admins
CREATE POLICY "Project members access policy" 
ON public.project_members FOR ALL 
USING ( public.can_access_project(project_id) OR public.is_system_admin() );

-- Projects: Overwrite or create policy
DROP POLICY IF EXISTS "Projects access policy" ON public.projects;
CREATE POLICY "Projects access policy" 
ON public.projects FOR ALL 
USING ( public.can_access_project(id) OR public.is_system_admin() );

-- Insert a default company if none exists so users can start adding people to "management"
INSERT INTO public.companies (name) 
SELECT 'الإدارة الرئيسية (HQ)'
WHERE NOT EXISTS (SELECT 1 FROM public.companies);
