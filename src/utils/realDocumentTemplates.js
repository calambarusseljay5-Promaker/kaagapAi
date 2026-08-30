export const BARANGAY_SEAL_SRC = "/logo.png";
export const PUNONG_BARANGAY = "MAMERTO C. CLARITO";
export const DEFAULT_PREPARED_BY = "";

export const normalizeDocumentTemplateText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const REAL_DOCUMENT_TEMPLATES = [
  {
    id: "real-barangay-clearance",
    template_name: "Barangay Clearance",
    document_type: "Barangay Clearance",
    description: "Official barangay clearance based on existing barangay records.",
    requirements: "Valid ID; proof of residency; purpose of request",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/cert.barangay-clearance.docx",
  },
  {
    id: "real-certificate-residency",
    template_name: "Certificate of Residency",
    document_type: "Certificate of Residency",
    description: "Certifies that the requester is a bona fide resident of Barangay Upper Mingading.",
    requirements: "Valid ID; proof of residency; purpose of request",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/Cert.Residency-Templates.docx",
  },
  {
    id: "real-certificate-indigency",
    template_name: "Certificate of Indigency",
    document_type: "Certificate of Indigency",
    description: "Certifies low-income or indigent status for assistance and official requirements.",
    requirements: "Valid ID; proof of residency; purpose of request",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/Cert.indigency-templates.docx",
  },
  {
    id: "real-business-permit",
    template_name: "Business Permit",
    document_type: "Business Permit",
    description: "Barangay certification for business permit application and local business verification.",
    requirements: "Valid ID; barangay clearance; business details; purpose of request",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/Cert.BUSINESS-Permit.docx",
  },
  {
    id: "real-rsbsa-certification",
    template_name: "RSBSA Certification",
    document_type: "RSBSA Certification",
    description: "Certification for farmers and fisherfolk RSBSA registration.",
    requirements: "Valid ID; farm or crop details; proof of residency",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/cert.Rsbsa-templates.docx",
  },
  {
    id: "real-solo-parent-certification",
    template_name: "Solo Parent Certification",
    document_type: "Solo Parent Certification",
    description: "Barangay certification supporting solo parent application or related legal purpose.",
    requirements: "Valid ID; proof of residency; supporting solo parent document; purpose of request",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/Cert.-solo-parent-Templates.docx",
  },
  {
    id: "real-4ps-certification",
    template_name: "4Ps Certification",
    document_type: "4Ps Certification",
    description: "Barangay certification for Pantawid Pamilyang Pilipino Program requirements.",
    requirements: "Valid ID; proof of residency; 4Ps details; purpose of request",
    processing_time: "1 day",
    fee: "As assessed by barangay office",
    template_file_path: "/files/document-templates/Barangay-Cert.templates.-4ps.docx",
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

  if (normalized.includes("clearance")) return "clearance";
  if (normalized.includes("residency") || normalized.includes("residence")) return "residency";
  if (normalized.includes("indigency")) return "indigency";
  if (normalized.includes("business") || normalized.includes("permit")) return "business";
  if (normalized.includes("rsbsa")) return "rsbsa";
  if (normalized.includes("solo")) return "solo";
  if (normalized.includes("4ps")) return "4ps";

  return "certification";
};

export const mergeRealDocumentTemplates = (templates = []) => {
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
    const dbTemplate = realRowsByKey.get(getRealDocumentTemplateKey(template));

    if (!dbTemplate) return template;

    return {
      ...template,
      ...dbTemplate,
      template_file_path: getTemplateFilePath(dbTemplate) || template.template_file_path,
    };
  });

  const customTemplates = templates.filter((template) => {
    const templateNameKey = normalizeDocumentTemplateText(template.template_name);
    const documentTypeKey = normalizeDocumentTemplateText(template.document_type);
    const isLegacyOnly =
      LEGACY_TEMPLATE_KEYS.has(templateNameKey) || LEGACY_TEMPLATE_KEYS.has(documentTypeKey);

    return !isLegacyOnly && !realTemplateKeys.has(getRealDocumentTemplateKey(template));
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
    if (s.includes("married")) return `single/ <u>married</u>`;
    if (s.includes("widow") || s.includes("widower")) return `single/ married/ <u>${widowText}</u>`;
    return `<u>single</u>/ married`;
  }
  if (s.includes("married")) {
    return allowSeparated ? `single/ <u>married</u>/ ${widowText}/ separated` : `single/ <u>married</u>/ ${widowText}`;
  }
  if (s.includes("widow") || s.includes("widower")) {
    return allowSeparated ? `single/ married/ <u>${widowText}</u>/ separated` : `single/ married/ <u>${widowText}</u>`;
  }
  if (allowSeparated && s.includes("separated")) {
    return `single/ married/ ${widowText}/ <u>separated</u>`;
  }
  return allowSeparated ? `<u>single</u>/ married/ ${widowText}/ separated` : `<u>single</u>/ married/ ${widowText}`;
};

const getGenderFormatted = (gender) => {
  const g = String(gender || "").toLowerCase().trim();
  const isFemale = g === "female" || g === "f";
  return {
    isFemale,
    maleFemale: isFemale ? "male/ <u>female</u>" : "<u>male</u>/ female",
    hisHer: isFemale ? "his/ <u>her</u>" : "<u>his</u>/ her",
    herHis: isFemale ? "<u>her</u> /his" : "her /<u>his</u>",
    herHisThird: isFemale ? "<u>her</u>/ his" : "her/ <u>his</u>",
    himHer: isFemale ? "her" : "him",
    himHerSlash: isFemale ? "him/ <u>her</u>" : "<u>him</u>/ her",
    heShe: isFemale ? "she" : "he",
    hisHerCap: isFemale ? "His/ <u>Her</u>" : "<u>His</u>/ Her",
  };
};

const getPrefixFormatted = (gender, civilStatus) => {
  const g = String(gender || "").toLowerCase().trim();
  const s = String(civilStatus || "").toLowerCase().trim();
  const isFemale = g === "female" || g === "f";
  if (!isFemale) return "Ms./<u>Mr</u>/Mrs.";
  if (s.includes("married") || s.includes("widow")) return "Ms./Mr/<u>Mrs.</u>";
  return "<u>Ms.</u>/Mr/Mrs.";
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

    return [
      `This is to certify according to our existing records that ${prefixStr} ${name}, ${age} yrs. Old, Filipino ${civilStatus}, whose signature and thumbmark appear below is presently a resident of Purok ${escapeHtml(purokName)}, Upper Mingading, Aleosan, Cotabato and no current position in the Barangay.`,
      `This is to certify further, that ${genderMap.herHis} character, reputation and moral standing in the community are beyond reproach and that as of the date of this issued there is no pending case whatsoever filed against the above – named person for whatever any legal purpose which may serve ${genderMap.hisHer} best.`,
      `This is to certify further more that in view of the foregoing circumstances, this Barangay Clearance is issued upon request of the above – named person for <strong>${purposeVal}</strong> and whatever any legal purpose which may serve ${genderMap.herHisThird} best.`,
      `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "business") {
    const businessName = safeFields.businessName || rawPurpose || "BANANA BUY AND SALE";
    const formattedBusinessName = `<strong>${escapeHtml(businessName.toUpperCase())}</strong>`;
    const purokClean = getPurokName(safeFields, true) || "Azucena";

    return [
      `This is to certify that ${name}, ${age} yrs. old, Filipino, ${civilStatus}, a bona fide resident of Purok ${escapeHtml(purokClean)}, Barangay Upper Mingading, Aleosan, Cotabato, and ${genderMap.heShe} has a ${formattedBusinessName} at the said place.`,
      `This certification is being issued upon the request of the above-mentioned name person for Business Permit Application and for whatever any legal purposes may serve ${genderMap.himHerSlash} best.`,
      `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "indigency") {
    const civilStatusIndigency = getCivilStatusFormatted(safeFields.civilStatus, false, true);
    const rawPurpose = getPurposePhrase(safeFields);
    const purokClean = getPurokName(safeFields, true) || "Buklod";
    let purposeSuffix = "and for whatever legal purpose it may serve best.";
    if (rawPurpose) {
      const cleanP = rawPurpose.replace(/^for\s+/i, "");
      purposeSuffix = `for <strong>${escapeHtml(cleanP.toUpperCase())}</strong> and for whatever legal purpose it may serve best.`;
    }

    return [
      `THIS IS TO CERTIFY that ${name}, ${age} yrs. old ${civilStatusIndigency} and a bonafide resident of Purok ${escapeHtml(purokClean)}, Upper Mingading, Aleosan, Cotabato a low income earner family and considered as indigent.`,
      `This certification is issued upon the request of above-named person ${purposeSuffix}`,
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
      `THIS IS TO CERTIFY that ${name}, ${genderMap.maleFemale}, ${civilStatusResidency}, ${birthphrase} a bona fide citizen of Purok ${escapeHtml(purokClean)}, Upper Mingading, Aleosan, Cotabato. ${genderMap.hisHerCap}, reputation and moral standing in the community is beyond reproach and that is no pending case filed on said person whatsoever. From our barangay peace and order committee we are recommending ${pronounHim} ${recommendationMarkup}`,
      `This certification is issued upon the request of above-named person for whatever legal purpose it may serve best.`,
      `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "rsbsa") {
    const cropsText = safeFields.cropsText || safeFields.remarks || "Rice Field ½ hectare, and Fruits Crops 1 hectare";
    const farmSize = safeFields.farmSize || "One ( 1 ) hectare";
    const tenure = safeFields.tenure || "Owner";
    const purokClean = getPurokName(safeFields, true) || "Buklod";
    const addressStr = safeFields.address || `Purok ${purokClean}`;

    return [
      `THIS IS TO CERTIFY THAT ${name} ${age} y/o, residing at ${escapeHtml(addressStr)}, Upper Mingading Aleosan, Cotabato, is tilling the following crop(s) <strong>${escapeHtml(cropsText)}</strong> as <u>${escapeHtml(tenure)}</u>/Farmer at Purok ${escapeHtml(purokClean)}, Upper Mingading, Cotabato with size ${escapeHtml(farmSize)}.`,
      `This <strong>CERTIFICATION</strong> is being issued by the Barangay solely for the purpose of the farmers and fisher folk registration to the <strong>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE (RSBSA)</strong> of the Department of Agriculture and may not be used for other purposes not mention above.`,
    ];
  }

  if (key === "solo") {
    const soloReason = getSoloParentReason(safeFields, genderMap);
    const purokSolo = getPurokName(safeFields, true) || "Kamonsil";

    return [
      `This is to certify that ${name} legal age, Filipino, ${civilStatusSolo}, a bona fide resident of Purok ${escapeHtml(purokSolo)}, Barangay Upper Mingading, Aleosan, Cotabato.`,
      `This certification is being issued upon the request of the above-mentioned name person on application for solo parent due to <strong>${escapeHtml(soloReason)}</strong> and whatever any legal intent may serve best.`,
      `Issued this <u>${ordinalDay}</u> day of <u>${monthName} ${year}</u> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  if (key === "4ps") {
    const purokText = getPurokName(safeFields, true) || "Muslim";
    const fourPsPurpose = (safeFields.fourPsPurpose || safeFields.purpose || "").trim();
    let purposeText = "";

    if (fourPsPurpose) {
      purposeText = escapeHtml(fourPsPurpose.replace(/^for\s+/i, ""));
    } else if (safeFields.fourPsSpouse) {
      purposeText = `Change Grantee of ${genderMap.herHis} wife ${escapeHtml(safeFields.fourPsSpouse)} working Abroad`;
    } else {
      purposeText = `Change Grantee of ${genderMap.herHis} wife working Abroad`;
    }

    if (!/legal purpose/i.test(purposeText)) {
      purposeText = `${purposeText.replace(/[.,\s]+$/, "")} and for whatever any legal purposes.`;
    } else if (!purposeText.endsWith(".")) {
      purposeText += ".";
    }

    return [
      `This is to certify that ${name}, ${age} yrs. old, Filipino, ${civilStatus}, a bona fide resident of Purok ${escapeHtml(purokText)}, Barangay Upper Mingading, Aleosan, Cotabato.`,
      `This certification is being issued upon the request of the above-mentioned name person for ${purposeText}`,
      `Issued this <u>${ordinalDay}</u> day <u>of ${monthName}</u> <strong>${year}</strong> at Barangay Upper Mingading, Aleosan, Cotabato.`,
    ];
  }

  return [
    `This is to certify that ${name}, ${age} yrs. old, Filipino, ${civilStatus}, a bona fide resident of Purok ${escapeHtml(purok)}, Barangay Upper Mingading, Aleosan, Cotabato.`,
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
  try {
    const raw = localStorage.getItem("kaagapai_document_templates_v1");
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const key = getRealDocumentTemplateKey(templateOrType);
    const found = list.find((t) => getRealDocumentTemplateKey(t) === key && t.status !== "Archived");
    return found?.content || null;
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

  const replacements = {
    "{{FULL_NAME}}": name,
    "{{AGE}}": age,
    "{{SEX}}": genderMap.maleFemale,
    "{{GENDER}}": genderMap.maleFemale,
    "{{CIVIL_STATUS}}": civilStatus,
    "{{ADDRESS}}": fields.address || `Purok ${purok}, Upper Mingading, Aleosan, Cotabato`,
    "{{PUROK}}": purok,
    "{{PURPOSE}}": purpose,
    "{{DATE}}": `${monthName} ${ordinalDay}, ${year}`,
    "{{DAY}}": ordinalDay,
    "{{MONTH}}": monthName,
    "{{YEAR}}": String(year),
    "{{BIRTHDAY}}": birthdateStr,
    "{{DATE_OF_BIRTH}}": birthdateStr,
    "{{BARANGAY_CAPTAIN}}": PUNONG_BARANGAY,
    "{{BUSINESS_NAME}}": escapeHtml(fields.businessName || "BANANA BUY AND SALE"),
    "{{SOLO_PARENT_REASON}}": escapeHtml(getSoloParentReason(fields, genderMap)),
    "{{CROPS_DETAILS}}": escapeHtml(fields.cropsText || "Rice Field ½ hectare, and Fruits Crops 1 hectare"),
    "{{FARM_SIZE}}": escapeHtml(fields.farmSize || "One ( 1 ) hectare"),
  };

  let result = String(content);
  Object.entries(replacements).forEach(([token, val]) => {
    const regex = new RegExp(token.replace(/[{}]/g, "\\$&"), "gi");
    result = result.replace(regex, val);
  });
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
  const isRockwellDoc = key === "residency" || key === "indigency" || key === "business" || key === "rsbsa" || key === "4ps";
  const defaultFont = isRockwellDoc ? "rockwell" : "times";
  const defaultFontSize = isRockwellDoc ? 14 : 12;
  const defaultLineHeight = 1.25;
  const defaultParagraphGap = 0.16;
  const defaultPadding = "1.0in 1.0in 1.0in 1.0in";

  const marginMap = {
    narrow: "0.5in 0.5in 0.5in 0.5in",
    wide: "1.2in 1.2in 1.2in 1.2in",
    normal: defaultPadding,
  };
  const fontMap = {
    "times": '"Times New Roman", Times, "Liberation Serif", serif',
    "felix": '"Felix Titling", "Felix-Titling", "Times New Roman", serif',
    "charlemagne": '"Charlemagne Std", "Charlemagne", "Times New Roman", serif',
    "cooper": '"Cooper Std Black", "Cooper Black", serif, sans-serif',
    "rockwell": '"Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Tw Cen MT", "Arial Narrow", Impact, serif, sans-serif',
    "arial": 'Arial, Helvetica, sans-serif',
    "arial-narrow": '"Arial Narrow", Arial, sans-serif',
    "georgia": 'Georgia, serif',
    "calibri": 'Calibri, sans-serif',
  };

  const chosenFont = safeFields.printFontFamily || defaultFont;
  const chosenSizePt = clampNumber(safeFields.printFontSize, 8, 24, defaultFontSize);
  const chosenLineHeight = clampNumber(safeFields.printLineHeight, 1.1, 2.2, defaultLineHeight);
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
  return "CERTIFICATION";
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
    : `<strong>${officer}</strong>`;

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

  // Solo parent certificates should completely omit the OR block
  if (key === "solo") {
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

  if (key === "business" || key === "4ps") {
    return `
      <section class="real-doc-or real-doc-4ps-or">
        <div class="real-doc-or-table">
          <div class="real-doc-or-row"><span class="real-doc-or-label">OR No.</span><span class="real-doc-or-val">${orVal}</span></div>
          <div class="real-doc-or-row"><span class="real-doc-or-label">Date Issued:</span><span class="real-doc-or-val">${dateVal}</span></div>
        </div>
      </section>
    `;
  }

  return "";
};

export const REAL_DOCUMENT_CSS = `
  @font-face {
    font-family: 'Felix Titling';
    src: local('Felix Titling'), local('Felix-Titling'), local('FelixTitling'), local('Times New Roman');
  }
  @font-face {
    font-family: 'Rockwell Condensed';
    font-style: normal;
    font-weight: 400;
    src: local('Rockwell Condensed'), local('Rockwell-Condensed'), local('Arial Narrow');
  }
  @font-face {
    font-family: 'Rockwell Condensed';
    font-style: normal;
    font-weight: 700;
    src: local('Rockwell Condensed Bold'), local('Rockwell-Condensed-Bold'), local('Arial Narrow Bold');
  }
  @font-face {
    font-family: 'Charlemagne Std';
    src: local('Charlemagne Std'), local('CharlemagneStd-Bold'), local('Charlemagne Std Bold'), local('Charlemagne'), local('Times New Roman');
  }
  @font-face {
    font-family: 'Cooper Std Black';
    src: local('Cooper Std Black'), local('CooperStdBlack'), local('Cooper Black'), local('CooperBlack'), local('Impact'), serif;
  }
  @font-face {
    font-family: 'Algerian';
    src: local('Algerian'), local('Algerian Regular');
  }
  @font-face {
    font-family: 'Agency FB';
    src: local('Agency FB'), local('AgencyFB-Reg'), local('Arial Narrow');
  }

  html, body { margin: 0; padding: 0; background: #fff; }
  .real-doc-shell, .real-doc-shell * { box-sizing: border-box; }
  .real-doc-shell { font-family: var(--doc-font-family, "Times New Roman", Times, serif); color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .real-doc-page { position: relative; width: 8.5in; min-height: 11in; margin: 0 auto; padding: var(--doc-padding, 1.0in 1.0in 1.0in 1.0in); background: #fff; box-shadow: 0 0 0 1px #d7d7d7; }
  
  /* Strictly Centered Header with Perfectly Circular Floating Left Logo */
  .real-doc-header { position: relative; min-height: 1.22in; padding-bottom: 0.08in; margin-bottom: 0.22in; font-family: inherit; font-size: 12pt; line-height: 1.2; background: transparent !important; color: #000000 !important; text-align: center; }
  .real-doc-clearance .real-doc-header, .real-doc-indigency .real-doc-header, .real-doc-residency .real-doc-header, .real-doc-rsbsa .real-doc-header { border-bottom: 1.5px solid #000 !important; }
  .real-doc-4ps .real-doc-header, .real-doc-solo .real-doc-header, .real-doc-business .real-doc-header { border-bottom: none !important; }
  .real-doc-seal { position: absolute; left: 0.1in; top: -0.05in; width: 1.18in; height: 1.18in; aspect-ratio: 1 / 1; border-radius: 50%; object-fit: contain; background: transparent !important; display: block; }
  .real-doc-header-text { width: 100%; text-align: center; margin: 0 auto; background: transparent !important; color: #000000 !important; font-size: 12pt; line-height: 1.2; font-family: inherit; font-weight: 400; }
  .real-doc-header-text div { background: transparent !important; color: #000000 !important; }
  .real-doc-office { margin: 0.14in 0 0.02in; font-family: inherit; font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; text-align: center; background: transparent !important; color: #000000 !important; }
  
  /* BARANGAY CLEARANCE title in Cooper Std Black, Bold, 16pt */
  .real-doc-title { margin: 0.22in 0 0.18in; text-align: center; font-family: inherit; font-size: 14pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #000000 !important; }
  .real-doc-clearance .real-doc-title { font-family: "Cooper Std Black", "Cooper Black", "CooperBlack", serif, sans-serif; font-size: 16pt; font-weight: 900; letter-spacing: 0.04em; text-decoration: none; }
  .real-doc-4ps .real-doc-title, .real-doc-business .real-doc-title { font-family: inherit; font-size: 14pt; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; }
  .real-doc-solo .real-doc-title { font-family: inherit; font-size: 14pt; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; }
  .real-doc-indigency .real-doc-title { font-family: "Times New Roman", "Felix Titling", serif; text-decoration: underline; text-underline-offset: 3px; font-size: 14pt; font-weight: 700; letter-spacing: 0.18em; }
  .real-doc-rsbsa .real-doc-title { font-family: inherit; font-size: 14pt; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; }
  
  /* CERTIFICATION Title for Residency in Felix Titling, 18pt, Bold, Underline */
  .real-doc-residency .real-doc-title {
    font-family: "Felix Titling", "Felix-Titling", "Times New Roman", serif !important;
    font-size: 18pt !important;
    font-weight: 700 !important;
    letter-spacing: 0.03em !important;
    text-transform: uppercase !important;
    text-decoration: underline !important;
    text-underline-offset: 3px !important;
    color: #000000 !important;
  }
  
  .real-doc-to { margin: 0 0 0.18in; font-family: inherit; font-size: 12pt; font-weight: 700; text-transform: uppercase; color: #000000 !important; text-align: left; }
  
  .real-doc-body { font-family: inherit; font-size: var(--doc-body-font-size, 12pt); line-height: var(--doc-line-height, 1.25); text-align: justify; color: #000000 !important; font-weight: 400; }
  .real-doc-body p { margin: 0 0 var(--doc-paragraph-gap, 0.16in); text-indent: 0.5in; color: #000000 !important; font-weight: 400; }
  .real-doc-body strong { font-weight: 700 !important; color: #000000 !important; }
  .real-doc-body u { text-decoration: underline; text-underline-offset: 2px; color: #000000 !important; }
  
  /* Captain MAMERTO C. CLARITO in Charlemagne Std, 16pt, Bold (for Clearance/Default) */
  .real-doc-signature { width: 3.4in; margin: 0.55in 0 0 auto; text-align: center; font-family: "Times New Roman", Times, serif; line-height: 1.2; color: #000000 !important; }
  .real-doc-clearance-signature { margin-top: 0.65in; margin-right: 0.15in; }
  .real-doc-clearance-signature .real-doc-captain-name { text-decoration: underline; text-underline-offset: 2px; }
  .real-doc-captain-name { margin: 0; font-family: "Charlemagne Std", "CharlemagneStd-Bold", "Charlemagne", "Times New Roman", serif; font-size: 16pt; font-weight: 700; text-transform: uppercase; color: #000000 !important; letter-spacing: 0.02em; }
  .real-doc-subtext { margin: 2px 0 0; font-family: "Times New Roman", Times, serif; font-size: 12pt; font-weight: 400; color: #000000 !important; }
  
  /* Indigency Document: Rockwell Condensed 14pt */
  .real-doc-indigency {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-indigency .real-doc-header,
  .real-doc-indigency .real-doc-header-text,
  .real-doc-indigency .real-doc-office,
  .real-doc-indigency .real-doc-to,
  .real-doc-indigency .real-doc-body,
  .real-doc-indigency .real-doc-signature,
  .real-doc-indigency .real-doc-subtext,
  .real-doc-indigency .real-doc-or {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-indigency .real-doc-header-text {
    font-size: 14pt !important;
    font-weight: 400 !important;
  }
  .real-doc-indigency .real-doc-office {
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-indigency .real-doc-to {
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-indigency .real-doc-body {
    font-size: var(--doc-body-font-size, 14pt) !important;
    font-weight: 400 !important;
    line-height: var(--doc-line-height, 1.25);
  }
  .real-doc-indigency .real-doc-title {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 16pt !important;
    font-weight: 700 !important;
    letter-spacing: 0.04em !important;
    text-transform: uppercase !important;
    text-decoration: underline !important;
    text-underline-offset: 3px !important;
    color: #000000 !important;
  }
  .real-doc-indigency .real-doc-captain-name {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    color: #000000 !important;
    letter-spacing: 0.02em;
    text-decoration: underline !important;
    text-underline-offset: 2px !important;
  }
  .real-doc-indigency .real-doc-subtext {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    color: #000000 !important;
  }
  .real-doc-indigency .real-doc-or {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
  }
  .real-doc-indigency .real-doc-or-table,
  .real-doc-indigency .real-doc-or-label,
  .real-doc-indigency .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
  }

  /* Residency Document: Rockwell Condensed 14pt with Felix Titling 18pt Title */
  .real-doc-residency {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-residency .real-doc-header,
  .real-doc-residency .real-doc-header-text,
  .real-doc-residency .real-doc-office,
  .real-doc-residency .real-doc-to,
  .real-doc-residency .real-doc-body,
  .real-doc-residency .real-doc-signature,
  .real-doc-residency .real-doc-subtext,
  .real-doc-residency .real-doc-or {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-residency .real-doc-header-text {
    font-size: 14pt !important;
    font-weight: 400 !important;
  }
  .real-doc-residency .real-doc-office {
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-residency .real-doc-to {
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-residency .real-doc-body {
    font-size: var(--doc-body-font-size, 14pt) !important;
    font-weight: 400 !important;
    line-height: var(--doc-line-height, 1.25);
  }
  .real-doc-residency .real-doc-signature {
    width: 3.4in;
    margin: 0.55in 0 0 auto;
    text-align: center;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    line-height: 1.2;
    color: #000000 !important;
  }
  .real-doc-residency .real-doc-captain-name {
    margin: 0;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    color: #000000 !important;
    letter-spacing: 0.02em;
    text-decoration: none !important;
  }
  .real-doc-residency .real-doc-subtext {
    margin: 2px 0 0;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    color: #000000 !important;
  }
  .real-doc-residency .real-doc-or {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
  }
  .real-doc-residency .real-doc-or-table,
  .real-doc-residency .real-doc-or-label,
  .real-doc-residency .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
  }

  /* Business Document: Rockwell Condensed 14pt with Cooper Std Black Title */
  .real-doc-business {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-business .real-doc-header,
  .real-doc-business .real-doc-header-text,
  .real-doc-business .real-doc-office,
  .real-doc-business .real-doc-to,
  .real-doc-business .real-doc-body,
  .real-doc-business .real-doc-signature,
  .real-doc-business .real-doc-subtext,
  .real-doc-business .real-doc-or {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-business .real-doc-header-text {
    font-size: 14pt !important;
    font-weight: 400 !important;
  }
  .real-doc-business .real-doc-office {
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-business .real-doc-to {
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-business .real-doc-body {
    font-size: var(--doc-body-font-size, 14pt) !important;
    font-weight: 400 !important;
    line-height: var(--doc-line-height, 1.25);
  }
  .real-doc-business .real-doc-title {
    font-family: "Cooper Std Black", "Cooper Black", "CooperBlack", serif, sans-serif !important;
    font-size: 16pt !important;
    font-weight: 900 !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    text-decoration: none !important;
    color: #000000 !important;
  }
  .real-doc-business .real-doc-signature {
    width: 3.4in;
    margin: 0.55in 0 0 auto;
    text-align: center;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    line-height: 1.2;
    color: #000000 !important;
  }
  .real-doc-business .real-doc-captain-name {
    margin: 0;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    color: #000000 !important;
    letter-spacing: 0.02em;
    text-decoration: none !important;
  }
  .real-doc-business .real-doc-subtext {
    margin: 2px 0 0;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    color: #000000 !important;
  }
  .real-doc-business .real-doc-or {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
  }
  .real-doc-business .real-doc-or-table,
  .real-doc-business .real-doc-or-label,
  .real-doc-business .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
  }

  /* RSBSA Document: Rockwell Condensed 14pt */
  .real-doc-rsbsa {
    font-family: "Rockwell Condensed", "Agency FB", "Arial Narrow", serif !important;
  }
  .real-doc-rsbsa .real-doc-header,
  .real-doc-rsbsa .real-doc-header-text,
  .real-doc-rsbsa .real-doc-office,
  .real-doc-rsbsa .real-doc-to,
  .real-doc-rsbsa .real-doc-body,
  .real-doc-rsbsa .real-doc-rsbsa-signatures,
  .real-doc-rsbsa-note {
    font-family: "Rockwell Condensed", "Agency FB", "Arial Narrow", serif !important;
  }
  .real-doc-rsbsa .real-doc-header-text {
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
    font-size: 14pt !important;
    font-weight: 700 !important;
  }
  .real-doc-rsbsa .real-doc-body {
    font-size: var(--doc-body-font-size, 14pt) !important;
    font-weight: 400 !important;
    line-height: var(--doc-line-height, 1.25);
  }
  .real-doc-rsbsa .real-doc-title {
    font-family: "Rockwell Condensed", "Agency FB", "Arial Narrow", serif !important;
    font-size: 16pt !important;
    font-weight: 700 !important;
    letter-spacing: 0.15em !important;
    text-transform: uppercase !important;
    text-decoration: none !important;
    color: #000000 !important;
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
    font-size: 12pt;
  }
  .real-doc-rsbsa-cell .real-doc-subtext {
    margin: 2px 0 0;
    font-size: 10.5pt;
    font-style: italic;
  }

  /* 4Ps Document: Rockwell Condensed 14pt with Cooper Std Black Title */
  .real-doc-4ps,
  .real-doc-4ps * {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
  }
  .real-doc-4ps .real-doc-header-text {
    font-size: 14pt !important;
    font-weight: 400 !important;
    line-height: 1.15 !important;
  }
  .real-doc-4ps .real-doc-office {
    font-size: 14pt !important;
    font-weight: 700 !important;
    margin-top: 0.18in !important;
  }
  .real-doc-4ps .real-doc-title {
    font-family: "Cooper Std Black", "Cooper Black", "CooperBlack", serif, sans-serif !important;
    font-size: 16pt !important;
    font-weight: 900 !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    text-decoration: none !important;
    color: #000000 !important;
    margin-top: 0.35in !important;
    margin-bottom: 0.35in !important;
  }
  .real-doc-4ps .real-doc-to {
    font-size: 14pt !important;
    font-weight: 700 !important;
    margin-top: 0.25in !important;
    margin-bottom: 0.22in !important;
  }
  .real-doc-4ps .real-doc-body {
    font-size: var(--doc-body-font-size, 14pt) !important;
    font-weight: 400 !important;
    line-height: var(--doc-line-height, 1.25);
  }
  .real-doc-4ps .real-doc-body p {
    margin-bottom: 0.22in !important;
    text-indent: 0.5in !important;
  }
  .real-doc-4ps .real-doc-signature {
    width: 3.4in !important;
    margin: 0.55in 0 0 auto !important;
    text-align: center !important;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    line-height: 1.2 !important;
    color: #000000 !important;
  }
  .real-doc-4ps .real-doc-captain-name {
    margin: 0 !important;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    color: #000000 !important;
    letter-spacing: 0.02em !important;
    text-decoration: none !important;
  }
  .real-doc-4ps .real-doc-subtext {
    margin: 2px 0 0 !important;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 14pt !important;
    font-weight: 400 !important;
    color: #000000 !important;
  }
  .real-doc-4ps .real-doc-or {
    position: static !important;
    margin-top: 0.35in !important;
    width: 3.2in !important;
    text-align: left !important;
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
    line-height: 1.3 !important;
  }
  .real-doc-4ps .real-doc-or-table,
  .real-doc-4ps .real-doc-or-row,
  .real-doc-4ps .real-doc-or-label {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
  }
  .real-doc-4ps .real-doc-or-val {
    font-family: "Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif !important;
    font-size: 12pt !important;
    font-weight: 400 !important;
  }
  
  /* FATMAH S. SUMPAO in Times New Roman, 12pt, Bold */
  .real-doc-clearance-staff { margin-top: 0.18in; width: 2.8in; text-align: left; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.15; color: #000000 !important; }
  .real-doc-clearance-staff p { margin: 0; color: #000000 !important; }
  .real-doc-staff-name { font-family: "Times New Roman", Times, serif; font-size: 12pt; font-weight: 700; text-transform: uppercase; color: #000000 !important; }
  .real-doc-staff-subtext { margin: 2px 0 0; font-family: "Times New Roman", Times, serif; font-size: 11pt; font-weight: 400; color: #000000 !important; }
  
  .real-doc-thumbmark { margin-top: 0.10in; margin-left: 0.02in; width: 0.95in; height: 0.95in; border: 1.5px solid #000; display: block; background: transparent !important; }
  
  /* O. R. No. / CTC box in Times New Roman, 11pt, Bold labels */
  .real-doc-or { position: absolute; left: 1.0in; bottom: 0.85in; font-family: "Times New Roman", Times, serif; font-size: 11pt; font-weight: 700; line-height: 1.3; color: #000000 !important; }
  .real-doc-4ps .real-doc-or, .real-doc-business .real-doc-or, .real-doc-clearance-or, .real-doc-indigency-or, .real-doc-residency-or { position: static; margin-top: 0.25in; width: 3.2in; text-align: left; font-family: "Times New Roman", Times, serif; font-size: 11pt; font-weight: 700; line-height: 1.3; }
  .real-doc-or p { margin: 0; color: #000000 !important; }
  .real-doc-or-table { display: table; border-collapse: collapse; margin-top: 2px; font-family: "Times New Roman", Times, serif; font-size: 11pt; }
  .real-doc-or-row { display: table-row; }
  .real-doc-or-label { display: table-cell; padding-right: 0.22in; white-space: nowrap; font-family: "Times New Roman", Times, serif; font-size: 11pt; font-weight: 700; color: #000000 !important; }
  .real-doc-or-val { display: table-cell; min-width: 1.2in; text-align: left; font-family: "Times New Roman", Times, serif; font-size: 11pt; font-weight: 400; color: #000000 !important; }
  .real-doc-or-val u { text-decoration: underline; text-underline-offset: 2px; }
  
  .real-doc-rsbsa-signatures { display: grid; grid-template-columns: 1.2fr 1fr; gap: 0.2in 0.5in; margin-top: 0.45in; text-align: center; font-size: 11pt; line-height: 1.2; color: #000000 !important; }
  .real-doc-rsbsa-cell { text-align: center; }
  
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
  const title = getDocumentTitle(template);
  const paragraphs = getDocumentBodyHtml(safeFields, template);
  const printSettings = getPrintSettings(safeFields, template);

  return `
    <style>${REAL_DOCUMENT_CSS}</style>
    <main class="real-doc-shell" ${editable ? 'data-editable="true"' : ""}>
      <article
        class="real-doc-page real-doc-${getRealDocumentTemplateKey(template)}"
        style="--doc-font-family: ${printSettings.fontFamily}; --doc-body-font-size: ${printSettings.bodyFontSizePt}pt; --doc-line-height: ${printSettings.lineHeight}; --doc-paragraph-gap: ${printSettings.paragraphGap}in; --doc-padding: ${printSettings.padding};"
      >
        <div class="real-doc-header">
          <img class="real-doc-seal" src="${BARANGAY_SEAL_SRC}" alt="" />
          <div class="real-doc-header-text">
            <div>Republic of the Philippines</div>
            <div>Province of Cotabato</div>
            <div>Municipality of Aleosan</div>
            <div>Barangay of Upper Mingading</div>
            <div class="real-doc-office">OFFICE OF THE PUNONG BARANGAY</div>
          </div>
        </div>
        <h1 class="real-doc-title">${title}</h1>
        <p class="real-doc-to">TO WHOM IT MAY CONCERN:</p>
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
