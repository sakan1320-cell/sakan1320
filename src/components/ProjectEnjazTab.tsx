import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Award, Trophy, Star, ShieldCheck, PlusCircle, Users, CheckCircle2,
  XCircle, Trash2, Calendar, ClipboardCheck, ArrowLeftRight, HelpCircle,
  TrendingUp, Check, DollarSign, FileText, RefreshCw, BarChart2, BellRing, Zap
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface ProjectEnjazTabProps {
  projectId: string;
  defaultTab?: string;
  hideTabsBar?: boolean;
  branchId?: string | null;
  branchId?: string | null;
  groupId?: string | null;
  isManager?: boolean;
}

interface EnjazGroup {
  id: string;
  name_ar: string;
  created_at: string;
  points?: number;
}

interface Participant {
  id: string;
  full_name: string;
  points: number;
  group_id: string | null;
  national_id?: string;
  phone?: string;
}

interface PointsLog {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
  participant?: { full_name: string };
}

interface EnjazTask {
  id: string;
  title: string;
  description: string;
  points_reward: number;
  start_date: string;
  end_date: string;
  target_group_id: string | null;
}

interface TaskSubmission {
  id: string;
  task_id: string;
  participant_id: string;
  status: string;
  submission_text: string;
  points_awarded: number;
  created_at: string;
  task?: EnjazTask;
  participant?: Participant;
}

interface EnjazReward {
  id: string;
  name_ar: string;
  description_ar: string;
  points_required: number;
  quantity: number;
  is_active: boolean;
}

interface RewardClaim {
  id: string;
  reward_id: string;
  participant_id: string;
  status: string;
  created_at: string;
  reward?: EnjazReward;
  participant?: Participant;
}

interface EnjazBadge {
  id: string;
  name_ar: string;
  icon: string;
  description_ar: string;
  points_reward: number;
}

interface BudgetLog {
  id: string;
  title: string;
  amount: number;
  transaction_type: string;
  notes: string;
  created_at: string;
}

export const ProjectEnjazTab = ({ projectId, defaultTab = "dashboard", hideTabsBar = false, branchId, groupId, isManager = true }: ProjectEnjazTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  
  // Data loading states
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<EnjazGroup[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pointsLogs, setPointsLogs] = useState<PointsLog[]>([]);
  const [tasks, setTasks] = useState<EnjazTask[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [rewards, setRewards] = useState<EnjazReward[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [badges, setBadges] = useState<EnjazBadge[]>([]);
  const [budgets, setBudgets] = useState<BudgetLog[]>([]);
  const [attendanceCustomPoints, setAttendanceCustomPoints] = useState<Record<string, number>>({});
  const [projectPointsRules, setProjectPointsRules] = useState<{
    present: number;
    late: number;
    absent: number;
    excused: number;
  }>({
    present: 5,
    late: 2,
    absent: -5,
    excused: 0
  });

  const { confirm, ConfirmDialogNode } = useConfirm();

  interface EnjazInitiative {
    id: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    initiative_type: string;
    scope: string;
    start_date: string | null;
    end_date: string | null;
    max_total_distribution: number | null;
    max_per_teacher: number | null;
    max_per_participant: number | null;
    daily_limit: number | null;
    requires_notes: boolean;
    requires_approval: boolean;
    encouragement_message: string | null;
    is_active: boolean;
    created_at: string;
    created_by: string | null;
  }

  interface InitiativeGrant {
    id: string;
    initiative_id: string;
    participant_id: string;
    awarded_by: string | null;
    points_awarded: number;
    notes: string | null;
    status: string; // approved, pending_approval, cancelled
    cancellation_reason: string | null;
    created_at: string;
    initiative?: EnjazInitiative;
    participant?: Participant;
  }

  const [initiatives, setInitiatives] = useState<EnjazInitiative[]>([]);
  const [grants, setGrants] = useState<InitiativeGrant[]>([]);
  const [initiativeDialogOpen, setInitiativeDialogOpen] = useState(false);
  const [newInitiativeForm, setNewInitiativeForm] = useState({
    name: "",
    description: "",
    icon: "🌟",
    points: 3,
    initiative_type: "behavior",
    scope: "project",
    start_date: "",
    end_date: "",
    max_total_distribution: "",
    max_per_teacher: "",
    max_per_participant: "",
    daily_limit: "",
    requires_notes: false,
    requires_approval: false,
    encouragement_message: ""
  });

  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [selectedInitiativeForGrant, setSelectedInitiativeForGrant] = useState<EnjazInitiative | null>(null);
  const [selectedPartIdForGrant, setSelectedPartIdForGrant] = useState("");
  const [grantNotes, setGrantNotes] = useState("");
  
  // Modals & Forms states
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);
  const [pointsTarget, setPointsTarget] = useState<"individual" | "group">("individual");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [pointsDelta, setPointsDelta] = useState(10);
  const [pointsReason, setPointsReason] = useState("");
  
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", points_reward: 10, start_date: "", end_date: "", target_group_id: "" });
  
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [rewardForm, setRewardForm] = useState({ name_ar: "", description_ar: "", points_required: 50, quantity: 10 });
  
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [badgeRecipientId, setBadgeRecipientId] = useState("");

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ title: "", amount: 100, transaction_type: "expense", notes: "" });

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceState, setAttendanceState] = useState<Record<string, "present" | "absent" | "late" | "excused">>({});

  // 1. Fetch Enjaz Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, partsRes, logsRes, tasksRes, subsRes, rewardsRes, claimsRes, badgesRes, budgetRes, initiativesRes, grantsRes, projectRes] = await Promise.all([
        (() => {
          let q = supabase.from("project_groups").select("*").eq("project_id", projectId);
          if (groupId) q = q.eq("id", groupId);
          else if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        (() => {
          let q = supabase.from("participants").select("id, full_name, points, group_id, national_id, phone").eq("project_id", projectId).eq("status", "active");
          if (groupId) q = q.eq("group_id", groupId);
          else if (branchId) q = q.eq("branch_id", branchId);
          return q;
        })(),
        supabase.from("participant_points_log").select("id, delta, reason, created_at, participant:participants(full_name)").order("created_at", { ascending: false }).limit(30),
        supabase.from("enjaz_tasks").select("*").eq("project_id", projectId),
        supabase.from("enjaz_task_submissions").select("id, task_id, participant_id, status, submission_text, points_awarded, created_at, task:enjaz_tasks(title), participant:participants(full_name)").order("created_at", { ascending: false }),
        supabase.from("enjaz_rewards").select("*").eq("project_id", projectId),
        supabase.from("enjaz_reward_claims").select("id, reward_id, participant_id, status, created_at, reward:enjaz_rewards(name_ar, points_required), participant:participants(full_name)").order("created_at", { ascending: false }),
        supabase.from("enjaz_badges").select("*"),
        supabase.from("enjaz_budget").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("enjaz_initiatives").select("*").eq("project_id", projectId),
        supabase.from("enjaz_initiative_grants").select("*, initiative:enjaz_initiatives(*), participant:participants(full_name)").order("created_at", { ascending: false }),
        supabase.from("projects").select("enjaz_points_present, enjaz_points_late, enjaz_points_absent, enjaz_points_excused").eq("id", projectId).maybeSingle()
      ]);

      const groupList = (groupsRes.data ?? []) as EnjazGroup[];
      const partList = (partsRes.data ?? []) as Participant[];

      // Calculate points per group
      const groupsWithPoints = groupList.map(g => {
        const total = partList.filter(p => p.group_id === g.id).reduce((s, p) => s + (p.points || 0), 0);
        return { ...g, points: total };
      });

      setGroups(groupsWithPoints);
      setParticipants(partList);
      setPointsLogs((logsRes.data ?? []) as unknown as PointsLog[]);
      setTasks((tasksRes.data ?? []) as EnjazTask[]);
      setSubmissions((submissionsRes.data ?? submissions) as unknown as TaskSubmission[]); // Keep fallback or existing state
      setRewards((rewardsRes.data ?? []) as EnjazReward[]);
      setClaims((claimsRes.data ?? []) as unknown as RewardClaim[]);
      setBadges((badgesRes.data ?? []) as EnjazBadge[]);
      setBudgets((budgetRes.data ?? []) as BudgetLog[]);

      const grantsData = (grantsRes.data ?? []) as unknown as InitiativeGrant[];
      const projectGrants = grantsData.filter(g => g.initiative?.project_id === projectId);
      setGrants(projectGrants);
      setInitiatives((initiativesRes.data ?? []) as EnjazInitiative[]);

      if (projectRes.data) {
        setProjectPointsRules({
          present: projectRes.data.enjaz_points_present ?? 5,
          late: projectRes.data.enjaz_points_late ?? 2,
          absent: projectRes.data.enjaz_points_absent ?? -5,
          excused: projectRes.data.enjaz_points_excused ?? 0
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, branchId, groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Action Handlers
  const handleAddGroup = async () => {
    if (!newGroupName.trim()) { toast.error(isRtl ? "يرجى كتابة اسم المجموعة" : "Group name is required"); return; }
    const { error } = await supabase.from("project_groups").insert([{ project_id: projectId, name_ar: newGroupName }]);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تمت إضافة المجموعة بنجاح" : "Group added successfully");
    setNewGroupName("");
    setGroupDialogOpen(false);
    loadData();
  };

  const handleAssignGroup = async (participantId: string, groupId: string | null) => {
    const { error } = await supabase.from("participants").update({ group_id: groupId || null }).eq("id", participantId);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم نقل المشاركة بنجاح" : "Participant transferred successfully");
    loadData();
  };

  const handleAddPoints = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (pointsTarget === "individual") {
      if (!selectedPartId) return toast.error(isRtl ? "اختر مشاركة" : "Select participant");
      const part = participants.find(p => p.id === selectedPartId);
      if (!part) return;

      const { error: updErr } = await supabase.from("participants").update({ points: (part.points || 0) + Number(pointsDelta) }).eq("id", selectedPartId);
      if (updErr) return toast.error(updErr.message);

      await supabase.from("participant_points_log").insert([{
        participant_id: selectedPartId,
        delta: Number(pointsDelta),
        reason: pointsReason || (isRtl ? "إضافة إدارية" : "Admin Add"),
        created_by: user?.id
      }]);
    } else {
      if (!selectedGroupId) return toast.error(isRtl ? "اختر مجموعة" : "Select group");
      const groupParts = participants.filter(p => p.group_id === selectedGroupId);
      if (groupParts.length === 0) return toast.error(isRtl ? "المجموعة فارغة حالياً" : "Group is currently empty");

      // Bulk update
      const promises = groupParts.map(async (p) => {
        await supabase.from("participants").update({ points: (p.points || 0) + Number(pointsDelta) }).eq("id", p.id);
        await supabase.from("participant_points_log").insert([{
          participant_id: p.id,
          delta: Number(pointsDelta),
          reason: `${pointsReason || (isRtl ? "إنجاز جماعي" : "Group achievement")} - ${groups.find(g => g.id === selectedGroupId)?.name_ar}`,
          created_by: user?.id
        }]);
      });
      await Promise.all(promises);
    }
    toast.success(isRtl ? "تمت إضافة النقاط بنجاح" : "Points added successfully");
    setPointsReason("");
    setPointsDialogOpen(false);
    loadData();
  };

  const handleCancelPoints = async (logId: string, participantId: string, delta: number) => {
    if (!(await confirm(isRtl ? "هل أنت متأكد من إلغاء هذه العملية؟ سيتم استقطاع النقاط." : "Are you sure you want to cancel this entry? Points will be deducted."))) return;
    
    const part = participants.find(p => p.id === participantId);
    if (!part) return;

    // Deduct points
    const { error: updErr } = await supabase.from("participants").update({ points: Math.max(0, (part.points || 0) - delta) }).eq("id", participantId);
    if (updErr) return toast.error(updErr.message);

    // Delete log
    const { error: delErr } = await supabase.from("participant_points_log").delete().eq("id", logId);
    if (delErr) return toast.error(delErr.message);

    toast.success(isRtl ? "تم إلغاء العملية واستقطاع النقاط بنجاح" : "Log cancelled and points deducted");
    loadData();
  };

  const handleCreateTask = async () => {
    if (!taskForm.title) return toast.error(isRtl ? "العنوان مطلوب" : "Title is required");
    const { error } = await supabase.from("enjaz_tasks").insert([{
      project_id: projectId,
      title: taskForm.title,
      description: taskForm.description,
      points_reward: Number(taskForm.points_reward),
      start_date: taskForm.start_date || null,
      end_date: taskForm.end_date || null,
      target_group_id: taskForm.target_group_id || null
    }]);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم إنشاء المهمة بنجاح" : "Task created successfully");
    setTaskForm({ title: "", description: "", points_reward: 10, start_date: "", end_date: "", target_group_id: "" });
    setTaskDialogOpen(false);
    loadData();
  };

  const handleReviewSubmission = async (sub: TaskSubmission, status: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("enjaz_task_submissions").update({
      status,
      points_awarded: status === "approved" ? sub.task?.points_reward || 0 : 0,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString()
    }).eq("id", sub.id);

    if (error) return toast.error(error.message);

    if (status === "approved" && sub.participant && sub.task) {
      const part = participants.find(p => p.id === sub.participant_id);
      if (part) {
        await supabase.from("participants").update({ points: (part.points || 0) + (sub.task.points_reward || 0) }).eq("id", part.id);
        await supabase.from("participant_points_log").insert([{
          participant_id: part.id,
          delta: sub.task.points_reward || 0,
          reason: `${isRtl ? "اعتماد مهمة:" : "Approved task:"} ${sub.task.title}`,
          created_by: user?.id
        }]);
      }
    }

    toast.success(isRtl ? "تم تحديث حالة المهمة بنجاح" : "Task submission processed");
    loadData();
  };

  const handleCreateReward = async () => {
    if (!rewardForm.name_ar) return toast.error(isRtl ? "اسم الجائزة مطلوب" : "Reward name is required");
    const { error } = await supabase.from("enjaz_rewards").insert([{
      project_id: projectId,
      name_ar: rewardForm.name_ar,
      description_ar: rewardForm.description_ar,
      points_required: Number(rewardForm.points_required),
      quantity: Number(rewardForm.quantity),
      is_active: true
    }]);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم إنشاء الجائزة بنجاح" : "Reward created successfully");
    setRewardForm({ name_ar: "", description_ar: "", points_required: 50, quantity: 10 });
    setRewardDialogOpen(false);
    loadData();
  };

  const handleProcessClaim = async (claim: RewardClaim, status: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("enjaz_reward_claims").update({
      status,
      processed_at: new Date().toISOString(),
      processed_by: user?.id
    }).eq("id", claim.id);

    if (error) return toast.error(error.message);

    if (status === "approved" && claim.reward && claim.participant) {
      // Deduct points from participant
      const part = participants.find(p => p.id === claim.participant_id);
      if (part) {
        await supabase.from("participants").update({ points: Math.max(0, (part.points || 0) - claim.reward.points_required) }).eq("id", part.id);
        await supabase.from("participant_points_log").insert([{
          participant_id: part.id,
          delta: -claim.reward.points_required,
          reason: `${isRtl ? "استلام جائزة:" : "Redeemed reward:"} ${claim.reward.name_ar}`,
          created_by: user?.id
        }]);
        
        // Log budget expense
        await supabase.from("enjaz_budget").insert([{
          project_id: projectId,
          title: `${isRtl ? "توفير جائزة:" : "Reward item:"} ${claim.reward.name_ar} (${claim.participant.full_name})`,
          amount: 0, // Admin can update value later
          transaction_type: "expense",
          notes: `استبدال بقيمة ${claim.reward.points_required} نقطة`
        }]);
      }

      // Deduct reward stock quantity
      if (claim.reward.quantity > 0) {
        await supabase.from("enjaz_rewards").update({ quantity: claim.reward.quantity - 1 }).eq("id", claim.reward_id);
      }
    }

    toast.success(isRtl ? "تمت معالجة الطلب بنجاح" : "Redemption processed successfully");
    loadData();
  };

  const handleAwardBadge = async () => {
    if (!badgeRecipientId || !selectedBadgeId) return toast.error(isRtl ? "يرجى تعبئة الحقول" : "Please fill all fields");
    
    const badge = badges.find(b => b.id === selectedBadgeId);
    const part = participants.find(p => p.id === badgeRecipientId);
    if (!badge || !part) return;

    // Check if earned
    const { data: existing } = await supabase.from("enjaz_participant_badges").select("id").eq("participant_id", badgeRecipientId).eq("badge_id", selectedBadgeId).maybeSingle();
    if (existing) return toast.error(isRtl ? "المشاركة حصلت على هذا الوسام مسبقاً" : "Already awarded");

    const { error: insErr } = await supabase.from("enjaz_participant_badges").insert([{
      participant_id: badgeRecipientId,
      badge_id: selectedBadgeId
    }]);
    if (insErr) return toast.error(insErr.message);

    // Award bonus points
    if (badge.points_reward > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("participants").update({ points: (part.points || 0) + badge.points_reward }).eq("id", part.id);
      await supabase.from("participant_points_log").insert([{
        participant_id: part.id,
        delta: badge.points_reward,
        reason: `${isRtl ? "وسام:" : "Badge:"} ${badge.name_ar}`,
        created_by: user?.id
      }]);
    }

    toast.success(isRtl ? "تم تقليد الوسام وإضافة النقاط بنجاح" : "Badge awarded and points added successfully");
    setSelectedBadgeId("");
    setBadgeDialogOpen(false);
    loadData();
  };

  const handleAddBudget = async () => {
    if (!budgetForm.title) return toast.error(isRtl ? "العنوان مطلوب" : "Title is required");
    const { error } = await supabase.from("enjaz_budget").insert([{
      project_id: projectId,
      title: budgetForm.title,
      amount: Number(budgetForm.amount),
      transaction_type: budgetForm.transaction_type,
      notes: budgetForm.notes
    }]);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم تسجيل المعاملة بنجاح" : "Transaction registered successfully");
    setBudgetForm({ title: "", amount: 100, transaction_type: "expense", notes: "" });
    setBudgetDialogOpen(false);
    loadData();
  };

  // 3. Attendance Recording
  const handleLoadAttendance = async () => {
    const { data } = await supabase.from("attendance").select("subject_id, status").eq("project_id", projectId).eq("date", attendanceDate).eq("subject_type", "participant");
    const attState: Record<string, "present" | "absent" | "late" | "excused"> = {};
    (data ?? []).forEach(d => {
      attState[d.subject_id] = d.status as "present" | "absent" | "late" | "excused";
    });
    setAttendanceState(attState);
    
    // Reset custom points to match default rules
    const pointsMap: Record<string, number> = {};
    (data ?? []).forEach(d => {
      pointsMap[d.subject_id] = projectPointsRules[d.status as "present" | "absent" | "late" | "excused"] || 0;
    });
    setAttendanceCustomPoints(pointsMap);
    
    toast.info(isRtl ? "تم تحميل سجل حضور هذا اليوم" : "Attendance log loaded for this date");
  };

  const handleSetAttendanceStatus = (participantId: string, status: "present" | "absent" | "late" | "excused") => {
    setAttendanceState(prev => ({ ...prev, [participantId]: status }));
    const defaultPoints = projectPointsRules[status];
    setAttendanceCustomPoints(prev => ({ ...prev, [participantId]: defaultPoints }));
  };

  const handleSaveAttendance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const payloads = Object.entries(attendanceState).map(([partId, status]) => ({
      subject_type: "participant",
      subject_id: partId,
      project_id: projectId,
      date: attendanceDate,
      status,
      recorded_by: user?.id
    }));

    if (payloads.length === 0) return toast.error(isRtl ? "لا توجد سجلات حضور للحفظ" : "No records to save");

    const { error } = await supabase.from("attendance").upsert(payloads, { onConflict: "subject_type,subject_id,date" });
    if (error) return toast.error(error.message);

    // Apply points modification
    const promises = Object.entries(attendanceState).map(async ([partId, status]) => {
      const delta = attendanceCustomPoints[partId] !== undefined ? Number(attendanceCustomPoints[partId]) : projectPointsRules[status];
      if (delta === 0) return;

      const part = participants.find(p => p.id === partId);
      if (!part) return;

      await supabase.from("participants").update({ points: Math.max(0, (part.points || 0) + delta) }).eq("id", part.id);
      await supabase.from("participant_points_log").insert([{
        participant_id: part.id,
        delta,
        reason: `${isRtl ? "تحضير يوم" : "Attendance date"} ${attendanceDate} (${isRtl ? (status === "present" ? "حاضر" : status === "late" ? "متأخر" : "غائب") : status})`,
        created_by: user?.id
      }]);
    });

    await Promise.all(promises);
    toast.success(isRtl ? "تم تسجيل الحضور وتحديث النقاط للمشتركات تلقائياً" : "Attendance saved and points updated");
  };

  const handleSavePointsRules = async () => {
    const { error } = await supabase.from("projects").update({
      enjaz_points_present: projectPointsRules.present,
      enjaz_points_late: projectPointsRules.late,
      enjaz_points_absent: projectPointsRules.absent,
      enjaz_points_excused: projectPointsRules.excused
    }).eq("id", projectId);

    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم حفظ إعدادات النقاط التلقائية بنجاح" : "Settings saved successfully");
    loadData();
  };

  // 4. Initiatives Handlers
  const handleCreateInitiative = async () => {
    if (!newInitiativeForm.name.trim()) {
      toast.error(isRtl ? "يرجى إدخال اسم المبادرة" : "Initiative name is required");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("enjaz_initiatives").insert([{
      project_id: projectId,
      name: newInitiativeForm.name,
      description: newInitiativeForm.description,
      icon: newInitiativeForm.icon,
      points: Number(newInitiativeForm.points),
      initiative_type: newInitiativeForm.initiative_type,
      scope: newInitiativeForm.scope,
      start_date: newInitiativeForm.start_date || null,
      end_date: newInitiativeForm.end_date || null,
      max_total_distribution: newInitiativeForm.max_total_distribution ? Number(newInitiativeForm.max_total_distribution) : null,
      max_per_teacher: newInitiativeForm.max_per_teacher ? Number(newInitiativeForm.max_per_teacher) : null,
      max_per_participant: newInitiativeForm.max_per_participant ? Number(newInitiativeForm.max_per_participant) : null,
      daily_limit: newInitiativeForm.daily_limit ? Number(newInitiativeForm.daily_limit) : null,
      requires_notes: newInitiativeForm.requires_notes,
      requires_approval: newInitiativeForm.requires_approval,
      encouragement_message: newInitiativeForm.encouragement_message || null,
      created_by: user?.id
    }]);

    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم إنشاء المبادرة بنجاح" : "Initiative created successfully");
    setInitiativeDialogOpen(false);
    setNewInitiativeForm({
      name: "",
      description: "",
      icon: "🌟",
      points: 3,
      initiative_type: "behavior",
      scope: "project",
      start_date: "",
      end_date: "",
      max_total_distribution: "",
      max_per_teacher: "",
      max_per_participant: "",
      daily_limit: "",
      requires_notes: false,
      requires_approval: false,
      encouragement_message: ""
    });
    loadData();
  };

  const handleToggleInitiativeActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("enjaz_initiatives").update({ is_active: active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم تحديث حالة المبادرة" : "Initiative status updated");
    loadData();
  };

  const handleDeleteInitiative = async (id: string) => {
    if (!(await confirm(isRtl ? "هل أنتِ متأكدة من حذف هذه المبادرة نهائياً؟" : "Are you sure you want to delete this initiative?"))) return;
    const { error } = await supabase.from("enjaz_initiatives").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(isRtl ? "تم حذف المبادرة بنجاح" : "Initiative deleted");
    loadData();
  };

  const handleGrantInitiative = async () => {
    if (!selectedInitiativeForGrant || !selectedPartIdForGrant) {
      toast.error(isRtl ? "يرجى ملء الحقول المطلوبة" : "Please select all required fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Check Limits (daily limit check, max per participant)
    if (selectedInitiativeForGrant.daily_limit) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayGrants = grants.filter(g => 
        g.initiative_id === selectedInitiativeForGrant.id && 
        g.awarded_by === user?.id && 
        g.created_at.slice(0, 10) === todayStr
      );
      if (todayGrants.length >= selectedInitiativeForGrant.daily_limit) {
        toast.error(isRtl ? "تم الوصول للحد اليومي لهذه المبادرة." : "Daily limit reached for this initiative.");
        return;
      }
    }

    if (selectedInitiativeForGrant.max_per_participant) {
      const participantGrants = grants.filter(g => 
        g.initiative_id === selectedInitiativeForGrant.id && 
        g.participant_id === selectedPartIdForGrant
      );
      if (participantGrants.length >= selectedInitiativeForGrant.max_per_participant) {
        toast.error(isRtl ? "حصلت المشاركة على الحد الأقصى المسموح به لهذه المبادرة" : "Participant has reached limit");
        return;
      }
    }

    const pointsAwarded = selectedInitiativeForGrant.points;
    const status = selectedInitiativeForGrant.requires_approval ? "pending_approval" : "approved";

    const { error: grantErr } = await supabase.from("enjaz_initiative_grants").insert([{
      initiative_id: selectedInitiativeForGrant.id,
      participant_id: selectedPartIdForGrant,
      awarded_by: user?.id,
      points_awarded: pointsAwarded,
      notes: grantNotes || null,
      status
    }]);

    if (grantErr) return toast.error(grantErr.message);

    if (status === "approved") {
      const part = participants.find(p => p.id === selectedPartIdForGrant);
      if (part) {
        await supabase.from("participants").update({ points: (part.points || 0) + pointsAwarded }).eq("id", selectedPartIdForGrant);
        await supabase.from("participant_points_log").insert([{
          participant_id: selectedPartIdForGrant,
          delta: pointsAwarded,
          reason: `${selectedInitiativeForGrant.icon} ${selectedInitiativeForGrant.name}${grantNotes ? ` - ${grantNotes}` : ""}`,
          created_by: user?.id
        }]);

        if (selectedInitiativeForGrant.encouragement_message) {
          await supabase.from("enjaz_messages").insert([{
            project_id: projectId,
            sender_id: user?.id,
            recipient_id: selectedPartIdForGrant,
            body: selectedInitiativeForGrant.encouragement_message.replace("[الاسم]", part.full_name)
          }]);
        }
      }
    }

    toast.success(
      isRtl
        ? `تم منح مبادرة ${selectedInitiativeForGrant.name} لـ ${participants.find(p => p.id === selectedPartIdForGrant)?.full_name} وإضافة ${pointsAwarded} نقاط.`
        : `Granted ${selectedInitiativeForGrant.name} and added ${pointsAwarded} points.`
    );

    setGrantDialogOpen(false);
    setSelectedPartIdForGrant("");
    setGrantNotes("");
    loadData();
  };

  const handleCancelGrant = async (grantId: string, partId: string, points: number) => {
    const reason = prompt(isRtl ? "أدخل سبب الإلغاء:" : "Enter cancellation reason:");
    if (reason === null) return;

    const { error: updErr } = await supabase.from("enjaz_initiative_grants").update({
      status: "cancelled",
      cancellation_reason: reason
    }).eq("id", grantId);
    if (updErr) return toast.error(updErr.message);

    const part = participants.find(p => p.id === partId);
    if (part) {
      await supabase.from("participants").update({ points: Math.max(0, (part.points || 0) - points) }).eq("id", partId);
      await supabase.from("participant_points_log").insert([{
        participant_id: partId,
        delta: -points,
        reason: `${isRtl ? "سحب نقاط المبادرة بسبب" : "Points revoked due to"}: ${reason}`
      }]);
    }

    toast.success(isRtl ? "تم إلغاء المبادرة وسحب النقاط" : "Grant cancelled");
    loadData();
  };

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalPoints = participants.reduce((s, p) => s + (p.points || 0), 0);
  const averagePoints = participants.length ? Math.round(totalPoints / participants.length) : 0;
  const budgetSum = budgets.reduce((s, b) => b.transaction_type === "income" ? s + Number(b.amount) : s - Number(b.amount), 0);

  return (
    <div className="space-y-6">
      {ConfirmDialogNode}
      {/* Sections Flattened */}
      <div className="space-y-16">

        {/* ========================================================
            SECTION 1: DASHBOARD
            ======================================================== */}
        {isManager && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-primary px-2">{isRtl ? "لوحة الإنجاز والإحصائيات" : "Dashboard"}</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "المشتركات النشطات" : "Active Participants"}</div>
                  <div className="text-2xl font-black mt-1">{participants.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                  <Star className="h-6 w-6 fill-current" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "مجموع نقاط الإنجاز" : "Total Score"}</div>
                  <div className="text-2xl font-black mt-1">{totalPoints}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "متوسط نقاط المشاركة" : "Average Score"}</div>
                  <div className="text-2xl font-black mt-1">{averagePoints}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "ميزانية التحفيز المتاحة" : "Incentives Budget"}</div>
                  <div className="text-2xl font-black mt-1">{budgetSum.toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Alerts and Stats */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">{isRtl ? "مستويات تفاعل المجموعات" : "Group Performance Summary"}</CardTitle>
                  <CardDescription className="text-xs">{isRtl ? "الترتيب التنافسي ونقاط كل مجموعة" : "Total score summary of all groups"}</CardDescription>
                </div>
                {isManager && (
                <Button size="sm" variant="outline" onClick={() => setGroupDialogOpen(true)}>
                  <PlusCircle className="h-4 w-4 me-1.5" />
                  {isRtl ? "مجموعة جديدة" : "New Group"}
                </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {groups.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">{isRtl ? "لا توجد مجموعات بعد" : "No groups configured yet"}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? "المجموعة" : "Group Name"}</TableHead>
                        <TableHead>{isRtl ? "عدد المشتركات" : "Participants"}</TableHead>
                        <TableHead>{isRtl ? "مجموع النقاط" : "Total Points"}</TableHead>
                        <TableHead className="text-end">{isRtl ? "مستوى التميز" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((g, idx) => {
                        const count = participants.filter(p => p.group_id === g.id).length;
                        return (
                          <TableRow key={g.id}>
                            <TableCell className="font-bold">{g.name_ar}</TableCell>
                            <TableCell>{count}</TableCell>
                            <TableCell className="text-amber-600 font-extrabold">{g.points || 0}</TableCell>
                            <TableCell className="text-end">
                              <Badge variant={idx === 0 ? "default" : "secondary"}>
                                {idx === 0 ? (isRtl ? "الأعلى تفاعلاً 🏆" : "Top Active") : (isRtl ? "مجموعة منجزة" : "Achiever")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-destructive" />
                  {isRtl ? "تنبيهات للمتابعة الفورية" : "Interaction Alerts"}
                </CardTitle>
                <CardDescription className="text-xs">{isRtl ? "مشتركات بحاجة لتحفيز أو مراجعة" : "Participants with low activity"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {participants.filter(p => (p.points || 0) < 15).slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm">
                    <div>
                      <p className="font-bold text-foreground">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{isRtl ? `النقاط: ${p.points || 0}` : `Score: ${p.points || 0}`}</p>
                    </div>
                    {isManager && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setSelectedPartId(p.id);
                        setPointsTarget("individual");
                        setPointsDialogOpen(true);
                      }}
                      className="text-xs font-semibold h-7"
                    >
                      {isRtl ? "تحفيز ورصد" : "Motivate"}
                    </Button>
                    )}
                  </div>
                ))}
                {participants.filter(p => (p.points || 0) < 15).length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    {isRtl ? "جميع المشتركات لديهن تفاعل ممتاز هذا الأسبوع! 🎉" : "All participants are active!"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}


        {/* ========================================================
            SECTION 3: ATTENDANCE & POINTS
            ======================================================== */}
        <div className="space-y-6 border-t pt-8">
          <h2 className="text-2xl font-bold text-primary px-2">{isRtl ? "الرصد والمتابعة" : "Grading & Tracking"}</h2>
          <div className="space-y-12 pt-6">

            {/* Sub-section: Attendance */}
            {isManager && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-primary/80">{isRtl ? "الحضور والتحضير" : "Attendance"}</h3>
              {/* Settings Card integrated directly here */}
              <Card className="border-none bg-muted/40 shadow-none">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        {isRtl ? "إعدادات نقاط التحضير التلقائية" : "Default Attendance Points Rules"}
                      </h4>
                      <p className="text-xs text-muted-foreground">{isRtl ? "النقاط الافتراضية التي تمنح للمشاركات تلقائياً عند التحضير" : "Auto-applied attendance points settings"}</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-20 space-y-1">
                        <Label className="text-[10px]">{isRtl ? "حاضر" : "Present"}</Label>
                        <Input type="number" className="h-8 text-center" value={projectPointsRules.present} onChange={(e) => setProjectPointsRules(prev => ({ ...prev, present: Number(e.target.value) }))} />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[10px]">{isRtl ? "متأخر" : "Late"}</Label>
                        <Input type="number" className="h-8 text-center" value={projectPointsRules.late} onChange={(e) => setProjectPointsRules(prev => ({ ...prev, late: Number(e.target.value) }))} />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[10px]">{isRtl ? "غائب" : "Absent"}</Label>
                        <Input type="number" className="h-8 text-center" value={projectPointsRules.absent} onChange={(e) => setProjectPointsRules(prev => ({ ...prev, absent: Number(e.target.value) }))} />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label className="text-[10px]">{isRtl ? "مستأذن" : "Excused"}</Label>
                        <Input type="number" className="h-8 text-center" value={projectPointsRules.excused} onChange={(e) => setProjectPointsRules(prev => ({ ...prev, excused: Number(e.target.value) }))} />
                      </div>
                      {isManager && (
                      <Button size="sm" className="h-8 font-bold" onClick={handleSavePointsRules}>
                        {isRtl ? "حفظ" : "Save"}
                      </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                      {isRtl ? "تسجيل الحضور اليومي التلقائي" : "Daily Attendance linked to Points"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {isRtl 
                        ? `التحضير اليومي يضيف نقاطاً تلقائية للمشاركات: حاضر (${projectPointsRules.present})، متأخر (${projectPointsRules.late})، غائب (${projectPointsRules.absent})، مستأذن (${projectPointsRules.excused})`
                        : `Auto-awarded points based on state: present (${projectPointsRules.present}), late (${projectPointsRules.late}), absent (${projectPointsRules.absent}), excused (${projectPointsRules.excused})`
                      }
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3 items-end">
                    <div className="space-y-2 flex-1">
                      <Label>{isRtl ? "تاريخ التحضير" : "Date"}</Label>
                      <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
                    </div>
                    <Button variant="outline" className="font-semibold" onClick={handleLoadAttendance}>
                      {isRtl ? "تحميل القائمة" : "Load Logs"}
                    </Button>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRtl ? "اسم المشاركة" : "Name"}</TableHead>
                          <TableHead>{isRtl ? "المجموعة" : "Group"}</TableHead>
                          <TableHead className="text-center">{isRtl ? "حالة الحضور" : "Attendance Status"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participants.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.full_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.group_id ? (groups.find(g => g.id === p.group_id)?.name_ar) : "—"}</TableCell>
                            <TableCell className="text-center">
                              <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
                                {(["present", "late", "absent", "excused"] as const).map(s => {
                                  const selected = attendanceState[p.id] === s;
                                  const colors = {
                                    present: "data-[state=active]:bg-emerald-600 data-[state=active]:text-white",
                                    late: "data-[state=active]:bg-amber-500 data-[state=active]:text-white",
                                    absent: "data-[state=active]:bg-destructive data-[state=active]:text-white",
                                    excused: "data-[state=active]:bg-muted-foreground data-[state=active]:text-white"
                                  }[s];
                                  return (
                                    <Button
                                      key={s}
                                      size="sm"
                                      variant={selected ? "default" : "ghost"}
                                      data-state={selected ? "active" : "inactive"}
                                      onClick={() => handleSetAttendanceStatus(p.id, s)}
                                      className={`h-7 px-2.5 text-xs rounded-md ${colors}`}
                                    >
                                      {isRtl ? { present: "حاضر", late: "متأخر", absent: "غائب", excused: "مستأذن" }[s] : s}
                                    </Button>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {isManager && (
                  <div className="flex justify-end gap-3 pt-3 border-t">
                    <Button className="font-bold bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveAttendance}>
                      <CheckCircle2 className="h-4 w-4 me-1.5" />
                      {isRtl ? "حفظ الحضور ورصد النقاط" : "Save and Award Points"}
                    </Button>
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>
            )}

            {/* Sub-section: Initiatives */}
            <div className="space-y-6 border-t border-dashed pt-8">
              <h3 className="text-xl font-bold text-primary/80">{isRtl ? "المبادرات التشجيعية" : "Initiatives"}</h3>
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-bold">{isRtl ? "نظام المبادرات التحفيزية" : "Incentives Initiatives"}</h3>
                  <p className="text-xs text-muted-foreground">{isRtl ? "إدارة وتوزيع المبادرات التحفيزية الجاهزة للمشاركات" : "Manage and award ready-made behavioral initiatives."}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPointsDialogOpen(true)} className="font-bold border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10">
                    <Zap className="h-4 w-4 me-1.5" />
                    {isRtl ? "رصد سريع" : "Quick Points"}
                  </Button>
                  {isManager && (
                  <Button onClick={() => setInitiativeDialogOpen(true)} className="font-bold">
                    <PlusCircle className="h-4 w-4 me-1.5" />
                    {isRtl ? "إنشاء مبادرة جديدة" : "Create Initiative"}
                  </Button>
                  )}
                </div>
              </div>

              {/* Grid of Initiatives */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {initiatives.map(init => {
                  const usageCount = grants.filter(g => g.initiative_id === init.id && g.status !== "cancelled").length;
                  const totalPointsDisp = grants.filter(g => g.initiative_id === init.id && g.status !== "cancelled").reduce((s, g) => s + g.points_awarded, 0);
                  
                  return (
                    <Card key={init.id} className={`flex flex-col justify-between border shadow-sm hover:border-primary/40 transition-all ${!init.is_active ? "opacity-60" : ""}`}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{init.icon || "🌟"}</span>
                            <CardTitle className="text-sm font-bold">{init.name}</CardTitle>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-none font-bold">
                            +{init.points} {isRtl ? "نقاط" : "Pts"}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-2 line-clamp-2">{init.description || "—"}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-xs space-y-2 text-muted-foreground flex-1">
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px]">
                          <div>{isRtl ? `الاستخدام: ${usageCount}` : `Usage: ${usageCount}`}</div>
                          <div>{isRtl ? `النقاط الموزعة: ${totalPointsDisp}` : `Pts Awarded: ${totalPointsDisp}`}</div>
                          {init.daily_limit && <div>{isRtl ? `الحد اليومي: ${init.daily_limit}` : `Daily limit: ${init.daily_limit}`}</div>}
                          {init.max_per_participant && <div>{isRtl ? `حد المشاركة: ${init.max_per_participant}` : `Part limit: ${init.max_per_participant}`}</div>}
                        </div>
                      </CardContent>
                      {isManager && (
                      <div className="p-3 bg-muted/20 border-t flex justify-between gap-2">
                        <Button
                          size="sm"
                          className="flex-1 text-xs font-bold"
                          disabled={!init.is_active}
                          onClick={() => {
                            setSelectedInitiativeForGrant(init);
                            setSelectedPartIdForGrant("");
                            setGrantNotes("");
                            setGrantDialogOpen(true);
                          }}
                        >
                          {isRtl ? "منح المبادرة" : "Award Initiative"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleToggleInitiativeActive(init.id, !init.is_active)}
                        >
                          {init.is_active ? (isRtl ? "إيقاف" : "Deactivate") : (isRtl ? "تفعيل" : "Activate")}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteInitiative(init.id)}
                        >
                        </Button>
                      </div>
                      )}
                    </Card>
                  );
                })}
                {initiatives.length === 0 && (
                  <div className="col-span-full border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
                    {isRtl ? (isManager ? "لا توجد مبادرات حالياً. قم بإنشاء مبادرتك الأولى!" : "لا توجد مبادرات متاحة حالياً.") : (isManager ? "No initiatives found. Create your first one!" : "No initiatives available.")}
                  </div>
                )}
              </div>

              {/* Initiatives Grant Logs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold">{isRtl ? "سجل توزيع ومنح المبادرات" : "Initiatives Award History"}</CardTitle>
                  <CardDescription className="text-xs">{isRtl ? "مراجعة وتتبع جميع عمليات منح المبادرات للمشاركات مع إمكانية الإلغاء" : "Audit and cancel awarded initiatives."}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? "رقم" : "ID"}</TableHead>
                        <TableHead>{isRtl ? "المبادرة" : "Initiative"}</TableHead>
                        <TableHead>{isRtl ? "المشاركة" : "Participant"}</TableHead>
                        <TableHead>{isRtl ? "النقاط" : "Points"}</TableHead>
                        <TableHead>{isRtl ? "التاريخ والوقت" : "Date & Time"}</TableHead>
                        <TableHead>{isRtl ? "الملاحظات" : "Notes"}</TableHead>
                        <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
                        <TableHead className="text-end">{isRtl ? "الإجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grants.map((g, idx) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-semibold">
                            <span className="me-1.5">{g.initiative?.icon || "🌟"}</span>
                            {g.initiative?.name}
                          </TableCell>
                          <TableCell>{g.participant?.full_name}</TableCell>
                          <TableCell className="font-extrabold text-emerald-600">+{g.points_awarded}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{g.notes || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={g.status === "approved" ? "secondary" : g.status === "pending_approval" ? "default" : "outline"} className={g.status === "approved" ? "bg-emerald-500/10 text-emerald-700" : ""}>
                              {isRtl ? { approved: "مضافة", pending_approval: "بانتظار الاعتماد", cancelled: "ملغاة" }[g.status] || g.status : g.status}
                            </Badge>
                            {g.status === "cancelled" && g.cancellation_reason && (
                              <div className="text-[10px] text-destructive mt-0.5">{isRtl ? `السبب: ${g.cancellation_reason}` : `Reason: ${g.cancellation_reason}`}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            {g.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 h-7 text-xs"
                                onClick={() => handleCancelGrant(g.id, g.participant_id, g.points_awarded)}
                              >
                                {isRtl ? "إلغاء المنح" : "Cancel Grant"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {grants.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-xs">{isRtl ? "لا توجد سجلات منح للمبادرات بعد" : "No grants log registered yet"}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* ========================================================
            SECTION 5: REWARDS & BADGES
            ======================================================== */}
        <div className="space-y-6 border-t pt-8">
          <h2 className="text-2xl font-bold text-primary px-2">{isRtl ? "المتجر والمكافآت" : "Store & Rewards"}</h2>
          <div className={isManager ? "grid gap-6 grid-cols-1 lg:grid-cols-3" : "space-y-6"}>
            {/* Create Incentive Reward */}
            {isManager && (
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base font-bold">{isRtl ? "إضافة منتج للمتجر" : "Add Store Item"}</CardTitle>
                  <CardDescription className="text-xs">{isRtl ? "أضف منتجات مادية أو معنوية متوفرة مقابل نقاط" : "Add items for points redemption"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{isRtl ? "اسم المنتج" : "Item Name"}</Label>
                    <Input value={rewardForm.name_ar} onChange={(e) => setRewardForm(prev => ({ ...prev, name_ar: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? "وصف المنتج" : "Description"}</Label>
                    <Textarea value={rewardForm.description_ar} onChange={(e) => setRewardForm(prev => ({ ...prev, description_ar: e.target.value }))} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{isRtl ? "النقاط المطلوبة" : "Points Required"}</Label>
                      <Input type="number" value={rewardForm.points_required} onChange={(e) => setRewardForm(prev => ({ ...prev, points_required: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRtl ? "الكمية المتاحة" : "Available Stock"}</Label>
                      <Input type="number" value={rewardForm.quantity} onChange={(e) => setRewardForm(prev => ({ ...prev, quantity: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <Button className="w-full mt-4 font-bold" onClick={handleCreateReward}>
                    <PlusCircle className="h-4 w-4 me-1.5" />
                    {isRtl ? "إضافة المنتج للمتجر" : "Publish Item"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Redemption Claims List */}
            {isManager ? (
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-base font-bold">{isRtl ? "طلبات الشراء من المتجر" : "Store Redemptions"}</CardTitle>
                  <CardDescription className="text-xs">{isRtl ? "راجع طلبات المتجر والموافقة على استقطاع نقاط المشتركات" : "Process orders and deduct points"}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setBadgeDialogOpen(true)}>
                  <Award className="h-4 w-4 me-1.5 text-primary" />
                  {isRtl ? "تقليد وسام شارة" : "Award Badge"}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {claims.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">{isRtl ? "لا توجد طلبات متجر معلقة" : "No store orders yet"}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? "المشاركة" : "Participant"}</TableHead>
                        <TableHead>{isRtl ? "المنتج" : "Item"}</TableHead>
                        <TableHead>{isRtl ? "النقاط المستقطعة" : "Deducted Points"}</TableHead>
                        <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
                        <TableHead className="text-end">{isRtl ? "الإجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claims.map(claim => (
                        <TableRow key={claim.id}>
                          <TableCell className="font-bold">{claim.participant?.full_name}</TableCell>
                          <TableCell>{claim.reward?.name_ar}</TableCell>
                          <TableCell className="text-destructive font-bold">{claim.reward?.points_required}</TableCell>
                          <TableCell>
                            <Badge variant={claim.status === "approved" ? "secondary" : claim.status === "rejected" ? "outline" : "default"}>
                              {claim.status === "approved" ? (isRtl ? "تم التسليم ✓" : "Redeemed") : claim.status === "rejected" ? (isRtl ? "مرفوض" : "Rejected") : (isRtl ? "قيد المعالجة" : "Pending")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-end">
                            {claim.status === "pending" && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  className="h-8 bg-primary"
                                  onClick={() => handleProcessClaim(claim, "approved")}
                                >
                                  {isRtl ? "موافقة وتسليم" : "Deliver"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => handleProcessClaim(claim, "rejected")}
                                >
                                  {isRtl ? "رفض الطلب" : "Reject"}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.length === 0 && <div className="col-span-full text-center text-muted-foreground p-8 border border-dashed rounded-xl">{isRtl ? "لا توجد منتجات متوفرة حالياً" : "No items available"}</div>}
              {rewards.map(reward => (
                <Card key={reward.id} className="overflow-hidden hover:shadow-md transition-all">
                  <CardHeader className="bg-emerald-50/50 border-b pb-4">
                    <CardTitle className="text-lg text-emerald-900">{reward.name_ar}</CardTitle>
                    <CardDescription className="text-sm font-bold text-emerald-700">{reward.points_required} {isRtl ? "نقطة" : "Pts"}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    {reward.description_ar || (isRtl ? "لا يوجد وصف" : "No description")}
                  </CardContent>
                  <div className="p-4 pt-0 text-xs font-semibold text-emerald-600 flex justify-between items-center">
                    <span>{isRtl ? `الكمية المتاحة: ${reward.quantity}` : `Stock: ${reward.quantity}`}</span>
                  </div>
                </Card>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Sub-section: Audit Log */}
            <div className="space-y-4 border-t border-dashed pt-8">
              <h3 className="text-xl font-bold text-primary/80">{isRtl ? "سجل المراجعة" : "Audit Log"}</h3>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    {isRtl ? "سجل العمليات والمراجعة للنقاط" : "Points Logs Audit Trail"}
                  </CardTitle>
                  <CardDescription className="text-xs">{isRtl ? "مراجعة جميع النقاط الممنوحة وإمكانية إلغائها وسحبها في حال حدوث خطأ" : "Modify or cancel awarded points logs"}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? "المشاركة" : "Participant"}</TableHead>
                        <TableHead>{isRtl ? "النقاط" : "Points Delta"}</TableHead>
                        <TableHead>{isRtl ? "السبب" : "Reason"}</TableHead>
                        <TableHead>{isRtl ? "تاريخ العملية" : "Date"}</TableHead>
                        <TableHead className="text-end">{isRtl ? "الإجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="font-semibold">{log.participant?.full_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={log.delta > 0 ? "secondary" : "outline"} className={log.delta > 0 ? "text-emerald-700 bg-emerald-500/10 border-none" : "text-destructive border-none bg-destructive/10"}>
                              {log.delta > 0 ? `+${log.delta}` : log.delta}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{log.reason}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => log.participant && handleCancelPoints(log.id, log.participant.full_name, log.delta)}
                              className="text-destructive hover:bg-destructive/10 h-8 w-8"
                              title={isRtl ? "إلغاء المعاملة" : "Cancel log"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 4: TASKS & SUBMISSIONS
            ======================================================== */}
        {isManager && (
        <div className="space-y-6 border-t pt-8">
          <h2 className="text-2xl font-bold text-primary px-2">{isRtl ? "المهام والتسليمات" : "Tasks & Submissions"}</h2>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Create Task Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold">{isRtl ? "إنشاء مهمة جديدة" : "New Incentive Task"}</CardTitle>
                <CardDescription className="text-xs">{isRtl ? "أضف مهمة واجعلها بنقاط تُحسب تلقائياً فور الاعتماد" : "Add tasks with auto points reward"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{isRtl ? "عنوان المهمة" : "Task Title"}</Label>
                  <Input value={taskForm.title} onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{isRtl ? "وصف المهمة" : "Description"}</Label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>{isRtl ? "نقاط المهمة عند الإنجاز" : "Points Reward"}</Label>
                  <Input type="number" value={taskForm.points_reward} onChange={(e) => setTaskForm(prev => ({ ...prev, points_reward: Number(e.target.value) }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{isRtl ? "البداية" : "Start Date"}</Label>
                    <Input type="date" value={taskForm.start_date} onChange={(e) => setTaskForm(prev => ({ ...prev, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? "النهاية" : "End Date"}</Label>
                    <Input type="date" value={taskForm.end_date} onChange={(e) => setTaskForm(prev => ({ ...prev, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{isRtl ? "الفئة المستهدفة" : "Assign Target group"}</Label>
                  <Select value={taskForm.target_group_id || "all"} onValueChange={(val) => setTaskForm(prev => ({ ...prev, target_group_id: val === "all" ? "" : val }))}>
                    <SelectTrigger><SelectValue placeholder={isRtl ? "كل المشاركات" : "All participants"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRtl ? "كل المشاركات" : "All participants"}</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full mt-4 font-bold" onClick={handleCreateTask}>
                  <PlusCircle className="h-4 w-4 me-1.5" />
                  {isRtl ? "نشر المهمة للمشاركات" : "Publish Task"}
                </Button>
              </CardContent>
            </Card>

            {/* Submissions List Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-bold">{isRtl ? "طلبات التسليم للمهام" : "Participant Task Submissions"}</CardTitle>
                <CardDescription className="text-xs">{isRtl ? "راجع تسليمات المشاركات لتعتمدها وتضيف النقاط تلقائياً" : "Approve submissions to award points"}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">{isRtl ? "لا توجد تسليمات معلقة" : "No submissions submitted yet"}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? "المشاركة" : "Participant"}</TableHead>
                        <TableHead>{isRtl ? "المهمة" : "Task"}</TableHead>
                        <TableHead>{isRtl ? "محتوى الإنجاز" : "Submission text"}</TableHead>
                        <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
                        <TableHead className="text-end">{isRtl ? "الإجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-bold">{sub.participant?.full_name}</TableCell>
                          <TableCell>{sub.task?.title}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={sub.submission_text}>{sub.submission_text}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status === "approved" ? "secondary" : sub.status === "rejected" ? "outline" : "default"}>
                              {sub.status === "approved" ? (isRtl ? "معتمدة ✓" : "Approved") : sub.status === "rejected" ? (isRtl ? "مرفوضة" : "Rejected") : (isRtl ? "قيد المراجعة" : "Pending")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-end">
                            {sub.status === "pending" && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  className="h-8 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleReviewSubmission(sub, "approved")}
                                >
                                  {isRtl ? "اعتماد" : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                  onClick={() => handleReviewSubmission(sub, "rejected")}
                                >
                                  {isRtl ? "رفض" : "Reject"}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* ========================================================
            SECTION 6: BUDGET & REPORTS
            ======================================================== */}
        {isManager && (
        <div className="space-y-6 border-t pt-8">
          <h2 className="text-2xl font-bold text-primary px-2">{isRtl ? "التقارير والميزانية" : "Budget & Reports"}</h2>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Quick Budget Entry */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base font-bold">{isRtl ? "إضافة معاملة مالية" : "New Budget Transaction"}</CardTitle>
                <CardDescription className="text-xs">{isRtl ? "تسجيل ميزانيات جوائز الأنشطة ومصروفات الحوافز" : "Register incentive expenses"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{isRtl ? "اسم المعاملة" : "Transaction Title"}</Label>
                  <Input value={budgetForm.title} onChange={(e) => setBudgetForm(prev => ({ ...prev, title: e.target.value }))} placeholder={isRtl ? "مثال: شراء هدايا عينية..." : "e.g. Purchase gifts..."} />
                </div>
                <div className="space-y-2">
                  <Label>{isRtl ? "المبلغ" : "Amount"}</Label>
                  <Input type="number" value={budgetForm.amount} onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>{isRtl ? "نوع المعاملة" : "Direction"}</Label>
                  <Select value={budgetForm.transaction_type} onValueChange={(val) => setBudgetForm(prev => ({ ...prev, transaction_type: val }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{isRtl ? "مصروفات (صادر)" : "Expense"}</SelectItem>
                      <SelectItem value="income">{isRtl ? "دعم وموارد (وارد)" : "Income / Resource"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isRtl ? "ملاحظات" : "Notes"}</Label>
                  <Textarea value={budgetForm.notes} onChange={(e) => setBudgetForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
                </div>
                <Button className="w-full mt-4 font-bold" onClick={handleAddBudget}>
                  <DollarSign className="h-4 w-4 me-1.5" />
                  {isRtl ? "تسجيل الميزانية" : "Save Transaction"}
                </Button>
              </CardContent>
            </Card>

            {/* Reports and Logs Summary */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-purple-600" />
                    {isRtl ? "الميزانية والتقارير التربوية" : "Reports and Incentives Budget Log"}
                  </CardTitle>
                  <CardDescription className="text-xs">{isRtl ? "سجل التمويل والمصروفات وجاهزية طباعة تقرير الإنجاز" : "Print ready incentive reports"}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold border-primary/20 text-primary">
                  <FileText className="h-4 w-4 me-1.5" />
                  {isRtl ? "طباعة تقرير الإنجاز العام" : "Print Enjaz Report"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Budget transaction log table */}
                <div className="border rounded-lg max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>{isRtl ? "البيان / المعاملة" : "Transaction"}</TableHead>
                        <TableHead>{isRtl ? "النوع" : "Type"}</TableHead>
                        <TableHead>{isRtl ? "المبلغ" : "Amount"}</TableHead>
                        <TableHead>{isRtl ? "تاريخ المعاملة" : "Date"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.title}</TableCell>
                          <TableCell>
                            <Badge variant={b.transaction_type === "income" ? "secondary" : "outline"} className={b.transaction_type === "income" ? "text-emerald-700" : "text-destructive"}>
                              {b.transaction_type === "income" ? (isRtl ? "وارد" : "Income") : (isRtl ? "صادر" : "Expense")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">{Number(b.amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                      {budgets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">{isRtl ? "لا توجد معاملات مالية مسجلة بعد" : "No budget entries logged"}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* ========================================================
            SECTION 7: SETTINGS
            ======================================================== */}
        {isManager && (
        <div className="space-y-6 border-t pt-8">
          <h2 className="text-2xl font-bold text-primary px-2">{isRtl ? "الإعدادات وقواعد الإنجاز" : "Settings & Rules"}</h2>
          <Card className="border shadow-md rounded-xl p-5 space-y-4">
            <CardHeader className="p-0 pb-3 border-b flex flex-row items-center gap-2 space-y-0">
              <Star className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-base">{isRtl ? "إعدادات وقواعد نظام إنجاز والتحفيز" : "Enjaz Rules & Settings"}</CardTitle>
                <CardDescription className="text-xs">{isRtl ? "التحكم في نقاط الحضور وقواعد مكافآت نظام إنجاز" : "Configure points weightage and rewards catalog"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-3 space-y-6">
              <div className="bg-secondary/20 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span>{isRtl ? "نقاط الحضور والالتزام" : "Attendance Points Weight"}</span>
                </div>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRtl ? "حاضر" : "Present"}</Label>
                    <Input 
                      type="number" 
                      value={projectPointsRules.present} 
                      onChange={(e) => setProjectPointsRules(prev => ({ ...prev, present: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRtl ? "متأخر" : "Late"}</Label>
                    <Input 
                      type="number" 
                      value={projectPointsRules.late} 
                      onChange={(e) => setProjectPointsRules(prev => ({ ...prev, late: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRtl ? "غائب" : "Absent"}</Label>
                    <Input 
                      type="number" 
                      value={projectPointsRules.absent} 
                      onChange={(e) => setProjectPointsRules(prev => ({ ...prev, absent: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRtl ? "عذر مقبول" : "Excused"}</Label>
                    <Input 
                      type="number" 
                      value={projectPointsRules.excused} 
                      onChange={(e) => setProjectPointsRules(prev => ({ ...prev, excused: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handleSavePointsRules} className="mt-1">
                  {isRtl ? "حفظ قواعد نقاط الحضور" : "Save Points Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* ========================================================
          DIALOGS
          ======================================================== */}
      
      {/* Quick Points Dialog */}
      <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-primary fill-current" />
              {isRtl ? "رصد نقاط يدوية سريعة" : "Quick Points Award"}
            </DialogTitle>
            <DialogDescription className="text-xs">{isRtl ? "رصد نقاط لفرد أو لمجموعة كاملة كحافز أسبوعي أو يومي" : "Award points to participants or groups"}</DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{isRtl ? "نوع الإضافة" : "Award Target"}</Label>
                    <Select value={pointsTarget} onValueChange={(val) => setPointsTarget(val as "individual" | "group")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">{isRtl ? "مشاركة فردية" : "Individual Participant"}</SelectItem>
                        <SelectItem value="group">{isRtl ? "مجموعة كاملة" : "Whole Group"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {pointsTarget === "individual" ? (
                    <div className="space-y-2">
                      <Label>{isRtl ? "اختر المشاركة" : "Select Participant"}</Label>
                      <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                        <SelectTrigger><SelectValue placeholder={isRtl ? "اختر..." : "Select..."} /></SelectTrigger>
                        <SelectContent>
                          {participants.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{isRtl ? "اختر المجموعة" : "Select Group"}</Label>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger><SelectValue placeholder={isRtl ? "اختر..." : "Select..."} /></SelectTrigger>
                        <SelectContent>
                          {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{isRtl ? "مقدار النقاط" : "Points Amount"}</Label>
                    <Input type="number" value={pointsDelta} onChange={(e) => setPointsDelta(Number(e.target.value))} />
                  </div>

                  <div className="space-y-2">
                    <Label>{isRtl ? "سبب الإضافة" : "Reason / Criteria"}</Label>
                    <Input value={pointsReason} onChange={(e) => setPointsReason(e.target.value)} placeholder={isRtl ? "مثال: التزام أسبوعي، مبادرة، حفظ..." : "e.g. Weekly commitment..."} />
                  </div>

                  <Button className="w-full mt-4 font-bold" onClick={handleAddPoints}>
                    <Check className="h-4 w-4 me-1.5" />
                    {isRtl ? "إضافة النقاط وتأكيد العملية" : "Confirm Award"}
                  </Button>
                </CardContent>
          </div>
        </DialogContent>
      </Dialog>
{/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRtl ? "إنشاء مجموعة جديدة" : "Create New Group"}</DialogTitle>
            <DialogDescription className="text-xs">{isRtl ? "أدخل اسماً مميزاً للمجموعة التربوية داخل المشروع" : "Add educational group/family"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{isRtl ? "اسم المجموعة" : "Group Name"}</Label>
            <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={isRtl ? "مثال: مجموعة الهمم..." : "e.g. Al-Himam group..."} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleAddGroup}>{isRtl ? "إضافة" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Initiative Dialog */}
      <Dialog open={initiativeDialogOpen} onOpenChange={setInitiativeDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isRtl ? "إنشاء مبادرة تحفيزية جديدة" : "Create New Initiative"}</DialogTitle>
            <DialogDescription className="text-xs">{isRtl ? "أدخل تفاصيل وشروط المبادرة التربوية" : "Define educational initiative details & limits"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-2">
              <Label>{isRtl ? "اسم المبادرة" : "Name"}</Label>
              <Input
                value={newInitiativeForm.name}
                onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={isRtl ? "مثال: الابتسامة، يد العون..." : "e.g. Smile, Early Attendance..."}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{isRtl ? "رمز الأيقونة (Emoji)" : "Icon Emoji"}</Label>
                <Input
                  value={newInitiativeForm.icon}
                  onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="🌟"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "عدد النقاط" : "Points"}</Label>
                <Input
                  type="number"
                  value={newInitiativeForm.points}
                  onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, points: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "وصف المبادرة" : "Description"}</Label>
              <Textarea
                value={newInitiativeForm.description}
                onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={isRtl ? "تمنح للمشاركة التي..." : "Awarded to participant who..."}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "نطاق المبادرة" : "Scope"}</Label>
              <Select
                value={newInitiativeForm.scope}
                onValueChange={(val) => setNewInitiativeForm(prev => ({ ...prev, scope: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">{isRtl ? "كل المشروع" : "Project wide"}</SelectItem>
                  <SelectItem value="group">{isRtl ? "المجموعة المشرف عليها فقط" : "Assigned Group"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{isRtl ? "تاريخ البدء" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={newInitiativeForm.start_date}
                  onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "تاريخ الانتهاء" : "End Date"}</Label>
                <Input
                  type="date"
                  value={newInitiativeForm.end_date}
                  onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{isRtl ? "الحد اليومي للمعلم" : "Daily Limit"}</Label>
                <Input
                  type="number"
                  placeholder={isRtl ? "اختياري" : "Optional"}
                  value={newInitiativeForm.daily_limit}
                  onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, daily_limit: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRtl ? "الحد الأقصى للمشاركة" : "Participant Max"}</Label>
                <Input
                  type="number"
                  placeholder={isRtl ? "اختياري" : "Optional"}
                  value={newInitiativeForm.max_per_participant}
                  onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, max_per_participant: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "رسالة تشجيعية تلقائية عند المنح" : "Automatic Encouraging Message"}</Label>
              <Input
                value={newInitiativeForm.encouragement_message}
                onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, encouragement_message: e.target.value }))}
                placeholder={isRtl ? "مثال: أحسنتِ يا [الاسم] لتميزكِ بمبادرة الابتسامة!" : "e.g. Great job [الاسم]!"}
              />
            </div>

            <div className="flex items-center space-x-2 space-x-reverse pt-2">
              <input
                type="checkbox"
                id="requires_approval"
                checked={newInitiativeForm.requires_approval}
                onChange={(e) => setNewInitiativeForm(prev => ({ ...prev, requires_approval: e.target.checked }))}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="requires_approval" className="cursor-pointer">
                {isRtl ? "تحتاج اعتماد من الإدارة قبل إضافة النقاط" : "Requires admin approval before awarding"}
              </Label>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setInitiativeDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleCreateInitiative}>{isRtl ? "إنشاء المبادرة" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Initiative Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isRtl 
                ? `منح مبادرة ${selectedInitiativeForGrant?.icon || "🌟"} ${selectedInitiativeForGrant?.name || ""}` 
                : `Award ${selectedInitiativeForGrant?.name || ""} Initiative`
              }
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isRtl ? "اختر المشاركة المناسبة واكتب ملاحظاتك لمنح النقاط فوراً" : "Select a participant and add optional notes."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-2">
              <Label>{isRtl ? "اختر المشاركة" : "Select Participant"}</Label>
              <Select value={selectedPartIdForGrant} onValueChange={setSelectedPartIdForGrant}>
                <SelectTrigger><SelectValue placeholder={isRtl ? "اختر مشاركة..." : "Select..."} /></SelectTrigger>
                <SelectContent>
                  {participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "ملاحظة اختيارية" : "Optional Notes"}</Label>
              <Textarea
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                placeholder={isRtl ? "أضف أي تفاصيل إضافية..." : "Add details..."}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleGrantInitiative}>{isRtl ? "منح النقاط" : "Award"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge Award Dialog */}
      <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRtl ? "تقليد وسام شارة إنجاز" : "Award Enjaz Badge"}</DialogTitle>
            <DialogDescription className="text-xs">{isRtl ? "اختر وساماً ومكافأة المشروعات لتكريم المنجزات" : "Choose badge for honor roll"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{isRtl ? "المشاركة المستحقة" : "Select Participant"}</Label>
              <Select value={badgeRecipientId} onValueChange={setBadgeRecipientId}>
                <SelectTrigger><SelectValue placeholder={isRtl ? "اختر مشاركة..." : "Select..."} /></SelectTrigger>
                <SelectContent>
                  {participants.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRtl ? "شارة التكريم" : "Select Badge"}</Label>
              <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
                <SelectTrigger><SelectValue placeholder={isRtl ? "اختر شارة..." : "Select..."} /></SelectTrigger>
                <SelectContent>
                  {badges.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.icon} {b.name_ar} (+{b.points_reward} {isRtl ? "نقطة" : "Pts"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadgeDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleAwardBadge}>{isRtl ? "تقليد التكريم" : "Award Badge"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

