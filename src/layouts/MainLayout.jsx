import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getSystemSettings } from "../services/adminActivityService";
import { checkAndRunAutoBackup, enforceRetentionPolicy } from "../services/backupService";

const adminThemes = new Set(["light", "favorite"]);
const normalizeAdminTheme = (theme) => (adminThemes.has(theme) ? theme : "favorite");

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation();
  const backupCheckRan = useRef(false);
  const [adminTheme, setAdminTheme] = useState(() =>
    normalizeAdminTheme(getSystemSettings().adminTheme)
  );

  // Silent auto-backup check + retention policy enforcement on app load & on window focus
  useEffect(() => {
    const runBackupMaintenance = async () => {
      try {
        await checkAndRunAutoBackup();
        await enforceRetentionPolicy();
      } catch (err) {
        console.warn("Background backup maintenance error:", err.message);
      }
    };

    // Run quickly on initial load
    const timer = setTimeout(runBackupMaintenance, 600);

    // Also check on window focus / tab visibility change (e.g. next day open)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runBackupMaintenance();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      const settings = getSystemSettings();
      setAdminTheme(normalizeAdminTheme(settings.adminTheme));
    };

    window.addEventListener("kaagapai:system-settings-updated", syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener("kaagapai:system-settings-updated", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";

  // Auto expand on Dashboard, auto collapse on feature pages
  useEffect(() => {
    if (isDashboard) {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [location.pathname, isDashboard]);

  const effectiveCollapsed = isDashboard ? false : isCollapsed;

  return (
    <div className="admin-shell-bg min-h-screen flex bg-slate-50" data-admin-theme={adminTheme}>
      <Sidebar isCollapsed={effectiveCollapsed} setIsCollapsed={setIsCollapsed} />

      <main
        className={`relative flex-1 min-w-0 min-h-screen overflow-x-hidden transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[padding-left] ${
          effectiveCollapsed ? "pl-[76px]" : "pl-[240px]"
        }`}
      >
        <div className="system-page-area min-h-screen w-full bg-transparent overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
              }
              className="w-full min-h-screen transform-gpu"
            >
              <Outlet context={{ isCollapsed }} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
