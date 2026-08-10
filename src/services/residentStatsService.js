import { supabase } from "../lib/supabaseClient";
import { buildPurokSummary, getPurokDefinition, getResidentAge } from "../utils/residentProfile";

const RESIDENT_COLUMNS = "id,status,age,birthday,sex,gender,purok,household_no,house_no,is_pwd,is_solo_parent,is_4ps_member";

const normalizeText = (value, fallback = "Unknown") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const normalizeGender = (resident = {}) => {
  const value = normalizeText(resident.sex || resident.gender).toLowerCase();
  if (value.startsWith("m")) return "Male";
  if (value.startsWith("f")) return "Female";
  return "Unknown";
};

const countBy = (items, getKey) =>
  items.reduce((counts, item) => {
    const key = normalizeText(getKey(item));
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

const STATS_PAGE_SIZE = 1000;

export async function fetchResidentStats() {
  // Paginate to fetch ALL residents — Supabase caps each request at ~1000 rows
  const residents = [];
  let totalRecordCount = null;

  for (let from = 0; ; from += STATS_PAGE_SIZE) {
    const to = from + STATS_PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from("residents")
      .select(RESIDENT_COLUMNS, { count: from === 0 ? "exact" : undefined })
      .range(from, to);

    if (error) throw error;

    if (from === 0 && count != null) {
      totalRecordCount = count;
    }

    residents.push(...(data || []));

    if (!data || data.length < STATS_PAGE_SIZE) break;
  }

  if (totalRecordCount === null) {
    totalRecordCount = residents.length;
  }
  const currentResidents = residents.filter((resident) => resident.status !== "Archived");
  const seniorResidents = currentResidents.filter((resident) => {
    const age = getResidentAge(resident);
    return age !== null && age >= 60;
  });
  const pwdResidents = currentResidents.filter((resident) => Boolean(resident.is_pwd));
  const soloParentResidents = currentResidents.filter((resident) => Boolean(resident.is_solo_parent));
  const genderCounts = countBy(currentResidents, normalizeGender);
  const statusCounts = countBy(residents, (resident) => resident.status);
  const purokSummary = buildPurokSummary(currentResidents, { includeOther: true });
  const purokCounts = purokSummary.reduce((counts, purok) => {
    counts[purok.label] = purok.residents;
    return counts;
  }, {});
  const purokHouseholdCounts = purokSummary.reduce((counts, purok) => {
    counts[purok.label] = purok.households;
    return counts;
  }, {});

  const ageDistribution = {
    "Children (0-12)": 0,
    "Teens (13-19)": 0,
    "Young Adults (20-39)": 0,
    "Middle-aged (40-59)": 0,
    "Seniors (60+)": 0,
  };

  const anonymousResidents = [];

  currentResidents.forEach((res) => {
    const age = getResidentAge(res);
    const purokDef = getPurokDefinition(res.purok);
    
    // Push anonymized data for AI complex queries
    anonymousResidents.push({
      age: age !== null ? age : "Unknown",
      gender: normalizeGender(res),
      purok: purokDef ? purokDef.label : normalizeText(res.purok),
      status: normalizeText(res.status),
      isSenior: age !== null && age >= 60,
      isPWD: Boolean(res.is_pwd)
    });

    if (age === null || age < 0) return;
    if (age <= 12) ageDistribution["Children (0-12)"]++;
    else if (age <= 19) ageDistribution["Teens (13-19)"]++;
    else if (age <= 39) ageDistribution["Young Adults (20-39)"]++;
    else if (age <= 59) ageDistribution["Middle-aged (40-59)"]++;
    else ageDistribution["Seniors (60+)"]++;
  });

  return {
    loaded: true,
    totalRecords: totalRecordCount,
    currentResidents: currentResidents.length,
    activeResidents: currentResidents.filter((resident) => resident.status === "Active").length,
    pendingResidents: currentResidents.filter((resident) => resident.status === "Pending").length,
    archivedResidents: residents.filter((resident) => resident.status === "Archived").length,
    seniorCitizens: seniorResidents.length,
    pwdResidents: pwdResidents.length,
    soloParentResidents: soloParentResidents.length,
    maleResidents: genderCounts.Male || 0,
    femaleResidents: genderCounts.Female || 0,
    unknownGenderResidents: genderCounts.Unknown || 0,
    genderCounts,
    statusCounts,
    purokCounts,
    purokHouseholdCounts,
    purokSummary,
    ageDistribution,
    anonymousResidents,
  };
}
