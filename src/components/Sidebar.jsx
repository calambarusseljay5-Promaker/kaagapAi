import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Building2,
  Briefcase,
  Megaphone,
  Archive,
  UserCheck,
  BrainCircuit,
  Settings,
  Landmark,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { fetchResidentActivationRequests } from "../services/residentActivationService";
import { fetchPendingLivelihoodApplicationsCount } from "../services/livelihoodService";
import { subscribeAdminNotificationChanges } from "../services/adminNotificationService";

const navigationGroups = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", icon: "LayoutDashboard", path: "/dashboard" },
      { name: "Residents", icon: "Users", path: "/residents" },
      { name: "Organizational Chart", icon: "Building2", path: "/organization" },
      { name: "Document Management", icon: "FileText", path: "/documents" },
      { name: "Announcements", icon: "Megaphone", path: "/announcements" },
      { name: "Livelihood & Jobs", icon: "Briefcase", path: "/livelihood" },
      { name: "AI Knowledge", icon: "BrainCircuit", path: "/ai-knowledge" },
      { name: "Reports & Analytics", icon: "BarChart3", path: "/analytics" },
      { name: "Resident Registration", icon: "UserCheck", path: "/resident-activations" },
      { name: "Archive", icon: "Archive", path: "/archive" },
      { name: "Recycle Bin", icon: "Trash2", path: "/recycle-bin" },
    ],
  },
];

const iconMap = {
  LayoutDashboard: <LayoutDashboard size={17} className="stroke-[2]" />,
  Users: <Users size={17} className="stroke-[2]" />,
  FileText: <FileText size={17} className="stroke-[2]" />,
  BarChart3: <BarChart3 size={17} className="stroke-[2]" />,
  Building2: <Building2 size={17} className="stroke-[2]" />,
  Briefcase: <Briefcase size={17} className="stroke-[2]" />,
  Megaphone: <Megaphone size={17} className="stroke-[2]" />,
  Archive: <Archive size={17} className="stroke-[2]" />,
  UserCheck: <UserCheck size={17} className="stroke-[2]" />,
  BrainCircuit: <BrainCircuit size={17} className="stroke-[2]" />,
  Settings: <Settings size={17} className="stroke-[2]" />,
  Trash2: <Trash2 size={17} className="stroke-[2]" />,
};

const AdminOrbitLogo = () => (
  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
    {/* Tighter & Snug React 3-Loop Atomic Orbit SVG */}
    <svg
      className="absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] pointer-events-none drop-shadow-sm"
      viewBox="0 0 100 100"
    >
      <defs>
        <linearGradient id="sidebarOrbitGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id="sidebarOrbitGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>
        <linearGradient id="sidebarOrbitGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="url(#sidebarOrbitGrad1)" strokeWidth="3" opacity="0.95" />
      <g transform="rotate(60 50 50)">
        <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="url(#sidebarOrbitGrad2)" strokeWidth="3" opacity="0.95" />
      </g>
      <g transform="rotate(120 50 50)">
        <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="url(#sidebarOrbitGrad3)" strokeWidth="3" opacity="0.95" />
      </g>
    </svg>

    {/* Larger Seal Logo Image */}
    <img
      src="/logo.png"
      alt="Barangay Upper Mingading Logo"
      className="relative z-10 h-10 w-10 sm:h-11 sm:w-11 object-contain drop-shadow-md"
      onError={(e) => {
        e.target.src = "https://placehold.co/100x100/064e3b/ffffff?text=Seal";
      }}
    />
  </div>
);

const COLLAPSE_DELAY = 300; // ms before collapsing after mouse leaves
const EXPAND_DELAY = 80;   // ms before expanding on mouse enter

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const [pendingCount, setPendingCount] = useState(0);
  const [livelihoodPendingCount, setLivelihoodPendingCount] = useState(0);
  const [hoveredItem, setHoveredItem] = useState(null);
  const collapseTimerRef = useRef(null);
  const expandTimerRef = useRef(null);

  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";
  const effectiveCollapsed = isDashboard ? false : isCollapsed;

  const handleMouseEnter = useCallback(() => {
    if (isDashboard) return; // Keep steady on Dashboard
    // Cancel any pending collapse
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    // Expand after a tiny delay to avoid accidental triggers
    expandTimerRef.current = setTimeout(() => {
      setIsCollapsed(false);
    }, EXPAND_DELAY);
  }, [isDashboard, setIsCollapsed]);

  const handleMouseLeave = useCallback(() => {
    if (isDashboard) return; // Keep steady on Dashboard
    // Cancel any pending expand
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    // Collapse after a short delay so user can briefly move away without jitter
    collapseTimerRef.current = setTimeout(() => {
      setIsCollapsed(true);
    }, COLLAPSE_DELAY);
  }, [isDashboard, setIsCollapsed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCounts = async () => {
      try {
        const [requests, livCount] = await Promise.all([
          fetchResidentActivationRequests("Pending Approval").catch(() => []),
          fetchPendingLivelihoodApplicationsCount().catch(() => 0),
        ]);
        if (isMounted) {
          setPendingCount(requests.length || 0);
          setLivelihoodPendingCount(livCount || 0);
        }
      } catch (err) {
        console.error("Sidebar pending count error:", err);
      }
    };

    loadCounts();

    // Subscribe to DB changes to auto-update
    const unsubscribe = subscribeAdminNotificationChanges(() => {
      loadCounts();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const sidebarVariants = {
    expanded: {
      width: 240,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 30, mass: 0.75 },
    },
    collapsed: {
      width: 76,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 30, mass: 0.75 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  const getActiveState = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden rounded-r-2xl border-r border-emerald-400/20 bg-gradient-to-b from-[#011C13] via-[#033B28] via-[#054E35] to-[#01140D] text-white shadow-2xl backdrop-blur-xl"
      style={{ maxHeight: '100vh' }}
      variants={sidebarVariants}
      animate={effectiveCollapsed ? "collapsed" : "expanded"}
      initial={false}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="border-b border-white/10 px-3 py-2.5 bg-black/10">
        <div className="flex items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            {!effectiveCollapsed ? (
              <motion.div
                key="expanded-header"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeOut" }}
                className="min-w-0 px-1 w-full"
              >
                <h1 className="text-base font-black leading-none text-white tracking-wide mt-0.5">
                  Kaagap<span className="text-[#FFD700]">AI</span>
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <AdminOrbitLogo />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold leading-tight text-white whitespace-nowrap">Barangay Upper Mingading</p>
                    <p className="mt-0.5 text-[9.5px] font-semibold text-emerald-200/90 whitespace-nowrap">Aleosan, Cotabato</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed-header"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                className="flex flex-col items-center gap-1"
              >
                <AdminOrbitLogo />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav className="flex-1 space-y-3.5 overflow-y-auto custom-scrollbar px-2 py-2.5">
        {navigationGroups.map((group, groupIndex) => (
          <motion.div
            key={group.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceMotion ? 0 : groupIndex * 0.04,
              duration: shouldReduceMotion ? 0 : 0.2,
            }}
          >
            {!effectiveCollapsed && (
              <p className="mb-1.5 px-2 text-[9.5px] font-extrabold uppercase tracking-widest text-emerald-200/90">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item, itemIndex) => {
                const active = getActiveState(item.path);
                return (
                  <motion.div
                    key={item.path}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={shouldReduceMotion ? undefined : { x: 2 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                    transition={{
                      delay: shouldReduceMotion ? 0 : groupIndex * 0.04 + itemIndex * 0.025,
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  >
                    <NavLink
                      to={item.path}
                      className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all duration-200 ${
                        active
                          ? "bg-white/20 text-white shadow-md ring-1 ring-white/30 backdrop-blur-md"
                          : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                      } ${effectiveCollapsed ? "justify-center" : ""}`}
                      onMouseEnter={() => effectiveCollapsed && setHoveredItem(item.path)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      {active && (
                        <motion.span
                          layoutId="activeIndicator"
                          className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-[#FFD700]"
                          initial={false}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      {active && (
                        <motion.span
                          layoutId="activeNavGlow"
                          className="pointer-events-none absolute inset-0 rounded-[14px] bg-gradient-to-r from-white/20 via-white/5 to-transparent"
                          initial={false}
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                      <span className={`relative flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-white" : "text-emerald-100"}`}>
                        {iconMap[item.icon]}
                        {effectiveCollapsed && item.name === "Resident Registration" && pendingCount > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFB800] text-[9px] font-extrabold text-slate-900 ring-1 ring-white shadow-sm">
                            {pendingCount > 9 ? "9+" : pendingCount}
                          </span>
                        )}
                        {effectiveCollapsed && item.name === "Livelihood & Jobs" && livelihoodPendingCount > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFB800] text-[9px] font-extrabold text-slate-900 ring-1 ring-white shadow-sm animate-pulse">
                            {livelihoodPendingCount > 9 ? "9+" : livelihoodPendingCount}
                          </span>
                        )}
                      </span>
                      {!effectiveCollapsed && (
                        <span className="relative truncate flex-1 flex items-center justify-between text-xs">
                          <span>{item.name}</span>
                          {item.name === "Resident Registration" && pendingCount > 0 && (
                            <span className="ml-2 rounded-full bg-[#FFB800] px-2 py-0.5 text-[9px] font-extrabold text-slate-900 shadow-sm animate-pulse">
                              {pendingCount}
                            </span>
                          )}
                          {item.name === "Livelihood & Jobs" && livelihoodPendingCount > 0 && (
                            <span className="ml-2 rounded-full bg-[#FFB800] px-2 py-0.5 text-[9px] font-extrabold text-slate-900 shadow-sm animate-pulse">
                              {livelihoodPendingCount}
                            </span>
                          )}
                        </span>
                      )}
                      {/* Tooltip for collapsed state */}
                      {effectiveCollapsed && hoveredItem === item.path && (
                        <div className="pointer-events-none absolute left-full ml-3 z-[9999] whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl ring-1 ring-white/10" style={{ maxWidth: 'calc(100vw - 6rem)' }}>
                          {item.name}
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rotate-45 bg-slate-900 ring-1 ring-white/10 ring-r-0 ring-t-0" />
                        </div>
                      )}
                    </NavLink>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </nav>

      {!effectiveCollapsed ? (
        <div className="p-3">
          <div className="rounded-[14px] border border-white/20 bg-white/10 backdrop-blur-md p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFB800] text-[#00552E] shadow-sm font-bold">
                <Landmark size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold leading-tight text-white whitespace-nowrap">Barangay Upper Mingading</p>
                <p className="text-[10px] font-medium leading-tight text-emerald-100/90 mt-0.5 whitespace-nowrap">Aleosan, Cotabato</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.aside>
  );
};

export default Sidebar;
