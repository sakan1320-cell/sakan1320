
-- AUTOMATION RULES
CREATE TYPE public.automation_event AS ENUM (
  'attendance_recorded', 'attendance_absent_streak', 'task_overdue',
  'lms_course_completed', 'lms_quiz_passed', 'participant_inactive',
  'project_status_changed', 'finance_threshold', 'manual'
);

CREATE TYPE public.automation_action_type AS ENUM (
  'send_notification', 'add_points', 'deduct_points',
  'change_status', 'create_task', 'webhook'
);

CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  event public.automation_event NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  event public.automation_event NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rules_admin_all ON public.automation_rules;
CREATE POLICY rules_admin_all ON public.automation_rules FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));
DROP POLICY IF EXISTS rules_read ON public.automation_rules;
CREATE POLICY rules_read ON public.automation_rules FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[]));
DROP POLICY IF EXISTS runs_admin_read ON public.automation_runs;
CREATE POLICY runs_admin_read ON public.automation_runs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[]));
DROP POLICY IF EXISTS runs_system_insert ON public.automation_runs;
CREATE POLICY runs_system_insert ON public.automation_runs FOR INSERT TO authenticated WITH CHECK (true);

-- TEMPLATES
CREATE TABLE public.project_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  default_offset_days INTEGER DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'whatsapp',
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pt_admin ON public.project_templates;
CREATE POLICY pt_admin ON public.project_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));
DROP POLICY IF EXISTS pt_read ON public.project_templates;
CREATE POLICY pt_read ON public.project_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tt_admin ON public.task_templates;
CREATE POLICY tt_admin ON public.task_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));
DROP POLICY IF EXISTS tt_read ON public.task_templates;
CREATE POLICY tt_read ON public.task_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS nt_admin ON public.notification_templates;
CREATE POLICY nt_admin ON public.notification_templates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));
DROP POLICY IF EXISTS nt_read ON public.notification_templates;
CREATE POLICY nt_read ON public.notification_templates FOR SELECT TO authenticated USING (true);

-- updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects','project_branches','tasks','participants','guardians',
    'lms_courses','lms_lessons','finance_transactions','profiles',
    'automation_rules','project_templates','task_templates','notification_templates','site_content'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END$$;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_proj_date ON public.attendance(project_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON public.attendance(subject_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_proj_status ON public.tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date) WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_participants_proj ON public.participants(project_id, status);
CREATE INDEX IF NOT EXISTS idx_participants_branch ON public.participants(branch_id);
CREATE INDEX IF NOT EXISTS idx_participants_natid ON public.participants(national_id);
CREATE INDEX IF NOT EXISTS idx_participants_phone ON public.participants(phone);
CREATE INDEX IF NOT EXISTS idx_finance_proj_date ON public.finance_transactions(project_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_points_participant ON public.participant_points_log(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enroll_user ON public.lms_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enroll_course ON public.lms_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- SMART FUNCTIONS
CREATE OR REPLACE FUNCTION public.add_participant_points(_participant_id UUID, _delta INTEGER, _reason TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_points INTEGER;
BEGIN
  UPDATE public.participants SET points = GREATEST(0, points + _delta) WHERE id = _participant_id RETURNING points INTO _new_points;
  IF _new_points IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.participant_points_log (participant_id, delta, reason, created_by)
  VALUES (_participant_id, _delta, _reason, auth.uid());
  RETURN _new_points;
END$$;

CREATE OR REPLACE FUNCTION public.compute_participant_status(_participant_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _absent INTEGER; _present INTEGER; _last DATE;
BEGIN
  SELECT
    count(*) FILTER (WHERE status = 'absent' AND date >= CURRENT_DATE - INTERVAL '30 days'),
    count(*) FILTER (WHERE status = 'present' AND date >= CURRENT_DATE - INTERVAL '30 days'),
    max(date)
  INTO _absent, _present, _last
  FROM public.attendance WHERE subject_id = _participant_id AND subject_type = 'participant';
  IF _last IS NULL OR _last < CURRENT_DATE - INTERVAL '30 days' THEN RETURN 'inactive'; END IF;
  IF _absent >= 3 OR (_present + _absent > 0 AND _absent::float / (_present + _absent) > 0.4) THEN RETURN 'at_risk'; END IF;
  RETURN 'active';
END$$;

CREATE OR REPLACE FUNCTION public.compute_project_health(_project_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _total_tasks INTEGER; _done_tasks INTEGER; _att_present INTEGER; _att_total INTEGER; _participants INTEGER;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'completed') INTO _total_tasks, _done_tasks
    FROM public.tasks WHERE project_id = _project_id;
  SELECT count(*) FILTER (WHERE status = 'present'), count(*) INTO _att_present, _att_total
    FROM public.attendance WHERE project_id = _project_id AND date >= CURRENT_DATE - INTERVAL '30 days';
  SELECT count(*) INTO _participants FROM public.participants WHERE project_id = _project_id;
  RETURN jsonb_build_object(
    'tasks_completion', CASE WHEN _total_tasks > 0 THEN round((_done_tasks::numeric / _total_tasks) * 100, 1) ELSE 0 END,
    'attendance_rate', CASE WHEN _att_total > 0 THEN round((_att_present::numeric / _att_total) * 100, 1) ELSE 0 END,
    'tasks_total', _total_tasks, 'tasks_done', _done_tasks, 'participants', _participants
  );
END$$;

-- ATTENDANCE POINTS TRIGGER
CREATE OR REPLACE FUNCTION public.handle_attendance_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _delta INTEGER; _reason TEXT;
BEGIN
  IF NEW.subject_type <> 'participant' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'present' THEN _delta := 5; _reason := 'attendance:present';
    ELSIF NEW.status = 'late' THEN _delta := 2; _reason := 'attendance:late';
    ELSIF NEW.status = 'absent' THEN _delta := -3; _reason := 'attendance:absent';
    ELSE RETURN NEW; END IF;
    UPDATE public.participants SET points = GREATEST(0, points + _delta) WHERE id = NEW.subject_id;
    INSERT INTO public.participant_points_log (participant_id, delta, reason, created_by)
      VALUES (NEW.subject_id, _delta, _reason, NEW.recorded_by);
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_attendance_points ON public.attendance;
CREATE TRIGGER trg_attendance_points AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.handle_attendance_points();

-- LMS COMPLETION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_lms_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reward INTEGER; _participant_id UUID;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
     OR (TG_OP = 'INSERT' AND NEW.status = 'completed') THEN
    SELECT points_reward INTO _reward FROM public.lms_courses WHERE id = NEW.course_id;
    IF _reward IS NULL OR _reward <= 0 THEN RETURN NEW; END IF;
    SELECT id INTO _participant_id FROM public.participants
      WHERE auth_user_id = NEW.user_id OR staff_user_id = NEW.user_id LIMIT 1;
    IF _participant_id IS NOT NULL THEN
      UPDATE public.participants SET points = points + _reward WHERE id = _participant_id;
      INSERT INTO public.participant_points_log (participant_id, delta, reason)
        VALUES (_participant_id, _reward, 'lms:course_completed:' || NEW.course_id::text);
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_lms_completion ON public.lms_enrollments;
CREATE TRIGGER trg_lms_completion AFTER INSERT OR UPDATE ON public.lms_enrollments
FOR EACH ROW EXECUTE FUNCTION public.handle_lms_completion();

-- DUPLICATE PARTICIPANT PREVENTION
CREATE OR REPLACE FUNCTION public.prevent_duplicate_participant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.participants
             WHERE project_id = NEW.project_id
               AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
               AND (national_id = NEW.national_id OR phone = NEW.phone)) THEN
    RAISE EXCEPTION 'duplicate_participant: رقم الهوية أو الجوال مكرر داخل نفس المشروع';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_prevent_dup_participant ON public.participants;
CREATE TRIGGER trg_prevent_dup_participant BEFORE INSERT OR UPDATE ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_participant();

-- VIEWS
CREATE OR REPLACE VIEW public.project_summary_view AS
SELECT
  p.id, p.name_ar, p.name_en, p.status, p.start_date, p.end_date, p.manager_id,
  (SELECT count(*) FROM public.participants pa WHERE pa.project_id = p.id) AS participants_count,
  (SELECT count(*) FROM public.tasks t WHERE t.project_id = p.id) AS tasks_total,
  (SELECT count(*) FROM public.tasks t WHERE t.project_id = p.id AND t.status = 'completed') AS tasks_done,
  (SELECT count(*) FROM public.tasks t WHERE t.project_id = p.id AND t.due_date < CURRENT_DATE AND t.status <> 'completed') AS tasks_overdue,
  (SELECT count(*) FROM public.attendance a WHERE a.project_id = p.id AND a.status = 'present' AND a.date >= CURRENT_DATE - INTERVAL '30 days') AS attendance_present_30d,
  (SELECT count(*) FROM public.attendance a WHERE a.project_id = p.id AND a.date >= CURRENT_DATE - INTERVAL '30 days') AS attendance_total_30d,
  (SELECT COALESCE(sum(amount),0) FROM public.finance_transactions f WHERE f.project_id = p.id AND f.direction = 'income') AS total_income,
  (SELECT COALESCE(sum(amount),0) FROM public.finance_transactions f WHERE f.project_id = p.id AND f.direction = 'expense') AS total_expense
FROM public.projects p;

CREATE OR REPLACE VIEW public.participant_summary_view AS
SELECT
  pa.id, pa.full_name, pa.project_id, pa.status, pa.points, pa.phone, pa.national_id,
  (SELECT count(*) FROM public.attendance a WHERE a.subject_id = pa.id AND a.subject_type = 'participant' AND a.status = 'present') AS present_count,
  (SELECT count(*) FROM public.attendance a WHERE a.subject_id = pa.id AND a.subject_type = 'participant' AND a.status = 'absent') AS absent_count,
  (SELECT max(date) FROM public.attendance a WHERE a.subject_id = pa.id AND a.subject_type = 'participant') AS last_attendance,
  (SELECT count(*) FROM public.lms_enrollments e WHERE e.user_id = pa.auth_user_id OR e.user_id = pa.staff_user_id) AS courses_count,
  (SELECT count(*) FROM public.lms_certificates c WHERE c.user_id = pa.auth_user_id OR c.user_id = pa.staff_user_id) AS certificates_count
FROM public.participants pa;

GRANT SELECT ON public.project_summary_view TO authenticated;
GRANT SELECT ON public.participant_summary_view TO authenticated;

-- SEED TEMPLATES
INSERT INTO public.notification_templates (key, name, channel, subject_template, body_template, variables) VALUES
  ('absence_alert', 'تنبيه غياب', 'whatsapp', NULL, 'عزيزي {name}، نلاحظ غيابك عن {project} بتاريخ {date}.', '["name","project","date"]'::jsonb),
  ('task_reminder', 'تذكير مهمة', 'whatsapp', 'تذكير: {title}', 'مرحبًا {name}، لديك مهمة "{title}" مستحقة بتاريخ {due_date}.', '["name","title","due_date"]'::jsonb),
  ('course_completed', 'تهنئة إكمال دورة', 'whatsapp', NULL, 'تهانينا {name}! أكملت دورة {course} بنجاح وحصلت على {points} نقطة.', '["name","course","points"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
