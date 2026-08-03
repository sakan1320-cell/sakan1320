import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  LogOut,
  MessageSquare,
  PlayCircle,
  Star,
  Target,
  User as UserIcon,
  Zap,
  X,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Gift,
  Send,
  Lock,
  Megaphone,
  Check,
  HelpCircle,
  RefreshCw,
  Home,
  type LucideIcon,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { PortalSwitcher } from "@/components/PortalSwitcher";

interface ParticipantRow {
  id: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  status: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relation: string | null;
  project_id: string | null;
  auth_user_id: string | null;
  points: number | null;
  avatar_url?: string | null;
  learning_minutes?: number | null;
  weekly_goal_minutes?: number | null;
  last_learning_activity_at?: string | null;
  group_id?: string | null;
}

type Project = { id: string; name_ar: string; name_en: string | null; description?: string | null; start_date?: string | null; end_date?: string | null; excluded_weekdays?: number[] | null; excluded_dates?: string[] | null; enjaz_enabled?: boolean | null };
type Membership = { id: string; participant_id: string; project_id: string; status: string; enrolled_at: string; branch_id: string | null };
type Course = { id: string; title_ar: string; title_en: string | null; project_id: string | null; description?: string | null; cover_url?: string | null; thumbnail_url?: string | null; duration_minutes?: number | null };
type Enrollment = { id: string; course_id: string; user_id: string; status: string; progress: number; enrolled_at: string; completed_at?: string | null };
type LiveSession = { id: string; course_id: string; title_ar: string; title_en: string | null; scheduled_at: string; meeting_url: string | null; duration_minutes: number | null };
type Activity = { id: string; course_id: string; title_ar: string; title_en: string | null; activity_type: string; due_date: string | null; max_points: number | null };
type Submission = { id: string; activity_id: string; status: string; grade: number | null; submitted_at: string };
type Certificate = { id: string; course_id: string; code: string; verification_code?: string | null; verification_url?: string | null; qr_payload?: string | null; issued_at: string };
type PointLog = { id: string; delta: number; reason: string | null; created_at: string };
type BadgeRow = { id: string; badge_id: string; earned_at: string; badges?: { name_ar: string; name_en: string | null; icon: string | null; description_ar?: string | null } | null };
type NotificationRow = { id: string; title?: string; body: string | null; created_at: string; is_read?: boolean | null; action_url?: string | null };
type MessageRow = { id: string; body: string; created_at: string; sender_id: string };
type ProjectFile = { id: string; project_id: string; file_name: string; file_url: string; file_type: string | null; youtube_url?: string | null; description?: string | null };
type LearningContent = { id: string; project_id: string | null; content_type: string; title: string; body: string; scheduled_at: string | null };

interface EnjazGroup {
  id: string;
  name_ar: string;
  created_at: string;
}

interface EnjazTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  points_reward: number;
  start_date: string | null;
  end_date: string | null;
  target_group_id: string | null;
  created_at: string;
}

interface EnjazSubmission {
  id: string;
  task_id: string;
  participant_id: string;
  status: string; // pending, submitted, needs_review, approved, rejected
  submission_text: string;
  points_awarded: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  task?: { title: string; points_reward: number };
}

interface EnjazReward {
  id: string;
  project_id: string;
  name_ar: string;
  description_ar: string | null;
  points_required: number;
  quantity: number;
  is_active: boolean;
  created_at: string;
}

interface EnjazClaim {
  id: string;
  reward_id: string;
  participant_id: string;
  status: string; // pending, approved, rejected
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  reward?: { name_ar: string; points_required: number };
}

interface EnjazBadge {
  id: string;
  project_id: string | null;
  name_ar: string;
  icon: string;
  description_ar: string | null;
  points_reward: number;
  created_at: string;
}

const safe = async <T,>(request: PromiseLike<{ data: T | null; error?: { message: string } | null }>, fallback: T): Promise<T> => {
  try {
    const { data, error } = await request;
    if (error) {
      console.warn("[Portal] optional query failed:", error.message);
      return fallback;
    }
    return data ?? fallback;
  } catch (error) {
    console.warn("[Portal] optional query exception:", error);
    return fallback;
  }
};

const Portal = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut, hasAnyRole, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null; phone: string | null; avatar_url?: string | null } | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [points, setPoints] = useState<PointLog[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [content, setContent] = useState<LearningContent[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Array<{ date: string; status: string; project_id: string }>>([]);
  const [attCalendarDate, setAttCalendarDate] = useState(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Enjaz State Variables
  const [enjazLoading, setEnjazLoading] = useState(false);
  const [enjazGroups, setEnjazGroups] = useState<EnjazGroup[]>([]);
  const [enjazTasks, setEnjazTasks] = useState<EnjazTask[]>([]);
  const [enjazSubmissions, setEnjazSubmissions] = useState<EnjazSubmission[]>([]);
  const [enjazRewards, setEnjazRewards] = useState<EnjazReward[]>([]);
  const [enjazClaims, setEnjazClaims] = useState<EnjazClaim[]>([]);
  const [enjazBadges, setEnjazBadges] = useState<EnjazBadge[]>([]);
  const [enjazParticipantBadges, setEnjazParticipantBadges] = useState<any[]>([]);
  const [enjazAnnouncements, setEnjazAnnouncements] = useState<any[]>([]);
  const [enjazMessages, setEnjazMessages] = useState<any[]>([]);
  const [enjazQuizzes, setEnjazQuizzes] = useState<any[]>([]);
  const [enjazQuizAttempts, setEnjazQuizAttempts] = useState<any[]>([]);
  const [enjazPointsLogs, setEnjazPointsLogs] = useState<any[]>([]);

  // Task & Reward Actions State
  const [selectedTaskForSubmit, setSelectedTaskForSubmit] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [submitTaskLoading, setSubmitTaskLoading] = useState(false);

  const [selectedRewardForClaim, setSelectedRewardForClaim] = useState<any | null>(null);
  const [claimRewardLoading, setClaimRewardLoading] = useState(false);

  // Quiz States
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSecondsLeft, setQuizSecondsLeft] = useState(0);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  const quizAnswersRef = useRef<Record<number, number>>({});
  useEffect(() => {
    quizAnswersRef.current = quizAnswers;
  }, [quizAnswers]);

  // Load Enjaz Data Hook
  const loadEnjazData = useCallback(async (projId: string, partId: string) => {
    setEnjazLoading(true);
    try {
      const [groupsRes, tasksRes, subsRes, rewardsRes, claimsRes, badgesRes, partBadgesRes, annRes, msgRes, quizzesRes, attemptsRes, logsRes] = await Promise.all([
        supabase.from("project_groups").select("*").eq("project_id", projId),
        supabase.from("enjaz_tasks").select("*").eq("project_id", projId),
        supabase.from("enjaz_task_submissions").select("*, task:enjaz_tasks(title, points_reward)").eq("participant_id", partId),
        supabase.from("enjaz_rewards").select("*").eq("project_id", projId).eq("is_active", true),
        supabase.from("enjaz_reward_claims").select("*, reward:enjaz_rewards(name_ar, points_required)").eq("participant_id", partId),
        supabase.from("enjaz_badges").select("*"),
        supabase.from("enjaz_participant_badges").select("*, badge:enjaz_badges(*)").eq("participant_id", partId),
        supabase.from("enjaz_announcements").select("*").eq("project_id", projId).order("created_at", { ascending: false }),
        supabase.from("enjaz_messages").select("*").eq("recipient_id", partId).order("created_at", { ascending: false }),
        supabase.from("enjaz_quizzes").select("*, questions:enjaz_quiz_questions(*)").eq("project_id", projId).eq("is_active", true),
        supabase.from("enjaz_quiz_attempts").select("*").eq("participant_id", partId),
        supabase.from("participant_points_log").select("*").eq("participant_id", partId).order("created_at", { ascending: false })
      ]);

      setEnjazGroups(groupsRes.data || []);
      setEnjazTasks(tasksRes.data || []);
      setEnjazSubmissions(subsRes.data || []);
      setEnjazRewards(rewardsRes.data || []);
      setEnjazClaims(claimsRes.data || []);

      const allBadges = badgesRes.data || [];
      const projectBadges = allBadges.filter((b: any) => b.project_id === null || b.project_id === projId);
      setEnjazBadges(projectBadges);

      setEnjazParticipantBadges(partBadgesRes.data || []);
      setEnjazAnnouncements(annRes.data || []);
      setEnjazMessages(msgRes.data || []);
      setEnjazQuizzes(quizzesRes.data || []);
      setEnjazQuizAttempts(attemptsRes.data || []);
      setEnjazPointsLogs(logsRes.data || []);
    } catch (err) {
      console.error("Error loading Enjaz data:", err);
      toast.error(i18n.language === "ar" ? "حدث خطأ أثناء تحميل بيانات إنجاز" : "Error loading Enjaz data");
    } finally {
      setEnjazLoading(false);
    }
  }, [i18n.language]);

  // Level Definitions & Calculations
  const ENJAZ_LEVELS = useMemo(() => [
    { name: i18n.language === "ar" ? "بداية مشرقة 🌸" : "Bright Start 🌸", min: 0, max: 49 },
    { name: i18n.language === "ar" ? "مشاركة نشطة ⚡" : "Active Member ⚡", min: 50, max: 99 },
    { name: i18n.language === "ar" ? "متعلمة متقدمة 📈" : "Advanced Learner 📈", min: 100, max: 149 },
    { name: i18n.language === "ar" ? "منجزة متميزة ⭐" : "Distinguished Achiever ⭐", min: 150, max: 249 },
    { name: i18n.language === "ar" ? "قدوة حسنة 👑" : "Role Model 👑", min: 250, max: 499 },
    { name: i18n.language === "ar" ? "سفيرة الإنجاز 🏆" : "Enjaz Ambassador 🏆", min: 500, max: Infinity }
  ], [i18n.language]);

  const activeParticipant = useMemo(() => {
    return participants.find((p) => p.project_id === selectedProjectId);
  }, [participants, selectedProjectId]);

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const currentEnjazLevel = useMemo(() => {
    const pointsVal = activeParticipant?.points || 0;
    return ENJAZ_LEVELS.find(lvl => pointsVal >= lvl.min && pointsVal <= lvl.max) || ENJAZ_LEVELS[0];
  }, [activeParticipant, ENJAZ_LEVELS]);

  const nextEnjazLevel = useMemo(() => {
    const pointsVal = activeParticipant?.points || 0;
    const currentIndex = ENJAZ_LEVELS.findIndex(lvl => pointsVal >= lvl.min && pointsVal <= lvl.max);
    if (currentIndex >= 0 && currentIndex < ENJAZ_LEVELS.length - 1) {
      return ENJAZ_LEVELS[currentIndex + 1];
    }
    return null;
  }, [activeParticipant, ENJAZ_LEVELS]);

  const enjazLevelProgress = useMemo(() => {
    const pointsVal = activeParticipant?.points || 0;
    const currentLvl = currentEnjazLevel;
    const nextLvl = nextEnjazLevel;
    if (!nextLvl) return 100;
    const diff = nextLvl.min - currentLvl.min;
    const earned = pointsVal - currentLvl.min;
    return Math.min(100, Math.max(0, Math.round((earned / diff) * 100)));
  }, [activeParticipant, currentEnjazLevel, nextEnjazLevel]);

  // Load Enjaz Trigger
  useEffect(() => {
    if (selectedProjectId && activeProject?.enjaz_enabled && activeParticipant) {
      loadEnjazData(selectedProjectId, activeParticipant.id);
    }
  }, [selectedProjectId, activeProject, activeParticipant, loadEnjazData]);

  // Task Submission Handler
  const handleSubmitTask = async () => {
    if (!selectedTaskForSubmit || !activeParticipant) return;
    if (!submissionText.trim()) {
      toast.error(i18n.language === "ar" ? "يرجى كتابة نص الإنجاز" : "Please enter submission text");
      return;
    }
    setSubmitTaskLoading(true);
    try {
      const { error } = await supabase.from("enjaz_task_submissions").insert([{
        task_id: selectedTaskForSubmit.id,
        participant_id: activeParticipant.id,
        status: "pending",
        submission_text: submissionText,
      }]);
      if (error) throw error;
      toast.success(i18n.language === "ar" ? "تم إرسال إنجازك بنجاح للمشرفة للمراجعة!" : "Task submitted successfully for review!");
      setSubmissionText("");
      setSelectedTaskForSubmit(null);
      loadEnjazData(selectedProjectId!, activeParticipant.id);
    } catch (err) {
      console.error("Error submitting task:", err);
      toast.error((err as Error).message);
    } finally {
      setSubmitTaskLoading(false);
    }
  };

  // Reward Claims Handler
  const handleClaimReward = async () => {
    if (!selectedRewardForClaim || !activeParticipant) return;

    const pointsRequired = selectedRewardForClaim.points_required;
    const currentPoints = activeParticipant.points || 0;

    const pendingClaimsPoints = enjazClaims
      .filter(c => c.status === "pending")
      .reduce((sum, c) => sum + (c.reward?.points_required || 0), 0);

    const availablePoints = currentPoints - pendingClaimsPoints;

    if (availablePoints < pointsRequired) {
      toast.error(i18n.language === "ar" ? "نقاطك المتاحة لا تكفي (يرجى مراعاة الطلبات المعلقة)" : "Insufficient available points (considering pending claims)");
      return;
    }

    if (selectedRewardForClaim.quantity <= 0) {
      toast.error(i18n.language === "ar" ? "عذراً، نفدت كمية هذه الجائزة" : "Sorry, out of stock");
      return;
    }

    setClaimRewardLoading(true);
    try {
      const { error } = await supabase.from("enjaz_reward_claims").insert([{
        reward_id: selectedRewardForClaim.id,
        participant_id: activeParticipant.id,
        status: "pending"
      }]);
      if (error) throw error;
      toast.success(i18n.language === "ar" ? "تم إرسال طلب استبدال الجائزة بنجاح للمشرفة!" : "Claim request sent successfully!");
      setSelectedRewardForClaim(null);
      loadEnjazData(selectedProjectId!, activeParticipant.id);
    } catch (err) {
      console.error("Error claiming reward:", err);
      toast.error((err as Error).message);
    } finally {
      setClaimRewardLoading(false);
    }
  };

  // Quiz Taking Modal Handlers
  const submitQuiz = async (answers: Record<number, number>) => {
    if (!activeQuiz || !activeParticipant) return;
    setQuizSubmitting(true);
    try {
      let score = 0;
      let pointsAwarded = 0;
      const questions = activeQuiz.questions || [];

      questions.forEach((q: any, idx: number) => {
        const selectedOpt = answers[idx];
        if (selectedOpt === q.correct_option_index) {
          score++;
          pointsAwarded += q.points_reward || 5;
        }
      });

      const { error: attErr } = await supabase.from("enjaz_quiz_attempts").insert([{
        quiz_id: activeQuiz.id,
        participant_id: activeParticipant.id,
        score: score,
        points_awarded: pointsAwarded,
      }]);
      if (attErr) throw attErr;

      const currentPoints = activeParticipant.points || 0;
      const newPoints = currentPoints + pointsAwarded;
      const { error: partErr } = await supabase.from("participants").update({
        points: newPoints
      }).eq("id", activeParticipant.id);
      if (partErr) throw partErr;

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { error: logErr } = await supabase.from("participant_points_log").insert([{
        participant_id: activeParticipant.id,
        delta: pointsAwarded,
        reason: `${i18n.language === "ar" ? "مسابقة" : "Quiz"}: ${activeQuiz.title} (${score}/${questions.length})`,
        created_by: authUser?.id
      }]);
      if (logErr) throw logErr;

      toast.success(
        i18n.language === "ar"
          ? `أحسنتِ! تم إنهاء المسابقة بنجاح. النتيجة: ${score} من ${questions.length}. النقاط المكتسبة: +${pointsAwarded}`
          : `Great job! Quiz completed. Score: ${score}/${questions.length}. Points earned: +${pointsAwarded}`
      );

      const { data: updatedParts } = await supabase.from("participants").select("id,points").eq("id", activeParticipant.id);
      if (updatedParts && updatedParts.length > 0) {
        setParticipants(prev => prev.map(p => p.id === activeParticipant.id ? { ...p, points: updatedParts[0].points } : p));
      }

      loadEnjazData(selectedProjectId!, activeParticipant.id);
      setActiveQuiz(null);
    } catch (err) {
      console.error("Error submitting quiz:", err);
      toast.error(i18n.language === "ar" ? "حدث خطأ أثناء حفظ المسابقة" : "Error saving quiz");
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleAutoSubmitQuiz = () => {
    toast.info(i18n.language === "ar" ? "انتهى الوقت! يتم تسليم إجاباتك تلقائياً." : "Time's up! Submitting answers automatically.");
    submitQuiz(quizAnswersRef.current);
  };

  // Timer Effect
  useEffect(() => {
    if (!activeQuiz || quizSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setQuizSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQuiz, quizSecondsLeft]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    (async () => {
      setLoading(true);
      const prof = await safe(
        supabase.from("profiles").select("full_name,email,phone,avatar_url").eq("id", user.id).maybeSingle(),
        null
      );
      setProfile(prof);

      const parts = await safe(
        supabase.from("participants").select("id,full_name,national_id,phone,status,guardian_name,guardian_phone,guardian_relation,project_id,auth_user_id,points,learning_minutes,weekly_goal_minutes,last_learning_activity_at,group_id").eq("auth_user_id", user.id),
        [] as ParticipantRow[]
      );
      setParticipants(parts);

      const participantIds = parts.map((p) => p.id);
      if (participantIds.length === 0) {
        setLoading(false);
        return;
      }

      const [memberRows, pointRows, badgeRows, notificationRows, messageRows] = await Promise.all([
        safe(supabase.from("participant_project_memberships").select("id,participant_id,project_id,status,enrolled_at,branch_id").in("participant_id", participantIds), [] as Membership[]),
        safe(supabase.from("participant_points_log").select("id,delta,reason,created_at").in("participant_id", participantIds).order("created_at", { ascending: false }).limit(50), [] as PointLog[]),
        safe(supabase.from("participant_badges").select("id,badge_id,earned_at,badges(name_ar,name_en,icon,description_ar)").in("participant_id", participantIds).order("earned_at", { ascending: false }), [] as BadgeRow[]),
        safe(supabase.from("in_app_notifications").select("id,title,body,created_at,read_at,action_url").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20), [] as NotificationRow[]),
        safe(supabase.from("messages").select("id,body,created_at,sender_id").neq("sender_id", user.id).order("created_at", { ascending: false }).limit(20), [] as MessageRow[]),
      ]);
      setMemberships(memberRows);
      setPoints(pointRows);
      setBadges(badgeRows);
      setNotifications(notificationRows);
      setMessages(messageRows);

      const projectIds = Array.from(new Set([...memberRows.map((m) => m.project_id), ...parts.map((p) => p.project_id).filter(Boolean) as string[]]));
      const projectRows = projectIds.length
        ? await safe(supabase.from("projects").select("id,name_ar,name_en,description,start_date,end_date,excluded_weekdays,excluded_dates,enjaz_enabled").in("id", projectIds), [] as Project[])
        : [];
      setProjects(projectRows);

      const atts = participantIds.length
        ? await safe(supabase.from("attendance").select("date,status,project_id").in("subject_id", participantIds), [] as Array<{ date: string; status: string; project_id: string }>)
        : [];
      setAttendanceRecords(atts);

      const [enrollmentRows, certRows] = await Promise.all([
        safe(supabase.from("lms_enrollments").select("id,course_id,user_id,status,progress,enrolled_at,completed_at").eq("user_id", user.id), [] as Enrollment[]),
        safe(supabase.from("lms_certificates").select("id,course_id,code,verification_code,verification_url,qr_payload,issued_at").eq("user_id", user.id).order("issued_at", { ascending: false }), [] as Certificate[]),
      ]);
      setEnrollments(enrollmentRows);
      setCertificates(certRows);

      const courseIds = Array.from(new Set(enrollmentRows.map((e) => e.course_id)));
      const courseRows = courseIds.length
        ? await safe(supabase.from("lms_courses").select("id,title_ar,title_en,project_id,description,cover_url,thumbnail_url,duration_minutes").in("id", courseIds), [] as Course[])
        : projectIds.length
          ? await safe(supabase.from("lms_courses").select("id,title_ar,title_en,project_id,description,cover_url,thumbnail_url,duration_minutes").in("project_id", projectIds).eq("is_published", true), [] as Course[])
          : [];
      setCourses(courseRows);

      const visibleCourseIds = Array.from(new Set(courseRows.map((c) => c.id)));
      if (visibleCourseIds.length) {
        const [sessionRows, activityRows, submissionRows] = await Promise.all([
          safe(supabase.from("lms_live_sessions").select("id,course_id,title_ar,title_en,scheduled_at,meeting_url,duration_minutes").in("course_id", visibleCourseIds).order("scheduled_at", { ascending: true }).limit(20), [] as LiveSession[]),
          safe(supabase.from("lms_activities").select("id,course_id,title_ar,title_en,activity_type,due_date,max_points").in("course_id", visibleCourseIds).order("due_date", { ascending: true }).limit(50), [] as Activity[]),
          safe(supabase.from("lms_activity_submissions").select("id,activity_id,status,grade,submitted_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(50), [] as Submission[]),
        ]);
        setSessions(sessionRows);
        setActivities(activityRows);
        setSubmissions(submissionRows);
      }

      if (projectIds.length) {
        const [fileRows, contentRows] = await Promise.all([
          safe(supabase.from("project_files").select("id,project_id,file_name,file_url,file_type,youtube_url,description").in("project_id", projectIds).order("created_at", { ascending: false }).limit(30), [] as ProjectFile[]),
          safe(supabase.from("project_learning_content").select("id,project_id,content_type,title,body,scheduled_at").in("project_id", projectIds).eq("is_active", true).order("scheduled_at", { ascending: true }).limit(30), [] as LearningContent[]),
        ]);
        setFiles(fileRows);
        setContent(contentRows);
      }

      setLoading(false);
    })();
  }, [user, authLoading, navigate]);



  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const averageProgress = enrollments.length ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / enrollments.length) : 0;
  const totalPoints = participants.reduce((sum, p) => sum + (p.points || 0), 0);
  const completedCourses = enrollments.filter((e) => e.status === "completed" || e.progress >= 100).length;
  const pendingActivities = activities.filter((a) => !submissions.some((s) => s.activity_id === a.id && ["submitted", "graded"].includes(s.status))).length;
  const weeklyGoal = participants[0]?.weekly_goal_minutes || 120;
  const learningMinutes = participants.reduce((sum, p) => sum + (p.learning_minutes || 0), 0);
  const weeklyProgress = Math.min(100, Math.round((learningMinutes / weeklyGoal) * 100));
  const nextSession = sessions.find((s) => new Date(s.scheduled_at) >= new Date());
  const currentLevel = getLevel(totalPoints);
  const nextLevel = getNextLevel(totalPoints);
  const levelProgress = nextLevel ? Math.min(100, Math.round(((totalPoints - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)) : 100;

  const getAttendanceData = (pid?: string | null) => {
    const activePid = pid || participants[0]?.project_id;
    const proj = projects.find(p => p.id === activePid);
    if (!proj) return { list: [], presentCount: 0, absentCount: 0, excusedCount: 0, rate: 0 };

    let startStr = proj.start_date;
    if (!startStr) {
      const activeMembership = memberships.find(m => m.project_id === activePid && m.participant_id === participants[0]?.id);
      if (activeMembership) {
        startStr = activeMembership.enrolled_at.slice(0, 10);
      } else if (attendanceRecords.length > 0) {
        const sorted = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
        startStr = sorted[0].date;
      } else {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startStr = d.toISOString().slice(0, 10);
      }
    }

    const start = new Date(startStr);
    const rawEnd = proj.end_date ? new Date(proj.end_date) : new Date();
    const today = new Date();
    const end = rawEnd < today ? rawEnd : today;

    const list = [];
    let current = new Date(start);
    
    const projectAtts = attendanceRecords.filter(r => r.project_id === activePid);
    const attMap = new Map(projectAtts.map(r => [r.date, r.status]));
    const customHolidays = proj.excluded_dates || [];
    const fixedHolidays = proj.excluded_weekdays || [];

    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    const daysAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = current.getDay();

      const isDefaultWorkday = !fixedHolidays.includes(dayOfWeek);
      const isOverridden = customHolidays.includes(dateStr);
      const isWorkingDay = isDefaultWorkday ? !isOverridden : isOverridden;

      if (!isWorkingDay) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      const dbStatus = attMap.get(dateStr);
      let finalStatus: "present" | "absent" | "excused";
      
      if (dbStatus === "present" || dbStatus === "late") {
        finalStatus = "present";
        presentCount++;
      } else if (dbStatus === "excused") {
        finalStatus = "excused";
        excusedCount++;
      } else {
        finalStatus = "absent";
        absentCount++;
      }

      list.push({
        date: dateStr,
        dayName: i18n.language === "ar" ? daysAr[dayOfWeek] : daysEn[dayOfWeek],
        status: finalStatus
      });

      current.setDate(current.getDate() + 1);
    }

    list.reverse();

    const totalWorking = presentCount + absentCount;
    const rate = totalWorking ? Math.round((presentCount / totalWorking) * 100) : 0;

    return { list, presentCount, absentCount, excusedCount, rate };
  };

  const attData = getAttendanceData(selectedProjectId);

  const isBadgeEarned = (badgeId: string) => {
    return enjazParticipantBadges.some(pb => pb.badge_id === badgeId);
  };

  const getBadgeEarnedDate = (badgeId: string) => {
    const pb = enjazParticipantBadges.find(pb => pb.badge_id === badgeId);
    return pb ? new Date(pb.earned_at).toLocaleDateString(i18n.language === "ar" ? "ar-EG" : "en-US") : null;
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white p-1 shadow-sm">
              <img src={logo} alt={t("app.name")} className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-bold">{t("portal.title", "بوابة المشاركين")}</div>
              <div className="text-xs text-muted-foreground">{t("portal.learningSubtitle", "منصة التعلم والتحفيز")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PortalSwitcher />

            <LanguageToggle />

          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-8 w-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold">{participants[0]?.full_name || profile?.full_name || user?.email}</h1>
                  <p className="text-sm text-muted-foreground">{profile?.email || participants[0]?.national_id || "-"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {roles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
                    <Badge><Star className="h-3 w-3" /> {totalPoints} {t("participants.points", "نقطة")}</Badge>
                    <Badge variant="outline">{currentLevel.name}</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Metric icon={Target} label={t("lms.progress", "نسبة الإنجاز")} value={`${averageProgress}%`} />
                <Metric icon={BookOpen} label={t("portal.courses", "الدورات")} value={`${completedCourses}/${courses.length}`} />
                <Metric icon={Clock} label={t("portal.learningTime", "وقت التعلم")} value={`${learningMinutes}m`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("portal.keepLearning", "استمر في التعلم")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressLine label={t("portal.levelProgress", "تقدم المستوى")} value={levelProgress} />
              <ProgressLine label={t("portal.weeklyGoal", "هدف الأسبوع")} value={weeklyProgress} />
              <Button className="w-full" asChild disabled={courses.length === 0}>
                <Link to={courses[0] ? `/courses/${courses[0].id}` : "/portal"}>
                  <PlayCircle className="h-4 w-4" />
                  {t("portal.continueLearning", "استكمال من آخر نقطة")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {participants.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {t("portal.noRecords", "لا توجد سجلات مشاركة مرتبطة بحسابك حاليًا. تواصل مع الإدارة لربط بياناتك.")}
            </CardContent>
          </Card>
        ) : selectedProjectId ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-card/50 backdrop-blur-sm p-4 rounded-xl border border-border/50 shadow-sm flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedProjectId(null)}
                  className="font-semibold text-xs border-primary/20 text-primary hover:bg-primary/5"
                >
                  {i18n.language === "ar" ? "← العودة للمشاريع" : "← Back to Projects"}
                </Button>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {projectMap.get(selectedProjectId) ? displayName(projectMap.get(selectedProjectId)!.name_ar, projectMap.get(selectedProjectId)!.name_en, i18n.language) : ""}
                  </h2>
                </div>
              </div>
              {projectMap.get(selectedProjectId)?.description && (
                <div className="text-xs text-muted-foreground max-w-md">
                  {projectMap.get(selectedProjectId)?.description}
                </div>
              )}
            </div>

            <Tabs defaultValue="learning" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger value="learning">{t("dashboard.tabs.lms", "التعلم")}</TabsTrigger>
                <TabsTrigger value="activities">{t("portal.activities", "الأنشطة")}</TabsTrigger>
                <TabsTrigger value="attendance">{t("nav.attendance", "الحضور والغياب")}</TabsTrigger>
                {activeProject?.enjaz_enabled && (
                  <TabsTrigger value="enjaz" className="font-bold text-primary data-[state=active]:bg-primary/10">
                    <Trophy className="h-4 w-4 me-1.5 animate-pulse" />
                    {i18n.language === "ar" ? "لوحة إنجاز 🏆" : "Enjaz Dashboard 🏆"}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="learning" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(() => {
                    const filteredCourses = courses.filter(c => c.project_id === selectedProjectId);
                    if (filteredCourses.length === 0) return <Empty text={t("lms.noEnrollments", "لم تسجل في أي دورة")} />;
                    return filteredCourses.map((course) => {
                      const enrollment = enrollments.find((e) => e.course_id === course.id);
                      return (
                        <Card key={course.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                                {course.thumbnail_url || course.cover_url ? <img src={(course.thumbnail_url || course.cover_url) as string} alt="" className="h-full w-full rounded-md object-cover" /> : <GraduationCap className="h-6 w-6" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link to={`/courses/${course.id}`} className="font-medium hover:text-primary">{displayName(course.title_ar, course.title_en, i18n.language)}</Link>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{course.description || t("portal.recommendedCourse", "دورة مقترحة ضمن مشروعك")}</p>
                              </div>
                            </div>
                            <ProgressLine label={t("lms.progress", "التقدم")} value={enrollment?.progress || 0} className="mt-4" />
                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{enrollment?.status || t("portal.available", "متاحة")}</span>
                              <span>{course.duration_minutes || 0}m</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>

                {(() => {
                  const filteredSessions = sessions.filter(s => courseMap.get(s.course_id)?.project_id === selectedProjectId);
                  return (
                    <SectionList
                      title={t("portal.liveSessions", "اللقاءات المباشرة")}
                      icon={CalendarDays}
                      items={filteredSessions.map((s) => ({
                        id: s.id,
                        title: displayName(s.title_ar, s.title_en, i18n.language),
                        meta: `${courseMap.get(s.course_id) ? displayName(courseMap.get(s.course_id)!.title_ar, courseMap.get(s.course_id)!.title_en, i18n.language) : ""} - ${new Date(s.scheduled_at).toLocaleString(i18n.language === "ar" ? "ar-EG" : "en-US")}`,
                        href: s.meeting_url || undefined,
                      }))}
                    />
                  );
                })()}
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                {(() => {
                  const filteredActivities = activities.filter(a => courseMap.get(a.course_id)?.project_id === selectedProjectId);
                  return (
                    <SectionList
                      title={t("portal.assignmentsAndActivities", "الواجبات والأنشطة والاختبارات")}
                      icon={CheckCircle2}
                      items={filteredActivities.map((a) => {
                        const submission = submissions.find((s) => s.activity_id === a.id);
                        return {
                          id: a.id,
                          title: displayName(a.title_ar, a.title_en, i18n.language),
                          meta: `${a.activity_type} - ${a.due_date ? new Date(a.due_date).toLocaleDateString() : t("common.notSet")} - ${submission?.status || t("portal.notSubmitted", "لم يرسل")}`,
                          badge: submission?.grade != null ? `${submission.grade}/${a.max_points || 100}` : undefined,
                        };
                      })}
                    />
                  );
                })()}
                <SectionList
                  title={t("portal.educationalHistory", "السجل التعليمي وآخر النشاطات")}
                  icon={Clock}
                  items={points.slice(0, 10).map((p) => ({ id: p.id, title: p.reason || t("participants.points", "النقاط"), meta: new Date(p.created_at).toLocaleString(), badge: `${p.delta > 0 ? "+" : ""}${p.delta}` }))}
                />
              </TabsContent>

              <TabsContent value="attendance" className="space-y-6">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
                  <Card className="border-none shadow-sm bg-emerald-500/5 border-emerald-500/20">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">{i18n.language === "ar" ? "أيام الحضور" : "Days Present"}</div>
                        <div className="text-2xl font-black text-emerald-500 mt-1">{attData.presentCount}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-destructive/5 border-destructive/20">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                        <X className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">{i18n.language === "ar" ? "أيام الغياب" : "Days Absent"}</div>
                        <div className="text-2xl font-black text-destructive mt-1">{attData.absentCount}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-amber-500/5 border-amber-500/20">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">{i18n.language === "ar" ? "أيام الاستئذان" : "Days Excused"}</div>
                        <div className="text-2xl font-black text-amber-500 mt-1">{attData.excusedCount}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-primary/5 border-primary/20">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium">{i18n.language === "ar" ? "نسبة الحضور" : "Attendance Rate"}</div>
                        <div className="text-2xl font-black text-primary mt-1">{attData.rate}%</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3 border-b flex flex-row items-center justify-between flex-wrap gap-4">
                    <CardTitle className="text-lg font-bold">
                      {i18n.language === "ar" ? "تقويم الحضور والغياب" : "Attendance Calendar"}
                    </CardTitle>
                    
                    <div className="flex items-center gap-3 bg-muted/40 p-1.5 rounded-lg border border-border/50">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 rounded-md" 
                        onClick={() => {
                          setAttCalendarDate(new Date(attCalendarDate.getFullYear(), attCalendarDate.getMonth() - 1, 1));
                        }}
                      >
                        <ChevronRight className="h-4 w-4 rtl:hidden" />
                        <ChevronLeft className="h-4 w-4 ltr:hidden" />
                      </Button>
                      <span className="text-sm font-bold min-w-[100px] text-center">
                        {attCalendarDate.toLocaleString(i18n.language === "ar" ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 rounded-md" 
                        onClick={() => {
                          setAttCalendarDate(new Date(attCalendarDate.getFullYear(), attCalendarDate.getMonth() + 1, 1));
                        }}
                      >
                        <ChevronLeft className="h-4 w-4 rtl:hidden" />
                        <ChevronRight className="h-4 w-4 ltr:hidden" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs font-bold px-2.5 border-primary/20 hover:bg-primary/5 text-primary"
                        onClick={() => setAttCalendarDate(new Date())}
                      >
                        {i18n.language === "ar" ? "اليوم" : "Today"}
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-4">
                    {(() => {
                      const pid = selectedProjectId;
                      const proj = projects.find(p => p.id === pid);
                      if (!proj) return <div className="text-center py-6 text-muted-foreground">{i18n.language === "ar" ? "لا توجد بيانات للمشروع" : "No project data"}</div>;

                      const fixedHolidays = proj.excluded_weekdays || [];
                      const customHolidays = proj.excluded_dates || [];
                      const startDate = proj.start_date;
                      const endDate = proj.end_date;

                      const year = attCalendarDate.getFullYear();
                      const month = attCalendarDate.getMonth();
                      const startDayOfMonth = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const paddingDays = (startDayOfMonth + 1) % 7;

                      const ARABIC_WEEKDAYS = [
                        { id: 6, label: "السبت", labelEn: "Saturday" },
                        { id: 0, label: "الأحد", labelEn: "Sunday" },
                        { id: 1, label: "الإثنين", labelEn: "Monday" },
                        { id: 2, label: "الثلاثاء", labelEn: "Tuesday" },
                        { id: 3, label: "الأربعاء", labelEn: "Wednesday" },
                        { id: 4, label: "الخميس", labelEn: "Thursday" },
                        { id: 5, label: "الجمعة", labelEn: "Friday" },
                      ];

                      const attMap = new Map(attendanceRecords.filter(r => r.project_id === pid).map(r => [r.date, r.status]));
                      const todayStr = new Date().toISOString().slice(0, 10);

                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-7 border-b border-border/80 bg-muted/20 text-center py-2.5 rounded-t-lg">
                            {ARABIC_WEEKDAYS.map((day) => (
                              <span key={day.id} className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {i18n.language === "ar" ? day.label : day.labelEn.slice(0, 3)}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 text-center gap-1.5">
                            {Array.from({ length: paddingDays }).map((_, idx) => (
                              <div key={`pad-${idx}`} className="h-16 rounded-md bg-muted/5 border border-dashed border-border/20 opacity-30" />
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, idx) => {
                              const dayNum = idx + 1;
                              const dateObject = new Date(year, month, dayNum);
                              const dayOfWeek = dateObject.getDay();
                              
                              const y = dateObject.getFullYear();
                              const mStr = String(dateObject.getMonth() + 1).padStart(2, '0');
                              const dStr = String(dateObject.getDate()).padStart(2, '0');
                              const dateStr = `${y}-${mStr}-${dStr}`;

                              const isDefaultWorkday = !fixedHolidays.includes(dayOfWeek);
                              const isOverridden = customHolidays.includes(dateStr);
                              const isWorkingDay = isDefaultWorkday ? !isOverridden : isOverridden;

                              const isBeforeStart = startDate ? dateStr < startDate : false;
                              const isAfterEnd = endDate ? dateStr > endDate : false;
                              const isOutOfRange = isBeforeStart || isAfterEnd;

                              const dbStatus = attMap.get(dateStr);
                              const isToday = dateStr === todayStr;

                              return (
                                <div 
                                  key={dayNum} 
                                  className={`h-16 rounded-lg border relative flex flex-col items-center justify-between p-1.5 transition-all select-none
                                    ${isToday ? "ring-2 ring-primary ring-offset-1 z-10 scale-105 shadow-md" : ""}
                                    ${isOutOfRange 
                                      ? "bg-muted/40 border-border/60 text-muted-foreground" 
                                      : !isWorkingDay 
                                        ? "bg-muted/40 border-border/60 text-muted-foreground" 
                                        : dbStatus === "present" || dbStatus === "late"
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 shadow-sm"
                                          : dbStatus === "excused"
                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-700 shadow-sm"
                                            : dateStr < todayStr
                                              ? "bg-destructive/10 border-destructive/30 text-destructive-700 shadow-sm"
                                              : isToday
                                                ? "bg-primary/5 border-primary text-primary font-bold shadow-sm"
                                                : "bg-background border-border/80 hover:bg-accent/40"
                                    }`}
                                >
                                  <span className={`text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center
                                    ${isToday
                                      ? "bg-primary text-white"
                                      : isOutOfRange
                                        ? "text-muted-foreground"
                                        : !isWorkingDay
                                          ? "text-muted-foreground"
                                          : dbStatus === "present" || dbStatus === "late"
                                            ? "bg-emerald-500/20 text-emerald-700"
                                            : dbStatus === "excused"
                                              ? "bg-amber-500/20 text-amber-700"
                                              : dateStr < todayStr
                                                ? "bg-destructive/20 text-destructive-700"
                                                : "text-foreground"
                                    }`}
                                  >
                                    {dayNum}
                                  </span>

                                  <div className="mt-1 flex items-center justify-center">
                                    {!isOutOfRange && isWorkingDay && (
                                      <>
                                        {(dbStatus === "present" || dbStatus === "late") && (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600 animate-in fade-in zoom-in-75 duration-300" />
                                        )}
                                        {dbStatus === "excused" && (
                                          <Clock className="h-4 w-4 text-amber-600 animate-in fade-in zoom-in-75 duration-300" />
                                        )}
                                        {dbStatus !== "present" && dbStatus !== "late" && dbStatus !== "excused" && dateStr < todayStr && (
                                          <X className="h-4 w-4 text-destructive animate-in fade-in zoom-in-75 duration-300" />
                                        )}
                                        {isToday && !dbStatus && (
                                          <span className="text-[8px] bg-primary/20 text-primary px-1 rounded">
                                            {i18n.language === "ar" ? "اليوم" : "Today"}
                                          </span>
                                        )}
                                        {dateStr > todayStr && (
                                          <span className="text-[8px] text-muted-foreground">
                                            {i18n.language === "ar" ? "مقبل" : "Upcoming"}
                                          </span>
                                        )}
                                      </>
                                    )}
                                    {!isOutOfRange && !isWorkingDay && (
                                      <span className="text-[8px] text-muted-foreground bg-muted/60 px-1 rounded">
                                        {i18n.language === "ar" ? "خارج البرنامج" : "Off"}
                                      </span>
                                    )}
                                    {isOutOfRange && (
                                      <span className="text-[8px] text-muted-foreground bg-muted/60 px-1 rounded">
                                        {i18n.language === "ar" ? "خارج البرنامج" : "Off"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground font-medium">
                            <div className="flex items-center gap-1.5">
                              <div className="h-3.5 w-3.5 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                              </div>
                              <span>{i18n.language === "ar" ? "حاضر" : "Present"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-3.5 w-3.5 rounded bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                                <X className="h-2.5 w-2.5 text-destructive" />
                              </div>
                              <span>{i18n.language === "ar" ? "غائب" : "Absent"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-3.5 w-3.5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                                <Clock className="h-2.5 w-2.5 text-amber-600" />
                              </div>
                              <span>{i18n.language === "ar" ? "مستأذن" : "Excused"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-3.5 w-3.5 rounded bg-muted/45 border border-border/60" />
                              <span>{i18n.language === "ar" ? "خارج البرنامج" : "Non-program day"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {activeProject?.enjaz_enabled && (
                <TabsContent value="enjaz" className="space-y-6">
                  {enjazLoading ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : !activeParticipant ? (
                    <Card>
                      <CardContent className="p-6 text-center text-sm text-muted-foreground">
                        {i18n.language === "ar"
                          ? "لم يتم العثور على سجل مشاركة نشط لك في هذا المشروع."
                          : "No active participant record found for you in this project."}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                      {/* Top Summary Header Section */}
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                        {/* level card */}
                        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col justify-between p-5">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground font-semibold">
                                {i18n.language === "ar" ? "المستوى الحالي" : "Current Level"}
                              </span>
                              <h3 className="text-lg font-black text-primary">{currentEnjazLevel.name}</h3>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                              {activeParticipant.points || 0}
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {nextEnjazLevel 
                                  ? (i18n.language === "ar" ? `الهدف التالي: ${nextEnjazLevel.name}` : `Next: ${nextEnjazLevel.name}`)
                                  : (i18n.language === "ar" ? "وصلتِ للحد الأقصى! 🎉" : "Max level achieved! 🎉")
                                }
                              </span>
                              {nextEnjazLevel && (
                                <span className="font-semibold text-primary">
                                  {activeParticipant.points || 0} / {nextEnjazLevel.min}
                                </span>
                              )}
                            </div>
                            <Progress value={enjazLevelProgress} className="h-2" />
                          </div>
                        </Card>

                        {/* group card */}
                        <Card className="border-none shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5 flex items-center gap-4 p-5">
                          <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                            <Users className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground font-semibold">
                              {i18n.language === "ar" ? "المجموعة التربوية" : "Educational Group"}
                            </div>
                            <div className="text-lg font-black mt-1">
                              {activeParticipant.group_id
                                ? (enjazGroups.find(g => g.id === activeParticipant.group_id)?.name_ar || (i18n.language === "ar" ? "جاري التحميل..." : "Loading..."))
                                : (i18n.language === "ar" ? "بدون مجموعة حالياً" : "Not grouped yet")}
                            </div>
                          </div>
                        </Card>

                        {/* stats summary card */}
                        <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/10 to-purple-500/5 flex items-center justify-between p-5">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center">
                              <Trophy className="h-6 w-6" />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground font-semibold">
                                {i18n.language === "ar" ? "إنجازاتك" : "Achievements"}
                              </div>
                              <div className="text-sm text-muted-foreground mt-0.5">
                                {i18n.language === "ar" 
                                  ? `${enjazParticipantBadges.length} أوسمة • ${enjazSubmissions.filter(s => s.status === "approved").length} مهام معتمدة`
                                  : `${enjazParticipantBadges.length} Badges • ${enjazSubmissions.filter(s => s.status === "approved").length} Tasks`}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>

                      {/* Main Enjaz Content Sub-Tabs */}
                      <Tabs defaultValue="enjaz-tasks" className="space-y-4">
                        <TabsList className="bg-muted/40 p-1 rounded-lg flex-wrap h-auto gap-1 border border-border/50">
                          <TabsTrigger value="enjaz-tasks" className="rounded-md text-xs font-semibold">
                            {i18n.language === "ar" ? "المهام والمسابقات 📝" : "Tasks & Quizzes 📝"}
                          </TabsTrigger>
                          <TabsTrigger value="enjaz-rewards" className="rounded-md text-xs font-semibold">
                            {i18n.language === "ar" ? "الجوائز والتحفيز 🎁" : "Rewards & Shop 🎁"}
                          </TabsTrigger>
                          <TabsTrigger value="enjaz-badges" className="rounded-md text-xs font-semibold">
                            {i18n.language === "ar" ? "أوسمة الشرف 🎖️" : "Honor Badges 🎖️"}
                          </TabsTrigger>
                          <TabsTrigger value="enjaz-logs" className="rounded-md text-xs font-semibold">
                            {i18n.language === "ar" ? "سجل الإنجاز والرسائل 💬" : "Logs & Messages 💬"}
                          </TabsTrigger>
                        </TabsList>

                        {/* SUB-TAB 1: TASKS & QUIZZES */}
                        <TabsContent value="enjaz-tasks" className="space-y-6">
                          {/* Tasks Section */}
                          <div className="space-y-3">
                            <h3 className="text-base font-bold flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                              {i18n.language === "ar" ? "المهام والواجبات المطلوبة" : "Required Tasks"}
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {enjazTasks.length === 0 ? (
                                <div className="col-span-full border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
                                  {i18n.language === "ar" ? "لا توجد مهام مسندة حالياً." : "No tasks assigned yet."}
                                </div>
                              ) : (
                                enjazTasks
                                  .filter(task => !task.target_group_id || task.target_group_id === activeParticipant.group_id)
                                  .map(task => {
                                    const userSub = enjazSubmissions.find(s => s.task_id === task.id);
                                    return (
                                      <Card key={task.id} className="flex flex-col justify-between overflow-hidden relative border border-border hover:border-primary/40 transition-all shadow-sm">
                                        <div className="p-4 space-y-3">
                                          <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-base text-foreground line-clamp-1">{task.title}</h4>
                                            <Badge variant="secondary" className="bg-primary/10 text-primary font-bold text-xs">
                                              +{task.points_reward} {i18n.language === "ar" ? "نقطة" : "Pts"}
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description || (i18n.language === "ar" ? "لا يوجد وصف" : "No description")}</p>
                                          {task.end_date && (
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                                              <CalendarDays className="h-3 w-3" />
                                              {i18n.language === "ar" ? "تاريخ النهاية: " : "End date: "}
                                              {new Date(task.end_date).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                        <div className="px-4 py-3 bg-muted/20 border-t flex items-center justify-between">
                                          {userSub ? (
                                            <>
                                              <Badge 
                                                variant={
                                                  userSub.status === "approved" 
                                                    ? "secondary" 
                                                    : userSub.status === "rejected" 
                                                      ? "destructive" 
                                                      : "outline"
                                                }
                                                className={`text-[10px] font-bold ${
                                                  userSub.status === "approved" 
                                                    ? "bg-emerald-500/10 text-emerald-700" 
                                                    : ""
                                                }`}
                                              >
                                                {userSub.status === "approved" && (i18n.language === "ar" ? "معتمدة ✓" : "Approved ✓")}
                                                {userSub.status === "pending" && (i18n.language === "ar" ? "قيد المراجعة 🕒" : "Under review 🕒")}
                                                {userSub.status === "rejected" && (i18n.language === "ar" ? "مرفوضة ❌" : "Rejected ❌")}
                                              </Badge>
                                              {userSub.status === "rejected" && (
                                                <Button 
                                                  size="sm" 
                                                  variant="outline" 
                                                  onClick={() => setSelectedTaskForSubmit(task)}
                                                  className="h-7 text-xs font-semibold"
                                                >
                                                  {i18n.language === "ar" ? "إعادة تقديم" : "Resubmit"}
                                                </Button>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              <span className="text-[10px] text-primary font-bold">
                                                {i18n.language === "ar" ? "لم يتم التسليم بعد" : "Not submitted yet"}
                                              </span>
                                              <Button 
                                                size="sm" 
                                                onClick={() => setSelectedTaskForSubmit(task)}
                                                className="h-7 text-xs font-semibold"
                                              >
                                                <Send className="h-3 w-3 me-1.5" />
                                                {i18n.language === "ar" ? "تسليم الإنجاز" : "Submit Work"}
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </Card>
                                    );
                                  })
                              )}
                            </div>
                          </div>

                          {/* Quizzes Section */}
                          <div className="space-y-3 pt-4 border-t">
                            <h3 className="text-base font-bold flex items-center gap-2">
                              <Trophy className="h-5 w-5 text-amber-500" />
                              {i18n.language === "ar" ? "المسابقات والبطولات النشطة" : "Active Quizzes & Contests"}
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                              {enjazQuizzes.length === 0 ? (
                                <div className="col-span-full border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
                                  {i18n.language === "ar" ? "لا توجد مسابقات نشطة حالياً." : "No active quizzes."}
                                </div>
                              ) : (
                                enjazQuizzes.map(quiz => {
                                  const attempt = enjazQuizAttempts.find(a => a.quiz_id === quiz.id);
                                  const questionsCount = quiz.questions?.length || 0;
                                  return (
                                    <Card key={quiz.id} className="p-4 space-y-4 border border-border shadow-sm flex flex-col justify-between hover:border-amber-500/40 transition-all">
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                          <h4 className="font-bold text-base text-foreground line-clamp-1">{quiz.title}</h4>
                                          <Badge variant="outline" className="text-xs font-semibold flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {quiz.duration_minutes} {i18n.language === "ar" ? "دقيقة" : "Min"}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {i18n.language === "ar" 
                                            ? `تتكون المسابقة من ${questionsCount} أسئلة رصد ذكية.` 
                                            : `This quiz contains ${questionsCount} questions.`}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between pt-2 border-t text-xs">
                                        {attempt ? (
                                          <>
                                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 font-bold">
                                              {i18n.language === "ar" 
                                                ? `النتيجة: ${attempt.score}/${questionsCount}` 
                                                : `Score: ${attempt.score}/${questionsCount}`}
                                            </Badge>
                                            <span className="text-muted-foreground font-semibold">
                                              +{attempt.points_awarded} {i18n.language === "ar" ? "نقطة" : "Pts"}
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-amber-600 font-semibold">
                                              {i18n.language === "ar" ? "مسابقة نشطة" : "Active Quiz"}
                                            </span>
                                            <Button 
                                              size="sm" 
                                              disabled={questionsCount === 0}
                                              onClick={() => {
                                                setActiveQuiz(quiz);
                                                setQuizQuestionIndex(0);
                                                setQuizAnswers({});
                                                setQuizSecondsLeft((quiz.duration_minutes || 10) * 60);
                                              }}
                                              className="bg-amber-500 hover:bg-amber-600 font-bold text-white text-xs h-8"
                                            >
                                              {i18n.language === "ar" ? "بدء المسابقة" : "Start Quiz"}
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </Card>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        {/* SUB-TAB 2: REWARDS SHOP */}
                        <TabsContent value="enjaz-rewards" className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h3 className="text-base font-bold flex items-center gap-2">
                                <Gift className="h-5 w-5 text-primary" />
                                {i18n.language === "ar" ? "متجر الجوائز المتاحة للاستبدال" : "Available Rewards"}
                              </h3>
                              <div className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                                {i18n.language === "ar" ? "النقاط المتاحة: " : "Available Points: "}
                                {(activeParticipant.points || 0) - enjazClaims.filter(c => c.status === "pending").reduce((sum, c) => sum + (c.reward?.points_required || 0), 0)}
                              </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                              {enjazRewards.length === 0 ? (
                                <div className="col-span-full border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
                                  {i18n.language === "ar" ? "لا توجد جوائز نشطة معروضة حالياً." : "No rewards available yet."}
                                </div>
                              ) : (
                                enjazRewards.map(reward => {
                                  const isOutOfStock = reward.quantity <= 0;
                                  const pendingClaimsPoints = enjazClaims
                                    .filter(c => c.status === "pending")
                                    .reduce((sum, c) => sum + (c.reward?.points_required || 0), 0);
                                  const availablePoints = (activeParticipant.points || 0) - pendingClaimsPoints;
                                  const isAffordable = availablePoints >= reward.points_required;
                                  
                                  return (
                                    <Card key={reward.id} className="flex flex-col justify-between overflow-hidden border border-border hover:border-primary/40 transition-all shadow-sm">
                                      <div className="p-4 space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                          <h4 className="font-bold text-base text-foreground line-clamp-1">{reward.name_ar}</h4>
                                          <Badge variant="outline" className="border-primary/30 text-primary font-bold text-xs shrink-0">
                                            {reward.points_required} {i18n.language === "ar" ? "نقطة" : "Pts"}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{reward.description_ar || (i18n.language === "ar" ? "لا يوجد وصف" : "No description")}</p>
                                        <div className="text-[10px] text-muted-foreground font-semibold">
                                          {i18n.language === "ar" ? `الكمية المتوفرة: ${reward.quantity}` : `Stock available: ${reward.quantity}`}
                                        </div>
                                      </div>
                                      <div className="p-3 bg-muted/20 border-t">
                                        <Button
                                          size="sm"
                                          className="w-full font-bold h-8 text-xs"
                                          disabled={isOutOfStock || !isAffordable}
                                          onClick={() => setSelectedRewardForClaim(reward)}
                                          variant={isOutOfStock ? "secondary" : isAffordable ? "default" : "outline"}
                                        >
                                          {isOutOfStock 
                                            ? (i18n.language === "ar" ? "نفدت الكمية" : "Out of stock") 
                                            : isAffordable 
                                              ? (i18n.language === "ar" ? "استبدال النقاط" : "Redeem Points") 
                                              : (i18n.language === "ar" ? "النقاط غير كافية" : "Not enough points")}
                                        </Button>
                                      </div>
                                    </Card>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Claims history */}
                          <div className="space-y-3 pt-4 border-t">
                            <h3 className="text-base font-bold flex items-center gap-2">
                              <Clock className="h-5 w-5 text-muted-foreground" />
                              {i18n.language === "ar" ? "سجل طلبات التحصيل السابقة" : "Redemptions History"}
                            </h3>
                            <div className="border rounded-lg overflow-hidden bg-background">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{i18n.language === "ar" ? "الجائزة" : "Reward"}</TableHead>
                                    <TableHead>{i18n.language === "ar" ? "النقاط" : "Points"}</TableHead>
                                    <TableHead>{i18n.language === "ar" ? "تاريخ الطلب" : "Requested Date"}</TableHead>
                                    <TableHead className="text-end">{i18n.language === "ar" ? "حالة الطلب" : "Status"}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {enjazClaims.map(claim => (
                                    <TableRow key={claim.id}>
                                      <TableCell className="font-semibold">{claim.reward?.name_ar || (i18n.language === "ar" ? "جائزة محذوفة" : "Deleted reward")}</TableCell>
                                      <TableCell className="font-bold text-destructive">-{claim.reward?.points_required}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{new Date(claim.created_at).toLocaleDateString()}</TableCell>
                                      <TableCell className="text-end">
                                        <Badge variant={claim.status === "approved" ? "secondary" : claim.status === "rejected" ? "outline" : "default"} className={claim.status === "approved" ? "bg-emerald-500/10 text-emerald-700" : ""}>
                                          {claim.status === "approved" ? (i18n.language === "ar" ? "تم التسليم" : "Received") : claim.status === "rejected" ? (i18n.language === "ar" ? "مرفوض" : "Rejected") : (i18n.language === "ar" ? "معلق" : "Pending")}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {enjazClaims.length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs">
                                        {i18n.language === "ar" ? "لا توجد طلبات سابقة." : "No redemption history."}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TabsContent>

                        {/* SUB-TAB 3: HONOR BADGES */}
                        <TabsContent value="enjaz-badges" className="space-y-6">
                          <div className="space-y-3">
                            <h3 className="text-base font-bold flex items-center gap-2">
                              <Award className="h-5 w-5 text-primary" />
                              {i18n.language === "ar" ? "أوسمة وشارات التكريم" : "Honor Badges & Medals"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {i18n.language === "ar" 
                                ? "الأوسمة التي حصلتِ عليها ملوّنة بالألوان الكاملة. الأوسمة الرمادية تمثل أهدافاً قادمة لتحقيقها!" 
                                : "Your earned badges are colored. Grayscale badges represent upcoming achievements!"}
                            </p>
                            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                              {enjazBadges.map(badge => {
                                const earned = isBadgeEarned(badge.id);
                                const earnedDate = getBadgeEarnedDate(badge.id);
                                return (
                                  <Card key={badge.id} className={`p-4 flex flex-col items-center text-center space-y-3 border transition-all relative overflow-hidden shadow-sm
                                    ${earned 
                                      ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent" 
                                      : "opacity-45 grayscale"
                                    }`}
                                  >
                                    <div className="text-4xl filter drop-shadow-sm select-none">{badge.icon || "🎖️"}</div>
                                    <div className="space-y-1">
                                      <h4 className="font-bold text-sm text-foreground line-clamp-1">{badge.name_ar}</h4>
                                      <p className="text-[10px] text-muted-foreground line-clamp-2 h-7">{badge.description_ar || "—"}</p>
                                    </div>
                                    <div className="pt-2 border-t w-full text-[10px] flex items-center justify-center gap-1 font-semibold">
                                      {earned ? (
                                        <span className="text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                          <Check className="h-3 w-3" />
                                          {earnedDate}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground flex items-center gap-0.5">
                                          <Lock className="h-3 w-3" />
                                          {i18n.language === "ar" ? `مغلق (+${badge.points_reward} ن)` : `Locked (+${badge.points_reward} Pts)`}
                                        </span>
                                      )}
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        </TabsContent>

                        {/* SUB-TAB 4: LOGS & MESSAGES */}
                        <TabsContent value="enjaz-logs" className="space-y-6">
                          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                            {/* Announcements & encouraging messages */}
                            <div className="space-y-4">
                              {/* Announcements */}
                              <div className="space-y-3">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                  <Megaphone className="h-5 w-5 text-amber-500" />
                                  {i18n.language === "ar" ? "تعاميم وإعلانات المشرفة" : "Announcements"}
                                </h3>
                                <div className="space-y-3">
                                  {enjazAnnouncements.length === 0 ? (
                                    <div className="border border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
                                      {i18n.language === "ar" ? "لا توجد إعلانات منشورة." : "No announcements."}
                                    </div>
                                  ) : (
                                    enjazAnnouncements
                                      .filter(a => !a.target_group_id || a.target_group_id === activeParticipant.group_id)
                                      .map(ann => (
                                        <Card key={ann.id} className="p-4 border-amber-500/20 bg-amber-500/5 shadow-sm space-y-2 border">
                                          <h4 className="font-bold text-sm text-amber-800">{ann.title}</h4>
                                          <p className="text-xs text-amber-700 line-clamp-3 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                                          <div className="text-[9px] text-amber-600/70 text-end font-semibold">
                                            {new Date(ann.created_at).toLocaleString()}
                                          </div>
                                        </Card>
                                      ))
                                  )}
                                </div>
                              </div>

                              {/* Encouraging messages */}
                              <div className="space-y-3 pt-2">
                                <h3 className="text-base font-bold flex items-center gap-2">
                                  <MessageSquare className="h-5 w-5 text-primary" />
                                  {i18n.language === "ar" ? "رسائل تحفيزية وتنبيهات مخصصة" : "Encouragement Messages"}
                                </h3>
                                <div className="space-y-3">
                                  {enjazMessages.length === 0 ? (
                                    <div className="border border-dashed rounded-xl p-6 text-center text-xs text-muted-foreground">
                                      {i18n.language === "ar" ? "لا توجد رسائل تشجيع بعد." : "No messages."}
                                    </div>
                                  ) : (
                                    enjazMessages.map(msg => (
                                      <Card key={msg.id} className="p-4 shadow-sm border border-primary/20 bg-primary/5 space-y-2">
                                        <p className="text-xs text-primary-800 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                        <div className="text-[9px] text-primary-600/70 text-end font-semibold">
                                          {new Date(msg.created_at).toLocaleString()}
                                        </div>
                                      </Card>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Points Logs Log */}
                            <div className="space-y-3">
                              <h3 className="text-base font-bold flex items-center gap-2">
                                <FileText className="h-5 w-5 text-purple-600" />
                                {i18n.language === "ar" ? "سجل إنجاز نقاطك بالتفصيل" : "Your Points Log Detail"}
                              </h3>
                              <div className="border rounded-lg overflow-hidden bg-background max-h-[450px] overflow-y-auto">
                                <Table>
                                  <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                      <TableHead>{i18n.language === "ar" ? "السبب / المعيار" : "Reason / Criteria"}</TableHead>
                                      <TableHead>{i18n.language === "ar" ? "النقاط" : "Points"}</TableHead>
                                      <TableHead>{i18n.language === "ar" ? "التاريخ" : "Date"}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {enjazPointsLogs.map(log => (
                                      <TableRow key={log.id}>
                                        <TableCell className="font-semibold text-xs leading-normal">{log.reason}</TableCell>
                                        <TableCell>
                                          <Badge variant={log.delta > 0 ? "secondary" : "outline"} className={log.delta > 0 ? "text-emerald-700 bg-emerald-500/10 border-none" : "text-destructive border-none bg-destructive/10"}>
                                            {log.delta > 0 ? `+${log.delta}` : log.delta}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleDateString()}</TableCell>
                                      </TableRow>
                                    ))}
                                    {enjazPointsLogs.length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-xs">
                                          {i18n.language === "ar" ? "لا توجد سجلات نقاط بعد." : "No points logs recorded."}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap">
              <TabsTrigger value="dashboard">{t("dashboard.title", "لوحة التعلم")}</TabsTrigger>
              <TabsTrigger value="achievements">{t("portal.achievements", "الإنجازات")}</TabsTrigger>
              <TabsTrigger value="communication">{t("portal.communication", "التواصل")}</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{t("portal.programsAndProjects", "البرامج والمشاريع المنتسب لها")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {memberships.length === 0 ? (
                    <Empty text={t("portal.noProjects", "لا توجد مشاريع مرتبطة بعد")} />
                  ) : (
                    memberships.map((m) => {
                      const project = projectMap.get(m.project_id);
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => project && setSelectedProjectId(project.id)}
                          className="rounded-xl border p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm flex flex-col justify-between"
                        >
                          <div>
                            <div className="font-bold text-base text-foreground mb-1">
                              {project ? displayName(project.name_ar, project.name_en, i18n.language) : m.project_id}
                            </div>
                            {project?.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-3">
                                {project.description}
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {i18n.language === "ar" ? "تاريخ التسجيل: " : "Enrolled: "}
                              {new Date(m.enrolled_at).toLocaleDateString(i18n.language === "ar" ? "ar-EG" : "en-US")}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <Badge variant={m.status === "active" ? "default" : "outline"}>
                              {m.status === "active" ? (i18n.language === "ar" ? "نشط" : "Active") : (i18n.language === "ar" ? "غير نشط" : "Inactive")}
                            </Badge>
                            <Button size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 font-semibold p-0 h-auto">
                              {i18n.language === "ar" ? "دخول المشروع ←" : "Enter Project →"}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("portal.smartAlerts", "تنبيهات ذكية")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <AlertLine icon={Bell} text={pendingActivities ? t("portal.pendingActivities", "{{count}} أنشطة تحتاج متابعة", { count: pendingActivities }) : t("portal.noPendingActivities", "لا توجد أنشطة متأخرة")} />
                  <AlertLine icon={CalendarDays} text={nextSession ? `${t("portal.nextSession", "اللقاء القادم")}: ${new Date(nextSession.scheduled_at).toLocaleString(i18n.language === "ar" ? "ar-EG" : "en-US")}` : t("portal.noUpcomingSessions", "لا توجد لقاءات قادمة")} />
                  <AlertLine icon={Zap} text={t("portal.dailyMotivation", "أكمل 20 دقيقة تعلم اليوم لزيادة الاستمرارية.")} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">{t("portal.customGuidance", "الرسائل والتوجيهات التعليمية")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  {content.length === 0 ? <Empty text={t("portal.noGuidance", "لا توجد توجيهات مخصصة حالياً")} /> : content.map((item) => (
                    <div key={item.id} className="rounded-md border p-3">
                      <Badge variant="outline">{item.content_type}</Badge>
                      <div className="mt-2 font-medium">{item.title}</div>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="achievements" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("portal.levelsAndBadges", "المستوى والشارات")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ProgressLine label={`${currentLevel.name} ${nextLevel ? `-> ${nextLevel.name}` : ""}`} value={levelProgress} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {badges.length === 0 ? <Empty text={t("portal.noBadges", "لم تحصل على شارات بعد")} /> : badges.map((b) => (
                      <div key={b.id} className="rounded-md border p-3">
                        <div className="text-2xl">{b.badges?.icon || <Award className="h-5 w-5" />}</div>
                        <div className="mt-2 font-medium">{b.badges ? displayName(b.badges.name_ar, b.badges.name_en, i18n.language) : b.badge_id}</div>
                        <div className="text-xs text-muted-foreground">{new Date(b.earned_at).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("lms.certificatesIssued", "الشهادات القابلة للتحقق")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {certificates.length === 0 ? <Empty text={t("portal.noCertificates", "لا توجد شهادات بعد")} /> : certificates.map((cert) => (
                    <div key={cert.id} className="rounded-md border p-3">
                      <div className="font-medium">{courseMap.get(cert.course_id) ? displayName(courseMap.get(cert.course_id)!.title_ar, courseMap.get(cert.course_id)!.title_en, i18n.language) : cert.course_id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(cert.issued_at).toLocaleDateString()}</div>
                      <div className="mt-2 font-mono text-xs">{cert.verification_code || cert.code}</div>
                      {cert.verification_url && <a className="mt-2 inline-block text-sm text-primary underline" href={cert.verification_url} target="_blank" rel="noreferrer">{t("portal.verifyCertificate", "تحقق من الشهادة")}</a>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="communication" className="grid gap-4 lg:grid-cols-2">
              <SectionList title={t("nav.notifications", "الرسائل")} icon={Bell} items={notifications.map((n) => ({ id: n.id, title: n.title || t("nav.notifications", "رسالة"), meta: `${n.body || ""} - ${new Date(n.created_at).toLocaleString()}`, href: n.action_url || undefined }))} />
              <SectionList title={t("nav.messages", "الرسائل")} icon={MessageSquare} items={messages.map((m) => ({ id: m.id, title: m.body, meta: new Date(m.created_at).toLocaleString() }))} />
            </TabsContent>
          </Tabs>
        )}

        {hasAnyRole(["executive", "assistant", "project_manager", "branch_manager", "employee", "board"]) && (
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="text-sm text-muted-foreground">
                {t("portal.staffNote", "لديك صلاحيات إضافية في النظام.")}
              </div>
              <Button onClick={() => navigate("/dashboard")}>{t("landing.openApp", "فتح التطبيق")}</Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ========================================================
          ENJAZ DIALOGS
          ======================================================== */}
      {/* 1. Task Submission Dialog */}
      <Dialog open={!!selectedTaskForSubmit} onOpenChange={(open) => !open && setSelectedTaskForSubmit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {i18n.language === "ar" ? "تسليم إنجاز المهمة" : "Submit Task Completion"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedTaskForSubmit?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>{i18n.language === "ar" ? "اكتبي تفاصيل ما أنجزتيه:" : "Describe what you completed:"}</Label>
              <Textarea 
                value={submissionText} 
                onChange={(e) => setSubmissionText(e.target.value)} 
                placeholder={i18n.language === "ar" ? "مثال: أتممت قراءة المقرر وحل الأسئلة الملحقة في الصفحة 12..." : "e.g. Completed assignment questions..."}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={submitTaskLoading} onClick={() => setSelectedTaskForSubmit(null)}>
              {i18n.language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button disabled={submitTaskLoading} onClick={handleSubmitTask}>
              {submitTaskLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground me-1.5" />
              ) : (
                <Send className="h-4 w-4 me-1.5" />
              )}
              {i18n.language === "ar" ? "إرسال الإنجاز" : "Send Submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Reward Claim Confirmation Dialog */}
      <Dialog open={!!selectedRewardForClaim} onOpenChange={(open) => !open && setSelectedRewardForClaim(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {i18n.language === "ar" ? "تأكيد استبدال النقاط بجائزة" : "Confirm Reward Claim"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {i18n.language === "ar" ? "يرجى تأكيد طلب الحصول على الجائزة التالية:" : "Please confirm your request for the following reward:"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center space-y-3">
            <div className="text-4xl filter drop-shadow-sm select-none font-sans">🎁</div>
            <h4 className="font-extrabold text-lg text-foreground">{selectedRewardForClaim?.name_ar}</h4>
            <p className="text-xs text-muted-foreground">{selectedRewardForClaim?.description_ar}</p>
            <Badge variant="destructive" className="font-bold text-xs bg-destructive/10 border-none px-3 py-1">
              -{selectedRewardForClaim?.points_required} {i18n.language === "ar" ? "نقطة" : "Pts"}
            </Badge>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={claimRewardLoading} onClick={() => setSelectedRewardForClaim(null)}>
              {i18n.language === "ar" ? "التراجع" : "Cancel"}
            </Button>
            <Button disabled={claimRewardLoading} onClick={handleClaimReward} className="bg-emerald-600 hover:bg-emerald-700">
              {claimRewardLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary-foreground me-1.5" />
              ) : (
                <Check className="h-4 w-4 me-1.5" />
              )}
              {i18n.language === "ar" ? "تأكيد الطلب" : "Confirm Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Interactive Quiz Taking Dialog */}
      <Dialog open={!!activeQuiz} onOpenChange={() => {
        if (quizSubmitting) return;
        if (confirm(i18n.language === "ar" ? "هل تريد التراجع والخروج من المسابقة؟ لن يتم حفظ إجاباتك." : "Are you sure you want to exit? Your progress will not be saved.")) {
          setActiveQuiz(null);
        }
      }}>
        <DialogContent className="max-w-2xl min-h-[400px] flex flex-col justify-between">
          <div>
            <DialogHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-black text-amber-600">
                  {activeQuiz?.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {i18n.language === "ar" 
                    ? `السؤال ${quizQuestionIndex + 1} من ${activeQuiz?.questions?.length || 0}`
                    : `Question ${quizQuestionIndex + 1} of ${activeQuiz?.questions?.length || 0}`}
                </DialogDescription>
              </div>
              <div className="h-10 w-24 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-mono font-bold text-sm border border-amber-500/20">
                {Math.floor(quizSecondsLeft / 60)}:
                {String(quizSecondsLeft % 60).padStart(2, "0")}
              </div>
            </DialogHeader>

            <div className="py-6 space-y-6">
              {activeQuiz?.questions && activeQuiz.questions[quizQuestionIndex] && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-foreground select-none leading-relaxed">
                    {activeQuiz.questions[quizQuestionIndex].question_text}
                  </h4>
                  <div className="grid gap-3">
                    {((activeQuiz.questions[quizQuestionIndex].options || []) as string[]).map((opt, optIdx) => {
                      const isSelected = quizAnswers[quizQuestionIndex] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setQuizAnswers(prev => ({ ...prev, [quizQuestionIndex]: optIdx }))}
                          className={`w-full text-right p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 text-sm font-semibold select-none
                            ${isSelected 
                              ? "border-amber-500 bg-amber-500/5 text-amber-800" 
                              : "border-border hover:bg-muted/40 text-foreground"
                            }`}
                        >
                          <span>{opt}</span>
                          <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0
                            ${isSelected 
                              ? "border-amber-500 bg-amber-500" 
                              : "border-muted-foreground"
                            }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex flex-row justify-between items-center w-full gap-3 sm:space-x-0">
            <Button
              variant="outline"
              disabled={quizQuestionIndex === 0 || quizSubmitting}
              onClick={() => setQuizQuestionIndex(prev => prev - 1)}
              className="font-bold text-xs"
            >
              {i18n.language === "ar" ? "السابق" : "Previous"}
            </Button>

            {quizQuestionIndex === (activeQuiz?.questions?.length || 0) - 1 ? (
              <Button
                disabled={quizSubmitting || quizAnswers[quizQuestionIndex] === undefined}
                onClick={() => submitQuiz(quizAnswers)}
                className="bg-amber-500 hover:bg-amber-600 font-bold text-white text-xs px-6"
              >
                {quizSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white me-1.5" />
                ) : (
                  <Check className="h-4 w-4 me-1.5" />
                )}
                {i18n.language === "ar" ? "تسجيل الإجابات وإنهاء" : "Submit Quiz"}
              </Button>
            ) : (
              <Button
                disabled={quizAnswers[quizQuestionIndex] === undefined}
                onClick={() => setQuizQuestionIndex(prev => prev + 1)}
                className="font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white"
              >
                {i18n.language === "ar" ? "التالي" : "Next"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const displayName = (ar: string, en: string | null | undefined, lang: string) => lang === "ar" ? ar : (en || ar);

const getLevel = (points: number) => {
  if (points >= 500) return { name: "Leader", min: 500 };
  if (points >= 300) return { name: "Expert", min: 300 };
  if (points >= 150) return { name: "Distinguished", min: 150 };
  if (points >= 50) return { name: "Active", min: 50 };
  return { name: "Beginner", min: 0 };
};

const getNextLevel = (points: number) => {
  if (points < 50) return { name: "Active", min: 50 };
  if (points < 150) return { name: "Distinguished", min: 150 };
  if (points < 300) return { name: "Expert", min: 300 };
  if (points < 500) return { name: "Leader", min: 500 };
  return null;
};

const Metric = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <div className="rounded-md border p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
    <div className="mt-2 text-xl font-bold">{value}</div>
  </div>
);

const ProgressLine = ({ label, value, className }: { label: string; value: number; className?: string }) => (
  <div className={className}>
    <div className="mb-2 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}%</span>
    </div>
    <Progress value={value} />
  </div>
);

const AlertLine = ({ icon: Icon, text }: { icon: LucideIcon; text: string }) => (
  <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
    <Icon className="mt-0.5 h-4 w-4 text-primary" />
    <span>{text}</span>
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">{text}</div>
);

const SectionList = ({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: Array<{ id: string; title: string; meta?: string; href?: string; badge?: string }> }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5" />{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {items.length === 0 ? <Empty text="لا توجد بيانات للعرض" /> : items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0">
            {item.href ? (
              <a href={item.href} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">{item.title}</a>
            ) : (
              <div className="font-medium">{item.title}</div>
            )}
            {item.meta && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.meta}</div>}
          </div>
          {item.badge && <Badge variant="secondary">{item.badge}</Badge>}
        </div>
      ))}
    </CardContent>
  </Card>
);

export default Portal;

