import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Bot, Building2, ChevronRight, Home, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { getCurrentUserWithProfile } from "../services/authService";
import { getResidentSession } from "../services/residentAuthService";
import { getDashboardPathForRole, normalizeRole } from "../utils/authRoutes";

const WELCOME_DURATION_MS = 1400;
const smoothEase = [0.22, 1, 0.36, 1];

const getDisplayName = (user, profile, resident) =>
  resident?.full_name ||
  profile?.full_name ||
  profile?.name ||
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  user?.email?.split("@")[0] ||
  "User";

const getWelcomeContent = (role, displayName) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "admin") {
    return {
      badge: "Barangay Administration Portal",
      title: `Welcome back, ${displayName}`,
      subtitle: "Preparing your administrative workspace...",
      detail: "Loading secure records, analytics, request queues, and settings.",
      Icon: ShieldCheck,
      accent: "from-[#0F766E] to-[#0D9488]",
      chipIcon: Building2,
    };
  }

  return {
    badge: "Resident Services Portal",
    title: `Welcome back, ${displayName}`,
    subtitle: "Connecting to Barangay digital services...",
    detail: "Synchronizing clearance certificates, community updates, and AI records.",
    Icon: UserCheck,
    accent: "from-[#0F766E] to-[#0D9488]",
    chipIcon: Home,
  };
};

const Welcome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const [sessionView, setSessionView] = useState(() => ({
    displayName: location.state?.displayName || "",
    role: location.state?.role || "",
    redirectTo: location.state?.redirectTo || "",
    ready: Boolean(location.state?.redirectTo),
  }));

  useEffect(() => {
    let isMounted = true;

    const resolveSession = async () => {
      if (sessionView.ready && sessionView.redirectTo) return;

      const residentSession = getResidentSession();
      if (residentSession) {
        if (!isMounted) return;
        setSessionView({
          displayName: residentSession.full_name || "Resident",
          role: "resident",
          redirectTo: "/resident-dashboard",
          ready: true,
        });
        return;
      }

      try {
        const account = await getCurrentUserWithProfile();
        const redirectTo = getDashboardPathForRole(account?.profile?.role);

        if (!account || !redirectTo) {
          navigate("/", { replace: true });
          return;
        }

        if (!isMounted) return;
        setSessionView({
          displayName: getDisplayName(account.user, account.profile),
          role: account.profile?.role || "admin",
          redirectTo,
          ready: true,
        });
      } catch {
        navigate("/", { replace: true });
      }
    };

    resolveSession();

    return () => {
      isMounted = false;
    };
  }, [navigate, sessionView.ready, sessionView.redirectTo]);

  const content = useMemo(
    () => getWelcomeContent(sessionView.role, sessionView.displayName || "User"),
    [sessionView.displayName, sessionView.role]
  );
  const MainIcon = content.Icon;
  const ChipIcon = content.chipIcon;

  useEffect(() => {
    if (!sessionView.ready || !sessionView.redirectTo) return undefined;

    const redirectTimer = window.setTimeout(() => {
      navigate(sessionView.redirectTo, { replace: true });
    }, shouldReduceMotion ? 250 : WELCOME_DURATION_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [navigate, sessionView.ready, sessionView.redirectTo, shouldReduceMotion]);

  const continueToDashboard = () => {
    if (!sessionView.redirectTo) return;
    navigate(sessionView.redirectTo, { replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-8 text-slate-800">
      {/* Background seal grid */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-10 blur-[1px]"
        style={{ backgroundImage: 'url("/barangay/BARANGAYOFICE.PNG")' }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-teal-900/5 via-slate-100 to-slate-200/40 pointer-events-none" />

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: smoothEase }}
        className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/70"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.05,
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: smoothEase,
          }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-inner"
        >
          <img src="/logo.png" alt="KaagapAI logo" className="h-full w-full object-contain" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.1,
            duration: shouldReduceMotion ? 0 : 0.35,
            ease: smoothEase,
          }}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0F766E] border border-teal-100"
        >
          <ChipIcon size={12} />
          {content.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.15,
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: smoothEase,
          }}
          className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 leading-tight sm:text-3xl"
        >
          {content.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.2,
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: smoothEase,
          }}
          className="mx-auto mt-2 max-w-sm text-xs font-semibold text-slate-500"
        >
          {content.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.25,
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: smoothEase,
          }}
          className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-left shadow-inner"
        >
          <div className="flex items-center gap-3.5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${content.accent} text-white shadow-md`}>
              <MainIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 leading-normal">{content.detail}</p>
              <p className="mt-1 text-[10px] text-slate-400 font-medium">Please stand by...</p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200/50">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${content.accent}`}
              initial={{ width: "5%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: shouldReduceMotion ? 0 : WELCOME_DURATION_MS / 1000,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.3,
            duration: shouldReduceMotion ? 0 : 0.35,
          }}
          className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-400">
            <Loader2 size={14} className="animate-spin text-teal-600" />
            Loading portal session
          </span>
          <button
            type="button"
            onClick={continueToDashboard}
            disabled={!sessionView.redirectTo}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Continue
            <ChevronRight size={14} />
          </button>
        </motion.div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-5">
          <Bot size={13} className="text-teal-600" />
          Powered by KaagapAI Intelligent Concierge
        </div>
      </motion.section>
    </main>
  );
};

export default Welcome;
