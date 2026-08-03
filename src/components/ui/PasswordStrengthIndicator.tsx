import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface StrengthLevel {
  score: number;  // 0-4
  label: string;
  labelAr: string;
  color: string;
  bgColor: string;
}

const calculateStrength = (password: string): number => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
};

const STRENGTH_LEVELS: StrengthLevel[] = [
  { score: 0, label: "Very Weak", labelAr: "ضعيفة جداً", color: "text-red-500", bgColor: "bg-red-500" },
  { score: 1, label: "Weak", labelAr: "ضعيفة", color: "text-orange-500", bgColor: "bg-orange-500" },
  { score: 2, label: "Fair", labelAr: "مقبولة", color: "text-yellow-500", bgColor: "bg-yellow-500" },
  { score: 3, label: "Good", labelAr: "جيدة", color: "text-blue-500", bgColor: "bg-blue-500" },
  { score: 4, label: "Strong", labelAr: "قوية", color: "text-green-500", bgColor: "bg-green-500" },
];

const getTips = (password: string, t: any): string[] => {
  const tips: string[] = [];
  if (password.length < 8) tips.push(t("auth.passwordTip.length", "استخدم 8 أحرف على الأقل"));
  if (!/[A-Z]/.test(password)) tips.push(t("auth.passwordTip.uppercase", "أضف حرفاً كبيراً (A-Z)"));
  if (!/[0-9]/.test(password)) tips.push(t("auth.passwordTip.number", "أضف رقماً واحداً على الأقل"));
  if (!/[^A-Za-z0-9]/.test(password)) tips.push(t("auth.passwordTip.special", "أضف رمزاً مثل ! @ # $"));
  return tips;
};

export const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  
  const score = useMemo(() => calculateStrength(password), [password]);
  const level = STRENGTH_LEVELS[score];
  const tips = useMemo(() => getTips(password, t), [password, t]);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                bar <= score ? level.bgColor : "bg-muted"
              )}
            />
          ))}
        </div>
        <span className={cn("text-xs font-medium", level.color)}>
          {isRtl ? level.labelAr : level.label}
        </span>
      </div>

      {/* Tips */}
      {tips.length > 0 && score < 3 && (
        <ul className="space-y-0.5">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="text-warning">•</span>
              {tip}
            </li>
          ))}
        </ul>
      )}

      {score >= 4 && (
        <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <span>✓</span>
          {t("auth.passwordTip.strong", "كلمة مرور قوية ✓")}
        </p>
      )}
    </div>
  );
};
