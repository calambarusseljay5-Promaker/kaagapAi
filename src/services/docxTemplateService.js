import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getActiveCaptain, getActiveSecretary } from "./organizationService.js";

/**
 * Mapping of document types / template keys to local official template files
 */
export const DOCUMENT_FILE_MAPPING = {
  business: "/files/document-templates/Cert.BUSINESS-Permit.docx",
  residency: "/files/document-templates/Cert.Residency-Templates.docx",
  indigency: "/files/document-templates/Cert.indigency-templates.docx",
  soloparent: "/files/document-templates/Cert.-solo-parent-Templates.docx",
  "4ps": "/files/document-templates/Barangay-Cert.templates.-4ps.docx",
  rsbsa: "/files/document-templates/cert.Rsbsa-templates.docx",
  clearance: "/files/document-templates/cert.barangay-clearance.docx",
};

/**
 * Resolves the appropriate template key from a template object or document type string
 */
export const resolveTemplateKey = (docTypeOrTemplate = "") => {
  const str = (
    typeof docTypeOrTemplate === "string"
      ? docTypeOrTemplate
      : docTypeOrTemplate?.template_name || docTypeOrTemplate?.document_type || ""
  ).toLowerCase();

  if (str.includes("business") || str.includes("permit")) return "business";
  if (str.includes("residency")) return "residency";
  if (str.includes("indigency") || str.includes("indigent")) return "indigency";
  if (str.includes("solo") || str.includes("parent")) return "soloparent";
  if (str.includes("4ps") || str.includes("pantawid") || str.includes("grantee")) return "4ps";
  if (str.includes("rsbsa") || str.includes("farmer") || str.includes("agriculture")) return "rsbsa";
  if (str.includes("clearance")) return "clearance";
  return "clearance";
};

/**
 * Get the download/template file path for a document
 */
export const getTemplateFilePath = (templateOrType) => {
  if (typeof templateOrType === "object" && templateOrType?.template_file_path) {
    return templateOrType.template_file_path;
  }
  const key = resolveTemplateKey(templateOrType);
  return DOCUMENT_FILE_MAPPING[key] || DOCUMENT_FILE_MAPPING.clearance;
};

/**
 * Format dynamic data to supply into Word template tags
 */
export const formatDocumentDataForTemplate = (resident = {}, fields = {}) => {
  const now = new Date();
  const dayNum = now.getDate();
  const daySuffix =
    dayNum === 1 || dayNum === 21 || dayNum === 31
      ? "st"
      : dayNum === 2 || dayNum === 22
      ? "nd"
      : dayNum === 3 || dayNum === 23
      ? "rd"
      : "th";

  const rawCaptain = typeof getActiveCaptain === "function" ? getActiveCaptain() : null;
  const rawSecretary = typeof getActiveSecretary === "function" ? getActiveSecretary() : null;
  const defaultCaptain = typeof rawCaptain === "string" ? rawCaptain : rawCaptain?.name || "HON. MAMERTO C. CLARITO";
  const defaultSecretary = typeof rawSecretary === "string" ? rawSecretary : rawSecretary?.name || "JOVELYN C. CABAYA";

  const fullName = (
    fields.residentName ||
    fields.full_name ||
    resident.full_name ||
    [resident.first_name, resident.middle_name, resident.last_name]
      .filter(Boolean)
      .join(" ") ||
    "JUAN DELA CRUZ"
  ).toUpperCase();

  const age = String(fields.age || resident.age || "35");
  const gender = fields.gender || resident.gender || resident.sex || "Male";
  const prefix = gender.toLowerCase() === "female" ? (fields.civilStatus === "Married" ? "Mrs." : "Ms.") : "Mr.";
  const civilStatus = fields.civilStatus || resident.civil_status || "Single";
  
  let rawPurok = fields.purok || resident.purok || "Kamonsil";
  const cleanPurok = rawPurok.replace(/^purok\s*/i, "").trim();

  const address =
    fields.address ||
    resident.address ||
    `Purok ${cleanPurok}, Barangay Upper Mingading, Aleosan, Cotabato`;

  const purpose =
    fields.purpose ||
    fields.residencyRecommendation ||
    "Whatever legal purpose it may serve best";

  const businessName = (
    fields.businessName ||
    fields.businessDetails ||
    "BANANA BUY AND SALE"
  ).toUpperCase();

  const soloParentReason =
    fields.soloParentReason ||
    fields.soloParentReasonPreset ||
    "death of spouse / legal separation";

  const cropsDetails =
    fields.cropsDetails ||
    "Rice Field ½ hectare, and Fruits Crops 1 hectare";

  const farmSize = fields.farmSize || "One (1) hectare";

  const dateOfBirth = resident.birthday || resident.birthdate || fields.dateOfBirth || "February 13, 2001";

  const orNumber = fields.orNumber || "OR-2026-0001";
  const ctcNumber = fields.ctcNumber || "CTC-2026-0001";
  const dateIssued = fields.dateIssued || now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });

  const captainName =
    fields.actingOfficer ||
    fields.approvingOfficer ||
    defaultCaptain;

  return {
    FULL_NAME: fullName,
    FIRST_NAME: resident.first_name || "",
    MIDDLE_NAME: resident.middle_name || "",
    LAST_NAME: resident.last_name || "",
    AGE: age,
    GENDER: gender,
    PREFIX: prefix,
    CIVIL_STATUS: civilStatus,
    PUROK: cleanPurok,
    ADDRESS: address,
    PURPOSE: purpose,
    BUSINESS_NAME: businessName,
    SOLO_PARENT_REASON: soloParentReason,
    CROPS_DETAILS: cropsDetails,
    FARM_SIZE: farmSize,
    DATE_OF_BIRTH: dateOfBirth,
    DAY: `${dayNum}${daySuffix}`,
    MONTH: now.toLocaleDateString("en-US", { month: "long" }),
    YEAR: String(now.getFullYear()),
    DATE: now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    BARANGAY_CAPTAIN: captainName,
    BARANGAY_SECRETARY: defaultSecretary,
    OR_NUMBER: orNumber,
    CTC_NUMBER: ctcNumber,
    DATE_ISSUED: dateIssued,
  };
};

/**
 * Generate filled docx Blob from template URL/Blob and dynamic data
 */
export const generateFilledDocx = async (templateSource, data) => {
  let arrayBuffer;

  if (typeof templateSource === "string") {
    const response = await fetch(templateSource);
    if (!response.ok) {
      throw new Error(`Failed to load template file: ${response.statusText} (${templateSource})`);
    }
    arrayBuffer = await response.arrayBuffer();
  } else if (templateSource instanceof Blob) {
    arrayBuffer = await templateSource.arrayBuffer();
  } else if (templateSource instanceof ArrayBuffer) {
    arrayBuffer = templateSource;
  } else {
    throw new Error("Invalid template source provided to generateFilledDocx.");
  }

  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  doc.render(data);

  const outBlob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return outBlob;
};

/**
 * Trigger download of Blob file in browser
 */
export const downloadFilledDocx = (blob, filename = "Barangay-Document.docx") => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
