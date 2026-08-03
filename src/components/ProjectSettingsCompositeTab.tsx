import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectCalendarSettingsTab } from "./ProjectCalendarSettingsTab";
import { SettingsAndToolsTab } from "./project-detail/SettingsAndToolsTab";
import { BranchesAndGroupsTab } from "./project-detail/BranchesAndGroupsTab";
import { ProjectTeamTab } from "./ProjectTeamTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface ProjectSettingsCompositeTabProps {
  projectId: string;
  onProjectUpdated: () => void;
}

export const ProjectSettingsCompositeTab = ({ projectId, onProjectUpdated }: ProjectSettingsCompositeTabProps) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [hasBranches, setHasBranches] = useState(false);

  useEffect(() => {
    supabase.from("projects").select("has_branches").eq("id", projectId).single().then(({ data }) => {
      if (data) setHasBranches(data.has_branches);
    });
  }, [projectId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="settings" className="rounded-lg">{isRtl ? "إعدادات المشروع" : "Project Settings"}</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg">{isRtl ? "إدارة الفريق" : "Project Team"}</TabsTrigger>

          {hasBranches && (
            <TabsTrigger value="branches" className="rounded-lg">{isRtl ? "الفروع والمجموعات" : "Branches & Groups"}</TabsTrigger>
          )}

        </TabsList>

        <TabsContent value="settings">
          <SettingsAndToolsTab projectId={projectId} onProjectUpdated={onProjectUpdated} />
        </TabsContent>

        <TabsContent value="team">
          <ProjectTeamTab projectId={projectId} />
        </TabsContent>

        {hasBranches && (
          <TabsContent value="branches">
            <BranchesAndGroupsTab projectId={projectId} />
          </TabsContent>
        )}


      </Tabs>
    </div>
  );
};
