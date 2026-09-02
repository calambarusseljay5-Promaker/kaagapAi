export const sexOptions = ["Male", "Female"];

export const defaultPurokDefinitions = [
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

const PUROK_STORAGE_KEY = "kaagapai_barangay_custom_puroks";

export function getCustomPurokDefinitions() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PUROK_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = parsed
          .filter(
            (p) =>
              p &&
              typeof p === "object" &&
              p.label &&
              p.label !== "[object Object]" &&
              p.value &&
              p.value !== "objectObject" &&
              p.value !== "[object Object]"
          )
          .map((p, idx) => ({
            id: p.id || `purok_${p.value || idx}_${idx}`,
            value: String(p.value || "").trim().toLowerCase(),
            label: String(p.label || "").trim(),
            color: p.color || "#059669",
            aliases: Array.isArray(p.aliases) ? p.aliases : [p.label, `Purok ${p.label}`],
          }));

        if (clean.length > 0) {
          return clean;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to parse custom purok definitions:", e);
  }
  return defaultPurokDefinitions.map((p, idx) => ({
    ...p,
    id: p.id || `purok_default_${p.value || idx}`,
  }));
}

export function saveCustomPurokDefinitions(definitions) {
  try {
    if (typeof window !== "undefined") {
      const clean = (Array.isArray(definitions) ? definitions : [])
        .filter(
          (p) =>
            p &&
            typeof p === "object" &&
            p.label &&
            p.label !== "[object Object]" &&
            p.value &&
            p.value !== "objectObject" &&
            p.value !== "[object Object]"
        )
        .map((p, idx) => ({
          id: p.id || `purok_${p.value || idx}_${idx}`,
          value: String(p.value || "").trim().toLowerCase(),
          label: String(p.label || "").trim(),
          color: p.color || "#059669",
          aliases: Array.isArray(p.aliases) ? p.aliases : [p.label, `Purok ${p.label}`],
        }));

      localStorage.setItem(
        PUROK_STORAGE_KEY,
        JSON.stringify(clean.length > 0 ? clean : defaultPurokDefinitions)
      );
      window.dispatchEvent(new CustomEvent("kaagapai_puroks_changed", { detail: clean }));
    }
  } catch (e) {
    console.error("Failed to save custom puroks:", e);
  }
}

export function addCustomPurok(nameOrObj, color = "#059669") {
  let name = "";
  let purokColor = color || "#059669";

  if (typeof nameOrObj === "object" && nameOrObj !== null) {
    name = String(nameOrObj.name || nameOrObj.label || "").trim();
    purokColor = nameOrObj.color || purokColor;
  } else {
    name = String(nameOrObj || "").trim();
  }

  const cleanName = name.trim();
  if (!cleanName || cleanName === "[object Object]") {
    throw new Error("Please provide a valid Purok name.");
  }

  const current = getCustomPurokDefinitions();
  const value = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "") || cleanName.toLowerCase();
  if (
    current.some(
      (p) =>
        String(p.value).toLowerCase() === value ||
        String(p.label).toLowerCase() === cleanName.toLowerCase()
    )
  ) {
    throw new Error(`Purok "${cleanName}" already exists.`);
  }

  const newPurok = {
    id: `purok_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    value: value || cleanName,
    label: cleanName,
    color: purokColor,
    aliases: [cleanName, `Purok ${cleanName}`, `Purok-${cleanName}`],
  };

  const updated = [...current, newPurok];
  saveCustomPurokDefinitions(updated);
  return updated;
}

export function updateCustomPurok(oldValueOrObj, newNameOrObj, newColor) {
  let oldValue = "";
  let cleanName = "";
  let color = newColor;

  if (typeof oldValueOrObj === "object" && oldValueOrObj !== null) {
    oldValue = String(oldValueOrObj.value || oldValueOrObj.id || oldValueOrObj.label || "");
  } else {
    oldValue = String(oldValueOrObj || "");
  }

  if (typeof newNameOrObj === "object" && newNameOrObj !== null) {
    cleanName = String(newNameOrObj.name || newNameOrObj.label || "").trim();
    color = newNameOrObj.color || color;
  } else {
    cleanName = String(newNameOrObj || "").trim();
  }

  if (!cleanName || cleanName === "[object Object]") {
    throw new Error("Please provide a valid Purok name.");
  }

  const current = getCustomPurokDefinitions();
  const cleanOld = oldValue.trim().toLowerCase();
  const newValue = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "") || cleanName.toLowerCase();

  const updated = current.map((p) => {
    const isMatch =
      String(p.id || "").toLowerCase() === cleanOld ||
      String(p.value || "").toLowerCase() === cleanOld ||
      String(p.label || "").toLowerCase() === cleanOld;

    if (isMatch) {
      return {
        ...p,
        value: newValue,
        label: cleanName,
        color: color || p.color || "#059669",
        aliases: Array.from(
          new Set([...(p.aliases || []), cleanName, `Purok ${cleanName}`, `Purok-${cleanName}`])
        ),
      };
    }
    return p;
  });

  saveCustomPurokDefinitions(updated);
  return updated;
}

export function deleteCustomPurok(valueToDelete) {
  const target =
    typeof valueToDelete === "object" && valueToDelete !== null
      ? (valueToDelete.id || valueToDelete.value || valueToDelete.label || "")
      : String(valueToDelete || "");

  const cleanTarget = String(target).trim().toLowerCase();
  if (!cleanTarget) return getCustomPurokDefinitions();

  const current = getCustomPurokDefinitions();
  if (current.length <= 1) {
    throw new Error("You must have at least one Purok in the barangay.");
  }

  const updated = current.filter((p) => {
    const pVal = String(p.value || "").trim().toLowerCase();
    const pLabel = String(p.label || "").trim().toLowerCase();
    const pId = String(p.id || "").trim().toLowerCase();
    return pVal !== cleanTarget && pLabel !== cleanTarget && pId !== cleanTarget;
  });

  saveCustomPurokDefinitions(updated);
  return updated;
}

export function resetCustomPuroks() {
  saveCustomPurokDefinitions(defaultPurokDefinitions);
  return defaultPurokDefinitions;
}

// Proxied dynamically or current snapshot
export const purokDefinitions = defaultPurokDefinitions;

export function getPurokOptions() {
  return getCustomPurokDefinitions().map((p) => p.value);
}

export const purokOptions = defaultPurokDefinitions.map((purok) => purok.value);

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

export const standardOccupationOptions = [
  "Farmer",
  "Fisherman / Fisherfolk",
  "Vendor / Market Trader",
  "Driver (Tricycle / Jeepney / Habal-habal / Truck)",
  "Construction Worker / Carpenter / Laborer",
  "Housewife / Homemaker",
  "Self-Employed / Freelancer",
  "Private Employee",
  "Government Employee / Official",
  "Barangay Tanod / Barangay Worker",
  "Teacher / Educator",
  "Health Worker / BHW / Nurse",
  "Security Guard",
  "OFW (Overseas Filipino Worker)",
  "Business Owner / Entrepreneur",
  "Student",
  "Retired / Pensioner",
  "None / Unemployed",
  "Others (Please Specify)",
];

export const normalizeOccupationValue = (raw) => {
  if (!raw) return "";
  const occ = String(raw).trim();
  if (!occ) return "";

  // Filter out placeholder / invalid entries
  const lower = occ.toLowerCase().replace(/[._-]+$/, "").trim();
  const junk = new Set([
    "none", "occupation", "n/a", "na", "-", "--", "---", "null", "undefined",
    "others", "others (please specify)", "applicant", "armor", "on-temporary", "soldering"
  ]);
  if (junk.has(lower)) return "";

  // Standardize common typos, casing, and equivalent terms
  if (lower === "sudent" || lower === "student" || lower === "estudyante") return "Student";
  if (
    lower === "house wife" ||
    lower === "housewife" ||
    lower === "house keeper" ||
    lower === "housekeeper" ||
    lower === "housemaid" ||
    lower === "house helper" ||
    lower === "kasambahay" ||
    lower === "homemaker"
  ) {
    return "Housewife / Homemaker";
  }
  if (lower === "sales lady" || lower === "saleslady" || lower === "sales boy" || lower === "sales staff" || lower === "sales boy / ukay-ukay") {
    return "Sales Staff / Retail";
  }
  if (lower === "farmer" || lower === "farming" || lower === "magsasaka" || lower === "farmer / housekeeper") {
    return "Farmer";
  }
  if (lower === "farmer / ofw") {
    return "Farmer / OFW";
  }
  if (lower === "farmer / driver") {
    return "Farmer / Driver";
  }
  if (
    lower === "driver" ||
    lower === "passenger jeepney driver" ||
    lower === "truck driver" ||
    lower === "habal-habal driver" ||
    lower === "tricycle driver" ||
    lower === "delivery man"
  ) {
    return "Driver / Delivery";
  }
  if (lower === "ofw" || lower === "ofw seaman" || lower === "seaman") {
    return "OFW (Overseas Filipino Worker)";
  }
  if (
    lower === "goverment employee" ||
    lower === "government employee" ||
    lower === "brgy. leader / gov't employee" ||
    lower === "government employee / official" ||
    lower === "barangay kagawad" ||
    lower === "barangay treasurer" ||
    lower === "office of municipal" ||
    lower === "dswd staff"
  ) {
    return "Government / Barangay Worker";
  }
  if (lower === "cafgo" || lower === "cafgu") return "CAFGU";
  if (
    lower === "business man" ||
    lower === "business man0" ||
    lower === "businessman" ||
    lower === "business woman" ||
    lower === "businesswoman"
  ) {
    return "Businessman / Businesswoman";
  }
  if (
    lower === "sari-sari store" ||
    lower === "sari-sari store owner" ||
    lower === "improvised business / sari-sari store"
  ) {
    return "Sari-sari Store Owner";
  }
  if (lower === "police officer" || lower === "police" || lower === "retired police") {
    return "Police Officer";
  }
  if (lower === "soldier" || lower === "retired soldier") {
    return "Soldier / Military";
  }
  if (lower === "guard" || lower === "security guard") {
    return "Security Guard";
  }
  if (lower === "carpenter" || lower === "framer") {
    return "Carpenter";
  }
  if (
    lower === "construction" ||
    lower === "construction worker" ||
    lower === "builder" ||
    lower === "laborer" ||
    lower === "laborer / employment" ||
    lower === "laborer / farm worker" ||
    lower === "plantation worker" ||
    lower === "factory worker"
  ) {
    return "Construction Worker / Laborer";
  }
  if (
    lower === "vendor" ||
    lower === "fruit vendor" ||
    lower === "bag vendor" ||
    lower === "bag supplier" ||
    lower === "seller" ||
    lower === "online seller"
  ) {
    return "Vendor / Merchant";
  }
  if (
    lower === "job order staff" ||
    lower === "intelligence staff" ||
    lower === "procurement staff" ||
    lower === "work at office" ||
    lower === "employee" ||
    lower === "private employee" ||
    lower === "merchandising supervisor" ||
    lower === "bakery worker" ||
    lower === "day care worker" ||
    lower === "resort promoter" ||
    lower === "homebased" ||
    lower === "intern"
  ) {
    return "Private / Office Employee";
  }

  // Proper Title Case for any other custom occupations
  return occ
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const getUniqueCleanOccupations = (sourceList = []) => {
  const map = new Map();

  sourceList.forEach((item) => {
    const raw = typeof item === "string" ? item : item?.occupation;
    if (!raw) return;
    const clean = normalizeOccupationValue(raw);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (!map.has(key)) {
      map.set(key, clean);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
};

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

  const definitions = getCustomPurokDefinitions();
  return (
    definitions.find((purok) =>
      (purok.aliases || []).some((alias) => {
        const normAlias = normalizePurokKey(alias);
        const strippedAlias = normAlias.replace(/^purok/, "");
        return (
          normAlias === normalized ||
          normAlias === stripped ||
          (stripped && strippedAlias === stripped) ||
          (stripped && strippedAlias === normalized)
        );
      }) ||
      normalizePurokKey(purok.value) === normalized ||
      normalizePurokKey(purok.label) === normalized
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
  const definitions = getCustomPurokDefinitions();
  const summary = definitions.map((purok) => ({
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

export function buildFullName({ first_name = "", middle_name = "", last_name = "", suffix = "" } = {}) {
  return [first_name, middle_name, last_name, suffix]
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

export function getPortalUsername(resident) {
  if (!resident) return "-";
  let username =
    resident.portal_username ||
    resident.resident_account?.username ||
    resident.username ||
    (resident.email ? resident.email.split("@")[0] : "") ||
    resident.phone ||
    "";

  if (typeof username === "string" && username.includes("@")) {
    username = username.split("@")[0];
  }

  username = String(username || "").trim().toLowerCase();
  return username || "-";
}

export function getResidentPortalPassword(resident) {
  if (!resident) return "";
  return (
    resident.portal_password ||
    resident.plain_password ||
    resident.resident_account?.plain_password ||
    (Array.isArray(resident.resident_accounts) && resident.resident_accounts[0]?.plain_password) ||
    resident.password ||
    ""
  );
}

export function getPortalAccountStatus(resident) {
  return resident?.portal_account_status || resident?.resident_account?.account_status || "Active";
}
