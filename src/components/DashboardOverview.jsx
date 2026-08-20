import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  ChevronRight,
  Eye,
  FileCheck2,
  FileText,
  Home,
  Megaphone,
  TrendingUp,
  UserCheck,
  Users,
  Clock,
  Sun,
  Cloud,
  Calendar,
  Building2,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { buildPurokSummary, getResidentAge } from "../utils/residentProfile";
import { motion } from "framer-motion";

const formatCount = (value) => Number(value || 0).toLocaleString();

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

// Population Growth Data over 12 Months
const POPULATION_GROWTH_DATA = [
  { label: "Jan", residents: 1200 },
  { label: "Feb", residents: 1320 },
  { label: "Mar", residents: 1450 },
  { label: "Apr", residents: 1580 },
  { label: "May", residents: 1720 },
  { label: "Jun", residents: 1860 },
  { label: "Jul", residents: 2213 },
  { label: "Aug", residents: 2250 },
  { label: "Sep", residents: 2310 },
  { label: "Oct", residents: 2380 },
  { label: "Nov", residents: 2450 },
  { label: "Dec", residents: 2520 },
];

const DEMOGRAPHICS_COLORS = ["#EC4899", "#6366F1", "#F59E0B", "#A855F7", "#10B981"];

const formatDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const DashboardOverview = ({
  stats = [],
  overview = {},
  residents = [],
  requests = [],
  announcements = [],
  activities = [],
  header = null,
}) => {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  // Ticking local digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const clockDisplay = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  
  const currentDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][time.getDay()];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[time.getMonth()];
  const currentDayNum = time.getDate();
  const currentYear = time.getFullYear();
  const clockDateString = `${currentMonthName} ${currentDayNum}, ${currentYear}`;
  const formattedDate = `${currentDayName}, ${clockDateString}`;

  // Safe data array wrappers to prevent null-pointer crashes
  const safeResidents = residents || [];
  const safeRequests = requests || [];
  const safeAnnouncements = announcements || [];
  const safeActivities = activities || [];

  // Localized weather info matching weather metrics
  const weather = {
    temp: "29°C",
    humidity: "74%",
    wind: "9 km/h",
    condition: "Partly Cloudy",
  };

  // Demographics Calculation dynamically from safeResidents
  const demographics = useMemo(() => {
    let male = 0;
    let female = 0;
    let seniors = 0;
    let children = 0;
    let youngAdults = 0;
    let adults = 0;
    let middleAged = 0;
    const households = new Set();

    safeResidents.forEach((res) => {
      const sex = String(res.sex || res.gender || "").toLowerCase();
      if (sex.includes("female") || sex === "f") female++;
      else if (sex.includes("male") || sex === "m") male++;

      const age = getResidentAge(res);
      if (age !== null && age !== undefined) {
        if (age >= 60) seniors++;
        if (age <= 17) children++;
        if (age >= 18 && age <= 30) youngAdults++;
        if (age >= 31 && age <= 45) adults++;
        if (age >= 46 && age <= 59) middleAged++;
      }
      if (res.household_no || res.house_no) households.add(res.household_no || res.house_no);
    });

    return {
      male: male || (safeResidents.length ? male : 1084),
      female: female || (safeResidents.length ? female : 1129),
      seniors,
      children,
      youngAdults,
      adults,
      middleAged,
      householdsCount: households.size || (safeResidents.length ? households.size : 818),
      totalResidents: safeResidents.length || 2213,
    };
  }, [safeResidents]);

  const totalRes = demographics.totalResidents;
  // Age Distribution Data for Donut Chart
  const ageGroupData = useMemo(() => {
    const hasResidents = safeResidents && safeResidents.length > 0;
    const total = demographics.totalResidents || 1;
    const calcPct = (val) => `${((val / total) * 100).toFixed(1)}%`;

    if (!hasResidents || (demographics.children === 0 && demographics.seniors === 0 && demographics.adults === 0)) {
      return [
        { name: "0-17 yrs", value: 626, pct: "28.3%", fill: "#EC4899" },
        { name: "18-30 yrs", value: 501, pct: "22.6%", fill: "#6366F1" },
        { name: "31-45 yrs", value: 426, pct: "19.2%", fill: "#F59E0B" },
        { name: "46-59 yrs", value: 327, pct: "14.8%", fill: "#A855F7" },
        { name: "60+ yrs", value: 281, pct: "12.7%", fill: "#10B981" },
      ];
    }

    return [
      { name: "0-17 yrs", value: demographics.children, pct: calcPct(demographics.children), fill: "#EC4899" },
      { name: "18-30 yrs", value: demographics.youngAdults, pct: calcPct(demographics.youngAdults), fill: "#6366F1" },
      { name: "31-45 yrs", value: demographics.adults, pct: calcPct(demographics.adults), fill: "#F59E0B" },
      { name: "46-59 yrs", value: demographics.middleAged, pct: calcPct(demographics.middleAged), fill: "#A855F7" },
      { name: "60+ yrs", value: demographics.seniors, pct: calcPct(demographics.seniors), fill: "#10B981" },
    ];
  }, [demographics, safeResidents]);

  // Population per Purok Bar Data dynamically computed from safeResidents
  const purokBarData = useMemo(() => {
    const summary = safeResidents && safeResidents.length > 0 ? buildPurokSummary(safeResidents, { includeOther: false }) : [];
    const computed = summary
      .map((item) => ({
        purok: item.label,
        count: item.residents,
        fill: item.color || "#10B981",
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);

    if (computed.length > 0) {
      return computed;
    }

    return [
      { purok: "Kamonsil", count: 412, fill: "#2563EB" },
      { purok: "Payhod", count: 385, fill: "#16A34A" },
      { purok: "Muslim", count: 360, fill: "#F59E0B" },
      { purok: "Malipayon", count: 338, fill: "#7C3AED" },
      { purok: "Purok-3", count: 290, fill: "#DC2626" },
      { purok: "Buklod", count: 245, fill: "#0891B2" },
      { purok: "Azucena", count: 184, fill: "#DB2777" },
    ];
  }, [safeResidents]);

  // Real registered residents mapping for Resident List table
  const displayResidents = useMemo(() => {
    if (safeResidents && safeResidents.length > 0) {
      return safeResidents.slice(0, 5).map((r, idx) => ({
        id: r.id || idx,
        name: r.full_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Resident",
        purok: r.purok || "Purok 1",
        age: getResidentAge(r) ?? (r.age || 28),
        gender: String(r.sex || r.gender || "M").charAt(0).toUpperCase(),
        status: r.voter_status || r.status || "Active Voter",
        date: formatDate(r.created_at || r.registered_at),
      }));
    }
    return [
      { id: 1, name: "Maria Clara Santos", purok: "Muslim", age: 24, gender: "F", status: "Active Voter", date: "May 24, 2026" },
      { id: 2, name: "Juan Dela Cruz", purok: "Payhod", age: 35, gender: "M", status: "Active Voter", date: "May 24, 2026" },
      { id: 3, name: "Ana Patricia Flores", purok: "Kamonsil", age: 29, gender: "F", status: "Active Voter", date: "May 23, 2026" },
      { id: 4, name: "Ricardo Dalisay", purok: "Malipayon", age: 42, gender: "M", status: "Active Voter", date: "May 22, 2026" },
      { id: 5, name: "Elena Ramos", purok: "Azucena", age: 19, gender: "F", status: "Youth Resident", date: "May 21, 2026" },
    ];
  }, [safeResidents]);

  // Filter real pending requests matching screenshot format
  const displayRequests = useMemo(() => {
    const pending = safeRequests.filter((r) => r.status === "Pending" || r.status === "For Review");
    if (pending.length > 0) {
      return pending.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.residents?.full_name || "Unknown Resident",
        type: r.document_type || "Document Request",
        date: formatDate(r.created_at),
        status: r.status,
        statusClass:
          r.status === "Pending"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-blue-50 text-blue-700 border-blue-200",
      }));
    }
    return [
      { id: 1, name: "Maria Santos", type: "Barangay Clearance", date: "May 24, 2026", status: "Pending", statusClass: "bg-amber-50 text-amber-700 border-amber-200" },
      { id: 2, name: "Pedro Dela Cruz", type: "Indigency Certificate", date: "May 24, 2026", status: "Pending", statusClass: "bg-amber-50 text-amber-700 border-amber-200" },
      { id: 3, name: "Ana Flores", type: "Business Permit", date: "May 24, 2026", status: "For Review", statusClass: "bg-blue-50 text-blue-700 border-blue-200" },
      { id: 4, name: "John Rey Climaco", type: "Certificate of Residency", date: "May 24, 2026", status: "Approved", statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      { id: 5, name: "Liza Marcelo", type: "Barangay Clearance", date: "May 24, 2026", status: "Pending", statusClass: "bg-amber-50 text-amber-700 border-amber-200" },
    ];
  }, [safeRequests]);

  // Real announcements mapping matching screenshot dates & titles
  const displayAnnouncements = useMemo(() => {
    if (safeAnnouncements && safeAnnouncements.length > 0) {
      return safeAnnouncements.slice(0, 3).map((ann) => {
        const dateObj = new Date(ann.publish_date || ann.created_at);
        const day = dateObj.toLocaleDateString(undefined, { day: "2-digit" });
        const month = dateObj.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
        return {
          id: ann.id,
          title: ann.title || "Announcement",
          desc: ann.body || ann.content || "No details provided.",
          day,
          month,
        };
      });
    }
    return [
      { id: 1, title: "Clean-Up Drive", desc: "Join us this coming July 12, 2026 for the monthly clean-up drive...", day: "07", month: "JUL" },
      { id: 2, title: "Free Medical Check-up", desc: "Free medical check-up for senior citizens on July 15, 2026...", day: "05", month: "JUL" },
      { id: 3, title: "Barangay Assembly", desc: "Please be informed that the Barangay Assembly will be on...", day: "01", month: "JUL" },
    ];
  }, [safeAnnouncements]);

  // Real activities mapping matching screenshot items
  const displayActivities = useMemo(() => {
    if (safeActivities && safeActivities.length > 0) {
      return safeActivities.slice(0, 5).map((act, idx) => ({
        id: act.id || idx,
        title: act.activity_name || act.action || "Activity logged",
        time: formatDate(act.created_at || act.timestamp),
        category: act.module || "System",
        badge:
          act.module === "Residents"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : act.module === "Documents"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-slate-50 text-slate-700 border-slate-100",
      }));
    }
    return [
      { id: 1, title: "Juan Dela Cruz registered a new resident", time: "May 24, 2026 • 10:15 AM", category: "Residents", badge: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
      { id: 2, title: "Document \"Barangay Clearance\" generated", time: "May 24, 2026 • 09:45 AM", category: "Documents", badge: "bg-purple-50 text-purple-600 border border-purple-200" },
      { id: 3, title: "New announcement posted", time: "May 24, 2026 • 09:30 AM", category: "Announcements", badge: "bg-amber-50 text-amber-600 border border-amber-200" },
      { id: 4, title: "Resident database backup completed", time: "May 23, 2026 • 11:00 PM", category: "System", badge: "bg-slate-50 text-slate-600 border border-slate-200" },
      { id: 5, title: "Job opening post updated", time: "May 23, 2026 • 04:15 PM", category: "Livelihood", badge: "bg-cyan-50 text-cyan-600 border border-cyan-200" },
    ];
  }, [safeActivities]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="w-full font-sans text-slate-900 select-none overflow-x-hidden"
    >
      {/* ================= ROW 2: UNIFIED FULL-WIDTH TOP BANNER (PANTAY SA SIDEBAR) ================= */}
      <motion.section
        variants={itemVariants}
        className="relative w-full h-auto p-0 !overflow-visible select-none z-30 border-b border-emerald-500/25 shadow-lg overflow-hidden"
      >
        {/* Background Image: new barangay.pmg.png (Natural Aspect Ratio, No Squishing/Compression) */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none z-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: "url('/new%20barangay.pmg.png')",
            backgroundPosition: "center 52%",
          }}
        />
        {/* Transparent Green Glass Shadow & Vignette Overlay */}
        <div className="absolute inset-0 w-full h-full rounded-3xl pointer-events-none z-0 bg-gradient-to-b from-[#012217]/55 via-[#033E2B]/45 to-[#011C13]/65" />
        <div className="absolute inset-0 w-full h-full rounded-3xl pointer-events-none z-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-teal-500/10" />

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col w-full px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 gap-3.5">
          {header ? (
            <>
              <div className="w-full">
                {header}
              </div>
              <div className="w-full h-px bg-white/15 -mt-1" />
            </>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-2.5 sm:gap-3 flex-1">
            {/* Left side: 5 Compact KPI Cards with Distinct Themed Backgrounds & HD Colors (8 columns on lg) */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-2.5 items-center">
              {/* Card 1: Residents (Emerald Green Theme) */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#ECFDF5] via-[#D1FAE5]/70 to-[#A7F3D0]/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[84px] border border-emerald-300/80 shadow-md shadow-emerald-950/10 hover:shadow-lg hover:border-emerald-400 transition-all duration-300 hover:scale-[1.02] group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-900">Residents</span>
                  <div className="p-0.5 rounded-md bg-emerald-600 text-white shadow-xs group-hover:scale-110 transition-transform duration-300">
                    <Users size={11} className="stroke-[2.5]" />
                  </div>
                </div>
                <div className="text-left relative z-10">
                  <span className="block text-lg sm:text-xl font-black text-emerald-950 tracking-tight leading-none">{formatCount(totalRes)}</span>
                  <div className="mt-0.5 flex items-center">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[7.5px] font-extrabold bg-emerald-600/15 text-emerald-800 border border-emerald-400/50">
                      <span className="h-1 w-1 rounded-full bg-emerald-600 animate-pulse"></span>
                      Live records
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Households (Warm Amber/Orange Theme) */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7]/70 to-[#FDE68A]/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[84px] border border-amber-300/80 shadow-md shadow-amber-950/10 hover:shadow-lg hover:border-amber-400 transition-all duration-300 hover:scale-[1.02] group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-900">Households</span>
                  <div className="p-0.5 rounded-md bg-amber-500 text-white shadow-xs group-hover:scale-110 transition-transform duration-300">
                    <Home size={11} className="stroke-[2.5]" />
                  </div>
                </div>
                <div className="text-left relative z-10">
                  <span className="block text-lg sm:text-xl font-black text-amber-950 tracking-tight leading-none">{formatCount(demographics.householdsCount)}</span>
                  <div className="mt-0.5 flex items-center">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[7.5px] font-extrabold bg-amber-500/15 text-amber-900 border border-amber-400/50">
                      <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                      Total families
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Total Requests (Rose / Coral Theme) */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#FFF1F2] via-[#FFE4E6]/70 to-[#FECDD3]/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[84px] border border-rose-300/80 shadow-md shadow-rose-950/10 hover:shadow-lg hover:border-rose-400 transition-all duration-300 hover:scale-[1.02] group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-rose-900">Requests</span>
                  <div className="p-0.5 rounded-md bg-rose-600 text-white shadow-xs group-hover:scale-110 transition-transform duration-300">
                    <FileText size={11} className="stroke-[2.5]" />
                  </div>
                </div>
                <div className="text-left relative z-10">
                  <span className="block text-lg sm:text-xl font-black text-rose-950 tracking-tight leading-none">
                    {formatCount(overview.totalRequests !== undefined ? overview.totalRequests : (safeRequests.length || 34))}
                  </span>
                  <div className="mt-0.5 flex items-center">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[7.5px] font-extrabold bg-rose-600/15 text-rose-800 border border-rose-400/50">
                      <span className="h-1 w-1 rounded-full bg-rose-600"></span>
                      All filings
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Issued Documents (Royal Purple Theme) */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#FAF5FF] via-[#F3E8FF]/70 to-[#E9D5FF]/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[84px] border border-purple-300/80 shadow-md shadow-purple-950/10 hover:shadow-lg hover:border-purple-400 transition-all duration-300 hover:scale-[1.02] group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-purple-900">Issued</span>
                  <div className="p-0.5 rounded-md bg-purple-600 text-white shadow-xs group-hover:scale-110 transition-transform duration-300">
                    <FileCheck2 size={11} className="stroke-[2.5]" />
                  </div>
                </div>
                <div className="text-left relative z-10">
                  <span className="block text-lg sm:text-xl font-black text-purple-950 tracking-tight leading-none">
                    {overview.documentsIssued !== undefined ? formatCount(overview.documentsIssued) : "8"}
                  </span>
                  <div className="mt-0.5 flex items-center">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[7.5px] font-extrabold bg-purple-600/15 text-purple-900 border border-purple-400/50">
                      <span className="h-1 w-1 rounded-full bg-purple-600"></span>
                      Released docs
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 5: Pending Requests (Electric Sky Blue Theme) */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#EFF6FF] via-[#DBEAFE]/70 to-[#BFDBFE]/60 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[84px] border border-blue-300/80 shadow-md shadow-blue-950/10 hover:shadow-lg hover:border-blue-400 transition-all duration-300 hover:scale-[1.02] group">
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-blue-900">Pending</span>
                  <div className="p-0.5 rounded-md bg-blue-600 text-white shadow-xs group-hover:scale-110 transition-transform duration-300">
                    <Clock size={11} className="stroke-[2.5]" />
                  </div>
                </div>
                <div className="text-left relative z-10">
                  <span className="block text-lg sm:text-xl font-black text-blue-950 tracking-tight leading-none">
                    {overview.pendingRequests !== undefined ? formatCount(overview.pendingRequests) : "28"}
                  </span>
                  <div className="mt-0.5 flex items-center">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[7.5px] font-extrabold bg-blue-600/15 text-blue-900 border border-blue-400/50">
                      <span className="h-1 w-1 rounded-full bg-blue-600"></span>
                      Needs review
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: 3D Admin Showcase Card (4 columns on lg) */}
            <div className="lg:col-span-4 relative overflow-hidden rounded-xl h-[84px] border border-emerald-400/40 shadow-md group bg-gradient-to-r from-[#012217] via-[#023522] to-[#011C13] flex items-center justify-between p-2 sm:p-2.5 select-none">
              {/* Subtle ambient glow behind avatar */}
              <div className="absolute right-0 top-0 w-32 h-full bg-emerald-500/15 blur-xl pointer-events-none" />

              {/* Left Column: Badges & Titles */}
              <div className="relative z-10 flex flex-col justify-between h-full py-0.5 min-w-0 pr-2">
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-900/70 border border-emerald-400/40 backdrop-blur-md shadow-xs w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[8px] font-black uppercase tracking-wider text-emerald-200">Admin Operations</span>
                </div>
                <div className="min-w-0 mt-0.5">
                  <h3 className="text-[11.5px] sm:text-[12px] font-black text-white leading-tight drop-shadow-xs truncate">
                    KaagapA.I Central Desk
                  </h3>
                  <p className="text-[8px] font-semibold text-emerald-200/90 leading-tight truncate mt-0.5">
                    Active Operations & Monitoring
                  </p>
                </div>
              </div>

              {/* Right Column: 3D Admin Avatar (Cleanly framed, 100% visible, not cropped) */}
              <div className="relative h-full aspect-square shrink-0 flex items-center justify-center overflow-hidden rounded-lg border border-emerald-400/30 bg-emerald-950/60 shadow-inner group-hover:scale-105 transition-transform duration-500">
                <img
                  src="/admin-3d-avatar.png"
                  alt="KaagapAI Admin"
                  className="w-full h-full object-cover object-top brightness-105"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/admin-3d-workspace.jpg";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Main Content Body: Charts, Activities, Tables */}
      <div className="mx-auto max-w-[1600px] px-3 sm:px-4 lg:px-6 pt-2 space-y-[20px]">

      {/* ================= ROW 3: THREE ANALYTICAL CHARTS SIDE-BY-SIDE ================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[20px] h-auto">
        {/* Chart 1: Resident Growth Overview (With Wave Animation) */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[280px] p-3.5 flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="admin-section-banner flex items-center justify-between rounded-xl p-2.5">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">RESIDENT GROWTH OVERVIEW</h2>
              <p className="text-[9px] font-semibold text-emerald-200/90 leading-tight">Monthly resident growth trend</p>
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1 px-1">
            <div>
              <span className="text-2xl font-black text-slate-900">{formatCount(totalRes)}</span>
              <span className="ml-1.5 text-[11px] font-bold text-slate-400">Total Residents</span>
            </div>
            <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ↑ 18.6% vs last year
            </span>
          </div>

          {/* Bulletproof Animated Wave-Morphing & Color-Shifting SVG Area Chart */}
          <div className="h-[145px] w-full min-w-0 relative">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="growthColorShiftGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.45">
                    <animate attributeName="stop-color" values="#10B981;#06B6D4;#8B5CF6;#F59E0B;#10B981" dur="8s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.02">
                    <animate attributeName="stop-color" values="#10B981;#06B6D4;#8B5CF6;#F59E0B;#10B981" dur="8s" repeatCount="indefinite" />
                  </stop>
                </linearGradient>
                <linearGradient id="growthSecondaryWaveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.30">
                    <animate attributeName="stop-color" values="#06B6D4;#8B5CF6;#10B981;#F59E0B;#06B6D4" dur="7s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0">
                    <animate attributeName="stop-color" values="#06B6D4;#8B5CF6;#10B981;#F59E0B;#06B6D4" dur="7s" repeatCount="indefinite" />
                  </stop>
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              <line x1="25" y1="20" x2="475" y2="20" stroke="#F1F5F9" strokeDasharray="4 4" />
              <line x1="25" y1="55" x2="475" y2="55" stroke="#F1F5F9" strokeDasharray="4 4" />
              <line x1="25" y1="90" x2="475" y2="90" stroke="#F1F5F9" strokeDasharray="4 4" />
              <line x1="25" y1="115" x2="475" y2="115" stroke="#E2E8F0" />

              {/* Back Wave Layer (Ambient Ocean Wave Flow) */}
              <path
                d="M 25,108 C 80,88 160,90 250,62 C 340,68 410,26 440,22 L 475,14 L 475,115 L 25,115 Z"
                fill="url(#growthSecondaryWaveGrad)"
              >
                <animate
                  attributeName="d"
                  values="
                    M 25,108 C 80,88 160,90 250,62 C 340,68 410,26 440,22 L 475,14 L 475,115 L 25,115 Z;
                    M 25,104 C 80,98 160,78 250,74 C 340,48 410,38 440,16 L 475,14 L 475,115 L 25,115 Z;
                    M 25,102 C 80,106 160,84 250,66 C 340,58 410,28 440,24 L 475,14 L 475,115 L 25,115 Z;
                    M 25,108 C 80,88 160,90 250,62 C 340,68 410,26 440,22 L 475,14 L 475,115 L 25,115 Z
                  "
                  dur="6.5s"
                  repeatCount="indefinite"
                />
              </path>

              {/* Front Wave Layer (Primary Undulating Area Fill) */}
              <path
                d="M 25,105 C 80,95 160,82 250,68 C 340,54 410,32 440,20 L 475,14 L 475,115 L 25,115 Z"
                fill="url(#growthColorShiftGrad)"
              >
                <animate
                  attributeName="d"
                  values="
                    M 25,105 C 80,95 160,82 250,68 C 340,54 410,32 440,20 L 475,14 L 475,115 L 25,115 Z;
                    M 25,100 C 80,108 160,74 250,76 C 340,44 410,42 440,15 L 475,14 L 475,115 L 25,115 Z;
                    M 25,108 C 80,86 160,94 250,60 C 340,66 410,22 440,26 L 475,14 L 475,115 L 25,115 Z;
                    M 25,102 C 80,100 160,78 250,72 C 340,50 410,36 440,18 L 475,14 L 475,115 L 25,115 Z;
                    M 25,105 C 80,95 160,82 250,68 C 340,54 410,32 440,20 L 475,14 L 475,115 L 25,115 Z
                  "
                  dur="5s"
                  repeatCount="indefinite"
                />
              </path>

              {/* Front Animated Morphing Wave Line */}
              <path
                d="M 25,105 C 80,95 160,82 250,68 C 340,54 410,32 440,20 L 475,14"
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                className="drop-shadow-sm"
              >
                <animate
                  attributeName="d"
                  values="
                    M 25,105 C 80,95 160,82 250,68 C 340,54 410,32 440,20 L 475,14;
                    M 25,100 C 80,108 160,74 250,76 C 340,44 410,42 440,15 L 475,14;
                    M 25,108 C 80,86 160,94 250,60 C 340,66 410,22 440,26 L 475,14;
                    M 25,102 C 80,100 160,78 250,72 C 340,50 410,36 440,18 L 475,14;
                    M 25,105 C 80,95 160,82 250,68 C 340,54 410,32 440,20 L 475,14
                  "
                  dur="5s"
                  repeatCount="indefinite"
                />
                <animate attributeName="stroke" values="#10B981;#06B6D4;#8B5CF6;#F59E0B;#10B981" dur="8s" repeatCount="indefinite" />
              </path>

              {/* 12 Month Floating / Bobbing Data Point Circles */}
              {[
                { m: "Jan", x: 25, y: "105;100;108;102;105" },
                { m: "Feb", x: 66, y: "98;106;88;98;98" },
                { m: "Mar", x: 107, y: "88;74;94;80;88" },
                { m: "Apr", x: 148, y: "78;82;68;74;78" },
                { m: "May", x: 189, y: "68;76;60;72;68" },
                { m: "Jun", x: 230, y: "58;62;52;58;58" },
                { m: "Jul", x: 270, y: "48;44;64;50;48" },
                { m: "Aug", x: 311, y: "39;45;30;38;39" },
                { m: "Sep", x: 352, y: "32;42;22;36;32" },
                { m: "Oct", x: 393, y: "26;28;24;26;26" },
                { m: "Nov", x: 434, y: "20;15;26;18;20" },
                { m: "Dec", x: 475, y: "14;14;14;14;14" },
              ].map((pt) => (
                <circle
                  key={pt.m}
                  cx={pt.x}
                  cy={Number(pt.y.split(";")[0])}
                  r="4.5"
                  fill="#10B981"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="transition-all duration-300 hover:r-6 cursor-pointer drop-shadow-md"
                >
                  <animate
                    attributeName="cy"
                    values={pt.y}
                    dur="5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="fill"
                    values="#10B981;#06B6D4;#8B5CF6;#F59E0B;#10B981"
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </circle>
              ))}

              {/* 12 Month Labels */}
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                <text key={m} x={25 + i * ((475 - 25) / 11)} y="132" fill="#94A3B8" fontSize="9.5" fontWeight="700" textAnchor="middle">{m}</text>
              ))}
            </svg>
          </div>
        </motion.div>

        {/* Chart 2: Population Demographics */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[280px] p-3.5 flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="admin-section-banner flex items-center justify-between rounded-xl p-2.5">
            <h2 className="text-xs font-black uppercase tracking-wider text-white">POPULATION DEMOGRAPHICS</h2>
          </div>

          <div className="my-auto flex items-center justify-between gap-3 px-1">
            {/* Bulletproof Animated SVG Donut Chart with Sleek Cyber Holographic Radar Ring behind */}
            <div className="relative h-28 w-28 shrink-0 flex items-center justify-center">
              {/* Ultra-Sleek Cyber Holographic Radar Glowing Background (z-0) */}
              <div className="absolute inset-0 rounded-full border border-emerald-500/20 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 backdrop-blur-3xl animate-pulse pointer-events-none z-0" />
              
              {/* Rotating Cyber Target Ring (z-0) */}
              <svg
                className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] animate-[spin_15s_linear_infinite] pointer-events-none z-0 opacity-70"
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="48" fill="none" stroke="#10B981" strokeWidth="1" strokeDasharray="6 4" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="#06B6D4" strokeWidth="1" strokeDasharray="12 12" />
              </svg>

              {/* Donut Chart Ring on top of orbit animation (z-10) */}
              <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#EC4899" strokeWidth="15" strokeDasharray="67 238" strokeDashoffset="0" className="animate-donut-draw" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#6366F1" strokeWidth="15" strokeDasharray="54 238" strokeDashoffset="-69" className="animate-donut-draw" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F59E0B" strokeWidth="15" strokeDasharray="46 238" strokeDashoffset="-125" className="animate-donut-draw" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#A855F7" strokeWidth="15" strokeDasharray="35 238" strokeDashoffset="-173" className="animate-donut-draw" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10B981" strokeWidth="15" strokeDasharray="30 238" strokeDashoffset="-210" className="animate-donut-draw" />
              </svg>

              {/* Center Text on top-most layer (z-20) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none z-20">
                <span className="text-base font-black text-slate-900 leading-none animate-pulse">{formatCount(totalRes)}</span>
                <span className="text-[7px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Total</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px] font-bold flex-1 select-none pl-1">
              {ageGroupData.map((g, idx) => (
                <div key={g.name} className="flex items-center justify-between gap-1 hover:bg-slate-50 p-0.5 rounded-md transition">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: g.fill || DEMOGRAPHICS_COLORS[idx % DEMOGRAPHICS_COLORS.length] }} />
                    <span className="text-slate-600 font-bold truncate">{g.name}</span>
                  </div>
                  <span className="text-slate-900 font-black shrink-0">{g.value} <span className="text-slate-400 font-semibold">({g.pct})</span></span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Chart 3: Population per Purok */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[280px] p-3.5 flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="admin-section-banner flex items-center justify-between rounded-xl p-2.5">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">POPULATION PER PUROK</h2>
              <p className="text-[9px] font-semibold text-emerald-200/90 leading-tight">Total registered residents by area</p>
            </div>
            <span className="rounded-full bg-emerald-950/60 px-2.5 py-0.5 text-[9.5px] font-black text-emerald-200 border border-emerald-400/40 shrink-0">
              7 Puroks
            </span>
          </div>

          {/* Bulletproof Animated CSS Bar Chart */}
          <div className="h-[160px] w-full mt-2 min-w-0 flex items-end justify-between px-1 gap-1.5 pb-6 pt-3 border-b border-slate-100 relative">
            {purokBarData.map((item, idx) => {
              const maxVal = Math.max(...purokBarData.map(p => p.count), 1);
              const heightPercent = Math.max((item.count / maxVal) * 100, 18);
              const pctOfTotal = ((item.count / (totalRes || 1)) * 100).toFixed(1);
              return (
                <div key={item.purok} className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer">
                  <div className="flex flex-col items-center mb-1 group-hover:-translate-y-1 transition duration-200">
                    <span className="text-[9.5px] font-black text-slate-800 leading-none">{item.count}</span>
                    <span className="text-[7px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition duration-200">{pctOfTotal}%</span>
                  </div>
                  <div
                    className="w-full max-w-[28px] rounded-t-lg transition-all duration-700 group-hover:brightness-110 shadow-sm animate-bar-grow"
                    style={{ height: `${heightPercent}%`, backgroundColor: item.fill || DEMOGRAPHICS_COLORS[idx % DEMOGRAPHICS_COLORS.length] }}
                  />
                  <span className="absolute -bottom-6 text-[9px] font-extrabold text-slate-600 truncate max-w-[48px] group-hover:text-[#0B6B3A] transition text-center">{item.purok}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ================= ROW 4: DEDICATED FULL-WIDTH RESIDENT LIST ================= */}
      <section className="h-auto">
        <motion.div variants={itemVariants} className="strict-dashboard-card p-4 min-w-0 overflow-hidden">
          {/* Green & Blue Glass Header Banner */}
          <div className="flex items-center justify-between rounded-xl p-3 bg-gradient-to-r from-[#064E3B] via-[#0284C7] to-[#0F766E] text-white shadow-lg border border-cyan-300/40 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-950/80 border border-emerald-400/50 shadow-md">
                <Users size={18} className="text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white drop-shadow-md">
                    RESIDENT LIST
                  </h2>
                  <span className="rounded-full bg-emerald-950/80 border border-emerald-400/60 px-2.5 py-0.5 text-[9px] font-black text-emerald-200 tracking-wide uppercase shadow-2xs">
                    Live Directory
                  </span>
                </div>
                <p className="text-[11px] font-bold text-cyan-100 drop-shadow-xs mt-0.5">
                  Recently registered & active Barangay Upper Mingading residents
                </p>
              </div>
            </div>
            <Link
              to="/residents"
              className="shrink-0 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-white px-3.5 py-1.5 text-xs font-black transition active:scale-95 shadow-md border border-emerald-400/50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>View All Residents</span>
              <ChevronRight size={13} className="text-emerald-300" />
            </Link>
          </div>

          {/* Spacious Table with Crystal Clear Fonts & Contrast */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700">
                  <th className="py-2.5 px-3.5 font-black uppercase tracking-wider text-[10.5px]">Resident Name</th>
                  <th className="py-2.5 px-3.5 font-black uppercase tracking-wider text-[10.5px]">Purok / Area</th>
                  <th className="py-2.5 px-3.5 font-black uppercase tracking-wider text-[10.5px]">Age & Gender</th>
                  <th className="py-2.5 px-3.5 font-black uppercase tracking-wider text-[10.5px]">Status</th>
                  <th className="py-2.5 px-3.5 font-black uppercase tracking-wider text-[10.5px]">Date Registered</th>
                  <th className="py-2.5 px-3.5 font-black uppercase tracking-wider text-[10.5px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayResidents.map((res) => (
                  <tr key={res.id} className="hover:bg-emerald-50/50 transition duration-150 group">
                    <td className="py-2.5 px-3.5 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-xs border border-white">
                        {res.name.charAt(0)}
                      </div>
                      <span className="font-black text-slate-900 text-xs group-hover:text-emerald-800 transition">{res.name}</span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                        <MapPin size={11} className="text-emerald-600 shrink-0" />
                        {res.purok}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-800 font-bold text-xs">
                      {res.age} yrs old • {res.gender === "M" || res.gender === "Male" ? "Male" : "Female"}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="inline-block rounded-full px-3 py-1 text-[10px] font-black border leading-none bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs">
                        ● {res.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-bold text-xs whitespace-nowrap">
                      {res.date}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate("/residents")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition duration-150 cursor-pointer shadow-sm"
                        title="View profile"
                      >
                        <Eye size={13} />
                        <span>Profile</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* ================= ROW 5: PENDING REQUESTS & ANNOUNCEMENTS (2 COLUMNS) ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] h-auto">
        {/* Card 1: Pending Requests */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[275px] p-3.5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between rounded-xl p-2.5 bg-gradient-to-r from-[#B48811] via-[#D4AF37] to-[#8C6400] text-white shadow-md border border-amber-300/40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-white drop-shadow-xs" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white drop-shadow-xs">PENDING REQUESTS</h2>
            </div>
            <Link to="/documents" className="shrink-0 text-[10px] font-black text-amber-100 hover:text-white transition flex items-center gap-0.5">
              <span>View All &gt;</span>
            </Link>
          </div>

          <div className="my-2 flex-1 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[340px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700">
                  <th className="py-1.5 px-2 font-black uppercase tracking-wider text-[10px]">Resident</th>
                  <th className="py-1.5 px-2 font-black uppercase tracking-wider text-[10px]">Document</th>
                  <th className="py-1.5 px-2 font-black uppercase tracking-wider text-[10px]">Date</th>
                  <th className="py-1.5 px-2 font-black uppercase tracking-wider text-[10px]">Status</th>
                  <th className="py-1.5 px-2 font-black uppercase tracking-wider text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition duration-150">
                    <td className="py-2 px-2 font-black text-slate-900 truncate max-w-[120px]">{req.name}</td>
                    <td className="py-2 px-2 text-slate-700 font-bold truncate max-w-[120px]">{req.type}</td>
                    <td className="py-2 px-2 text-slate-600 font-semibold whitespace-nowrap text-[11px]">{req.date}</td>
                    <td className="py-2 px-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black border leading-none whitespace-nowrap shadow-2xs ${req.statusClass}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => navigate("/documents")}
                        className="text-slate-400 hover:text-emerald-700 transition cursor-pointer p-1"
                        title="View details"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Card 2: Recent Announcements */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[275px] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between rounded-xl p-2.5 bg-gradient-to-r from-[#B48811] via-[#D4AF37] to-[#8C6400] text-white shadow-md border border-amber-300/40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="text-white drop-shadow-xs" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white drop-shadow-xs">RECENT ANNOUNCEMENTS</h2>
            </div>
            <Link to="/announcements" className="shrink-0 text-[10px] font-black text-amber-100 hover:text-white transition flex items-center gap-0.5">
              <span>View All &gt;</span>
            </Link>
          </div>

          <div className="my-1.5 space-y-1.5 flex-1 flex flex-col justify-center">
            {displayAnnouncements.map((ann, idx) => {
              const icons = [Users, FileText, Megaphone];
              const AnnouncementIcon = icons[idx % icons.length];
              const badgeColors = [
                "bg-emerald-50 text-emerald-600 border-emerald-200",
                "bg-purple-50 text-purple-600 border-purple-200",
                "bg-amber-50 text-amber-600 border-amber-200"
              ];
              return (
                <div key={ann.id} className="flex items-center gap-4 py-2 hover:bg-slate-50/80 transition duration-150 border-b border-slate-100 last:border-0 text-left px-1">
                  {/* Date Block */}
                  <div className="flex flex-col items-center shrink-0 w-8 text-center">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider leading-none">{ann.month}</span>
                    <span className="text-sm font-black text-slate-900 tracking-tight mt-0.5 leading-none">{ann.day}</span>
                  </div>

                  {/* Icon Circle */}
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-2xs ${badgeColors[idx % badgeColors.length]}`}>
                    <AnnouncementIcon size={14} />
                  </span>

                  {/* Title and Description */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-900 leading-tight truncate">{ann.title}</p>
                    <p className="text-[10.5px] text-slate-600 font-bold line-clamp-1 mt-0.5 leading-tight">{ann.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-1.5 flex items-center justify-center">
            <Link
              to="/announcements"
              className="text-[11px] font-black text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 transition hover:gap-1.5"
            >
              See all announcements →
            </Link>
          </div>
        </motion.div>
      </section>
      </div>
    </motion.div>
  );
};

export default DashboardOverview;
