import { useTranslation } from "react-i18next";
import { TaskList } from "./TaskList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectTasksTabProps {
  projectId: string;
  branchId?: string | null;
  groupId?: string | null;
}

export const ProjectTasksTab = ({ projectId, branchId, groupId }: ProjectTasksTabProps) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    <div className="space-y-0 animate-fade-in">
      <div className="w-full">
        <TaskList projectId={projectId} branchId={branchId} groupId={groupId} />
      </div>
    </div>
  );
};
