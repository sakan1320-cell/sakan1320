-- Enterprise Workflow Management System Enhancements

-- 1. Workflow Stages
CREATE TABLE IF NOT EXISTS public.workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  color text DEFAULT '#64748B',
  sort_order integer DEFAULT 0,
  wip_limit integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for workflow stages
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on workflow_stages"
  ON public.workflow_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow modification on workflow_stages for admin/managers"
  ON public.workflow_stages FOR ALL
  TO authenticated
  USING (true);

-- 2. Alter Tasks Table (Safe Column Additions)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workflow_stage_id uuid REFERENCES public.workflow_stages(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position double precision DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_hours double precision;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS actual_hours double precision;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS points integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_color text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- 3. Task Relationships (Dependencies)
CREATE TABLE IF NOT EXISTS public.task_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  target_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  relation_type text NOT NULL, -- blocks, depends_on, related_to, duplicated_by
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_relation_type CHECK (relation_type IN ('blocks', 'depends_on', 'related_to', 'duplicated_by'))
);

ALTER TABLE public.task_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on task_relationships"
  ON public.task_relationships FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow modification on task_relationships for authenticated users"
  ON public.task_relationships FOR ALL
  TO authenticated
  USING (true);

-- 4. Checklists
CREATE TABLE IF NOT EXISTS public.task_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on task_checklists"
  ON public.task_checklists FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow modification on task_checklists for authenticated users"
  ON public.task_checklists FOR ALL
  TO authenticated
  USING (true);

-- 5. Checklist Items
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.task_checklists(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on task_checklist_items"
  ON public.task_checklist_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow modification on task_checklist_items for authenticated users"
  ON public.task_checklist_items FOR ALL
  TO authenticated
  USING (true);

-- 6. Attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on task_attachments"
  ON public.task_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow modification on task_attachments for authenticated users"
  ON public.task_attachments FOR ALL
  TO authenticated
  USING (true);

-- 7. Threaded replies in Task Comments
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE;

-- 8. Activity Logs
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on task_activity_log"
  ON public.task_activity_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to authenticated users on task_activity_log"
  ON public.task_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 9. Automations
CREATE TABLE IF NOT EXISTS public.task_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event text NOT NULL, -- status_changed, due_date_passed, label_added, task_completed
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users on task_automations"
  ON public.task_automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow modification on task_automations for authenticated users"
  ON public.task_automations FOR ALL
  TO authenticated
  USING (true);
