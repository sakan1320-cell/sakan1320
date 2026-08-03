-- ============================================================
-- Migration: Project Files Storage Bucket
-- Timestamp: 20260520110000
-- Purpose: Add 'project-files' storage bucket and set RLS policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage objects in project-files
DROP POLICY IF EXISTS "project_files_storage_select" ON storage.objects;
CREATE POLICY "project_files_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_storage_insert" ON storage.objects;
CREATE POLICY "project_files_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');

DROP POLICY IF EXISTS "project_files_storage_delete" ON storage.objects;
CREATE POLICY "project_files_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'project-files');
