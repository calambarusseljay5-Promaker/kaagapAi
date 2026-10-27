export const BARANGAY_SEAL_SRC = "/logo.png";
export const PUNONG_BARANGAY = "MAMERTO C. CLARITO";
export const DEFAULT_PREPARED_BY = "";

export const normalizeDocumentTemplateText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const DOCUMENT_TYPE_REQUIREMENTS = {
  clearance: {
    title: "Barangay Clearance",
    fee: "₱50.00",
    processingTime: "1 Working Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current calendar year Cedula", required: true },
      { name: "Valid Government-Issued ID", note: "PhilSys National ID, Voter's ID, Driver's License, or Postal ID", required: true },
      { name: "Proof of Residency", note: "Verified residency record in Barangay Upper Mingading", required: true },
      { name: "Recent 1x1 or 2x2 Photo", note: "White background (or captured on-site)", required: false },
    ],
  },
  residency: {
    title: "Certificate of Residency",
    fee: "Free / ₱50.00",
    processingTime: "1 Working Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula issued to applicant", required: true },
      { name: "Valid Government ID or Resident ID", note: "Must indicate residential address", required: true },
      { name: "Purok Verification / Clearance", note: "Proof of at least 6 months continuous residency in the Purok", required: true },
    ],
  },
  indigency: {
    title: "Certificate of Indigency",
    fee: "Free of Charge (Libre)",
    processingTime: "Same Day / 1 Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula (Free/Exempted for qualified indigents)", required: true },
      { name: "Valid Government ID or Resident ID", note: "Photocopy with original shown for verification", required: true },
      { name: "Purok Leader Indigent Endorsement", note: "Attestation of low or no regular family income", required: true },
      { name: "Supporting Assistance Document", note: "Hospital bill, doctor's prescription, burial doc, or school assessment", required: true },
    ],
  },
  business: {
    title: "Barangay Business Clearance / Permit",
    fee: "₱150.00 - ₱300.00",
    processingTime: "1 to 2 Working Days",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current Cedula of Business Owner / Proprietor", required: true },
      { name: "Valid Government ID of Owner", note: "Government-issued photo identification", required: true },
      { name: "Business Name Registration (DTI / SEC)", note: "Certificate of Business Name Registration", required: true },
      { name: "Contract of Lease or Land Title", note: "Proof of business location and tenancy", required: true },
      { name: "Previous Year Permit", note: "For business clearance renewal", required: false },
    ],
  },
  solo: {
    title: "Solo Parent Certification",
    fee: "Free of Charge (Libre)",
    processingTime: "1 Working Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula of the Solo Parent", required: true },
      { name: "Valid Government ID", note: "Photo ID of applicant", required: true },
      { name: "PSA Birth Certificate(s) of Dependent(s)", note: "Children below 18 years old or disabled dependents", required: true },
      { name: "Proof of Solo Parent Status", note: "Spouse Death Certificate, legal separation, or abandonment affidavit", required: true },
      { name: "Purok Leader Certification", note: "Proof of solo parent status in the purok", required: true },
    ],
  },
  "4ps": {
    title: "4Ps Certification",
    fee: "Free of Charge (Libre)",
    processingTime: "Same Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula of the 4Ps household representative", required: true },
      { name: "Valid Government ID", note: "Valid photo ID of grantee", required: true },
      { name: "4Ps Pantawid Pamilya ID / Card", note: "DSWD Household ID card", required: true },
      { name: "Proof for Change Grantee (if applicable)", note: "Spouse abroad contract/passport or death certificate", required: false },
    ],
  },
  rsbsa: {
    title: "RSBSA Farmer Certification",
    fee: "Free of Charge (Libre)",
    processingTime: "1 Working Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula of the farmer", required: true },
      { name: "Valid Government ID", note: "Government-issued ID", required: true },
      { name: "RSBSA Registration Reference / Stub", note: "Registry System for Basic Sectors in Agriculture", required: true },
      { name: "Proof of Land / Farm Tenure", note: "Land title, Tax declaration, or Certificate of Tenancy", required: true },
    ],
  },
  rsba: {
    title: "RSBA Farmer Certification",
    fee: "Free of Charge (Libre)",
    processingTime: "1 Working Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula of the farmer", required: true },
      { name: "Valid Government ID", note: "Government-issued ID", required: true },
      { name: "RSBSA Registration Reference / Stub", note: "Registry System for Basic Sectors in Agriculture", required: true },
      { name: "Proof of Land / Farm Tenure", note: "Land title, Tax declaration, or Certificate of Tenancy", required: true },
    ],
  },
  certification: {
    title: "Barangay Certification",
    fee: "Free of Charge (Libre)",
    processingTime: "Same Day / 1 Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula", required: true },
      { name: "Valid Government ID", note: "Valid photo ID", required: true },
      { name: "Supporting Documents for Stated Purpose", note: "Documents verifying reason for request (e.g. 4Ps card)", required: true },
    ],
  },
  general: {
    title: "Barangay Certification",
    fee: "₱50.00 / Free depending on purpose",
    processingTime: "1 Working Day",
    items: [
      { name: "Community Tax Certificate (Cedula)", note: "Current year Cedula", required: true },
      { name: "Valid Government ID", note: "1 valid government-issued ID", required: true },
      { name: "Supporting Documents for Stated Purpose", note: "Documents verifying reason for request", required: true },
    ],
  },
};

export const REAL_DOCUMENT_TEMPLATES = [
  {
    id: "real-business-permit",
    template_name: "Business Permit",
    document_type: "Business Permit",
    description: "Barangay certification for business permit application and local business verification.",
    requirements: "Community Tax Certificate (Cedula) of Business Owner; Valid ID of Proprietor; DTI/SEC Business Name Registration; Contract of Lease or Proof of Land Ownership",
    processing_time: "1 to 2 days",
    fee: "₱150.00 - ₱300.00",
    template_file_path: "/files/document-templates/Cert.BUSINESS-Permit.docx",
  },
  {
    id: "real-barangay-certification",
    template_name: "4Ps Certification",
    document_type: "4Ps Certification",
    description: "Official barangay certification for 4Ps, change grantee, or general legal purposes.",
    requirements: "Community Tax Certificate (Cedula); Valid Government ID; 4Ps Pantawid Pamilya ID card or supporting documents",
    processing_time: "Same day",
    fee: "Free of Charge (Libre)",
    template_file_path: "/files/document-templates/Barangay-Cert.templates.-4ps.docx",
  },
  {
    id: "real-barangay-clearance",
    template_name: "Barangay Clearance",
    document_type: "Barangay Clearance",
    description: "Official barangay clearance based on existing barangay records.",
    requirements: "Community Tax Certificate (Cedula) for the current year; Valid Government ID (PhilSys/Voter's/Postal); Proof of Residency in Barangay Upper Mingading",
    processing_time: "1 day",
    fee: "₱50.00",
    template_file_path: "/files/document-templates/cert.barangay-clearance.docx",
  },
  {
    id: "real-certificate-residency",
    template_name: "Certificate of Residency",
    document_type: "Certificate of Residency",
    description: "Certifies that the requester is a bona fide resident of Barangay Upper Mingading.",
    requirements: "Community Tax Certificate (Cedula); Valid ID or Barangay ID showing current address; Purok verification of at least 6 months continuous residency",
    processing_time: "1 day",
    fee: "Free / ₱50.00",
    template_file_path: "/files/document-templates/Cert.Residency-Templates.docx",
  },
  {
    id: "real-rsbsa-certification",
    template_name: "RSBA",
    document_type: "RSBA",
    description: "Certification for farmers and fisherfolk RSBSA registration.",
    requirements: "Community Tax Certificate (Cedula); Valid Government ID; RSBSA Farmer Registration Reference; Proof of Farm Ownership or Certificate of Land Tenancy",
    processing_time: "1 day",
    fee: "Free of Charge (Libre)",
    template_file_path: "/files/document-templates/cert.Rsbsa-templates.docx",
  },
  {
    id: "real-certificate-indigency",
    template_name: "Certificate of Indigency",
    document_type: "Certificate of Indigency",
    description: "Certifies low-income or indigent status for assistance and official requirements.",
    requirements: "Community Tax Certificate (Cedula); Valid Government ID; Purok Leader endorsement of indigent status; Supporting medical prescription, hospital bill, or school assessment",
    processing_time: "Same day",
    fee: "Free of Charge (Libre)",
    template_file_path: "/files/document-templates/Cert.indigency-templates.docx",
  },
  {
    id: "real-solo-parent-certification",
    template_name: "Solo Parent Certificate",
    document_type: "Solo Parent Certificate",
    description: "Barangay certification supporting solo parent application or related legal purpose.",
    requirements: "Community Tax Certificate (Cedula); Valid Government ID; PSA Birth Certificate of dependent child/children; Death Certificate of spouse, legal separation, or abandonment affidavit",
    processing_time: "1 day",
    fee: "Free of Charge (Libre)",
    template_file_path: "/files/document-templates/Cert.-solo-parent-Templates.docx",
  },
];

const LEGACY_TEMPLATE_KEYS = new Set(
  [
    "Clearance",
    "Residency Certificate",
    "ID Card",
    "Good Moral Certificate",
    "Travel Authority",
    "NBI Clearance",
    "NBI Clearance Request",
    "Business Permit Certification",
  ].map((value) => normalizeDocumentTemplateText(value))
);

export const getTemplateFilePath = (template) =>
  template?.template_file_path || template?.file_path || template?.template_url || "";

export const getRealDocumentTemplateKey = (templateOrType) => {
  const value =
    typeof templateOrType === "string"
      ? templateOrType
      : [
          templateOrType?.template_name,
          templateOrType?.document_type,
          templateOrType?.template_file_path,
        ]
          .filter(Boolean)
          .join(" ");
  const normalized = normalizeDocumentTemplateText(value);

  if (normalized.includes("4ps") || normalized.includes("pantawid") || normalized.includes("grantee")) return "4ps";
  if (normalized.includes("clearance")) return "clearance";
  if (normalized.includes("residency") || normalized.includes("residence")) return "residency";
  if (normalized.includes("indigency")) return "indigency";
  if (normalized.includes("business") || normalized.includes("permit")) return "business";
  if (normalized.includes("rsbsa") || normalized.includes("rsba")) return "rsbsa";
  if (normalized.includes("solo")) return "solo";
  if (normalized.includes("certification")) return "4ps";

  return "4ps";
};

export const mergeRealDocumentTemplates = (templates = []) => {
  let customOverrides = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kaagapai_custom_document_templates");
      if (raw) customOverrides = JSON.parse(raw) || {};
    } catch {
      // ignore
    }
  }
  const customOverridesList = Array.isArray(customOverrides)
    ? customOverrides
    : Object.values(customOverrides || {});

  const realRowsByKey = new Map();
  const realTemplateKeys = new Set(
    REAL_DOCUMENT_TEMPLATES.map((template) => getRealDocumentTemplateKey(template))
  );

  templates.forEach((template) => {
    const templateNameKey = normalizeDocumentTemplateText(template.template_name);
    const documentTypeKey = normalizeDocumentTemplateText(template.document_type);
    const isLegacyOnly =
      LEGACY_TEMPLATE_KEYS.has(templateNameKey) || LEGACY_TEMPLATE_KEYS.has(documentTypeKey);
    const key = getRealDocumentTemplateKey(template);

    if (!isLegacyOnly && realTemplateKeys.has(key)) {
      realRowsByKey.set(key, template);
    }
  });

  const mergedRealTemplates = REAL_DOCUMENT_TEMPLATES.map((template) => {
    const key = getRealDocumentTemplateKey(template);
    const dbTemplate = realRowsByKey.get(key);

    const localOverride = customOverridesList.find(
      (item) =>
        item.id === template.id ||
        (dbTemplate && item.id === dbTemplate.id) ||
        getRealDocumentTemplateKey(item) === key ||
        normalizeDocumentTemplateText(item.template_name) === normalizeDocumentTemplateText(template.template_name)
    );

    const base = {
      ...template,
      ...(dbTemplate || {}),
      ...(localOverride || {}),
      template_file_path:
        getTemplateFilePath(localOverride) ||
        getTemplateFilePath(dbTemplate) ||
        template.template_file_path,
    };

    if (base.requirements && String(base.requirements).toLowerCase().includes("business details")) {
      base.requirements = String(base.requirements).replace(/business details/gi, "business name");
    }

    return base;
  });

  const customTemplates = templates.filter((template) => {
    const templateNameKey = normalizeDocumentTemplateText(template.template_name);
    const documentTypeKey = normalizeDocumentTemplateText(template.document_type);
    const isLegacyOnly =
      LEGACY_TEMPLATE_KEYS.has(templateNameKey) || LEGACY_TEMPLATE_KEYS.has(documentTypeKey);

    return !isLegacyOnly && !realTemplateKeys.has(getRealDocumentTemplateKey(template));
  });

  customOverridesList.forEach((localTpl) => {
    const lKey = getRealDocumentTemplateKey(localTpl);
    const alreadyIncluded =
      mergedRealTemplates.some((t) => getRealDocumentTemplateKey(t) === lKey) ||
      customTemplates.some((t) => getRealDocumentTemplateKey(t) === lKey);
    if (!alreadyIncluded && localTpl.status !== "Archived") {
      customTemplates.push(localTpl);
    }
  });

  return [...mergedRealTemplates, ...customTemplates];
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const unescapeHtml = (value) =>
  String(value ?? "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

const fieldValue = (value, fallback = "________________") => {
  const text = String(value ?? "").trim();
  return escapeHtml(text || fallback);
};

const fieldFilled = (value, fallbackBlankLength = 20) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return `<u>&nbsp;${"&nbsp;".repeat(fallbackBlankLength)}&nbsp;</u>`;
  }
  return escapeHtml(text.toUpperCase());
};

const getPurokName = (fields = {}, plain = false) => {
  const safeFields = fields || {};
  const text = String(safeFields.purok || safeFields.address || "").trim();
  if (!text) return "________________";
  const cleaned = text.replace(/^purok\s+/i, "");
  return escapeHtml(cleaned);
};

const getPurposePhrase = (fields = {}) => {
  const safeFields = fields || {};
  const purpose = String(safeFields.purpose || "").trim();
  if (!purpose) return "";
  return purpose.replace(/^for\s+/i, "");
};

const getCivilStatusFormatted = (status, allowSeparated = false, capitalizeWidow = false, simpleTwo = false) => {
  const s = String(status || "").toLowerCase().trim();
  const widowText = capitalizeWidow ? "Widow" : "widow";
  if (simpleTwo) {
    if (s.includes("married")) return `single/ <u><strong>married</strong></u>`;
    if (s.includes("widow") || s.includes("widower")) return `single/ married/ <u><strong>${widowText}</strong></u>`;
    return `<u><strong>single</strong></u>/ married`;
  }
  if (s.includes("married")) {
    return allowSeparated ? `single/ <u><strong>married</strong></u>/ ${widowText}/ separated` : `single/ <u><strong>married</strong></u>/ ${widowText}`;
  }
  if (s.includes("widow") || s.includes("widower")) {
    return allowSeparated ? `single/ married/ <u><strong>${widowText}</strong></u>/ separated` : `single/ married/ <u><strong>${widowText}</strong></u>`;
  }
  if (allowSeparated && s.includes("separated")) {
    return `single/ married/ ${widowText}/ <u><strong>separated</strong></u>`;
  }
  return allowSeparated ? `<u><strong>single</strong></u>/ married/ ${widowText}/ separated` : `<u><strong>single</strong></u>/ married/ ${widowText}`;
};

const getGenderFormatted = (gender) => {
  const g = String(gender || "").toLowerCase().trim();
  const isFemale = g === "female" || g === "f";
  return {
    isFemale,
    maleFemale: isFemale ? "male/ <u><strong>female</strong></u>" : "<u><strong>male</strong></u>/ female",
    hisHer: isFemale ? "his/ <u><strong>her</strong></u>" : "<u><strong>his</strong></u>/ her",
    herHis: isFemale ? "<u><strong>her</strong></u> /his" : "her /<u><strong>his</strong></u>",
    herHisThird: isFemale ? "<u><strong>her</strong></u>/ his" : "her/ <u><strong>his</strong></u>",
    himHer: isFemale ? "her" : "him",
    himHerSlash: isFemale ? "him/ <u><strong>her</strong></u>" : "<u><strong>him</strong></u>/ her",
    heShe: isFemale ? "she" : "he",
    hisHerCap: isFemale ? "His/ <u><strong>Her</strong></u>" : "<u><strong>His</strong></u>/ Her",
  };
};

const getPrefixFormatted = (gender, civilStatus) => {
  const g = String(gender || "").toLowerCase().trim();
  const s = String(civilStatus || "").toLowerCase().trim();
  const isFemale = g === "female" || g === "f";
  if (!isFemale) return "Ms./<u><strong>Mr</strong></u>/Mrs.";
  if (s.includes("married") || s.includes("widow")) return "Ms./Mr/<u><strong>Mrs.</strong></u>";
  return "<u><strong>Ms.</strong></u>/Mr/Mrs.";
};

const getApprovingOfficer = (fields = {}) => {
  const safeFields = fields || {};
  const value = String(safeFields.approvingOfficer || "").trim();
  if (!value || normalizeDocumentTemplateText(value) === "punongbarangay") return PUNONG_BARANGAY;
  return value;
};

const formatIssueDate = (value) => {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return "________";

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getMonthName = (value) => {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return "August";
  return date.toLocaleDateString("en-US", { month: "long" });
};

const getYearNumber = (value) => {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().getFullYear();
  return date.getFullYear();
};

const getOrdinalDay = (value) => {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return "19th";
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";

  return `${day}${suffix}`;
};

export const formatBirthdate = (value) => {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^[A-Za-z]+\s+\d{1,2},\s*\d{4}$/.test(str)) {
    return str;
  }
  const date = new Date(str.includes("T") ? str : `${str}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  const date2 = new Date(str);
  if (!Number.isNaN(date2.getTime())) {
    return date2.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return str;
};

const getSoloParentReason = (fields = {}, genderMap = {}) => {
  const safeFields = fields || {};
  const customReason = String(safeFields.soloParentReason || "").trim();
  if (customReason) {
    return customReason.replace(/^due to\s+/i, "");
  }

  const purpose = String(safeFields.purpose || "").trim();
  if (purpose && !purpose.toLowerCase().includes("solo parent")) {
    return purpose.replace(/^due to\s+/i, "");
  }

  const s = String(safeFields.civilStatus || "").toLowerCase().trim();
  const isFemale = genderMap.isFemale;

  if (s.includes("widow") || s.includes("widower")) {
    return isFemale ? "death of her husband" : "death of his wife";
  }

  if (s.includes("separated")) {
    return isFemale ? "separation from her husband" : "separation from his wife";
  }

  if (s.includes("single")) {
    return isFemale ? "being an unmarried mother" : "being a single father";
  }

  return isFemale ? "death of her husband" : "death of his wife";
};
const buildBodyParagraphs = (fields = {}, template = null) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);
  const rawResidentName = String(safeFields.residentName || "").trim();
  const name = rawResidentName ? escapeHtml(rawResidentName.toUpperCase()) : fieldFilled(safeFields.residentName, 24);
  const rawAge = String(safeFields.age ?? "").trim();
  const age = rawAge ? escapeHtml(rawAge) : fieldFilled(safeFields.age, 4);
  const purok = getPurokName(safeFields);
  const rawPurpose = getPurposePhrase(safeFields);
  const purpose = rawPurpose
    ? `<u>${escapeHtml(rawPurpose.toUpperCase())}</u>`
    : `<u>whatever legal purpose it may serve best</u>`;

  const ordinalDay = getOrdinalDay(safeFields.issueDate);
  const monthName = getMonthName(safeFields.issueDate);
  const year = getYearNumber(safeFields.issueDate);

  const civilStatus = getCivilStatusFormatted(safeFields.civilStatus);
  const civilStatusSolo = getCivilStatusFormatted(safeFields.civilStatus, true);
  const genderMap = getGenderFormatted(safeFields.gender);
  const prefixStr = getPrefixFormatted(safeFields.gender, safeFields.civilStatus);

  const rawBirthDate = safeFields.birthDate || safeFields.birthday || safeFields.date_of_birth || safeFields.birthdate || safeFields.dob || "";
  const birthdateStr = rawBirthDate ? formatBirthdate(rawBirthDate) : "";
  const remarks = String(safeFields.remarks || "").trim();

  if (key === "clearance") {
    const purokName = getPurokName(safeFields, true) || "Kamonsil";
    const purposeVal = rawPurpose ? escapeHtml(rawPurpose.toUpperCase()) : "OWWA";
    const civilStatusClearance = getCivilStatusFormatted(safeFields.civilStatus, false, false, false).replace(/married/g, "maried").replace(/separated/g, "widow");
    const clearanceCivil = civilStatusClearance.includes("/widow") ? civilStatusClearance.replace("/widow", "/ /widow") : `${civilStatusClearance}/ /widow`;

    return [
      `This is to certify according to our existing records that ${prefixStr} <u>${name}</u>, <u>${age}</u> yrs. Old, Filipino ${clearanceCivil}, whose signature and thumbmark appear below is presently a resident of Purok <u>${escapeHtml(purokName)}</u>, Upper Mingading, Aleosan, Cotabato and no current position in the Barangay.`,
      `This is to certify further, that <u>${genderMap.isFemale ? "her" : "her /his"}</u> character, reputation and moral standing in the community are beyond reproach and that as of the date of this issued there is no pending case whatsoever filed against the above – named person for whatever any legal purpose which may serve ${genderMap.hisHer} best.`,
      `This is to certify <u>further more</u> that in view of the foregoing circumstances, this Barangay Clearance is issued upon request of theabove – named person for <u><strong>${purposeVal}</strong> and</u> whatever any legal purpose which may serve ${genderMap.herHisThird} best.`,
      `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "business") {
    const businessName = safeFields.businessName || safeFields.businessDetails || "BANANA BUY AND SALE";
    const formattedBusinessDetails = `<strong>${escapeHtml(businessName.toUpperCase())}</strong>`;
    const purokClean = getPurokName(safeFields, true) || "Azucena";
    const purposeVal = rawPurpose || safeFields.purpose || "Business Permit Application";
    const formattedPurpose = `<strong>${escapeHtml(purposeVal)}</strong>`;

    const displayName = rawResidentName ? `<u><strong>${escapeHtml(rawResidentName.toUpperCase())}</strong></u>` : `<u><strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</strong></u>`;
    const displayAge = rawAge ? escapeHtml(rawAge) : "_____";

    const s = String(safeFields.civilStatus || "").toLowerCase().trim();
    let civilStatusBusiness = "single/ <u><strong>married</strong></u>/ widow";
    if (s.includes("single")) {
      civilStatusBusiness = "<u><strong>single</strong></u>/ married/ widow";
    } else if (s.includes("widow") || s.includes("widower")) {
      civilStatusBusiness = "single/ married/ <u><strong>widow</strong></u>";
    } else if (s.includes("separated")) {
      civilStatusBusiness = "single/ married/ widow/ <u><strong>separated</strong></u>";
    } else if (s.includes("married")) {
      civilStatusBusiness = "single/ <u><strong>married</strong></u>/ widow";
    }

    const pronounServe = genderMap.isFemale ? "him/ <u><strong>her</strong></u>" : "<u><strong>him</strong></u>/ her";
    const dayMarkup = safeFields.issueDate ? `<u><strong>${ordinalDay}</strong></u>` : `<u><strong>_____</strong></u>`;

    return [
      `This is to certify that ${displayName}, ${displayAge} yrs. old, Filipino, ${civilStatusBusiness}, a bona fide resident of Purok ${escapeHtml(purokClean)}, Barangay Upper Mingading, Aleosan, Cotabato, and ${genderMap.heShe} has a ${formattedBusinessDetails} at the said place.`,
      `This certification is being issued upon the request of the above-mentioned name person for ${formattedPurpose} and for whatever any legal purposes may serve ${pronounServe} best.`,
      `Issued this ${dayMarkup} day of <strong>${monthName} ${year}</strong> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "indigency") {
    const civilStatusIndigency = getCivilStatusFormatted(safeFields.civilStatus, false, true);
    const purokClean = getPurokName(safeFields, true) || "Buklod";
    let purposeSuffix = "and for whatever legal purpose it may serve best.";
    if (rawPurpose) {
      const cleanP = rawPurpose.replace(/^for\s+/i, "");
      purposeSuffix = `for <strong>${escapeHtml(cleanP.toUpperCase())}</strong> and for whatever legal purpose it may serve best.`;
    }

    return [
      `THIS IS TO CERTIFY that <u>${name}</u>, <u>${age}</u> yrs. old single/<u>married</u>/Widow and a bonafide resident of <u>Purok ${escapeHtml(purokClean)}</u>, Upper Mingading, Aleosan, <u>Cotabato a low income</u> earner family and considered as indigent.`,
      `This certification is issued upon the request of above-named <u>person and</u> ${purposeSuffix}`,
      `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "residency") {
    const civilStatusResidency = getCivilStatusFormatted(safeFields.civilStatus, false, false, true);
    const birthphrase = birthdateStr
      ? `Filipino, was born on ${escapeHtml(birthdateStr)}`
      : `Filipino`;

    const recField = String(safeFields.residencyRecommendation || rawPurpose || "").trim();
    let recommendationMarkup = "<u>job and application.</u>";
    if (recField) {
      const cleanRec = recField.replace(/^for\s+(a\s+)?/i, "").trim();
      if (cleanRec) {
        recommendationMarkup = `<u>${escapeHtml(cleanRec)}.</u>`;
      }
    }

    const purokClean = getPurokName(safeFields, true) || "Buklod";
    const pronounHim = genderMap.isFemale ? "her" : "him";

    return [
      `THIS IS TO CERTIFY that <u>${name}</u>, ${genderMap.maleFemale}, ${civilStatusResidency}, ${birthphrase} a bona fide citizen of Purok <u>${escapeHtml(purokClean)}</u>, Upper Mingading, Aleosan, Cotabato. ${genderMap.hisHerCap}, reputation and moral standing in the community is beyond reproach and that is no pending case filed on said person whatsoever. From our barangay peace and order committee we are recommending ${pronounHim} ${recommendationMarkup}`,
      `This certification is issued upon the request of above-named person for whatever legal purpose it may serve best.`,
      `Issued <u>this ${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "rsbsa") {
    const cropsText = safeFields.cropsText || safeFields.remarks || "Rice Field ½ hectare, and Fruits Crops 1 hectare";
    const farmSize = safeFields.farmSize || "One ( 1 ) hectare";
    const tenure = safeFields.tenure || "Owner";
    const purokClean = getPurokName(safeFields, true) || "Buklod";
    const addressStr = safeFields.address || `Purok ${purokClean}`;

    return [
      `THIS IS TO CERTIFY THAT <u>${name}</u> <u>${age}</u> y/o, residing at <u>${escapeHtml(addressStr)}</u>, Upper Mingading Aleosan, Cotabato, is tilling the following crop(s) <strong>${escapeHtml(cropsText)}</strong> as <u>${escapeHtml(tenure)}</u>/Farmer at Purok <u>${escapeHtml(purokClean)}</u>, Upper Mingading, Cotabato with size <strong>${escapeHtml(farmSize)}</strong>.`,
      `This <strong>CERTIFICATION</strong> is being issued by the Barangay solely for the purpose of the farmers and fisher folk registration to the <strong>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE (RSBSA)</strong> of the Department of Agriculture and may not be used for other purposes not mention above.`,
    ];
  }

  if (key === "solo") {
    const soloReason = getSoloParentReason(safeFields, genderMap);
    const purokSolo = getPurokName(safeFields, true) || "Kamonsil";

    return [
      `This is to certify that <u>${name}</u> legal age, Filipino, ${civilStatusSolo}, a bona fide resident of Purok <u>${escapeHtml(purokSolo)}</u>, Barangay Upper Mingading, Aleosan, Cotabato.`,
      `This certification is being issued upon the request of the above-mentioned name person on application for solo parent due to <strong>${escapeHtml(soloReason)}</strong> and whatever any legal intent may serve best.`,
      `Issued this <strong>${ordinalDay}</strong> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "certification" || key === "4ps") {
    const purokText = getPurokName(safeFields, true) || "Muslim";
    const fourPsPurpose = (safeFields.fourPsPurpose || safeFields.purpose || "").trim();
    let purposeText = "";

    if (fourPsPurpose) {
      purposeText = escapeHtml(fourPsPurpose.replace(/^for\s+/i, ""));
    } else if (safeFields.fourPsSpouse) {
      purposeText = `Change Grantee of ${genderMap.herHis} wife ${escapeHtml(safeFields.fourPsSpouse)} working Abroad and for whatever any legal purposes.`;
    } else {
      purposeText = `Change Grantee of ${genderMap.herHis} wife working Abroad and for whatever any legal purposes.`;
    }

    if (!/legal purpose/i.test(purposeText)) {
      purposeText = `${purposeText.replace(/[.,\s]+$/, "")} and for whatever any legal purposes.`;
    } else if (!purposeText.endsWith(".")) {
      purposeText += ".";
    }

    return [
      `This is to certify that <u>${name}, ${age} yrs. old</u>, Filipino, ${civilStatus}, a bona fide resident <u>of Purok ${escapeHtml(purokText)}</u>, Barangay Upper Mingading, Aleosan, Cotabato.`,
      `This certification is being issued upon the request of the above-mentioned name person for ${purposeText}`,
      `Issued this <u>${ordinalDay}</u> day <u>of ${monthName}</u> <strong>${year}</strong> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  return [
    `This is to certify that <u>${name}</u>, <u>${age}</u> yrs. old, Filipino, ${civilStatus}, a bona fide resident of Purok ${escapeHtml(purok)}, Barangay Upper Mingading, Aleosan, Cotabato.`,
    `This certification is issued upon request for ${purpose} and for whatever legal purpose it may serve best.`,
    `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
  ];
};

const htmlParagraphToText = (paragraph) =>
  String(paragraph || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

export const getCustomTemplateContent = (templateOrType) => {
  if (typeof window === "undefined") return null;
  const targetKey = getRealDocumentTemplateKey(templateOrType);
  try {
    const raw = localStorage.getItem("kaagapai_custom_document_templates");
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      const found = list.find((t) => getRealDocumentTemplateKey(t) === targetKey && t.status !== "Archived");
      if (found?.content) return found.content;
    }

    const legacyRaw = localStorage.getItem("kaagapai_document_templates_v1");
    if (legacyRaw) {
      const list = JSON.parse(legacyRaw);
      if (Array.isArray(list)) {
        const found = list.find((t) => getRealDocumentTemplateKey(t) === targetKey && t.status !== "Archived");
        if (found?.content) return found.content;
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const getCustomTemplateHeaderConfig = (templateOrType) => {
  if (typeof window === "undefined") return null;
  const targetKey = getRealDocumentTemplateKey(templateOrType);
  try {
    const raw = localStorage.getItem("kaagapai_custom_document_templates");
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      const found = list.find((t) => getRealDocumentTemplateKey(t) === targetKey && t.status !== "Archived");
      if (found?.header_config) return found.header_config;
    }
    return null;
  } catch {
    return null;
  }
};

const replaceDynamicTemplatePlaceholders = (content, fields = {}, template = null) => {
  if (!content) return "";
  const key = getRealDocumentTemplateKey(template);
  const rawResidentName = String(fields.residentName || "").trim();
  const name = rawResidentName ? escapeHtml(rawResidentName.toUpperCase()) : "JUAN S. DELA CRUZ";
  const rawAge = String(fields.age ?? "").trim();
  const age = rawAge ? escapeHtml(rawAge) : "35";
  const purok = getPurokName(fields, true) || "Kamonsil";
  const rawPurpose = getPurposePhrase(fields);
  const purpose = rawPurpose ? escapeHtml(rawPurpose.toUpperCase()) : "whatever legal purpose it may serve best";

  const ordinalDay = getOrdinalDay(fields.issueDate);
  const monthName = getMonthName(fields.issueDate);
  const year = getYearNumber(fields.issueDate);

  const civilStatus = getCivilStatusFormatted(fields.civilStatus);
  const genderMap = getGenderFormatted(fields.gender);

  const rawBirthDate = fields.birthDate || fields.birthday || fields.date_of_birth || fields.birthdate || fields.dob || "";
  const birthdateStr = rawBirthDate ? formatBirthdate(rawBirthDate) : "";

  const formattedName = `<u><strong>${name}</strong></u>`;
  const formattedDay = `<u><strong>${ordinalDay}</strong></u>`;
  const formattedMonthYear = `<strong>${monthName} ${year}</strong>`;
  const businessName = escapeHtml((fields.businessName || fields.businessDetails || "BANANA BUY AND SALE").toUpperCase());
  const businessPurpose = escapeHtml(rawPurpose || fields.purpose || "Business Permit Application");

  const pronounHimHer = genderMap.isFemale ? "him/ <u><strong>her</strong></u>" : "<u><strong>him</strong></u>/ her";
  const pronounHerHis = genderMap.isFemale ? "<u><strong>her</strong></u>/ his" : "her/ <u><strong>his</strong></u>";
  const pronounHisHer = genderMap.isFemale ? "his/ <u><strong>her</strong></u>" : "<u><strong>his</strong></u>/ her";
  const pronounSex = genderMap.isFemale ? "male/ <u><strong>female</strong></u>" : "<u><strong>male</strong></u>/ female";
  const pronounPrefix = getPrefixFormatted(fields.gender, fields.civilStatus);

  const replacements = {
    // Resident Name
    "{{FULL_NAME}}": formattedName,
    "{{RESIDENT_NAME}}": formattedName,
    "{{NAME}}": formattedName,

    // Age
    "{{AGE}}": age,

    // Civil Status
    "{{CIVIL_STATUS}}": civilStatus,
    "{{CIVIL STATUS}}": civilStatus,
    "{{single/married/widow}}": civilStatus,
    "{{single/ married/ widow}}": civilStatus,
    "{{single/married/widow/separated}}": civilStatus,
    "{{single/ married/ widow/ separated}}": civilStatus,
    "{{single/married}}": civilStatus,
    "{{single/ married}}": civilStatus,

    // Pronouns & Gender
    "{{SEX}}": pronounSex,
    "{{GENDER}}": pronounSex,
    "{{male/female}}": pronounSex,
    "{{male / female}}": pronounSex,
    "{{MALE/FEMALE}}": pronounSex,
    "{{her/his}}": pronounHerHis,
    "{{her /his}}": pronounHerHis,
    "{{her / his}}": pronounHerHis,
    "{{his/her}}": pronounHisHer,
    "{{his /her}}": pronounHisHer,
    "{{his / her}}": pronounHisHer,
    "{{him/her}}": pronounHimHer,
    "{{him /her}}": pronounHimHer,
    "{{him / her}}": pronounHimHer,
    "{{her/him}}": pronounHerHis,
    "{{her /him}}": pronounHerHis,
    "{{HER_HIS}}": pronounHerHis,
    "{{HIM_HER}}": pronounHimHer,
    "{{HIS_HER}}": pronounHisHer,
    "{{he/she}}": genderMap.heShe,
    "{{HE_SHE}}": genderMap.heShe,
    "{{He/She}}": genderMap.isFemale ? "She" : "He",
    "{{they have}}": genderMap.isFemale ? "she has" : "he has",
    "{{THEY_HAVE}}": genderMap.isFemale ? "she has" : "he has",
    "{{they have a}}": genderMap.isFemale ? "she has a" : "he has a",
    "{{they}}": genderMap.heShe,
    "{{them}}": genderMap.himHer,
    "{{their}}": genderMap.isFemale ? "her" : "his",
    "{{him}}": genderMap.himHer,
    "{{her}}": genderMap.isFemale ? "her" : "his",
    "{{his}}": genderMap.isFemale ? "her" : "his",
    "{{PREFIX}}": pronounPrefix,

    // Address & Purok
    "{{ADDRESS}}": fields.address || `Purok ${purok}, Upper Mingading, Aleosan, Cotabato`,
    "{{PUROK}}": purok,

    // Purpose & Business
    "{{PURPOSE}}": key === "business" ? `<strong>${businessPurpose}</strong>` : `<strong>${purpose}</strong>`,
    "{{BUSINESS_NAME}}": `<strong>${businessName}</strong>`,
    "{{BUSINESS_DETAILS}}": `<strong>${businessName}</strong>`,
    "{{BUSINESS_PURPOSE}}": `<strong>${businessPurpose}</strong>`,
    "{{SOLO_PARENT_REASON}}": escapeHtml(getSoloParentReason(fields, genderMap)),
    "{{CROPS_DETAILS}}": escapeHtml(fields.cropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare"),
    "{{FARM_SIZE}}": escapeHtml(fields.farmSize || "One ( 1 ) hectare"),

    // Dates
    "{{DATE}}": `${formattedDay} day of ${formattedMonthYear}`,
    "{{DAY}}": formattedDay,
    "{{MONTH}} {{YEAR}}": formattedMonthYear,
    "{{MONTH}}  {{YEAR}}": formattedMonthYear,
    "{{MONTH_YEAR}}": formattedMonthYear,
    "{{MONTH}}": monthName,
    "{{YEAR}}": String(year),
    "{{BIRTHDAY}}": birthdateStr,
    "{{DATE_OF_BIRTH}}": birthdateStr,
    "{{BARANGAY_CAPTAIN}}": PUNONG_BARANGAY,
  };

  let result = String(content);
  Object.entries(replacements).forEach(([token, val]) => {
    const regex = new RegExp(token.replace(/[{}]/g, "\\$&"), "gi");
    result = result.replace(regex, val);
  });

  // Post-replacement cleanup and inline fallback parsing for non-tokenized / user-edited text:
  // 1. Civil Status: if plain text contains single/married/widow options, highlight the resident's status with proper spacing
  result = result.replace(
    /(,\s*)?(?:(?:<u>|<\/u>|<strong>|<\/strong>|\s)*single(?:<u>|<\/u>|<strong>|<\/strong>|\s)*\/(?:<u>|<\/u>|<strong>|<\/strong>|\s)*married(?:<u>|<\/u>|<strong>|<\/strong>|\s)*\/(?:<u>|<\/u>|<strong>|<\/strong>|\s)*widow(?:(?:<u>|<\/u>|<strong>|<\/strong>|\s)*\/(?:<u>|<\/u>|<strong>|<\/strong>|\s)*separated)?)/gi,
    (m, comma) => (comma ? `, ${civilStatus}` : ` ${civilStatus}`)
  );

  // 2. Pronoun serve: replace "may serve ... best" patterns
  result = result.replace(
    /(may\s+serve\s+)(?:<u>|<\/u>|<strong>|<\/strong>|\s|\{|\})*(?:him\s*\/\s*her|her\s*\/\s*his|them)(?:<u>|<\/u>|<strong>|<\/strong>|\s|\{|\})*(\s+best)/gi,
    `$1${pronounHimHer}$2`
  );

  // 3. Catch any leftover unparsed {{her/his}}, {{him/her}}, {{his/her}}
  result = result
    .replace(/\{\{\s*her\s*\/\s*his\s*\}\}/gi, pronounHerHis)
    .replace(/\{\{\s*him\s*\/\s*her\s*\}\}/gi, pronounHimHer)
    .replace(/\{\{\s*his\s*\/\s*her\s*\}\}/gi, pronounHisHer);

  // 4. "they have a" -> "he has a" or "she has a" in business permit
  result = result.replace(/\bthey\s+have\s+a\b/gi, `${genderMap.heShe} has a`);

  // 4b. Business Permit purpose autofill:
  // If template content contains {{PURPOSE}}, {{BUSINESS_PURPOSE}}, or hardcoded "Business Permit Application",
  // ensure the resident's selected purpose (e.g., "For Franchising", "For Renewal", etc.) is autofilled.
  if (key === "business" || /business/i.test(template?.template_name || fields.documentType || "")) {
    const rawClean = escapeHtml(rawPurpose || "").trim();
    const bp = rawClean || businessPurpose || "Business Permit Application";

    // Replace {{PURPOSE}} or {{BUSINESS_PURPOSE}} if still present
    result = result.replace(
      /(?:<u>|<\/u>|<strong>|<\/strong>|<b>|<\/b>|\s)*\{\{\s*(?:PURPOSE|BUSINESS_PURPOSE)\s*\}\}(?:<u>|<\/u>|<strong>|<\/strong>|<b>|<\/b>|\s)*/gi,
      ` <strong>${bp}</strong> `
    );

    // Replace legacy hardcoded "Business Permit Application" preceded by "for"
    result = result.replace(
      /(\bfor\s+)(?:<u>|<\/u>|<strong>|<\/strong>|<b>|<\/b>|\s)*(?:New\s+)?Business\s+Permit\s+Application(?:<u>|<\/u>|<strong>|<\/strong>|<b>|<\/b>|\s)*/gi,
      (m, p1) => `${p1}<strong>${bp}</strong> `
    );

    // Replace standalone "Business Permit Application"
    result = result.replace(
      /(?:<u>|<\/u>|<strong>|<\/strong>|<b>|<\/b>)*(?:New\s+)?Business\s+Permit\s+Application(?:<u>|<\/u>|<strong>|<\/strong>|<b>|<\/b>)*/gi,
      `<strong>${escapeHtml(fields.purpose || bp)}</strong>`
    );

    // Clean up any double "for for" or "for For"
    result = result.replace(/\bfor\s+(?:<strong>|<b>|<u>)*\s*for\s+/gi, "for <strong>");
  }

  // 5. Ensure "day of Month Year" has month & year bolded
  result = result.replace(
    new RegExp(`(day\\s+of\\s+)(?:<strong>)?(${monthName}\\s+${year})(?:</strong>)?`, "gi"),
    `$1<strong>$2</strong>`
  );

  // 5. Clean up duplicate nesting like <u><u> or <strong><strong>
  result = result
    .replace(/<u>\s*<u>/g, "<u>")
    .replace(/<\/u>\s*<\/u>/g, "</u>")
    .replace(/<strong>\s*<strong>/g, "<strong>")
    .replace(/<\/strong>\s*<\/strong>/g, "</strong>");

  return result;
};

export const getDocumentBodyHtml = (fields = {}, template = null) => {
  const safeFields = fields || {};
  const stored = String(safeFields.documentText || "").trim();

  if (stored) {
    const rawParagraphs = stored
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (rawParagraphs.length > 0) {
      return rawParagraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
        .join("\n");
    }
  }

  // Check if a customized template content exists
  const customContent = template?.content || getCustomTemplateContent(template || safeFields.documentType);
  if (customContent) {
    const populated = replaceDynamicTemplatePlaceholders(customContent, safeFields, template);
    if (populated) return populated;
  }

  const list = buildBodyParagraphs(safeFields, template);
  return list.map((p) => `<p>${p}</p>`).join("\n");
};

export const getDocumentBodyPlainText = (fields = {}, template = null) => {
  const list = buildBodyParagraphs(fields || {}, template);
  return list.map((item) => htmlParagraphToText(item)).join("\n\n");
};

export const getEditableDocumentText = (fields = {}, template = null) =>
  getDocumentBodyPlainText(fields, template);

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

export const formatDateShort = (value) => {
  if (!value) return "";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (!Number.isNaN(date.getTime())) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const y = String(date.getFullYear()).slice(-2);
    return `${m}-${d}-${y}`;
  }
  const date2 = new Date(value);
  if (!Number.isNaN(date2.getTime())) {
    const m = String(date2.getMonth() + 1).padStart(2, "0");
    const d = String(date2.getDate()).padStart(2, "0");
    const y = String(date2.getFullYear()).slice(-2);
    return `${m}-${d}-${y}`;
  }
  return String(value);
};

export const formatShortDate = formatDateShort;

const getPrintSettings = (fields = {}, template = null) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);

  let defaultFont = "rockwell";
  let defaultFontSize = 14;
  let defaultLineHeight = 1.25;
  let defaultParagraphGap = 0.16;

  if (key === "clearance") {
    defaultFont = "times";
    defaultFontSize = 11.5;
    defaultLineHeight = 1.25;
    defaultParagraphGap = 0.14;
  } else if (key === "rsbsa") {
    defaultFont = "agency";
    defaultFontSize = 12;
    defaultLineHeight = 1.2;
    defaultParagraphGap = 0.22;
  } else if (key === "solo") {
    defaultFont = "times";
    defaultFontSize = 14;
    defaultLineHeight = 1.25;
    defaultParagraphGap = 0.18;
  } else if (key === "business") {
    defaultFont = "rockwell";
    defaultFontSize = 14;
    defaultLineHeight = 1.28;
    defaultParagraphGap = 0.22;
  } else {
    // certification, residency, indigency all use Rockwell Condensed 14pt
    defaultFont = "rockwell";
    defaultFontSize = 14;
    defaultLineHeight = 1.25;
    defaultParagraphGap = 0.16;
  }

  const defaultPadding = "1.0in 1.0in 1.0in 1.0in";

  const marginMap = {
    narrow: "0.5in 0.5in 0.5in 0.5in",
    wide: "1.2in 1.2in 1.2in 1.2in",
    normal: defaultPadding,
  };
  const fontMap = {
    "times": '"Times New Roman", "Times New Roman (Headings CS)", Times, "Liberation Serif", serif',
    "algerian": 'Algerian, "Algerian Regular", Impact, serif',
    "felix": '"Felix Titling", "Felix-Titling", "Times New Roman", serif',
    "bodoni": '"Bodoni MT Poster Compressed", "Bodoni MT", Impact, serif',
    "agency": '"Agency FB", "AgencyFB-Reg", "Arial Narrow", sans-serif',
    "rockwell": '"Rockwell Condensed", "Rockwell-Condensed", "Rockwell", "Tw Cen MT Condensed", "Tw Cen MT", "Arial Narrow", Impact, serif, sans-serif',
    "charlemagne": '"Charlemagne Std", "Charlemagne", "Times New Roman", serif',
    "cooper": '"Cooper Std Black", "Cooper Black", serif, sans-serif',
    "arial": 'Arial, Helvetica, sans-serif',
    "arial-narrow": '"Arial Narrow", Arial, sans-serif',
    "georgia": 'Georgia, serif',
    "calibri": 'Calibri, sans-serif',
  };

  const customHeaderCfg = getCustomTemplateHeaderConfig(template || safeFields.documentType) || {};
  const headerCfg = {
    ...customHeaderCfg,
    ...(template?.header_config || {}),
  };
  const chosenFont = headerCfg.fontFamily || safeFields.printFontFamily || defaultFont;
  const chosenSizePt = clampNumber(headerCfg.fontSize || safeFields.printFontSize, 8, 24, defaultFontSize);
  const chosenLineHeight = clampNumber(headerCfg.lineHeight || safeFields.printLineHeight, 1.1, 2.2, defaultLineHeight);
  const chosenGap = clampNumber(safeFields.printParagraphGap, 0.02, 0.5, defaultParagraphGap);

  return {
    fontFamily: fontMap[chosenFont] || fontMap[defaultFont],
    bodyFontSizePt: chosenSizePt,
    bodyFontSizePx: Math.round((chosenSizePt * 96) / 72),
    lineHeight: chosenLineHeight,
    paragraphGap: chosenGap,
    padding: marginMap[safeFields.printMargin] || defaultPadding,
  };
};

const getDocumentTitle = (template) => {
  const key = getRealDocumentTemplateKey(template);
  if (key === "clearance") return "BARANGAY CLEARANCE";
  if (key === "residency") return "CERTIFICATION";
  if (key === "rsbsa") return "CERTIFICATION";
  return "C E R T I F I C A T I O N";
};

const getEditableBodyAttributes = (editable) =>
  editable
    ? 'contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" data-editable-document-body="true" aria-label="Certificate text"'
    : "";

const getEditableFieldAttributes = (editable, fieldKey, fieldLabel) =>
  editable
    ? `contenteditable="true" spellcheck="false" data-editable-field="${fieldKey}" aria-label="${escapeHtml(fieldLabel)}"`
    : "";

const getDocumentFooter = (fields = {}, template = null, editable = false) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);
  const officer = escapeHtml(getApprovingOfficer(safeFields));
  const officerEditAttrs = getEditableFieldAttributes(editable, "approvingOfficer", "Punong Barangay");

  const actingOfficer = String(safeFields.actingOfficer || "").trim();
  const actingPosition = String(safeFields.actingPosition || "Barangay Kagawad / Officer of the Day").trim();

  const actingMarkup = actingOfficer
    ? `
      <div style="margin-top: 14px; padding-top: 6px; font-size: 11px; line-height: 1.25;">
        <p style="margin: 0; font-size: 10px; font-style: italic; text-transform: none;">By Authority of the Punong Barangay:</p>
        <p style="margin: 4px 0 0; font-family: 'Times New Roman', serif; font-size: 12pt; font-weight: 700; text-transform: uppercase;">${escapeHtml(actingOfficer)}</p>
        <p style="margin: 1px 0 0; font-family: 'Times New Roman', serif; font-size: 11pt;">${escapeHtml(actingPosition)}</p>
      </div>
    `
    : "";

  if (key === "rsbsa") {
    const issueDateStr = formatIssueDate(safeFields.issueDate);

    return `
      <section class="real-doc-rsbsa-signatures">
        <div class="real-doc-rsbsa-cell">
          <p class="real-doc-line" ${officerEditAttrs}><u><strong>${officer}</strong></u></p>
          <p class="real-doc-subtext" style="font-size: 10.5pt; font-style: italic;">Name and Signature of Punong Barangay</p>
        </div>
        <div class="real-doc-rsbsa-cell">
          <p class="real-doc-line"><u><strong>${issueDateStr}</strong></u></p>
          <p class="real-doc-subtext" style="font-size: 10.5pt; font-style: italic;">Date</p>
        </div>
        <div class="real-doc-rsbsa-cell" style="margin-top: 0.32in;">
          <p class="real-doc-line" style="border-bottom: 1.5px solid #000; width: 85%; margin: 0 auto;">&nbsp;</p>
          <p class="real-doc-subtext" style="font-size: 10.5pt; font-style: italic;">Name and Signature of Farmers/Fisher</p>
        </div>
        <div class="real-doc-rsbsa-cell" style="margin-top: 0.32in;">
          <p class="real-doc-line" style="border-bottom: 1.5px solid #000; width: 85%; margin: 0 auto;">&nbsp;</p>
          <p class="real-doc-subtext" style="font-size: 10.5pt; font-style: italic;">Name and Signature of Neutral Third- Party Witness</p>
        </div>
        <div class="real-doc-rsbsa-cell" style="margin-top: 0.22in;">
          <p class="real-doc-line"><u><strong>${issueDateStr}</strong></u></p>
          <p class="real-doc-subtext" style="font-size: 10.5pt; font-style: italic;">Date</p>
        </div>
        <div class="real-doc-rsbsa-cell" style="margin-top: 0.22in;">
          <p class="real-doc-line"><u><strong>${issueDateStr}</strong></u></p>
          <p class="real-doc-subtext" style="font-size: 10.5pt; font-style: italic;">Date</p>
        </div>
      </section>
      <p class="real-doc-rsbsa-note" style="margin-top: 0.35in; font-size: 11pt; font-style: italic;">Note: Not Valid without the Punong Barangay and Barangay Seal.</p>
    `;
  }

  const captainNameMarkup = (key === "clearance" || key === "indigency")
    ? `<u><strong>${officer}</strong></u>`
    : (key === "business" ? officer : `<strong>${officer}</strong>`);

  return `
    <section class="real-doc-signature ${key === "clearance" ? "real-doc-clearance-signature" : ""}">
      <p class="real-doc-captain-name" ${officerEditAttrs}>${captainNameMarkup}</p>
      <p class="real-doc-subtext">Punong Barangay</p>
      ${actingMarkup}
    </section>
  `;
};

const getDocumentExtras = (fields = {}, template = null, editable = false) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);

  // Solo parent certificates, RSBSA, and 4Ps / Certification omit the OR block (free of charge)
  if (key === "solo" || key === "rsbsa" || key === "4ps" || key === "certification") {
    return "";
  }

  const rawOr = String(safeFields.orNumber || "").trim();
  const hasCustomOr = rawOr && rawOr !== "2578557";

  const blankLine = `<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>`;
  const orVal = hasCustomOr
    ? `<u>${escapeHtml(rawOr)}</u>`
    : (key === "residency" ? "" : blankLine);
  const dateVal = safeFields.dateIssued
    ? `<u>${escapeHtml(formatDateShort(safeFields.dateIssued))}</u>`
    : (key === "residency" ? "" : blankLine);
  const ctcVal = safeFields.ctcNumber
    ? `<u>${escapeHtml(safeFields.ctcNumber)}</u>`
    : (key === "residency" ? "" : blankLine);
  const ctcDateVal = safeFields.ctcDateIssued
    ? `<u>${escapeHtml(formatDateShort(safeFields.ctcDateIssued))}</u>`
    : (key === "residency" ? "" : blankLine);

  if (key === "clearance") {
    return `
      <section class="real-doc-thumbmark" aria-hidden="true">
        <span></span>
      </section>
      <section class="real-doc-or real-doc-clearance-or">
        <div class="real-doc-or-table">
          <div class="real-doc-or-row"><span class="real-doc-or-label">O. R.  No.</span><span class="real-doc-or-val">${orVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${dateVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">CTC. No.</span><span class="real-doc-or-val">${ctcVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${ctcDateVal}</span></div>
        </div>
      </section>
    `;
  }

  if (key === "indigency") {
    return `
      <section class="real-doc-or real-doc-indigency-or">
        <p style="margin-bottom: 2px;">Brgy. Seal/25</p>
        <div class="real-doc-or-table">
          <div class="real-doc-or-row"><span class="real-doc-or-label">O. R. No.</span><span class="real-doc-or-val">${orVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${dateVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">CTC No.</span><span class="real-doc-or-val">${ctcVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${ctcDateVal}</span></div>
        </div>
      </section>
    `;
  }

  if (key === "residency") {
    return `
      <section class="real-doc-or real-doc-residency-or">
        <p style="margin-bottom: 2px;">Brgy. Seal/25</p>
        <div class="real-doc-or-table">
          <div class="real-doc-or-row"><span class="real-doc-or-label">O. R. No</span><span class="real-doc-or-val">${orVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${dateVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">CTC No.</span><span class="real-doc-or-val">${ctcVal}</span></div>
        </div>
      </section>
    `;
  }

  if (key === "business") {
    const rawOrVal = hasCustomOr ? escapeHtml(rawOr) : (safeFields.orNumber ? escapeHtml(safeFields.orNumber) : "");
    const rawDateVal = safeFields.dateIssued ? escapeHtml(formatDateShort(safeFields.dateIssued)) : "";
    return `
      <section class="real-doc-or real-doc-business-or">
        <div class="real-doc-or-table">
          <div class="real-doc-or-row"><span class="real-doc-or-label">OR No.</span><span class="real-doc-or-val">${rawOrVal || "&nbsp;"}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${rawDateVal || "&nbsp;"}</span></div>
        </div>
      </section>
    `;
  }

  return "";
};

export const REAL_DOCUMENT_CSS = `
  @font-face {
    font-family: 'Algerian';
    font-style: normal;
    font-weight: 400;
    src: url('/fonts/ALGER.TTF') format('truetype'),
         local('Algerian'),
         local('Algerian Regular');
  }
  @font-face {
    font-family: 'Algerian';
    font-style: normal;
    font-weight: 700;
    src: url('/fonts/ALGER.TTF') format('truetype'),
         local('Algerian'),
         local('Algerian Regular');
  }
  @font-face {
    font-family: 'Rockwell Condensed';
    font-style: normal;
    font-weight: 400;
    src: url('/fonts/ROCC____.TTF') format('truetype'),
         local('Rockwell Condensed'),
         local('Rockwell-Condensed');
  }
  @font-face {
    font-family: 'Rockwell Condensed';
    font-style: normal;
    font-weight: 700;
    src: url('/fonts/ROCCB___.TTF') format('truetype'),
         local('Rockwell Condensed Bold'),
         local('Rockwell-Condensed-Bold'),
         local('Rockwell Condensed');
  }
  @font-face {
    font-family: 'Felix Titling';
    font-style: normal;
    font-weight: 400;
    src: url('/fonts/FELIXTI.TTF') format('truetype'),
         local('Felix Titling'),
         local('Felix-Titling');
  }
  @font-face {
    font-family: 'Felix Titling';
    font-style: normal;
    font-weight: 700;
    src: url('/fonts/FELIXTI.TTF') format('truetype'),
         local('Felix Titling'),
         local('Felix-Titling');
  }
  @font-face {
    font-family: 'Agency FB';
    font-style: normal;
    font-weight: 400;
    src: url('/fonts/AGENCYR.TTF') format('truetype'),
         local('Agency FB'),
         local('AgencyFB-Reg');
  }
  @font-face {
    font-family: 'Agency FB';
    font-style: normal;
    font-weight: 700;
    src: url('/fonts/AGENCYB.TTF') format('truetype'),
         local('Agency FB Bold'),
         local('AgencyFB-Bold'),
         local('Agency FB');
  }
  @font-face {
    font-family: 'Cooper Std Black';
    font-style: normal;
    font-weight: 400 900;
    src: url('/fonts/COOPBL.TTF') format('truetype'),
         local('Cooper Black'),
         local('Cooper Std Black'),
         local('CooperBlack');
  }
  @font-face {
    font-family: 'Cooper Black';
    font-style: normal;
    font-weight: 400 900;
    src: url('/fonts/COOPBL.TTF') format('truetype'),
         local('Cooper Black'),
         local('Cooper Std Black'),
         local('CooperBlack');
  }
  @font-face {
    font-family: 'Charlemagne Std';
    font-style: normal;
    font-weight: 400 700;
    src: local('Charlemagne Std'),
         local('CharlemagneStd-Bold'),
         local('Charlemagne Std Bold'),
         local('Times New Roman');
  }
  @font-face {
    font-family: 'Bodoni MT Poster Compressed';
    font-style: normal;
    font-weight: 400 700;
    src: url('/fonts/BOD_PSTC.TTF') format('truetype'),
         local('Bodoni MT Poster Compressed'),
         local('Bodoni MT Poster Compressed Regular');
  }
  @font-face {
    font-family: 'Times New Roman (Headings CS)';
    font-style: normal;
    font-weight: 400 700;
    src: local('Times New Roman'),
         local('TimesNewRoman');
  }

  html, body { margin: 0; padding: 0; background: #fff; }
  .real-doc-shell, .real-doc-shell * { box-sizing: border-box; }
  .real-doc-shell { font-family: var(--doc-font-family, "Times New Roman", Times, serif); color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .real-doc-page { position: relative; width: 8.5in; min-height: 11in; margin: 0 auto; padding: var(--doc-padding, 1.0in 1.0in 1.0in 1.0in); background: #fff; box-shadow: 0 0 0 1px #d7d7d7; }
  
  /* Strictly Centered Header with Perfectly Circular Floating Left Logo */
  .real-doc-header { position: relative; min-height: 1.22in; padding-bottom: 0.08in; margin-bottom: 0.22in; font-family: inherit; font-size: 12pt; line-height: 1.2; background: transparent !important; color: #000000 !important; text-align: center; }
  
  /* Header divider lines strictly per original reference */
  .real-doc-clearance .real-doc-header,
  .real-doc-indigency .real-doc-header,
  .real-doc-residency .real-doc-header,
  .real-doc-rsbsa .real-doc-header {
    border-bottom: 1.5px solid #000 !important;
  }
  .real-doc-business .real-doc-header,
  .real-doc-certification .real-doc-header,
  .real-doc-4ps .real-doc-header,
  .real-doc-solo .real-doc-header {
    border-bottom: none !important;
  }

  .real-doc-seal { position: absolute; left: 0.1in; top: -0.05in; width: 1.18in; height: 1.18in; aspect-ratio: 1 / 1; border-radius: 50%; object-fit: contain; background: transparent !important; display: block; }
  .real-doc-header-text { width: 100%; text-align: center; margin: 0 auto; background: transparent !important; color: #000000 !important; font-size: 12pt; line-height: 1.2; font-family: inherit; font-weight: 400; }
  .real-doc-header-text div { background: transparent !important; color: #000000 !important; }
  .real-doc-office { margin: 0.14in 0 0.02in; font-family: inherit; font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; text-align: center; background: transparent !important; color: #000000 !important; }
  
  /* Document Titles strictly per template */
  .real-doc-title { margin: 0.22in 0 0.18in; text-align: center; font-family: inherit; font-size: 14pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #000000; }
  .real-doc-title * { font-family: inherit; letter-spacing: inherit; }
  .real-doc-title b, .real-doc-title strong { font-weight: 900 !important; }
  
  /* 1. Business Permit: Algerian 14pt, bold, letter-spaced, no underline */
  .real-doc-business .real-doc-title {
    font-family: "Algerian", "Algerian Regular", Impact, serif;
    font-size: 14pt;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: none;
  }

  /* 2. Barangay Certification: Algerian 14pt, bold, letter-spaced, no underline */
  .real-doc-certification .real-doc-title,
  .real-doc-4ps .real-doc-title {
    font-family: "Algerian", "Algerian Regular", Impact, serif;
    font-size: 14pt;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: none;
  }

  /* 3. Barangay Clearance: Cooper Std Black 18pt, bold, no underline */
  .real-doc-clearance .real-doc-title {
    font-family: "Cooper Std Black", "Cooper Black", "CooperBlack", serif, sans-serif;
    font-size: 18pt;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-decoration: none;
  }

  /* 4. Certificate of Residency: Felix Titling 18pt, bold, UNDERLINED */
  .real-doc-residency .real-doc-title {
    font-family: "Felix Titling", "Felix-Titling", "Times New Roman", serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: underline;
    text-underline-offset: 3px;
    color: #000000;
  }

  /* 5. RSBA: Agency FB 18pt, bold, letter-spaced, no underline */
  .real-doc-rsbsa .real-doc-title {
    font-family: "Agency FB", "Arial Narrow", sans-serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: none;
  }

  /* 6. Certificate of Indigency: Rockwell Condensed 16pt, bold, UNDERLINED */
  .real-doc-indigency .real-doc-title {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: underline;
    text-underline-offset: 3px;
    color: #000000;
  }

  /* 7. Solo Parent: Times New Roman 18pt, bold, letter-spaced, no underline */
  .real-doc-solo .real-doc-title {
    font-family: "Times New Roman", Times, serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: none;
  }
  
  .real-doc-to { margin: 0 0 0.18in; font-family: inherit; font-size: 12pt; font-weight: 700; text-transform: uppercase; color: #000000 !important; text-align: left; }
  
  .real-doc-body { font-family: inherit; font-size: var(--doc-body-font-size, 12pt); line-height: var(--doc-line-height, 1.25); text-align: justify; color: #000000 !important; font-weight: 400; }
  .real-doc-body p { margin: 0 0 var(--doc-paragraph-gap, 0.16in); text-indent: 0.5in; color: #000000 !important; font-weight: 400; }
  .real-doc-body strong { font-weight: 700 !important; color: #000000 !important; }
  .real-doc-body u { text-decoration: underline; text-underline-offset: 2px; color: #000000 !important; }
  
  /* Standard Captain MAMERTO C. CLARITO Signature Block */
  .real-doc-signature { width: 3.4in; margin: 0.55in 0 0 auto; text-align: center; font-family: inherit; line-height: 1.2; color: #000000 !important; }
  .real-doc-captain-name { margin: 0; font-family: inherit; font-size: 14pt; font-weight: 700; text-transform: uppercase; color: #000000 !important; letter-spacing: 0.02em; }
  .real-doc-subtext { margin: 2px 0 0; font-family: inherit; font-size: 12pt; font-weight: 400; color: #000000 !important; }
  
  /* Clearance Specific Signature & Staff Layout */
  .real-doc-clearance-signature { margin-top: 0.55in; margin-right: 0.15in; width: 3.4in; text-align: center; }
  .real-doc-clearance-signature .real-doc-captain-name {
    font-family: "Charlemagne Std", "CharlemagneStd-Bold", "Charlemagne", "Times New Roman", serif !important;
    font-size: 16pt !important;
    font-weight: 700 !important;
    text-decoration: underline !important;
    text-underline-offset: 2px !important;
  }
  .real-doc-clearance-signature .real-doc-subtext {
    font-family: "Times New Roman", Times, serif !important;
    font-size: 12pt !important;
  }

  .real-doc-clearance-staff {
    margin-top: 0.18in;
    width: 2.8in;
    text-align: left;
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.15;
    color: #000000 !important;
  }
  .real-doc-clearance-staff p { margin: 0; color: #000000 !important; }
  .real-doc-staff-name {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    font-weight: 700;
    text-transform: uppercase;
    text-decoration: underline;
    text-underline-offset: 2px;
    color: #000000 !important;
  }
  .real-doc-staff-subtext {
    margin: 2px 0 0;
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    font-weight: 400;
    color: #000000 !important;
  }
  
  .real-doc-thumbmark {
    margin-top: 0.10in;
    margin-left: 0.02in;
    width: 0.95in;
    height: 0.95in;
    border: 1.5px solid #000;
    display: block;
    background: transparent !important;
  }
  
  /* Indigency Document: Rockwell Condensed 14pt with underlined title and captain */
  .real-doc-indigency,
  .real-doc-indigency .real-doc-header,
  .real-doc-indigency .real-doc-header-text,
  .real-doc-indigency .real-doc-header-text div,
  .real-doc-indigency .real-doc-office,
  .real-doc-indigency .real-doc-to,
  .real-doc-indigency .real-doc-body,
  .real-doc-indigency .real-doc-body p,
  .real-doc-indigency .real-doc-signature,
  .real-doc-indigency .real-doc-subtext,
  .real-doc-indigency .real-doc-or,
  .real-doc-indigency .real-doc-or-table,
  .real-doc-indigency .real-doc-or-label,
  .real-doc-indigency .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
  }
  .real-doc-indigency .real-doc-header-text div { font-size: 14pt !important; font-weight: 400 !important; line-height: 1.15 !important; }
  .real-doc-indigency .real-doc-office { font-size: 14pt !important; font-weight: 400 !important; margin: 0.14in 0 0.04in !important; }
  .real-doc-indigency .real-doc-title {
    font-family: "Rockwell Condensed", "Rockwell", serif;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .real-doc-indigency .real-doc-to { font-size: 14pt !important; font-weight: 400 !important; margin-bottom: 0.16in !important; }
  .real-doc-indigency .real-doc-body { font-size: var(--doc-body-font-size, 14pt) !important; font-weight: 400 !important; line-height: var(--doc-line-height, 1.25); text-align: justify !important; }
  .real-doc-indigency .real-doc-body p { margin-bottom: 0.16in !important; text-indent: 0.5in !important; }
  .real-doc-indigency .real-doc-captain-name {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 16pt !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    text-decoration: underline !important;
    text-underline-offset: 3px !important;
  }
  .real-doc-indigency .real-doc-subtext { font-size: 14pt !important; font-weight: 400 !important; }
  .real-doc-indigency .real-doc-or,
  .real-doc-indigency .real-doc-or-table,
  .real-doc-indigency .real-doc-or-label,
  .real-doc-indigency .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
  }

  /* Residency Document: Rockwell Condensed 14pt with Felix Titling 18pt Title */
  .real-doc-residency,
  .real-doc-residency .real-doc-header,
  .real-doc-residency .real-doc-header-text,
  .real-doc-residency .real-doc-header-text div,
  .real-doc-residency .real-doc-office,
  .real-doc-residency .real-doc-to,
  .real-doc-residency .real-doc-body,
  .real-doc-residency .real-doc-body p,
  .real-doc-residency .real-doc-signature,
  .real-doc-residency .real-doc-subtext,
  .real-doc-residency .real-doc-or,
  .real-doc-residency .real-doc-or-table,
  .real-doc-residency .real-doc-or-label,
  .real-doc-residency .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
  }
  .real-doc-residency .real-doc-header-text div { font-size: 14pt !important; font-weight: 400 !important; line-height: 1.15 !important; }
  .real-doc-residency .real-doc-office { font-size: 14pt !important; font-weight: 400 !important; margin: 0.14in 0 0.04in !important; }
  .real-doc-residency .real-doc-title {
    font-family: "Felix Titling", serif;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .real-doc-residency .real-doc-to { font-size: 14pt !important; font-weight: 400 !important; margin-bottom: 0.16in !important; }
  .real-doc-residency .real-doc-body { font-size: var(--doc-body-font-size, 14pt) !important; font-weight: 400 !important; line-height: var(--doc-line-height, 1.25); text-align: justify !important; }
  .real-doc-residency .real-doc-body p { margin-bottom: 0.16in !important; text-indent: 0.5in !important; }
  .real-doc-residency .real-doc-captain-name {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    text-transform: uppercase;
    text-decoration: none !important;
  }
  .real-doc-residency .real-doc-subtext {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
  }
  .real-doc-residency .real-doc-or,
  .real-doc-residency .real-doc-or-table,
  .real-doc-residency .real-doc-or-label,
  .real-doc-residency .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
  }

  /* Business Document: Rockwell Condensed 14pt with Algerian 14pt Title */
  .real-doc-business,
  .real-doc-business .real-doc-header,
  .real-doc-business .real-doc-header-text,
  .real-doc-business .real-doc-header-text div,
  .real-doc-business .real-doc-office,
  .real-doc-business .real-doc-to,
  .real-doc-business .real-doc-body,
  .real-doc-business .real-doc-body p,
  .real-doc-business .real-doc-signature,
  .real-doc-business .real-doc-subtext,
  .real-doc-business .real-doc-or,
  .real-doc-business .real-doc-or-table,
  .real-doc-business .real-doc-or-label,
  .real-doc-business .real-doc-or-val {
    font-family: var(--doc-font-family, "Rockwell Condensed", "Rockwell-Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif, sans-serif);
  }
  .real-doc-business .real-doc-header { margin-bottom: 0.28in !important; min-height: 1.25in !important; }
  .real-doc-business .real-doc-header-text div { font-size: 14pt !important; font-weight: 400 !important; line-height: 1.18 !important; }
  .real-doc-business .real-doc-office { font-size: 14pt !important; font-weight: 400 !important; margin: 0.18in 0 0.24in !important; letter-spacing: 0.02em !important; text-transform: uppercase !important; }
  .real-doc-business .real-doc-title {
    font-family: "Algerian", "Algerian Regular", Impact, serif;
    font-size: 14pt;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-decoration: none;
    margin: 0.22in 0 0.38in !important;
  }
  .real-doc-business .real-doc-to { font-size: 14pt !important; font-weight: 700 !important; margin-bottom: 0.22in !important; text-align: left !important; }
  .real-doc-business .real-doc-body { font-size: var(--doc-body-font-size, 14pt) !important; font-weight: 400 !important; line-height: var(--doc-line-height, 1.28) !important; text-align: justify !important; }
  .real-doc-business .real-doc-body p { margin-bottom: 0.22in !important; text-indent: 0.5in !important; }
  .real-doc-business .real-doc-signature {
    width: 3.2in !important;
    margin: 0.75in 0 0 auto !important;
    text-align: center !important;
    line-height: 1.2 !important;
  }
  .real-doc-business .real-doc-captain-name {
    font-family: "Rockwell Condensed", "Rockwell-Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    text-transform: uppercase !important;
    text-decoration: none !important;
    letter-spacing: 0.02em !important;
  }
  .real-doc-business .real-doc-subtext {
    font-family: "Rockwell Condensed", "Rockwell-Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    margin-top: 2px !important;
  }
  .real-doc-business .real-doc-or,
  .real-doc-business-or {
    position: static !important;
    margin-top: 0.40in !important;
    width: 3.2in !important;
    text-align: left !important;
    font-size: 14pt !important;
    line-height: 1.35 !important;
  }
  .real-doc-business .real-doc-or-table {
    font-size: 14pt !important;
    border-collapse: separate !important;
    border-spacing: 0 4px !important;
  }
  .real-doc-business .real-doc-or-label {
    font-size: 14pt !important;
    font-weight: 400 !important;
    padding-right: 0.25in !important;
    white-space: nowrap !important;
    min-width: 1.1in !important;
  }
  .real-doc-business .real-doc-or-val {
    font-size: 14pt !important;
    font-weight: 400 !important;
    min-width: 1.4in !important;
    display: inline-block !important;
    border-bottom: 1.5px solid #000 !important;
    height: 18px !important;
    line-height: 18px !important;
    text-align: center !important;
    padding: 0 8px !important;
  }

  /* Barangay Certification / 4Ps Document: Rockwell Condensed 14pt with Algerian 14pt Title */
  .real-doc-certification,
  .real-doc-certification .real-doc-header,
  .real-doc-certification .real-doc-header-text,
  .real-doc-certification .real-doc-header-text div,
  .real-doc-certification .real-doc-office,
  .real-doc-certification .real-doc-to,
  .real-doc-certification .real-doc-body,
  .real-doc-certification .real-doc-body p,
  .real-doc-certification .real-doc-signature,
  .real-doc-certification .real-doc-subtext,
  .real-doc-certification .real-doc-or,
  .real-doc-certification .real-doc-or-table,
  .real-doc-certification .real-doc-or-label,
  .real-doc-certification .real-doc-or-val,
  .real-doc-4ps,
  .real-doc-4ps .real-doc-header,
  .real-doc-4ps .real-doc-header-text,
  .real-doc-4ps .real-doc-header-text div,
  .real-doc-4ps .real-doc-office,
  .real-doc-4ps .real-doc-to,
  .real-doc-4ps .real-doc-body,
  .real-doc-4ps .real-doc-body p,
  .real-doc-4ps .real-doc-signature,
  .real-doc-4ps .real-doc-subtext,
  .real-doc-4ps .real-doc-or,
  .real-doc-4ps .real-doc-or-table,
  .real-doc-4ps .real-doc-or-label,
  .real-doc-4ps .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
  }
  .real-doc-certification .real-doc-header-text div,
  .real-doc-4ps .real-doc-header-text div { font-size: 14pt !important; font-weight: 400 !important; line-height: 1.15 !important; }
  .real-doc-certification .real-doc-office,
  .real-doc-4ps .real-doc-office { font-size: 14pt !important; font-weight: 400 !important; margin: 0.14in 0 0.04in !important; }
  .real-doc-certification .real-doc-title,
  .real-doc-4ps .real-doc-title {
    font-family: "Algerian", serif;
    font-size: 14pt;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-decoration: none;
  }
  .real-doc-certification .real-doc-to,
  .real-doc-4ps .real-doc-to { font-size: 14pt !important; font-weight: 400 !important; margin-bottom: 0.16in !important; }
  .real-doc-certification .real-doc-body,
  .real-doc-4ps .real-doc-body { font-size: var(--doc-body-font-size, 14pt) !important; font-weight: 400 !important; line-height: var(--doc-line-height, 1.25); text-align: justify !important; }
  .real-doc-certification .real-doc-body p,
  .real-doc-4ps .real-doc-body p { margin-bottom: 0.16in !important; text-indent: 0.5in !important; }
  .real-doc-certification .real-doc-captain-name,
  .real-doc-4ps .real-doc-captain-name {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    text-transform: uppercase;
    text-decoration: none !important;
  }
  .real-doc-certification .real-doc-subtext,
  .real-doc-4ps .real-doc-subtext {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
  }
  .real-doc-certification .real-doc-or,
  .real-doc-certification .real-doc-or-table,
  .real-doc-certification .real-doc-or-label,
  .real-doc-certification .real-doc-or-val,
  .real-doc-4ps .real-doc-or,
  .real-doc-4ps .real-doc-or-table,
  .real-doc-4ps .real-doc-or-label,
  .real-doc-4ps .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
  }

  /* RSBSA Document: Agency FB with italic header */
  .real-doc-rsbsa,
  .real-doc-rsbsa * {
    font-family: "Agency FB", "Arial Narrow", sans-serif !important;
  }
  .real-doc-rsbsa .real-doc-header-text div:not(.real-doc-office) {
    font-size: 14pt !important;
    font-style: italic !important;
    font-weight: 400 !important;
  }
  .real-doc-rsbsa .real-doc-office {
    font-size: 14pt !important;
    font-style: normal !important;
    font-weight: 700 !important;
  }
  .real-doc-rsbsa .real-doc-to {
    font-size: 12pt !important;
    font-weight: 700 !important;
  }
  .real-doc-rsbsa .real-doc-body {
    font-size: var(--doc-body-font-size, 12pt) !important;
    font-weight: 400 !important;
    line-height: var(--doc-line-height, 1.2);
  }
  .real-doc-rsbsa-signatures {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 0.25in 0.5in;
    margin-top: 0.45in;
    text-align: center;
    font-size: 11pt;
    line-height: 1.2;
    color: #000000 !important;
  }
  .real-doc-rsbsa-cell {
    text-align: center;
  }
  .real-doc-rsbsa-cell .real-doc-line {
    margin: 0;
    font-size: 14pt;
  }
  .real-doc-rsbsa-cell .real-doc-subtext {
    margin: 2px 0 0;
    font-size: 11pt;
    font-style: italic;
  }
  .real-doc-rsbsa-note {
    margin-top: 0.35in;
    font-size: 11pt;
    font-style: italic;
  }

  /* Solo Parent Document: Times New Roman 14pt */
  .real-doc-solo,
  .real-doc-solo * {
    font-family: "Times New Roman", Times, serif !important;
  }
  .real-doc-solo .real-doc-header-text { font-size: 14pt !important; font-weight: 400 !important; }
  .real-doc-solo .real-doc-office { font-size: 14pt !important; font-weight: 700 !important; }
  .real-doc-solo .real-doc-to { font-size: 14pt !important; font-weight: 700 !important; }
  .real-doc-solo .real-doc-body { font-size: var(--doc-body-font-size, 14pt) !important; font-weight: 400 !important; line-height: var(--doc-line-height, 1.25); }
  .real-doc-solo .real-doc-captain-name {
    font-family: "Times New Roman", Times, serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    text-decoration: none !important;
  }
  .real-doc-solo .real-doc-subtext {
    font-family: "Times New Roman", Times, serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
  }

  /* O. R. No. / CTC box */
  .real-doc-or { position: absolute; left: 1.0in; bottom: 0.85in; font-family: inherit; font-size: 11pt; font-weight: 700; line-height: 1.3; color: #000000 !important; }
  .real-doc-clearance-or,
  .real-doc-indigency-or,
  .real-doc-residency-or,
  .real-doc-business-or,
  .real-doc-certification-or,
  .real-doc-4ps-or {
    position: static;
    margin-top: 0.25in;
    width: 3.2in;
    text-align: left;
    font-family: inherit;
    font-size: 11pt;
    font-weight: 700;
    line-height: 1.3;
  }
  .real-doc-or p { margin: 0; color: #000000 !important; }
  .real-doc-or-table { display: table; border-collapse: collapse; margin-top: 2px; font-family: inherit; font-size: 11pt; }
  .real-doc-or-row { display: table-row; }
  .real-doc-or-label { display: table-cell; padding-right: 0.22in; white-space: nowrap; font-family: inherit; font-size: 11pt; font-weight: 700; color: #000000 !important; }
  .real-doc-or-val { display: table-cell; min-width: 1.2in; text-align: left; font-family: inherit; font-size: 11pt; font-weight: 400; color: #000000 !important; }
  .real-doc-or-val u { text-decoration: underline; text-underline-offset: 2px; }
  
  .real-doc-shell[data-editable="true"] [contenteditable="true"] { border-radius: 2px; cursor: text; outline: 1px dashed transparent; outline-offset: 2px; transition: background-color 0.15s ease, outline-color 0.15s ease; }
  .real-doc-shell[data-editable="true"] [contenteditable="true"]:hover { background: rgba(37, 99, 235, 0.05); outline-color: rgba(37, 99, 235, 0.32); }
  .real-doc-shell[data-editable="true"] [contenteditable="true"]:focus { background: rgba(37, 99, 235, 0.08); outline-color: rgba(29, 78, 216, 0.72); }
  
  @page { size: letter; margin: 0; }
  @media print {
    html, body { margin: 0; padding: 0; background: #fff !important; }
    .real-doc-page { width: 8.5in; min-height: 11in; box-shadow: none; background: #fff !important; }
    .real-doc-shell [contenteditable="true"] { background: transparent !important; outline: none; }
  }
`;

export const getRealDocumentMarkup = ({ fields = {}, template = null, editable = false } = {}) => {
  const safeFields = fields || {};
  const customHeaderCfg = getCustomTemplateHeaderConfig(template || safeFields.documentType) || {};
  const headerCfg = {
    ...customHeaderCfg,
    ...(template?.header_config || {}),
  };
  const docKey = getRealDocumentTemplateKey(template || safeFields.documentType);
  const title = (docKey === "business" && (!headerCfg.title || headerCfg.title.toLowerCase().includes("business permit")))
    ? "C E R T I F I C A T I O N"
    : (headerCfg.title || getDocumentTitle(template));
  const paragraphs = getDocumentBodyHtml(safeFields, template);
  const printSettings = getPrintSettings(safeFields, template);

  const logoUrl = headerCfg.logoUrl || BARANGAY_SEAL_SRC;
  const logoAlign = headerCfg.logoAlignment || "left";
  const logoSize = headerCfg.logoSize ? `${headerCfg.logoSize}px` : "1.18in";
  const showLogo = headerCfg.showLogo !== false;
  const secondaryUrl = headerCfg.secondaryUrl || "/aleosan.logo.png";
  const secondarySize = headerCfg.secondarySize ? `${headerCfg.secondarySize}px` : "1.18in";
  const isDual = logoAlign === "dual" || Boolean(headerCfg.secondaryVisible);

  let sealHtml = "";
  if (showLogo) {
    if (logoAlign === "center") {
      sealHtml = `<div style="display:flex; justify-content:center; margin-bottom:8px;"><img src="${logoUrl}" alt="Barangay Seal" style="width:${logoSize}; height:${logoSize}; aspect-ratio:1/1; border-radius:50%; object-fit:contain;" /></div>`;
    } else if (logoAlign === "right") {
      sealHtml = `<img class="real-doc-seal" src="${logoUrl}" alt="Barangay Seal" style="left:auto; right:0.1in; width:${logoSize}; height:${logoSize};" />`;
    } else if (isDual) {
      sealHtml = `
        <img class="real-doc-seal" src="${logoUrl}" alt="Barangay Seal" style="left:0.1in; width:${logoSize}; height:${logoSize};" />
        <img class="real-doc-seal" src="${secondaryUrl}" alt="Municipal Seal" style="left:auto; right:0.1in; width:${secondarySize}; height:${secondarySize};" />
      `;
    } else {
      sealHtml = `<img class="real-doc-seal" src="${logoUrl}" alt="Barangay Seal" style="left:0.1in; width:${logoSize}; height:${logoSize};" />`;
    }
  }

  const country = headerCfg.country || "Republic of the Philippines";
  const province = headerCfg.province || "Province of Cotabato";
  const municipality = headerCfg.municipality || "Municipality of Aleosan";
  const barangay = headerCfg.barangay || "Barangay of Upper Mingading";
  const office = headerCfg.office || "OFFICE OF THE PUNONG BARANGAY";
  const salutation = headerCfg.salutation || "TO WHOM IT MAY CONCERN:";
  const renderedTitle = headerCfg.titleHtml || headerCfg.title || title;

  return `
    <style>${REAL_DOCUMENT_CSS}</style>
    <main class="real-doc-shell" ${editable ? 'data-editable="true"' : ""}>
      <article
        class="real-doc-page real-doc-${docKey}"
        style="--doc-font-family: ${printSettings.fontFamily}; --doc-body-font-size: ${printSettings.bodyFontSizePt}pt; --doc-line-height: ${printSettings.lineHeight}; --doc-paragraph-gap: ${printSettings.paragraphGap}in; --doc-padding: ${printSettings.padding};"
      >
        <div class="real-doc-header" style="${logoAlign === 'center' ? 'padding-top: 4px;' : ''}">
          ${sealHtml}
          <div class="real-doc-header-text">
            <div>${country}</div>
            <div>${province}</div>
            <div>${municipality}</div>
            <div>${barangay}</div>
            <div class="real-doc-office">${office}</div>
          </div>
        </div>
        <h1 class="real-doc-title">${renderedTitle}</h1>
        <p class="real-doc-to">${salutation}</p>
        <section class="real-doc-body" ${getEditableBodyAttributes(editable)}>${paragraphs}</section>
        ${getDocumentFooter(safeFields, template, editable)}
        ${getDocumentExtras(safeFields, template, editable)}
      </article>
    </main>
  `;
};

export const getRealDocumentPrintMarkup = ({ fields = {}, template = null } = {}) => {
  const safeFields = fields || {};
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Official Barangay Document - Print</title>
  <style>
    @page {
      size: letter;
      margin: 0 !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${getRealDocumentMarkup({ fields: safeFields, template })}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;
};
