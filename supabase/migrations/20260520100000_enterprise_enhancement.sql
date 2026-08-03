-- ============================================================
-- Migration: Enterprise Platform Enhancement
-- Timestamp: 20260520100000
-- Purpose: Add gamification, enhanced LMS, in-app notifications,
--          and CMS infrastructure tables
-- ============================================================

-- ============================================================
-- 1. GAMIFICATION SYSTEM
-- ============================================================

-- Participant levels
CREATE TABLE IF NOT EXISTS public.participant_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  min_points integer NOT NULL DEFAULT 0,
  max_points integer NOT NULL DEFAULT 100,
  icon text DEFAULT '⭐',
  color text DEFAULT '#FFD700',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "levels_select" ON public.participant_levels;
CREATE POLICY "levels_select" ON public.participant_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "levels_manage" ON public.participant_levels;
CREATE POLICY "levels_manage" ON public.participant_levels FOR ALL TO authenticated USING (public.current_user_is_manager());

-- Seed default levels
INSERT INTO public.participant_levels (name_ar, name_en, min_points, max_points, icon, color, sort_order) VALUES
  ('مبتدئ', 'Beginner', 0, 49, '🌱', '#8BC34A', 1),
  ('نشط', 'Active', 50, 149, '⭐', '#FFC107', 2),
  ('متميز', 'Distinguished', 150, 299, '🏅', '#FF9800', 3),
  ('خبير', 'Expert', 300, 499, '🏆', '#F44336', 4),
  ('قائد', 'Leader', 500, 99999, '👑', '#9C27B0', 5)
ON CONFLICT DO NOTHING;

-- Badges
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  icon text DEFAULT '🎖️',
  criteria_type text NOT NULL DEFAULT 'manual', -- manual, attendance_streak, points_threshold, course_completion, challenge
  criteria_value integer DEFAULT 0,
  points_reward integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_select" ON public.badges;
CREATE POLICY "badges_select" ON public.badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "badges_manage" ON public.badges;
CREATE POLICY "badges_manage" ON public.badges FOR ALL TO authenticated USING (public.current_user_is_manager());

-- Seed default badges
INSERT INTO public.badges (name_ar, name_en, icon, criteria_type, criteria_value, points_reward) VALUES
  ('حضور مثالي', 'Perfect Attendance', '📅', 'attendance_streak', 7, 15),
  ('متعلم نشط', 'Active Learner', '📚', 'course_completion', 1, 20),
  ('نجم الأسبوع', 'Star of the Week', '🌟', 'manual', 0, 10),
  ('أول إنجاز', 'First Achievement', '🎯', 'points_threshold', 50, 5),
  ('محارب التحديات', 'Challenge Warrior', '⚔️', 'challenge', 3, 25)
ON CONFLICT DO NOTHING;

-- Participant badges (earned)
CREATE TABLE IF NOT EXISTS public.participant_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, badge_id)
);
ALTER TABLE public.participant_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participant_badges_select" ON public.participant_badges;
CREATE POLICY "participant_badges_select" ON public.participant_badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "participant_badges_manage" ON public.participant_badges;
CREATE POLICY "participant_badges_manage" ON public.participant_badges FOR ALL TO authenticated USING (public.current_user_is_staff());

-- Challenges
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  start_date date,
  end_date date,
  points_reward integer NOT NULL DEFAULT 10,
  challenge_type text DEFAULT 'task', -- task, attendance, learning, custom
  target_value integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges_select" ON public.challenges;
CREATE POLICY "challenges_select" ON public.challenges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "challenges_manage" ON public.challenges;
CREATE POLICY "challenges_manage" ON public.challenges FOR ALL TO authenticated USING (public.current_user_is_staff());

-- Challenge participants
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  progress integer DEFAULT 0,
  status text DEFAULT 'active', -- active, completed, failed
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, participant_id)
);
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenge_participants_select" ON public.challenge_participants;
CREATE POLICY "challenge_participants_select" ON public.challenge_participants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "challenge_participants_manage" ON public.challenge_participants;
CREATE POLICY "challenge_participants_manage" ON public.challenge_participants FOR ALL TO authenticated USING (public.current_user_is_staff());

-- ============================================================
-- 2. ENHANCED LMS
-- ============================================================

-- Add columns to lms_courses
ALTER TABLE public.lms_courses
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS pass_score integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Add columns to lms_lessons
ALTER TABLE public.lms_lessons
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Add sort_order to lms_modules
ALTER TABLE public.lms_modules
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Live sessions
CREATE TABLE IF NOT EXISTS public.lms_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_en text,
  meeting_url text,
  meeting_type text DEFAULT 'zoom', -- zoom, meet, teams, custom
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lms_live_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_sessions_select" ON public.lms_live_sessions;
CREATE POLICY "live_sessions_select" ON public.lms_live_sessions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "live_sessions_manage" ON public.lms_live_sessions;
CREATE POLICY "live_sessions_manage" ON public.lms_live_sessions FOR ALL TO authenticated USING (public.current_user_is_staff());

-- Course reviews
CREATE TABLE IF NOT EXISTS public.course_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_select" ON public.course_reviews;
CREATE POLICY "reviews_select" ON public.course_reviews FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "reviews_own" ON public.course_reviews;
CREATE POLICY "reviews_own" ON public.course_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reviews_manage" ON public.course_reviews;
CREATE POLICY "reviews_manage" ON public.course_reviews FOR ALL TO authenticated USING (public.current_user_is_staff());

-- Course discussions
CREATE TABLE IF NOT EXISTS public.course_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lms_lessons(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES public.course_discussions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.course_discussions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discussions_select" ON public.course_discussions;
CREATE POLICY "discussions_select" ON public.course_discussions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "discussions_insert" ON public.course_discussions;
CREATE POLICY "discussions_insert" ON public.course_discussions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "discussions_manage" ON public.course_discussions;
CREATE POLICY "discussions_manage" ON public.course_discussions FOR ALL TO authenticated USING (public.current_user_is_staff());

-- ============================================================
-- 3. IN-APP NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text DEFAULT 'info', -- info, success, warning, error, action
  priority text DEFAULT 'normal', -- low, normal, high, urgent
  read_at timestamptz,
  entity_type text, -- project, participant, course, task, etc.
  entity_id uuid,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.in_app_notifications;
CREATE POLICY "notif_select_own" ON public.in_app_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_update_own" ON public.in_app_notifications;
CREATE POLICY "notif_update_own" ON public.in_app_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert_staff" ON public.in_app_notifications;
CREATE POLICY "notif_insert_staff" ON public.in_app_notifications FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "notif_delete_own" ON public.in_app_notifications;
CREATE POLICY "notif_delete_own" ON public.in_app_notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_in_app_notif_user ON public.in_app_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_in_app_notif_created ON public.in_app_notifications(created_at DESC);

-- ============================================================
-- 4. ENHANCED CMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_type text NOT NULL DEFAULT 'content', -- hero, slider, stats, partners, testimonials, faq, cta, content
  title_ar text,
  title_en text,
  subtitle_ar text,
  subtitle_en text,
  content_ar text,
  content_en text,
  media_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean DEFAULT true,
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_sections_public" ON public.site_sections;
CREATE POLICY "site_sections_public" ON public.site_sections FOR SELECT USING (true);
DROP POLICY IF EXISTS "site_sections_manage" ON public.site_sections;
CREATE POLICY "site_sections_manage" ON public.site_sections FOR ALL TO authenticated USING (public.current_user_is_manager());

CREATE TABLE IF NOT EXISTS public.site_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners_public" ON public.site_partners;
CREATE POLICY "partners_public" ON public.site_partners FOR SELECT USING (true);
DROP POLICY IF EXISTS "partners_manage" ON public.site_partners;
CREATE POLICY "partners_manage" ON public.site_partners FOR ALL TO authenticated USING (public.current_user_is_manager());

CREATE TABLE IF NOT EXISTS public.site_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  role_ar text,
  role_en text,
  content_ar text NOT NULL,
  content_en text,
  avatar_url text,
  rating integer DEFAULT 5,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "testimonials_public" ON public.site_testimonials;
CREATE POLICY "testimonials_public" ON public.site_testimonials FOR SELECT USING (true);
DROP POLICY IF EXISTS "testimonials_manage" ON public.site_testimonials;
CREATE POLICY "testimonials_manage" ON public.site_testimonials FOR ALL TO authenticated USING (public.current_user_is_manager());

-- ============================================================
-- 5. PROJECT ENHANCEMENTS  
-- ============================================================

-- Project files/media
CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'document', -- document, image, video, pdf, youtube
  file_size integer DEFAULT 0,
  youtube_url text,
  description text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_files_select" ON public.project_files;
CREATE POLICY "project_files_select" ON public.project_files FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "project_files_manage" ON public.project_files;
CREATE POLICY "project_files_manage" ON public.project_files FOR ALL TO authenticated USING (public.current_user_is_staff());

-- Project registration requests
CREATE TABLE IF NOT EXISTS public.project_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  national_id text,
  email text,
  notes text,
  status text DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "registrations_select" ON public.project_registrations;
CREATE POLICY "registrations_select" ON public.project_registrations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "registrations_insert" ON public.project_registrations;
CREATE POLICY "registrations_insert" ON public.project_registrations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "registrations_manage" ON public.project_registrations;
CREATE POLICY "registrations_manage" ON public.project_registrations FOR ALL TO authenticated USING (public.current_user_is_staff());

-- ============================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_participant_badges_participant ON public.participant_badges(participant_id);
CREATE INDEX IF NOT EXISTS idx_challenges_project ON public.challenges(project_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_course_discussions_course ON public.course_discussions(course_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_registrations_project ON public.project_registrations(project_id, status);
CREATE INDEX IF NOT EXISTS idx_lms_live_sessions_course ON public.lms_live_sessions(course_id);

-- ============================================================
-- DONE
-- ============================================================
DO $$ BEGIN RAISE NOTICE 'Migration 20260520100000: Enterprise platform enhancement complete.'; END $$;
