import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildPurokSummary } from "../utils/residentProfile";

const formatMonth = (date) =>
  date.toLocaleDateString(undefined, { month: "short" });

const toMonthKey = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getLastMonths = (count = 6) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: toMonthKey(date),
      label: formatMonth(date),
    };
  });
};

const groupBy = (items, getKey) =>
  items.reduce((counts, item) => {
    const key = String(getKey(item) || "Unknown").trim() || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

const fillImaginedEarlyGrowth = (data = []) => {
  const firstResidentMonth = data.findIndex((month) => month.residents > 0);

  if (firstResidentMonth <= 0) return data;

  const firstResidentCount = data[firstResidentMonth].residents;

  return data.map((month, index) => {
    if (index >= firstResidentMonth) return month;

    return {
      ...month,
      residents: Math.round((firstResidentCount * (index + 1)) / (firstResidentMonth + 1)),
    };
  });
};

const PUROK_GRADIENT_PALETTE = [
  { from: "#1d4ed8", to: "#22d3ee" },
  { from: "#0891b2", to: "#14b8a6" },
  { from: "#0f766e", to: "#22c55e" },
  { from: "#15803d", to: "#84cc16" },
  { from: "#4d7c0f", to: "#eab308" },
  { from: "#1e40af", to: "#10b981" },
];

const buildMonthlyResidentGrowth = (residents = [], totalResidents = 0) => {
  const months = getLastMonths(6);
  const residentMonthCounts = groupBy(residents, (resident) => toMonthKey(resident.created_at));
  let runningResidents = Math.max(
    0,
    Number(totalResidents || residents.length || 0) -
      months.reduce((sum, month) => sum + (residentMonthCounts[month.key] || 0), 0)
  );

  const growthData = months.map((month) => {
    runningResidents += residentMonthCounts[month.key] || 0;
    return {
      month: month.label,
      residents: runningResidents,
      newResidents: residentMonthCounts[month.key] || 0,
    };
  });

  return fillImaginedEarlyGrowth(growthData);
};

const buildPurokData = (residents = [], totalResidents = 0) => {
  const currentResidents = residents.filter((resident) => resident.status !== "Archived");
  const entries = buildPurokSummary(currentResidents, { includeOther: true });

  if (!entries.length && totalResidents > 0) {
    return [{ label: "Residents", residents: totalResidents, households: 0, value: 100, color: "#2786d7" }];
  }

  const total = entries.reduce((sum, item) => sum + item.residents, 0) || totalResidents || 1;
  return entries.map((item) => ({
    ...item,
    percent: Math.round((item.residents / total) * 100),
  }));
};

const PurokTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow-lg shadow-slate-950/10">
      <p className="text-sm font-bold text-[#10213f]">{entry.label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-700">
        {Number(entry.residents || 0).toLocaleString()} residents
      </p>
      <p className="text-xs font-semibold text-slate-600">
        {Number(entry.households || 0).toLocaleString()} households
      </p>
    </div>
  );
};

const ChartCard = ({ totalResidents = 0, residents = [] }) => {
  const gradientIdPrefix = useId().replace(/:/g, "");
  const growthData = useMemo(
    () => buildMonthlyResidentGrowth(residents, totalResidents),
    [residents, totalResidents]
  );
  const purokData = useMemo(
    () =>
      buildPurokData(residents, totalResidents).map((entry, index) => {
        const gradient =
          PUROK_GRADIENT_PALETTE[index % PUROK_GRADIENT_PALETTE.length];

        return {
          ...entry,
          color: gradient.from,
          colorEnd: gradient.to,
          gradient: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          gradientId: `purok-ring-${gradientIdPrefix}-${index}`,
        };
      }),
    [gradientIdPrefix, residents, totalResidents]
  );
  const pieData = purokData.filter((entry) => entry.residents > 0);
  const total = purokData.reduce((sum, entry) => sum + entry.residents, 0) || Number(totalResidents || residents.length || 0);
  const householdTotal = purokData.reduce((sum, entry) => sum + entry.households, 0);
  const otherPurok = purokData.find((entry) => entry.value === "__other__");
  const hasOtherPuroks = Boolean(otherPurok?.residents);

  return (
    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="blue-glass-surface overflow-hidden rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/45 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-[#10213f]">Residents by Purok</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {hasOtherPuroks ? "Listed puroks plus records needing cleanup" : "Listed puroks with household totals"}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
            {householdTotal.toLocaleString()} households
          </span>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_220px] md:items-center">
          <div className="relative h-[230px] min-w-0">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <motion.svg
                className="h-[260px] w-[260px] overflow-visible opacity-70"
                viewBox="0 0 260 260"
                aria-hidden="true"
                animate={{ rotate: 360 }}
                transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
              >
                <ellipse
                  cx="130"
                  cy="130"
                  rx="118"
                  ry="48"
                  fill="none"
                  stroke="rgba(34, 211, 238, 0.42)"
                  strokeWidth="1.4"
                />
                <ellipse
                  cx="130"
                  cy="130"
                  rx="118"
                  ry="48"
                  fill="none"
                  stroke="rgba(236, 72, 153, 0.3)"
                  strokeWidth="1.2"
                  transform="rotate(60 130 130)"
                />
                <ellipse
                  cx="130"
                  cy="130"
                  rx="118"
                  ry="48"
                  fill="none"
                  stroke="rgba(34, 197, 94, 0.24)"
                  strokeWidth="1.2"
                  transform="rotate(120 130 130)"
                />
              </motion.svg>
            </div>
            <div className="relative z-10 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {pieData.map((entry) => (
                      <linearGradient
                        key={entry.gradientId}
                        id={entry.gradientId}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={entry.color} />
                        <stop offset="100%" stopColor={entry.colorEnd} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={1}
                    dataKey="residents"
                    stroke="#ffffff"
                    strokeWidth={2}
                    animationDuration={700}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.value} fill={`url(#${entry.gradientId})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<PurokTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total</p>
                <p className="mt-1 text-2xl font-bold text-[#10213f]">
                  {total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            {purokData.map((entry) => (
              <div key={entry.value} className="rounded-lg border border-slate-100 bg-white/55 px-2.5 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: entry.gradient }}
                    />
                    <p className="truncate font-bold leading-4 text-slate-700">{entry.label}</p>
                  </div>
                  <p className="text-xs font-bold leading-4 text-slate-800">{entry.percent}%</p>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold leading-4 text-slate-500">
                  <span>{entry.residents.toLocaleString()} residents</span>
                  <span>{entry.households.toLocaleString()} households</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="blue-glass-surface flex h-full flex-col overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/45 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-[#10213f]">Resident Growth</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Bar chart for resident records</p>
          </div>
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700 ring-1 ring-cyan-100">
            Live
          </span>
        </div>

        <div className="min-h-[270px] flex-1 px-4 pb-4 pt-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData} barCategoryGap="34%" margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={34} />
              <Tooltip cursor={false} />
              <Bar
                dataKey="residents"
                name="Resident growth"
                fill="var(--kaagap-chart-residents, #1f63ca)"
                radius={[8, 8, 2, 2]}
                maxBarSize={54}
                animationDuration={750}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default ChartCard;
