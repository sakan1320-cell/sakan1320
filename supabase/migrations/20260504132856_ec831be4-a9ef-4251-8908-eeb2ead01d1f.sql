-- Recreate the safe view with security_invoker=false so it bypasses the now-revoked
-- table-level SELECT. The view excludes correct_index and only exposes questions
-- belonging to published courses (or to admins).
DROP VIEW IF EXISTS public.lms_questions_public;
CREATE VIEW public.lms_questions_public
WITH (security_invoker = false)
AS
SELECT q.id, q.quiz_id, q.question, q.options, q.order_index
FROM public.lms_questions q
WHERE EXISTS (
  SELECT 1 FROM public.lms_quizzes qz
  JOIN public.lms_courses c ON c.id = qz.course_id
  WHERE qz.id = q.quiz_id
    AND (
      c.is_published = true
      OR public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
    )
);

GRANT SELECT ON public.lms_questions_public TO authenticated, anon;