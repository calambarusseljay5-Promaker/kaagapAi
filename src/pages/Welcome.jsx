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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#011C13] via-[#022B1D] to-[#01140D] px-4 py-8 text-white select-none">
      {/* Background seal & barangay building photo */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
        style={{ backgroundImage: 'url("/new%20barangay.pmg.png")' }}
      />
      {/* Ambient glowing radial orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#011C13]/60 via-transparent to-[#01140D]/80 pointer-events-none" />

      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: smoothEase }}
        className="relative z-10 w-full max-w-lg rounded-3xl border border-emerald-400/30 bg-gradient-to-b from-[rgba(2,43,29,0.92)] via-[rgba(3,62,43,0.85)] to-[rgba(1,28,19,0.95)] p-7 sm:p-8 text-center shadow-2xl shadow-emerald-950/80 backdrop-blur-2xl overflow-hidden"
      >
        {/* Top subtle sheen */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

        {/* 3D Admin Avatar & Logo Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.05,
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: smoothEase,
          }}
          className="mx-auto relative flex flex-col items-center justify-center"
        >
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-2 border-emerald-400/40 bg-gradient-to-b from-emerald-900/60 to-emerald-950/90 p-1 shadow-xl shadow-emerald-950/50 overflow-hidden ring-4 ring-emerald-500/20">
            <img
              src="/admin-3d-avatar.png"
              alt="Admin 3D Avatar"
              className="h-full w-full object-cover object-top rounded-xl brightness-105"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/logo.png";
              }}
            />
          </div>
          {/* Floating Logo Pill */}
          <div className="-mt-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/50 bg-[#011C13] p-0.5 shadow-md ring-2 ring-emerald-500/30">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.1,
            duration: shouldReduceMotion ? 0 : 0.35,
            ease: smoothEase,
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-900/60 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 border border-emerald-400/40 shadow-xs backdrop-blur-sm"
        >
          <ChipIcon size={12} className="text-emerald-300" />
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
          className="mt-4 text-2xl font-black tracking-tight text-white leading-tight sm:text-3xl drop-shadow-md"
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
          className="mx-auto mt-1.5 max-w-sm text-xs font-semibold text-emerald-100/90 drop-shadow-xs"
        >
          {content.subtitle}
        </motion.p>

        {/* Loading Progress Box */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.25,
            duration: shouldReduceMotion ? 0 : 0.4,
            ease: smoothEase,
          }}
          className="mt-5 rounded-2xl border border-emerald-400/25 bg-black/30 p-4 sm:p-5 text-left shadow-inner backdrop-blur-md"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-950/40 border border-emerald-300/30">
              <MainIcon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white leading-normal">{content.detail}</p>
              <p className="mt-0.5 text-[10px] text-emerald-300/80 font-medium">Please stand by...</p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-950/80 border border-emerald-500/20">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 shadow-sm shadow-emerald-400/50"
              initial={{ width: "5%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: shouldReduceMotion ? 0 : WELCOME_DURATION_MS / 1000,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.div>

        {/* Footer controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.3,
            duration: shouldReduceMotion ? 0 : 0.35,
          }}
          className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-200/80">
            <Loader2 size={14} className="animate-spin text-emerald-400" />
            Loading portal session
          </span>
          <button
            type="button"
            onClick={continueToDashboard}
            disabled={!sessionView.redirectTo}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/20 hover:border-white/40 backdrop-blur-md shadow-sm disabled:opacity-50 cursor-pointer"
          >
            Continue
            <ChevronRight size={14} className="text-emerald-300" />
          </button>
        </motion.div>

        {/* Sub-footer branding */}
        <p className="mt-5 text-[10px] font-semibold text-emerald-300/70 flex items-center justify-center gap-1">
          <Bot size={11} className="text-emerald-400" />
          Powered by KaagapAI Intelligent Concierge
        </p>
      </motion.section>
    </main>
  );
};

export default Welcome;
