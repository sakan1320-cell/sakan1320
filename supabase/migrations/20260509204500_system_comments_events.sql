-- Create system_comments table
CREATE TABLE IF NOT EXISTS public.system_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Copy existing data from task_comments if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_comments') THEN
        INSERT INTO public.system_comments (id, entity_type, entity_id, content, created_by, created_at, updated_at)
        SELECT id, 'task', task_id, body, user_id, created_at, created_at
        FROM public.task_comments;
    END IF;
END $$;

ALTER TABLE public.system_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.system_comments;
CREATE POLICY "Enable read for authenticated users" ON public.system_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.system_comments;
CREATE POLICY "Enable insert for authenticated users" ON public.system_comments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for own comments" ON public.system_comments;
CREATE POLICY "Enable update for own comments" ON public.system_comments FOR UPDATE TO authenticated USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Enable delete for own comments" ON public.system_comments;
CREATE POLICY "Enable delete for own comments" ON public.system_comments FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_system_comments_entity ON public.system_comments(entity_type, entity_id);

-- Create system_events table (Activity Timeline)
CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.system_events;
CREATE POLICY "Enable read for authenticated users" ON public.system_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.system_events;
CREATE POLICY "Enable insert for authenticated users" ON public.system_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_system_events_entity ON public.system_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON public.system_events(created_at DESC);
