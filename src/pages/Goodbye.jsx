import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, LogOut, ShieldCheck } from "lucide-react";

const GOODBYE_DURATION_MS = 2100;

const Goodbye = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const farewell = useMemo(
    () => ({
      displayName: location.state?.displayName || "KaagapAI user",
      role: location.state?.role || "user",
    }),
    [location.state?.displayName, location.state?.role]
  );
  const isAdmin = String(farewell.role).toLowerCase() === "admin";

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      navigate("/", { replace: true });
    }, GOODBYE_DURATION_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [navigate]);

  const continueToLogin = () => {
    navigate("/", { replace: true });
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
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/70"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-inner"
        >
          <img src="/logo.png" alt="KaagapAI logo" className="h-full w-full object-contain" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0F766E] border border-teal-100"
        >
          <ShieldCheck size={12} />
          Session secured
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 leading-tight sm:text-3xl"
        >
          Thank you, {farewell.displayName}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mx-auto mt-2 max-w-sm text-xs font-semibold text-slate-500"
        >
          You have signed out safely from the {isAdmin ? "admin portal" : "resident portal"}.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-left shadow-inner"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F766E] to-[#0D9488] text-white shadow-md">
              <LogOut size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 leading-normal">Returning to the login page...</p>
              <p className="mt-1 text-[10px] text-slate-400 font-medium">Your credentials have been cleared.</p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#0F766E] to-[#0D9488]"
              initial={{ width: "10%" }}
              animate={{ width: "100%" }}
              transition={{ duration: GOODBYE_DURATION_MS / 1000, ease: "easeInOut" }}
            />
          </div>
        </motion.div>

        <button
          type="button"
          onClick={continueToLogin}
          className="mt-6 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Back to login
          <ChevronRight size={14} />
        </button>
      </motion.section>
    </main>
  );
};

export default Goodbye;
