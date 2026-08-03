import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-background">
      <div className="text-center space-y-4">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <p className="text-muted-foreground">{t("errors.notFound")}</p>
        <Button asChild><Link to="/">{t("errors.backHome")}</Link></Button>
      </div>
    </div>
  );
};
export default NotFound;
