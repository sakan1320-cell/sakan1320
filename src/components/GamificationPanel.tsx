import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Award, Trophy, Zap, Star, ShieldCheck, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface GamificationPanelProps {
  participantId: string;
  projectId: string;
  points: number;
  onPointsUpdated?: () => void;
}

interface Level {
  id: string;
  name_ar: string;
  name_en: string | null;
  min_points: number;
  max_points: number;
  icon: string;
  color: string;
}

interface BadgeItem {
  id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  icon: string;
  points_reward: number;
}

interface EarnedBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge: BadgeItem;
}

interface Challenge {
  id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  points_reward: number;
  target_value: number;
  challenge_type: string;
}

interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  progress: number;
  status: string;
  challenge: Challenge;
}

export const GamificationPanel = ({ participantId, projectId, points, onPointsUpdated }: GamificationPanelProps) => {
  const { t, i18n } = useTranslation();
  const { isSystemAdmin } = useAuth(); // staff check
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [nextLevel, setNextLevel] = useState<Level | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<ChallengeParticipant[]>([]);
  const [availableBadges, setAvailableBadges] = useState<BadgeItem[]>([]);
  
  // Award badge modal
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGamificationData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Levels
      const { data: lvls } = await supabase.from("participant_levels").select("*").order("min_points", { ascending: true });
      const levelList = (lvls ?? []) as Level[];
      setLevels(levelList);

      // Find current and next level
      const current = levelList.find((l) => points >= l.min_points && points <= l.max_points) || levelList[0] || null;
      setCurrentLevel(current);

      if (current) {
        const nextIndex = levelList.findIndex((l) => l.id === current.id) + 1;
        setNextLevel(levelList[nextIndex] || null);
      }

      // 2. Fetch Earned Badges
      const { data: eBadges } = await supabase
        .from("participant_badges")
        .select(`
          id,
          badge_id,
          earned_at,
          badge:badges(id, name_ar, name_en, description_ar, icon, points_reward)
        `)
        .eq("participant_id", participantId);
      
      setEarnedBadges((eBadges ?? []) as unknown as EarnedBadge[]);

      // 3. Fetch Challenges
      const { data: chs } = await supabase
        .from("challenge_participants")
        .select(`
          id,
          challenge_id,
          progress,
          status,
          challenge:challenges(id, name_ar, name_en, description_ar, points_reward, target_value, challenge_type)
        `)
        .eq("participant_id", participantId);
      
      setActiveChallenges((chs ?? []) as unknown as ChallengeParticipant[]);

      // 4. Fetch Available Badges to award (for admin/staff)
      const { data: bgs } = await supabase.from("badges").select("*").eq("is_active", true);
      setAvailableBadges((bgs ?? []) as BadgeItem[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [participantId, points]);

  useEffect(() => {
    loadGamificationData();
  }, [loadGamificationData]);

  const handleAwardBadge = async () => {
    if (!selectedBadgeId) { toast.error(t("gamification.selectBadge", "يرجى اختيار شارة")); return; }
    
    // Check if badge is already earned
    if (earnedBadges.some((eb) => eb.badge_id === selectedBadgeId)) {
      toast.error(t("gamification.alreadyEarned", "لقد حصل المشارك على هذه الشارة مسبقاً"));
      return;
    }

    setAwarding(true);
    try {
      const badge = availableBadges.find((b) => b.id === selectedBadgeId);
      if (!badge) return;

      const { data: { user } } = await supabase.auth.getUser();

      // 1. Earn badge
      const { error: ebErr } = await supabase.from("participant_badges").insert([{
        participant_id: participantId,
        badge_id: selectedBadgeId,
      }]);
      if (ebErr) throw ebErr;

      // 2. Add points
      if (badge.points_reward > 0) {
        const { error: pErr } = await supabase
          .from("participants")
          .update({ points: points + badge.points_reward })
          .eq("id", participantId);
        if (pErr) throw pErr;

        // Log points
        await supabase.from("participant_points_log").insert([{
          participant_id: participantId,
          delta: badge.points_reward,
          reason: `شارة: ${badge.name_ar}`,
          created_by: user?.id,
        }]);
      }

      toast.success(t("gamification.badgeAwarded", "تم منح الشارة وإضافة النقاط بنجاح"));
      setBadgeOpen(false);
      setSelectedBadgeId("");
      loadGamificationData();
      if (onPointsUpdated) onPointsUpdated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAwarding(false);
    }
  };

  const getProgressPercentage = () => {
    if (!currentLevel) return 0;
    if (!nextLevel) return 100;
    const range = nextLevel.min_points - currentLevel.min_points;
    const currentOffset = points - currentLevel.min_points;
    return Math.min(100, Math.max(0, Math.round((currentOffset / range) * 100)));
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* 1. Level progress card */}
      {currentLevel && (
        <Card className="overflow-hidden border-2" style={{ borderColor: currentLevel.color }}>
          <div className="h-1.5 w-full" style={{ backgroundColor: currentLevel.color }} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{currentLevel.icon}</span>
                <div>
                  <h3 className="font-bold text-lg">
                    {i18n.language === "ar" ? currentLevel.name_ar : (currentLevel.name_en || currentLevel.name_ar)}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("gamification.levelRange", { min: currentLevel.min_points, max: currentLevel.max_points })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center sm:items-end">
                <Badge className="text-sm px-3 py-1 font-semibold" style={{ backgroundColor: currentLevel.color }}>
                  {points} {t("participants.points", "نقطة")}
                </Badge>
                {nextLevel && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t("gamification.neededForNext", { points: nextLevel.min_points - points })} {t("gamification.pointsToNextLevel", "نقاط متبقية للمستوى القادم")}
                  </p>
                )}
              </div>
            </div>

            {nextLevel && (
              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>{currentLevel.icon} {i18n.language === "ar" ? currentLevel.name_ar : currentLevel.name_en}</span>
                  <span>{getProgressPercentage()}%</span>
                  <span>{nextLevel.icon} {i18n.language === "ar" ? nextLevel.name_ar : nextLevel.name_en}</span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2. Badges grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {t("gamification.badges", "الشارات والأوسمة")}
          </CardTitle>
          {isSystemAdmin && (
            <Button size="sm" variant="outline" onClick={() => setBadgeOpen(true)}>
              <Plus className="h-4 w-4 me-1.5" />
              {t("gamification.awardBadge", "منح شارة")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {earnedBadges.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">
              {t("gamification.noBadgesYet", "لم يتم الحصول على أي شارات بعد. شارك بنشاط للحصول عليها!")}
            </p>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
              {earnedBadges.map((eb) => (
                <div
                  key={eb.id}
                  className="flex flex-col items-center text-center p-4 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors group relative"
                >
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
                    {eb.badge.icon}
                  </div>
                  <div className="font-semibold text-sm">
                    {i18n.language === "ar" ? eb.badge.name_ar : (eb.badge.name_en || eb.badge.name_ar)}
                  </div>
                  {eb.badge.description_ar && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {eb.badge.description_ar}
                    </p>
                  )}
                  {eb.badge.points_reward > 0 && (
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      +{eb.badge.points_reward} {t("participants.points", "نقطة")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Challenges section */}
      {activeChallenges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              {t("gamification.challenges", "التحديات النشطة")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeChallenges.map((cp) => {
              const pct = Math.min(100, Math.round((cp.progress / cp.challenge.target_value) * 100));
              return (
                <div key={cp.id} className="p-4 rounded-lg border bg-gradient-to-r from-card to-background space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-warning fill-current" />
                        {i18n.language === "ar" ? cp.challenge.name_ar : (cp.challenge.name_en || cp.challenge.name_ar)}
                      </h4>
                      {cp.challenge.description_ar && (
                        <p className="text-xs text-muted-foreground mt-1">{cp.challenge.description_ar}</p>
                      )}
                    </div>
                    <Badge variant={cp.status === "completed" ? "default" : "outline"}>
                      {cp.status === "completed" ? t("common.completed", "مكتمل") : `${cp.progress}/${cp.challenge.target_value}`}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{t("gamification.challengeProgress", "نسبة التقدم")}</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <div className="flex justify-end pt-1">
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      +{cp.challenge.points_reward} {t("participants.points", "نقطة عند الإنجاز")}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Award Badge Dialog */}
      <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("gamification.awardBadgeTitle", "منح شارة إنجاز للمشارك")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("gamification.selectBadgeLabel", "اختر الشارة")}</Label>
              <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("gamification.selectBadge", "اختر شارة...")} />
                </SelectTrigger>
                <SelectContent>
                  {availableBadges
                    .filter((b) => !earnedBadges.some((eb) => eb.badge_id === b.id))
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.icon} {i18n.language === "ar" ? b.name_ar : (b.name_en || b.name_ar)} (+{b.points_reward} {t("participants.points", "نقطة")})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadgeOpen(false)} disabled={awarding}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAwardBadge} disabled={awarding}>
              {awarding ? t("common.loading") : t("gamification.award", "منح")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
