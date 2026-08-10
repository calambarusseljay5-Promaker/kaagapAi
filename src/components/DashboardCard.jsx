import {
  Users,
  FileText,
  Clock,
  Briefcase,
} from "lucide-react";
import { motion } from "framer-motion";

const accentClasses = {
  blue: "bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-700 ring-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.12)]",
  green: "bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 ring-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.12)]",
  amber: "bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-700 ring-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.12)]",
  cyan: "bg-gradient-to-br from-cyan-50 to-sky-50 text-cyan-700 ring-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.12)]",
  rose: "bg-gradient-to-br from-rose-50 to-pink-50 text-rose-700 ring-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.12)]",
};

const sparklineColors = {
  blue: "#38bdf8",
  green: "#34d399",
  amber: "#fbbf24",
  cyan: "#22d3ee",
  rose: "#fb7185",
};

const stripeClasses = {
  blue: "from-sky-400/80 via-blue-400/70 to-cyan-300/60",
  green: "from-emerald-300/80 via-teal-300/70 to-cyan-300/60",
  amber: "from-amber-300/80 via-yellow-300/65 to-orange-300/55",
  cyan: "from-cyan-300/85 via-sky-300/70 to-blue-400/60",
  rose: "from-rose-300/75 via-pink-300/65 to-sky-300/45",
};

const glowClasses = {
  blue: "bg-sky-300/16",
  green: "bg-emerald-300/14",
  amber: "bg-amber-200/14",
  cyan: "bg-cyan-200/16",
  rose: "bg-rose-200/14",
};

const Sparkline = ({ accent = "blue" }) => {
  const color = sparklineColors[accent] || sparklineColors.blue;

  return (
    <svg viewBox="0 0 96 36" className="h-7 w-20" aria-hidden="true">
      <path
        d="M2 28 C12 18 18 24 26 18 S38 7 48 14 S60 27 70 17 S84 12 94 4"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M2 28 C12 18 18 24 26 18 S38 7 48 14 S60 27 70 17 S84 12 94 4 L94 36 L2 36 Z"
        fill={color}
        opacity="0.08"
      />
    </svg>
  );
};

const DashboardCard = ({ label, value, icon, accent = "blue", caption, trend = "" }) => {
  const trendClass = trend === "Needs review" ? "text-amber-600" : "text-emerald-600";

  const getIconComponent = (iconName) => {
    const icons = {
      Users: <Users size={22} />,
      FileText: <FileText size={22} />,
      Clock: <Clock size={22} />,
      Briefcase: <Briefcase size={22} />,
    };
    return icons[iconName] || <Users size={22} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className="hd-card-hover blue-glass-surface relative overflow-hidden rounded-lg p-4"
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stripeClasses[accent] || stripeClasses.blue}`} />
      <div className={`pointer-events-none absolute -right-10 -top-10 h-20 w-20 rounded-full blur-2xl ${glowClasses[accent] || glowClasses.blue}`} />
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${accentClasses[accent] || accentClasses.blue}`}>
          {getIconComponent(icon)}
        </div>
        <Sparkline accent={accent} />
      </div>
      <div className="mt-2.5 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold leading-none text-[#10213f] tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {trend ? <p className={`text-xs font-semibold ${trendClass}`}>{trend}</p> : null}
            {caption && <p className="text-xs font-medium text-slate-500">{caption}</p>}
          </div>
      </div>
    </motion.div>
  );
};

export default DashboardCard;
