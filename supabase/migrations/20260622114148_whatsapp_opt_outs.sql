CREATE TABLE IF NOT EXISTS public.whatsapp_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the table (service role needs it, and staff might need to view who opted out)
CREATE POLICY "admin_all_whatsapp_opt_outs" ON public.whatsapp_opt_outs FOR ALL USING (
  public.is_system_admin(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['executive', 'assistant'])
);

-- Allow service role to do everything
GRANT ALL ON public.whatsapp_opt_outs TO service_role;
GRANT SELECT ON public.whatsapp_opt_outs TO authenticated;
