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
    -- 1. Add columns to main tables
    ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS enjaz_enabled boolean DEFAULT false;

    ALTER TABLE public.participants 
    ADD COLUMN IF NOT EXISTS enjaz_group_id uuid;

    -- 2. Enjaz Groups Table
    CREATE TABLE IF NOT EXISTS public.enjaz_groups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      name_ar text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_groups ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_groups_all_authenticated" ON public.enjaz_groups;
    CREATE POLICY "enjaz_groups_all_authenticated" ON public.enjaz_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 3. Enjaz Tasks Table
    CREATE TABLE IF NOT EXISTS public.enjaz_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      points_reward integer NOT NULL DEFAULT 10,
      start_date date,
      end_date date,
      target_group_id uuid REFERENCES public.enjaz_groups(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_tasks_all_authenticated" ON public.enjaz_tasks;
    CREATE POLICY "enjaz_tasks_all_authenticated" ON public.enjaz_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 4. Enjaz Task Submissions Table
    CREATE TABLE IF NOT EXISTS public.enjaz_task_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES public.enjaz_tasks(id) ON DELETE CASCADE,
      participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending', -- pending, submitted, needs_review, approved, rejected
      submission_text text,
      points_awarded integer DEFAULT 0,
      reviewed_by uuid,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_task_submissions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_subs_all_authenticated" ON public.enjaz_task_submissions;
    CREATE POLICY "enjaz_subs_all_authenticated" ON public.enjaz_task_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 5. Enjaz Rewards Table
    CREATE TABLE IF NOT EXISTS public.enjaz_rewards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      name_ar text NOT NULL,
      description_ar text,
      points_required integer NOT NULL DEFAULT 50,
      quantity integer NOT NULL DEFAULT 10,
      is_active boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_rewards ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_rewards_all_authenticated" ON public.enjaz_rewards;
    CREATE POLICY "enjaz_rewards_all_authenticated" ON public.enjaz_rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 6. Enjaz Reward Claims Table
    CREATE TABLE IF NOT EXISTS public.enjaz_reward_claims (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reward_id uuid NOT NULL REFERENCES public.enjaz_rewards(id) ON DELETE CASCADE,
      participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
      created_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      processed_by uuid
    );
    ALTER TABLE public.enjaz_reward_claims ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_claims_all_authenticated" ON public.enjaz_reward_claims;
    CREATE POLICY "enjaz_claims_all_authenticated" ON public.enjaz_reward_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 7. Enjaz Announcements Table
    CREATE TABLE IF NOT EXISTS public.enjaz_announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      body text NOT NULL,
      target_group_id uuid REFERENCES public.enjaz_groups(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_announcements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_ann_all_authenticated" ON public.enjaz_announcements;
    CREATE POLICY "enjaz_ann_all_authenticated" ON public.enjaz_announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 8. Enjaz Messages Table
    CREATE TABLE IF NOT EXISTS public.enjaz_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      recipient_id uuid REFERENCES public.participants(id) ON DELETE CASCADE,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_messages ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_msg_all_authenticated" ON public.enjaz_messages;
    CREATE POLICY "enjaz_msg_all_authenticated" ON public.enjaz_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 9. Enjaz Quizzes Table
    CREATE TABLE IF NOT EXISTS public.enjaz_quizzes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      duration_minutes integer NOT NULL DEFAULT 10,
      is_active boolean DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_quizzes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_quizzes_all_authenticated" ON public.enjaz_quizzes;
    CREATE POLICY "enjaz_quizzes_all_authenticated" ON public.enjaz_quizzes FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 10. Enjaz Quiz Questions Table
    CREATE TABLE IF NOT EXISTS public.enjaz_quiz_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id uuid NOT NULL REFERENCES public.enjaz_quizzes(id) ON DELETE CASCADE,
      question_text text NOT NULL,
      options jsonb NOT NULL DEFAULT '[]'::jsonb,
      correct_option_index integer NOT NULL DEFAULT 0,
      points_reward integer NOT NULL DEFAULT 5
    );
    ALTER TABLE public.enjaz_quiz_questions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_quiz_q_all_authenticated" ON public.enjaz_quiz_questions;
    CREATE POLICY "enjaz_quiz_q_all_authenticated" ON public.enjaz_quiz_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 11. Enjaz Quiz Attempts Table
    CREATE TABLE IF NOT EXISTS public.enjaz_quiz_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id uuid NOT NULL REFERENCES public.enjaz_quizzes(id) ON DELETE CASCADE,
      participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
      score integer NOT NULL DEFAULT 0,
      points_awarded integer NOT NULL DEFAULT 0,
      completed_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_quiz_attempts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_quiz_att_all_authenticated" ON public.enjaz_quiz_attempts;
    CREATE POLICY "enjaz_quiz_att_all_authenticated" ON public.enjaz_quiz_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 12. Enjaz Budget Table
    CREATE TABLE IF NOT EXISTS public.enjaz_budget (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      amount numeric NOT NULL DEFAULT 0,
      transaction_type text NOT NULL, -- income, expense
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_budget ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_budget_all_authenticated" ON public.enjaz_budget;
    CREATE POLICY "enjaz_budget_all_authenticated" ON public.enjaz_budget FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- 13. Enjaz Badges Tables
    CREATE TABLE IF NOT EXISTS public.enjaz_badges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE, -- null means global default
      name_ar text NOT NULL,
      icon text DEFAULT '🎖️',
      description_ar text,
      points_reward integer DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.enjaz_badges ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_badges_all_authenticated" ON public.enjaz_badges;
    CREATE POLICY "enjaz_badges_all_authenticated" ON public.enjaz_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

    CREATE TABLE IF NOT EXISTS public.enjaz_participant_badges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
      badge_id uuid NOT NULL REFERENCES public.enjaz_badges(id) ON DELETE CASCADE,
      earned_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (participant_id, badge_id)
    );
    ALTER TABLE public.enjaz_participant_badges ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "enjaz_p_badges_all_authenticated" ON public.enjaz_participant_badges;
    CREATE POLICY "enjaz_p_badges_all_authenticated" ON public.enjaz_participant_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Seed default badges
    INSERT INTO public.enjaz_badges (name_ar, icon, description_ar, points_reward) VALUES
      ('شارة الحضور', '📅', 'للإلتزام التام بالتحضير والحضور اليومي والنشط', 15),
      ('شارة الالتزام', '🤝', 'للإلتزام بجميع معايير البرنامج والسلوك القويم', 20),
      ('شارة المبادرة', '⚡', 'للتقديم الذاتي والمبادرة في الأنشطة الإضافية والتعليمية', 25),
      ('شارة التعاون', '👭', 'للتعاون الفعال ومساعدة الزميلات وإثراء روح الفريق', 15),
      ('شارة التحسن', '📈', 'لإظهار تطور ملحوظ في الأداء الدراسي أو السلوكي', 20),
      ('شارة الإنجاز السريع', '🚀', 'لإنهاء المهام المسندة وتأكيدها في وقت قياسي', 20),
      ('شارة قائدة المجموعة', '👑', 'لقيادة حلقة أو مجموعة والإشراف على التحديات بنجاح', 30),
      ('شارة العطاء', '🎁', 'للعطاء والتعاون اللامحدود والمساعدة في الأعمال التطوعية', 25)
    ON CONFLICT DO NOTHING;
  `;
  
  console.log("Applying Enjaz motivation system tables, columns, indexes, and default seed data...");
  const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
  
  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log("Enjaz migration applied successfully!");
  }
}

runMigration();
