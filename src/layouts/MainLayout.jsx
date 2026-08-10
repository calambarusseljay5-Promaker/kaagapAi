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

  // Silent auto-backup check + retention policy enforcement on app load
  useEffect(() => {
    if (backupCheckRan.current) return;
    backupCheckRan.current = true;

    const runBackupMaintenance = async () => {
      try {
        await checkAndRunAutoBackup();
        await enforceRetentionPolicy();
      } catch (err) {
        console.warn("Background backup maintenance error:", err.message);
      }
    };

    // Delay slightly to not block initial render
    const timer = setTimeout(runBackupMaintenance, 3000);
    return () => clearTimeout(timer);
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

  return (
    <div className="admin-shell-bg min-h-screen flex bg-bg-main" data-admin-theme={adminTheme}>
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <motion.main
        className="relative flex-1 min-w-0 min-h-screen"
        initial={false}
        animate={{ paddingLeft: isCollapsed ? 80 : 260 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 30, mass: 0.75 }
        }
      >
        <div className="system-page-area min-h-screen w-full bg-transparent">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }}
              className="w-full min-h-screen"
            >
              <Outlet context={{ isCollapsed }} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
};

export default MainLayout;
