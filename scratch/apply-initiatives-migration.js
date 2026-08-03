import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runMigration() {
  const supabase = createClient(URL, SERVICE_KEY);
  
  const sql = `
    -- 1. Create enjaz_initiatives table
    CREATE TABLE IF NOT EXISTS public.enjaz_initiatives (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      icon text DEFAULT '🌟',
      points integer NOT NULL DEFAULT 3,
      initiative_type text NOT NULL DEFAULT 'behavior', -- behavior, attendance, interaction, cleanliness, cooperation, initiative, achievement, commitment
      scope text NOT NULL DEFAULT 'project', -- all, level, group, class, specific_teacher
      award_method text NOT NULL DEFAULT 'individual', -- individual, group
      start_date date,
      end_date date,
      max_total_distribution integer,
      max_per_teacher integer,
      max_per_participant integer,
      daily_limit integer,
      requires_notes boolean DEFAULT false,
      requires_approval boolean DEFAULT false,
      show_in_log boolean DEFAULT true,
      encouragement_message text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      created_by uuid
    );
    ALTER TABLE public.enjaz_initiatives ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_init_all_authenticated" ON public.enjaz_initiatives;
    CREATE POLICY "enjaz_init_all_authenticated" ON public.enjaz_initiatives FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 2. Create enjaz_initiative_grants table
    CREATE TABLE IF NOT EXISTS public.enjaz_initiative_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      initiative_id uuid NOT NULL REFERENCES public.enjaz_initiatives(id) ON DELETE CASCADE,
      participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
      awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      points_awarded integer NOT NULL,
      notes text,
      status text NOT NULL DEFAULT 'approved', -- approved, pending_approval, cancelled
      cancellation_reason text,
      created_at timestamptz DEFAULT now(),
      processed_by uuid,
      processed_at timestamptz
    );
    ALTER TABLE public.enjaz_initiative_grants ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_grants_all_authenticated" ON public.enjaz_initiative_grants;
    CREATE POLICY "enjaz_grants_all_authenticated" ON public.enjaz_initiative_grants FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Seed default initiatives
    INSERT INTO public.enjaz_initiatives (project_id, name, icon, description, points, initiative_type, is_active)
    SELECT id, 'الابتسامة', '😊', 'تمنح للمشاركة التي تظهر روحاً إيجابية وابتسامة وتفاعلاً لطيفاً', 3, 'behavior', true FROM public.projects ON CONFLICT DO NOTHING;
  `;
  
  console.log("Applying Initiatives migration...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log("Migration applied successfully!");
  }
}

runMigration();
