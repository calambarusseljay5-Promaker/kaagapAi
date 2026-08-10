import { supabase } from "../lib/supabaseClient";
import { recordAuditEvent } from "./adminActivityService";

const ORGANIZATION_STORAGE_KEY = "kaagapai_barangay_organization";
const ORGANIZATION_TABLE = "organization_officials";
const SETUP_MESSAGE =
  "Organizational chart storage is missing in Supabase. Run supabase/fixes/add-organization-officials.sql in the Supabase SQL Editor, then save again.";

export const DEFAULT_ORGANIZATION_OFFICIALS = [
  {
    id: "captain",
    name: "MAMERTO C. CLARITO",
    position: "Punong Barangay / Captain",
    committee: "Executive Leadership",
    focusArea: "Barangay governance, council direction, and public service coordination.",
    contact: "",
    email: "",
    photoUrl: "",
    background:
      "Leads the barangay council, signs official actions, and coordinates programs for residents of Barangay Upper Mingading.",
    level: "captain",
    status: "Active",
  },
  {
    id: "secretary-jovelyn-c-cabaya",
    name: "Jovelyn C. Cabaya",
    position: "Barangay Secretary",
    committee: "Administrative Records",
    focusArea: "Records management, council documentation, minutes, and official correspondence.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Manages barangay records and supports official documentation for the council.",
    level: "staff",
    status: "Active",
  },
  {
    id: "treasurer-rosalie-c-calamba",
    name: "Rosalie C. Calamba",
    position: "Barangay Treasurer",
    committee: "Finance and Accountability",
    focusArea: "Barangay funds, collection records, financial documentation, and reporting support.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Handles barangay financial records and supports transparent fund management.",
    level: "staff",
    status: "Active",
  },
  {
    id: "sk-chairman-chrystophyr-b-trance",
    name: "Chrystophyr B. Trance",
    position: "SK Chairman",
    committee: "Sangguniang Kabataan",
    focusArea: "Youth development, sports, leadership, and Sangguniang Kabataan programs.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Leads youth-focused programs and represents the Sangguniang Kabataan in barangay initiatives.",
    level: "sk",
    status: "Active",
  },
  {
    id: "kagawad-wilson-boy-capon-pon",
    name: "Wilson Boy Capon Pon",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Community programs and barangay ordinance support.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-garry-bernal",
    name: "Garry Bernal",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Resident services and administrative coordination.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-juanito-c-talaman",
    name: "Juanito C. Talaman",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Local governance and barangay project support.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-loreto-c-calamba",
    name: "Loreto C. Calamba",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Community welfare and council operations.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-judy-c-cabaya",
    name: "Judy C. Cabaya",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Resident assistance and program monitoring.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-kobi-gandawali",
    name: "Kobi Gandawali",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Barangay initiatives and public service follow-through.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
    level: "kagawad",
    status: "Active",
  },
  {
    id: "kagawad-mercy-joy-c-calamba",
    name: "Mercy Joy C. Calamba",
    position: "Barangay Kagawad",
    committee: "Council Member",
    focusArea: "Community coordination and resident support.",
    contact: "",
    email: "",
    photoUrl: "",
    background: "Honorable member of the Sangguniang Barangay.",
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

    return savedOfficials;
  } catch (error) {
    throw normalizeSupabaseError(error);
  }
}
