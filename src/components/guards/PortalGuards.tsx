import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalEligibility } from "@/hooks/usePortalEligibility";
import { useFallbackRoute } from "@/hooks/useFallbackRoute";

/** Max seconds to wait for auth/eligibility before giving up */
const GUARD_TIMEOUT_MS = 12000;

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const useDeniedToast = () => {
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const shown = useRef(false);
  useEffect(() => {
    const denied = params.get("denied");
    if (denied && !shown.current) {
      shown.current = true;
      toast.error(t("portal.denied", "لا تملك صلاحية الدخول لهذه البوابة، تم تحويلك تلقائيًا"));
    }
  }, [params, t]);
};

/** Hook that returns true if the guard has been waiting too long */
const useGuardTimeout = (isWaiting: boolean) => {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!isWaiting) { setTimedOut(false); return; }
    const timer = setTimeout(() => setTimedOut(true), GUARD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isWaiting]);
  return timedOut;
};

export const StaffGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading, actualIsSystemAdmin } = useAuth();
  const { isStaff, isParticipant, ready } = usePortalEligibility();
  const fallbackRoute = useFallbackRoute();
  const location = useLocation();
  useDeniedToast();

  const isWaiting = loading || !ready;
  const timedOut = useGuardTimeout(isWaiting);

  // Timeout: redirect to auth instead of infinite spinner
  if (timedOut && isWaiting) {
    console.warn("[StaffGuard] Timed out waiting for auth/eligibility data");
    return <Navigate to="/auth" replace />;
  }

  if (isWaiting) return <Spinner />;
  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;

  // Force account setup if required
  if (profile?.is_password_setup_required && location.pathname !== "/setup-account") {
    return <Navigate to="/setup-account" replace />;
  }

  // Check if they are explicitly acting as a participant via PortalSwitcher
  const activeRole = localStorage.getItem("last_active_role");
  const isActingAsParticipant = activeRole === "participant" || activeRole === "guardian";

  if (!isStaff || isActingAsParticipant) {
    if (isParticipant || actualIsSystemAdmin) return <Navigate to={`${fallbackRoute}?denied=staff`} replace />;
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};

export const ParticipantGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading, actualIsSystemAdmin } = useAuth();
  const { isStaff, isParticipant, ready } = usePortalEligibility();
  const fallbackRoute = useFallbackRoute();
  const location = useLocation();
  useDeniedToast();

  const isWaiting = loading || !ready;
  const timedOut = useGuardTimeout(isWaiting);

  if (timedOut && isWaiting) {
    console.warn("[ParticipantGuard] Timed out waiting for auth/eligibility data");
    return <Navigate to="/auth" replace />;
  }

  if (isWaiting) return <Spinner />;
  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;

  // Force account setup if required
  if (profile?.is_password_setup_required && location.pathname !== "/setup-account") {
    return <Navigate to="/setup-account" replace />;
  }

  if (!isParticipant) {
    if (session?.user && actualIsSystemAdmin) {
      // System admin simulating participant but doesn't have a record yet; let them see the empty state
      return <>{children}</>;
    }
    if (isStaff) return <Navigate to={`${fallbackRoute}?denied=participant`} replace />;
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};
