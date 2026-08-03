
-- system_attachments
CREATE TABLE IF NOT EXISTS public.system_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sysatt_entity ON public.system_attachments(entity_type, entity_id);
ALTER TABLE public.system_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sysatt_select_auth" ON public.system_attachments;
CREATE POLICY "sysatt_select_auth" ON public.system_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sysatt_insert_auth" ON public.system_attachments;
CREATE POLICY "sysatt_insert_auth" ON public.system_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "sysatt_delete_owner_or_admin" ON public.system_attachments;
CREATE POLICY "sysatt_delete_owner_or_admin" ON public.system_attachments FOR DELETE TO authenticated USING (auth.uid() = uploaded_by OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));

-- system_comments
CREATE TABLE IF NOT EXISTS public.system_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_syscom_entity ON public.system_comments(entity_type, entity_id);
ALTER TABLE public.system_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "syscom_select_auth" ON public.system_comments;
CREATE POLICY "syscom_select_auth" ON public.system_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "syscom_insert_auth" ON public.system_comments;
CREATE POLICY "syscom_insert_auth" ON public.system_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "syscom_delete_owner_or_admin" ON public.system_comments;
CREATE POLICY "syscom_delete_owner_or_admin" ON public.system_comments FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));

-- system_events
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  event_data jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sysevt_entity ON public.system_events(entity_type, entity_id);
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sysevt_select_auth" ON public.system_events;
CREATE POLICY "sysevt_select_auth" ON public.system_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sysevt_insert_auth" ON public.system_events;
CREATE POLICY "sysevt_insert_auth" ON public.system_events FOR INSERT TO authenticated WITH CHECK (true);
