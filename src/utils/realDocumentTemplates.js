export const BARANGAY_SEAL_SRC = "/files/document-templates/media/barangay-seal.png";
export const PUNONG_BARANGAY = "MAMERTO C. CLARITO";
export const DEFAULT_PREPARED_BY = "PATMAH S. SUMPAO";

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
  return `<u><strong>${escapeHtml(text)}</strong></u>`;
};

const getPurokName = (fields = {}) => {
  const safeFields = fields || {};
  const text = String(safeFields.purok || safeFields.address || "").trim();
  if (!text) return "<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>";
  const cleaned = text.replace(/^purok\s+/i, "");
  return `<u><strong>${escapeHtml(cleaned)}</strong></u>`;
};

const getPurposePhrase = (fields = {}) => {
  const safeFields = fields || {};
  const purpose = String(safeFields.purpose || "").trim();
  if (!purpose) return "whatever legal purpose it may serve best";
  return purpose.replace(/^for\s+/i, "");
};

const getCivilStatusFormatted = (status, allowSeparated = false) => {
  const s = String(status || "").toLowerCase().trim();
  if (s.includes("married")) {
    return allowSeparated ? "single/<u><strong>married</strong></u>/widow/separated" : "single/<u><strong>married</strong></u>/widow";
  }
  if (s.includes("widow") || s.includes("widower")) {
    return allowSeparated ? "single/married/<u><strong>widow</strong></u>/separated" : "single/married/<u><strong>widow</strong></u>";
  }
  if (allowSeparated && s.includes("separated")) {
    return "single/married/widow/<u><strong>separated</strong></u>";
  }
  return allowSeparated ? "<u><strong>single</strong></u>/married/widow/separated" : "<u><strong>single</strong></u>/married/widow";
};

const getGenderFormatted = (gender) => {
  const g = String(gender || "").toLowerCase().trim();
  const isFemale = g === "female" || g === "f";
  return {
    maleFemale: isFemale ? "male/<u><strong>female</strong></u>" : "<u><strong>male</strong></u>/female",
    hisHer: isFemale ? "his/<u><strong>her</strong></u>" : "<u><strong>his</strong></u>/her",
    herHis: isFemale ? "<u><strong>her</strong></u> /his" : "her /<u><strong>his</strong></u>",
    himHer: isFemale ? "him/<u><strong>her</strong></u>" : "<u><strong>him</strong></u>/her",
    heShe: isFemale ? "he/<u><strong>she</strong></u>" : "<u><strong>he</strong></u>/she",
    hisHerCap: isFemale ? "His/<u><strong>Her</strong></u>" : "<u><strong>His</strong></u>/Her",
  };
};

const getPrefixFormatted = (gender, civilStatus) => {
  const g = String(gender || "").toLowerCase().trim();
  const s = String(civilStatus || "").toLowerCase().trim();
  const isFemale = g === "female" || g === "f";
  if (!isFemale) return "<u><strong>Mr.</strong></u> / Ms / Mrs .";
  if (s.includes("married") || s.includes("widow")) return "Mr. / Ms / <u><strong>Mrs .</strong></u>";
  return "Mr. / <u><strong>Ms</strong></u> / Mrs .";
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
  if (Number.isNaN(date.getTime())) return "10th";
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

const formatBirthdate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const buildBodyParagraphs = (fields = {}, template = null) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);
  const name = fieldFilled(safeFields.residentName, 24);
  const age = fieldFilled(safeFields.age, 4);
  const purok = getPurokName(safeFields);
  const purpose = fieldFilled(getPurposePhrase(safeFields), 20);

  const day = fieldFilled(getOrdinalDay(safeFields.issueDate), 4);
  const month = fieldFilled(getMonthName(safeFields.issueDate), 10);
  const year = getYearNumber(safeFields.issueDate);
  const monthYear = fieldFilled(`${getMonthName(safeFields.issueDate)} ${year}`, 14);

  const civilStatus = getCivilStatusFormatted(safeFields.civilStatus);
  const civilStatusSolo = getCivilStatusFormatted(safeFields.civilStatus, true);
  const genderMap = getGenderFormatted(safeFields.gender);
  const prefixStr = getPrefixFormatted(safeFields.gender, safeFields.civilStatus);

  const birthdateStr = safeFields.birthDate ? formatBirthdate(safeFields.birthDate) : "";
  const remarks = String(safeFields.remarks || "").trim();

  if (key === "clearance") {
    return [
      `This is to certify according to our existing records that ${prefixStr} ${name}, ${age} yrs. Old, Filipino ${civilStatus}, whose signature and thumbmark appear below is presently a resident of Purok ${purok}, Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato and no current position in the Barangay.`,
      `This is to certify further, that ${genderMap.herHis} character, reputation and moral standing in the community are beyond reproach and that as of the date of this issued there is no pending case whatsoever filed against the above - named person for whatever any legal purpose which may serve his/<u><strong>her</strong></u> best.`,
      `This is to certify furthermore that in view of the foregoing circumstances, this Barangay Clearance is issued upon request of <u><strong>theabove</strong></u> - named person for ${purpose} and whatever any legal purpose which may serve her/<u><strong>his</strong></u> best.`,
      `Issued this <u><strong>${day}</strong></u> day of <u><strong>${month}</strong></u> at Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
    ];
  }

  if (key === "business") {
    return [
      `This is to certify that ${name}, ${age} yrs. old, Filipino, ${civilStatus}, a bona fide resident of Purok ${purok}, Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato, and ${genderMap.heShe} has a Purpose at the said place.`,
      `This certification is being issued upon the request of the above-mentioned name person for <u><strong>Business Permit Application</strong></u> and for whatever any legal purposes may serve ${genderMap.himHer} best.`,
      `Issued this <u><strong>${day}</strong></u> day of <u><strong>${monthYear}</strong></u> at Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
    ];
  }

  if (key === "indigency") {
    return [
      `THIS IS TO CERTIFY that ${name}, ${age} yrs. old ${civilStatus} and a bonafide resident of Purok ${purok}, Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato a low income earner family and considered as indigent.`,
      `This certification is issued upon the request of above-named person and for whatever legal purpose it may serve best.`,
      `Issued this <u><strong>${day}</strong></u> day of <u><strong>${monthYear}</strong></u> at Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
    ];
  }

  if (key === "residency") {
    const birthphrase = birthdateStr ? `was born on <u><strong>${birthdateStr}</strong></u>` : "";
    return [
      `THIS IS TO CERTIFY that ${name}, ${genderMap.maleFemale}, ${civilStatus}, Filipino, ${birthphrase} a bona fide resident of <u><strong>Purok ${purok}, Upper Mingading, Aleosan, Cotabato</strong></u>. ${genderMap.hisHerCap} reputation and moral standing in the community is beyond reproach and that is no pending case filed on said person whatsoever. From our barangay peace and order committee we are recommending ${genderMap.himHer} for a ${purpose}.`,
      `This certification is issued upon the request of above-named person for whatever legal purpose it may serve best.`,
      `Issued this <u><strong>${day}</strong></u> day of <u><strong>${monthYear}</strong></u> at Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
    ];
  }

  if (key === "rsbsa") {
    return [
      `THIS IS TO CERTIFY THAT ${name}, ${age} y/o, residing at <u><strong>Purok ${purok}, Upper Mingading, Aleosan, Cotabato</strong></u>, is tilling crop(s), farm area, or agricultural livelihood declared to this office${remarks ? `: <u><strong>${escapeHtml(remarks)}</strong></u>` : "."}`,
      `This CERTIFICATION is being issued by the Barangay solely for the purpose of the farmers and fisherfolk registration to the REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE (RSBSA) of the Department of Agriculture and may not be used for other purposes not mentioned above.`,
    ];
  }

  if (key === "solo") {
    return [
      `This is to certify that ${name}, ${age} yrs. old, Filipino, ${civilStatusSolo}, a bona fide resident of Purok ${purok}, Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
      `This certification is being issued upon the request of the above-mentioned person in support of Solo Parent application for ${purpose} and for whatever legal purpose it may serve best.`,
      `Issued this <u><strong>${day}</strong></u> day of <u><strong>${monthYear}</strong></u> at Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
    ];
  }

  if (key === "4ps") {
    return [
      `This is to certify that ${name} ${age} yrs. old, Filipino, ${civilStatus}, a bona fide resident of Purok ${purok}, Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
      `This certification is being issued upon the request of the above-mentioned same person for ${purpose} and for whatever any legal purposes.`,
      `Issued this <u><strong>${day}</strong></u> day of <u><strong>${monthYear}</strong></u> at Barangay Upper <u><strong>Mingading, Aleosan</strong></u>, Cotabato.`,
    ];
  }

  return [
    `This is to certify that ${name}, ${age} yrs. old, is a bona fide resident of Purok ${purok}, Barangay Upper Mingading, Aleosan, Cotabato.`,
    `This certification is issued upon request for ${purpose}.`,
  ];
};

const htmlParagraphToText = (paragraph) =>
  unescapeHtml(
    String(paragraph || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?strong>/gi, "")
      .replace(/<\/?u>/gi, "")
      .replace(/<[^>]+>/g, "")
  );

export const getEditableDocumentText = (fields = {}, template = null) =>
  buildBodyParagraphs(fields, template).map(htmlParagraphToText).join("\n\n");

const getDocumentBodyHtml = (fields = {}, template = null) => {
  const safeFields = fields || {};
  const customText = String(safeFields.documentText || "").trim();

  if (customText) {
    return customText
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
      .join("");
  }

  return buildBodyParagraphs(safeFields, template)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
};

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const getPrintSettings = (fields = {}) => {
  const safeFields = fields || {};
  const marginMap = {
    narrow: "0.5in 0.5in 0.5in",
    wide: "1.2in 1.2in 1.2in",
    normal: "0.85in 0.95in 0.8in",
  };
  const fontMap = {
    "times": '"Times New Roman", Times, serif',
    "rockwell": '"Rockwell Condensed", "Arial Narrow", serif',
    "arial": 'Arial, Helvetica, sans-serif',
    "arial-narrow": '"Arial Narrow", Arial, sans-serif',
    "georgia": 'Georgia, serif',
    "calibri": 'Calibri, sans-serif',
  };
  return {
    fontFamily: fontMap[safeFields.printFontFamily] || fontMap["times"],
    bodyFontSize: clampNumber(safeFields.printFontSize, 10, 20, 13),
    lineHeight: clampNumber(safeFields.printLineHeight, 1.1, 2.0, 1.45),
    paragraphGap: clampNumber(safeFields.printParagraphGap, 0.02, 0.3, 0.12),
    padding: marginMap[safeFields.printMargin] || "0.85in 0.95in 0.8in",
  };
};

const getDocumentTitle = (template) => {
  const key = getRealDocumentTemplateKey(template);
  if (key === "clearance") return "BARANGAY CLEARANCE";
  return "C E R T I F I C A T I O N";
};

const getEditableBodyAttributes = (editable) =>
  editable
    ? 'contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" data-editable-document-body="true" aria-label="Certificate text"'
    : "";

const getEditableFieldAttributes = (editable, field, label) =>
  editable
    ? `contenteditable="true" spellcheck="false" role="textbox" data-editable-field="${field}" aria-label="${escapeHtml(label)}"`
    : "";

const getDocumentFooter = (fields = {}, template = null, editable = false) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);
  const officer = fieldValue(getApprovingOfficer(safeFields));
  const issueDate = fieldValue(formatIssueDate(safeFields.issueDate));
  const officerEditAttrs = getEditableFieldAttributes(editable, "approvingOfficer", "Approving officer");

  if (key === "rsbsa") {
    return `
      <section class="real-doc-rsbsa-signatures">
        <div>
          <p class="real-doc-line" ${officerEditAttrs}>${officer}</p>
          <p>Name and Signature of Punong Barangay</p>
        </div>
        <div>
          <p class="real-doc-line">${issueDate}</p>
          <p>Date</p>
        </div>
        <div>
          <p class="real-doc-line">&nbsp;</p>
          <p>Name and Signature of Farmer/Fisherfolk</p>
        </div>
        <div>
          <p class="real-doc-line">${issueDate}</p>
          <p>Date</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="real-doc-signature ${key === "clearance" ? "real-doc-clearance-signature" : ""}">
      <p class="real-doc-line" ${officerEditAttrs}>${officer}</p>
      <p class="real-doc-subtext">Punong Barangay</p>
    </section>
  `;
};

const getDocumentExtras = (fields = {}, template = null, editable = false) => {
  const safeFields = fields || {};
  const key = getRealDocumentTemplateKey(template);

  if (key === "clearance") {
    const preparedByEditAttrs = getEditableFieldAttributes(editable, "preparedBy", "Prepared by");

    return `
      <section class="real-doc-clearance-staff">
        <p class="real-doc-staff-name" ${preparedByEditAttrs}>${escapeHtml(safeFields.preparedBy || DEFAULT_PREPARED_BY)}</p>
        <p>(Signature Over Printed Name)</p>
      </section>
      <section class="real-doc-thumbmark" aria-hidden="true">
        <span></span>
      </section>
      <section class="real-doc-or">
        <p>O. R. No. ${safeFields.orNumber ? `<strong>${escapeHtml(safeFields.orNumber)}</strong>` : "__________"}</p>
        <p>Date Issued: ${safeFields.dateIssued ? `<strong>${escapeHtml(safeFields.dateIssued)}</strong>` : "__________"}</p>
        <p>CTC. No. ${safeFields.ctcNumber ? `<strong>${escapeHtml(safeFields.ctcNumber)}</strong>` : "__________"}</p>
        <p>Date Issued: ${safeFields.ctcDateIssued ? `<strong>${escapeHtml(safeFields.ctcDateIssued)}</strong>` : "__________"}</p>
      </section>
    `;
  }

  if (key === "indigency" || key === "residency") {
    return `
      <section class="real-doc-or">
        <p>Brgy. Seal/25</p>
        <p>O. R. No. ${safeFields.orNumber ? `<strong>${escapeHtml(safeFields.orNumber)}</strong>` : "__________"}</p>
        <p>Date Issued: ${safeFields.dateIssued ? `<strong>${escapeHtml(safeFields.dateIssued)}</strong>` : "__________"}</p>
        <p>CTC No. ${safeFields.ctcNumber ? `<strong>${escapeHtml(safeFields.ctcNumber)}</strong>` : "__________"}</p>
        <p>Date Issued: ${safeFields.ctcDateIssued ? `<strong>${escapeHtml(safeFields.ctcDateIssued)}</strong>` : "__________"}</p>
      </section>
    `;
  }

  if (key === "business" || key === "4ps" || key === "solo") {
    return `
      <section class="real-doc-or">
        <p>OR No. ${safeFields.orNumber ? `<strong>${escapeHtml(safeFields.orNumber)}</strong>` : "__________"}</p>
        <p>Date Issued: ${safeFields.dateIssued ? `<strong>${escapeHtml(safeFields.dateIssued)}</strong>` : "__________"}</p>
      </section>
    `;
  }

  return "";
};

const REAL_DOCUMENT_CSS = `
  html, body { margin: 0; padding: 0; background: #fff; }
  .real-doc-shell, .real-doc-shell * { box-sizing: border-box; }
  .real-doc-shell { font-family: var(--doc-font-family, "Times New Roman", Times, "Rockwell Condensed", "Arial Narrow", serif); color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .real-doc-page { position: relative; width: 8.5in; min-height: 11in; margin: 0 auto; padding: var(--doc-padding, 0.85in 0.95in 0.8in); background: #fff; box-shadow: 0 0 0 1px #d7d7d7; }
  
  .real-doc-header { position: relative; min-height: 1.1in; border-bottom: 1.5px solid #000; padding-bottom: 0.08in; font-size: 11.5px; line-height: 1.3; font-family: inherit; }
  .real-doc-seal { position: absolute; left: 0; top: 0in; width: 1.05in; height: 1.05in; object-fit: contain; }
  .real-doc-header-text { width: 100%; text-align: center; margin: 0 auto; }
  .real-doc-office { margin: 0.12in 0 0.02in; font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; font-family: inherit; }
  
  .real-doc-title { margin: 0.22in 0 0.18in; text-align: center; font-size: 18px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .real-doc-to { margin: 0 0 0.16in; font-size: 12px; font-weight: 700; font-family: inherit; text-transform: uppercase; }
  
  .real-doc-body { font-size: var(--doc-body-font-size, 13px); line-height: var(--doc-line-height, 1.45); text-align: justify; font-family: inherit; }
  .real-doc-body p { margin: 0 0 var(--doc-paragraph-gap, 0.12in); text-indent: 0.4in; }
  .real-doc-body strong { font-weight: 700; }
  .real-doc-body u { text-decoration: underline; text-underline-offset: 2px; }
  .real-doc-body u strong { font-weight: 700; }
  
  .real-doc-signature { width: 2.6in; margin: 0.35in 0 0 auto; text-align: center; font-size: 12px; line-height: 1.2; font-family: inherit; }
  .real-doc-clearance-signature { margin-top: 0.3in; margin-right: 0.4in; }
  .real-doc-line { margin: 0; font-weight: 700; text-transform: uppercase; }
  .real-doc-subtext { margin: 2px 0 0; font-size: 11px; font-weight: 400; }
  
  .real-doc-clearance-staff { margin-top: 0.25in; width: 2.4in; text-align: left; font-size: 11px; font-weight: 700; line-height: 1.15; font-family: inherit; }
  .real-doc-clearance-staff p { margin: 0; }
  .real-doc-staff-name { text-transform: uppercase; }
  
  .real-doc-thumbmark { margin-top: 0.15in; margin-left: 0.1in; width: 0.85in; height: 0.75in; border: 1px solid #000; display: block; }
  
  .real-doc-or { position: absolute; left: 0.95in; bottom: 0.75in; font-size: 11px; font-weight: 700; line-height: 1.25; font-family: inherit; }
  .real-doc-or p { margin: 0; }
  
  .real-doc-rsbsa-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 0.32in 0.6in; margin-top: 0.48in; text-align: center; font-size: 11px; line-height: 1.2; }
  
  .real-doc-shell[data-editable="true"] [contenteditable="true"] { border-radius: 2px; cursor: text; outline: 1px dashed transparent; outline-offset: 2px; transition: background-color 0.15s ease, outline-color 0.15s ease; }
  .real-doc-shell[data-editable="true"] [contenteditable="true"]:hover { background: rgba(37, 99, 235, 0.05); outline-color: rgba(37, 99, 235, 0.32); }
  .real-doc-shell[data-editable="true"] [contenteditable="true"]:focus { background: rgba(37, 99, 235, 0.08); outline-color: rgba(29, 78, 216, 0.72); }
  
  @page { size: letter; margin: 0; }
  @media print {
    html, body { margin: 0; padding: 0; background: #fff; }
    .real-doc-page { width: 8.5in; min-height: 11in; box-shadow: none; }
    .real-doc-shell [contenteditable="true"] { background: transparent; outline: none; }
  }
`;

export const getRealDocumentMarkup = ({ fields = {}, template = null, editable = false } = {}) => {
  const safeFields = fields || {};
  const title = getDocumentTitle(template);
  const paragraphs = getDocumentBodyHtml(safeFields, template);
  const printSettings = getPrintSettings(safeFields);

  return `
    <style>${REAL_DOCUMENT_CSS}</style>
    <main class="real-doc-shell" ${editable ? 'data-editable="true"' : ""}>
      <article
        class="real-doc-page real-doc-${getRealDocumentTemplateKey(template)}"
        style="--doc-font-family: ${printSettings.fontFamily}; --doc-body-font-size: ${printSettings.bodyFontSize}px; --doc-line-height: ${printSettings.lineHeight}; --doc-paragraph-gap: ${printSettings.paragraphGap}in; --doc-padding: ${printSettings.padding};"
      >
        <header class="real-doc-header">
          <img class="real-doc-seal" src="${BARANGAY_SEAL_SRC}" alt="" />
          <div class="real-doc-header-text">
            <div>Republic of the Philippines</div>
            <div>Province of Cotabato</div>
            <div>Municipality of Aleosan</div>
            <div>Barangay of Upper Mingading</div>
            <div class="real-doc-office">OFFICE OF THE PUNONG BARANGAY</div>
          </div>
        </header>
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
  <title>Document Print Preview</title>
  <style>
    html, body {
      min-height: 100%;
      background: #eef1f5 !important;
    }
    body {
      padding: 0 0 32px !important;
    }
    .print-preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px 18px;
      border-bottom: 1px solid #d9dee7;
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      color: #1d2129;
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
    }
    .print-preview-toolbar strong {
      display: block;
      font-size: 14px;
    }
    .print-preview-toolbar span {
      color: #667085;
      font-size: 12px;
    }
    .print-preview-actions {
      display: flex;
      gap: 8px;
    }
    .print-preview-actions button {
      min-height: 38px;
      cursor: pointer;
      border: 1px solid #d9dee7;
      border-radius: 8px;
      background: #ffffff;
      padding: 8px 14px;
      color: #344054;
      font: 600 13px/1.2 "Segoe UI", Arial, sans-serif;
    }
    .print-preview-actions .primary {
      border-color: #00552e;
      background: #006633;
      color: #ffffff;
    }
    @media print {
      html, body {
        background: #ffffff !important;
      }
      body {
        padding: 0 !important;
      }
      .print-preview-toolbar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-preview-toolbar">
    <div>
      <strong>Document Print Preview</strong>
      <span>Review the document, then select Print when ready.</span>
    </div>
    <div class="print-preview-actions">
      <button type="button" onclick="window.close()">Close Preview</button>
      <button type="button" class="primary" onclick="window.print()">Print Document</button>
    </div>
  </div>
  ${getRealDocumentMarkup({ fields: safeFields, template })}
</body>
</html>`;
};

