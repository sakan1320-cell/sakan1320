CREATE TABLE IF NOT EXISTS public.system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack_trace TEXT,
  url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Allow anyone (even unauthenticated, if the app crashes before login) to insert errors
DROP POLICY IF EXISTS "allow_insert_error" ON public.system_errors;
CREATE POLICY "allow_insert_error" ON public.system_errors
FOR INSERT TO public, anon, authenticated WITH CHECK (true);

-- Allow only system_admin to view and manage errors
DROP POLICY IF EXISTS "admin_manage_errors" ON public.system_errors;
CREATE POLICY "admin_manage_errors" ON public.system_errors
FOR ALL USING (public.is_system_admin(auth.uid()));
