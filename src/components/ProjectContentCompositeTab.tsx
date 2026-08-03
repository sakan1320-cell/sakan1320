import { useTranslation } from "react-i18next";
import { ProjectTrainingTab } from "./ProjectTrainingTab";
import { ProjectSurveysTab } from "./ProjectSurveysTab";
import { ProjectFilesTab } from "./ProjectFilesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectContentCompositeTabProps {
  projectId: string;
  branchId?: string | null;
  groupId?: string | null;
  isManager?: boolean;
}

export const ProjectContentCompositeTab = ({ projectId, branchId, groupId, isManager = true }: ProjectContentCompositeTabProps) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="curriculum" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="curriculum" className="rounded-lg">{isRtl ? "الخطط والمسارات" : "Curriculum"}</TabsTrigger>
          <TabsTrigger value="trainer_bag" className="rounded-lg bg-emerald-50 text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            {isRtl ? "حقيبة المدرب" : "Trainer Bag"}
          </TabsTrigger>
          <TabsTrigger value="surveys" className="rounded-lg">{isRtl ? "الاستبيانات" : "Surveys"}</TabsTrigger>
          <TabsTrigger value="files" className="rounded-lg">{isRtl ? "الملفات" : "Files"}</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum">
          <ProjectTrainingTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="trainer_bag">
          <ProjectFilesTab projectId={projectId} isTrainerBag={true} isManager={isManager} />
        </TabsContent>
        <TabsContent value="surveys">
          <ProjectSurveysTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="files">
          <ProjectFilesTab projectId={projectId} isTrainerBag={false} isManager={isManager} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
