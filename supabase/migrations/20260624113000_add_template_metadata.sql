ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS variables_config JSONB DEFAULT '[]'::jsonb;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS meta_components JSONB DEFAULT '[]'::jsonb;
