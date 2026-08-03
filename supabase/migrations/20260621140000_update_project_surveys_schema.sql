-- Add is_published and target_audience columns to project_surveys table
ALTER TABLE public.project_surveys ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.project_surveys ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'participants';
