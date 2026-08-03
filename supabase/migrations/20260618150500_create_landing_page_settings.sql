-- Create the landing_page_settings table
CREATE TABLE IF NOT EXISTS public.landing_page_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    header_links JSONB DEFAULT '[]'::jsonb,
    business_platform_btn JSONB DEFAULT '{"label_ar": "منصة الأعمال", "label_en": "Business Platform", "target_url": "/auth"}'::jsonb,
    popup_alert JSONB DEFAULT '{"is_enabled": false, "image_url": "", "action_url": ""}'::jsonb,
    about_us JSONB DEFAULT '{"text_ar": "", "text_en": "", "section_is_visible": true}'::jsonb,
    news_cards JSONB DEFAULT '[]'::jsonb,
    partners_carousel JSONB DEFAULT '[]'::jsonb,
    social_media_links JSONB DEFAULT '{"twitter": "", "linkedin": "", "facebook": "", "instagram": ""}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT single_row CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Enable RLS
ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Everyone can view landing page settings
CREATE POLICY "Public can view landing page settings"
ON public.landing_page_settings FOR SELECT
USING (true);

-- Only system admins can update
CREATE POLICY "System admins can update landing page settings"
ON public.landing_page_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'system_admin'
  )
);

-- Only system admins can insert (should only be used once, but required)
CREATE POLICY "System admins can insert landing page settings"
ON public.landing_page_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'system_admin'
  )
);

-- Insert the default singleton row if it doesn't exist
INSERT INTO public.landing_page_settings (id)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_landing_settings_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_landing_settings_timestamp
    BEFORE UPDATE ON public.landing_page_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_landing_settings_updated_at();
