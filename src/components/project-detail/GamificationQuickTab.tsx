import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Trophy, Users, Star, PlusCircle, RotateCw, History } from "lucide-react";
import { toast } from "sonner";

interface GamificationQuickTabProps {
  projectId: string;
}

interface EnjazGroup {
  id: string;
  name_ar: string;
}

interface Participant {
  id: string;
  full_name: string;
  points: number;
  group_id: string | null;
}

interface EnjazBadge {
  id: string;
  name_ar: string;
  icon: string;
  description_ar: string;
  points_reward: number;
}

interface PointLog {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
  participant?: { full_name: string };
}

export const GamificationQuickTab = ({ projectId }: GamificationQuickTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<EnjazGroup[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [badges, setBadges] = useState<EnjazBadge[]>([]);
  const [logs, setLogs] = useState<PointLog[]>([]);

  // Action Form States
  const [targetType, setTargetType] = useState<"individual" | "group">("individual");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [pointsAmount, setPointsAmount] = useState("10");
  const [pointsReason, setPointsReason] = useState("");
  
  // Badge Form States
  const [badgeRecipientId, setBadgeRecipientId] = useState("");
  const [selectedBadgeId, setSelectedBadgeId] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, partsRes, badgesRes, logsRes] = await Promise.all([
        supabase.from("project_groups").select("*").eq("project_id", projectId),
        supabase.from("participants").select("id, full_name, points, group_id").eq("project_id", projectId).eq("status", "active"),
        supabase.from("enjaz_badges").select("*"),
        supabase.from("participant_points_log")
          .select("id, delta, reason, created_at, participant:participants(full_name)")
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      setGroups((groupsRes.data ?? []) as EnjazGroup[]);
      setParticipants((partsRes.data ?? []) as Participant[]);
      setBadges((badgesRes.data ?? []) as EnjazBadge[]);
      setLogs((logsRes.data ?? []) as unknown as PointLog[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Submit points log
  const handleAwardPoints = async () => {
    const delta = Number(pointsAmount);
    if (isNaN(delta) || delta === 0) {
      toast.error(isRtl ? "يرجى تحديد عدد نقاط صالح" : "Please select valid points");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (targetType === "individual") {
        if (!selectedParticipantId) {
          toast.error(isRtl ? "يرجى اختيار المشارك" : "Please select a participant");
          return;
        }

        const partObj = participants.find(p => p.id === selectedParticipantId);
        if (!partObj) return;

        const { error: updErr } = await supabase.from("participants").update({
          points: Math.max(0, (partObj.points || 0) + delta)
        }).eq("id", selectedParticipantId);

        if (updErr) throw updErr;

        const { error: logErr } = await supabase.from("participant_points_log").insert([{
          participant_id: selectedParticipantId,
          delta,
          reason: pointsReason.trim() || (isRtl ? "تحفيز إداري سريع" : "Quick Admin Point Award"),
          created_by: user?.id
        }]);

        if (logErr) throw logErr;

      } else {
        if (!selectedGroupId) {
          toast.error(isRtl ? "يرجى اختيار المجموعة" : "Please select a group");
          return;
        }

        const groupParts = participants.filter(p => p.group_id === selectedGroupId);
        if (groupParts.length === 0) {
          toast.error(isRtl ? "هذه المجموعة لا تحتوي على مشاركين نشطين حالياً" : "This group has no active participants");
          return;
        }

        const groupObj = groups.find(g => g.id === selectedGroupId);

        const promises = groupParts.map(async (p) => {
          await supabase.from("participants").update({
            points: Math.max(0, (p.points || 0) + delta)
          }).eq("id", p.id);

          await supabase.from("participant_points_log").insert([{
            participant_id: p.id,
            delta,
            reason: `${pointsReason.trim() || (isRtl ? "تحفيز جماعي سريع" : "Quick Group Point Award")} (${groupObj?.name_ar})`,
            created_by: user?.id
          }]);
        });

        await Promise.all(promises);
      }

      toast.success(isRtl ? "تم رصد وإضافة النقاط بنجاح" : "Points awarded successfully");
      setPointsReason("");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Submit badge award
  const handleAwardBadge = async () => {
    if (!badgeRecipientId || !selectedBadgeId) {
      toast.error(isRtl ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill in all fields");
      return;
    }

    try {
      const badge = badges.find(b => b.id === selectedBadgeId);
      const part = participants.find(p => p.id === badgeRecipientId);
      if (!badge || !part) return;

      // Check if already awarded
      const { data: existing } = await supabase
        .from("enjaz_participant_badges")
        .select("id")
        .eq("participant_id", badgeRecipientId)
        .eq("badge_id", selectedBadgeId)
        .maybeSingle();

      if (existing) {
        toast.error(isRtl ? "المشاركة حصلت على هذا الوسام مسبقاً" : "This participant already has this badge");
        return;
      }

      const { error: insErr } = await supabase.from("enjaz_participant_badges").insert([{
        participant_id: badgeRecipientId,
        badge_id: selectedBadgeId
      }]);

      if (insErr) throw insErr;

      if (badge.points_reward > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("participants").update({
          points: (part.points || 0) + badge.points_reward
        }).eq("id", part.id);

        await supabase.from("participant_points_log").insert([{
          participant_id: part.id,
          delta: badge.points_reward,
          reason: `${isRtl ? "منح وسام:" : "Awarded Badge:"} ${badge.name_ar}`,
          created_by: user?.id
        }]);
      }

      toast.success(isRtl ? "تم تقليد الوسام وإضافة نقاط التحفيز بنجاح" : "Badge awarded successfully");
      setSelectedBadgeId("");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) return <div className="text-center py-6">{isRtl ? "جاري تحميل لوحة الرصد التحفيزي..." : "Loading gamification..."}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{isRtl ? "الرصد والتحفيز السريع" : "Quick Gamification Panel"}</h2>
        <CardDescription>{isRtl ? "إضافة النقاط التحفيزية المباشرة ومنح الأوسمة الفخرية لأعضاء المجموعات" : "Directly award points and badges to participants"}</CardDescription>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Points Panel */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-md flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {isRtl ? "رصد النقاط السريع" : "Quick Points Award"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isRtl ? "نوع الجهة المستهدفة" : "Target Type"}</Label>
              <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">{isRtl ? "مشارك فردي" : "Individual Participant"}</SelectItem>
                  <SelectItem value="group">{isRtl ? "مجموعة كاملة" : "Whole Group"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === "individual" ? (
              <div className="space-y-2">
                <Label>{isRtl ? "اختر المشارك" : "Select Participant"}</Label>
                <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRtl ? "اختر مشاركاً" : "Choose participant"} />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({isRtl ? "النقاط الحالية:" : "Current Points:"} {p.points})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{isRtl ? "اختر المجموعة" : "Select Group"}</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRtl ? "اختر مجموعة" : "Choose group"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{isRtl ? "عدد النقاط" : "Points Amount"}</Label>
              <div className="flex gap-2 flex-wrap">
                {["5", "10", "15", "25", "50"].map((num) => (
                  <Button 
                    key={num} 
                    type="button" 
                    variant={pointsAmount === num ? "default" : "outline"} 
                    onClick={() => setPointsAmount(num)}
                    className="flex-1"
                  >
                    +{num}
                  </Button>
                ))}
                <Input 
                  type="number" 
                  value={pointsAmount} 
                  onChange={(e) => setPointsAmount(e.target.value)} 
                  placeholder={isRtl ? "قيمة مخصصة" : "Custom value"} 
                  className="w-24 text-center font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "سبب منح النقاط" : "Reason / Note"}</Label>
              <Input 
                value={pointsReason} 
                onChange={(e) => setPointsReason(e.target.value)} 
                placeholder={isRtl ? "مثال: تميز في الحفظ والمشاركة" : "e.g., Active participation"} 
              />
            </div>

            <Button className="w-full" onClick={handleAwardPoints}>
              <PlusCircle className="h-4 w-4 me-1.5" />
              {isRtl ? "تأكيد ورصد النقاط" : "Confirm Points Award"}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Badge Panel */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-md flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {isRtl ? "تقليد الأوسمة الفخرية" : "Award Honor Badge"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isRtl ? "المشارك المستلم" : "Recipient Participant"}</Label>
              <Select value={badgeRecipientId} onValueChange={setBadgeRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder={isRtl ? "اختر مشاركاً" : "Choose participant"} />
                </SelectTrigger>
                <SelectContent>
                  {participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? "اختر الوسام" : "Choose Badge"}</Label>
              <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
                <SelectTrigger>
                  <SelectValue placeholder={isRtl ? "اختر وساماً" : "Choose badge"} />
                </SelectTrigger>
                <SelectContent>
                  {badges.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.icon} {b.name_ar} (+{b.points_reward} {isRtl ? "نقطة إضافية" : "bonus pts"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" variant="outline" onClick={handleAwardBadge}>
              <Star className="h-4 w-4 me-1.5 text-amber-500" />
              {isRtl ? "منح وتقليد الوسام" : "Award Honor Badge"}
            </Button>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 font-semibold text-xs text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                <span>{isRtl ? "آخر عمليات الرصد" : "Recent Log Activity"}</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5 text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-2">{isRtl ? "لا توجد حركات حديثة" : "No recent activity"}</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex justify-between items-center bg-secondary/50 p-2 rounded">
                      <span className="font-medium truncate max-w-[12rem]">{log.participant?.full_name}</span>
                      <span className="text-muted-foreground truncate max-w-[12rem] mx-1">{log.reason}</span>
                      <span className={`font-bold ${log.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {log.delta >= 0 ? `+${log.delta}` : log.delta}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

