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
  CloudSun,
  Calendar,
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
    const total = demographics.totalResidents || 1;
    const calcPct = (val) => `${((val / total) * 100).toFixed(1)}%`;
    return [
      { name: "0-17 yrs", value: demographics.children, pct: calcPct(demographics.children) },
      { name: "18-30 yrs", value: demographics.youngAdults, pct: calcPct(demographics.youngAdults) },
      { name: "31-45 yrs", value: demographics.adults, pct: calcPct(demographics.adults) },
      { name: "46-59 yrs", value: demographics.middleAged, pct: calcPct(demographics.middleAged) },
      { name: "60+ yrs", value: demographics.seniors, pct: calcPct(demographics.seniors) },
    ];
  }, [demographics]);

  // Population per Purok Bar Data dynamically computed from safeResidents
  const purokBarData = useMemo(() => {
    if (!safeResidents || safeResidents.length === 0) return [];
    const summary = buildPurokSummary(safeResidents, { includeOther: false });
    return summary
      .map((item) => ({
        purok: item.label,
        count: item.residents,
        fill: item.color || "#10B981",
      }))
      .sort((a, b) => b.count - a.count);
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
      className="mx-auto max-w-[1600px] space-y-[20px] font-sans text-slate-900 select-none"
    >
      {/* ================= ROW 2: UNIFIED BANNER & GLASS WEATHER ================= */}
      <motion.section
        variants={itemVariants}
        className="strict-dashboard-card bg-glass relative h-auto p-0 !overflow-visible select-none z-30"
      >
        {/* Background Image on Left with fade transition to Dark Green on Right */}
        <div className="absolute inset-0 w-full h-full flex rounded-[18px] overflow-hidden pointer-events-none z-0">
          {/* Left part: Image */}
          <div className="relative w-full lg:w-3/5 h-full">
            <img
              src="/barangay/BARANGAYOFICE.PNG"
              alt="Barangay Hall"
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay to fade the image into dark green on the right */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-[#0A2F1D] lg:block hidden" />
            <div className="absolute inset-0 bg-black/60 lg:hidden block" />
          </div>
          {/* Right part: Dark green solid background behind the glass */}
          <div className="hidden lg:block w-2/5 h-full bg-[#0A2F1D]" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col w-full p-6 gap-6">
          {header}
          {header && <div className="w-full h-px bg-white/10" />}

          <div className="grid grid-cols-1 lg:grid-cols-10 items-stretch gap-6 flex-1">
            {/* Left side: 4 KPI Cards (6 columns on lg) */}
            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
              {/* Card 1: Residents */}
              <div className="bg-[#ffffff10] border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between h-[130px] transition hover:bg-[#ffffff1a] hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Residents</span>
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                    <Users size={16} />
                  </div>
                </div>
                <div className="text-left">
                  <span className="block text-2xl font-black text-white">{formatCount(totalRes)}</span>
                  <span className="block text-[9px] font-semibold text-emerald-300 mt-1">Live records</span>
                </div>
              </div>

              {/* Card 2: Households */}
              <div className="bg-[#ffffff10] border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between h-[130px] transition hover:bg-[#ffffff1a] hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Households</span>
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                    <Home size={16} />
                  </div>
                </div>
                <div className="text-left">
                  <span className="block text-2xl font-black text-white">{formatCount(demographics.householdsCount)}</span>
                  <span className="block text-[9px] font-semibold text-amber-300 mt-1">Total families</span>
                </div>
              </div>

              {/* Card 3: Issued Documents */}
              <div className="bg-[#ffffff10] border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between h-[130px] transition hover:bg-[#ffffff1a] hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Issued</span>
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                    <FileCheck2 size={16} />
                  </div>
                </div>
                <div className="text-left">
                  <span className="block text-2xl font-black text-white">
                    {overview.documentsIssued !== undefined ? formatCount(overview.documentsIssued) : "8"}
                  </span>
                  <span className="block text-[9px] font-semibold text-purple-300 mt-1">Released docs</span>
                </div>
              </div>

              {/* Card 4: Pending Requests */}
              <div className="bg-[#ffffff10] border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col justify-between h-[130px] transition hover:bg-[#ffffff1a] hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Pending</span>
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="text-left">
                  <span className="block text-2xl font-black text-white">
                    {overview.pendingRequests !== undefined ? formatCount(overview.pendingRequests) : "28"}
                  </span>
                  <span className="block text-[9px] font-semibold text-blue-300 mt-1">Needs review</span>
                </div>
              </div>
            </div>

            {/* Right side: Glass Card Widget (4 columns on lg) */}
            <div className="lg:col-span-4 bg-black/35 border border-white/10 backdrop-blur-md rounded-2xl p-4 min-w-0">
              {/* Top row: 3 columns for Time, Weather, Event */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x lg:divide-x-0 lg:divide-y xl:divide-y-0 xl:divide-x divide-white/10 items-stretch gap-y-3 lg:gap-y-3 sm:gap-y-0 xl:gap-y-0">
                {/* SECTION 1: Current Time */}
                <div className="pb-3 sm:pb-0 lg:pb-3 xl:pb-0 sm:pr-3 xl:pr-3 lg:pr-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                    <Clock size={11} className="text-[#C8A14A]" />
                    <span>Current Time</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-black tracking-tight text-white">{clockDisplay.split(' ')[0]}</span>
                    <span className="text-xs font-bold text-emerald-300 uppercase shrink-0">{clockDisplay.split(' ')[1]}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 mt-1 block leading-tight">{formattedDate}</span>
                </div>

                {/* SECTION 2: Weather Today */}
                <div className="py-3 sm:py-0 lg:py-3 xl:py-0 sm:px-3 xl:px-3 lg:px-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                    <Sun size={11} className="text-[#C8A14A]" />
                    <span>Weather Today</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <CloudSun className="text-[#FFCC19] shrink-0" size={24} />
                    <span className="text-3xl font-black text-white leading-none">{weather.temp}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-200 mt-1 block">{weather.condition}</span>
                  <div className="text-[10px] text-slate-300 font-semibold mt-1 space-y-0.5">
                    <p>Humidity: {weather.humidity}</p>
                    <p>Wind: {weather.wind}</p>
                  </div>
                </div>

                {/* SECTION 3: Upcoming Event */}
                <div className="pt-3 sm:pt-0 lg:pt-3 xl:pt-0 sm:pl-3 xl:pl-3 lg:pl-0 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-1.5 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                      <Calendar size={11} className="text-[#C8A14A]" />
                      <span>Upcoming Event</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-extrabold text-white leading-tight">Barangay Assembly</p>
                      <p className="text-[9px] text-slate-300 font-medium mt-1">July 18, 2026</p>
                      <p className="text-[9px] text-slate-300 font-medium">9:00 AM</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => navigate("/announcements")}
                      className="strict-button-hover w-full rounded-lg bg-[#0B6B3A] hover:bg-[#0f532d] text-white py-1.5 px-2 text-[10px] font-bold transition active:scale-98 cursor-pointer shadow-xs border border-emerald-700/50"
                    >
                      View All Events
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </motion.section>

      {/* ================= ROW 3: THREE EQUAL CHARTS (HEIGHT 320px) ================= */}
      <section className="grid grid-cols-1 gap-[20px] lg:grid-cols-3 h-auto">
        {/* Card 1: Resident Growth Overview */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[270px] p-4 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="strict-card-title uppercase tracking-wider leading-none">Resident Growth Overview</h2>
              <p className="text-[10px] font-medium text-slate-400 mt-1">Monthly resident growth trend</p>
            </div>
            <select className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none focus:border-[#0B6B3A]">
              <option>This Year</option>
              <option>Last Year</option>
            </select>
          </div>

          <div className="flex items-baseline justify-between mt-2">
            <div>
              <span className="text-xl font-extrabold text-slate-900">{formatCount(totalRes)}</span>
              <span className="ml-1 text-[10px] font-bold text-slate-400">Total Residents</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-600">
              ↑ 18.6% vs last year
            </span>
          </div>

          <div className="h-[140px] w-full mt-1.5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={POPULATION_GROWTH_DATA} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "10px", fontWeight: "bold" }} />
                <Area type="monotone" dataKey="residents" stroke="#8B5CF6" strokeWidth={2} fill="url(#growthPurpleGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 2: Population Demographics */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[270px] p-4 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="strict-card-title uppercase tracking-wider leading-none">Population Demographics</h2>
          </div>

          <div className="my-auto flex items-center justify-between gap-2.5">
            <div className="relative h-28 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ageGroupData} dataKey="value" innerRadius={30} outerRadius={42} paddingAngle={3}>
                    {ageGroupData.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.fill || DEMOGRAPHICS_COLORS[index % DEMOGRAPHICS_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-black text-slate-900 leading-none">{formatCount(totalRes)}</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px] font-bold flex-1 select-none pl-2">
              {ageGroupData.map((g, idx) => (
                <div key={g.name} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.fill || DEMOGRAPHICS_COLORS[idx % DEMOGRAPHICS_COLORS.length] }} />
                    <span className="text-slate-500 font-semibold truncate">{g.name}</span>
                  </div>
                  <span className="text-slate-800 font-extrabold shrink-0">{g.value} <span className="text-slate-400 font-medium">({g.pct})</span></span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Card 3: Population per Purok */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[270px] p-4 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="strict-card-title uppercase tracking-wider leading-none">Population per Purok</h2>
              <p className="text-[10px] font-medium text-slate-400 mt-1">Total registered residents by area</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-[#0B6B3A] border border-[#0B6B3A]/20 shrink-0">
              7 Puroks
            </span>
          </div>

          <div className="h-[148px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={purokBarData} margin={{ top: 20, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="purok" tick={{ fill: "#64748B", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748B", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "10px", fontWeight: "bold" }} formatter={(val) => [`${val} Residents`, "Population"]} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={16}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} />
                  {purokBarData.map((entry) => (
                    <Cell key={entry.purok} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </section>

      {/* ================= ROW 4: THREE CONTENT CARDS (HEIGHT 290px) ================= */}
      <section className="grid grid-cols-1 gap-[20px] lg:grid-cols-3 h-auto">
        {/* Card 1: Recent Activities */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[240px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="strict-card-title uppercase tracking-wider leading-none">Recent Activities</h2>
            <Link to="/audit" className="text-[10px] font-bold text-[#0B6B3A] hover:underline flex items-center gap-0.5">
              View All
            </Link>
          </div>

          <div className="my-2 space-y-2 overflow-y-auto flex-1 h-[155px] pr-1">
            {displayActivities.map((act) => (
              <div key={act.id} className="flex items-start justify-between gap-3 p-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition duration-150">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-slate-100 text-slate-700 shadow-2xs">
                    {act.category === "Residents" ? (
                      <UserCheck size={14} className="text-emerald-600" />
                    ) : act.category === "Documents" ? (
                      <FileText size={14} className="text-purple-600" />
                    ) : (
                      <Megaphone size={14} className="text-amber-500" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[11px] font-extrabold text-slate-800 leading-tight truncate">{act.title}</p>
                    <p className="text-[9px] font-semibold text-slate-400">{act.time}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold border leading-none ${act.badge}`}>
                  {act.category}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Card 2: Pending Requests */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[240px] p-4 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="strict-card-title uppercase tracking-wider leading-none">Pending Requests</h2>
            <Link to="/documents" className="text-[10px] font-bold text-[#0B6B3A] hover:underline flex items-center gap-0.5">
              View All
            </Link>
          </div>

          <div className="my-2 flex-1 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-[11px] min-w-[340px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="py-1.5 font-bold uppercase tracking-wider">Resident</th>
                  <th className="py-1.5 font-bold uppercase tracking-wider">Document</th>
                  <th className="py-1.5 font-bold uppercase tracking-wider">Date</th>
                  <th className="py-1.5 font-bold uppercase tracking-wider">Status</th>
                  <th className="py-1.5 font-bold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition duration-150">
                    <td className="py-1.5 font-extrabold text-slate-900 truncate max-w-[80px]">{req.name}</td>
                    <td className="py-1.5 text-slate-500 font-semibold truncate max-w-[90px]">{req.type}</td>
                    <td className="py-1.5 text-slate-400 whitespace-nowrap">{req.date}</td>
                    <td className="py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold border leading-none whitespace-nowrap ${req.statusClass}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate("/documents")}
                        className="text-slate-400 hover:text-[#0B6B3A] transition cursor-pointer"
                        title="View details"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Card 3: Recent Announcements */}
        <motion.div variants={itemVariants} className="strict-dashboard-card h-[240px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="strict-card-title uppercase tracking-wider leading-none">Recent Announcements</h2>
            <Link to="/announcements" className="text-[10px] font-bold text-[#0B6B3A] hover:underline flex items-center gap-0.5">
              View All
            </Link>
          </div>

          <div className="my-1.5 space-y-1.5 flex-1 flex flex-col justify-center">
            {displayAnnouncements.map((ann, idx) => {
              const icons = [Users, FileText, Megaphone];
              const AnnouncementIcon = icons[idx % icons.length];
              const badgeColors = [
                "bg-emerald-50 text-emerald-600 border-emerald-100",
                "bg-purple-50 text-purple-600 border-purple-100",
                "bg-amber-50 text-amber-600 border-amber-100"
              ];
              return (
                <div key={ann.id} className="flex items-center gap-4 py-2 hover:bg-slate-50/40 transition duration-150 border-b border-slate-50 last:border-0 text-left">
                  {/* Date Block */}
                  <div className="flex flex-col items-center shrink-0 w-8 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">{ann.month}</span>
                    <span className="text-sm font-black text-slate-700 tracking-tight mt-0.5 leading-none">{ann.day}</span>
                  </div>

                  {/* Icon Circle */}
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${badgeColors[idx % badgeColors.length]}`}>
                    <AnnouncementIcon size={14} />
                  </span>

                  {/* Title and Description */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-extrabold text-slate-900 leading-tight truncate">{ann.title}</p>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5 leading-tight">{ann.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-2 flex items-center justify-center">
            <Link
              to="/announcements"
              className="text-[10px] font-bold text-[#0B6B3A] hover:underline flex items-center gap-1 mt-0.5 transition hover:gap-1.5"
            >
              See all announcements →
            </Link>
          </div>
        </motion.div>
      </section>
    </motion.div>
  );
};

export default DashboardOverview;
