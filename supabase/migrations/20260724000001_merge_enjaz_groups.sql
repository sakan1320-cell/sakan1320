-- Migration to merge enjaz_groups into project_groups and rename participant's group_id column

-- 1. Ensure project_groups table has the correct columns matching enjaz_groups (if missing)
-- project_groups already has: id, name_ar, name_en, branch_id, project_id, created_at, updated_at

-- 2. Copy data from enjaz_groups to project_groups
-- We use INSERT INTO ... ON CONFLICT (id) DO UPDATE/NOTHING to safely copy
INSERT INTO public.project_groups (id, name_ar, name_en, branch_id, project_id, created_at, updated_at)
SELECT 
  id, 
  name_ar, 
  NULL as name_en, 
  branch_id, 
  project_id, 
  created_at, 
  now() as updated_at
FROM public.enjaz_groups
ON CONFLICT (id) DO NOTHING;

-- 3. Adjust foreign key references in other tables
-- enjaz_announcements: target_group_id (linked to enjaz_groups)
-- We need to drop the old foreign key constraint and add a new one pointing to project_groups
ALTER TABLE public.enjaz_announcements 
  DROP CONSTRAINT IF EXISTS enjaz_announcements_target_group_id_fkey;

ALTER TABLE public.enjaz_announcements
  ADD CONSTRAINT enjaz_announcements_target_group_id_fkey 
  FOREIGN KEY (target_group_id) 
  REFERENCES public.project_groups(id) 
  ON DELETE SET NULL;

-- 4. Rename column enjaz_group_id to group_id in participants table
ALTER TABLE public.participants 
  RENAME COLUMN enjaz_group_id TO group_id;

-- 5. Re-link foreign key of participants.group_id to project_groups(id)
ALTER TABLE public.participants 
  DROP CONSTRAINT IF EXISTS participants_enjaz_group_id_fkey;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_group_id_fkey 
  FOREIGN KEY (group_id) 
  REFERENCES public.project_groups(id) 
  ON DELETE SET NULL;

-- 6. Drop the old enjaz_groups table
DROP TABLE IF EXISTS public.enjaz_groups CASCADE;
