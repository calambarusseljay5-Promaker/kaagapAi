export const sexOptions = ["Male", "Female"];

export const purokDefinitions = [
  {
    value: "Kamonsil",
    label: "Kamonsil",
    color: "#2563eb",
    aliases: [
      "Kamonsil",
      "Purok Kamonsil",
      "Purok-Kamonsil",
      "Purok Kamonsil Upper Mingading, Aleosan, Cotabato",
      "Purok Kamonsil, Upper Mingading, Aleosan, Cotabato",
    ],
  },
  {
    value: "Payhod",
    label: "Payhod",
    color: "#16a34a",
    aliases: [
      "Payhod",
      "Purok Payhod",
      "Purok-Payhod",
      "Purok Payhod Upper Mingading, Aleosan, Cotabato",
      "Purok Payhod, Upper Mingading, Aleosan, Cotabato",
    ],
  },
  {
    value: "Muslim",
    label: "Muslim",
    color: "#f59e0b",
    aliases: [
      "Muslim",
      "Purok Muslim",
      "Purok-Muslim",
      "Purok Muslim Upper Mingading, Aleosan, Cotabato",
      "Purok Muslim, Upper Mingading, Aleosan, Cotabato",
    ],
  },
  {
    value: "Malipayon",
    label: "Malipayon",
    color: "#7c3aed",
    aliases: [
      "Malipayon",
      "Purok Malipayon",
      "Purok-Malipayon",
      "Purok Malipayon Upper Mingading, Aleosan, Cotabato",
      "Purok Malipayon, Upper Mingading, Aleosan, Cotabato",
    ],
  },
  {
    value: "Purok3",
    label: "Purok-3",
    color: "#dc2626",
    aliases: [
      "Purok3",
      "Purok-3",
      "Purok 3",
      "Purok-3 Upper Mingading, Aleosan, Cotabato",
      "Purok-3, Upper Mingading, Aleosan, Cotabato",
    ],
  },
  {
    value: "Buklod",
    label: "Buklod",
    color: "#0891b2",
    aliases: [
      "Buklod",
      "Purok Buklod",
      "Purok-Buklod",
      "Purok Buklod Upper Mingading, Aleosan, Cotabato",
      "Purok Buklod, Upper Mingading, Aleosan, Cotabato",
    ],
  },
  {
    value: "Azucena",
    label: "Azucena",
    color: "#db2777",
    aliases: [
      "Azucena",
      "Purok Azucena",
      "Purok-Azucena",
      "Purok Azucena Upper Mingading, Aleosan, Cotabato",
      "Purok Azucena, Upper Mingading, Aleosan, Cotabato",
    ],
  },
];

export const purokOptions = purokDefinitions.map((purok) => purok.value);

export const otherPurokDefinition = {
  value: "__other__",
  label: "Not in listed Puroks",
  color: "#64748b",
  aliases: [],
};

export const civilStatusOptions = [
  "Single",
  "Married",
  "Widow/Widower",
  "Separated",
  "Annulled",
  "Live-in",
];

export const educationalAttainmentOptions = [
  "No formal education",
  "Elementary level",
  "Elementary graduate",
  "High school level",
  "High school graduate",
  "Senior high school level",
  "Senior high school graduate",
  "Vocational",
  "College level",
  "College graduate",
  "Postgraduate",
];

export const householdRelationshipOptions = [
  "Head",
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Grandparent",
  "Grandchild",
  "Relative",
  "Boarder",
  "Other",
];

export const categoryFilterOptions = [
  { value: "", label: "All categories" },
  { value: "senior", label: "Senior citizens" },
  { value: "adult", label: "Adults" },
  { value: "youth", label: "Youth" },
  { value: "child", label: "Children" },
  { value: "4ps", label: "4Ps members" },
  { value: "solo_parent", label: "Solo parents" },
  { value: "pwd", label: "PWD/PWED" },
];

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizePurokKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function getPurokDefinition(value) {
  if (!value) return null;
  const rawStr = String(value).trim();
  const normalized = normalizePurokKey(rawStr);
  const stripped = normalized.replace(/^purok/, "");

  return (
    purokDefinitions.find((purok) =>
      purok.aliases.some((alias) => {
        const normAlias = normalizePurokKey(alias);
        const strippedAlias = normAlias.replace(/^purok/, "");
        return (
          normAlias === normalized ||
          normAlias === stripped ||
          (stripped && strippedAlias === stripped) ||
          (stripped && strippedAlias === normalized)
        );
      })
    ) || null
  );
}

export function normalizePurokValue(value) {
  return getPurokDefinition(value)?.value || String(value || "").trim();
}

export function formatPurok(value, fallback = "-") {
  if (!value) return fallback;
  return getPurokDefinition(value)?.label || String(value).trim() || fallback;
}

export function buildCompleteAddress(purokValue) {
  if (!purokValue) return "";
  const label = formatPurok(purokValue, "");
  if (!label) return "";
  return `Purok ${label}, Upper Mingading, Aleosan, Cotabato`;
}

export function getPurokColor(value) {
  return getPurokDefinition(value)?.color || "#64748b";
}

export function getPurokFilterAliases(value) {
  const definition = getPurokDefinition(value);
  return definition ? definition.aliases : [value].filter(Boolean);
}

export function buildPurokSummary(residents = [], options = {}) {
  const { includeOther = false } = options;
  const summary = purokDefinitions.map((purok) => ({
    ...purok,
    residents: 0,
    households: 0,
    householdKeys: new Set(),
  }));
  const summaryByValue = new Map(summary.map((purok) => [purok.value, purok]));
  const other = {
    ...otherPurokDefinition,
    residents: 0,
    households: 0,
    householdKeys: new Set(),
  };

  residents.forEach((resident) => {
    const definition = getPurokDefinition(resident?.purok);
    const item = definition ? summaryByValue.get(definition.value) : other;

    item.residents += 1;

    const householdKey = String(resident?.household_no || resident?.house_no || "").trim();
    if (householdKey) {
      item.householdKeys.add(householdKey);
    }
  });

  const result = summary.map(({ householdKeys, ...purok }) => ({
    ...purok,
    households: householdKeys.size,
  }));

  if (includeOther && other.residents > 0) {
    const { householdKeys, ...otherSummary } = other;
    result.push({
      ...otherSummary,
      households: householdKeys.size,
    });
  }

  return result;
}

export function calculateAge(birthday, referenceDate = new Date()) {
  const birthDate = normalizeDate(birthday);
  if (!birthDate) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = referenceDate.getMonth() - birthDate.getMonth();
  const dayDelta = referenceDate.getDate() - birthDate.getDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age >= 0 && age <= 130 ? age : null;
}

export function buildFullName({ first_name = "", middle_name = "", last_name = "" } = {}) {
  return [first_name, middle_name, last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function getResidentDisplayName(resident = {}) {
  return (
    buildFullName(resident) ||
    resident.full_name ||
    resident.name ||
    "Unnamed resident"
  );
}

export function getResidentAge(resident = {}) {
  return calculateAge(resident.birthday) ?? resident.age ?? null;
}

export function getAgeCategory(age) {
  if (age === null || age === undefined || age === "") return "Unclassified";
  const value = Number(age);
  if (!Number.isFinite(value)) return "Unclassified";
  if (value >= 60) return "Senior Citizen";
  if (value >= 31) return "Adult";
  if (value >= 15) return "Youth";
  return "Child";
}

export function getResidentCategoryTags(resident = {}) {
  const age = getResidentAge(resident);
  const tags = [getAgeCategory(age)];

  if (resident.is_4ps_member) tags.push("4Ps");
  if (resident.is_solo_parent) tags.push("Solo Parent");
  if (resident.is_pwd) tags.push("PWD/PWED");

  return tags.filter((tag) => tag && tag !== "Unclassified");
}

export function residentMatchesCategory(resident = {}, category = "") {
  if (!category) return true;

  const ageCategory = getAgeCategory(getResidentAge(resident)).toLowerCase();

  if (category === "senior") return ageCategory === "senior citizen";
  if (category === "adult") return ageCategory === "adult";
  if (category === "youth") return ageCategory === "youth";
  if (category === "child") return ageCategory === "child";
  if (category === "4ps") return Boolean(resident.is_4ps_member);
  if (category === "solo_parent") return Boolean(resident.is_solo_parent);
  if (category === "pwd") return Boolean(resident.is_pwd);

  return true;
}
