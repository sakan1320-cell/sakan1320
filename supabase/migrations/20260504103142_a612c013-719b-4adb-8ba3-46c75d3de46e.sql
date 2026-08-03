
-- 1) Finance attachments storage: tighten SELECT to mirror finance_attachments table access
DROP POLICY IF EXISTS "finance_att_storage_select" ON storage.objects;
CREATE POLICY "finance_att_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'finance-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.finance_attachments fa
      JOIN public.finance_transactions ft ON ft.id = fa.transaction_id
      WHERE fa.file_path = storage.objects.name
        AND (
          public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
          OR (ft.project_id IS NOT NULL AND public.can_access_project(auth.uid(), ft.project_id))
        )
    )
  );

-- 2) staff-attachments: restrict upload paths to a strict format to limit abuse
DROP POLICY IF EXISTS "staff_attach_public_upload" ON storage.objects;
CREATE POLICY "staff_attach_public_upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'staff-attachments'
    AND name ~ '^[0-9]{10,16}-[a-z0-9]{4,12}\.(pdf|png|jpg|jpeg)$'
  );

-- 3) lms_questions: remove broad SELECT, only admins read directly. Provide a safe public view + grading RPC
DROP POLICY IF EXISTS "questions_select" ON public.lms_questions;
DROP POLICY IF EXISTS "questions_admin_select" ON public.lms_questions;
CREATE POLICY "questions_admin_select" ON public.lms_questions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[]));

-- View without correct_index for learners
CREATE OR REPLACE VIEW public.lms_questions_public
WITH (security_invoker = true)
AS
SELECT id, quiz_id, question, options, order_index
FROM public.lms_questions;

GRANT SELECT ON public.lms_questions_public TO anon, authenticated;

-- Allow learners to read questions (without correct_index) only when the quiz's course is published or they are admin
-- The view inherits RLS via security_invoker; loosen lms_questions read by adding an additional column-blind path:
-- Re-enable SELECT for learners but only when accessing via the view (we can't enforce that), so use an RPC for grading
-- Instead, allow learner SELECT but DO NOT include correct_index in the view; we still need raw SELECT for the view to work under invoker.
DROP POLICY IF EXISTS "questions_admin_select" ON public.lms_questions;
DROP POLICY IF EXISTS "questions_select_published" ON public.lms_questions;
CREATE POLICY "questions_select_published" ON public.lms_questions
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
    OR EXISTS (
      SELECT 1 FROM public.lms_quizzes qz
      JOIN public.lms_courses c ON c.id = qz.course_id
      WHERE qz.id = lms_questions.quiz_id AND c.is_published = true
    )
  );

-- Revoke the correct_index column from regular roles so SELECT * via the table cannot leak the answer key
REVOKE SELECT ON public.lms_questions FROM anon, authenticated;
GRANT SELECT (id, quiz_id, question, options, order_index) ON public.lms_questions TO authenticated;
-- Admins still need full access; they have it via service role and via SECURITY DEFINER RPCs / direct DB. For app-level admin reading correct_index, use a definer RPC:

CREATE OR REPLACE FUNCTION public.admin_get_questions(_quiz_id uuid)
RETURNS TABLE (id uuid, quiz_id uuid, question text, options jsonb, correct_index integer, order_index integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.quiz_id, q.question, q.options, q.correct_index, q.order_index
  FROM public.lms_questions q
  WHERE q.quiz_id = _quiz_id
    AND public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[])
  ORDER BY q.order_index;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_questions(uuid) TO authenticated;

-- Server-side quiz grading RPC
CREATE OR REPLACE FUNCTION public.grade_quiz(_quiz_id uuid, _answers jsonb)
RETURNS TABLE (score integer, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total integer := 0;
  _correct integer := 0;
  _pass integer;
  _score integer;
  _passed boolean;
  r record;
  _ans int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT pass_score INTO _pass FROM public.lms_quizzes WHERE id = _quiz_id;
  IF _pass IS NULL THEN _pass := 60; END IF;

  FOR r IN SELECT id, correct_index FROM public.lms_questions WHERE quiz_id = _quiz_id LOOP
    _total := _total + 1;
    BEGIN
      _ans := (_answers ->> r.id::text)::int;
    EXCEPTION WHEN OTHERS THEN _ans := -1;
    END;
    IF _ans = r.correct_index THEN _correct := _correct + 1; END IF;
  END LOOP;

  _score := CASE WHEN _total > 0 THEN ROUND((_correct::numeric / _total) * 100)::int ELSE 0 END;
  _passed := _score >= _pass;

  INSERT INTO public.lms_quiz_attempts (quiz_id, user_id, answers, score, passed)
  VALUES (_quiz_id, auth.uid(), _answers, _score, _passed);

  RETURN QUERY SELECT _score, _passed;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grade_quiz(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_quiz(uuid, jsonb) TO authenticated;

-- 4) automation_runs: tighten insert from any authenticated to admins only
DROP POLICY IF EXISTS "runs_system_insert" ON public.automation_runs;
DROP POLICY IF EXISTS "runs_admin_insert" ON public.automation_runs;
CREATE POLICY "runs_admin_insert" ON public.automation_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));

-- 5) Revoke EXECUTE on internal helpers from anon/authenticated (RLS still calls them via definer)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_branch(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_guardian(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_project_health(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_participant_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_participant_points(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_participant_points(uuid, integer, text) TO authenticated;
