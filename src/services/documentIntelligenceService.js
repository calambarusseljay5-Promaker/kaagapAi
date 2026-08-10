import { generateText } from "./geminiService";
import { DEFAULT_PREPARED_BY, PUNONG_BARANGAY } from "../utils/realDocumentTemplates";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getNestedResident = (resident) => (Array.isArray(resident) ? resident[0] : resident);

const getTemplateLabel = (template) =>
  template?.template_name || template?.document_type || "Untitled Template";

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const findBestTemplate = (templates = [], documentType = "") => {
  const requested = normalizeText(documentType);
  if (!requested) return templates[0] || null;

  return (
    templates.find((template) => normalizeText(template.template_name) === requested) ||
    templates.find((template) => normalizeText(template.document_type) === requested) ||
    templates.find((template) => requested.includes(normalizeText(template.template_name))) ||
    templates.find((template) => normalizeText(template.template_name).includes(requested)) ||
    templates.find((template) => requested.includes(normalizeText(template.document_type))) ||
    templates.find((template) => normalizeText(template.document_type).includes(requested)) ||
    templates[0] ||
    null
  );
};

const findBestResident = (request, residents = []) => {
  const requestResident = getNestedResident(request?.residents);

  return (
    residents.find((resident) => resident.id === request?.resident_id) ||
    residents.find(
      (resident) =>
        requestResident?.full_name &&
        normalizeText(resident.full_name) === normalizeText(requestResident.full_name)
    ) ||
    requestResident ||
    null
  );
};

const getPurposeSuggestion = (documentType = "") => {
  const normalized = normalizeText(documentType);

  if (normalized.includes("clearance")) return "barangay clearance and personal record verification";
  if (normalized.includes("residency") || normalized.includes("resident")) return "proof of residency";
  if (normalized.includes("indigency")) return "financial assistance or social service requirement";
  if (normalized.includes("business") || normalized.includes("permit")) return "business permit processing";
  if (normalized.includes("rsbsa")) return "farmers and fisherfolk RSBSA registration";
  if (normalized.includes("solo")) return "solo parent application or verification";
  if (normalized.includes("4ps")) return "4Ps program verification or change-grantee requirement";
  if (normalized.includes("moral")) return "school, employment, or official requirement";
  if (normalized.includes("travel")) return "travel documentation requirement";
  if (normalized.includes("id")) return "barangay identification card processing";

  return "official barangay document processing";
};

const buildFields = ({ request, resident, template, currentFields = {}, aiFields = {} }) => ({
  documentTitle: aiFields.documentTitle || currentFields.documentTitle || getTemplateLabel(template),
  residentName: resident?.full_name || currentFields.residentName || "",
  age: resident?.age ?? currentFields.age ?? "",
  gender: resident?.gender || currentFields.gender || "",
  houseNo: resident?.house_no || currentFields.houseNo || "",
  purok: resident?.purok || currentFields.purok || "",
  address: resident?.address || currentFields.address || "",
  email: resident?.email || currentFields.email || "",
  pwdStatus:
    typeof resident?.is_pwd === "boolean"
      ? resident.is_pwd
        ? "Yes"
        : "No"
      : currentFields.pwdStatus || "No",
  pwdType: resident?.pwd_type || currentFields.pwdType || "",
  purpose:
    aiFields.purpose ||
    currentFields.purpose ||
    getPurposeSuggestion(template?.document_type || request?.document_type),
  issueDate: currentFields.issueDate || todayInputValue(),
  preparedBy: currentFields.preparedBy || DEFAULT_PREPARED_BY,
  approvingOfficer: currentFields.approvingOfficer || PUNONG_BARANGAY,
  remarks: aiFields.remarks || currentFields.remarks || "",
  documentText: currentFields.documentText || "",
  printFontSize: currentFields.printFontSize || "12",
  printLineHeight: currentFields.printLineHeight || "1.38",
  printParagraphGap: currentFields.printParagraphGap || "0.08",
});

const getMissingFields = (fields, template, resident) => {
  const missing = [];

  if (!template) missing.push("document template");
  if (!resident) missing.push("resident");
  if (!fields.residentName) missing.push("resident name");
  if (!fields.age) missing.push("age");
  if (!fields.gender) missing.push("gender");
  if (!fields.address && !fields.purok) missing.push("address or purok");
  if (!fields.issueDate) missing.push("issue date");
  if (!fields.purpose) missing.push("purpose");

  return missing;
};

const buildLocalReview = ({ fields, template, resident, source = "Local AI fallback" }) => {
  const missing = getMissingFields(fields, template, resident);

  return {
    source,
    confidence: missing.length === 0 ? "High" : "Needs review",
    summary:
      missing.length === 0
        ? "Resident information and required document fields look ready for admin preview."
        : `Some fields still need admin review: ${missing.join(", ")}.`,
    checklist: [
      template ? `Template matched: ${getTemplateLabel(template)}` : "Select a document template.",
      resident ? `Resident matched: ${resident.full_name}` : "Select a resident record.",
      fields.address || fields.purok ? "Address or purok is filled." : "Address or purok is missing.",
      fields.purpose ? "Purpose is filled." : "Purpose is missing.",
      fields.issueDate ? "Issue date is filled." : "Issue date is missing.",
    ],
  };
};

const extractJson = (result) => {
  const text =
    result?.text ||
    result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ||
    "";
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

export async function autofillDocumentWithAI({
  request,
  templates = [],
  residents = [],
  currentFields = {},
}) {
  const template = findBestTemplate(templates, request?.document_type);
  const resident = findBestResident(request, residents);
  const localFields = buildFields({ request, resident, template, currentFields });
  const localReview = buildLocalReview({ fields: localFields, template, resident });

  const prompt = `Return strict JSON only. Help an admin prepare a barangay document.

Request:
${JSON.stringify(
  {
    document_type: request?.document_type,
    status: request?.status,
    requested_at: request?.created_at,
  },
  null,
  2
)}

Selected template:
${JSON.stringify(
  template
    ? {
        template_name: template.template_name,
        document_type: template.document_type,
        description: template.description,
        requirements: template.requirements,
        processing_time: template.processing_time,
        fee: template.fee,
      }
    : null,
  null,
  2
)}

Resident record:
${JSON.stringify(
  resident
    ? {
        full_name: resident.full_name,
        age: resident.age,
        gender: resident.gender,
        house_no: resident.house_no,
        purok: resident.purok,
        address: resident.address,
        email: resident.email,
        is_pwd: resident.is_pwd,
        pwd_type: resident.pwd_type,
      }
    : null,
  null,
  2
)}

Current fields:
${JSON.stringify(currentFields, null, 2)}

JSON shape:
{
  "documentTitle": "string",
  "purpose": "string",
  "remarks": "string",
  "summary": "string",
  "checklist": ["string"]
}`;

  try {
    const result = await generateText(prompt, {
      systemInstruction:
        "You are a barangay document preparation assistant. Use only the supplied request, template, and resident record. Do not invent missing resident data. Return JSON only.",
      temperature: 0.1,
      maxOutputTokens: 500,
    });
    const parsed = extractJson(result);

    if (!parsed) throw new Error("AI response was not valid JSON.");

    const aiFields = buildFields({
      request,
      resident,
      template,
      currentFields,
      aiFields: {
        documentTitle: parsed.documentTitle,
        purpose: parsed.purpose,
        remarks: parsed.remarks,
      },
    });

    return {
      templateId: template?.id || "",
      residentId: resident?.id || request?.resident_id || "",
      fields: aiFields,
      review: {
        source: "Gemini AI",
        confidence: getMissingFields(aiFields, template, resident).length === 0 ? "High" : "Needs review",
        summary: parsed.summary || buildLocalReview({ fields: aiFields, template, resident }).summary,
        checklist:
          Array.isArray(parsed.checklist) && parsed.checklist.length > 0
            ? parsed.checklist
            : buildLocalReview({ fields: aiFields, template, resident }).checklist,
      },
    };
  } catch (error) {
    return {
      templateId: template?.id || "",
      residentId: resident?.id || request?.resident_id || "",
      fields: localFields,
      review: {
        ...localReview,
        summary: `${localReview.summary} Online AI was unavailable, so the system used local intelligent autofill.`,
        error: error.message,
      },
    };
  }
}
