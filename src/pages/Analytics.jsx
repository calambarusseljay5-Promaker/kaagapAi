import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import html2canvas from "html2canvas";
import {
  Accessibility,
  BarChart3,
  Briefcase,
  CalendarDays,
  Download,
  FileText,
  FileType,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
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
} from "recharts";
import Header from "../components/Header";
import FloatingModal from "../components/FloatingModal";
import { supabase } from "../lib/supabaseClient";
import { fetchResidents } from "../services/adminService";
import { buildPurokSummary, calculateAge, formatPurok, getPurokDefinition } from "../utils/residentProfile";

const SENIOR_AGE = 60;
const BARANGAY_SECRETARY = "Jovelyn C. Cabaya";
const PUNONG_BARANGAY = "Hon. Mamerto C. Clarito";
const PWD_FIELDS = ["is_pwd", "pwd", "is_pwed", "pwed", "has_disability", "disability", "pwd_status"];
const SK_FIELDS = ["is_sk_participant", "sk_participant", "is_sk_member", "sk_member", "participates_in_sk", "sk_program_participant"];
const REPORT_AGE_BANDS = [
  { label: "0-4 years old", min: 0, max: 4 },
  { label: "5-9 years old", min: 5, max: 9 },
  { label: "10-14 years old", min: 10, max: 14 },
  { label: "15-19 years old", min: 15, max: 19 },
  { label: "20-24 years old", min: 20, max: 24 },
  { label: "25-29 years old", min: 25, max: 29 },
  { label: "30-34 years old", min: 30, max: 34 },
  { label: "35-39 years old", min: 35, max: 39 },
  { label: "40-44 years old", min: 40, max: 44 },
  { label: "45-49 years old", min: 45, max: 49 },
  { label: "50-54 years old", min: 50, max: 54 },
  { label: "55-59 years old", min: 55, max: 59 },
  { label: "60-64 years old", min: 60, max: 64 },
  { label: "65-69 years old", min: 65, max: 69 },
  { label: "70-74 years old", min: 70, max: 74 },
  { label: "75-79 years old", min: 75, max: 79 },
  { label: "80 years old and over", min: 80, max: Number.POSITIVE_INFINITY },
];

const REPORT_TYPES = [
  {
    key: "residents",
    label: "Population Report",
    title: "Population Report",
    description: "Total residents, households, and population per purok/sitio.",
    icon: Users,
    filename: "population-report",
  },
  {
    key: "age-distribution",
    label: "Age Distribution Report",
    title: "Age Distribution Report",
    description: "Children, youth, young adults, adults, and senior citizens.",
    icon: Users,
    filename: "age-distribution-report",
  },
  {
    key: "gender-distribution",
    label: "Gender Distribution Report",
    title: "Gender Distribution Report",
    description: "Male and female residents with percentage distribution.",
    icon: Users,
    filename: "gender-distribution-report",
  },
  {
    key: "civil-status",
    label: "Civil Status Report",
    title: "Civil Status Report",
    description: "Single, married, widowed, and separated residents.",
    icon: Users,
    filename: "civil-status-report",
  },
  {
    key: "employment-status",
    label: "Employment Status Report",
    title: "Employment Status Report",
    description: "Employed, unemployed, self-employed, and students.",
    icon: Briefcase,
    filename: "employment-status-report",
  },
  {
    key: "educational-attainment",
    label: "Educational Attainment Report",
    title: "Educational Attainment Report",
    description: "Elementary, high school, college, and postgraduate attainment.",
    icon: FileText,
    filename: "educational-attainment-report",
  },
  {
    key: "senior-citizen",
    label: "Senior Citizen Report",
    title: "Senior Citizen Report",
    description: "Senior citizen list, age bands, and purok distribution.",
    icon: Users,
    filename: "senior-citizen-report",
  },
  {
    key: "youth-profile",
    label: "Youth Profile Report",
    title: "Youth Profile Report",
    description: "Youth population, age groups, and SK program participation.",
    icon: Users,
    filename: "youth-profile-report",
  },
  {
    key: "pwd",
    label: "PWD Report",
    title: "PWD Report",
    description: "Total PWD residents, disability type, and purok distribution.",
    icon: Accessibility,
    filename: "pwd-report",
  },
  {
    key: "solo-parent",
    label: "Solo Parent Report",
    title: "Solo Parent Report",
    description: "Total solo parents with purok distribution.",
    icon: Users,
    filename: "solo-parent-report",
  },
  {
    key: "household-composition",
    label: "Household Composition Report",
    title: "Household Composition Report",
    description: "Family members per household, heads, and household distribution.",
    icon: Users,
    filename: "household-composition-report",
  },
];

const PRINTABLE_REPORTS = new Set([
  "residents",
  "age-distribution",
  "gender-distribution",
  "civil-status",
  "employment-status",
  "educational-attainment",
  "senior-citizen",
  "youth-profile",
  "pwd",
  "solo-parent",
  "household-composition"
]);

const CHART_COLORS = ["#1b4332", "#c5a059", "#2d6a4f", "#6b7280", "#7da65d", "#b45309", "#0f766e", "#64748b"];

const normalize = (value, fallback = "Unknown") => String(value ?? "").trim() || fallback;

const getAge = (resident) => {
  const age = Number(resident.age);
  if (Number.isFinite(age) && age >= 0) return age;
  return calculateAge(resident.birthday || resident.birth_date || resident.date_of_birth);
};

const getDetailedAgeBand = (resident) => {
  const age = getAge(resident);
  if (age == null) return null;
  return REPORT_AGE_BANDS.find((band) => age >= band.min && age <= band.max) || null;
};

const getResidentSex = (resident) => {
  const value = String(resident?.sex || resident?.gender || "").trim().toLowerCase();
  if (value === "male" || value === "m") return "male";
  if (value === "female" || value === "f") return "female";
  return null;
};

const buildFamilyProfile = (residents, puroks) => {
  const rows = REPORT_AGE_BANDS.map((band) => ({
    label: band.label,
    counts: Object.fromEntries(
      puroks.map((purok) => [purok.value, { male: 0, female: 0 }])
    ),
  }));
  const rowByLabel = new Map(rows.map((row) => [row.label, row]));
  let unclassified = 0;

  residents.forEach((resident) => {
    const ageBand = getDetailedAgeBand(resident);
    const sex = getResidentSex(resident);
    const purokValue = getPurokDefinition(resident?.purok)?.value || "__other__";
    const row = ageBand ? rowByLabel.get(ageBand.label) : null;

    if (!row || !sex || !row.counts[purokValue]) {
      unclassified += 1;
      return;
    }

    row.counts[purokValue][sex] += 1;
  });

  const purokTotals = Object.fromEntries(
    puroks.map((purok) => [
      purok.value,
      rows.reduce(
        (totals, row) => ({
          male: totals.male + row.counts[purok.value].male,
          female: totals.female + row.counts[purok.value].female,
        }),
        { male: 0, female: 0 }
      ),
    ])
  );
  const grandTotals = Object.values(purokTotals).reduce(
    (totals, counts) => ({
      male: totals.male + counts.male,
      female: totals.female + counts.female,
    }),
    { male: 0, female: 0 }
  );

  return { rows, purokTotals, grandTotals, unclassified };
};

const countBy = (items, getKey) =>
  items.reduce((counts, item) => {
    const key = normalize(getKey(item));
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

const countRows = (counts) =>
  Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const getPercent = (count, total) => (total ? Math.round((count / total) * 100) : 0);

const buildPurokCategoryRows = (items, puroks, categoryLabels, getCategoryLabel) =>
  puroks.map((purok) => {
    const itemsInPurok = items.filter((item) => formatPurok(item.purok) === purok.label);
    const counts = categoryLabels.map(
      (label) => itemsInPurok.filter((item) => normalize(getCategoryLabel(item)) === label).length
    );

    return [
      purok.label,
      ...counts,
      itemsInPurok.length,
      `${getPercent(itemsInPurok.length, items.length)}%`,
    ];
  });

const normalizeLower = (value) => String(value ?? "").trim().toLowerCase();

const getResidentName = (resident = {}) => {
  const fullName = [resident.first_name, resident.middle_name, resident.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  return normalize(fullName || resident.full_name || resident.name, "Unnamed resident");
};

const getHouseholdKey = (resident = {}) =>
  String(
    resident.household_no ||
    resident.house_no ||
    resident.household_id ||
    resident.address ||
    resident.id ||
    ""
  ).trim();

const getHouseholdLabel = (resident = {}) => {
  if (resident.household_no) return `Household ${resident.household_no}`;
  if (resident.house_no) return `Household ${resident.house_no}`;
  return normalize(resident.address, "Unlisted household");
};

const isHouseholdHead = (resident = {}) => {
  const relationship = normalizeLower(
    resident.relationship_to_household_head || resident.household_relationship
  );
  return relationship === "head" || relationship === "household head" || relationship.includes("head");
};

const findFirstExistingField = (residents, fields) =>
  fields.find((field) => residents.some((resident) => Object.prototype.hasOwnProperty.call(resident, field)));

const isTruthyValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = normalizeLower(value);
  return ["yes", "true", "1", "registered", "voter", "member", "active"].some((token) => normalized.includes(token));
};

const isFalsyValue = (value) => {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value === 0;
  const normalized = normalizeLower(value);
  return ["no", "false", "0", "unregistered", "not registered", "none"].some((token) => normalized.includes(token));
};

const getGenderLabel = (resident = {}) => {
  const value = normalizeLower(resident.sex || resident.gender);
  if (value === "male" || value === "m") return "Male";
  if (value === "female" || value === "f") return "Female";
  return "Unclassified";
};

const getAgeDistributionLabel = (resident = {}) => {
  const age = getAge(resident);
  if (age == null) return "Unknown age";
  if (age <= 12) return "Children (0-12 years old)";
  if (age <= 17) return "Youth (13-17 years old)";
  if (age <= 30) return "Young Adults (18-30 years old)";
  if (age <= 59) return "Adults (31-59 years old)";
  return "Senior Citizens (60 years old and above)";
};

const getSeniorAgeBandLabel = (resident = {}) => {
  const age = getAge(resident);
  if (age == null || age < SENIOR_AGE) return null;
  if (age <= 64) return "60-64 years old";
  if (age <= 69) return "65-69 years old";
  if (age <= 74) return "70-74 years old";
  if (age <= 79) return "75-79 years old";
  return "80 years old and above";
};

const getYouthAgeBandLabel = (resident = {}) => {
  const age = getAge(resident);
  if (age == null || age < 13 || age > 30) return null;
  if (age <= 17) return "13-17 years old";
  return "18-30 years old";
};

const getCivilStatusLabel = (resident = {}) => {
  const value = normalizeLower(resident.civil_status);
  if (!value) return "Unclassified";
  if (value.includes("single")) return "Single";
  if (value.includes("married")) return "Married";
  if (value.includes("widow")) return "Widowed";
  if (value.includes("separated")) return "Separated";
  return "Other";
};

const getEducationalGroupLabel = (resident = {}) => {
  const value = normalizeLower(resident.educational_attainment);
  if (!value) return "Unclassified";
  if (value.includes("postgraduate") || value.includes("master") || value.includes("doctor")) return "Postgraduate";
  if (value.includes("college")) return "College Level/Graduate";
  if (value.includes("high school") || value.includes("senior high")) return "High School Level/Graduate";
  return "Elementary Level/Graduate";
};

const getEmploymentStatusLabel = (resident = {}) => {
  const explicit = normalizeLower(resident.employment_status || resident.work_status || resident.work_type);
  const occupation = normalizeLower(resident.occupation);
  const source = explicit || occupation;

  if (!source) return "Unclassified";
  if (source.includes("student")) return "Students";
  if (source.includes("unemployed") || source.includes("jobless") || source.includes("not employed") || source.includes("none")) return "Unemployed";
  if (source.includes("self employed") || source.includes("self-employed") || source.includes("business") || source.includes("vendor") || source.includes("freelance") || source.includes("entrepreneur") || source.includes("farm")) {
    return "Self-employed";
  }
  return "Employed";
};

const getSkParticipationLabel = (resident = {}, skField) => {
  if (!skField) return null;

  const value = resident[skField];
  if (isTruthyValue(value)) return "Participating";
  if (isFalsyValue(value)) return "Not participating";

  const normalized = normalizeLower(value);
  if (!normalized) return "Unknown";
  if (normalized.includes("particip") || normalized.includes("member") || normalized.includes("yes")) return "Participating";
  if (normalized.includes("not") || normalized.includes("no")) return "Not participating";
  return "Unknown";
};

const getPWDTypeLabel = (resident = {}) =>
  normalize(resident.pwd_type || resident.disability_type || resident.disability || resident.pwd_status, "Unspecified");

const buildHouseholdGroups = (residents = []) => {
  const groups = new Map();

  residents.forEach((resident) => {
    const key = getHouseholdKey(resident) || `resident:${resident.id || getResidentName(resident)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: getHouseholdLabel(resident),
        purok: formatPurok(resident.purok),
        members: [],
        head: null,
      });
    }

    const group = groups.get(key);
    group.members.push(resident);

    if (!group.head && isHouseholdHead(resident)) {
      group.head = resident;
    }
  });

  return [...groups.values()]
    .map((group) => {
      const head = group.head || group.members.find(isHouseholdHead) || group.members[0] || null;

      return {
        ...group,
        head,
        headName: head ? getResidentName(head) : "Unlisted",
        memberCount: group.members.length,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const findPwdField = (residents) =>
  PWD_FIELDS.find((field) => residents.some((resident) => Object.prototype.hasOwnProperty.call(resident, field)));

const isPwd = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["yes", "true", "pwd", "pwed", "person with disability", "1"].includes(value.trim().toLowerCase());
  }
  return false;
};

const exportCsv = (rows, filename) => {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const StatCard = ({ label, value, icon: Icon, tone = "green" }) => {
  const tones = {
    green: "bg-[#f0f7f4] text-[#1b4332] border-[#1b4332]/20",
    gold: "bg-[#fcf8f0] text-[#c5a059] border-[#c5a059]/20",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <div className="rounded-xl border bg-white p-3.5 shadow-sm transition hover:shadow-md duration-200">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg border ${tones[tone]}`}>
        <Icon size={16} />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#081c15]">{value}</p>
    </div>
  );
};

const BreakdownTable = ({ title, rows, total }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="text-xs font-extrabold text-[#1b4332] border-b pb-2 mb-3 uppercase tracking-wider">{title}</h3>
    <div className="space-y-2.5">
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">No data available.</p>
      ) : (
        rows.map(([label, count]) => {
          const percent = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={label}>
              <div className="mb-0.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">{label}</span>
                <span className="text-slate-500 font-mono">{count} ({percent}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-[#1b4332]" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  </section>
);

const toChartData = (rows = []) =>
  rows.map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));

const ChartPanel = ({ title, subtitle, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#1b4332]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{subtitle}</p> : null}
      </div>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0f7f4] text-[#1b4332]">
        <BarChart3 size={14} />
      </span>
    </div>
    {children}
  </section>
);

const BarChartPanel = ({ title, subtitle, rows, dataKeyLabel = "Count" }) => {
  const data = toChartData(rows);

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="h-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-10} textAnchor="end" height={40} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip formatter={(value) => [value, dataKeyLabel]} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
};

const PieChartPanel = ({ title, subtitle, rows }) => {
  const data = toChartData(rows);

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
        <div className="h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 self-center">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-2.5 text-[10px]">
              <span className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-500">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="font-bold text-slate-800">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartPanel>
  );
};

const getTableCellClass = (value) => {
  const normalized = String(value ?? "").trim();
  return /^-?\d+(\.\d+)?%?$/.test(normalized) ? "text-center" : "text-left";
};

const sumNumericColumn = (rows, columnIndex) =>
  rows.reduce((total, row) => {
    const value = Number(row[columnIndex]);
    return Number.isFinite(value) ? total + value : total;
  }, 0);

// REPORT STYLING CONTEXT — defaults tuned to match the official reference template
const ReportStyleContext = createContext({
  fontSize: 7,      // in pt — matches reference
  rowPadding: 2,    // in px — tight like reference
  margin: 5         // in mm — minimal margins
});

// REUSABLE REPORT LAYOUT COMPONENT
const ReportLayout = ({ children, paperSize = "a4", orientation = "portrait", fontSize = 7, rowPadding = 2, margin = 5 }) => {
  const pageStyle = `
    @media print {
      @page {
        size: ${paperSize.toUpperCase()} ${orientation};
        margin: ${margin}mm !important;
      }
    }
  `;
  return (
    <ReportStyleContext.Provider value={{ fontSize, rowPadding, margin }}>
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />
      <div 
        className={`report-layout-container ${paperSize.toLowerCase()} ${orientation.toLowerCase()}`}
        style={{
          fontSize: `${fontSize}pt`,
          fontFamily: "Arial, 'Segoe UI', Calibri, Helvetica, sans-serif",
          padding: `${margin}mm`
        }}
      >
        {children}
      </div>
    </ReportStyleContext.Provider>
  );
};

// REUSABLE REPORT HEADER COMPONENT — uses context fontSize so sliders work
const ReportHeader = ({ title, year = 2026, purokLabel = "" }) => {
  const { fontSize } = useContext(ReportStyleContext);
  const logoSize = Math.max(36, fontSize * 6);
  const titleSize = Math.max(10, fontSize + 4);
  const subSize = Math.max(7, fontSize);
  return (
    <div className="gov-report-header" style={{ marginBottom: '4px' }}>
      <div className="gov-report-masthead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '2px' }}>
        <img src="/logo.png" className="gov-report-logo" alt="Barangay Logo" style={{ width: `${logoSize}px`, height: `${logoSize}px`, objectFit: 'contain' }} />
        <div className="gov-report-info" style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <p style={{ fontSize: `${subSize}pt`, margin: 0, fontWeight: 500 }}>Republic of the Philippines</p>
          <p style={{ fontSize: `${subSize}pt`, margin: 0, fontWeight: 500 }}>Province of Cotabato</p>
          <p style={{ fontSize: `${subSize}pt`, margin: 0, fontWeight: 500 }}>Municipality of Aleosan</p>
          <p style={{ fontSize: `${subSize + 1}pt`, margin: '1px 0', fontWeight: 900, letterSpacing: '0.5px' }}>BARANGAY UPPER MINGADING</p>
          <p style={{ fontSize: `${subSize - 0.5}pt`, margin: 0, fontWeight: 600 }}>OFFICE OF THE PUNONG BARANGAY</p>
        </div>
        <img src="/aleosan.logo.png" className="gov-report-logo" alt="Aleosan Municipality Logo" style={{ width: `${logoSize}px`, height: `${logoSize}px`, objectFit: 'contain' }} />
      </div>
      <div className="gov-report-divider" style={{ borderTop: '1.5px solid #14532D', height: '0', margin: '3px 0' }} />
      <h2 className="gov-report-title" style={{ fontSize: `${titleSize}pt`, fontWeight: 900, textAlign: 'center', margin: '3px 0 2px', letterSpacing: '1px' }}>{title} C.Y. {year}</h2>
      {purokLabel ? (
        <p className="gov-report-filter" style={{ fontSize: `${subSize + 0.5}pt`, textAlign: 'center', margin: 0, fontWeight: 700, color: '#14532D' }}>PUROK: {purokLabel.toUpperCase()}</p>
      ) : null}
    </div>
  );
};

// REUSABLE REPORT TABLE COMPONENT
const ReportTable = ({ title, headers, rows, footerRows = [], emptyText = "No data available." }) => {
  const { fontSize, rowPadding } = useContext(ReportStyleContext);
  const cellPad = `${rowPadding}px ${rowPadding + 1}px`;
  return (
    <section className="gov-report-table-section" style={{ marginBottom: '6px' }}>
      {title && (
        <h3 className="gov-report-table-title" style={{ fontSize: `${fontSize + 1}pt`, paddingLeft: '4px', marginBottom: '2px' }}>
          {title}
        </h3>
      )}
      {rows.length === 0 ? (
        <p className="print-report-empty" style={{ fontSize: `${fontSize}pt` }}>{emptyText}</p>
      ) : (
        <table className="gov-report-table" style={{ fontSize: `${fontSize}pt` }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ fontSize: `${fontSize}pt`, padding: cellPad }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIndex) => (
              <tr key={rIndex}>
                {row.map((cell, cIndex) => {
                  const numeric = /^-?\d+(\.\d+)?%?$/.test(String(cell ?? "").trim());
                  const alignClass = cIndex === 0 ? "text-left font-bold" : (numeric ? "text-center" : "text-left");
                  return (
                    <td key={cIndex} className={alignClass} style={{ padding: cellPad, fontSize: `${fontSize}pt` }}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {footerRows.length > 0 && (
            <tfoot>
              {footerRows.map((row, rIndex) => (
                <tr key={rIndex} className="gov-table-totals">
                  {row.map((cell, cIndex) => {
                    const alignClass = cIndex === 0 ? "text-left font-bold" : "text-center";
                    return (
                      <td key={cIndex} className={alignClass} style={{ padding: cellPad, fontSize: `${fontSize}pt` }}>
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      )}
    </section>
  );
};

// REUSABLE REPORT SUMMARY COMPONENT
const ReportSummary = ({ title, items = [] }) => {
  const { fontSize } = useContext(ReportStyleContext);
  if (!items.length) return null;
  return (
    <div className="gov-report-summary-box" style={{ padding: '4px 8px', margin: '4px 0' }}>
      <h4 className="gov-report-summary-title" style={{ fontSize: `${fontSize + 1}pt`, marginBottom: '3px' }}>{title}</h4>
      <div className="gov-report-summary-grid">
        {items.map((item, index) => (
          <div key={index} className="gov-report-summary-item" style={{ fontSize: `${fontSize}pt`, paddingBottom: '1px' }}>
            <span className="label">{item.label}</span>
            <span className="value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// REUSABLE REPORT FOOTER COMPONENT
const ReportFooter = ({
  preparedBy = "JOVELYN C. CABAYA",
  preparedByTitle = "Barangay Secretary",
  certifiedBy = "HON. MAMERTO C. CLARITO",
  certifiedByTitle = "Punong Barangay"
}) => {
  return (
    <footer className="gov-report-footer" style={{ marginTop: '12px' }}>
      <div className="gov-report-signatory">
        <p style={{ fontSize: '7.5pt', marginBottom: '18px' }}>Prepared by:</p>
        <div className="gov-report-signatory-name" style={{ fontSize: '9pt', minWidth: '160px' }}>{preparedBy}</div>
        <div className="gov-report-signatory-title" style={{ fontSize: '7pt' }}>{preparedByTitle}</div>
      </div>
      <div className="gov-report-signatory">
        <p style={{ fontSize: '7.5pt', marginBottom: '18px' }}>Certified by:</p>
        <div className="gov-report-signatory-name" style={{ fontSize: '9pt', minWidth: '160px' }}>{certifiedBy}</div>
        <div className="gov-report-signatory-title" style={{ fontSize: '7pt' }}>{certifiedByTitle}</div>
      </div>
    </footer>
  );
};

// BACKWARDS COMPATIBILITY WRAPPER FOR OLD PRINTSECTION
const PrintSection = ({ title, headers, rows, footerRows = [], emptyText = "No data available.", className = "" }) => (
  <ReportTable
    title={title}
    headers={headers}
    rows={rows}
    footerRows={footerRows}
    emptyText={emptyText}
  />
);

const getPurokHeaderStyle = (purokKey) => {
  const norm = String(purokKey ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("kamonsil")) return { backgroundColor: "#fee2e2", color: "#991b1b" };
  if (norm.includes("payhod")) return { backgroundColor: "#fef9c3", color: "#854d0e" };
  if (norm.includes("muslim")) return { backgroundColor: "#dcfce7", color: "#166534" };
  if (norm.includes("malipayon")) return { backgroundColor: "#ffe4e6", color: "#9f1239" };
  if (norm.includes("purok3") || norm.includes("purokthree")) return { backgroundColor: "#ccfbf1", color: "#115e59" };
  if (norm.includes("buklod")) return { backgroundColor: "#f3e8ff", color: "#6b21a8" };
  if (norm.includes("azucena")) return { backgroundColor: "#fef08a", color: "#854d0e" };
  return { backgroundColor: "#f0fdf4", color: "#14532D" };
};

const getPurokSubHeaderStyle = (purokKey) => {
  const norm = String(purokKey ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("kamonsil")) return { backgroundColor: "#fef2f2", color: "#1f2937" };
  if (norm.includes("payhod")) return { backgroundColor: "#fefce8", color: "#1f2937" };
  if (norm.includes("muslim")) return { backgroundColor: "#f0fdf4", color: "#1f2937" };
  if (norm.includes("malipayon")) return { backgroundColor: "#fff5f5", color: "#1f2937" };
  if (norm.includes("purok3") || norm.includes("purokthree")) return { backgroundColor: "#f0fdfa", color: "#1f2937" };
  if (norm.includes("buklod")) return { backgroundColor: "#faf5ff", color: "#1f2937" };
  if (norm.includes("azucena")) return { backgroundColor: "#fefce8", color: "#1f2937" };
  return { backgroundColor: "#f8fafc", color: "#1f2937" };
};

const PopulationMatrixSection = ({ familyProfile, puroks }) => {
  const { fontSize, rowPadding } = useContext(ReportStyleContext);
  const grandTotal = familyProfile.grandTotals.male + familyProfile.grandTotals.female;
  const cellPad = `${rowPadding}px 1px`;

  return (
    <section className="gov-report-table-section" style={{ marginBottom: '4px' }}>
      <h3 className="gov-report-table-title" style={{ fontSize: `${fontSize + 1}pt`, paddingLeft: '2px', marginBottom: '2px' }}>
        Population by Age Group and Purok
      </h3>
      <table className="gov-report-table" style={{ fontSize: `${fontSize}pt`, tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr>
            <th rowSpan="2" className="text-center font-bold" style={{ fontSize: `${fontSize}pt`, padding: cellPad, verticalAlign: "middle", width: '60px' }}>Age</th>
            {puroks.map((purok) => (
              <th
                key={purok.value}
                colSpan="3"
                className="text-center font-bold"
                style={{
                  ...getPurokHeaderStyle(purok.value),
                  fontSize: `${fontSize}pt`,
                  padding: cellPad,
                  border: "1px solid #111827"
                }}
              >
                {purok.label.toUpperCase()}
              </th>
            ))}
          </tr>
          <tr>
            {puroks.flatMap((purok) => {
              const subStyle = {
                ...getPurokSubHeaderStyle(purok.value),
                fontSize: `${fontSize - 0.5}pt`,
                padding: `${rowPadding}px 0px`,
                border: "1px solid #cbd5e1",
                textAlign: 'center'
              };
              return [
                <th key={`${purok.value}-male`} style={subStyle}>M</th>,
                <th key={`${purok.value}-female`} style={subStyle}>F</th>,
                <th key={`${purok.value}-total`} style={{ ...subStyle, fontWeight: "800" }}>T</th>,
              ];
            })}
          </tr>
        </thead>
        <tbody>
          {familyProfile.rows.map((row) => (
            <tr key={row.label}>
              <td className="text-left font-bold" style={{ padding: cellPad, fontSize: `${fontSize - 0.5}pt`, whiteSpace: 'nowrap' }}>{row.label}</td>
              {puroks.flatMap((purok) => {
                const counts = row.counts[purok.value] || { male: 0, female: 0 };
                return [
                  <td key={`${row.label}-${purok.value}-male`} className="text-center" style={{ padding: cellPad }}>{counts.male}</td>,
                  <td key={`${row.label}-${purok.value}-female`} className="text-center" style={{ padding: cellPad }}>{counts.female}</td>,
                  <td key={`${row.label}-${purok.value}-total`} className="text-center font-semibold" style={{ padding: cellPad, backgroundColor: "#f8fafc" }}>{counts.male + counts.female}</td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="gov-table-totals">
            <td className="text-left font-bold" style={{ padding: cellPad, fontSize: `${fontSize}pt` }}>Total</td>
            {puroks.flatMap((purok) => {
              const totals = familyProfile.purokTotals[purok.value] || { male: 0, female: 0 };
              const totalCellStyle = {
                padding: cellPad,
                fontSize: `${fontSize}pt`,
                backgroundColor: "#fef9c3",
                color: "#1f2937",
                border: "1px solid #14532D"
              };
              return [
                <td key={`${purok.value}-total-male`} className="text-center font-bold" style={totalCellStyle}>{totals.male}</td>,
                <td key={`${purok.value}-total-female`} className="text-center font-bold" style={totalCellStyle}>{totals.female}</td>,
                <td key={`${purok.value}-total-all`} className="text-center font-extrabold" style={{ ...totalCellStyle, backgroundColor: "#ded260" }}>{totals.male + totals.female}</td>,
              ];
            })}
          </tr>
        </tfoot>
      </table>
      <div 
        className="text-right font-bold uppercase text-[#14532D]"
        style={{ fontSize: `${fontSize + 1}pt`, marginTop: '2px' }}
      >
        Grand Total: {grandTotal}
      </div>
    </section>
  );
};

const PrintPurokTotals = ({ rows, grandTotalLabel = "Grand Total" }) => {
  const { fontSize, rowPadding } = useContext(ReportStyleContext);
  const maleTotal = sumNumericColumn(rows, 1);
  const femaleTotal = sumNumericColumn(rows, 2);
  const overallTotal = sumNumericColumn(rows, 3);
  const cellPad = `${rowPadding}px ${rowPadding + 1}px`;
  const allRows = [...rows, [grandTotalLabel, maleTotal, femaleTotal, overallTotal]];
  const headers = ["Purok Name", "Male Total", "Female Total", "Overall Total"];

  return (
    <section className="gov-report-table-section" style={{ marginBottom: '6px' }}>
      <h3 className="gov-report-table-title" style={{ fontSize: `${fontSize + 1}pt`, paddingLeft: '4px', marginBottom: '2px' }}>
        Summary by Purok
      </h3>
      {rows.length === 0 ? (
        <p style={{ fontSize: `${fontSize}pt` }}>No purok summary available.</p>
      ) : (
        <table className="gov-report-table gov-report-table-light" style={{ fontSize: `${fontSize}pt` }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ fontSize: `${fontSize}pt`, padding: cellPad, backgroundColor: '#dcfce7', color: '#14532D', border: '1px solid #86efac', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIndex) => (
              <tr key={rIndex}>
                {row.map((cell, cIndex) => {
                  const alignClass = cIndex === 0 ? "text-left font-bold" : "text-center";
                  return (
                    <td key={cIndex} className={alignClass} style={{ padding: cellPad, fontSize: `${fontSize}pt` }}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="gov-table-totals">
              {[grandTotalLabel, maleTotal, femaleTotal, overallTotal].map((cell, cIndex) => (
                <td key={cIndex} className={cIndex === 0 ? "text-left font-bold" : "text-center"} style={{ padding: cellPad, fontSize: `${fontSize}pt` }}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
};

const Analytics = () => {
  const [selectedReport, setSelectedReport] = useState("residents");
  const [reportFilters, setReportFilters] = useState({
    dateFrom: "",
    dateTo: "",
    purok: "all",
  });
  const [residents, setResidents] = useState([]);
  const [pwdColumnReady, setPwdColumnReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("analytics");
  const [paperSize, setPaperSize] = useState("a4");
  const [paperOrientation, setPaperOrientation] = useState("");
  const [fontSize, setFontSize] = useState(7);
  const [rowPadding, setRowPadding] = useState(2);
  const [margin, setMargin] = useState(5);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [residentResult] = await Promise.allSettled([
        fetchResidents("", "", { withAccounts: false }),
      ]);
      const { error: pwdColumnError } = await supabase
        .from("residents")
        .select("is_pwd,pwd_type")
        .limit(1);

      setResidents(residentResult.status === "fulfilled" ? residentResult.value : []);
      setPwdColumnReady(!pwdColumnError);

      const errors = [residentResult]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message || "A report module could not be loaded.");

      if (errors.length) {
        setMessage(`Some report data could not be loaded. ${errors[0]}`);
      }
    } catch (error) {
      setMessage(error.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const report = useMemo(() => {
    const selectedPurokValue = reportFilters.purok;
    const matchesPurokFilter = (resident) => {
      if (selectedPurokValue === "all") return true;
      return (getPurokDefinition(resident?.purok)?.value || "__other__") === selectedPurokValue;
    };
    const allCurrent = residents.filter((resident) => resident.status !== "Archived");
    const availablePuroks = buildPurokSummary(allCurrent, { includeOther: true });
    const current = allCurrent.filter(matchesPurokFilter);
    const selectedPurokSummary =
      selectedPurokValue === "all"
        ? availablePuroks
        : availablePuroks.filter((purok) => purok.value === selectedPurokValue);
    const seniors = current.filter((resident) => {
      const age = getAge(resident);
      return age != null && age >= SENIOR_AGE;
    });
    const youthResidents = current.filter((resident) => {
      const age = getAge(resident);
      return age != null && age >= 13 && age <= 30;
    });
    const pwdField = findPwdField(residents);
    const pwdAvailable = Boolean(pwdField || pwdColumnReady);
    const pwdResidents = pwdAvailable ? current.filter((resident) => isPwd(resident[pwdField || "is_pwd"])) : [];
    const pwdCount = pwdAvailable ? pwdResidents.length : null;

    const purokSummary = selectedPurokSummary.length
      ? selectedPurokSummary
      : buildPurokSummary(current, { includeOther: true }).filter((purok) => selectedPurokValue === "all" || purok.value === selectedPurokValue);
    const familyProfile = buildFamilyProfile(current, purokSummary);
    const householdGroups = buildHouseholdGroups(current);
    const skField = findFirstExistingField(current, SK_FIELDS);
    const soloParents = current.filter((resident) => Boolean(resident.is_solo_parent));

    const genderRows = countRows(countBy(current, getGenderLabel));
    const ageRows = countRows(countBy(current, getAgeDistributionLabel));
    const civilStatusRows = countRows(countBy(current, getCivilStatusLabel));
    const educationalAttainmentRows = countRows(countBy(current, getEducationalGroupLabel));
    const employmentStatusRows = countRows(countBy(current, getEmploymentStatusLabel));
    const seniorAgeRows = countRows(
      countBy(seniors, (resident) => getSeniorAgeBandLabel(resident) || "Unclassified")
    );
    const youthAgeRows = countRows(
      countBy(youthResidents, (resident) => getYouthAgeBandLabel(resident) || "Unclassified")
    );
    const seniorPurokRows = countRows(countBy(seniors, (resident) => formatPurok(resident.purok)));
    const youthPurokRows = countRows(countBy(youthResidents, (resident) => formatPurok(resident.purok)));
    const pwdTypeRows = countRows(countBy(pwdResidents, getPWDTypeLabel));
    const pwdPurokRows = countRows(countBy(pwdResidents, (resident) => formatPurok(resident.purok)));
    const soloParentPurokRows = countRows(countBy(soloParents, (resident) => formatPurok(resident.purok)));
    const householdRows = householdGroups.map((group) => [group.label, group.headName, group.memberCount, group.purok]);
    const householdPurokRows = countRows(countBy(householdGroups, (group) => group.purok));
    const ageCategoryLabels = ageRows.map(([label]) => label);
    const genderCategoryLabels = genderRows.map(([label]) => label);
    const civilStatusCategoryLabels = civilStatusRows.map(([label]) => label);
    const employmentStatusCategoryLabels = employmentStatusRows.map(([label]) => label);
    const educationalAttainmentCategoryLabels = educationalAttainmentRows.map(([label]) => label);
    const seniorAgeCategoryLabels = seniorAgeRows.map(([label]) => label);
    const youthAgeCategoryLabels = youthAgeRows.map(([label]) => label);
    const pwdTypeCategoryLabels = pwdTypeRows.map(([label]) => label);
    const agePurokRows = buildPurokCategoryRows(current, purokSummary, ageCategoryLabels, getAgeDistributionLabel);
    const genderPurokRows = buildPurokCategoryRows(current, purokSummary, genderCategoryLabels, getGenderLabel);
    const civilStatusPurokRows = buildPurokCategoryRows(current, purokSummary, civilStatusCategoryLabels, getCivilStatusLabel);
    const employmentStatusPurokRows = buildPurokCategoryRows(current, purokSummary, employmentStatusCategoryLabels, getEmploymentStatusLabel);
    const educationalAttainmentPurokRows = buildPurokCategoryRows(current, purokSummary, educationalAttainmentCategoryLabels, getEducationalGroupLabel);
    const seniorAgePurokRows = buildPurokCategoryRows(seniors, purokSummary, seniorAgeCategoryLabels, getSeniorAgeBandLabel);
    const youthAgePurokRows = buildPurokCategoryRows(youthResidents, purokSummary, youthAgeCategoryLabels, getYouthAgeBandLabel);
    const pwdTypePurokRows = buildPurokCategoryRows(pwdResidents, purokSummary, pwdTypeCategoryLabels, getPWDTypeLabel);
    const purokPopulationRows = purokSummary.map((purok) => {
      const residentsInPurok = current.filter(
        (resident) => formatPurok(resident.purok) === purok.label
      );
      const male = residentsInPurok.filter((resident) => getGenderLabel(resident) === "Male").length;
      const female = residentsInPurok.filter((resident) => getGenderLabel(resident) === "Female").length;
      const unclassified = residentsInPurok.length - male - female;

      return [
        purok.label,
        male,
        female,
        unclassified,
        residentsInPurok.length,
        purok.households,
        `${getPercent(residentsInPurok.length, current.length)}%`,
      ];
    });

    const skParticipationRows = skField
      ? countRows(countBy(youthResidents, (resident) => getSkParticipationLabel(resident, skField)))
      : [];
    const skYouthRows = skField
      ? youthResidents
        .filter((resident) => getSkParticipationLabel(resident, skField) === "Participating")
        .map((resident) => [
          getResidentName(resident),
          getAge(resident) ?? "-",
          formatPurok(resident.purok),
          normalize(resident.civil_status, "-"),
          normalize(resident.occupation, "-"),
        ])
      : [];

    const residentDetailRows = current.map((resident) => [
      getResidentName(resident),
      getAge(resident) ?? "-",
      getGenderLabel(resident),
      normalize(resident.civil_status, "-"),
      formatPurok(resident.purok),
      getHouseholdLabel(resident),
    ]);
    const ageDetailRows = current.map((resident) => [
      getResidentName(resident),
      getAge(resident) ?? "-",
      getAgeDistributionLabel(resident),
      getGenderLabel(resident),
      formatPurok(resident.purok),
    ]);
    const genderDetailRows = current.map((resident) => [
      getResidentName(resident),
      getGenderLabel(resident),
      getAge(resident) ?? "-",
      formatPurok(resident.purok),
    ]);
    const civilStatusDetailRows = current.map((resident) => [
      getResidentName(resident),
      getCivilStatusLabel(resident),
      getAge(resident) ?? "-",
      getGenderLabel(resident),
      formatPurok(resident.purok),
    ]);
    const employmentDetailRows = current.map((resident) => [
      getResidentName(resident),
      getEmploymentStatusLabel(resident),
      normalize(resident.occupation, "-"),
      getAge(resident) ?? "-",
      formatPurok(resident.purok),
    ]);
    const educationalDetailRows = current.map((resident) => [
      getResidentName(resident),
      normalize(resident.educational_attainment, "-"),
      getEducationalGroupLabel(resident),
      getAge(resident) ?? "-",
      formatPurok(resident.purok),
    ]);
    const seniorListRows = seniors.map((resident) => [
      getResidentName(resident),
      getAge(resident) ?? "-",
      normalize(resident.civil_status, "-"),
      formatPurok(resident.purok),
    ]);
    const youthListRows = youthResidents.map((resident) => [
      getResidentName(resident),
      getAge(resident) ?? "-",
      getYouthAgeBandLabel(resident) || "Unclassified",
      getSkParticipationLabel(resident, skField) || "Not tracked",
      formatPurok(resident.purok),
    ]);
    const pwdListRows = pwdResidents.map((resident) => [
      getResidentName(resident),
      getAge(resident) ?? "-",
      getPWDTypeLabel(resident),
      formatPurok(resident.purok),
    ]);
    const soloParentRows = soloParents.map((resident) => [
      getResidentName(resident),
      getAge(resident) ?? "-",
      normalize(resident.civil_status, "-"),
      formatPurok(resident.purok),
    ]);

    return {
      current,
      seniors,
      youthResidents,
      pwdField,
      pwdAvailable,
      pwdCount,
      pwdResidents,
      familyProfile,
      householdGroups,
      skField,
      active: residents.filter((resident) => resident.status === "Active" && matchesPurokFilter(resident)),
      pending: residents.filter((resident) => resident.status === "Pending" && matchesPurokFilter(resident)),
      archived: residents.filter((resident) => resident.status === "Archived" && matchesPurokFilter(resident)),
      availablePuroks,
      genderRows,
      purokSummary,
      purokRows: purokSummary.map((purok) => [purok.label, purok.residents]),
      purokHouseholdRows: purokSummary.map((purok) => [purok.label, purok.households]),
      purokPopulationRows,
      ageRows,
      ageCategoryLabels,
      agePurokRows,
      civilStatusRows,
      civilStatusCategoryLabels,
      civilStatusPurokRows,
      educationalAttainmentRows,
      educationalAttainmentCategoryLabels,
      educationalAttainmentPurokRows,
      employmentStatusRows,
      employmentStatusCategoryLabels,
      employmentStatusPurokRows,
      residentDetailRows,
      ageDetailRows,
      genderDetailRows,
      genderCategoryLabels,
      genderPurokRows,
      civilStatusDetailRows,
      employmentDetailRows,
      educationalDetailRows,
      seniorAgeRows,
      seniorAgeCategoryLabels,
      seniorAgePurokRows,
      seniorPurokRows,
      seniorListRows,
      youthAgeRows,
      youthAgeCategoryLabels,
      youthAgePurokRows,
      youthPurokRows,
      youthListRows,
      skParticipationRows,
      skYouthRows,
      statusRows: countRows(countBy(residents, (resident) => resident.status)),
      pwdTypeRows,
      pwdTypeCategoryLabels,
      pwdTypePurokRows,
      pwdPurokRows,
      pwdListRows,
      soloParents,
      soloParentPurokRows,
      soloParentRows,
      householdRows,
      householdPurokRows,
    };
  }, [pwdColumnReady, residents, reportFilters.purok]);

  const selectedReportInfo = REPORT_TYPES.find((item) => item.key === selectedReport) || REPORT_TYPES[0];
  const selectedPurokLabel =
    reportFilters.purok === "all"
      ? ""
      : report.availablePuroks.find((purok) => purok.value === reportFilters.purok)?.label || "Selected Purok";
  const generatedOn = new Date();
  const generatedAt = generatedOn.toLocaleString();
  const reportYear = generatedOn.getFullYear();
  const toPrintRows = (rows, total) =>
    rows.map(([label, count]) => [label, count, `${getPercent(count, total)}%`]);
  const getCountFromRows = (rows, label) => rows.find(([rowLabel]) => rowLabel === label)?.[1] || 0;

  const populationSummaryRows = [
    ["Total residents", report.current.length],
    ["Total households", report.householdGroups.length],
    ["Puroks/Sitios", report.purokSummary.length],
    ["Male residents", getCountFromRows(report.genderRows, "Male")],
    ["Female residents", getCountFromRows(report.genderRows, "Female")],
    ["Archived records", report.archived.length],
  ];
  const seniorSummaryRows = [
    ["Senior citizens", report.seniors.length],
    ["Age groups", report.seniorAgeRows.length],
    ["Puroks/Sitios with seniors", report.seniorPurokRows.length],
    ["Listed senior records", report.seniorListRows.length],
  ];
  const youthSummaryRows = [
    ["Youth residents", report.youthResidents.length],
    ["Age groups", report.youthAgeRows.length],
    ["Puroks/Sitios with youth", report.youthPurokRows.length],
    ["Listed youth records", report.youthListRows.length],
  ];
  const categoryFooterRow = (label, rows, total) => [
    label,
    sumNumericColumn(rows, 1),
    total ? "100%" : "0%",
  ];
  const purokCategoryFooterRow = (categoryLabels, rows, total) => [
    "Total",
    ...categoryLabels.map((_, index) => sumNumericColumn(rows, index + 1)),
    total,
    total ? "100%" : "0%",
  ];
  const purokSexRows = report.purokSummary.map((purok) => {
    const totals = report.familyProfile.purokTotals[purok.value] || { male: 0, female: 0 };
    return [purok.label, totals.male, totals.female, totals.male + totals.female];
  });

  const handleExport = () => {
    const rowsByReport = {
      residents: [
        ["Metric", "Value"],
        ...populationSummaryRows,
        [],
        ["Purok", "Male", "Female", "Unclassified", "Total residents", "Households", "Percent"],
        ...report.purokPopulationRows,
        [],
        ["Age group", "Count", "Percent"],
        ...toPrintRows(report.ageRows, report.current.length),
        [],
        ["Gender", "Count", "Percent"],
        ...toPrintRows(report.genderRows, report.current.length),
        [],
        ["Name", "Age", "Gender", "Civil status", "Purok", "Household"],
        ...report.residentDetailRows,
      ],
      "age-distribution": [
        ["Age group", "Count", "Percent"],
        ...toPrintRows(report.ageRows, report.current.length),
        [],
        ["Name", "Age", "Age group", "Gender", "Purok"],
        ...report.ageDetailRows,
      ],
      "gender-distribution": [
        ["Gender", "Count", "Percent"],
        ...toPrintRows(report.genderRows, report.current.length),
        [],
        ["Name", "Gender", "Age", "Purok"],
        ...report.genderDetailRows,
      ],
      "civil-status": [
        ["Civil status", "Count", "Percent"],
        ...toPrintRows(report.civilStatusRows, report.current.length),
        [],
        ["Name", "Civil status", "Age", "Gender", "Purok"],
        ...report.civilStatusDetailRows,
      ],
      "employment-status": [
        ["Employment status", "Count", "Percent"],
        ...toPrintRows(report.employmentStatusRows, report.current.length),
        [],
        ["Name", "Employment status", "Occupation", "Age", "Purok"],
        ...report.employmentDetailRows,
      ],
      "educational-attainment": [
        ["Educational attainment", "Count", "Percent"],
        ...toPrintRows(report.educationalAttainmentRows, report.current.length),
        [],
        ["Name", "Educational attainment", "Group", "Age", "Purok"],
        ...report.educationalDetailRows,
      ],
      "senior-citizen": [
        ["Metric", "Value"],
        ...seniorSummaryRows,
        [],
        ["Name", "Age", "Civil Status", "Purok"],
        ...report.seniorListRows,
        [],
        ["Age band", "Count", "Percent"],
        ...toPrintRows(report.seniorAgeRows, report.seniors.length),
        [],
        ["Purok", "Count", "Percent"],
        ...toPrintRows(report.seniorPurokRows, report.seniors.length),
      ],
      "youth-profile": [
        ["Metric", "Value"],
        ...youthSummaryRows,
        [],
        ["Name", "Age", "Age group", "SK participation", "Purok"],
        ...report.youthListRows,
        [],
        ["Age group", "Count", "Percent"],
        ...toPrintRows(report.youthAgeRows, report.youthResidents.length),
        [],
        ["SK participation", "Count", "Percent"],
        ...toPrintRows(report.skParticipationRows, report.youthResidents.length),
        ...(report.skYouthRows.length
          ? [["Youth participating in SK programs", "Age", "Purok", "Civil status", "Occupation"], ...report.skYouthRows]
          : []),
      ],
      pwd: [
        ["Name", "Age", "Disability type", "Purok"],
        ...report.pwdListRows,
        [],
        ["Disability type", "Count", "Percent"],
        ...toPrintRows(report.pwdTypeRows, report.pwdResidents.length),
        [],
        ["Purok", "Count", "Percent"],
        ...toPrintRows(report.pwdPurokRows, report.pwdResidents.length),
      ],
      "solo-parent": [
        ["Name", "Age", "Civil Status", "Purok"],
        ...report.soloParentRows,
        [],
        ["Purok", "Count", "Percent"],
        ...toPrintRows(report.soloParentPurokRows, report.soloParents.length),
      ],
      "household-composition": [
        ["Household", "Household Head", "Members", "Purok"],
        ...report.householdRows,
        [],
        ["Purok", "Count", "Percent"],
        ...toPrintRows(report.householdPurokRows, report.householdGroups.length),
      ],
    };

    exportCsv(
      [
        ["Republic of the Philippines"],
        ["Province of Cotabato"],
        ["Municipality of Aleosan"],
        ["Barangay Upper Mingading"],
        [selectedReportInfo.title],
        ["Generated", generatedAt],
        ["Prepared by", BARANGAY_SECRETARY],
        ["Certified by", PUNONG_BARANGAY],
        [],
        ...(rowsByReport[selectedReport] || rowsByReport.residents),
      ],
      `kaagapai-${selectedReportInfo.filename}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleDownloadImage = async () => {
    const element = document.querySelector(".report-preview-workspace .report-layout-container") || document.querySelector(".report-layout-container");
    if (!element) {
      alert("Report preview container not found.");
      return;
    }
    
    setLoading(true);
    try {
      // Use html2canvas to capture the element
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff"
      });
      
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const filename = `${selectedReportInfo.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.png`;
      link.download = filename;
      link.href = imgData;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export image:", error);
      alert("Failed to export image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderPrintSummary = () => {
    let summaryItems;
    const title = `${selectedReportInfo.title} Summary`;

    switch (selectedReport) {
      case "residents":
        summaryItems = [
          { label: "Total Residents", value: report.current.length },
          { label: "Total Households", value: report.householdGroups.length },
          { label: "Total Male", value: getCountFromRows(report.genderRows, "Male") },
          { label: "Total Female", value: getCountFromRows(report.genderRows, "Female") },
          { label: "Total Puroks", value: report.purokSummary.length },
        ];
        break;
      case "age-distribution":
        summaryItems = [
          { label: "Children (0-12)", value: getCountFromRows(report.ageRows, "Children (0-12 years old)") },
          { label: "Youth (13-17)", value: getCountFromRows(report.ageRows, "Youth (13-17 years old)") },
          { label: "Young Adults (18-30)", value: getCountFromRows(report.ageRows, "Young Adults (18-30 years old)") },
          { label: "Adults (31-59)", value: getCountFromRows(report.ageRows, "Adults (31-59 years old)") },
          { label: "Senior Citizens (60+)", value: getCountFromRows(report.ageRows, "Senior Citizens (60 years old and above)") },
        ];
        break;
      case "gender-distribution":
        summaryItems = [
          { label: "Male Residents", value: getCountFromRows(report.genderRows, "Male") },
          { label: "Female Residents", value: getCountFromRows(report.genderRows, "Female") },
        ];
        break;
      case "civil-status":
        summaryItems = [
          { label: "Single", value: getCountFromRows(report.civilStatusRows, "Single") },
          { label: "Married", value: getCountFromRows(report.civilStatusRows, "Married") },
          { label: "Widowed", value: getCountFromRows(report.civilStatusRows, "Widowed") },
          { label: "Separated", value: getCountFromRows(report.civilStatusRows, "Separated") },
        ];
        break;
      case "employment-status":
        summaryItems = [
          { label: "Employed", value: getCountFromRows(report.employmentStatusRows, "Employed") },
          { label: "Unemployed", value: getCountFromRows(report.employmentStatusRows, "Unemployed") },
          { label: "Self-employed", value: getCountFromRows(report.employmentStatusRows, "Self-employed") },
          { label: "Students", value: getCountFromRows(report.employmentStatusRows, "Students") },
        ];
        break;
      case "educational-attainment":
        summaryItems = [
          { label: "Elementary Level", value: getCountFromRows(report.educationalAttainmentRows, "Elementary Level/Graduate") },
          { label: "High School Level", value: getCountFromRows(report.educationalAttainmentRows, "High School Level/Graduate") },
          { label: "College Level", value: getCountFromRows(report.educationalAttainmentRows, "College Level/Graduate") },
          { label: "Postgraduate Level", value: getCountFromRows(report.educationalAttainmentRows, "Postgraduate") },
        ];
        break;
      case "senior-citizen":
        summaryItems = [
          { label: "Total Seniors", value: report.seniors.length },
          { label: "60-64 years old", value: getCountFromRows(report.seniorAgeRows, "60-64 years old") },
          { label: "65-69 years old", value: getCountFromRows(report.seniorAgeRows, "65-69 years old") },
          { label: "70-74 years old", value: getCountFromRows(report.seniorAgeRows, "70-74 years old") },
          { label: "75-79 years old", value: getCountFromRows(report.seniorAgeRows, "75-79 years old") },
          { label: "80 years old & over", value: getCountFromRows(report.seniorAgeRows, "80 years old and above") },
        ];
        break;
      case "youth-profile":
        summaryItems = [
          { label: "Total Youth", value: report.youthResidents.length },
          { label: "13-17 years old", value: getCountFromRows(report.youthAgeRows, "13-17 years old") },
          { label: "18-30 years old", value: getCountFromRows(report.youthAgeRows, "18-30 years old") },
          { label: "SK Participating", value: getCountFromRows(report.skParticipationRows, "Participating") },
          { label: "SK Not Participating", value: getCountFromRows(report.skParticipationRows, "Not participating") },
        ];
        break;
      case "pwd":
        summaryItems = [
          { label: "Total PWD", value: report.pwdResidents.length },
        ];
        break;
      case "solo-parent":
        summaryItems = [
          { label: "Total Solo Parents", value: report.soloParents.length },
        ];
        break;
      case "household-composition":
        summaryItems = [
          { label: "Total Households", value: report.householdGroups.length },
          { label: "Total Members", value: report.current.length },
        ];
        break;
      default:
        return null;
    }

    return (
      <ReportSummary title={title} items={summaryItems} />
    );
  };

  const renderDemographicPrintSections = () => {
    switch (selectedReport) {
      case "age-distribution":
        return (
          <>
            <PrintSection
              title="Age Distribution by Purok/Sitio"
              headers={["Purok/Sitio", ...report.ageCategoryLabels, "Total", "Percent of residents"]}
              rows={report.agePurokRows}
              footerRows={[purokCategoryFooterRow(report.ageCategoryLabels, report.agePurokRows, report.current.length)]}
            />
            <PrintSection
              title="Age Distribution Breakdown"
              headers={["Age group", "Count", "Percent of residents"]}
              rows={toPrintRows(report.ageRows, report.current.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.ageRows, report.current.length), report.current.length)]}
            />
            <PrintPurokTotals rows={purokSexRows} />
          </>
        );
      case "gender-distribution":
        return (
          <>
            <PrintSection
              title="Gender Distribution by Purok/Sitio"
              headers={["Purok/Sitio", ...report.genderCategoryLabels, "Total", "Percent of residents"]}
              rows={report.genderPurokRows}
              footerRows={[purokCategoryFooterRow(report.genderCategoryLabels, report.genderPurokRows, report.current.length)]}
            />
            <PrintSection
              title="Gender Distribution Breakdown"
              headers={["Gender", "Count", "Percent of residents"]}
              rows={toPrintRows(report.genderRows, report.current.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.genderRows, report.current.length), report.current.length)]}
            />
            <PrintPurokTotals rows={purokSexRows} />
          </>
        );
      case "civil-status":
        return (
          <>
            <PrintSection
              title="Civil Status by Purok/Sitio"
              headers={["Purok/Sitio", ...report.civilStatusCategoryLabels, "Total", "Percent of residents"]}
              rows={report.civilStatusPurokRows}
              footerRows={[purokCategoryFooterRow(report.civilStatusCategoryLabels, report.civilStatusPurokRows, report.current.length)]}
            />
            <PrintSection
              title="Civil Status Breakdown"
              headers={["Civil status", "Count", "Percent of residents"]}
              rows={toPrintRows(report.civilStatusRows, report.current.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.civilStatusRows, report.current.length), report.current.length)]}
            />
          </>
        );
      case "employment-status":
        return (
          <>
            <PrintSection
              title="Employment Status by Purok/Sitio"
              headers={["Purok/Sitio", ...report.employmentStatusCategoryLabels, "Total", "Percent of residents"]}
              rows={report.employmentStatusPurokRows}
              footerRows={[purokCategoryFooterRow(report.employmentStatusCategoryLabels, report.employmentStatusPurokRows, report.current.length)]}
            />
            <PrintSection
              title="Employment Status Breakdown"
              headers={["Employment status", "Count", "Percent of residents"]}
              rows={toPrintRows(report.employmentStatusRows, report.current.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.employmentStatusRows, report.current.length), report.current.length)]}
            />
          </>
        );
      case "educational-attainment":
        return (
          <>
            <PrintSection
              title="Educational Attainment by Purok/Sitio"
              headers={["Purok/Sitio", ...report.educationalAttainmentCategoryLabels, "Total", "Percent of residents"]}
              rows={report.educationalAttainmentPurokRows}
              footerRows={[purokCategoryFooterRow(report.educationalAttainmentCategoryLabels, report.educationalAttainmentPurokRows, report.current.length)]}
            />
            <PrintSection
              title="Educational Attainment Breakdown"
              headers={["Educational attainment", "Count", "Percent of residents"]}
              rows={toPrintRows(report.educationalAttainmentRows, report.current.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.educationalAttainmentRows, report.current.length), report.current.length)]}
            />
          </>
        );
      case "senior-citizen":
        return (
          <>
            <PrintSection
              title="Senior Citizens by Purok/Sitio and Age Band"
              headers={["Purok/Sitio", ...report.seniorAgeCategoryLabels, "Total", "Percent of senior citizens"]}
              rows={report.seniorAgePurokRows}
              footerRows={[purokCategoryFooterRow(report.seniorAgeCategoryLabels, report.seniorAgePurokRows, report.seniors.length)]}
            />
            <PrintSection
              title="Senior Age Group Breakdown"
              headers={["Age band", "Count", "Percent of senior citizens"]}
              rows={toPrintRows(report.seniorAgeRows, report.seniors.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.seniorAgeRows, report.seniors.length), report.seniors.length)]}
            />
            <PrintSection
              title="Senior Citizens per Purok"
              headers={["Purok", "Count", "Percent of senior citizens"]}
              rows={toPrintRows(report.seniorPurokRows, report.seniors.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.seniorPurokRows, report.seniors.length), report.seniors.length)]}
            />
          </>
        );
      case "youth-profile":
        return (
          <>
            <PrintSection
              title="Youth Profile by Purok/Sitio and Age Band"
              headers={["Purok/Sitio", ...report.youthAgeCategoryLabels, "Total", "Percent of youth"]}
              rows={report.youthAgePurokRows}
              footerRows={[purokCategoryFooterRow(report.youthAgeCategoryLabels, report.youthAgePurokRows, report.youthResidents.length)]}
            />
            <PrintSection
              title="Youth Age Group Breakdown"
              headers={["Age group", "Count", "Percent of youth"]}
              rows={toPrintRows(report.youthAgeRows, report.youthResidents.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.youthAgeRows, report.youthResidents.length), report.youthResidents.length)]}
            />
            <PrintSection
              title="SK Participation Summary"
              headers={["Participation", "Count", "Percent of youth"]}
              rows={toPrintRows(report.skParticipationRows, report.youthResidents.length)}
              footerRows={
                report.skParticipationRows.length
                  ? [categoryFooterRow("Total", toPrintRows(report.skParticipationRows, report.youthResidents.length), report.youthResidents.length)]
                  : []
              }
              emptyText="No SK participation field is available."
            />
          </>
        );
      case "pwd":
        return (
          <>
            <PrintSection
              title="PWD Distribution by Purok/Sitio and Disability Type"
              headers={["Purok/Sitio", ...report.pwdTypeCategoryLabels, "Total", "Percent of PWD residents"]}
              rows={report.pwdTypePurokRows}
              footerRows={[purokCategoryFooterRow(report.pwdTypeCategoryLabels, report.pwdTypePurokRows, report.pwdResidents.length)]}
            />
            <PrintSection
              title="PWD Type Breakdown"
              headers={["Disability type", "Count", "Percent of PWD residents"]}
              rows={toPrintRows(report.pwdTypeRows, report.pwdResidents.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.pwdTypeRows, report.pwdResidents.length), report.pwdResidents.length)]}
            />
            <PrintSection
              title="PWD Distribution per Purok"
              headers={["Purok", "Count", "Percent of PWD residents"]}
              rows={toPrintRows(report.pwdPurokRows, report.pwdResidents.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.pwdPurokRows, report.pwdResidents.length), report.pwdResidents.length)]}
            />
          </>
        );
      case "solo-parent":
        return (
          <>
            <PrintSection
              title="Solo Parents per Purok"
              headers={["Purok", "Count", "Percent of solo parents"]}
              rows={toPrintRows(report.soloParentPurokRows, report.soloParents.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.soloParentPurokRows, report.soloParents.length), report.soloParents.length)]}
            />
          </>
        );
      case "household-composition":
        return (
          <>
            <PrintSection
              title="Household Distribution per Purok"
              headers={["Purok", "Count", "Percent of households"]}
              rows={toPrintRows(report.householdPurokRows, report.householdGroups.length)}
              footerRows={[categoryFooterRow("Total", toPrintRows(report.householdPurokRows, report.householdGroups.length), report.householdGroups.length)]}
            />
            <PrintPurokTotals rows={purokSexRows} />
          </>
        );
      case "residents":
      default:
        return (
          <>
            <PopulationMatrixSection familyProfile={report.familyProfile} puroks={report.purokSummary} />
            <PrintPurokTotals rows={purokSexRows} />
          </>
        );
    }
  };

  const renderDemographicScreenReport = () => {
    const commonStats = [
      { label: "Total Residents", value: report.current.length, icon: Users, tone: "green" },
      { label: "Total Households", value: report.householdGroups.length, icon: Users, tone: "green" },
      { label: "Puroks", value: report.purokSummary.length, icon: Users, tone: "gold" },
      { label: "Archived Records", value: report.archived.length, icon: Users, tone: "slate" },
    ];

    const DashboardShell = ({ stats, children }) => (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} icon={item.icon} tone={item.tone} />
          ))}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {children}
        </div>
      </>
    );

    switch (selectedReport) {
      case "age-distribution":
        return (
          <DashboardShell
            stats={[
              { label: "Total Residents", value: report.current.length, icon: Users, tone: "green" },
              { label: "Age Groups", value: report.ageRows.length, icon: Users, tone: "gold" },
              { label: "Children", value: getCountFromRows(report.ageRows, "Children (0-12 years old)"), icon: Users, tone: "slate" },
              { label: "Senior Citizens", value: getCountFromRows(report.ageRows, "Senior Citizens (60 years old and above)"), icon: Users, tone: "green" },
            ]}
          >
            <BarChartPanel title="Age Distribution" subtitle="Residents grouped by age category" rows={report.ageRows} />
            <BreakdownTable title="Age Distribution Summary" rows={report.ageRows} total={report.current.length} />
          </DashboardShell>
        );
      case "gender-distribution":
        return (
          <DashboardShell
            stats={[
              { label: "Total Residents", value: report.current.length, icon: Users, tone: "green" },
              { label: "Male", value: getCountFromRows(report.genderRows, "Male"), icon: Users, tone: "green" },
              { label: "Female", value: getCountFromRows(report.genderRows, "Female"), icon: Users, tone: "gold" },
              { label: "Gender Groups", value: report.genderRows.length, icon: Users, tone: "slate" },
            ]}
          >
            <PieChartPanel title="Gender Distribution" subtitle="Share of residents by recorded gender" rows={report.genderRows} />
            <BreakdownTable title="Gender Distribution Summary" rows={report.genderRows} total={report.current.length} />
          </DashboardShell>
        );
      case "civil-status":
        return (
          <DashboardShell
            stats={[
              { label: "Total Residents", value: report.current.length, icon: Users, tone: "green" },
              { label: "Single", value: getCountFromRows(report.civilStatusRows, "Single"), icon: Users, tone: "green" },
              { label: "Married", value: getCountFromRows(report.civilStatusRows, "Married"), icon: Users, tone: "gold" },
              { label: "Widowed", value: getCountFromRows(report.civilStatusRows, "Widowed"), icon: Users, tone: "slate" },
            ]}
          >
            <BarChartPanel title="Civil Status" subtitle="Residents grouped by civil status" rows={report.civilStatusRows} />
            <BreakdownTable title="Civil Status Summary" rows={report.civilStatusRows} total={report.current.length} />
          </DashboardShell>
        );
      case "employment-status":
        return (
          <DashboardShell
            stats={[
              { label: "Total Residents", value: report.current.length, icon: Users, tone: "green" },
              { label: "Employed", value: getCountFromRows(report.employmentStatusRows, "Employed"), icon: Briefcase, tone: "green" },
              { label: "Self-employed", value: getCountFromRows(report.employmentStatusRows, "Self-employed"), icon: Briefcase, tone: "gold" },
              { label: "Students", value: getCountFromRows(report.employmentStatusRows, "Students"), icon: Users, tone: "slate" },
            ]}
          >
            <BarChartPanel title="Employment Status" subtitle="Residents grouped by employment status" rows={report.employmentStatusRows} />
            <BreakdownTable title="Employment Status Summary" rows={report.employmentStatusRows} total={report.current.length} />
          </DashboardShell>
        );
      case "educational-attainment":
        return (
          <DashboardShell
            stats={[
              { label: "Total Residents", value: report.current.length, icon: Users, tone: "green" },
              { label: "Elementary", value: getCountFromRows(report.educationalAttainmentRows, "Elementary Level/Graduate"), icon: FileText, tone: "green" },
              { label: "High School", value: getCountFromRows(report.educationalAttainmentRows, "High School Level/Graduate"), icon: FileText, tone: "gold" },
              { label: "College", value: getCountFromRows(report.educationalAttainmentRows, "College Level/Graduate"), icon: FileText, tone: "slate" },
            ]}
          >
            <BarChartPanel title="Educational Attainment" subtitle="Residents grouped by highest attainment" rows={report.educationalAttainmentRows} />
            <BreakdownTable title="Educational Attainment Summary" rows={report.educationalAttainmentRows} total={report.current.length} />
          </DashboardShell>
        );
      case "senior-citizen":
        return (
          <DashboardShell
            stats={[
              { label: "Senior Citizens", value: report.seniors.length, icon: Users, tone: "green" },
              { label: "Age Bands", value: report.seniorAgeRows.length, icon: Users, tone: "gold" },
              { label: "Puroks", value: report.seniorPurokRows.length, icon: Users, tone: "slate" },
              { label: "Share of Residents", value: `${getPercent(report.seniors.length, report.current.length)}%`, icon: Users, tone: "green" },
            ]}
          >
            <BarChartPanel title="Senior Age Groups" subtitle="Senior citizens by age band" rows={report.seniorAgeRows} />
            <BreakdownTable title="Senior Citizens per Purok" rows={report.seniorPurokRows} total={report.seniors.length} />
          </DashboardShell>
        );
      case "youth-profile":
        return (
          <DashboardShell
            stats={[
              { label: "Youth Population", value: report.youthResidents.length, icon: Users, tone: "green" },
              { label: "Age Bands", value: report.youthAgeRows.length, icon: Users, tone: "gold" },
              { label: "SK Participating", value: report.skYouthRows.length, icon: Users, tone: "slate" },
              { label: "Tracked", value: report.skField ? "Yes" : "No", icon: Users, tone: "green" },
            ]}
          >
            <BarChartPanel title="Youth Age Groups" subtitle="Youth residents grouped by age band" rows={report.youthAgeRows} />
            <BreakdownTable title="SK Participation" rows={report.skParticipationRows} total={report.youthResidents.length} />
          </DashboardShell>
        );
      case "pwd":
        return (
          <DashboardShell
            stats={[
              { label: "PWD Residents", value: report.pwdResidents.length, icon: Accessibility, tone: "green" },
              { label: "Disability Types", value: report.pwdTypeRows.length, icon: Accessibility, tone: "gold" },
              { label: "Puroks", value: report.pwdPurokRows.length, icon: Accessibility, tone: "slate" },
              { label: "Tracked", value: report.pwdAvailable ? "Yes" : "No", icon: Accessibility, tone: "green" },
            ]}
          >
            <BarChartPanel title="PWD Type Breakdown" subtitle="PWD residents grouped by disability type" rows={report.pwdTypeRows} />
            <BreakdownTable title="PWD Distribution per Purok" rows={report.pwdPurokRows} total={report.pwdResidents.length} />
          </DashboardShell>
        );
      case "solo-parent":
        return (
          <DashboardShell
            stats={[
              { label: "Solo Parents", value: report.soloParents.length, icon: Users, tone: "green" },
              { label: "Puroks", value: report.soloParentPurokRows.length, icon: Users, tone: "gold" },
              { label: "Share of Residents", value: `${getPercent(report.soloParents.length, report.current.length)}%`, icon: Users, tone: "slate" },
              { label: "Tracked", value: report.soloParents.length > 0 ? "Yes" : "No", icon: Users, tone: "green" },
            ]}
          >
            <BarChartPanel title="Solo Parents per Purok" subtitle="Solo parent distribution by Purok/Sitio" rows={report.soloParentPurokRows} />
            <BreakdownTable title="Solo Parent Summary" rows={report.soloParentPurokRows} total={report.soloParents.length} />
          </DashboardShell>
        );
      case "household-composition":
        return (
          <DashboardShell
            stats={[
              { label: "Households", value: report.householdGroups.length, icon: Users, tone: "green" },
              { label: "Household Heads", value: report.householdRows.length, icon: Users, tone: "gold" },
              { label: "Puroks", value: report.householdPurokRows.length, icon: Users, tone: "slate" },
              { label: "Members", value: report.current.length, icon: Users, tone: "green" },
            ]}
          >
            <BarChartPanel title="Household Distribution" subtitle="Households grouped by Purok/Sitio" rows={report.householdPurokRows} />
            <BreakdownTable title="Household Distribution Summary" rows={report.householdPurokRows} total={report.householdGroups.length} />
          </DashboardShell>
        );
      case "residents":
      default:
        return (
          <DashboardShell stats={commonStats}>
            <BarChartPanel
              title="Population by Purok/Sitio"
              subtitle="Current resident count across barangay areas"
              rows={report.purokRows}
            />
            <PieChartPanel title="Gender Distribution" subtitle="Population share by recorded gender" rows={report.genderRows} />
            <BreakdownTable title="Population Summary" rows={populationSummaryRows.slice(0, 5)} total={report.current.length} />
            <BreakdownTable title="Age Distribution" rows={report.ageRows} total={report.current.length} />
          </DashboardShell>
        );
    }
  };

  const renderPrintReportSections = () => renderDemographicPrintSections();

  const renderScreenReport = () => renderDemographicScreenReport();

  const SelectedReportIcon = selectedReportInfo.icon;
  const activeOrientation = paperOrientation || (selectedReport === "residents" || selectedReport === "age-distribution" ? "landscape" : "portrait");

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      <Header title="Reports & Analytics" subtitle="Generate demographics and barangay data reports" />
      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 no-print">
        {/* Unified Workspace Panel */}
        <div className="gov-workspace-panel rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
          {/* Toolbar */}
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition duration-200 ${
                  activeTab === "analytics"
                    ? "bg-[#14532D] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <BarChart3 size={14} />
                Interactive Charts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition duration-200 ${
                  activeTab === "preview"
                    ? "bg-[#14532D] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <FileText size={14} />
                Print Preview (WYSIWYG)
              </button>
            </div>

            {/* Quick Actions (e.g. Export, Print) */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>

              {activeTab !== "analytics" && (
                <>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Download size={13} />
                    Download Image
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3e21] px-4.5 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  >
                    <Printer size={13} />
                    Print Report
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Direct Report Generator Filter Bar */}
          {activeTab === "analytics" && (
            <div className="border-b border-slate-200 bg-slate-50/50 p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Report Type</span>
                <select
                  value={selectedReport}
                  onChange={(event) => setSelectedReport(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-[#14532D]"
                >
                  {REPORT_TYPES.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Purok Filter</span>
                <select
                  value={reportFilters.purok}
                  onChange={(event) => setReportFilters((current) => ({ ...current, purok: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-[#14532D]"
                >
                  <option value="all">All Puroks/Sitios</option>
                  {report.availablePuroks.map((purok) => (
                    <option key={purok.value} value={purok.value}>{purok.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Date From</span>
                <input
                  type="date"
                  value={reportFilters.dateFrom}
                  onChange={(event) => setReportFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-[#14532D]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Date To</span>
                <input
                  type="date"
                  value={reportFilters.dateTo}
                  onChange={(event) => setReportFilters((current) => ({ ...current, dateTo: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-[#14532D]"
                />
              </label>

              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#14532D] hover:bg-[#0f3e21] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                <SlidersHorizontal size={13} />
                Generate Report
              </button>
            </div>
          )}

          {/* Main Data Area */}
          <div className="p-0">
            {message ? (
              <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                {message}
              </div>
            ) : null}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white">
                <RefreshCw size={32} className="animate-spin text-[#14532D] mb-3" />
                <p className="text-sm font-semibold text-slate-500">Querying database, please wait...</p>
              </div>
            ) : (
              /* Original Charts/Dashboard View */
              <div className="p-6 bg-slate-50">
                {renderScreenReport()}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* WYSIWYG Print Preview View — Fullscreen Floating at Root Level */}
      {!loading && activeTab === "preview" && (
        <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm" style={{ top: 0, left: 0 }}>
          {/* Control Sidebar */}
          <div className="w-80 shrink-0 bg-white border-r border-slate-200 p-5 space-y-5 report-controls overflow-y-auto">
            {/* Actions Header */}
            <div className="flex flex-col gap-2 pb-4 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-rose-600"
              >
                <X size={14} />
                Exit
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3e21] px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                <Printer size={13} />
                Print Report
              </button>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Download size={11} />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Download size={11} />
                  Image
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Report Settings</h3>
              
              <div className="space-y-4">
                {/* Select Report */}
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Report Module</span>
                  <select
                    value={selectedReport}
                    onChange={(e) => setSelectedReport(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-green-100"
                  >
                    {REPORT_TYPES.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </label>

                {/* Select Purok */}
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Purok/Sitio</span>
                  <select
                    value={reportFilters.purok}
                    onChange={(e) => setReportFilters((curr) => ({ ...curr, purok: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-green-100"
                  >
                    <option value="all">All Puroks/Sitios</option>
                    {report.availablePuroks.map((purok) => (
                      <option key={purok.value} value={purok.value}>{purok.label}</option>
                    ))}
                  </select>
                </label>

                {/* Paper Size */}
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Paper Standard</span>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-green-100"
                  >
                    <option value="a4">A4 (210mm × 297mm)</option>
                    <option value="letter">Letter (8.5" × 11")</option>
                  </select>
                </label>

                {/* Orientation */}
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Orientation</span>
                  <select
                    value={paperOrientation}
                    onChange={(e) => setPaperOrientation(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[#14532D] focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Auto (Recommended)</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>

                {/* Font Size Slider */}
                <label className="block space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                    <span>Font Size</span>
                    <span className="font-mono text-green-700">{fontSize}pt</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="14"
                    step="0.5"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14532D]"
                  />
                </label>

                {/* Spacing / Padding Slider */}
                <label className="block space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                    <span>Row Spacing</span>
                    <span className="font-mono text-green-700">{rowPadding}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rowPadding}
                    onChange={(e) => setRowPadding(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14532D]"
                  />
                </label>

                {/* Margins Slider */}
                <label className="block space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                    <span>Page Margins</span>
                    <span className="font-mono text-green-700">{margin}mm</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="25"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14532D]"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h4 className="text-[10px] font-bold uppercase text-slate-400">Live Statistics</h4>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500 font-semibold">Residents</div>
                  <div className="text-sm font-bold text-slate-800">{report.current.length}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500 font-semibold">Households</div>
                  <div className="text-sm font-bold text-slate-800">{report.householdGroups.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Sheet View — fullscreen scrollable area */}
          <div className="flex-1 report-preview-workspace overflow-auto" style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#64748b' }}>
            <ReportLayout paperSize={paperSize} orientation={activeOrientation} fontSize={fontSize} rowPadding={rowPadding} margin={margin}>
              <ReportHeader
                title={selectedReportInfo.title}
                year={reportYear}
                purokLabel={selectedPurokLabel}
              />
              
              {renderPrintReportSections()}
              {renderPrintSummary()}
              
              <ReportFooter
                preparedBy={BARANGAY_SECRETARY}
                certifiedBy={PUNONG_BARANGAY}
              />
            </ReportLayout>
          </div>
        </div>
      )}

      {/* Hidden Print Wrapper (Prints exactly the active layout, styled via index.css) */}
      <div className="hidden print:block">
        <ReportLayout paperSize={paperSize} orientation={activeOrientation} fontSize={fontSize} rowPadding={rowPadding} margin={margin}>
          <ReportHeader
            title={selectedReportInfo.title}
            year={reportYear}
            purokLabel={selectedPurokLabel}
          />
          
          {renderPrintReportSections()}
          {renderPrintSummary()}
          
          <ReportFooter
            preparedBy={BARANGAY_SECRETARY}
            certifiedBy={PUNONG_BARANGAY}
          />
        </ReportLayout>
      </div>
    </div>
  );
};

export default Analytics;
