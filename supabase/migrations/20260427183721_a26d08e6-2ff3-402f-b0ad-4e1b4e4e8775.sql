-- Finance module: transactions, attachments, storage bucket

CREATE TYPE public.finance_direction AS ENUM ('income', 'expense');

CREATE TABLE public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction public.finance_direction NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  party text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.project_branches(id) ON DELETE SET NULL,
  category text,
  description text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_tx_date ON public.finance_transactions(transaction_date DESC);
CREATE INDEX idx_finance_tx_project ON public.finance_transactions(project_id);
CREATE INDEX idx_finance_tx_direction ON public.finance_transactions(direction);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_select ON public.finance_transactions;
CREATE POLICY finance_select ON public.finance_transactions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant','board']::app_role[])
    OR (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id)));

DROP POLICY IF EXISTS finance_insert ON public.finance_transactions;
CREATE POLICY finance_insert ON public.finance_transactions FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::app_role[]));

DROP POLICY IF EXISTS finance_update ON public.finance_transactions;
CREATE POLICY finance_update ON public.finance_transactions FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::app_role[])
    OR (created_by = auth.uid()));

DROP POLICY IF EXISTS finance_delete ON public.finance_transactions;
CREATE POLICY finance_delete ON public.finance_transactions FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::app_role[]));

CREATE TRIGGER trg_finance_updated BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Attachments table
CREATE TABLE public.finance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_att_tx ON public.finance_attachments(transaction_id);

ALTER TABLE public.finance_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_att_select ON public.finance_attachments;
CREATE POLICY finance_att_select ON public.finance_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.finance_transactions t WHERE t.id = transaction_id));

DROP POLICY IF EXISTS finance_att_insert ON public.finance_attachments;
CREATE POLICY finance_att_insert ON public.finance_attachments FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::app_role[]));

DROP POLICY IF EXISTS finance_att_delete ON public.finance_attachments;
CREATE POLICY finance_att_delete ON public.finance_attachments FOR DELETE
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::app_role[]) OR uploaded_by = auth.uid());

-- Storage bucket for finance attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('finance-attachments', 'finance-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "finance_att_storage_select" ON storage.objects;
CREATE POLICY "finance_att_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'finance-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_att_storage_insert" ON storage.objects;
CREATE POLICY "finance_att_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'finance-attachments' AND auth.uid() IS NOT NULL
    AND public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager','branch_manager']::app_role[]));

DROP POLICY IF EXISTS "finance_att_storage_delete" ON storage.objects;
CREATE POLICY "finance_att_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'finance-attachments' AND public.has_any_role(auth.uid(), ARRAY['executive','assistant']::app_role[]));