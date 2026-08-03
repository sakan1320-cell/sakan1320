
-- finance_transactions: extend SELECT to include branch managers via can_access_branch
DROP POLICY IF EXISTS "finance_select" ON public.finance_transactions;
CREATE POLICY "finance_select" ON public.finance_transactions
  FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id))
    OR (branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), branch_id))
    OR created_by = auth.uid()
  );

-- finance_attachments: mirror transaction visibility
DROP POLICY IF EXISTS "finance_att_select" ON public.finance_attachments;
CREATE POLICY "finance_att_select" ON public.finance_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.finance_transactions t
      WHERE t.id = finance_attachments.transaction_id
        AND (
          public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::public.app_role[])
          OR (t.project_id IS NOT NULL AND public.can_access_project(auth.uid(), t.project_id))
          OR (t.branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), t.branch_id))
          OR t.created_by = auth.uid()
        )
    )
  );
