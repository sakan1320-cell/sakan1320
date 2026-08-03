-- Participant creation and learning portal upgrade.
-- Idempotent by design; safe to run on databases that already contain older enterprise migrations.

-- 1. Participants can exist without a direct project.
ALTER TABLE public.participants
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_learning_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weekly_goal_minutes INTEGER NOT NULL DEFAULT 120;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_status') THEN
    ALTER TYPE public.participant_status ADD VALUE IF NOT EXISTS 'archived';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS participants_username_unique
  ON public.participants (username)
  WHERE username IS NOT NULL AND username <> '';

DROP INDEX IF EXISTS idx_participants_project;
CREATE INDEX IF NOT EXISTS idx_participants_project ON public.participants(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participants_auth_user ON public.participants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_participants_username ON public.participants(username);

-- 2. RLS must not treat missing project_id as an error.
DROP POLICY IF EXISTS participants_select ON public.participants;
CREATE POLICY participants_select ON public.participants
  FOR SELECT USING (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
    OR auth_user_id = auth.uid()
    OR staff_user_id = auth.uid()
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
  );

DROP POLICY IF EXISTS participants_insert ON public.participants;
CREATE POLICY participants_insert ON public.participants
  FOR INSERT WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
  );

DROP POLICY IF EXISTS participants_update ON public.participants;
CREATE POLICY participants_update ON public.participants
  FOR UPDATE USING (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
    OR auth_user_id = auth.uid()
    OR staff_user_id = auth.uid()
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
    OR auth_user_id = auth.uid()
    OR staff_user_id = auth.uid()
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
  );

DROP POLICY IF EXISTS participants_delete ON public.participants;
CREATE POLICY participants_delete ON public.participants
  FOR DELETE USING (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = participants.project_id AND p.manager_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "points_log_select" ON public.participant_points_log;
CREATE POLICY "points_log_select" ON public.participant_points_log
  FOR SELECT USING (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id
        AND (p.auth_user_id = auth.uid() OR p.staff_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id
        AND p.project_id IS NOT NULL
        AND public.can_access_project(auth.uid(), p.project_id)
    )
  );

DROP POLICY IF EXISTS "points_log_insert" ON public.participant_points_log;
CREATE POLICY "points_log_insert" ON public.participant_points_log
  FOR INSERT WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id
        AND p.project_id IS NOT NULL
        AND public.can_access_project(auth.uid(), p.project_id)
    )
  );

-- 3. Project memberships archive instead of deleting learning history.
ALTER TABLE public.participant_project_memberships
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.auto_create_project_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.project_id IS DISTINCT FROM NEW.project_id) THEN
    INSERT INTO public.participant_project_memberships (participant_id, project_id, branch_id, status, enrollment_source)
    VALUES (NEW.id, NEW.project_id, NEW.branch_id, 'active', 'manual')
    ON CONFLICT (participant_id, project_id) DO UPDATE
      SET status = 'active',
          branch_id = EXCLUDED.branch_id,
          archived_at = NULL,
          restored_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_membership ON public.participants;
CREATE TRIGGER trg_auto_membership
  AFTER INSERT OR UPDATE OF project_id ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_project_membership();

CREATE OR REPLACE FUNCTION public.archive_participant_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.project_id IS NOT NULL AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    UPDATE public.participant_project_memberships
    SET status = 'archived', archived_at = now()
    WHERE participant_id = OLD.id AND project_id = OLD.project_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_membership_on_project_change ON public.participants;
CREATE TRIGGER trg_archive_membership_on_project_change
  AFTER UPDATE OF project_id ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.archive_participant_membership();

-- 4. Auto-enroll project participants into published courses for the project.
CREATE OR REPLACE FUNCTION public.enroll_participant_project_courses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(auth_user_id, staff_user_id) INTO uid
  FROM public.participants
  WHERE id = NEW.participant_id;

  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lms_enrollments (course_id, user_id, status, progress)
  SELECT c.id, uid, 'enrolled', 0
  FROM public.lms_courses c
  WHERE c.project_id = NEW.project_id
    AND COALESCE(c.is_published, false) = true
  ON CONFLICT (course_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enroll_participant_project_courses ON public.participant_project_memberships;
CREATE TRIGGER trg_enroll_participant_project_courses
  AFTER INSERT OR UPDATE OF status ON public.participant_project_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enroll_participant_project_courses();

-- 5. Educational prompts/content managed per project/program.
CREATE TABLE IF NOT EXISTS public.project_learning_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  learning_path_id UUID REFERENCES public.lms_learning_paths(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'instruction'
    CHECK (content_type IN ('welcome','motivation','instruction','custom','prompt','interactive_text','smart_question','guidance')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (project_id IS NOT NULL OR learning_path_id IS NOT NULL)
);

ALTER TABLE public.project_learning_content ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_project_learning_content_project ON public.project_learning_content(project_id, is_active, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_project_learning_content_path ON public.project_learning_content(learning_path_id, is_active, scheduled_at);

DROP POLICY IF EXISTS "learning_content_select" ON public.project_learning_content;
CREATE POLICY "learning_content_select" ON public.project_learning_content
  FOR SELECT USING (
    is_active = true
    OR public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::public.app_role[])
  );

DROP POLICY IF EXISTS "learning_content_manage" ON public.project_learning_content;
CREATE POLICY "learning_content_manage" ON public.project_learning_content
  FOR ALL USING (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
  );

CREATE TABLE IF NOT EXISTS public.project_learning_content_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES public.project_learning_content(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_learning_content_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_content_audit_select" ON public.project_learning_content_audit;
CREATE POLICY "learning_content_audit_select" ON public.project_learning_content_audit
  FOR SELECT USING (
    public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::public.app_role[])
  );

CREATE OR REPLACE FUNCTION public.log_project_learning_content_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_learning_content_audit (content_id, action, changed_by, new_data)
    VALUES (NEW.id, 'insert', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    INSERT INTO public.project_learning_content_audit (content_id, action, changed_by, old_data, new_data)
    VALUES (NEW.id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.project_learning_content_audit (content_id, action, changed_by, old_data)
    VALUES (OLD.id, 'delete', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_learning_content_audit ON public.project_learning_content;
CREATE TRIGGER trg_project_learning_content_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_learning_content
  FOR EACH ROW EXECUTE FUNCTION public.log_project_learning_content_change();

-- 6. Verifiable certificates and learning activity tracking.
ALTER TABLE public.lms_certificates
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS verification_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL;

UPDATE public.lms_certificates
SET verification_code = COALESCE(verification_code, code),
    qr_payload = COALESCE(qr_payload, verification_url, code)
WHERE verification_code IS NULL OR qr_payload IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_certificates_verification_code
  ON public.lms_certificates(verification_code)
  WHERE verification_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.participant_learning_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.lms_courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lms_lessons(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL DEFAULT 'view',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_learning_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_learning_activity_participant ON public.participant_learning_activity(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_activity_user ON public.participant_learning_activity(user_id, created_at DESC);

DROP POLICY IF EXISTS "learning_activity_select" ON public.participant_learning_activity;
CREATE POLICY "learning_activity_select" ON public.participant_learning_activity
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_system_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::public.app_role[])
  );

DROP POLICY IF EXISTS "learning_activity_insert_own" ON public.participant_learning_activity;
CREATE POLICY "learning_activity_insert_own" ON public.participant_learning_activity
  FOR INSERT WITH CHECK (user_id = auth.uid());
