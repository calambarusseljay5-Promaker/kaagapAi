import { supabase } from "../lib/supabaseClient.js";
import { recordAuditEvent } from "./adminActivityService.js";

const ORGANIZATION_STORAGE_KEY = "kaagapai_barangay_organization";
const ORGANIZATION_TABLE = "organization_officials";
const SETUP_MESSAGE =
  "Organizational chart storage is missing in Supabase. Run supabase/fixes/add-organization-officials.sql in the Supabase SQL Editor, then save again.";

export const DEFAULT_ORGANIZATION_OFFICIALS = [
  {
    id: "captain",
    name: "HON. MAMERTO C. CLARITO",
    position: "PUNONG BARANGAY",
    committee: "Executive Governance & Council Head",
    focusArea: "Barangay leadership, ordinances, and overall community administration.",
    contact: "(+63) 912-345-6789",
    email: "captain@uppermingading.gov.ph",
    photoUrl: "/barangay/officials/captain.jpg",
    background:
      "Presiding officer of the Sangguniang Barangay, leading local governance and public service initiatives in Barangay Upper Mingading.",
    level: "captain",
    status: "Active",
  },
  {
    id: "secretary-jovelyn-c-cabaya",
    name: "JOVELYN C. CABAYA",
    position: "SECRETARY",
    committee: "Records & Secretariat Services",
    focusArea: "Council session minutes, official barangay records, certifications, and administrative notices.",
    contact: "(+63) 923-456-7890",
    email: "secretary@uppermingading.gov.ph",
    photoUrl: "/barangay/officials/secretary-jovelyn-c-cabaya.jpg",
    background: "Custody of official barangay records, notices, session journals, and executive documentation.",
    level: "staff",
    status: "Active",
  },
  {
    id: "treasurer-rosalie-c-calamba",
    name: "ROSALIE C. CALAMBA",
    position: "TREASURER",
    committee: "Budget & Financial Management",
    focusArea: "Barangay fund custody, tax collections, financial reporting, and disbursement audits.",
    contact: "(+63) 934-567-8901",
    email: "treasurer@uppermingading.gov.ph",
    photoUrl: "/barangay/officials/treasurer-rosalie-c-calamba.jpg",
    background: "Responsible for financial administration, revenue collection, disbursements, and accountancy.",
    level: "staff",
    status: "Active",
  },
  {
    id: "sk-chairman-chrystophyr-b-trance",
    name: "HON. CHRYSTOPHYR B. TRASMONTE",
    position: "SK CHAIRMAN",
    committee: "Youth & Sports Development",
    focusArea: "Youth governance, leadership development, educational outreach, and sports programs.",
    contact: "(+63) 945-678-9012",
    email: "sk@uppermingading.gov.ph",
    photoUrl: "/barangay/officials/sk-chairman-chrystophyr-b-trance.jpg",
    background: "Leads the Katipunan ng Kabataan and Sangguniang Kabataan council for youth empowerment.",
    level: "sk",
    status: "Active",
  },
  {
    id: "kagawad-wilson-boy-capon-pon",
    name: "HON. WILSON C. CAPONPON",
    position: "KAGAWAD",
    committee: "Peace & Order / Public Safety",
    focusArea: "Barangay peace-keeping, tanod operations, disaster response, and neighborhood security.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-wilson-boy-capon-pon.jpg",
    background: "Honorable member of the Sangguniang Barangay, chair of peace and community order.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-garry-bernal",
    name: "HON. GARRY BERNAL",
    position: "KAGAWAD",
    committee: "Agriculture & Livelihood",
    focusArea: "Farming support, agricultural programs, livelihood generation, and food security.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-garry-bernal.jpg",
    background: "Honorable member of the Sangguniang Barangay, championing farming and local livelihood.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-judy-c-cabaya",
    name: "HON. JUDY C. CABAYA",
    position: "KAGAWAD",
    committee: "Health & Sanitation",
    focusArea: "Health center operations, medical assistance, sanitation drives, and nutrition.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-judy-c-cabaya.jpg",
    background: "Honorable member of the Sangguniang Barangay, supervising community health programs.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-kobi-gandawali",
    name: "HON. RUBEN M. BALAD",
    position: "KAGAWAD",
    committee: "Infrastructure & Public Works",
    focusArea: "Barangay road maintenance, streetlighting, water systems, and infrastructure development.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-kobi-gandawali.jpg",
    background: "Honorable member of the Sangguniang Barangay, overseeing infrastructure projects.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-juanito-c-talaman",
    name: "HON. JUANITO C. TALAMAN",
    position: "KAGAWAD",
    committee: "Education & Culture",
    focusArea: "Daycare support, educational assistance, cultural heritage, and community learning.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-juanito-c-talaman.jpg",
    background: "Honorable member of the Sangguniang Barangay, leading youth and community education.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-loreto-c-calamba",
    name: "HON. LORETO C. CALAMBA",
    position: "KAGAWAD",
    committee: "Finance, Ways & Means",
    focusArea: "Barangay budgeting oversight, tax ordinance compliance, and fiscal policies.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-loreto-c-calamba.jpg",
    background: "Honorable member of the Sangguniang Barangay, focusing on fiscal accountability.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-mercy-joy-c-calamba",
    name: "HON. MERCY JOY P. CALAMBA",
    position: "KAGAWAD",
    committee: "Women, Family & Social Welfare",
    focusArea: "Women empowerment, senior citizen welfare, child protection, and social services.",
    contact: "",
    email: "",
    photoUrl: "/barangay/officials/kagawad-mercy-joy-c-calamba.jpg",
    background: "Honorable member of the Sangguniang Barangay, advocate for women and family welfare.",
    level: "kagawad",
    status: "Active",
  },
];

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const normalizeSupabaseError = (error) => {
  const message = String(error?.message || "");

  if (
    error?.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes(ORGANIZATION_TABLE)
  ) {
    return new Error(SETUP_MESSAGE);
  }

  return error;
};

const mergeWithDefaults = (officials = []) =>
  DEFAULT_ORGANIZATION_OFFICIALS.map((defaultOfficial) => {
    const savedOfficial = officials.find((official) => official.id === defaultOfficial.id);
    return {
      termOfOffice: "2023 - 2026",
      address: "Barangay Upper Mingading, Aleosan, Cotabato",
      ...defaultOfficial,
      ...savedOfficial,
      photoUrl: savedOfficial?.photoUrl || defaultOfficial.photoUrl || "",
      id: defaultOfficial.id,
      level: defaultOfficial.level,
    };
  });

const preserveOfficialPhotos = (
  officials = [],
  fallbackOfficials = [],
  clearPhotoIds = new Set()
) => {
  const fallbackPhotoById = new Map(
    fallbackOfficials
      .filter((official) => official?.id && official?.photoUrl)
      .map((official) => [official.id, official.photoUrl])
  );

  return officials.map((official) => {
    if (official.photoUrl || clearPhotoIds.has(official.id)) {
      return official;
    }

    const fallbackPhoto = fallbackPhotoById.get(official.id);
    return fallbackPhoto ? { ...official, photoUrl: fallbackPhoto } : official;
  });
};

const persistLocalOfficials = (officials = []) => {
  const storage = getStorage();
  if (storage) {
    storage.setItem(ORGANIZATION_STORAGE_KEY, JSON.stringify(officials));
  }
};

const readLocalOfficials = () => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(ORGANIZATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const fromDbOfficial = (official = {}) => ({
  id: official.id,
  name: official.name,
  position: official.position,
  committee: official.committee || "",
  focusArea: official.focus_area || "",
  contact: official.contact || "",
  email: official.email || "",
  photoUrl: official.photo_url || "",
  background: official.background || "",
  level: official.level,
  status: official.status || "Active",
  termOfOffice: official.term_of_office || "2023 - 2026",
  address: official.address || "Barangay Upper Mingading, Aleosan, Cotabato",
  updatedAt: official.updated_at,
});

const toDbOfficial = (official = {}, index = 0) => ({
  id: official.id,
  name: String(official.name || "").trim(),
  position: String(official.position || "").trim(),
  committee: String(official.committee || "").trim() || null,
  focus_area: String(official.focusArea || "").trim() || null,
  contact: String(official.contact || "").trim() || null,
  email: String(official.email || "").trim() || null,
  photo_url: official.photoUrl || null,
  background: String(official.background || "").trim() || null,
  level: official.level,
  status: official.status || "Active",
  sort_order: index,
  updated_at: new Date().toISOString(),
});

export function getOrganizationOfficials() {
  return mergeWithDefaults(readLocalOfficials());
}

export function getActiveCaptain(officials = null) {
  const list = officials?.length ? officials : getOrganizationOfficials();
  const captain = list.find((o) => o.level === "captain" || /captain|punong barangay/i.test(o.position || ""));
  return captain?.name || "HON. MAMERTO C. CLARITO";
}

export function getActiveSecretary(officials = null) {
  const list = officials?.length ? officials : getOrganizationOfficials();
  const sec = list.find((o) => /secretary/i.test(o.position || "") || o.id?.includes("secretary"));
  return sec?.name || "JOVELYN C. CABAYA";
}

export function getActiveTreasurer(officials = null) {
  const list = officials?.length ? officials : getOrganizationOfficials();
  const treas = list.find((o) => /treasurer/i.test(o.position || "") || o.id?.includes("treasurer"));
  return treas?.name || "ROSALIE C. CALAMBA";
}

export function getActiveSKChairman(officials = null) {
  const list = officials?.length ? officials : getOrganizationOfficials();
  const sk = list.find((o) => /sk chairman/i.test(o.position || "") || o.level === "sk");
  return sk?.name || "HON. CHRYSTOPHYR B. TRASMONTE";
}

export function getActiveKagawads(officials = null) {
  const list = officials?.length ? officials : getOrganizationOfficials();
  return list.filter((o) => o.level === "kagawad" || /kagawad/i.test(o.position || ""));
}

export async function fetchOrganizationOfficials() {
  try {
    const localOfficials = readLocalOfficials();
    const { data, error } = await supabase
      .from(ORGANIZATION_TABLE)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    if (!data?.length) {
      const officials = mergeWithDefaults(localOfficials);

      if (localOfficials.length) {
        try {
          return await saveOrganizationOfficials(officials);
        } catch {
          return officials;
        }
      }

      return officials;
    }

    const databaseOfficials = mergeWithDefaults(data.map(fromDbOfficial));
    const officials = preserveOfficialPhotos(databaseOfficials, localOfficials);
    persistLocalOfficials(officials);

    const recoveredLocalPhotos = officials.some(
      (official) =>
        official.photoUrl &&
        !databaseOfficials.find((databaseOfficial) => databaseOfficial.id === official.id)
          ?.photoUrl
    );

    if (recoveredLocalPhotos) {
      try {
        return await saveOrganizationOfficials(officials);
      } catch {
        return officials;
      }
    }

    return officials;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function saveOrganizationOfficials(
  officials = [],
  { clearPhotoIds = [] } = {}
) {
  const clearPhotoIdSet = new Set(clearPhotoIds);
  const localOfficials = readLocalOfficials();
  let nextOfficials = preserveOfficialPhotos(
    mergeWithDefaults(officials),
    localOfficials,
    clearPhotoIdSet
  ).map((official) => ({
    ...official,
    updatedAt: new Date().toISOString(),
  }));

  persistLocalOfficials(nextOfficials);

  try {
    const { data: existingRows, error: existingRowsError } = await supabase
      .from(ORGANIZATION_TABLE)
      .select("id,photo_url");

    if (existingRowsError) throw existingRowsError;

    nextOfficials = preserveOfficialPhotos(
      nextOfficials,
      (existingRows || []).map(fromDbOfficial),
      clearPhotoIdSet
    );
    persistLocalOfficials(nextOfficials);

    const { data, error } = await supabase
      .from(ORGANIZATION_TABLE)
      .upsert(nextOfficials.map(toDbOfficial), { onConflict: "id" })
      .select()
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const savedOfficials = mergeWithDefaults(data.map(fromDbOfficial));
    persistLocalOfficials(savedOfficials);

    recordAuditEvent({
      module: "Organizational Chart",
      action: "Officials saved",
      details: `${savedOfficials.length} barangay official profiles were updated.`,
      source: "Database",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("organization_officials_updated", { detail: savedOfficials }));
    }

    return savedOfficials;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}

export async function resetOrganizationOfficials({ preservePhotos = true } = {}) {
  const localOfficials = readLocalOfficials();

  try {
    const { data: existingRows, error: existingRowsError } = await supabase
      .from(ORGANIZATION_TABLE)
      .select("id,photo_url");

    if (existingRowsError) throw existingRowsError;

    const photoFallbacks = preserveOfficialPhotos(
      mergeWithDefaults((existingRows || []).map(fromDbOfficial)),
      localOfficials
    );
    const defaultOfficials = (
      preservePhotos
        ? preserveOfficialPhotos(
            DEFAULT_ORGANIZATION_OFFICIALS.map((official) => ({ ...official })),
            photoFallbacks
          )
        : DEFAULT_ORGANIZATION_OFFICIALS
    ).map((official) => ({
      ...official,
      updatedAt: new Date().toISOString(),
    }));

    persistLocalOfficials(defaultOfficials);

    const { data, error } = await supabase
      .from(ORGANIZATION_TABLE)
      .upsert(defaultOfficials.map(toDbOfficial), { onConflict: "id" })
      .select()
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const savedOfficials = mergeWithDefaults(data.map(fromDbOfficial));
    persistLocalOfficials(savedOfficials);

    recordAuditEvent({
      module: "Organizational Chart",
      action: "Officials reset",
      details: preservePhotos
        ? "Barangay official profiles were restored to defaults while preserving photos."
        : "Barangay official profiles were restored to defaults.",
      source: "Database",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("organization_officials_updated", { detail: savedOfficials }));
    }

    return savedOfficials;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}
