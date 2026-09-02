import { generateText } from "./geminiService";
import { supabase } from "../lib/supabaseClient";
import { fetchResidents } from "./adminService";
import {
  fetchDocumentRequests,
  fetchDocumentTemplates,
} from "./documentRequestService";

const MAX_RESIDENT_CONTEXT = 25;
const MAX_REQUEST_CONTEXT = 25;
const MAX_TEMPLATE_CONTEXT = 20;
const MAX_PROFILE_CONTEXT = 20;
const MAX_NOTIFICATION_CONTEXT = 20;
const MAX_LIVELIHOOD_CONTEXT = 20;
const MAX_ANNOUNCEMENT_CONTEXT = 20;
const MAX_KNOWLEDGE_CONTEXT = 50;
const SENIOR_AGE = 60;
const PWD_FIELD_CANDIDATES = [
  "is_pwd",
  "pwd",
  "is_pwed",
  "pwed",
  "has_disability",
  "disability",
  "disability_status",
  "pwd_status",
];

const LOCAL_ANSWER_TERMS = [
  "how many",
  "count",
  "total",
  "summary",
  "summarize",
  "break down",
  "breakdown",
  "male",
  "female",
  "gender",
  "senior",
  "seniors",
  "elderly",
  "pwd",
  "pwed",
  "disability",
  "disabled",
  "resident",
  "population",
  "purok",
  "archive",
  "archived",
  "pending",
  "document",
  "request",
  "template",
  "notification",
  "announcement",
  "announcements",
  "livelihood",
  "job",
  "jobs",
  "program",
  "programs",
  "training",
  "user",
  "dashboard",
];

const ASSISTANT_META_TERMS = [
  "your purpose",
  "what is your purpose",
  "what's your purpose",
  "purpose in my system",
  "who are you",
  "what are you",
  "what do you do",
  "what can you do",
  "how can you help",
  "your role",
  "capabilities",
  "why are you here",
  "kaagapai assistant",
];

const normalize = (value, fallback = "Unknown") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const formatDate = (dateValue) => {
  if (!dateValue) return "Unknown date";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString();
};

const countBy = (items, getKey) =>
  items.reduce((counts, item) => {
    const key = normalize(getKey(item));
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

const formatCounts = (counts) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.length ? entries.map(([label, count]) => `${label}: ${count}`).join(", ") : "None";
};

const averageAge = (residents) => {
  const ages = residents
    .map((resident) => Number(resident.age))
    .filter((age) => Number.isFinite(age) && age >= 0);

  if (!ages.length) return "No age data";
  return Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length);
};

const getAge = (resident) => {
  const age = Number(resident.age);
  return Number.isFinite(age) && age >= 0 ? age : null;
};

const getResidentAgeGroup = (resident) => {
  const age = getAge(resident);
  if (age == null) return "Unknown age";
  if (age < 18) return "Minor (0-17)";
  if (age < SENIOR_AGE) return "Adult (18-59)";
  return "Senior (60+)";
};

const getResidentPwdField = (residents) =>
  PWD_FIELD_CANDIDATES.find((field) =>
    residents.some((resident) => Object.prototype.hasOwnProperty.call(resident, field))
  ) || null;

const isTruthyPwdValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["yes", "true", "pwd", "pwed", "person with disability", "1"].includes(normalized);
  }
  return false;
};

const countPwdResidents = (residents, pwdField) => {
  if (!pwdField) return null;
  return residents.filter((resident) => isTruthyPwdValue(resident[pwdField])).length;
};

const safeFetchTable = async (tableName, options = {}) => {
  const { columns = "*", orderBy = "", ascending = false, limit = 200 } = options;

  try {
    let query = supabase.from(tableName).select(columns);

    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.warn(`Unable to fetch ${tableName} for AI context:`, error.message);
    return { data: [], error };
  }
};

const formatResidentLine = (resident, index) => {
  const name = resident.full_name || resident.name || "Unknown";
  const pwdField = getResidentPwdField([resident]);
  const pwdText = pwdField ? `, PWD: ${isTruthyPwdValue(resident[pwdField]) ? "Yes" : "No"}` : "";
  return `${index + 1}. ${name} - Email: ${resident.email || "None"}, House: ${resident.house_no || "None"}, Age: ${resident.age ?? "Unknown"}, Age group: ${getResidentAgeGroup(resident)}, Gender: ${resident.gender || "Unknown"}, Purok: ${resident.purok || "Unknown"}, Status: ${resident.status || "Unknown"}${pwdText}, Address: ${resident.address || "Unknown"}`;
};

const formatRequestLine = (request, index) => {
  const residentName = request.residents?.full_name || "Unknown resident";
  return `${index + 1}. ${residentName} - ${request.document_type || "Unknown document"}, Status: ${request.status || "Unknown"}, Requested: ${formatDate(request.created_at)}`;
};

const formatTemplateLine = (template, index) =>
  `${index + 1}. ${template.template_name || template.document_type || "Untitled"} - Type: ${template.document_type || "Unknown"}, Requirements: ${template.requirements || "None listed"}, Processing: ${template.processing_time || "Not set"}, Fee: ${template.fee || "Not set"}`;

const formatProfileLine = (profile, index) =>
  `${index + 1}. User profile ${profile.id || "Unknown ID"} - Role: ${profile.role || "Unknown"}, Registration: ${profile.registration_status || "Unknown"}, Resident ID: ${profile.resident_id || "None"}`;

const formatNotificationLine = (notification, index) =>
  `${index + 1}. ${notification.title || "Untitled"} - Resident ID: ${notification.resident_id || "Unknown"}, Read: ${notification.is_read ? "Yes" : "No"}, Created: ${formatDate(notification.created_at)}`;

const formatLivelihoodLine = (post, index) =>
  `${index + 1}. ${post.title || "Untitled"} - Category: ${post.category || "Unknown"}, Status: ${post.status || "Unknown"}, Organization: ${post.organization || "None"}, Slots: ${post.slots ?? "Open"}, Deadline: ${formatDate(post.deadline)}, Location: ${post.location || "Unknown"}`;

const formatAnnouncementLine = (announcement, index) =>
  `${index + 1}. ${announcement.title || "Untitled"} - Category: ${announcement.category || "Unknown"}, Status: ${announcement.status || "Unknown"}, Audience: ${announcement.audience || "Unknown"}, Publish: ${formatDate(announcement.publish_date)}, Expires: ${formatDate(announcement.expires_at)}`;

const formatKnowledgeLine = (item, index) =>
  `${index + 1}. ${item.title || "Untitled"} - Category: ${item.category || "General"}, Audience: ${item.audience || "Unknown"}, Status: ${item.status || "Unknown"}, Source: ${item.source_type || "manual"}, Content: ${item.content || "No content saved."}`;

function buildAdminSnapshot({
  residents = [],
  documentRequests = [],
  documentTemplates = [],
  userProfiles = [],
  residentNotifications = [],
  livelihoodPosts = [],
  announcements = [],
  knowledgeItems = [],
  contextErrors = {},
}) {
  const currentResidents = residents.filter((resident) => resident.status !== "Archived");
  const archivedResidents = residents.filter((resident) => resident.status === "Archived");
  const pendingResidents = residents.filter((resident) => resident.status === "Pending");
  const activeResidents = residents.filter((resident) => resident.status === "Active");
  const seniorResidents = currentResidents.filter((resident) => {
    const age = getAge(resident);
    return age != null && age >= SENIOR_AGE;
  });
  const minorResidents = currentResidents.filter((resident) => {
    const age = getAge(resident);
    return age != null && age < 18;
  });
  const adultResidents = currentResidents.filter((resident) => {
    const age = getAge(resident);
    return age != null && age >= 18 && age < SENIOR_AGE;
  });
  const unknownAgeResidents = currentResidents.filter((resident) => getAge(resident) == null);
  const pwdField = getResidentPwdField(residents);
  const pwdResidents = countPwdResidents(currentResidents, pwdField);
  const pendingRequests = documentRequests.filter((request) => request.status === "Pending");
  const processingRequests = documentRequests.filter((request) =>
    ["Processing", "Approved"].includes(request.status)
  );
  const completedRequests = documentRequests.filter((request) =>
    ["Completed", "Released"].includes(request.status)
  );
  const openLivelihoodPosts = livelihoodPosts.filter((post) => post.status === "Open");
  const jobPosts = livelihoodPosts.filter((post) => post.category === "Job");
  const trainingPosts = livelihoodPosts.filter((post) => post.category === "Training");
  const programPosts = livelihoodPosts.filter((post) => post.category === "Program");
  const publishedAnnouncements = announcements.filter((announcement) => announcement.status === "Published");
  const draftAnnouncements = announcements.filter((announcement) => announcement.status === "Draft");
  const archivedAnnouncements = announcements.filter((announcement) => announcement.status === "Archived");

  return {
    generatedAt: new Date().toLocaleString(),
    residents,
    currentResidents,
    archivedResidents,
    pendingResidents,
    activeResidents,
    documentRequests,
    pendingRequests,
    processingRequests,
    completedRequests,
    documentTemplates,
    userProfiles,
    residentNotifications,
    livelihoodPosts,
    openLivelihoodPosts,
    jobPosts,
    trainingPosts,
    programPosts,
    announcements,
    knowledgeItems,
    publishedAnnouncements,
    draftAnnouncements,
    archivedAnnouncements,
    contextErrors,
    pwdField,
    pwdResidents,
    seniorResidents,
    minorResidents,
    adultResidents,
    unknownAgeResidents,
    residentStatusCounts: countBy(residents, (resident) => resident.status),
    residentPurokCounts: countBy(currentResidents, (resident) => resident.purok),
    residentGenderCounts: countBy(currentResidents, (resident) => resident.gender),
    residentAgeGroupCounts: countBy(currentResidents, getResidentAgeGroup),
    documentStatusCounts: countBy(documentRequests, (request) => request.status),
    documentTypeCounts: countBy(documentRequests, (request) => request.document_type),
    templateTypeCounts: countBy(documentTemplates, (template) => template.document_type),
    userRoleCounts: countBy(userProfiles, (profile) => profile.role),
    notificationReadCounts: countBy(residentNotifications, (notification) =>
      notification.is_read ? "Read" : "Unread"
    ),
    livelihoodCategoryCounts: countBy(livelihoodPosts, (post) => post.category),
    livelihoodStatusCounts: countBy(livelihoodPosts, (post) => post.status),
    announcementCategoryCounts: countBy(announcements, (announcement) => announcement.category),
    announcementStatusCounts: countBy(announcements, (announcement) => announcement.status),
  };
}

function formatAdminContext(snapshot) {
  const pwdSummary =
    snapshot.pwdField
      ? `${snapshot.pwdResidents} current residents marked as PWD using field "${snapshot.pwdField}".`
      : "PWD data is not stored in the current residents table yet. Add an is_pwd/pwd field to track this accurately.";
  const contextWarnings = Object.entries(snapshot.contextErrors || {})
    .filter(([, error]) => Boolean(error))
    .map(([name, error]) => `${name}: ${error.message}`)
    .join("; ");

  return `System snapshot: ${snapshot.generatedAt}

Available admin modules:
- Dashboard: resident count, document request panel, analytics cards, announcements panel, training panel.
- Resident Management: add, update, filter, approve pending registrations, archive, and restore residents.
- Archive Management: view archived residents, filter them, restore them, and permanently delete archived records.
- Document Management: view requests, filter by status/search, update request status, delete requests.
- Organizational Chart: view and edit barangay captain and kagawad profiles for the admin roster.
- Reports & Analytics: generate resident demographics reports, gender/age/purok/status breakdowns, CSV export, and print reports.
- Livelihood & Jobs: create, update, filter, and delete job posts, trainings, and livelihood program opportunities.
- Announcements: create, publish, archive, filter, and delete barangay announcements.
- User Management: view registered admin and resident profiles.
- Resident Dashboard: residents can request documents and read notifications.
- AI Assistant Logs: review admin AI assistant questions and responses.

Resident summary:
- Total resident records: ${snapshot.residents.length}
- Current residents excluding archived: ${snapshot.currentResidents.length}
- Active residents: ${snapshot.activeResidents.length}
- Pending resident registrations: ${snapshot.pendingResidents.length}
- Archived residents: ${snapshot.archivedResidents.length}
- Average known resident age: ${averageAge(snapshot.residents)}
- Senior citizens, age ${SENIOR_AGE}+: ${snapshot.seniorResidents.length}
- Adults, age 18-59: ${snapshot.adultResidents.length}
- Minors, age 0-17: ${snapshot.minorResidents.length}
- Current residents with unknown age: ${snapshot.unknownAgeResidents.length}
- PWD/PWED count: ${pwdSummary}
- By status: ${formatCounts(snapshot.residentStatusCounts)}
- By purok, excluding archived: ${formatCounts(snapshot.residentPurokCounts)}
- By gender, excluding archived: ${formatCounts(snapshot.residentGenderCounts)}
- By age group, excluding archived: ${formatCounts(snapshot.residentAgeGroupCounts)}

Resident sample:
${snapshot.residents.slice(0, MAX_RESIDENT_CONTEXT).map(formatResidentLine).join("\n") || "No resident records found."}

Senior resident sample:
${snapshot.seniorResidents.slice(0, MAX_RESIDENT_CONTEXT).map(formatResidentLine).join("\n") || "No senior residents found."}

Archived resident sample:
${snapshot.archivedResidents.slice(0, MAX_RESIDENT_CONTEXT).map(formatResidentLine).join("\n") || "No archived residents found."}

Document request summary:
- Total loaded requests: ${snapshot.documentRequests.length}
- Pending requests: ${snapshot.pendingRequests.length}
- Processing or approved requests: ${snapshot.processingRequests.length}
- Completed or released requests: ${snapshot.completedRequests.length}
- By status: ${formatCounts(snapshot.documentStatusCounts)}
- By document type: ${formatCounts(snapshot.documentTypeCounts)}

Recent document requests:
${snapshot.documentRequests.slice(0, MAX_REQUEST_CONTEXT).map(formatRequestLine).join("\n") || "No document requests found."}

Pending document requests:
${snapshot.pendingRequests.slice(0, MAX_REQUEST_CONTEXT).map(formatRequestLine).join("\n") || "No pending document requests found."}

Document templates:
${snapshot.documentTemplates.slice(0, MAX_TEMPLATE_CONTEXT).map(formatTemplateLine).join("\n") || "No document templates found."}

User profile summary:
- Loaded user profiles: ${snapshot.userProfiles.length}
- By role: ${formatCounts(snapshot.userRoleCounts)}
${snapshot.userProfiles.slice(0, MAX_PROFILE_CONTEXT).map(formatProfileLine).join("\n") || "No user profile records loaded."}

Resident notification summary:
- Loaded resident notifications: ${snapshot.residentNotifications.length}
- By read status: ${formatCounts(snapshot.notificationReadCounts)}
${snapshot.residentNotifications.slice(0, MAX_NOTIFICATION_CONTEXT).map(formatNotificationLine).join("\n") || "No resident notifications loaded."}

Livelihood and jobs summary:
- Loaded posts: ${snapshot.livelihoodPosts.length}
- Open posts: ${snapshot.openLivelihoodPosts.length}
- Job posts: ${snapshot.jobPosts.length}
- Training posts: ${snapshot.trainingPosts.length}
- Livelihood program posts: ${snapshot.programPosts.length}
- By status: ${formatCounts(snapshot.livelihoodStatusCounts)}
- By category: ${formatCounts(snapshot.livelihoodCategoryCounts)}
${snapshot.livelihoodPosts.slice(0, MAX_LIVELIHOOD_CONTEXT).map(formatLivelihoodLine).join("\n") || "No livelihood or job posts loaded."}

Announcement summary:
- Loaded announcements: ${snapshot.announcements.length}
- Published announcements: ${snapshot.publishedAnnouncements.length}
- Draft announcements: ${snapshot.draftAnnouncements.length}
- Archived announcements: ${snapshot.archivedAnnouncements.length}
- By status: ${formatCounts(snapshot.announcementStatusCounts)}
- By category: ${formatCounts(snapshot.announcementCategoryCounts)}
${snapshot.announcements.slice(0, MAX_ANNOUNCEMENT_CONTEXT).map(formatAnnouncementLine).join("\n") || "No announcements loaded."}

AI knowledge trainer records:
- Loaded knowledge items: ${snapshot.knowledgeItems.length}
${snapshot.knowledgeItems.slice(0, MAX_KNOWLEDGE_CONTEXT).map(formatKnowledgeLine).join("\n") || "No AI knowledge records loaded."}

Official Political History & Leadership Timeline of Barangay Upper Mingading:
1. Hon. Gaudencio Catenas (1952–1958) - Teniente del Barrio. Facilitated opening of Bacolod Primary School (1953) with 2 hectares donated by Mr. Sagadan, plus 1.85 hectares donated for barangay site.
2. Hon. Dioscoro Bolivar (1958–1964) - Teniente del Barrio. In 1958, the barangay was divided into Upper Mingading and Lower Mingading.
3. Hon. Eustaquio Garito - Teniente del Barrio. Maintained longstanding unity among Muslim and Christian constituents.
4. Hon. Segundo Cari (1969–1972) - Barangay Captain. Expanded barangay territory following ILAGA-Black Shirt conflict.
5. Hon. Bonifacio Capio (1972–1986) - Barangay Captain. Improved San Mateo-Upper Mingading road; opened road to Sitio Nalpan.
6. Hon. Sofia Garito (1986–1991) - Barangay Captain. Rehabilitated San Mateo-Upper Mingading road; encouraged planting fruit/forest trees.
7. Hon. Sito Calician (1991–1994) - Barangay Captain. Organized Civilian Volunteer Officers (CVO).
8. Hon. Mamerto Garito (1994–2004) - Barangay Captain. Constructed Barangay Hall, Health Center, Water System, Day Care Center, All-Weather Road. Organized CAFGU, cooperatives, Farmer Association. Electrification & streetlights.
9. Hon. Myrna Garito (2004–2007) - Punong Barangay. Constructed MRF and water system in Puroks Malipayon & Motor. Opened Brgy Road from Payhod to Buklod. Bacolod Annex Primary School in Purok Muslim. New Barangay Hall funded by Cong. Em "Lala" Taliño-Mendoza. Box Culvert & 2 classrooms.
10. Hon. Wilson Caponpon (2007–2023) - Former Punong Barangay (now Kagawad). Implemented major programs, maintained peace and order, improved roads. Won Model Barangay in Solid Waste Management, Best Performing Barangay, and Best Recycling Innovation.
11. Hon. Mamerto C. Clarito (2023–Present) - Current Punong Barangay (Barangay Captain). Leads the Sangguniang Barangay, community public services, and KaagapAI digital administration.

Official Policies & Ordinances of Barangay Upper Mingading:
1. Curfew for Minors (below 18): 10:00 PM to 4:00 AM daily.
2. Solid Waste Management (RA 9003): Mandatory waste segregation (Nabubulok, Di-nabubulok, Recyclable). Strict ban on open burning (No Open Burning). Awarded Model Barangay in Solid Waste Management & Best Recycling Innovation.
3. Videoke & Noise Regulation: Videoke and loud sounds are allowed only until 10:00 PM.
4. Responsible Pet Ownership: Stray dogs/cats prohibited on public streets; free anti-rabies vaccinations.
5. Katarungang Pambarangay: Mandatory mediation by Lupon Tagapamayapa for neighborhood disputes before filing in court.
6. Document Issuance: Valid ID, Cedula, and ₱50 standard processing fee (Indigency is Free).

Context warnings:
${contextWarnings || "None"}`;
}

function extractGeminiText(result) {
  if (!result) return "";
  if (typeof result.text === "string") return result.text.trim();

  const candidate = result.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (text) return text;
  if (candidate?.output) return candidate.output;
  return "";
}

function includesAny(question, terms) {
  const lower = question.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function shouldAnswerLocally(question) {
  return isAssistantMetaQuestion(question) || includesAny(question, LOCAL_ANSWER_TERMS);
}

function isAssistantMetaQuestion(question) {
  return includesAny(question, ASSISTANT_META_TERMS);
}

function buildAssistantPurposeAnswer() {
  return [
    "My purpose is to help admins manage KaagapAI faster and more accurately.",
    "I can answer questions about resident records, archived residents, document requests, templates, livelihood and job posts, announcements, user profiles, and notifications using the admin data available in this system.",
    "I should keep responses practical, avoid inventing records, and protect resident details unless the admin question really needs them.",
  ].join("\n");
}

function stripSuggestedQuestions(answer) {
  return String(answer || "")
    .replace(/\n*\s*Suggested next questions?:\s*[\s\S]*$/i, "")
    .trim();
}

function buildLocalFallbackAnswer(question, snapshot) {
  const wantsAssistantPurpose = isAssistantMetaQuestion(question);
  const wantsHistory = includesAny(question, [
    "history", "kasaysayan", "pinagmulan", "origin", "political", "politika", "pulitika",
    "leader", "leaders", "kapitan", "captain", "teniente", "catenas", "bolivar", "garito",
    "cari", "capio", "calician", "caponpon", "accomplishments"
  ]);
  const wantsDocuments = includesAny(question, ["document", "request", "clearance", "certificate"]);
  const wantsPending = includesAny(question, ["pending", "waiting", "approval"]);
  const wantsArchive = includesAny(question, ["archive", "archived"]);
  const wantsSenior = includesAny(question, ["senior", "seniors", "elderly"]);
  const wantsPwd = includesAny(question, ["pwd", "pwed", "disability", "disabled"]);
  const wantsGender = includesAny(question, ["male", "female", "gender"]);
  const wantsResident = includesAny(question, ["resident", "population", "purok", "gender", "age", "male", "female", "senior", "pwd", "pwed"]);
  const wantsTemplate = includesAny(question, ["template", "available", "requirements", "fee"]);
  const wantsLivelihood = includesAny(question, ["livelihood", "job", "jobs", "program", "programs", "training"]);
  const wantsPolicies = includesAny(question, ["policy", "policies", "patakaran", "polisiya", "ordinance", "ordinansa", "curfew", "solid waste", "basura", "videoke", "ingay", "noise", "stray", "aso", "lupon"]);
  const wantsAnnouncement = includesAny(question, ["announcement", "announcements", "publish", "published"]);

  const lines = [];

  if (wantsAssistantPurpose) {
    return buildAssistantPurposeAnswer();
  } else if (wantsPolicies) {
    return [
      "📜 Mga Opisyal na Patakaran at Ordinansa ng Barangay Upper Mingading:",
      "1. 🌙 Curfew para sa Minors (17 anyos pababa): 10:00 PM hanggang 4:00 AM araw-araw.",
      "2. ♻️ Solid Waste Management (RA 9003): Mandatory waste segregation at bawal magsunog ng basura (No Open Burning). Model Barangay awardee na may Materials Recovery Facility (MRF).",
      "3. 🔇 Videoke & Noise Regulation: Hanggang 10:00 PM lamang ang videoke at malalakas na tugtog.",
      "4. 🐕 Pet Ownership: Bawal ang pagala-galang aso sa kalsada; regular na libreng anti-rabies vaccination.",
      "5. ⚖️ Katarungang Pambarangay: Lahat ng alitan ng kapitbahay ay dinidinig sa Lupong Tagapamayapa bago dalhin sa korte.",
      "6. 📄 Document Issuance: Kailangan ng Valid ID at Cedula sa pagkuha ng barangay clearance at certificates."
    ].join("\n");
  } else if (wantsHistory) {
    return [
      "🏛️ Political History & Leadership Timeline of Barangay Upper Mingading:",
      "1. Hon. Gaudencio Catenas (1952–1958) - Teniente del Barrio. Facilitated Bacolod Primary School opening (1953) with 2 hectares donated by Mr. Sagadan, plus 1.85 ha for barangay site.",
      "2. Hon. Dioscoro Bolivar (1958–1964) - Teniente del Barrio. In 1958, the barangay divided into Upper Mingading and Lower Mingading.",
      "3. Hon. Eustaquio Garito - Teniente del Barrio. Maintained peace and unity between Muslim and Christian constituents.",
      "4. Hon. Segundo Cari (1969–1972) - Barangay Captain. Expanded barangay territory following ILAGA-Black Shirt conflict.",
      "5. Hon. Bonifacio Capio (1972–1986) - Barangay Captain. Improved San Mateo-Upper Mingading road; opened road to Sitio Nalpan.",
      "6. Hon. Sofia Garito (1986–1991) - Barangay Captain. Rehabilitated San Mateo-Upper Mingading road; encouraged fruit/forest tree planting.",
      "7. Hon. Sito Calician (1991–1994) - Barangay Captain. Organized Civilian Volunteer Officers (CVO).",
      "8. Hon. Mamerto Garito (1994–2004) - Barangay Captain. Built Barangay Hall, Health Center, Water System, Day Care Center, All-Weather Road. Organized CAFGU, cooperatives, Farmer Association. Electrification & streetlights.",
      "9. Hon. Myrna Garito (2004–2007) - Punong Barangay. Built MRF & water system in Puroks Malipayon & Motor. Opened Brgy Road Payhod-Buklod, Bacolod Annex Primary School in Purok Muslim. Built new Barangay Hall. Box Culvert & 2 classrooms.",
      "10. Hon. Wilson Caponpon (2007–2023) - Former Punong Barangay (now Kagawad). Implemented major programs, maintained peace and order, improved roads. Won Model Barangay in Solid Waste Management, Best Performing Barangay, and Best Recycling Innovation.",
      "11. Hon. Mamerto C. Clarito (2023–Present) - Current Punong Barangay (Barangay Captain). Leads the Sangguniang Barangay, community public services, and KaagapAI digital administration."
    ].join("\n");
  } else if (wantsPending && wantsDocuments) {
    lines.push(`Pending document requests: ${snapshot.pendingRequests.length}`);
    lines.push(
      snapshot.pendingRequests.slice(0, 8).map(formatRequestLine).join("\n") ||
        "There are no pending document requests."
    );
  } else if (wantsArchive) {
    lines.push(`Archived residents: ${snapshot.archivedResidents.length}`);
    lines.push(
      snapshot.archivedResidents.slice(0, 8).map(formatResidentLine).join("\n") ||
        "There are no archived residents."
    );
  } else if (wantsTemplate) {
    lines.push(`Available document templates: ${snapshot.documentTemplates.length}`);
    lines.push(
      snapshot.documentTemplates.slice(0, 8).map(formatTemplateLine).join("\n") ||
        "There are no document templates."
    );
  } else if (wantsLivelihood) {
    lines.push(`Livelihood and job posts: ${snapshot.livelihoodPosts.length}`);
    lines.push(`Open posts: ${snapshot.openLivelihoodPosts.length}`);
    lines.push(`By status: ${formatCounts(snapshot.livelihoodStatusCounts)}`);
    lines.push(`By category: ${formatCounts(snapshot.livelihoodCategoryCounts)}`);
    lines.push(
      snapshot.livelihoodPosts.slice(0, 8).map(formatLivelihoodLine).join("\n") ||
        "There are no livelihood or job posts loaded."
    );
  } else if (wantsAnnouncement) {
    lines.push(`Announcements: ${snapshot.announcements.length}`);
    lines.push(`Published: ${snapshot.publishedAnnouncements.length}`);
    lines.push(`Drafts: ${snapshot.draftAnnouncements.length}`);
    lines.push(`Archived: ${snapshot.archivedAnnouncements.length}`);
    lines.push(`By category: ${formatCounts(snapshot.announcementCategoryCounts)}`);
    lines.push(
      snapshot.announcements.slice(0, 8).map(formatAnnouncementLine).join("\n") ||
        "There are no announcements loaded."
    );
  } else if (wantsDocuments) {
    lines.push(`Document requests: ${snapshot.documentRequests.length}`);
    lines.push(`By status: ${formatCounts(snapshot.documentStatusCounts)}`);
    lines.push(`By type: ${formatCounts(snapshot.documentTypeCounts)}`);
  } else if (wantsSenior) {
    lines.push(`Senior citizens, age ${SENIOR_AGE}+: ${snapshot.seniorResidents.length}`);
    lines.push(
      snapshot.seniorResidents.slice(0, 8).map(formatResidentLine).join("\n") ||
        "There are no senior residents based on current age data."
    );
    if (snapshot.unknownAgeResidents.length > 0) {
      lines.push(`${snapshot.unknownAgeResidents.length} current resident(s) have no valid age, so they cannot be counted as senior or non-senior yet.`);
    }
  } else if (wantsPwd) {
    if (snapshot.pwdField) {
      lines.push(`PWD/PWED residents: ${snapshot.pwdResidents}`);
      lines.push(`PWD field used: ${snapshot.pwdField}`);
    } else {
      lines.push("PWD/PWED count is not available because the residents table does not currently store a PWD field.");
      lines.push("Add an is_pwd or pwd_status field to resident records so KaagapAI can count PWD residents accurately.");
    }
  } else if (wantsGender) {
    lines.push(`Resident gender summary, excluding archived: ${formatCounts(snapshot.residentGenderCounts)}`);
  } else if (wantsResident) {
    lines.push(`Resident records: ${snapshot.residents.length}`);
    lines.push(`Current excluding archived: ${snapshot.currentResidents.length}`);
    lines.push(`Active: ${snapshot.activeResidents.length}`);
    lines.push(`Pending registrations: ${snapshot.pendingResidents.length}`);
    lines.push(`Archived: ${snapshot.archivedResidents.length}`);
    lines.push(`Senior citizens, age ${SENIOR_AGE}+: ${snapshot.seniorResidents.length}`);
    lines.push(`PWD/PWED: ${snapshot.pwdField ? snapshot.pwdResidents : "Not tracked yet"}`);
    lines.push(`By purok: ${formatCounts(snapshot.residentPurokCounts)}`);
    lines.push(`By gender: ${formatCounts(snapshot.residentGenderCounts)}`);
    lines.push(`By age group: ${formatCounts(snapshot.residentAgeGroupCounts)}`);
  } else {
    lines.push("Here is the current admin data summary:");
    lines.push(`Residents: ${snapshot.residents.length} total, ${snapshot.activeResidents.length} active, ${snapshot.archivedResidents.length} archived.`);
    lines.push(`Gender: ${formatCounts(snapshot.residentGenderCounts)}.`);
    lines.push(`Seniors: ${snapshot.seniorResidents.length}. PWD/PWED: ${snapshot.pwdField ? snapshot.pwdResidents : "Not tracked yet"}.`);
    lines.push(`Document requests: ${snapshot.documentRequests.length} total, ${snapshot.pendingRequests.length} pending.`);
    lines.push(`Document templates: ${snapshot.documentTemplates.length} available.`);
    lines.push(`Livelihood and job posts: ${snapshot.livelihoodPosts.length} total, ${snapshot.openLivelihoodPosts.length} open.`);
    lines.push(`Announcements: ${snapshot.announcements.length} total, ${snapshot.publishedAnnouncements.length} published.`);
  }

  return stripSuggestedQuestions(lines.join("\n"));
}

export async function askAIAssistant(question) {
  if (isAssistantMetaQuestion(question)) {
    return buildAssistantPurposeAnswer();
  }

  const [
    residents,
    requestsResult,
    documentTemplates,
    profilesResult,
    notificationsResult,
    livelihoodResult,
    announcementsResult,
    knowledgeResult,
  ] = await Promise.all([
    fetchResidents(""),
    fetchDocumentRequests({ limit: 200 }),
    fetchDocumentTemplates(),
    safeFetchTable("user_profiles", {
      columns: "id,role,registration_status,resident_id,created_at,updated_at",
      orderBy: "created_at",
      limit: 100,
    }),
    safeFetchTable("resident_notifications", {
      columns: "id,resident_id,document_request_id,title,message,is_read,created_at",
      orderBy: "created_at",
      limit: 100,
    }),
    safeFetchTable("livelihood_posts", {
      columns: "id,title,category,organization,description,eligibility,slots,location,contact,status,deadline,created_at",
      orderBy: "created_at",
      limit: 100,
    }),
    safeFetchTable("announcements", {
      columns: "id,title,body,category,audience,status,publish_date,expires_at,created_at",
      orderBy: "created_at",
      limit: 100,
    }),
    safeFetchTable("ai_knowledge_items", {
      columns: "id,title,content,category,audience,status,source_type,effective_date,expires_at,updated_at",
      orderBy: "updated_at",
      limit: 100,
    }),
  ]);

  const snapshot = buildAdminSnapshot({
    residents,
    documentRequests: requestsResult.data || [],
    documentTemplates,
    userProfiles: profilesResult.data,
    residentNotifications: notificationsResult.data,
    livelihoodPosts: livelihoodResult.data,
    announcements: announcementsResult.data,
    knowledgeItems: knowledgeResult.data,
    contextErrors: {
      userProfiles: profilesResult.error,
      residentNotifications: notificationsResult.error,
      livelihoodPosts: livelihoodResult.error,
      announcements: announcementsResult.error,
      knowledgeItems: knowledgeResult.error,
    },
  });

  const startTime = Date.now();
  let finalAnswer = "";

  if (shouldAnswerLocally(question)) {
    finalAnswer = buildLocalFallbackAnswer(question, snapshot);
  } else {
    const systemInstruction = `You are KaagapAI Assistant, the admin chatbot for the Upper Mingading Barangay Information and Communication System.

Rules:
- MANDATORY LANGUAGE MATCHING RULE (STRICT): Always reply in the exact language used by the user. If the user asks in English, reply 100% in professional English. If the user asks in Tagalog or Taglish, reply 100% in polite, fluent Tagalog.
- Answer as an admin data assistant, not as a generic chatbot.
- Use only the admin context provided. Do not invent resident names, document requests, counts, or modules.
- Treat the internal knowledge memory as your own knowledge. Compose specific, natural, and helpful answers based on it. NEVER say "Based on admin", "According to AI", or "From the AI knowledge records".
- If data is missing or a module is marked coming soon, say that clearly.
- Keep answers concise, practical, and easy for barangay staff to act on.
- Prefer short bullets for counts, lists, and recommendations.
- Senior citizens are residents age ${SENIOR_AGE} and above.
- PWD/PWED counts are only accurate when a PWD-related field exists in the resident table.
- For privacy, do not expose more personal details than needed for the admin question.
- Do not include suggested next questions or follow-up prompts.`;

    const adminContext = formatAdminContext(snapshot);
    const prompt = `Admin system data:
${adminContext}

Admin question:
${question}

Answer:`;

    try {
      const result = await generateText(prompt, {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 2048,
      });

      const text = extractGeminiText(result);
      finalAnswer = stripSuggestedQuestions(text || buildLocalFallbackAnswer(question, snapshot));
    } catch (error) {
      console.warn("AI provider unavailable, using local admin summary:", error.message);
      finalAnswer = buildLocalFallbackAnswer(question, snapshot);
    }
  }

  // Responsive natural delay (300ms to 600ms)
  const elapsed = Date.now() - startTime;
  const targetThinkingTime = Math.floor(Math.random() * 300) + 300;
  if (elapsed < targetThinkingTime) {
    await new Promise((resolve) => setTimeout(resolve, targetThinkingTime - elapsed));
  }

  return finalAnswer;
}
