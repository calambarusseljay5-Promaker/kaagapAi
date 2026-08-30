import { supabase } from "../lib/supabaseClient.js";
import { getOrganizationOfficials, getActiveCaptain, getActiveSecretary } from "./organizationService.js";

const TABLE = "document_templates";
const LOCAL_STORAGE_KEY = "kaagapai_custom_document_templates";

export const TEMPLATE_CATEGORIES = [
  "Certification",
  "Clearance",
  "Permit",
  "Request",
  "Endorsement",
  "Affidavit",
  "Other",
];

export const TEMPLATE_STATUSES = ["Active", "Inactive", "Archived"];

export const AVAILABLE_PLACEHOLDERS = [
  {
    category: "Resident Information",
    fields: [
      { token: "{{FULL_NAME}}", label: "Full Name", sample: "JUAN DELA CRUZ" },
      { token: "{{FIRST_NAME}}", label: "First Name", sample: "Juan" },
      { token: "{{MIDDLE_NAME}}", label: "Middle Name", sample: "Santos" },
      { token: "{{LAST_NAME}}", label: "Last Name", sample: "Dela Cruz" },
      { token: "{{SUFFIX}}", label: "Suffix", sample: "Jr." },
      { token: "{{AGE}}", label: "Age", sample: "35" },
      { token: "{{SEX}}", label: "Sex / Gender", sample: "Male" },
      { token: "{{CIVIL_STATUS}}", label: "Civil Status", sample: "Married" },
      { token: "{{DATE_OF_BIRTH}}", label: "Date of Birth", sample: "May 15, 1991" },
      { token: "{{PLACE_OF_BIRTH}}", label: "Place of Birth", sample: "Aleosan, Cotabato" },
      { token: "{{ADDRESS}}", label: "Full Address", sample: "Purok Kamonsil, Barangay Upper Mingading, Aleosan, Cotabato" },
      { token: "{{PUROK}}", label: "Purok / Sitio", sample: "Purok Kamonsil" },
      { token: "{{HOUSE_NO}}", label: "House No.", sample: "124" },
      { token: "{{HOUSEHOLD_NO}}", label: "Household No.", sample: "45" },
      { token: "{{OCCUPATION}}", label: "Occupation", sample: "Farmer" },
      { token: "{{EDUCATIONAL_ATTAINMENT}}", label: "Educational Attainment", sample: "High School Graduate" },
      { token: "{{NATIONALITY}}", label: "Nationality / Citizenship", sample: "Filipino" },
      { token: "{{RELIGION}}", label: "Religion", sample: "Roman Catholic" },
      { token: "{{VOTER_STATUS}}", label: "Voter Status", sample: "Registered Voter" },
    ],
  },
  {
    category: "Document Details",
    fields: [
      { token: "{{PURPOSE}}", label: "Purpose of Request", sample: "Employment and Identification requirements" },
      { token: "{{DATE}}", label: "Current Full Date", sample: "August 30, 2026" },
      { token: "{{DAY}}", label: "Day of Month", sample: "30th" },
      { token: "{{MONTH}}", label: "Current Month", sample: "August" },
      { token: "{{YEAR}}", label: "Current Year", sample: "2026" },
      { token: "{{DOCUMENT_NUMBER}}", label: "Document / Control No.", sample: "DOC-2026-0830" },
    ],
  },
  {
    category: "Barangay & Government Details",
    fields: [
      { token: "{{BARANGAY_NAME}}", label: "Barangay Name", sample: "Barangay Upper Mingading" },
      { token: "{{MUNICIPALITY}}", label: "Municipality", sample: "Aleosan" },
      { token: "{{PROVINCE}}", label: "Province", sample: "Cotabato" },
      { token: "{{BARANGAY_CAPTAIN}}", label: "Punong Barangay", sample: "MAMERTO C. CLARITO" },
      { token: "{{BARANGAY_SECRETARY}}", label: "Barangay Secretary", sample: "MARICEL C. PADAS" },
    ],
  },
];

const DEFAULT_TEMPLATES_CONTENT = {
  "Barangay Clearance": `
<p>This is to certify according to our existing records that Ms./<u>Mr</u>/Mrs. <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. Old, Filipino, <strong>{{CIVIL_STATUS}}</strong>, whose signature and thumbmark appear below is presently a resident of Purok <strong>{{PUROK}}</strong>, Upper Mingading, Aleosan, Cotabato and no current position in the Barangay.</p>
<p>This is to certify further, that their character, reputation and moral standing in the community are beyond reproach and that as of the date of this issued there is no pending case whatsoever filed against the above – named person for whatever any legal purpose which may serve them best.</p>
<p>This is to certify further more that in view of the foregoing circumstances, this Barangay Clearance is issued upon request of the above – named person for <strong>{{PURPOSE}}</strong> and whatever any legal purpose which may serve them best.</p>
<p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>
`,
  "Certificate of Residency": `
<p>THIS IS TO CERTIFY that <strong>{{FULL_NAME}}</strong>, <strong>{{SEX}}</strong>, <strong>{{CIVIL_STATUS}}</strong>, Filipino, a bona fide citizen of Purok <strong>{{PUROK}}</strong>, Upper Mingading, Aleosan, Cotabato. Their reputation and moral standing in the community is beyond reproach and that is no pending case filed on said person whatsoever. From our barangay peace and order committee we are recommending them <u>{{PURPOSE}}</u>.</p>
<p>This certification is issued upon the request of above-named person for whatever legal purpose it may serve best.</p>
<p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>
`,
  "Certificate of Indigency": `
<p>THIS IS TO CERTIFY that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old <strong>{{CIVIL_STATUS}}</strong> and a bonafide resident of Purok <strong>{{PUROK}}</strong>, Upper Mingading, Aleosan, Cotabato a low income earner family and considered as indigent.</p>
<p>This certification is issued upon the request of above-named person for <strong>{{PURPOSE}}</strong> and for whatever legal purpose it may serve best.</p>
<p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>
`,
  "Business Permit": `
<p>This is to certify that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old, Filipino, <strong>{{CIVIL_STATUS}}</strong>, a bona fide resident of Purok <strong>{{PUROK}}</strong>, Barangay Upper Mingading, Aleosan, Cotabato, and they have a <strong>{{BUSINESS_NAME}}</strong> at the said place.</p>
<p>This certification is being issued upon the request of the above-mentioned name person for Business Permit Application and for whatever any legal purposes may serve them best.</p>
<p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>
`,
  "RSBSA Certification": `
<p>THIS IS TO CERTIFY THAT <strong>{{FULL_NAME}}</strong> <strong>{{AGE}}</strong> y/o, residing at <strong>{{ADDRESS}}</strong>, Upper Mingading Aleosan, Cotabato, is tilling the following crop(s) <strong>{{CROPS_DETAILS}}</strong> as <u>Owner</u>/Farmer at Purok <strong>{{PUROK}}</strong>, Upper Mingading, Cotabato with size <strong>{{FARM_SIZE}}</strong>.</p>
<p>This <strong>CERTIFICATION</strong> is being issued by the Barangay solely for the purpose of the farmers and fisher folk registration to the <strong>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE (RSBSA)</strong> of the Department of Agriculture and may not be used for other purposes not mention above.</p>
`,
  "Solo Parent Certification": `
<p>This is to certify that <strong>{{FULL_NAME}}</strong> legal age, Filipino, <strong>{{CIVIL_STATUS}}</strong>, a bona fide resident of Purok <strong>{{PUROK}}</strong>, Barangay Upper Mingading, Aleosan, Cotabato.</p>
<p>This certification is being issued upon the request of the above-mentioned name person on application for solo parent due to <strong>{{SOLO_PARENT_REASON}}</strong> and whatever any legal intent may serve best.</p>
<p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>
`,
  "4Ps Certification": `
<p>This is to certify that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old, Filipino, <strong>{{CIVIL_STATUS}}</strong>, a bona fide resident of Purok <strong>{{PUROK}}</strong>, Barangay Upper Mingading, Aleosan, Cotabato.</p>
<p>This certification is being issued upon the request of the above-mentioned name person for <strong>{{PURPOSE}}</strong> and for whatever any legal purposes.</p>
<p>Issued this <u>{{DAY}}</u> day <u>of {{MONTH}}</u> <strong>{{YEAR}}</strong> at Barangay Upper Mingading, Aleosan, Cotabato.</p>
`,
};

const getLocalCustomTemplates = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setLocalCustomTemplates = (data) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data || {}));
  } catch (err) {
    console.warn("Unable to save local custom templates:", err);
  }
};

export const getSampleResidentData = () => {
  const captain = getActiveCaptain();
  const secretary = getActiveSecretary();
  const now = new Date();
  const day = now.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
      ? "nd"
      : day === 3 || day === 23
      ? "rd"
      : "th";

  return {
    full_name: "JUAN S. DELA CRUZ",
    first_name: "Juan",
    middle_name: "Santos",
    last_name: "Dela Cruz",
    suffix: "Jr.",
    age: "35",
    gender: "Male",
    sex: "Male",
    civil_status: "Married",
    birthday: "1991-05-15",
    birthplace: "Aleosan, Cotabato",
    address: "Purok Kamonsil, Barangay Upper Mingading, Aleosan, Cotabato",
    purok: "Kamonsil",
    house_no: "124",
    household_no: "45",
    occupation: "Farmer / Self-Employed",
    educational_attainment: "High School Graduate",
    nationality: "Filipino",
    religion: "Roman Catholic",
    voter_status: "Registered Voter",
    purpose: "Employment and Official Government Identification",
    date: now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    day: `${day}${suffix}`,
    month: now.toLocaleDateString("en-US", { month: "long" }),
    year: String(now.getFullYear()),
    document_number: `DOC-${now.getFullYear()}-${String(day).padStart(2, "0")}`,
    barangay_name: "Barangay Upper Mingading",
    municipality: "Aleosan",
    province: "Cotabato",
    barangay_captain: captain?.name || "MAMERTO C. CLARITO",
    barangay_secretary: secretary?.name || "MARICEL C. PADAS",
  };
};

export const replacePlaceholders = (templateContent = "", resident = {}, extra = {}) => {
  if (!templateContent) return "";
  const sample = getSampleResidentData();
  const data = { ...sample, ...resident, ...extra };

  let result = String(templateContent);

  const replacements = {
    "{{FULL_NAME}}": data.full_name || sample.full_name,
    "{{FIRST_NAME}}": data.first_name || sample.first_name,
    "{{MIDDLE_NAME}}": data.middle_name || sample.middle_name,
    "{{LAST_NAME}}": data.last_name || sample.last_name,
    "{{SUFFIX}}": data.suffix || "",
    "{{AGE}}": String(data.age ?? sample.age),
    "{{SEX}}": data.sex || data.gender || sample.sex,
    "{{GENDER}}": data.gender || data.sex || sample.gender,
    "{{CIVIL_STATUS}}": data.civil_status || sample.civil_status,
    "{{DATE_OF_BIRTH}}": data.birthday || sample.birthday,
    "{{BIRTHDAY}}": data.birthday || sample.birthday,
    "{{PLACE_OF_BIRTH}}": data.birthplace || sample.birthplace,
    "{{BIRTHPLACE}}": data.birthplace || sample.birthplace,
    "{{ADDRESS}}": data.address || sample.address,
    "{{PUROK}}": data.purok ? (data.purok.toLowerCase().startsWith("purok") ? data.purok : `Purok ${data.purok}`) : sample.purok,
    "{{HOUSE_NO}}": data.house_no || sample.house_no,
    "{{HOUSEHOLD_NO}}": data.household_no || sample.household_no,
    "{{OCCUPATION}}": data.occupation || sample.occupation,
    "{{EDUCATIONAL_ATTAINMENT}}": data.educational_attainment || sample.educational_attainment,
    "{{NATIONALITY}}": data.nationality || sample.nationality,
    "{{RELIGION}}": data.religion || sample.religion,
    "{{VOTER_STATUS}}": data.voter_status || sample.voter_status,
    "{{PURPOSE}}": data.purpose || sample.purpose,
    "{{DATE}}": data.date || sample.date,
    "{{DAY}}": data.day || sample.day,
    "{{MONTH}}": data.month || sample.month,
    "{{YEAR}}": data.year || sample.year,
    "{{DOCUMENT_NUMBER}}": data.document_number || sample.document_number,
    "{{BARANGAY_NAME}}": data.barangay_name || sample.barangay_name,
    "{{MUNICIPALITY}}": data.municipality || sample.municipality,
    "{{PROVINCE}}": data.province || sample.province,
    "{{BARANGAY_CAPTAIN}}": data.barangay_captain || sample.barangay_captain,
    "{{BARANGAY_SECRETARY}}": data.barangay_secretary || sample.barangay_secretary,
    "{{BUSINESS_NAME}}": data.business_name || "BANANA BUY AND SALE",
    "{{CROPS_DETAILS}}": data.crops_details || "Rice Field ½ hectare, and Fruits Crops 1 hectare",
    "{{FARM_SIZE}}": data.farm_size || "One ( 1 ) hectare",
    "{{SOLO_PARENT_REASON}}": data.solo_parent_reason || "death of her husband",
  };

  Object.entries(replacements).forEach(([token, value]) => {
    const regex = new RegExp(token.replace(/[{}]/g, "\\$&"), "gi");
    result = result.replace(regex, value);
  });

  return result;
};

const normalizeTemplate = (raw, index = 0) => {
  const id = raw.id || `tpl-local-${Date.now()}-${index}`;
  const name = raw.template_name || raw.document_type || "Untitled Template";
  const category = raw.category || (name.toLowerCase().includes("clearance") ? "Clearance" : name.toLowerCase().includes("permit") ? "Permit" : "Certification");
  const status = raw.status || "Active";
  const description = raw.description || "Official barangay document template.";
  const content = raw.content || DEFAULT_TEMPLATES_CONTENT[name] || `<p>This is to certify that <strong>{{FULL_NAME}}</strong> is a resident of <strong>{{ADDRESS}}</strong>.</p>`;
  const createdAt = raw.created_at || new Date().toISOString();
  const updatedAt = raw.updated_at || createdAt;

  return {
    ...raw,
    id,
    template_name: name,
    document_type: name,
    category,
    status,
    description,
    content,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

/**
 * Fetch all document templates with filtering
 */
export async function fetchDocumentTemplatesList({ search = "", status = "", category = "" } = {}) {
  let dbTemplates = [];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data)) {
      dbTemplates = data;
    }
  } catch (err) {
    console.warn("Database templates fetch notice:", err);
  }

  const localMap = getLocalCustomTemplates();
  const mergedMap = new Map();

  // First seed defaults if DB is empty
  if (dbTemplates.length === 0) {
    Object.keys(DEFAULT_TEMPLATES_CONTENT).forEach((name, i) => {
      const tpl = normalizeTemplate({ template_name: name }, i);
      mergedMap.set(tpl.id, tpl);
    });
  } else {
    dbTemplates.forEach((item, i) => {
      const normalized = normalizeTemplate(item, i);
      // Merge local overrides (like custom content or category if columns don't exist in DB)
      if (localMap[normalized.id]) {
        Object.assign(normalized, localMap[normalized.id]);
      }
      mergedMap.set(normalized.id, normalized);
    });
  }

  // Add any pure local templates
  Object.values(localMap).forEach((localTpl) => {
    if (!mergedMap.has(localTpl.id)) {
      mergedMap.set(localTpl.id, normalizeTemplate(localTpl));
    }
  });

  let list = Array.from(mergedMap.values());

  // Filter by Status
  if (status && status !== "All") {
    list = list.filter((item) => (item.status || "Active").toLowerCase() === status.toLowerCase());
  }

  // Filter by Category
  if (category && category !== "All") {
    list = list.filter((item) => (item.category || "").toLowerCase() === category.toLowerCase());
  }

  // Filter by Search Term
  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter(
      (item) =>
        (item.template_name || "").toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term) ||
        (item.description || "").toLowerCase().includes(term) ||
        (item.content || "").toLowerCase().includes(term)
    );
  }

  return list;
}

/**
 * Fetch statistics for template counts
 */
export async function fetchDocumentTemplateStats() {
  const all = await fetchDocumentTemplatesList();
  const active = all.filter((t) => (t.status || "Active").toLowerCase() === "active").length;
  const inactive = all.filter((t) => (t.status || "").toLowerCase() === "inactive").length;
  const archived = all.filter((t) => (t.status || "").toLowerCase() === "archived").length;

  return {
    total: all.length,
    active,
    inactive,
    archived,
  };
}

/**
 * Create a new template
 */
export async function createDocumentTemplate(payload) {
  const now = new Date().toISOString();
  const newTemplate = {
    template_name: payload.template_name?.trim() || "New Document Template",
    document_type: payload.template_name?.trim() || "New Document Template",
    category: payload.category || "Certification",
    description: payload.description?.trim() || "",
    status: payload.status || "Active",
    content: payload.content?.trim() || `<p>This is to certify that <strong>{{FULL_NAME}}</strong> is a bona fide resident of <strong>{{ADDRESS}}</strong>.</p>`,
    requirements: payload.requirements || "Valid ID; proof of residency; purpose of request",
    processing_time: payload.processing_time || "1 day",
    fee: payload.fee || "As assessed by barangay office",
    created_at: now,
    updated_at: now,
  };

  let savedRecord = null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([newTemplate])
      .select()
      .maybeSingle();

    if (!error && data) {
      savedRecord = normalizeTemplate(data);
    }
  } catch (err) {
    console.warn("Notice during Supabase template insert, falling back to persistent local storage:", err);
  }

  if (!savedRecord) {
    savedRecord = normalizeTemplate({
      ...newTemplate,
      id: `tpl-${Date.now()}`,
    });
  }

  // Always sync to local persistent cache
  const localMap = getLocalCustomTemplates();
  localMap[savedRecord.id] = savedRecord;
  setLocalCustomTemplates(localMap);

  return savedRecord;
}

/**
 * Update an existing template
 */
export async function updateDocumentTemplate(id, updates) {
  const now = new Date().toISOString();
  const payload = {
    ...updates,
    updated_at: now,
  };

  if (updates.template_name) {
    payload.document_type = updates.template_name;
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (!error && data) {
      const normalized = normalizeTemplate(data);
      const localMap = getLocalCustomTemplates();
      localMap[id] = normalized;
      setLocalCustomTemplates(localMap);
      return normalized;
    }
  } catch (err) {
    console.warn("Notice during Supabase template update, persisting to local storage:", err);
  }

  // Local fallback
  const localMap = getLocalCustomTemplates();
  const existing = localMap[id] || { id };
  const updated = normalizeTemplate({
    ...existing,
    ...payload,
  });
  localMap[id] = updated;
  setLocalCustomTemplates(localMap);

  return updated;
}

/**
 * Duplicate an existing template
 */
export async function duplicateDocumentTemplate(id) {
  const templates = await fetchDocumentTemplatesList();
  const source = templates.find((t) => t.id === id);

  if (!source) throw new Error("Template not found for duplication.");

  const copyPayload = {
    template_name: `${source.template_name} — Copy`,
    category: source.category,
    description: source.description ? `${source.description} (Copy)` : "Duplicated template.",
    status: "Active",
    content: source.content,
    requirements: source.requirements,
    processing_time: source.processing_time,
    fee: source.fee,
  };

  return createDocumentTemplate(copyPayload);
}

/**
 * Toggle template status (Active <-> Inactive)
 */
export async function toggleDocumentTemplateStatus(id, currentStatus) {
  const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
  return updateDocumentTemplate(id, { status: nextStatus });
}

/**
 * Archive a template (Soft Archive)
 */
export async function archiveDocumentTemplate(id) {
  return updateDocumentTemplate(id, { status: "Archived" });
}

/**
 * Permanently delete a template from system
 */
export async function deletePermanentDocumentTemplate(id) {
  try {
    await supabase.from(TABLE).delete().eq("id", id);
  } catch (err) {
    console.warn("Notice deleting from Supabase:", err);
  }
  const localMap = getLocalCustomTemplates();
  if (localMap[id]) {
    delete localMap[id];
    setLocalCustomTemplates(localMap);
  }
  return true;
}
