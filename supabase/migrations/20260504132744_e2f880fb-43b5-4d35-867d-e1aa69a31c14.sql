-- 1) Revoke direct SELECT on lms_questions from non-admin roles to prevent
--    leaking correct_index via PostgREST. Access goes through lms_questions_public view
--    or admin_get_questions RPC. Server-side grade_quiz still works (SECURITY DEFINER).
REVOKE SELECT ON public.lms_questions FROM anon, authenticated, PUBLIC;
DROP POLICY IF EXISTS questions_select_published ON public.lms_questions;
-- Admin-only SELECT policy (admins bypass via admin_get_questions RPC; this allows direct reads for admins if granted in future)
DROP POLICY IF EXISTS questions_select_admin ON public.lms_questions;
CREATE POLICY questions_select_admin ON public.lms_questions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));

-- 2) Tighten finance-attachments storage SELECT policy to mirror finance_att_select
DROP POLICY IF EXISTS finance_att_storage_select ON storage.objects;
CREATE POLICY finance_att_storage_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'finance-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.finance_attachments fa
      JOIN public.finance_transactions ft ON ft.id = fa.transaction_id
      WHERE fa.file_path = objects.name
        AND (
          public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
          OR (ft.project_id IS NOT NULL AND public.can_access_project(auth.uid(), ft.project_id))
          OR (ft.branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), ft.branch_id))
          OR ft.created_by = auth.uid()
        )
    )
  );