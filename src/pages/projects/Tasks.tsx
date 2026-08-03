import { useTranslation } from "react-i18next";
import { TaskWorkflowDashboard } from "@/components/TaskWorkflowDashboard";

const Tasks = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-0">
      <TaskWorkflowDashboard />
    </div>
  );
};
export default Tasks;

