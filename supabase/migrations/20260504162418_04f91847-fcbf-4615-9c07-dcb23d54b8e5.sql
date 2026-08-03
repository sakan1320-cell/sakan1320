
-- Helper
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'system_admin'::public.app_role) $$;

-- Override has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'system_admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'system_admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_system_admin(_user_id)
    OR coalesce((select granted from public.user_permissions where user_id = _user_id and permission_key = _permission_key), false)
    OR EXISTS (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
      where ur.user_id = _user_id and rp.permission_key = _permission_key
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_system_admin(_user_id)
    OR public.has_any_role(_user_id, ARRAY['executive','assistant','board']::public.app_role[])
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.manager_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_branches b WHERE b.project_id = _project_id AND b.branch_manager_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_system_admin(_user_id)
    OR public.has_any_role(_user_id, ARRAY['executive','assistant','board']::public.app_role[])
    OR EXISTS (SELECT 1 FROM public.project_branches b JOIN public.projects p ON p.id = b.project_id
               WHERE b.id = _branch_id AND (b.branch_manager_id = _user_id OR p.manager_id = _user_id))
    OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.branch_id = _branch_id AND m.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_guardian(_user_id uuid, _guardian_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_system_admin(_user_id)
    OR public.has_any_role(_user_id, ARRAY['executive','assistant']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.participants pa
      JOIN public.projects p ON p.id = pa.project_id
      LEFT JOIN public.project_branches b ON b.id = pa.branch_id
      WHERE pa.guardian_id = _guardian_id
        AND (p.manager_id = _user_id OR b.branch_manager_id = _user_id)
    );
$$;

-- Full-access policies for system_admin on critical admin tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','user_roles','user_permissions','role_permissions','permissions',
    'app_settings','site_content','audit_log','automation_rules','automation_runs',
    'notification_templates','notifications','project_templates','task_templates',
    'projects','project_branches','project_members','tasks','task_comments',
    'participants','participant_points_log','guardians','attendance',
    'finance_transactions','finance_attachments','staff_registration_requests',
    'lms_courses','lms_lessons','lms_quizzes','lms_questions','lms_quiz_attempts',
    'lms_enrollments','lms_certificates'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS system_admin_full_access ON public.%I', t);
    EXECUTE format('CREATE POLICY system_admin_full_access ON public.%I FOR ALL TO authenticated USING (public.is_system_admin(auth.uid())) WITH CHECK (public.is_system_admin(auth.uid()))', t);
  END LOOP;
END $$;

-- Protect: prevent deleting last system_admin & restrict assignment
CREATE OR REPLACE FUNCTION public.protect_system_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'system_admin'::public.app_role THEN
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'system_admin'::public.app_role) <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last system_admin';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.role = 'system_admin'::public.app_role THEN
    IF NOT public.is_system_admin(auth.uid())
       AND EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'system_admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only system_admin can grant system_admin role';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_system_admin ON public.user_roles;
CREATE TRIGGER trg_protect_system_admin
BEFORE INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_system_admin();
