/**
 * Chatbot Synonyms & Semantic Term Normalizer for KaagapAI
 * Enhances the chatbot to recognize Filipino, Taglish, Bisaya, and colloquial terms
 * for documents, government services, fees, requirements, and community procedures.
 */

// 1. Common Document Type Synonyms
export const DOCUMENT_SYNONYMS = {
  clearance: [
    "clearance",
    "klirans",
    "baranggay clearance",
    "brgy clearance",
    "barangay clearance",
    "police clearance requirement",
    "job clearance",
    "katibayan ng pagkakakilanlan",
    "patunay ng kawalan ng kaso",
    "good moral",
    "sertipikasyon ng clearance",
  ],
  indigency: [
    "indigency",
    "indigent",
    "indigensi",
    "certificate of indigency",
    "patunay ng kahirapan",
    "katibayan ng kahirapan",
    "mahirap",
    "kapos sa buhay",
    "walang pambayad",
    "walang trabaho",
    "ayuda requirement",
    "financial assistance certificate",
    "medical assistance certificate",
    "libreng certificate",
    "pampagamot",
    "tulong pinansyal",
    "dswd certificate",
  ],
  residency: [
    "residency",
    "residensya",
    "certificate of residency",
    "patunay ng paninirahan",
    "katibayan ng paninirahan",
    "patunay na nakatira",
    "katunayan ng tirahan",
    "katibayan ng tirahan",
    "nakatira sa barangay",
    "tumitira",
    "katunayan bilang residente",
    "proof of address",
    "proof of residency",
  ],
  business_permit: [
    "business permit",
    "permit sa negosyo",
    "clearance sa negosyo",
    "tindahan",
    "sari sari store",
    "sari-sari store",
    "negosyo",
    "baringay permit sa tindahan",
    "permit sa tindahan",
    "baringay business clearance",
    "mayor's permit requirement",
    "pagbubukas ng tindahan",
  ],
  cedula: [
    "cedula",
    "sedula",
    "sedola",
    "ctc",
    "community tax certificate",
    "buwis sa komunidad",
    "sedula sa treasurer",
    "tax certificate",
  ],
  barangay_id: [
    "barangay id",
    "brgy id",
    "id sa barangay",
    "tarheta",
    "identipikasyon",
    "identification card",
    "residence id",
    "resident card",
  ],
  solo_parent: [
    "solo parent",
    "solong magulang",
    "single mom",
    "single dad",
    "nag-iisang magulang",
    "solo parent certificate",
    "katibayan ng solong magulang",
  ],
  four_ps: [
    "4ps",
    "four ps",
    "4 ps",
    "pantawid pamilya",
    "4ps certificate",
    "4ps certificates",
    "4ps certification",
    "pantawid pamilyang pilipino",
    "benepisyaryo ng 4ps",
    "katibayan ng 4ps",
    "katibayan sa 4ps",
    "pantawid certificate",
  ],
  rsbsa: [
    "rsbsa",
    "magsasaka",
    "farmer",
    "rehistro ng magsasaka",
    "registry system for basic sectors in agriculture",
    "agrikultura",
    "taniman",
    "rsbsa certificate",
    "rsbsa certification",
  ],
};

// 2. Action & Inquiry Synonyms
export const ACTION_SYNONYMS = {
  requirements: [
    "requirements",
    "requirement",
    "rekisitos",
    "kailangan",
    "mga kailangan",
    "dalhin",
    "mga dadalhin",
    "papeles",
    "dokumento",
    "dokyumento",
    "ipapakita",
    "anong kailangan",
    "ano kailangan",
    "ano ang dalhin",
    "kinahanglan",
    "mga kinahanglanon",
    "unsay kinahanglan",
  ],
  fees: [
    "fee",
    "fees",
    "bayad",
    "magkano",
    "magkanu",
    "singil",
    "presyo",
    "halaga",
    "cost",
    "price",
    "charge",
    "may bayad ba",
    "magkano babayaran",
    "magkano ang babayaran",
    "libre ba",
    "free ba",
    "pila ang bayad",
    "tagpila",
    "pila bayaran",
    "way bayad",
  ],
  process: [
    "process",
    "how to request",
    "how do i request",
    "how can i request",
    "how to get",
    "how to apply",
    "paano kumuha",
    "paano mag-apply",
    "paano mag apply",
    "paano mag-request",
    "paano mag request",
    "hakbang",
    "steps",
    "pamamaraan",
    "proseso",
    "asikasuhin",
    "lakarin",
    "kumuha",
    "hingi",
    "kuha",
    "mag-asikaso",
    "unsaon pagkuha",
    "unsaon pag request",
    "unsaon pag apply",
    "mangayo",
    "request",
  ],
  office_hours: [
    "office hours",
    "oras ng opisina",
    "anong oras bukas",
    "kailan bukas",
    "sarado",
    "sabado linggo ba bukas",
    "operating hours",
    "schedule ng barangay hall",
    "bukas ba ang barangay",
  ],
  complaint: [
    "reklamo",
    "sumbong",
    "away",
    "alitan",
    "blotter",
    "i-blotter",
    "lupon",
    "tagapamayapa",
    "katarungang pambarangay",
    "ireklamo",
    "barangay tanod",
    "peace and order",
  ],
  curfew: [
    "curfew",
    "oras ng labas",
    "bawal lumabas sa gabi",
    "oras ng kabataan",
    "menor de edad",
    "minors sa gabi",
    "hatinggabi",
  ],
  garbage: [
    "basura",
    "garbage",
    "waste",
    "kalat",
    "segregation",
    "nabubulok",
    "di nabubulok",
    "sunog",
    "pagsusunog",
    "mrf",
    "materials recovery",
    "solid waste",
  ],
  noise: [
    "videoke",
    "karaoke",
    "ingay",
    "noise",
    "tugtog",
    "patugtog sa gabi",
    "maingay na kapitbahay",
    "sound system",
  ],
  strays: [
    "aso",
    "pusa",
    "alagang hayop",
    "stray",
    "pagala-gala",
    "tali sa aso",
    "rabies",
    "bakuna sa aso",
    "anti-rabies",
  ],
  livelihood: [
    "livelihood",
    "livelihoods",
    "pangkabuhayan",
    "tulong pangkabuhayan",
    "kabuhayan",
    "ayuda",
    "trabaho",
    "job",
    "jobs",
    "occupation",
    "occupations",
    "profession",
    "professions",
    "career",
    "careers",
    "work",
    "works",
    "employment",
    "hiring",
    "vacancy",
    "vacancies",
    "job opening",
    "job openings",
    "job opportunity",
    "job opportunities",
    "bakante",
    "bakanteng trabaho",
    "empleyo",
    "tesda",
    "training",
    "seminar",
    "oportunidad",
    "hanapbuhay",
    "hanap buhay",
    "pasukan",
    "spes",
  ],
  officials: [
    "opisyal",
    "opisyales",
    "officials",
    "official",
    "offcial",
    "offcials",
    "offical",
    "officals",
    "kapitan",
    "captan",
    "kapitn",
    "kap",
    "punong barangay",
    "punong-barangay",
    "kagawad",
    "kagawds",
    "konsehal",
    "councilor",
    "councilors",
    "pinuno",
    "namumuno",
    "lider",
    "konseho",
    "council",
    "sekretarya",
    "sekretaryo",
    "kalihim",
    "secretary",
    "seccretary",
    "secratary",
    "secrtary",
    "tesorero",
    "tesorera",
    "ingat yaman",
    "treasurer",
    "tresurer",
    "treasurrer",
    "sk chairman",
    "sk chairperson",
    "sangguniang kabataan",
    "organizational chart",
    "org chart",
    "chart",
  ],
  history: [
    "political history",
    "history",
    "hsitory",
    "histroy",
    "hstory",
    "kasaysayan",
    "pinagmulan",
    "first captain",
    "1st captain",
    "unang kapitan",
    "unang pinuno",
    "first leader",
    "1st leader",
    "first official",
    "1st official",
    "first officials",
    "first barangay officials",
    "first barangay offcials",
    "unang opisyal",
    "unang opisyales",
    "past leaders",
    "past captains",
    "dating kapitan",
    "timeline",
  ],
  demographics: [
    "demographic reports",
    "demographic report",
    "demographics report",
    "demographic",
    "demographics",
    "demograpic",
    "demograpics",
    "resident stats",
    "population",
    "populasyon",
    "purok population",
    "seniors count",
    "pwd count",
    "4ps count",
    "household count",
  ],
  portal_guide: [
    "change password",
    "palitan ang password",
    "update password",
    "update my personal info",
    "update personal info",
    "update my profile",
    "edit profile",
    "how to change password",
    "how to update my profile",
    "how to update my personal info",
    "how to request document",
    "how to track request",
    "unsaon pag-ilis ug password",
    "unsaon pag ilis ug password",
    "unsaon pag change password",
    "unsaon pag update sa profile",
    "unsaon pag-update sa akoang profile",
    "unsaon pag update sa akoang info",
    "unsaon pagkuha ug",
  ],
  bisaya_capability: [
    "maka sabot ba ka ug bisaya",
    "maka sabot baka ug bisaya",
    "makasabot ba ka ug bisaya",
    "makasabot kag bisaya",
    "kasabot ka ug bisaya",
    "kasabot baka ug bisaya",
    "kaya nimo mag bisaya",
    "makasulti ba ka ug bisaya",
    "magsulti ug bisaya",
    "kahibalo ka mag bisaya",
    "kabawo ka mag bisaya",
    "pwede ba mag bisaya",
    "sulti ug bisaya",
    "makasabot ka",
  ],
};

/**
 * Normalizes common Filipino, Taglish, and phonetic typos in chatbot queries.
 * @param {string} text
 * @returns {string}
 */
export function correctCommonTypos(text = "") {
  if (!text) return "";
  let clean = String(text).toLowerCase();

  // Bisaya common contractions and typos
  clean = clean.replace(/\bdle\b/gi, "dili");
  clean = clean.replace(/\bkaau\b/gi, "kaayo");
  clean = clean.replace(/\bwa\s+koy\b/gi, "wala koy");

  // Secretary typos & synonyms
  clean = clean.replace(/\bseccretar(y|ies)\b/gi, "secretary");
  clean = clean.replace(/\bsecratar(y|ies)\b/gi, "secretary");
  clean = clean.replace(/\bsecrtar(y|ies)\b/gi, "secretary");
  clean = clean.replace(/\bsekretary[ao]\b/gi, "secretary");
  clean = clean.replace(/\bkalihim\b/gi, "secretary");

  // Treasurer typos & synonyms
  clean = clean.replace(/\btresurer(s)?\b/gi, "treasurer");
  clean = clean.replace(/\btreasurrer(s)?\b/gi, "treasurer");
  clean = clean.replace(/\btresorer[ao]\b/gi, "treasurer");
  clean = clean.replace(/\bingat[-\s]?yaman\b/gi, "treasurer");

  // Captain typos & synonyms
  clean = clean.replace(/\bcaptan(s)?\b/gi, "captain");
  clean = clean.replace(/\bkapitn\b/gi, "captain");
  clean = clean.replace(/\bpunong\s+barangay\b/gi, "captain");
  clean = clean.replace(/\bpunong\s+brgy\b/gi, "captain");

  // Kagawad typos
  clean = clean.replace(/\bkagawds\b/gi, "kagawad");
  clean = clean.replace(/\bkonsehal\b/gi, "kagawad");

  // Officials / Opisyal typos
  clean = clean.replace(/\boffcial(s)?\b/gi, "official$1");
  clean = clean.replace(/\boffical(s)?\b/gi, "official$1");
  clean = clean.replace(/\bofisyal(es)?\b/gi, "official$1");
  clean = clean.replace(/\bopisyal(es)?\b/gi, "official$1");

  // History typos
  clean = clean.replace(/\bhsitor(y|ies)\b/gi, "history");
  clean = clean.replace(/\bhistro(y|ies)\b/gi, "history");
  clean = clean.replace(/\bhstory\b/gi, "history");

  // Password typos
  clean = clean.replace(/\bpasword(s)?\b/gi, "password");
  clean = clean.replace(/\bpasswrd(s)?\b/gi, "password");
  clean = clean.replace(/\bpalit\s+pass\b/gi, "change password");

  // Chatbot typos
  clean = clean.replace(/\bchatboot\b/gi, "chatbot");

  // Announcements & Demographic typos
  clean = clean.replace(/\banouncement(s)?\b/gi, "announcement$1");
  clean = clean.replace(/\banunsiyo(s)?\b/gi, "announcement");
  clean = clean.replace(/\banunsyo(s)?\b/gi, "announcement");
  clean = clean.replace(/\bdemograpic(s)?\b/gi, "demographic$1");
  clean = clean.replace(/\bdemograpics\b/gi, "demographics");

  // Occupations & Livelihood
  clean = clean.replace(/\boccupasion(s)?\b/gi, "occupation$1");
  clean = clean.replace(/\bocasion(s)?\b/gi, "occupation$1");

  return clean;
}

/**
 * Normalizes input text and expands common synonyms to standard canonical keywords.
 * Example: "ano rekisitos sa sedula" -> adds canonical concepts "requirements" and "cedula"
 * @param {string} text
 * @returns {{ normalized: string, detectedDocumentTypes: string[], detectedIntents: string[] }}
 */
export function expandSynonyms(text = "") {
  if (!text) return { normalized: "", detectedDocumentTypes: [], detectedIntents: [] };

  const typoCorrected = correctCommonTypos(text);
  const clean = String(typoCorrected).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const detectedDocumentTypes = [];
  const detectedIntents = [];

  // Check document synonyms
  for (const [docKey, terms] of Object.entries(DOCUMENT_SYNONYMS)) {
    if (terms.some((term) => clean.includes(term))) {
      detectedDocumentTypes.push(docKey);
    }
  }

  // Check action/inquiry synonyms
  for (const [intentKey, terms] of Object.entries(ACTION_SYNONYMS)) {
    if (terms.some((term) => clean.includes(term))) {
      detectedIntents.push(intentKey);
    }
  }

  return {
    normalized: clean,
    detectedDocumentTypes,
    detectedIntents,
  };
}
