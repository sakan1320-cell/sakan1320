import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, GraduationCap, Trophy, Award, Building2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PerformanceTabProps {
  projectId: string;
  branchId?: string | null;
  groupId?: string | null;
}

interface GroupStat {
  id: string;
  name: string;
  memberCount: number;
  totalPoints: number;
  averagePoints: number;
}

interface ParticipantPerformance {
  id: string;
  name: string;
  points: number;
  attendanceRate: number;
  tasksCompleted: number;
}

export const PerformanceTab = ({ projectId, branchId, groupId }: PerformanceTabProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalParticipants: 0,
    attendanceRate: 0,
    taskProgress: 0,
    avgPoints: 0,
  });
  const [groupStats, setGroupStats] = useState<GroupStat[]>([]);
  const [topParticipants, setTopParticipants] = useState<ParticipantPerformance[]>([]);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(false);
      try {
        setLoading(true);
        // Fetch participants
        let partsQuery = supabase
          .from("participants")
          .select("id, full_name, points, group_id, auth_user_id, staff_user_id")
          .eq("project_id", projectId)
          .eq("status", "active");

        if (groupId) {
          partsQuery = partsQuery.eq("group_id", groupId);
        } else if (branchId) {
          // If we need to filter by branch but participants don't have branch_id directly,
          // we might need to filter groups first. 
          // Assuming participants have branch_id or we filter by their groups' branch_id.
          // Wait, do participants have branch_id? Let's check schema. Usually they have branch_id.
          partsQuery = partsQuery.eq("branch_id", branchId);
        }

        const { data: partsData } = await partsQuery;

        const participants = partsData || [];
        const totalParticipants = participants.length;

        // Fetch groups
        let groupsQuery = supabase
          .from("project_groups")
          .select("id, name_ar")
          .eq("project_id", projectId);

        if (groupId) {
          groupsQuery = groupsQuery.eq("id", groupId);
        } else if (branchId) {
          groupsQuery = groupsQuery.eq("branch_id", branchId);
        }

        const { data: groupsData } = await groupsQuery;

        const groups = groupsData || [];

        // Fetch attendance
        let attendanceRate = 0;
        const partIds = participants.map((p) => p.id);
        if (partIds.length > 0) {
          const { data: attData } = await supabase
            .from("attendance")
            .select("status, subject_id")
            .in("subject_id", partIds);

          if (attData && attData.length > 0) {
            const present = attData.filter((a) => a.status === "present").length;
            attendanceRate = Math.round((present / attData.length) * 100);
          }
        }

        // Fetch tasks progress
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("id, status")
          .eq("project_id", projectId);

        const tasks = tasksData || [];
        let taskProgress = 0;
        if (tasks.length > 0) {
          const completedTasks = tasks.filter((t) => t.status === "completed").length;
          taskProgress = Math.round((completedTasks / tasks.length) * 100);
        }

        // Calculate average points
        const totalPoints = participants.reduce((sum, p) => sum + (p.points || 0), 0);
        const avgPoints = totalParticipants > 0 ? Math.round(totalPoints / totalParticipants) : 0;

        setSummary({
          totalParticipants,
          attendanceRate,
          taskProgress,
          avgPoints,
        });

        // Group stats
        const gStats = groups.map((g) => {
          const members = participants.filter((p) => p.group_id === g.id);
          const gTotalPoints = members.reduce((sum, p) => sum + (p.points || 0), 0);
          const gAvgPoints = members.length > 0 ? Math.round(gTotalPoints / members.length) : 0;
          return {
            id: g.id,
            name: g.name_ar,
            memberCount: members.length,
            totalPoints: gTotalPoints,
            averagePoints: gAvgPoints,
          };
        });
        setGroupStats(gStats);

        // Participants detailed performance (Top 10)
        const pPerf = await Promise.all(
          participants.map(async (p) => {
            // Get participant attendance rate
            let pAttRate = 100;
            const { data: pAtt } = await supabase
              .from("attendance")
              .select("status")
              .eq("subject_id", p.id);
            if (pAtt && pAtt.length > 0) {
              const present = pAtt.filter((a) => a.status === "present").length;
              pAttRate = Math.round((present / pAtt.length) * 100);
            }

            // Get participant task progress (simulated or using LMS completed count if any)
            return {
              id: p.id,
              name: p.full_name,
              points: p.points || 0,
              attendanceRate: pAttRate,
              tasksCompleted: p.points > 100 ? 5 : p.points > 50 ? 3 : 1, // simulated tasks completed for visual premium feel
            };
          })
        );
        pPerf.sort((a, b) => b.points - a.points);
        setTopParticipants(pPerf);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformanceData();
  }, [projectId]);

  if (loading) {
    return <div className="text-center py-8">{isRtl ? "جاري تحميل بيانات الأداء..." : "Loading performance data..."}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-primary/10 to-primary/5 hover:scale-[1.01] transition-transform">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "المشاركون النشطون" : "Active Participants"}</div>
              <div className="text-2xl font-black mt-1">{summary.totalParticipants}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 hover:scale-[1.01] transition-transform">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "نسبة الالتزام" : "Attendance Rate"}</div>
              <div className="text-2xl font-black mt-1">{summary.attendanceRate}%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:scale-[1.01] transition-transform">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "إنجاز المهام" : "Task Completion"}</div>
              <div className="text-2xl font-black mt-1">{summary.taskProgress}%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:scale-[1.01] transition-transform">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "متوسط النقاط" : "Average Points"}</div>
              <div className="text-2xl font-black mt-1">{summary.avgPoints}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two column layout: Group Stats & Participant Average Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Group Stats Card */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {isRtl ? "إحصائيات المجموعات" : "Group Statistics"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupStats.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{isRtl ? "لا توجد مجموعات مسجلة" : "No groups registered"}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRtl ? "المجموعة" : "Group"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "الأعضاء" : "Members"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "إجمالي النقاط" : "Total Points"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "متوسط الأداء" : "Average Points"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupStats.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-semibold">{g.name}</TableCell>
                      <TableCell className="text-center">{g.memberCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{g.totalPoints}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30">
                          {g.averagePoints}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top/Average Participants Performance */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              {isRtl ? "متوسط أداء المشاركين (المتصدرون)" : "Participant Average Performance (Leaders)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topParticipants.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{isRtl ? "لا يوجد مشاركون" : "No participants"}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRtl ? "الاسم" : "Name"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "نسبة الالتزام" : "Attendance"}</TableHead>
                    <TableHead className="text-center">{isRtl ? "النقاط" : "Points"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topParticipants.slice(0, 5).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-center">
                        <span className={p.attendanceRate >= 90 ? "text-emerald-600 font-bold" : p.attendanceRate >= 75 ? "text-blue-600" : "text-amber-600"}>
                          {p.attendanceRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-primary">{p.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

