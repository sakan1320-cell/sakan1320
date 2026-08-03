-- Migration: Add registration_form_fields table and custom_fields to participants

CREATE TABLE IF NOT EXISTS public.registration_form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select')),
    is_required BOOLEAN DEFAULT false,
    min_length INTEGER,
    max_length INTEGER,
    regex_pattern TEXT,
    options_array JSONB, -- For 'select' type options e.g. ["Option 1", "Option 2"]
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.registration_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.registration_form_fields FOR SELECT USING (true);
CREATE POLICY "Enable all access for admin/board" ON public.registration_form_fields FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('system_admin', 'board', 'executive', 'branch_manager')
    )
);

-- Add custom_fields to participants if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='participants' AND column_name='custom_fields') THEN
        ALTER TABLE public.participants ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
    END IF;
END
$$;
