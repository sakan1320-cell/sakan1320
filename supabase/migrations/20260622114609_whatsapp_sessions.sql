CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  phone_number TEXT PRIMARY KEY,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the table (service role needs it, and staff might need to view sessions)
CREATE POLICY "admin_all_whatsapp_sessions" ON public.whatsapp_sessions FOR ALL USING (
  public.is_system_admin(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['executive', 'assistant'])
);

-- Allow service role to do everything
GRANT ALL ON public.whatsapp_sessions TO service_role;
GRANT SELECT ON public.whatsapp_sessions TO authenticated;
