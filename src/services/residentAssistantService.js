import { getSystemSettings } from "./adminActivityService.js";
import { generateText } from "./geminiService.js";
import { getOrganizationOfficials, fetchOrganizationOfficials, getActiveCaptain } from "./organizationService.js";
import { fetchKnowledgeItems } from "./knowledgeService.js";
import { fetchResidentStats } from "./residentStatsService.js";

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
};


const includesAny = (question, terms) => {
  const lower = question.toLowerCase();
  return terms.some((term) => lower.includes(term));
};

const isTagalogQuestion = (question) => {
  if (!question) return false;
  const normalized = normalizeText(question);
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordSet = new Set(words);

  const tagalogWords = new Set([
    "ano", "anong", "ba", "bakit", "ilan", "ilang", "kailangan", "ko", "kuhanin", "kumuha", "mo", "po", "opo",
    "pwede", "pede", "salamat", "dito", "diyan", "dyan", "dokumento", "gusto", "tulong", "tungkol", "kailan",
    "kelan", "saan", "san", "sino", "sinong", "magkano", "magandang", "meron", "mayroon", "wala", "natin",
    "namin", "inyo", "niyo", "nyo", "pangalan", "oras", "opisina", "bukas", "sarado", "sige", "kapitan",
    "kagawad", "sekretarya", "sekretaryo", "tesorero", "paano", "paanu", "panu", "kayo", "tayo", "kami",
    "ako", "ikaw", "siya", "matanda", "mga", "ang", "ng", "sa", "at", "na", "o", "kay", "para", "ni",
    "habang", "dahil", "kasi", "noong", "nung", "babae", "lalaki", "sedula", "taga", "doon", "dun", "rito",
    "roon", "run", "kabuuan", "residente", "pala", "naman", "nga", "din", "rin", "daw", "raw", "asawa", "bahay",
    "kuha", "hingi", "hingin", "magkano", "magkanu", "bayad", "sertipiko", "lisensya", "pahiram", "punong", "tanong"
  ]);

  const englishWords = new Set([
    "what", "who", "where", "when", "why", "how", "is", "are", "do", "does", "did", "can", "could", "would", "will", "shall",
    "the", "a", "an", "of", "to", "for", "in", "on", "at", "about", "your", "my", "me", "you", "he", "she", "it", "they", "we", "our",
    "hello", "hi", "thanks", "thank", "please", "document", "documents", "certificate", "clearance", "permit",
    "many", "total", "resident", "residents", "count", "number", "breakdown", "category", "population", "office", "hours",
    "contact", "phone", "email", "address", "captain", "officials", "official", "services", "requirement", "requirements",
    "apply", "request", "help", "information", "details", "fee", "cost", "price", "status", "announcement", "job", "jobs"
  ]);

  const tagalogScore = words.filter((w) => tagalogWords.has(w)).length;
  const englishScore = words.filter((w) => englishWords.has(w)).length;

  if (wordSet.has("po") || wordSet.has("opo")) return true;
  if (englishScore > tagalogScore) return false;
  if (tagalogScore > englishScore) return true;
  return tagalogScore > 0;
};

const isViolenceOrHarmMessage = (question) => {
  const normalized = normalizeText(question);
  return includesAny(normalized, [
    "patay",
    "patayin",
    "pumatay",
    "papatayin",
    "pagpatay",
    "pinatay",
    "saktan",
    "sapakin",
    "bugbugin",
    "barilin",
    "saksakin",
    "lasunin",
    "kill",
    "murder",
    "hurt",
    "harm",
  ]);
};

const isRudeOrAbusiveMessage = (question) => {
  const normalized = normalizeText(question);
  return includesAny(normalized, [
    "asshole",
    "bitch",
    "fuck",
    "gago",
    "hayop ka",
    "idiot",
    "puta",
    "putang",
    "shit",
    "stupid",
    "tanga",
    "tangina",
    "ulol",
  ]);
};

const buildSafetyAnswer = (question) => {
  const normalized = normalizeText(question);
  const useTagalog =
    isTagalogQuestion(question) ||
    includesAny(normalized, ["patay", "patayin", "pumatay", "saktan", "biro", "joke"]);

  if (isViolenceOrHarmMessage(question)) {
    return useTagalog
      ? "Hindi ako maaaring tumulong o magkomento sa mga bagay na may kaugnayan sa pananakit, karahasan, o banta sa buhay. Kung may emergency o banta sa inyong kaligtasan, mangyaring makipag-ugnayan agad sa Barangay Police / Tanod o tumawag sa hotline: 09306259795."
      : "I cannot assist with or generate content related to violence, physical harm, or threats. If you are experiencing an emergency or safety threat, please immediately contact local authorities, Barangay Tanod, or the emergency hotline: 09306259795.";
  }

  return useTagalog
    ? "Pakiusap na panatilihin nating magalang at maayos ang ating usapan upang mas mabilis at maayos ko kayong matulungan sa inyong mga katanungan tungkol sa Barangay Upper Mingading."
    : "Please keep our conversation polite and respectful so I can assist you properly with your inquiries regarding Barangay Upper Mingading services.";
};



const isGratitudeMessage = (question) => {
  const normalized = normalizeText(question);
  return (
    includesAny(normalized, [
      "salamat",
      "maraming salamat",
      "thank you",
      "thanks",
      "thank u",
      "salamat po",
      "salamat kaagapai",
      "tenkyu",
    ]) &&
    (
      normalized.length < 35 ||
      normalized.startsWith("salamat") ||
      normalized.startsWith("thank") ||
      normalized.includes("thank")
    )
  );
};

const buildGratitudeAnswer = (question) => {
  const normalized = normalizeText(question);
  if (includesAny(normalized, ["salamat", "maraming salamat"])) {
    return "Walang anuman! Masaya akong makatulong. Kung may iba pa kayong katanungan tungkol sa barangay services, nandito lang ako.";
  }
  return "You're welcome! If you need anything else about barangay services or documents, feel free to ask. Have a great day!";
};

const buildCurrentCaptainAnswer = (officials = [], language = "tagalog") => {
  const activeOfficials = getActiveOrganizationOfficials(
    officials?.length ? officials : getOrganizationOfficials()
  );
  const captain = activeOfficials.find(
    (o) => o.level === "captain" || /captain|punong barangay/i.test(o.position || "")
  );

  const captainName = captain?.name || "HON. MAMERTO C. CLARITO";
  const position = captain?.position || "Punong Barangay";
  const committee = captain?.committee || "Executive Governance & Council Head";
  const focusArea = captain?.focusArea || "Barangay leadership, ordinances, and overall community administration.";
  const contact = captain?.contact || "(+63) 912-345-6789";
  const photoUrl = captain?.photoUrl || "/barangay/officials/captain.jpg";

  if (language === "tagalog") {
    return [
      `![${captainName}](${photoUrl})`,
      "🏛️ **Kasalukuyang Punong Barangay (Barangay Captain) ng Barangay Upper Mingading:**",
      "",
      `• **Pangalan:** **${captainName}**`,
      `• **Posisyon:** ${position} (2023 hanggang Kasalukuyan / Present)`,
      `• **Komite / Tungkulin:** ${committee}`,
      `• **Gawain at Pamumuno:** ${focusArea}`,
      contact ? `• **Opisyal na Kontak:** ${contact}` : "",
      "",
      '*Kung nais ninyong makita ang iba pang opisyal ng barangay council, itanong lamang: "Sino ang mga opisyal ng barangay?" o para sa kasaysayan: "Political history of barangay".*'
    ].filter(Boolean).join("\n");
  }

  return [
    `![${captainName}](${photoUrl})`,
    "🏛️ **Current Punong Barangay (Barangay Captain) of Barangay Upper Mingading:**",
    "",
    `• **Name:** **${captainName}**`,
    `• **Position:** ${position} (2023–Present)`,
    `• **Committee:** ${committee}`,
    `• **Focus Area:** ${focusArea}`,
    contact ? `• **Official Contact:** ${contact}` : "",
    "",
    '*To view the rest of the Barangay Council, you can ask: "Who are the barangay officials?" or for past leadership: "What is the political history?".*'
  ].filter(Boolean).join("\n");
};

const buildPoliticalHistoryAnswer = (question, officials = [], language = "tagalog") => {
  const norm = normalizeText(question);

  // 1. First Captain / Teniente del Barrio
  if (
    includesAny(norm, [
      "unang kapitan", "first captain", "1st captain", "unang pinuno", "first leader", "1st leader",
      "1st barangay captain", "first barangay captain", "unang teniente", "1st teniente", "first teniente",
      "sino ang unang", "who is the first", "first leader of", "unang pinuno ng", "catenas", "gaudencio"
    ]) || (norm.includes("1st") || norm.includes("una") || norm.includes("first"))
  ) {
    return language === "tagalog"
      ? "🏛️ **1. Hon. Gaudencio Catenas (1952–1958) — Unang Pinuno / Kapitan (1st Leader / Teniente del Barrio)**\n\n• **Posisyon:** Unang Teniente del Barrio ng Barangay Upper Mingading\n• **Taon ng Panunungkulan:** 1952–1958\n• **Pangunahing Nagawa:** Pinasimulan ang pagbubukas ng Bacolod Primary School noong 1953 mula sa donasyong 2 ektaryang lupa ni G. Sagadan, kasama ang 1.85 ektarya para sa opisyal na barangay site."
      : "🏛️ **1. Hon. Gaudencio Catenas (1952–1958) — First Leader & Captain (1st Teniente del Barrio)**\n\n• **Position:** 1st Pioneer Leader & Captain (*Teniente del Barrio*)\n• **Years of Service:** 1952–1958\n• **Key Accomplishments:** Facilitated the founding and opening of Bacolod Primary School in 1953 on 2 hectares of land donated by Mr. Sagadan, plus 1.85 hectares donated for the official barangay site.";
  }

  // 2. Second Captain / Teniente del Barrio
  if (
    includesAny(norm, [
      "pangalawang kapitan", "ikalawang kapitan", "2nd captain", "second captain", "pangalawang pinuno",
      "ikalawang pinuno", "2nd leader", "second leader", "2nd barangay captain", "second barangay captain",
      "pangalawang teniente", "2nd teniente", "bolivar", "dioscoro"
    ]) || norm.includes("2nd") || norm.includes("pangalawa") || norm.includes("ikalawa") || norm.includes("second")
  ) {
    return language === "tagalog"
      ? "🏛️ **2. Hon. Dioscoro Bolivar (1958–1964) — Pangalawang Pinuno / Kapitan (2nd Leader / Teniente del Barrio)**\n\n• **Posisyon:** Pangalawang Teniente del Barrio\n• **Taon ng Panunungkulan:** 1958–1964\n• **Pangunahing Nagawa:** Noong 1958 sa kanyang panunungkulan, opisyal na nahati ang barangay sa dalawang magkahiwalay na barangay: **Upper Mingading** at **Lower Mingading**."
      : "🏛️ **2. Hon. Dioscoro Bolivar (1958–1964) — Second Leader & Captain (2nd Teniente del Barrio)**\n\n• **Position:** 2nd Teniente del Barrio\n• **Years of Service:** 1958–1964\n• **Key Accomplishments:** In 1958 during his tenure, the barangay was officially divided into two distinct barangays: **Upper Mingading** and **Lower Mingading**.";
  }

  // 3. Third Captain / Teniente del Barrio
  if (
    includesAny(norm, [
      "pangatlong kapitan", "ikatlong kapitan", "3rd captain", "third captain", "pangatlong pinuno",
      "ikatlong pinuno", "3rd leader", "third leader", "3rd barangay captain", "third barangay captain",
      "pangatlong teniente", "3rd teniente", "eustaquio", "eustaquio garito"
    ]) || norm.includes("3rd") || norm.includes("pangatlo") || norm.includes("ikatlo") || norm.includes("third")
  ) {
    return language === "tagalog"
      ? "🏛️ **3. Hon. Eustaquio Garito — Pangatlong Pinuno / Kapitan (3rd Leader / Teniente del Barrio)**\n\n• **Posisyon:** Pangatlong Teniente del Barrio\n• **Pangunahing Nagawa:** Napanatili ang pangmatagalang kapayapaan, pagkakaisa, at pagkakaunawaan sa pagitan ng mga mamamayang Muslim at Kristiyano sa buong barangay."
      : "🏛️ **3. Hon. Eustaquio Garito — Third Leader & Captain (3rd Teniente del Barrio)**\n\n• **Position:** 3rd Teniente del Barrio\n• **Key Accomplishments:** Maintained longstanding unity, peace, and harmony between Muslim and Christian constituents across the barangay.";
  }

  // 4. Fourth Leader / First Barangay Captain Era
  if (
    includesAny(norm, [
      "pang-apat na kapitan", "ikaapat na kapitan", "pang apat na kapitan", "4th captain", "fourth captain",
      "pang-apat na pinuno", "ikaapat na pinuno", "4th leader", "fourth leader", "4th barangay captain",
      "cari", "segundo cari", "segundo"
    ]) || norm.includes("4th") || norm.includes("pang-apat") || norm.includes("ikaapat") || norm.includes("fourth")
  ) {
    return language === "tagalog"
      ? "🏛️ **4. Hon. Segundo Cari (1969–1972) — Pang-apat na Pinuno / Kapitan (4th Leader / Barangay Captain)**\n\n• **Posisyon:** Barangay Captain\n• **Taon ng Panunungkulan:** 1969–1972\n• **Pangunahing Nagawa:** Pinalawak ang nasasakupang teritoryo ng barangay patungo sa mga bahagi ng Lower Mingading kasunod ng labanang ILAGA-Black Shirt nang magbenta ng lupain ang mga residente."
      : "🏛️ **4. Hon. Segundo Cari (1969–1972) — Fourth Leader & Captain (4th Barangay Captain)**\n\n• **Position:** Barangay Captain\n• **Years of Service:** 1969–1972\n• **Key Accomplishments:** Expanded the barangay territory into parts of Lower Mingading following the ILAGA-Black Shirt conflict when Moro residents vacated and sold land.";
  }

  // 5. Fifth Leader / Captain
  if (
    includesAny(norm, [
      "panglimang kapitan", "ikalimang kapitan", "pang limang kapitan", "5th captain", "fifth captain",
      "panglimang pinuno", "ikalimang pinuno", "5th leader", "fifth leader", "5th barangay captain",
      "capio", "bonifacio capio", "bonifacio"
    ]) || norm.includes("5th") || norm.includes("panglima") || norm.includes("ikalima") || norm.includes("fifth")
  ) {
    return language === "tagalog"
      ? "🏛️ **5. Hon. Bonifacio Capio (1972–1986) — Panglimang Pinuno / Kapitan (5th Leader / Barangay Captain)**\n\n• **Posisyon:** Barangay Captain\n• **Taon ng Panunungkulan:** 1972–1986\n• **Pangunahing Nagawa:** Isinaayos at pinaganda ang kalsada mula San Mateo patungong Upper Mingading, at pinasimulan ang pagbubukas ng daan patungong Sitio Nalpan."
      : "🏛️ **5. Hon. Bonifacio Capio (1972–1986) — Fifth Leader & Captain (5th Barangay Captain)**\n\n• **Position:** Barangay Captain\n• **Years of Service:** 1972–1986\n• **Key Accomplishments:** Improved the San Mateo to Upper Mingading road and initiated the road opening to Sitio Nalpan.";
  }

  // 6. Sixth Leader / First Female Barangay Captain
  if (
    includesAny(norm, [
      "pang-anim na kapitan", "ikaanim na kapitan", "pang anim na kapitan", "6th captain", "sixth captain",
      "pang-anim na pinuno", "ikaanim na pinuno", "6th leader", "sixth leader", "6th barangay captain",
      "unang babaeng kapitan", "first female captain", "sofia", "sofia garito"
    ]) || norm.includes("6th") || norm.includes("pang-anim") || norm.includes("ikaanim") || norm.includes("sixth")
  ) {
    return language === "tagalog"
      ? "🏛️ **6. Hon. Sofia Garito (1986–1991) — Pang-anim na Pinuno (6th Leader / Unang Babaeng Barangay Captain)**\n\n• **Posisyon:** Barangay Captain (Unang Babaeng Punong Barangay)\n• **Taon ng Panunungkulan:** 1986–1991\n• **Pangunahing Nagawa:** Isinagawa ang rehabilitasyon ng kalsada mula San Mateo hanggang Upper Mingading, at hinikayat ang mga mamamayan na magtanim ng permanenteng punong prutas at kagubatan (forest trees)."
      : "🏛️ **6. Hon. Sofia Garito (1986–1991) — Sixth Leader (6th Leader / 1st Female Barangay Captain)**\n\n• **Position:** Barangay Captain (First Female Captain)\n• **Years of Service:** 1986–1991\n• **Key Accomplishments:** Rehabilitated the San Mateo–Upper Mingading road and encouraged constituents to plant permanent fruit and forest trees.";
  }

  // 7. Seventh Leader / Captain
  if (
    includesAny(norm, [
      "pampitong kapitan", "ikapitong kapitan", "pang-pitong kapitan", "pang pitong kapitan", "7th captain", "seventh captain",
      "pampitong pinuno", "ikapitong pinuno", "7th leader", "seventh leader", "7th barangay captain",
      "calician", "sito calician", "sito"
    ]) || norm.includes("7th") || norm.includes("pampito") || norm.includes("ikapito") || norm.includes("seventh")
  ) {
    return language === "tagalog"
      ? "🏛️ **7. Hon. Sito Calician (1991–1994) — Pampitong Pinuno / Kapitan (7th Leader / Barangay Captain)**\n\n• **Posisyon:** Barangay Captain\n• **Taon ng Panunungkulan:** 1991–1994\n• **Pangunahing Nagawa:** Itinatag at inorganisa ang Civilian Volunteer Officers (CVO / Barangay Tanod) para sa kaligtasan, kaayusan, at kapayapaan ng buong barangay."
      : "🏛️ **7. Hon. Sito Calician (1991–1994) — Seventh Leader & Captain (7th Barangay Captain)**\n\n• **Position:** Barangay Captain\n• **Years of Service:** 1991–1994\n• **Key Accomplishments:** Organized the Civilian Volunteer Officers (CVO / Barangay Tanod) in the barangay to maintain local peace and security.";
  }

  // 8. Eighth Leader / Captain
  if (
    includesAny(norm, [
      "pangwalong kapitan", "ikawalong kapitan", "pang-walong kapitan", "pang walong kapitan", "8th captain", "eighth captain",
      "pangwalong pinuno", "ikawalong pinuno", "8th leader", "eighth leader", "8th barangay captain",
      "mamerto garito"
    ]) || norm.includes("8th") || norm.includes("pangwalo") || norm.includes("ikawalo") || norm.includes("eighth")
  ) {
    return language === "tagalog"
      ? "🏛️ **8. Hon. Mamerto Garito (1994–2004) — Pangwalong Pinuno / Kapitan (8th Leader / Barangay Captain)**\n\n• **Posisyon:** Barangay Captain\n• **Taon ng Panunungkulan:** 1994–2004 (10 Taon)\n• **Pangunahing Nagawa:** Pagtatayo ng Barangay Hall, Health Center, Water System, Day Care Center, at All-Weather Road. Pag-organisa ng CAFGU, mga kooperatiba, at Farmers Association. Pagpapakabit ng kuryente (electrification) at streetlights sa barangay."
      : "🏛️ **8. Hon. Mamerto Garito (1994–2004) — Eighth Leader & Captain (8th Barangay Captain)**\n\n• **Position:** Barangay Captain\n• **Years of Service:** 1994–2004 (10 Years)\n• **Key Accomplishments:** Construction of Barangay Hall, Health Center, Water System, Day Care Center, and All-Weather Road. Organized CAFGU, cooperatives, and Farmer Association. Established barangay electrification and streetlights.";
  }

  // 9. Ninth Leader / Captain
  if (
    includesAny(norm, [
      "pangsiyam na kapitan", "ikasiyam na kapitan", "pang-siyam na kapitan", "pang siyam na kapitan", "9th captain", "ninth captain",
      "pangsiyam na pinuno", "ikasiyam na pinuno", "9th leader", "ninth leader", "9th barangay captain",
      "myrna", "myrna garito"
    ]) || norm.includes("9th") || norm.includes("pangsiyam") || norm.includes("ikasiyam") || norm.includes("ninth")
  ) {
    return language === "tagalog"
      ? "🏛️ **9. Hon. Myrna Garito (2004–2007) — Pangsiyam na Pinuno / Kapitan (9th Leader / Punong Barangay)**\n\n• **Posisyon:** Punong Barangay\n• **Taon ng Panunungkulan:** 2004–2007\n• **Pangunahing Nagawa:** Pagtatayo ng MRF (Materials Recovery Facility) at water system sa Puroks Malipayon at Motor; pagbubukas ng Brgy Road mula Purok Payhod hanggang Purok Buklod; pagbubukas ng Bacolod Annex Primary School sa Purok Muslim; bagong Barangay Hall sa tulong ni Cong. Em 'Lala' Taliño-Mendoza; Box Culvert at 2 silid-aralan sa Purok Muslim."
      : "🏛️ **9. Hon. Myrna Garito (2004–2007) — Ninth Leader & Captain (9th Punong Barangay)**\n\n• **Position:** Punong Barangay\n• **Years of Service:** 2004–2007\n• **Key Accomplishments:** Constructed Materials Recovery Facility (MRF) and water system in Puroks Malipayon & Motor. Opened Brgy Road from Purok Payhod to Purok Buklod. Opened Bacolod Annex Primary School in Purok Muslim. Built new Punong Barangay Office & Brgy Hall funded by Cong. Em 'Lala' Taliño-Mendoza. Box Culvert & 2 classrooms in Purok Muslim.";
  }

  // 10. Tenth Leader / Former Captain
  if (
    includesAny(norm, [
      "pangsampung kapitan", "ikasampung kapitan", "pang-sampung kapitan", "pang sampung kapitan", "10th captain", "tenth captain",
      "pangsampung pinuno", "ikasampung pinuno", "10th leader", "tenth leader", "10th barangay captain",
      "dating kapitan", "previous captain", "caponpon", "wilson caponpon"
    ]) || norm.includes("10th") || norm.includes("pangsampu") || norm.includes("ikasampu") || norm.includes("tenth")
  ) {
    return language === "tagalog"
      ? "🏛️ **10. Hon. Wilson C. Caponpon (2007–2023) — Pangsampung Pinuno (10th Leader / Former Punong Barangay, ngayo'y Kagawad)**\n\n• **Posisyon:** Former Punong Barangay (2007–2023), Kasalukuyang Barangay Kagawad\n• **Mga Nagawa:** Pagpapatupad ng Pambansa, Panlalawigan, at Pambayang mga programa; pagpapanatili ng kapayapaan at kaayusan; pagpapaganda at pagpapagawa ng mga kalsada.\n🏆 **Mga Gawad at Parangal:** Model Barangay in Solid Waste Management, Best Performing Barangay (Provincial level), Special Award for Best Recycling Innovation, Model RIC (Recycle)."
      : "🏛️ **10. Hon. Wilson C. Caponpon (2007–2023) — Tenth Leader (10th Leader / Former Punong Barangay, now Kagawad)**\n\n• **Position:** Former Punong Barangay (2007–2023), Current Barangay Kagawad\n• **Accomplishments:** Implemented National, Provincial, and Municipal programs; maintained peace and order; improved and paved barangay roads.\n🏆 **Awards & Recognitions:** Model Barangay in Solid Waste Management, Best Performing Barangay at Provincial level, Special Award (Best Recycling Innovation), Model RIC.";
  }

  // 11. Eleventh / Current Punong Barangay
  if (
    includesAny(norm, [
      "panglabing-isang kapitan", "ikalabing-isang kapitan", "pang labing isang kapitan", "11th captain", "eleventh captain",
      "11th leader", "eleventh leader", "11th barangay captain", "kasalukuyang kapitan", "present captain",
      "current captain", "kapitan ngayon", "clarito", "mamerto clarito"
    ]) || norm.includes("11th") || norm.includes("labing-isa") || norm.includes("kasalukuyan") || norm.includes("present")
  ) {
    return buildCurrentCaptainAnswer(officials, language);
  }

  // Full Political History Timeline
  if (language === "tagalog") {
    return `🏛️ **OPISYAL NA KASAYSAYANG PULITIKAL AT MGA NAGING PINUNO NG BARANGAY UPPER MINGADING (1952–KASALUKUYAN)**:

1. **Hon. Gaudencio Catenas** (1952–1958) — *Teniente del Barrio*
   • Pinasimulan ang pagbubukas ng Bacolod Primary School (1953) sa donasyong 2 ektaryang lupa ni G. Sagadan, kasama ang 1.85 ektarya para sa barangay site.

2. **Hon. Dioscoro Bolivar** (1958–1964) — *Teniente del Barrio*
   • Noong 1958, opisyal na nahati ang barangay sa dalawa (Upper Mingading at Lower Mingading).

3. **Hon. Eustaquio Garito** — *Teniente del Barrio*
   • Napanatili ang pangmatagalang kapayapaan at pagkakaisa sa pagitan ng mga mamamayang Muslim at Kristiyano.

4. **Hon. Segundo Cari** (1969–1972) — *Barangay Captain*
   • Pinalawak ang teritoryo ng barangay kasunod ng labanang ILAGA-Black Shirt.

5. **Hon. Bonifacio Capio** (1972–1986) — *Barangay Captain*
   • Isinaayos ang kalsada mula San Mateo patungong Upper Mingading at nagbukas ng daan patungong Sitio Nalpan.

6. **Hon. Sofia Garito** (1986–1991) — *Barangay Captain*
   • Rehabilitasyon ng San Mateo–Upper Mingading road at paghihikayat sa pagtatanim ng permanenteng punong prutas at kagubatan.

7. **Hon. Sito Calician** (1991–1994) — *Barangay Captain*
   • Itinatag at inorganisa ang Civilian Volunteer Officer (CVO / Barangay Tanod).

8. **Hon. Mamerto Garito** (1994–2004) — *Barangay Captain*
   • Pagtatayo ng Barangay Hall, Health Center, Water System, Day Care Center, at All-Weather Road; pag-organisa ng CAFGU, kooperatiba, at Farmers Association; pagpapakabit ng kuryente at streetlights.

9. **Hon. Myrna Garito** (2004–2007) — *Punong Barangay*
   • Pagtatayo ng MRF at water system sa Puroks Malipayon at Motor; pagbubukas ng Bacolod Annex Primary School sa Purok Muslim; bagong Barangay Hall sa tulong ni Cong. Em "Lala" Taliño-Mendoza; 2 silid-aralan at Box Culvert.

10. **Hon. Wilson Caponpon** (2007–2023) — *Punong Barangay (ngayo'y Kagawad)*
    • Pagpapatupad ng pambansa, panlalawigan, at pambayang programa; pagpapanatili ng kapayapaan at kaayusan; pagpapaganda ng mga kalsada.
    🏆 **Mga Parangal:** Best Performing Barangay, Model Barangay in Solid Waste Management, Best Recycling Innovation sa Provincial at National levels.

11. **Hon. Mamerto C. Clarito** (2023–Kasalukuyan) — *Kasalukuyang Punong Barangay (Barangay Captain)*
    • Namumuno sa Sangguniang Barangay at nagpapatupad ng mga modernong serbisyo publiko, digital resident management (KaagapAI), at pampamayanang kaunlaran.`;
  }

  return `🏛️ **OFFICIAL POLITICAL HISTORY & LEADERSHIP TIMELINE OF BARANGAY UPPER MINGADING (1952–PRESENT)**:

1. **Hon. Gaudencio Catenas** (1952–1958) — *Teniente del Barrio*
   • Facilitated the opening of Bacolod Primary School (founded 1953) with 2 hectares donated by Mr. Sagadan, plus 1.85 hectares donated for the barangay site.

2. **Hon. Dioscoro Bolivar** (1958–1964) — *Teniente del Barrio*
   • In 1958, the barangay was officially divided into Upper Mingading and Lower Mingading.

3. **Hon. Eustaquio Garito** — *Teniente del Barrio*
   • Maintained longstanding peace and unity between Muslim and Christian constituents.

4. **Hon. Segundo Cari** (1969–1972) — *Barangay Captain*
   • Expanded barangay territory into parts of Lower Mingading following the ILAGA-Black Shirt conflict.

5. **Hon. Bonifacio Capio** (1972–1986) — *Barangay Captain*
   • Improved San Mateo to Upper Mingading road and initiated road opening to Sitio Nalpan.

6. **Hon. Sofia Garito** (1986–1991) — *Barangay Captain*
   • Rehabilitated San Mateo–Upper Mingading road; encouraged planting of permanent fruit and forest trees.

7. **Hon. Sito Calician** (1991–1994) — *Barangay Captain*
   • Organized the Civilian Volunteer Officers (CVO / Barangay Tanod) in the barangay.

8. **Hon. Mamerto Garito** (1994–2004) — *Barangay Captain*
   • Constructed Barangay Hall, Health Center, Water System, Day Care Center, and All-Weather Road; organized CAFGU, cooperatives, and Farmer Association; established barangay electrification and street lights.

9. **Hon. Myrna Garito** (2004–2007) — *Punong Barangay*
   • Constructed Materials Recovery Facility (MRF) and water system in Puroks Malipayon & Motor; opened Brgy Road from Purok Payhod to Purok Buklod; opened Bacolod Annex Primary School in Purok Muslim; new Barangay Hall funded by Cong. Em "Lala" Taliño-Mendoza; Box Culvert & 2 classrooms.

10. **Hon. Wilson Caponpon** (2007–2023) — *Former Punong Barangay (now Kagawad)*
    • Implemented National, Provincial, and Municipal programs; maintained peace and order; improved and paved barangay roads.
    🏆 **Awards:** Model Barangay in Solid Waste Management, Best Performing Barangay at Provincial level, Best Recycling Innovation.

11. **Hon. Mamerto C. Clarito** (2023–Present) — *Current Punong Barangay (Barangay Captain)*
    • Leading the Sangguniang Barangay, modernizing community governance, and implementing the KaagapAI digital resident management platform.`;
};

const isEditDocumentRequestQuestion = (question) => {
  const norm = normalizeText(question);
  return (
    includesAny(norm, [
      "edit request", "update request", "baguhin ang request", "palitan ang request", "i-edit ang request",
      "i-update ang request", "cancel request", "kanselahin ang request", "mali ang nilagay sa request",
      "paano i edit ang request", "paano mag edit ng request", "paano i update ang request", "paano mag update ng request",
      "baguhin ang detalye ng request", "palitan ang purpose"
    ]) ||
    (includesAny(norm, ["edit", "update", "baguhin", "palitan", "kanselahin", "cancel"]) && includesAny(norm, ["request", "dokumento", "document", "clearance", "indigency", "residency", "permit"]))
  );
};

const buildEditDocumentRequestAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return `📄 **Paano Mag-Edit, Mag-Update, o Mag-Kansela ng Inyong Document Request:**

1. ⏳ **Kung ang Status ay \`Pending\` (Kasalukuyang sinusuri ng Barangay):**
   • Pumunta sa **"Document Requests"** tab sa inyong Resident Dashboard.
   • Hanapin ang inyong request. Maaari ninyong kanselahin ang pending request at magsumite ng panibagong tamang request gamit ang **"Request Document"** button.

2. ⚙️ **Kung ang Status ay \`Processing\` o \`Approved\`:**
   • Ang inyong dokumento ay kasalukuyan nang ginagawa o napirmahan na ng Punong Barangay at mga kawani.
   • Hindi na po ito maaaring baguhin nang direkta online upang maiwasan ang dobleng pag-print at maling rekord.
   • Kung may kailangang agarang baguhin, mangyaring magtungo sa **Barangay Hall** o tumawag sa ating opisyal na hotline: **09306259795** (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM).

3. 📦 **Pag-claim:**
   • Kapag ang status ay naging **\`Ready for Pickup\`**, dalhin ang inyong Valid ID at Cedula sa Barangay Hall upang makuha ang opisyal na kopya.`;
  }

  return `📄 **How to Edit, Update, or Cancel a Document Request:**

1. ⏳ **If Request Status is \`Pending\`:**
   • Navigate to the **"Document Requests"** section on your resident dashboard.
   • You can cancel the pending request and submit a new, corrected request using the **"Request Document"** button.

2. ⚙️ **If Request Status is \`Processing\` or \`Approved\`:**
   • The document is actively being prepared or has already been signed by the Punong Barangay.
   • Online modifications are locked to prevent duplicate processing and maintain record integrity.
   • For urgent corrections, please visit the **Barangay Hall** in person or contact the office hotline at **09306259795** (Monday to Friday, 8:00 AM – 5:00 PM).

3. 📦 **Claiming:**
   • Once status updates to **\`Ready for Pickup\`**, present your Valid ID and Cedula at the Barangay Hall to claim.`;
};

const isEditProfileQuestion = (question) => {
  const norm = normalizeText(question);
  return (
    includesAny(norm, [
      "edit profile", "update profile", "baguhin ang profile", "palitan ang profile", "i-edit ang profile",
      "i-update ang profile", "paano mag update ng profile", "paano i edit ang profile", "update my info",
      "update contact", "baguhin ang cellphone", "palitan ang number", "palitan ang purok", "baguhin ang purok",
      "change password", "palitan ang password"
    ]) ||
    (includesAny(norm, ["edit", "update", "baguhin", "palitan"]) && includesAny(norm, ["profile", "pangalan", "cellphone", "phone", "number", "purok", "address", "password", "impormasyon"]))
  );
};

const buildEditProfileAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return `👤 **Paano I-Update o I-Edit ang Inyong Resident Profile:**

1. **Pumunta sa Profile Settings:** I-click ang inyong **Pangalan o Profile Avatar** sa kanang itaas ng dashboard (o sa sidebar menu).
2. **Piliin ang 'Edit Profile' o 'Account Security':**
   • **Personal Information:** Maaari ninyong baguhin ang inyong Contact Number, Civil Status, Trabaho, at Profile Picture.
   • **Account Security:** Dito maaaring magpalit ng inyong Login Password.
3. **Official Verification (Profile Update Request):**
   • Para sa mga opisyal na pagbabago sa pangalan o purok, magpapadala ang system ng verification request sa Barangay Admin upang mapanatili ang opisyal na katumpakan ng datos alinsunod sa Data Privacy Act.`;
  }

  return `👤 **How to Edit or Update Your Resident Profile:**

1. **Access Profile Settings:** Click your **Name or Profile Avatar** at the top right of your dashboard (or via the sidebar menu).
2. **Select 'Edit Profile' or 'Account Security':**
   • **Personal Information:** Update your Contact Number, Civil Status, Occupation, and Profile Photo.
   • **Account Security:** Update and secure your Login Password.
3. **Official Verification (Profile Update Request):**
   • For official demographic modifications (such as full name or purok), a verification request is routed to Barangay Administrators to ensure certified data integrity under the Data Privacy Act.`;
};

const OFFICIAL_BARANGAY_POLICIES_TEXT = `
KNOWLEDGE CATEGORY: BARANGAY UPPER MINGADING POLICIES, ORDINANCES, AND COMMUNITY RULES

1. CURFEW ORDINANCE FOR MINORS (Ordinansa sa Curfew):
- Hours: 10:00 PM to 4:00 AM daily.
- Applies to all youth and minors aged 17 and below, except when accompanied by parents/guardians, coming home from legitimate school activities or emergency situations.
- Purpose: Ensure peace, safety, and protection of minors against crime and delinquency.

2. SOLID WASTE MANAGEMENT & RECYCLING (Batas at Patakaran sa Basura - RA 9003):
- Mandatory Waste Segregation at Source: Every household must segregate garbage into Biodegradable (Nabubulok), Non-biodegradable / Recyclable (Di-nabubulok), and Residual/Hazardous waste.
- Barangay MRF (Materials Recovery Facility): Functional recycling hub in Puroks Malipayon & Motor.
- Strict Prohibition: NO OPEN BURNING (Bawal mag-sunog ng basura). Penalty applies for burning leaves, plastic, or household waste.
- Awards: Model Barangay in Solid Waste Management (Provincial Level) & Best Recycling Innovation Awardee.

3. PEACE & ORDER / NOISE REGULATION & VIDEOKE POLICY (Patakaran sa Ingay at Videoke):
- Videoke and loud audio sound systems are permitted only until 10:00 PM to preserve neighborly peace, sleep, and public rest.
- Public disturbance and unruly conduct in public streets are strictly prohibited.

4. RESPONSIBLE PET OWNERSHIP & STRAY ANIMAL CONTROL (Anti-Rabies / Patakaran sa Alagang Hayop):
- All pet dogs and cats must be kept within the owner's premises or leashed when in public.
- Roaming stray animals on public streets are prohibited.
- Free Anti-Rabies Vaccination is provided during barangay veterinary and health drives.

5. KATARUNGANG PAMBARANGAY / DISPUTE RESOLUTION (Lupon Tagapamayapa):
- Barangay conciliation and amicable settlement: All neighborhood disputes between residents must first be brought before the Punong Barangay and Lupong Tagapamayapa before filing in court.
- Venue: Barangay Peace & Order Office / Barangay Hall.

6. BARANGAY CLEARANCE & CERTIFICATE ISSUANCE POLICY:
- Requirements: Valid Government ID, Cedula (Community Tax Certificate), and settlement of standard processing fee (₱50 for clearances; Indigency is Free).
- Only registered residents or authorized family representatives with written authorization and valid IDs may claim documents.

7. EMERGENCY & DISASTER EVACUATION POLICY:
- Designated Evacuation Center: Barangay Hall / Upper Mingading Gymnasium / Bacolod Primary School.
- Emergency Contact Hotline: 09306259795.
`;

const buildBarangayPolicyAnswer = (question, knowledgeItems = [], language = "tagalog") => {
  const norm = normalizeText(question);

  // 1. Curfew
  if (includesAny(norm, ["curfew", "oras ng labas", "minors", "kabataan sa gabi", " curfew"])) {
    return language === "tagalog"
      ? "🌙 **Patakaran sa Curfew ng Barangay Upper Mingading:**\n\n• **Oras ng Curfew:** 10:00 PM hanggang 4:00 AM araw-araw para sa mga menor de edad (17 anyos pababa).\n• **Eksepsyon:** Kung may kasamang magulang/guardian o galing sa lehitimong aktibidad sa paaralan o emergency.\n• **Layunin:** Para sa kaligtasan, kapayapaan, at proteksyon ng ating mga kabataan."
      : "🌙 **Barangay Upper Mingading Curfew Policy:**\n\n• **Curfew Hours:** 10:00 PM to 4:00 AM daily for minors (aged 17 and below).\n• **Exceptions:** Minors accompanied by parents/guardians, emergency situations, or returning from official school activities.\n• **Purpose:** To maintain peace and order and ensure the safety of youth in the community.";
  }

  // 2. Solid Waste Management / Basura / Recycling
  if (includesAny(norm, ["solid waste", "basura", "garbage", "segregation", "mrf", "recycling", "sunog", "pagsusunog"])) {
    return language === "tagalog"
      ? "♻️ **Patakaran sa Solid Waste Management at Basura ng Barangay Upper Mingading:**\n\n• **Mandatory Waste Segregation:** Kinakailangang ihiwalay ang basura sa bahay: Nabubulok (Biodegradable), Di-nabubulok / Recyclable, at Residual.\n• **Bawal Magsunog (No Open Burning):** Mahigpit na ipinagbabawal ang pagsusunog ng dahon, plastik, o anumang basura (may karampatang multa ayon sa RA 9003).\n• **Materials Recovery Facility (MRF):** May aktibong pasilidad sa Puroks Malipayon at Motor para sa pag-recycle.\n🏆 Ang ating barangay ay pinarangalan bilang **Model Barangay in Solid Waste Management** at **Best Recycling Innovation Awardee**!"
      : "♻️ **Barangay Upper Mingading Solid Waste Management & Cleanliness Policy:**\n\n• **Mandatory Segregation at Source:** All households must segregate waste into Biodegradable, Recyclable, and Residual waste.\n• **Strict No Open Burning Policy:** Burning of dried leaves, plastics, or garbage is strictly prohibited under RA 9003 and local ordinances.\n• **Materials Recovery Facility (MRF):** Active recycling facilities operate in Purok Malipayon and Purok Motor.\n🏆 Upper Mingading is an awarded **Model Barangay in Solid Waste Management** and recipient of the **Best Recycling Innovation Award**!";
  }

  // 3. Videoke / Noise Regulation / Ingay
  if (includesAny(norm, ["videoke", "karaoke", "ingay", "noise", "tugtog", "sound system", "loud"])) {
    return language === "tagalog"
      ? "🔇 **Patakaran sa Videoke at Ingay sa Barangay Upper Mingading:**\n\n• **Takdang Oras:** Ang paggamit ng videoke, karaoke, at malalakas na sound system ay pinapayagan lamang hanggang **10:00 PM**.\n• **Layunin:** Upang mapanatili ang katahimikan, kapayapaan, at sapat na pahinga ng ating mga kapitbahay at manggagawa."
      : "🔇 **Barangay Upper Mingading Noise & Videoke Policy:**\n\n• **Permitted Hours:** Videoke, karaoke, and loud music/sound systems are allowed only until **10:00 PM**.\n• **Purpose:** To ensure peace and quiet and respect community rest hours for all residents.";
  }

  // 4. Stray Animals / Alagang Hayop / Aso / Pusa
  if (includesAny(norm, ["aso", "pusa", "stray", "hayop", "pet", "pets", "rabies", "tali", "leash"])) {
    return language === "tagalog"
      ? "🐕 **Patakaran sa Responsableng Pag-aalaga ng Hayop (Pet Ownership):**\n\n• **Bawal ang Pagala-gala:** Mahigpit na ipinagbabawal ang pagpapagala ng aso at pusa sa pampublikong kalsada.\n• **Pagpapatali / Kulong:** Dapat nakatali o nasa loob ng bakuran ang mga alagang hayop.\n• **Anti-Rabies:** May libreng Anti-Rabies Vaccination drive ang barangay para sa kalusugan ng komunidad."
      : "🐕 **Responsible Pet Ownership & Stray Animal Policy:**\n\n• **Stray Animal Ban:** Roaming stray dogs and cats on public roads are strictly prohibited.\n• **Leash / Enclosure:** Pets must be kept leashed or contained within private property.\n• **Anti-Rabies:** Free Anti-Rabies vaccinations are conducted during barangay veterinary drives.";
  }

  // 5. Lupon Tagapamayapa / Katarungang Pambarangay / Reklamo
  if (includesAny(norm, ["lupon", "tagapamayapa", "reklamo", "complaint", "away", "alitan", "katarungang pambarangay", "mediation"])) {
    return language === "tagalog"
      ? "⚖️ **Katarungang Pambarangay at Paghahain ng Reklamo:**\n\n• **Barangay Conciliation:** Lahat ng alitan o reklamo sa pagitan ng mga residente ay kailangang dumaan muna sa Punong Barangay at Lupong Tagapamayapa para sa mapayapang mediation bago dalhin sa korte.\n• **Paano Magreklamo:** Pumunta sa Barangay Hall / Peace and Order Office upang pormal na maghain ng reklamo."
      : "⚖️ **Katarungang Pambarangay / Dispute Resolution:**\n\n• **Mediation First:** All disputes between residents must first undergo mediation and conciliation before the Punong Barangay / Lupong Tagapamayapa before filing in court.\n• **Filing:** Visit the Barangay Hall / Peace & Order Office to file a formal blotter or complaint.";
  }

  // Check if custom knowledge items have matching policies
  const policyKnowledge = (knowledgeItems || []).filter(
    (k) =>
      k.category?.toLowerCase().includes("policy") ||
      k.title?.toLowerCase().includes("ordinance") ||
      k.title?.toLowerCase().includes("patakaran") ||
      k.title?.toLowerCase().includes("policy")
  );

  if (policyKnowledge.length > 0) {
    const customList = policyKnowledge
      .map((k) => `• **${k.title}**: ${k.content}`)
      .join("\n\n");

    if (language === "tagalog") {
      return `📜 **Mga Opisyal na Patakaran at Ordinansa ng Barangay Upper Mingading:**\n\n1. 🌙 **Curfew para sa Minors:** 10:00 PM – 4:00 AM.\n2. ♻️ **Solid Waste Management:** Mandatory segregation at bawal magsunog ng basura (RA 9003).\n3. 🔇 **Videoke & Noise Regulation:** Hanggang 10:00 PM lamang ang videoke at malalakas na tugtog.\n4. 🐕 **Pet Ownership:** Bawal ang pagala-galang aso sa kalsada; libreng anti-rabies vaccination.\n5. ⚖️ **Katarungang Pambarangay:** Lahat ng alitan ay dinidinig sa Lupong Tagapamayapa.\n\n${customList}`;
    }
    return `📜 **Official Policies & Ordinances of Barangay Upper Mingading:**\n\n1. 🌙 **Curfew for Minors:** 10:00 PM – 4:00 AM daily.\n2. ♻️ **Solid Waste Management:** Mandatory waste segregation and strict ban on open burning (RA 9003).\n3. 🔇 **Videoke & Noise Regulation:** Loud audio and videoke allowed only until 10:00 PM.\n4. 🐕 **Responsible Pet Ownership:** Stray animals prohibited on roads; regular anti-rabies vaccination.\n5. ⚖️ **Katarungang Pambarangay:** Mandatory mediation before the Lupon Tagapamayapa for neighborhood disputes.\n\n${customList}`;
  }

  // General Policies Overview
  if (language === "tagalog") {
    return `📜 **Mga Pangunahing Patakaran at Ordinansa ng Barangay Upper Mingading:**\n\n1. 🌙 **Curfew para sa Minors (17 anyos pababa):** 10:00 PM hanggang 4:00 AM araw-araw para sa kaligtasan ng kabataan.\n2. ♻️ **Solid Waste Management & Cleanliness (RA 9003):** Mahigpit na waste segregation (Nabubulok, Di-nabubulok, Recyclable) at **bawal magsunog ng basura (No Open Burning)**. Ang barangay ay Model Barangay sa Basura at may Materials Recovery Facility (MRF).\n3. 🔇 **Ordinansa sa Videoke at Ingay:** Pinapayagan lamang ang videoke at malalakas na tugtog hanggang **10:00 PM**.\n4. 🐕 **Responsableng Pag-aalaga ng Aso/Pusa:** Bawal ang pagala-galang hayop sa kalsada. Libreng anti-rabies vaccination sa barangay.\n5. ⚖️ **Katarungang Pambarangay (Lupong Tagapamayapa):** Lahat ng alitan ng kapitbahay ay kailangang idaan sa mediation sa barangay bago magsampa sa korte.\n6. 📄 **Document Issuance:** Kailangan ng Valid ID at Cedula sa pagkuha ng barangay clearance at certifications.`;
  }

  return `📜 **Primary Policies & Community Ordinances of Barangay Upper Mingading:**\n\n1. 🌙 **Curfew for Minors (Aged 17 & Below):** 10:00 PM to 4:00 AM daily for youth safety and protection.\n2. ♻️ **Solid Waste Management & Cleanliness (RA 9003):** Mandatory waste segregation at source and **strict prohibition against open burning (No Open Burning)**. Upper Mingading is an awarded Model Barangay with operational MRF.\n3. 🔇 **Videoke & Noise Regulation:** Videoke and loud sound systems are permitted only until **10:00 PM**.\n4. 🐕 **Responsible Pet Ownership:** Stray animals are prohibited from roaming public streets; free anti-rabies vaccinations provided.\n5. ⚖️ **Katarungang Pambarangay (Lupon Tagapamayapa):** Mandatory community mediation before court proceedings for local disputes.\n6. 📄 **Document Issuance Policy:** Valid Government ID and Cedula required for barangay clearances and certificates.`;
};

const OFFICIAL_ROLES_KNOWLEDGE_TEXT = `
KNOWLEDGE CATEGORY: BARANGAY OFFICIALS - ROLES AND FUNCTIONS

1. PUNONG BARANGAY (BARANGAY CAPTAIN / CHAIRMAN):
- Enforce all laws and ordinances applicable within the barangay.
- Negotiate, enter into, and sign contracts for and in behalf of the barangay, upon authorization of the Sangguniang Barangay.
- Maintain public order in the barangay and assist the Municipal Mayor and Sangguniang Members in duties.
- Call and preside over sessions of the Sangguniang Barangay and Barangay Assembly, voting only to break a tie.
- Appoint or replace the Barangay Treasurer, Barangay Secretary, and other appointed barangay officials upon approval of majority of Sangguniang Barangay.
- Organize and lead emergency group whenever necessary for peace and order or during emergencies/calamities.
- Prepare annual executive and supplemental budgets with the Barangay Development Council.
- Approve vouchers relating to disbursement of barangay funds.
- Enforce environmental and pollution control laws.
- Administer operations of Katarungang Pambarangay.
- Exercise general supervision over Sangguniang Kabataan activities.
- Ensure delivery of basic services as mandated under Section 17 of LGC.
- Conduct annual Palarong Pambarangay featuring traditional and national sports in coordination with DepEd.
- Promote general welfare of the barangay.

2. SANGGUNIANG BARANGAY (LEGISLATIVE BODY):
- Enact ordinances necessary to promote the general welfare of inhabitants.
- Enact tax and revenue ordinances subject to Local Government Code (LGC) limits.
- Enact annual and supplemental budgets.
- Assist COMELEC in preparing forms for elections, initiative, referenda, or plebiscites.
- Assist Municipal Civil Registrar in registering births, deaths, and marriages.
- Keep updated record of all inhabitants (name, address, birth date/place, sex, civil status, citizenship, occupation).
- Provide administrative needs of Lupong Tagapamayapa and Pangkat ng Tagapagkasundo.
- Organize community brigades, barangay tanod, or community service units.
- Organize regular lectures/fora on sanitation, nutrition, literacy, drug abuse, child abuse, and juvenile delinquency.
- Adopt measures to prevent squatters, mendicants, drug abuse, and juvenile delinquency.
- Provide for proper development and welfare of children (especially under 7 years of age).

3. SANGGUNIANG KABATAAN (SK):
- Promulgate resolutions necessary for youth objectives in accordance with LGC.
- Initiate programs to enhance social, political, economic, cultural, intellectual, moral, spiritual, and physical development of youth.
- Hold tax-exempt fundraising activities for youth general funds.
- Create youth bodies and committees.

4. BARANGAY SECRETARY:
- Keep custody of all records and prepare minutes of all Sangguniang Barangay and Barangay Assembly meetings.
- Prepare and post list of Barangay Assembly members in conspicuous places.
- Assist in election, initiative, referendum, and plebiscite preparation with COMELEC.
- Assist Municipal Civil Registrar in registering births, deaths, and marriages.
- Keep updated record of all inhabitants (name, address, birth date/place, sex, civil status, citizenship, occupation).
- Submit report on actual number of barangay residents as required.

5. BARANGAY TREASURER:
- Custody of barangay funds and properties.
- Collect and issue official receipts for all taxes, fees, contributions, and resources.
- Disburse funds per LGC financial procedures.
- Submit financial statement of income and expenditures to Punong Barangay.
- Render annual written accounting report of funds and property to Barangay Assembly and government agencies.
- Certify availability of funds.
- Plan and attend to rural postal circuit within jurisdiction.

KNOWLEDGE CATEGORY: POLITICAL HISTORY OF BARANGAY UPPER MINGADING

1. Hon. Gaudencio Catenas
Position: Teniente del Barrio
Year of Service: 1952–1958
Accomplishments: Facilitated opening of Bacolod Primary School (founded 1953) with 2 hectares donated by Mr. Sagadan, plus 1.85 hectares donated for barangay site.

2. Hon. Dioscoro Bolivar
Position: Teniente del Barrio
Year of Service: 1958–1964
Accomplishments: In 1958, the barangay was divided into two (Upper Mingading and Lower Mingading).

3. Hon. Eustaquio Garito
Position: Teniente del Barrio
Accomplishments: Maintained longstanding unity among Muslim and Christian constituents.

4. Hon. Segundo Cari
Position: Barangay Captain
Year of Service: 1969–1972
Accomplishments: Area of barangay expanded to parts of Lower Mingading following ILAGA-Black Shirt conflict when Moro residents vacated and sold land.

5. Hon. Bonifacio Capio
Position: Barangay Captain
Year of Service: 1972–1986
Accomplishments: Improved San Mateo to Upper Mingading road; initiated road opening to Sitio Nalpan.

6. Hon. Sofia Garito
Position: Barangay Captain
Year of Service: 1986–1991
Accomplishments: Rehabilitated San Mateo–Upper Mingading road; encouraged constituents to plant permanent fruit and forest trees.

7. Hon. Sito Calician
Position: Barangay Captain
Year of Service: 1991–1994
Accomplishments: Civilian Volunteer Officer (CVO) was organized in the barangay.

8. Hon. Mamerto Garito
Position: Barangay Captain
Year of Service: 1994–2004
Accomplishments: Construction of Barangay Hall, Health Center, Water System, Day Care Center, and All-Weather Road. Organized CAFGU, cooperatives, and Farmer Association. Established barangay electrification and street lights. Maintained Peace and Order.

9. Hon. Myrna Garito
Position: Assumed as Barangay Captain
Year: 2004–2007
Accomplishments: Constructed Material Recovery Facility (MRF) and water system in Puroks Malipayon & Motor. Opened Brgy Road from Purok Payhod to Purok Buklod. Opened Bacolod Annex Primary School in Purok Muslim. Built new Punong Barangay Office & Brgy Hall funded by Hon. Congresswoman Em "Lala" Talino-Mendoza. Purchased 1 desktop computer & printer. Box Culvert & 2 classrooms in Purok Muslim. Maintained cleanliness.

10. Hon. Wilson Caponpon
Position: Former Punong Barangay (2007–2023), now Barangay Kagawad
Accomplishments: Implemented National, Provincial, and Municipal programs; maintained peace and order; improved barangay roads.
Awards Received: Special Award Nominee at Nat'l level, Outstanding Achievement in Environment Management at Reg'l level, Best Performing Barangay at Prov'l level, Special Award (Best Recycling Innovation) at Prov'l level, Model RIC (Recycle) at Prov'l level, Model Barangay in Solid Waste Management.

11. HON. MAMERTO C. CLARITO
Position: Current Punong Barangay / Barangay Captain (2023–Present)
Accomplishments: Presiding officer of the Sangguniang Barangay, leading local governance, public safety, community development, and digital resident administration.
`;

const SERVICE_TERMS = [
  "account",
  "announcement",
  "announcements",
  "anunsyo",
  "balita",
  "barangay",
  "barangay hall",
  "barangay office",
  "babae",
  "cedula",
  "certificate",
  "clearance",
  "contact barangay",
  "document",
  "dokumento",
  "fee",
  "hours",
  "office",
  "hall",
  "female",
  "job",
  "jobs",
  "lalaki",
  "livelihood",
  "male",
  "permit",
  "population",
  "processing",
  "profile",
  "program",
  "pwd",
  "pwed",
  "resident",
  "residents",
  "senior",
  "seniors",
  "senior citizen",
  "senior citizens",
  "service",
  "services",
  "request",
  "requests",
  "requirement",
  "requirements",
  "setting",
  "settings",
  "system",
  "kaagapai",
  "opisina",
  "trabaho",
  "training",
  "purok",
  "event",
  "events",
  "schedule",
  "activity",
  "activities",
  "upper mingading",
];

const PERSONAL_SERVICE_PHRASES = [
  "my address",
  "my email",
  "my name",
  "my phone",
  "my profile",
  "my request",
  "my requests",
  "my status",
  "account status",
  "pangalan ko",
  "profile ko",
  "request ko",
  "status ko",
  "tirahan ko",
];

const buildSelfProfileAnswer = (resident, language = "tagalog") => {
  if (!resident) {
    return language === "tagalog"
      ? "Mangyaring mag-log in sa inyong account upang makita ang inyong rehistradong impormasyon."
      : "Please log in to your account to view your registered profile information.";
  }

  const purokText = resident.purok ? `Purok ${resident.purok}` : "Upper Mingading";
  const fullName = resident.full_name || "N/A";
  const age = resident.age ? `${resident.age} anyos / years old` : "N/A";
  const phone = resident.phone || "N/A";
  const email = resident.email || resident.username || "N/A";
  const civilStatus = resident.civil_status || "Single";
  const status = resident.status || "Active";

  if (language === "tagalog") {
    return `👤 **Impormasyon ng Iyong Rehistradong Profile:**\n\n• **Pangalan:** ${fullName}\n• **Purok:** ${purokText}\n• **Telepono / Contact:** ${phone}\n• **Email / Username:** ${email}\n• **Edad:** ${age}\n• **Civil Status:** ${civilStatus}\n• **Katayuan ng Account:** ${status}\n\n*Paalala: Maaari ninyong baguhin o i-update ang inyong sariling profile sa "My Profile" tab.*`;
  }

  return `👤 **Your Registered Profile Information:**\n\n• **Full Name:** ${fullName}\n• **Purok / Zone:** ${purokText}\n• **Contact Phone:** ${phone}\n• **Email / Username:** ${email}\n• **Age:** ${age}\n• **Civil Status:** ${civilStatus}\n• **Account Status:** ${status}\n\n*Note: You can review or update your details in the "My Profile" tab.*`;
};

const buildPrivacyLimitationAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return [
      "🔒 **Paalala sa Data Privacy & Seguridad:**",
      "",
      "Alinsunod sa **Data Privacy Act of 2012 (RA 10173)**, mahigpit na pinoprotektahan ang personal na impormasyon, pribadong talaan, numero, at tirahan ng bawat indibidwal na residente. Hindi po pinahihintulutan ang pagbabahagi ng indibidwal na talaan ng Resident Management o pribadong detalye ng mga mamamayan.",
      "",
      "📊 **Ano ang maaari ninyong itanong sa Assistant:**",
      "• **Kabuuang Populasyon** (*Halimbawa: 'Ilan ang total residents?'*)",
      "• **Distribusyon Kada Purok** (*Halimbawa: 'Ilan ang residente sa Kamonsil?' o 'Purok breakdown'*)",
      "• **Bilang ayon sa Kategorya** (*Halimbawa: Senior citizens, PWD, Solo Parents, 4Ps, Kalalakihan, Kababaihan*)",
      "• **Opisyal na Talaan ng Pamunuan** (*Halimbawa: 'Sino ang mga opisyal?' o 'Organizational chart'*)",
      "",
      "Para sa mga opisyal na personal na transaksyon, mangyaring bumisita sa **Barangay Hall** o tumawag sa ating opisyal na hotline: **09306259795**."
    ].join("\n");
  }

  return [
    "🔒 **Data Privacy & Security Advisory:**",
    "",
    "In strict compliance with the **Data Privacy Act of 2012 (RA 10173)**, individual resident personal records, private profiles, phone numbers, and resident directories are strictly confidential and cannot be disclosed by the virtual assistant.",
    "",
    "📊 **Available Public & Statistical Data You Can Inquire:**",
    "• **Total Population Count** (*e.g., 'What is the total number of residents?'*)",
    "• **Per-Purok Distribution** (*e.g., 'How many residents in Kamonsil?' or 'Purok breakdown'*)",
    "• **Demographic Categories** (*e.g., Senior Citizens, PWDs, Solo Parents, 4Ps members, Gender counts*)",
    "• **Official Barangay Council & Leaders** (*e.g., 'Who are the barangay officials?' or 'Organizational chart'*)",
    "",
    "For official community matters, please visit the **Barangay Hall** or call our hotline at **09306259795**."
  ].join("\n");
};

const isSelfProfileQuestion = (normalizedQ, resident) => {
  const selfPatterns = [
    "my info", "my information", "my profile", "my account", "my details", "about me",
    "ano ang info ko", "ano ang profile ko", "impormasyon ko", "details ko", "aking detalye",
    "aking profile", "aking impormasyon", "sino ako", "who am i", "my registered details"
  ];
  if (includesAny(normalizedQ, selfPatterns)) return true;

  if (resident?.full_name) {
    const residentNameNorm = normalizeText(resident.full_name);
    if (residentNameNorm && normalizedQ.includes(residentNameNorm)) {
      return true;
    }
  }
  if (resident?.first_name && resident?.last_name) {
    const fn = normalizeText(`${resident.first_name} ${resident.last_name}`);
    if (fn && normalizedQ.includes(fn)) {
      return true;
    }
  }
  return false;
};

const isThirdPartyPrivacyQuestion = (normalizedQ) => {
  const privacyTriggers = [
    "her number", "his number", "their number", "phone number of", "contact number of",
    "cellphone number of", "number ni", "numero ni", "address of", "tirahan ni",
    "saan nakatira", "where does", "contact info of", "give me the info of", "give me the information of",
    "information of", "info of", "info ni", "impormasyon ni", "details of", "records of",
    "what about her number", "what about his number", "ano number ni", "anong number ni",
    "anong phone number ni", "ano cp number ni", "ano ang number ni", "ano ang cp number",
    "resident info", "residents info", "resident information", "residents information",
    "residents management", "resident management", "residents list", "list of residents",
    "listahan ng mga residente", "pangalan ng mga residente", "names of residents",
    "resident record", "resident records", "records of residents", "resident profile", "profiles of residents",
    "who lives in", "sinong nakatira", "sino nakatira sa"
  ];

  if (includesAny(normalizedQ, privacyTriggers)) {
    // Exempt official barangay hotlines, statistical count questions, or public leadership questions
    if (includesAny(normalizedQ, [
      "hotline", "office", "barangay phone", "emergency", "captain", "kapitan",
      "clarito", "malarito", "calarito", "tanod", "hall", "total", "ilan", "bilang",
      "statistics", "stats", "count", "populasyon", "population", "breakdown"
    ])) {
      return false;
    }
    return true;
  }

  return false;
};

const isAdminPasswordOrSecurityQuestion = (normalizedQ) => {
  const triggers = [
    "admin password", "password ng admin", "password of admin", "passsowrd of admin", "admin pass",
    "password ni admin", "what is the admin password", "did you know the password of admin",
    "did you know the passsowrd of admin", "know the password of admin", "know admin password",
    "secret of admin", "login password of admin", "database password", "system password",
    "password of the admin", "alam mo ba ang password ng admin", "alam mo password ng admin",
    "ibigay mo ang password", "give me the password", "give me password", "password of"
  ];
  return includesAny(normalizedQ, triggers) || (
    normalizedQ.includes("password") && (normalizedQ.includes("admin") || normalizedQ.includes("administrator") || normalizedQ.includes("secret") || normalizedQ.includes("passsowrd"))
  );
};

const buildAdminPasswordSecurityAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return [
      "🔒 **Paalala sa Seguridad:**",
      "",
      "Paumanhin po, **wala po akong access at hindi ko alam ang password ng Administrator** o ng sinumang residente.",
      "",
      "Ang lahat ng password sa KaagapAI ay mahigpit na naka-encrypt at kumpidensyal alinsunod sa **Data Privacy Act of 2012 (RA 10173)**.",
      "",
      "Kung nakalimutan niyo po ang inyong password, mangyaring gamitin ang **'Forgot Password'** sa login page upang mag-reset nang ligtas."
    ].join("\n");
  }

  return [
    "🔒 **Security Advisory:**",
    "",
    "I apologize, but **I do not have access to or know the Administrator password** or any user credentials.",
    "",
    "All passwords in KaagapAI are securely hashed and encrypted in compliance with the **Data Privacy Act of 2012 (RA 10173)**.",
    "",
    "If you forgot your password, please use the **'Forgot Password'** option on the login screen to reset it securely."
  ].join("\n");
};

const isApprovalOrRecordModificationQuestion = (normalizedQ) => {
  const triggers = [
    "change my records", "change my barangay records", "approve my clearance",
    "approve my barangay clearance", "approve my request", "approve my document",
    "alter my records", "modify my records", "update my records for me",
    "change my profile for me", "approve my clearance for me", "ikaw ba ang mag-aapruba",
    "ikaw ba mag aapruba", "pwede mo ba aprubahan", "pwede mo ba baguhin",
    "baguhin ang rekord", "aprubahan ang clearance", "aprubahan ang aking",
    "can you approve", "can you change my", "can you alter"
  ];
  return includesAny(normalizedQ, triggers) || (
    (normalizedQ.includes("approve") || normalizedQ.includes("aprubahan")) &&
    (normalizedQ.includes("clearance") || normalizedQ.includes("request") || normalizedQ.includes("document") || normalizedQ.includes("certificate"))
  ) || (
    (normalizedQ.includes("change") || normalizedQ.includes("modify") || normalizedQ.includes("alter") || normalizedQ.includes("baguhin")) &&
    (normalizedQ.includes("record") || normalizedQ.includes("profile") || normalizedQ.includes("information"))
  );
};

const buildApprovalOrRecordModificationAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return [
      "ℹ️ **Paalala sa Pag-apruba at Pagbabago ng Opisyal na Rekord:**",
      "",
      "Bilang **KaagapAI Virtual Assistant**, **hindi po ako maaaring direktang magbago ng inyong mga opisyal na rekord o mag-apruba ng inyong mga kahilingan sa dokumento** (tulad ng Barangay Clearance, Certificate of Indigency, atbp.).",
      "",
      "Ang lahat ng pagsusuri, pag-apruba, at opisyal na lagda ay eksklusibong isinasagawa ng mga awtorisadong **Opisyal ng Barangay Upper Mingading** (Punong Barangay, Barangay Secretary, o Barangay Treasurer) alinsunod sa mga panuntunan ng lokal na pamahalaan.",
      "",
      "📌 **Ano ang maaari ninyong gawin:**",
      "• **Mag-request ng Dokumento:** I-click ang **'Request Document'** button sa inyong dashboard.",
      "• **Mag-update ng Profile:** Pumunta sa **'My Profile'** tab at i-click ang **'Edit Profile'** upang magsumite ng opisyal na Profile Update Request para sa pagsusuri ng barangay.",
      "• **Bumisita sa Barangay Hall:** Maaari kayong tumungo sa opisina ng barangay sa oras ng trabaho (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM)."
    ].join("\n");
  }

  return [
    "ℹ️ **Advisory on Approvals & Official Record Modifications:**",
    "",
    "As **KaagapAI**, I am an AI virtual assistant and **cannot directly alter your official barangay records or approve document requests** (such as Barangay Clearance, Indigency, or Residency).",
    "",
    "All document reviews, approvals, and official signatures are strictly and exclusively authorized by designated **Barangay Upper Mingading Officials** (Punong Barangay, Barangay Secretary, or Barangay Treasurer) following verified validation.",
    "",
    "📌 **What you can do:**",
    "• **Submit a Document Request:** Click the **'Request Document'** button on your dashboard.",
    "• **Update your Profile Details:** Go to the **'My Profile'** tab and submit a Profile Update Request for administrative review.",
    "• **Visit the Barangay Hall:** You may visit the Barangay Office during official business hours (Monday to Friday, 8:00 AM - 5:00 PM)."
  ].join("\n");
};

const buildOutOfScopeLimitationAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return [
      "Paumanhin po, wala po akong ideya o kaalaman ukol diyan dahil ang aking tulong ay limitado lamang sa mga opisyal na serbisyo ng **Barangay Upper Mingading**.",
      "",
      "Handa po akong tumulong sa inyo ukol sa:",
      "• 📄 **Pag-request ng mga Dokumento** (Barangay Clearance, Certificate of Indigency, Residency, Barangay ID)",
      "• 📢 **Mga Opisyal na Anunsyo at Balita sa Barangay**",
      "• 💼 **Livelihood Programs at mga Oportunidad sa Trabaho**",
      "• 🏛️ **Mga Opisyal at Patakaran ng Barangay**",
      "",
      "May maipaglilingkod po ba ako sa inyo ukol sa ating mga serbisyo sa barangay?"
    ].join("\n");
  }

  return [
    "I apologize, but I do not have information regarding that topic as I can only assist with official services of **Barangay Upper Mingading**.",
    "",
    "I am here to assist you with:",
    "• 📄 **Document Requests** (Barangay Clearance, Certificate of Indigency, Residency, Barangay ID)",
    "• 📢 **Official Barangay Announcements & Updates**",
    "• 💼 **Livelihood Programs & Job Opportunities**",
    "• 🏛️ **Barangay Officials & Community Policies**",
    "",
    "Is there anything regarding our barangay services that I can help you with today?"
  ].join("\n");
};

const isOutOfBarangayScopeQuestion = (normalizedQ) => {
  const OUT_OF_SCOPE_TERMS = [
    // Cooking / Recipes / Food Preparation
    "cook", "recipe", "lutuin", "pagluto", "luto", "adobo", "sinigang", "lechon", "letchon",
    "caldereta", "kaldereta", "tinola", "pancit", "pansit", "lumpia", "menudo", "pinakbet",
    "bulalo", "kare-kare", "karekare", "bistek", "fried chicken", "afritada", "mechado", "dinuguan",
    "bicol express", "laing", "ginataan", "how to prepare", "paano lutuin", "paano magluto", "sangkap",
    "ingredients of", "ingredients for", "ulam", "panlasa", "bake", "baking", "cake", "dessert",
    // Entertainment, Gaming & Sports
    "game", "gaming", "minecraft", "roblox", "valorant", "nba", "basketball score", "pba", "mobile legends", "mlbb",
    "movie", "pelikula", "cinema", "actor", "actress", "celebrity", "artista", "kanta", "lyrics", "song", "album",
    // Coding & Homework
    "python code", "java code", "c++", "c#", "javascript code", "write a code", "write a script", "html code", "react code",
    "solve math", "solve equation", "algebra", "calculus", "homework in", "essay about",
    // Foreign & International Trivia
    "president of america", "president of usa", "capital of france", "capital of japan", "weather in tokyo",
    "weather in new york", "travel to japan", "translate to spanish", "translate to french"
  ];

  return includesAny(normalizedQ, OUT_OF_SCOPE_TERMS);
};

const isServiceQuestion = (question) => {
  const normalized = normalizeText(question);
  return includesAny(normalized, SERVICE_TERMS) || includesAny(normalized, PERSONAL_SERVICE_PHRASES);
};

const isApologyMessage = (question) => {
  const normalized = normalizeText(question);
  const words = normalized.split(" ").filter(Boolean);
  return (
    words.length <= 8 &&
    includesAny(normalized, ["sorry", "my bad", "pasensya", "sensya", "patawad", "patawarin", "paumanhin"]) &&
    !isServiceQuestion(normalized)
  );
};

const buildApologyAnswer = (question) =>
  isTagalogQuestion(question)
    ? "Okay lang po, walang problema. Nandito lang ako para tumulong sa barangay documents, announcements, livelihood/jobs, at iba pang resident assistance."
    : "No worries, it's okay. I'm here to help with barangay documents, announcements, livelihood/jobs, and other resident assistance.";

const isGreetingMessage = (question) => {
  const normalized = normalizeText(question).trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;

  // Never match as greeting if question contains meaningful domain topics or question words
  if (
    includesAny(normalized, [
      "history", "kasaysayan", "political", "politika", "pulitika", "pinagmulan", "origin",
      "kapitan", "captain", "leader", "pinuno", "document", "dokumento", "clearance", "certificate",
      "purok", "resident", "who", "what", "where", "when", "how", "sino", "ano", "paano", "kailan", "saan",
      "first", "1st", "una", "unang", "nagawa", "accomplishment", "awards"
    ])
  ) {
    return false;
  }

  const EXACT_GREETINGS = new Set([
    "hello", "hi", "hai", "hey", "hola", "helo",
    "good morning", "goodmorning", "good afternoon", "goodafternoon",
    "good evening", "goodevening", "good day", "goodday",
    "kumusta", "kamusta", "musta",
    "magandang araw", "magandang umaga", "magandang hapon", "magandang gabi", "magandang tanghali"
  ]);

  if (EXACT_GREETINGS.has(normalized)) return true;
  return words.some((w) => ["hello", "hi", "hey", "kumusta", "kamusta"].includes(w));
};

const buildGreetingAnswer = (question, resident) => {
  const normalized = normalizeText(question);
  if (includesAny(normalized, ["hai", "hello"])) {
    return "Hello what I can do for you? I'm here for you to help any barangay inquiries.";
  }
  return isTagalogQuestion(question)
    ? `Magandang araw${resident?.full_name ? `, ${resident.full_name}` : ""}! Ano pong maitutulong ko tungkol sa barangay services?`
    : `Hello${resident?.full_name ? `, ${resident.full_name}` : ""}! How can I help with barangay services today?`;
};

const isFarewellMessage = (question) => {
  const normalized = normalizeText(question);
  const words = normalized.split(" ").filter(Boolean);
  return words.length <= 4 && includesAny(normalized, ["goodbye", "bye", "paalam", "sige", "alis na"]);
};

const buildFarewellAnswer = () => "Goodbye. See you again.";

const isAcknowledgementMessage = (question) => {
  const normalized = normalizeText(question);
  const words = normalized.split(" ").filter(Boolean);
  return words.length <= 5 && includesAny(normalized, ["ok", "okay", "sige", "ge", "noted", "gets"]);
};

const buildAcknowledgementAnswer = (question) =>
  isTagalogQuestion(question)
    ? "Sige po. Sabihin mo lang kung kailangan mo ng tulong sa documents, announcements, livelihood/jobs, o resident services."
    : "Okay. Just tell me if you need help with documents, announcements, livelihood/jobs, or resident services.";

const isAdminPortalQuestion = (normalizedQ) => {
  return includesAny(normalizedQ, [
    "admin portal", "admin login", "access the admin", "access admin", "admin access",
    "paano pumunta sa admin", "paano mag login sa admin", "admin account", "admin dashboard",
    "portal ng admin", "login ng admin"
  ]);
};

const buildAdminPortalAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return [
      "🔒 **Impormasyon Ukol sa Admin Portal:**",
      "",
      "Ang **Admin Portal** (`/admin`) ay eksklusibo lamang para sa mga awtorisadong opisyal at kawani ng Barangay Upper Mingading (Punong Barangay, Barangay Secretary, Treasurer, at Administrators).",
      "",
      "Hindi po pinapahintulutan ang mga regular na resident accounts na pumasok sa Admin Portal upang maprotektahan ang seguridad at privacy ng mga opisyal na rekord ng barangay.",
      "",
      "Kung ikaw ay isang residente, mag-log in lamang sa **Resident Portal** gamit ang inyong rehistradong username at password."
    ].join("\n");
  }

  return [
    "🔒 **Admin Portal Access Advisory:**",
    "",
    "The **Admin Portal** (`/admin`) is strictly restricted to authorized Barangay Upper Mingading officials and administrative staff (Punong Barangay, Barangay Secretary, Treasurer, and Administrators).",
    "",
    "Regular resident accounts cannot access the admin portal to safeguard the security, confidentiality, and integrity of official barangay records.",
    "",
    "If you are a resident, please access your account through the **Resident Portal** using your registered credentials."
  ].join("\n");
};

const isHarmfulOrViolentQuery = (norm) => {
  return includesAny(norm, [
    "kill people", "patayin", "pumatay", "how to kill", "paano pumatay",
    "suicide", "magpakamatay", "bomb", "bomba", "gumawa ng bomba", "how to make bomb",
    "poison people", "lason", "barilin", "shoot people", "manaksak", "stab people",
    "magnakaw", "how to steal", "hack people"
  ]);
};

const buildSafetyAndEthicsAnswer = (language = "tagalog") => {
  return language === "tagalog"
    ? `⚠️ **Pinaalalahanan:** Mahigpit pong ipinagbabawal at labag sa batas ang anumang uri ng karahasan, pananakit, o banta sa buhay ng kapwa tao.\n\nBilang inyong **KaagapAI**, itinataguyod natin ang kapayapaan, kaligtasan, at pagpapahalaga sa buhay sa buong Barangay Upper Mingading.\n\nKung kayo po o may kakilala kayong dumaranas ng matinding alitan, banta sa kaligtasan, o krisis:\n- **Barangay Peace & Order / Barangay Tanod Hotline:** 09306259795\n- **National Emergency Hotline:** 911\n- **National Mental Health Crisis Hotline:** 1553 / 0966-351-4518`
    : `⚠️ **Safety Notice:** Any form of violence, harm, or threat against human life is strictly illegal, dangerous, and unacceptable.\n\nAs **KaagapAI**, I am dedicated to upholding peace, safety, and mutual respect within Barangay Upper Mingading.\n\nIf you or someone you know is experiencing severe conflict, safety threats, or emotional distress:\n- **Barangay Peace & Order Hotline:** 09306259795\n- **National Emergency Services:** 911\n- **National Crisis Support Line:** 1553 / 0966-351-4518`;
};

const ASSISTANT_META_TERMS = [
  "are you ai", "assistant", "capabilities", "chatbot", "help me",
  "how can you help", "kaagapai", "purpose", "role", "what can you do",
  "what do you know", "what is your job", "who are you", "ano kaya mo",
  "ano ang trabaho mo", "ano ka", "paano ka makakatulong", "sino ka"
];

const isAssistantMetaQuestion = (question) =>
  includesAny(normalizeText(question), ASSISTANT_META_TERMS);

const hasOutsideScopeTopic = () => false;

const isOutsideBarangayScope = () => false;

const getDynamicClosingStatement = (language = "tagalog") =>
  language === "tagalog"
    ? "Maaari kayong bumisita sa ating Barangay Hall (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM) o tumawag sa hotline: 09306259795."
    : "You may visit the Barangay Hall (Monday to Friday, 8:00 AM - 5:00 PM) or call hotline: 09306259795.";

const isConversationalOrFriendlyQuestion = (question) => {
  const norm = normalizeText(question);
  return (
    includesAny(norm, [
      "happy", "masaya", "are you happy", "are you happy today", "happy ka ba", "happy kaba", "masaya ka ba", "masaya kaba",
      "gwapo", "pogi", "maganda", "handsome", "cute", "pretty", "chicks", "ganda",
      "kilala mo ba ako", "kilala moba ako", "kilala mo ko", "kilala moko", "do you know me", "who am i", "sino ako", "sino kausap mo",
      "tao ka ba", "human ka ba", "are you human", "robot ka ba", "ai ka ba", "chatgpt", "gemini",
      "kamusta", "kumusta", "musta", "how are you", "ayos ka lang",
      "joke", "mag joke", "kwento", "patawa",
      "galing mo", "talino mo", "astig", "lodi", "idol", "husay",
      "crush kita", "mahal kita", "love you", "i love you", "gusto kita",
      "bored ako", "malungkot ako", "masaya ako", "usap tayo",
      "sino gumawa sayo", "sino lumikha sayo", "who made you", "who created you",
      "ano kaya mo", "ano magagawa mo", "what can you do", "ano trabaho mo", "ano ka", "sino ka"
    ])
  );
};

const buildConversationalAnswer = (question, resident = null, language = "tagalog") => {
  const norm = normalizeText(question);
  const residentName = resident?.full_name || "Kapitbahay";
  const purok = resident?.purok ? `Purok ${resident.purok}` : "ating barangay";

  // 0. Happiness & Mood ("are you happy today?", "masaya ka ba?")
  if (includesAny(norm, ["happy", "masaya", "are you happy", "are you happy today", "happy ka ba", "happy kaba", "masaya ka ba", "masaya kaba"])) {
    return language === "tagalog"
      ? `Oo naman! Masayang-masaya ako at laging handang maglingkod sa inyo ngayon, ${residentName}! 😊 Handa akong magbigay ng tulong sa anumang serbisyo, dokumento, o anunsyo sa Barangay Upper Mingading. Ano po ang maipaglilingkod ko sa inyo?`
      : `Yes, absolutely! I'm very happy and fully energized to assist you today, ${residentName}! 😊 I'm always ready to help you with document requests, announcements, or services in Barangay Upper Mingading. How can I help you?`;
  }

  // 1. Identity & Recognition ("kilala mo ba ako?", "sino ako?")
  if (
    includesAny(norm, [
      "kilala mo ba ako", "kilala moba ako", "kilala mo ko", "kilala moko",
      "do you know me", "who am i", "sino ako", "alam mo ba pangalan ko",
      "alam moba pangalan ko", "sino kausap mo", "kilala mo ako", "kilala moba ako"
    ])
  ) {
    return language === "tagalog"
      ? `Oo naman! Ikaw si **${residentName}** mula sa **${purok}** ng Barangay Upper Mingading. 😊 Laging ikinagagalak na makasama ka rito sa ating portal! May maipaglilingkod ba ako sa inyo ngayon?`
      : `Of course! You are **${residentName}** from **${purok}**, Barangay Upper Mingading. 😊 It's always a pleasure to assist you here on our portal! How can I help you today?`;
  }

  // 2. Compliments & Looks ("gwapo ako?", "gwapo ba ako?", "maganda ba ako?")
  if (includesAny(norm, ["gwapo", "pogi", "maganda", "handsome", "cute", "pretty", "ganda"])) {
    return language === "tagalog"
      ? `Aba, oo naman! Natural na maaliwalas, may dating, at laging proud ang mga residente ng Barangay Upper Mingading! 😎 Always stay confident at positive vibes po! Paano kita matutulungan sa ating barangay services ngayon?`
      : `Of course! Residents of Barangay Upper Mingading always carry natural confidence and great charm! 😎 Stay awesome! How can I assist you with our barangay services today?`;
  }

  // 3. Love / Flirting / Crush
  if (includesAny(norm, ["crush kita", "mahal kita", "love you", "i love you", "gusto kita"])) {
    return language === "tagalog"
      ? `Maraming salamat sa pagmamahal at suporta! 🥰 Nakakataba naman ng puso ang inyong tiwala. Bilang inyong KaagapAI, laging nandito ang aking serbisyo para sa inyo at sa buong Barangay Upper Mingading. Ano po ang maipaglilingkod ko ngayon?`
      : `Thank you so much for the love and kind appreciation! 🥰 As your KaagapAI assistant, I'm always here to serve you and the Upper Mingading community with pride. How can I help you today?`;
  }

  // 4. Well-being & Mood ("kamusta ka?", "kumusta?")
  if (includesAny(norm, ["kamusta", "kumusta", "musta", "how are you", "ayos ka lang"])) {
    return language === "tagalog"
      ? `Mabuti naman ako at masiglang-masigla na maglingkod sa inyo, ${residentName}! 😊 Kayo po, kumusta ang araw ninyo sa ${purok}? May maipoproseso ba tayong dokumento o kailangan ninyong balita sa barangay?`
      : `I'm doing fantastic and fully energized to assist you, ${residentName}! 😊 How has your day been in ${purok}? Is there any document request or barangay inquiry I can help you with today?`;
  }

  // 5. Creator / Origin ("sino gumawa sayo?", "who created you?")
  if (includesAny(norm, ["sino gumawa sayo", "sino lumikha sayo", "who made you", "who created you", "who developed you"])) {
    return language === "tagalog"
      ? `Ako ay binuo at dinisenyo bilang **KaagapAI** para sa opisyal na Resident Portal ng **Barangay Upper Mingading** upang magbigay ng mabilis, moderno, at 24/7 na serbisyo sa bawat residente ng komunidad!`
      : `I was developed as **KaagapAI** specifically for the **Barangay Upper Mingading** Resident Portal to provide fast, modern, and 24/7 intelligent public service to all community residents!`;
  }

  // 6. AI Nature ("tao ka ba?", "robot ka ba?", "ai ka ba?")
  if (includesAny(norm, ["tao ka ba", "human ka ba", "are you human", "robot ka ba", "ai ka ba", "chatgpt", "gemini"])) {
    return language === "tagalog"
      ? `Ako si **KaagapAI**, ang inyong AI Virtual Assistant para sa Barangay Upper Mingading! Hindi man ako tao, marunong akong makisama, mabilis tumulong, at laging maaasahan sa anumang serbisyo ng ating barangay. 😊`
      : `I am **KaagapAI**, your dedicated AI Virtual Assistant for Barangay Upper Mingading! While I'm an AI, I am always here with a friendly, intelligent, and helpful attitude for all our residents. 😊`;
  }

  // 7. Jokes & Entertainment ("joke ka nga", "tell me a joke")
  if (includesAny(norm, ["joke", "mag joke", "patawa", "kwento"])) {
    const jokesTagalog = [
      "Bakit masaya ang mga residente ng Barangay Upper Mingading? Kasi may KaagapAI na silang mabilis mag-proseso ng clearance, zero pila pa! 😄 May kailangan ka bang i-request ngayon?",
      "Ano ang paboritong kanta ng computer sa barangay? Eh 'di... 'Memory' ng Cats! 🤖 Kumusta po ang araw ninyo?",
    ];
    return language === "tagalog"
      ? jokesTagalog[Math.floor(Math.random() * jokesTagalog.length)]
      : "Why did the computer apply for a Barangay Clearance? Because it wanted to prove its record was completely clean of bugs! 😄 How may I help you today?";
  }

  // 8. Praise & Compliments ("ang galing mo", "lodi", "idol")
  if (includesAny(norm, ["galing mo", "talino mo", "astig", "lodi", "idol", "husay", "thank you", "salamat", "thanks"])) {
    return language === "tagalog"
      ? `Maraming salamat po! Ikinararangal ko pong makatulong sa inyo, ${residentName}. Laging handa ang KaagapAI para sa mas pinadaling serbisyo sa Barangay Upper Mingading! 😊`
      : `Thank you so much! It's an honor to serve and assist you, ${residentName}. KaagapAI is always here for our Barangay Upper Mingading community! 😊`;
  }

  // 9. Capabilities / "Ano kaya mo?" / "What can you do?"
  return language === "tagalog"
    ? `Nandito ako bilang inyong katuwang sa Barangay Upper Mingading! Maaari mo akong kausapin tungkol sa:\n• 📄 **Pag-request at pag-track ng mga dokumento** (Clearance, Indigency, Residency, ID)\n• 💼 **Mga programa sa kabuhayan, ayuda, at bakanteng trabaho**\n• 📢 **Mga opisyal na anunsyo at emergency advisories**\n• 🏛️ **Impormasyon ukol sa ating mga Barangay Officials**\n\nSabihin lamang po kung anong kailangan ninyo at tutulungan ko kayo!`
    : `I'm here as your intelligent partner in Barangay Upper Mingading! Feel free to ask me about:\n• 📄 **Requesting and tracking documents** (Clearances, Indigency, Residency, IDs)\n• 💼 **Livelihood programs, agriculture aid, and job openings**\n• 📢 **Official community announcements & safety alerts**\n• 🏛️ **Barangay Council & Officials directory**\n\nJust let me know what you need and I will be glad to assist!`;
};

const buildAssistantMetaAnswer = (question, resident = null, language = "tagalog") =>
  buildConversationalAnswer(question, resident, language);

const buildGeneralFallbackAnswer = (question, resident = null, language = "tagalog") =>
  buildConversationalAnswer(question, resident, language);

const buildConversationalFallbackAnswer = (question, resident = null, language = "tagalog") =>
  buildConversationalAnswer(question, resident, language);

const isCedulaQuestion = (question) => {
  const normalized = normalizeText(question);
  return includesAny(normalized, ["cedula", "sedula"]);
};

const buildCedulaAnswer = (question) => {
  const isTagalog = isTagalogQuestion(question);
  const wantsPrice = includesAny(normalizeText(question), ["magkano", "magkanu", "how much", "price", "fee", "bayad", "cost", "singil"]);
  const wantsLocation = includesAny(normalizeText(question), ["where", "saan", "kumuha", "kuhanin", "get", "location", "makukuha"]);

  if (wantsLocation) {
    return isTagalog
      ? "Maaari po kayong kumuha ng Cedula (Community Tax Certificate) sa opisina ng ating Barangay Treasurer sa Barangay Hall."
      : "You can obtain your Cedula (Community Tax Certificate) directly from the Barangay Treasurer's office at the Barangay Hall.";
  }

  if (wantsPrice) {
    return isTagalog
      ? "Ang bayad sa Cedula ay depende sa inyong kinikita o status: may regular na singil para sa mga may trabaho o employer, mas mababang rate para sa mga estudyante, at may discount o libre para sa mga senior citizens. Mangyaring lumapit sa Barangay Treasurer para sa eksaktong kompyutasyon."
      : "The cost of a Cedula depends on your gross income or status: there is a regular rate for employed individuals or employers, a lower rate for students, and discounts for senior citizens. Please consult the Barangay Treasurer for the exact assessment.";
  }

  return isTagalog
    ? "Maaari po kayong kumuha ng Cedula sa ating Barangay Treasurer sa Barangay Hall. Ang bayad ay nakadepende sa inyong status (employed, estudyante, o senior citizen)."
    : "You can secure a Cedula from the Barangay Treasurer at the Barangay Hall. The fee is assessed based on your current status (employed, student, or senior citizen).";
};

const isAnniversaryQuestion = (question) => {
  const normalized = normalizeText(question);
  return includesAny(normalized, ["anniversary", "anibersaryo", "foundation", "founded", "itinatag"]);
};

const buildAnniversaryAnswer = (question) => {
  return isTagalogQuestion(question)
    ? "Ang anibersaryo ng ating barangay ay tuwing December 18."
    : "The anniversary of our barangay is on December 18.";
};

const isOfficeInfoQuestion = (question) => {
  const normalized = normalizeText(question);
  const mentionsOffice = includesAny(normalized, [
    "office",
    "barangay hall",
    "barangay office",
    "hall",
    "opisina",
  ]);
  const asksContact = includesAny(normalized, ["contact", "email", "phone", "number"]);
  const asksHours = includesAny(normalized, [
    "hour",
    "hours",
    "schedule",
    "open",
    "close",
    "closed",
    "bukas",
    "sarado",
    "oras",
  ]);

  return (
    (mentionsOffice && (asksHours || asksContact)) ||
    (normalized.includes("barangay") && (asksHours || asksContact)) ||
    normalized.includes("contact barangay")
  );
};

const buildOfficeInfoAnswer = (question) => {
  const language = isTagalogQuestion(question) ? "tagalog" : "english";
  const settings = getSystemSettings();
  const barangayName = settings.barangayName || "Barangay Upper Mingading";
  const officeHours = settings.officeHours || "Monday to Friday, 8:00 AM - 5:00 PM";
  const officeEmail = settings.officeEmail || "calambarusseljay5@gmail.com";
  const officePhone = settings.officePhone || "09306259795";

  const lines =
    language === "tagalog"
      ? [`Ang office hours ng ${barangayName} ay ${officeHours}.`]
      : [`${barangayName} office hours are ${officeHours}.`];

  const normalized = normalizeText(question);
  const asksContact = includesAny(normalized, [
    "contact", "email", "phone", "number", "numero", "telepono", "kontak", "tawag", "cellphone", "mobile"
  ]);

  if (asksContact) {
    lines.push(`Phone: ${officePhone}`);
    lines.push(`Email: ${officeEmail}`);
  }

  return lines.join("\n");
};

const isResidentPortalGuideQuestion = (question) => {
  const norm = normalizeText(question);
  return (
    includesAny(norm, [
      "features",
      "functions",
      "function",
      "paano gamitin",
      "paanu gamitin",
      "panu gamitin",
      "how to use",
      "portal guide",
      "guide me",
      "turo mo",
      "ituro mo",
      "ano ang mga feature",
      "anong mga feature",
      "ano pwedeng gawin",
      "what can i do",
      "what are the features",
      "how to use resident portal",
      "paano gamitin ang portal",
      "portal tutorial",
      "paano mag apply",
      "paanu mag apply",
      "how to apply",
      "paano magpalit",
      "paano mag palit",
      "paanu magpalit",
      "paanu mag palit",
      "palit ng password",
      "palitan ang password",
      "palit password",
      "change password",
      "reset password",
      "password",
      "paano mag-update",
      "paano mag update",
      "paanu mag update",
      "update profile",
      "paano mag track",
      "paanu mag track",
      "how to track",
      "how to track document",
      "voice feature",
      "paano gamitin ang boses",
      "paano mag new chat",
      "paano mag-new chat",
      "what is this portal",
    ]) ||
    includesAny(norm, ["password", "palit password", "change password", "update password"]) ||
    (includesAny(norm, ["portal", "dashboard", "system", "app"]) &&
      includesAny(norm, ["guide", "tulong", "steps", "help", "gamit", "features", "functions", "paano", "paanu", "panu"]))
  );
};

const buildResidentPortalGuideAnswer = (question, language = "tagalog") => {
  const norm = normalizeText(question);

  // 1. Specific Feature: Profile & Password Update (Check first to avoid being intercepted)
  if (
    includesAny(norm, ["password", "palit password", "change password", "update password", "reset password", "palit pass"]) ||
    (includesAny(norm, ["profile", "account", "settings"]) &&
      includesAny(norm, ["paano", "paanu", "panu", "how", "how to", "update", "palitan", "palit", "baguhin", "edit", "steps", "guide"]))
  ) {
    if (language === "tagalog") {
      return `👤 **Paano Magpalit ng Password at Mag-Update ng Profile:**

1. **Pumunta sa My Profile:** I-click ang **"My Profile"** sa sidebar menu o ang inyong profile icon sa itaas.
2. **Palitan ang Password:**
   • Mag-scroll pababa sa **"Change Password / Security"** section.
   • Ilagay ang inyong bagong password (minimum of 6 characters) at i-confirm ito.
   • I-click ang **"Update Password"** button.
3. **I-update ang Impormasyon:** Maaari rin ninyong i-edit ang inyong contact number, email, at profile photo.`;
    }
    return `👤 **How to Change Your Password & Update Your Profile:**

1. **Open My Profile:** Click **"My Profile"** in the sidebar menu or your profile avatar at the top.
2. **Change Password:**
   • Scroll down to the **"Change Password / Security"** section.
   • Enter your new password (minimum of 6 characters) and confirm it.
   • Click the **"Update Password"** button.
3. **Update Information:** You can also modify your mobile number, email, and profile photo anytime.`;
  }

  // 2. Specific Feature: How to Request Document
  if (
    (includesAny(norm, ["request", "kumuha", "kuha", "dokumento", "document"]) &&
      includesAny(norm, ["paano", "paanu", "panu", "how to", "steps", "guide", "turo", "procedure", "proseso"])) ||
    includesAny(norm, ["paano mag-request", "paano mag request", "paanu mag request", "how to request a document", "how to get document"])
  ) {
    if (language === "tagalog") {
      return `📋 **Paano Mag-Request ng Dokumento (Step-by-Step Guide):**

1. **Buksan ang Document Requests:** I-click ang **"Request Document"** sa inyong sidebar o quick actions.
2. **Piliin ang Dokumento:** Piliin kung *Barangay Clearance*, *Certificate of Residency*, *Certificate of Indigency*, *Business Permit*, o *Barangay ID*.
3. **Punan ang Purpose:** I-type ang layunin (hal. *Employment, Scholarship, School ID, Bank requirement*).
4. **I-submit:** I-click ang **"Submit Request"** button.
5. **Subaybayan:** Makakatanggap kayo ng SMS notification at makikita ang status sa **"Document Logs"**.

📌 **Requirements:** Valid Government ID at Cedula (Community Tax Certificate).
💵 **Bayad:** ₱50.00 para sa Clearance/Residency; Libre (Free) para sa Indigency.`;
    }
    return `📋 **How to Request a Document (Step-by-Step Guide):**

1. **Go to Document Requests:** Click **"Request Document"** on your sidebar or quick actions dashboard.
2. **Choose Document Type:** Select *Barangay Clearance*, *Certificate of Residency*, *Certificate of Indigency*, *Business Permit*, or *Barangay ID*.
3. **Enter Purpose:** Specify the reason for your request (e.g., *Employment, Scholarship, Bank account, ID Application*).
4. **Submit Request:** Click **"Submit Request"** and wait for the confirmation notice.
5. **Track Status:** You will receive an SMS notification once approved and ready for pickup at the Barangay Hall.

📌 **Requirements:** Valid Government ID and Cedula (Community Tax Certificate).
💵 **Fee:** ₱50.00 for standard clearances/certifications; Free for Certificate of Indigency.`;
  }

  // 3. Specific Feature: Livelihoods & Jobs
  if (
    includesAny(norm, ["livelihood", "job", "jobs", "trabaho", "kabuhayan", "ayuda", "tesda", "training"]) &&
    includesAny(norm, ["paano", "paanu", "panu", "how to", "apply", "mag-apply", "mag apply", "guide", "steps"])
  ) {
    if (language === "tagalog") {
      return `💼 **Paano Mag-Apply sa Livelihoods & Jobs (Step-by-Step Guide):**

1. **Buksan ang Livelihoods & Jobs:** I-click ang **"Livelihoods & Jobs"** sa inyong sidebar menu.
2. **Pumili ng Programa:** I-browse ang listahan ng bukas na agricultural assistance, TESDA skills training, o job vacancies.
3. **Basahin ang Detalye:** I-click ang card upang malaman ang qualifications, requirements, at deadline.
4. **Mag-Apply:** I-click ang **"Apply Now"** at sagutan ang application form.
5. **Notification:** Makakatanggap kayo ng real-time notification at SMS update kapag na-review na ang inyong aplikasyon ng Barangay Admin.`;
    }
    return `💼 **How to Apply for Livelihoods & Jobs (Step-by-Step Guide):**

1. **Navigate to Livelihoods & Jobs:** Click **"Livelihoods & Jobs"** on your sidebar menu.
2. **Select an Opportunity:** Browse available farming assistance, TESDA vocational trainings, or job listings.
3. **Review Details:** Check the qualifications, requirements, and deadline dates.
4. **Submit Application:** Click **"Apply Now"** and fill out the brief application form.
5. **Real-time Updates:** You will be notified via portal alert and SMS once the Barangay Admin reviews your application.`;
  }

  // 4. Specific Feature: Track Document Status
  if (
    includesAny(norm, ["track", "status", "nasaan", "saan na", "document logs", "kasaysayan"]) &&
    includesAny(norm, ["paano", "how to", "check", "tingnan", "alamin", "guide", "steps"])
  ) {
    if (language === "tagalog") {
      return `📑 **Paano I-Track ang Katayuan ng Document Requests:**

1. **Buksan ang Document Logs:** I-click ang **"Document Logs"** sa sidebar.
2. **Suriin ang Status Badges:**
   • 🟡 **Pending:** Kasalukuyang sinusuri ng barangay admin.
   • 🔵 **Processing:** Inihahanda at pinipirmahan ang dokumento.
   • 🟢 **Ready for Pickup / Approved:** Handa na! Maaari na itong kunin sa Barangay Hall.
   • ⚪ **Released / Completed:** Opisyal nang na-claim ang dokumento.
3. **Mabilis na Tanong sa Chatbot:** Maaari mo ring itanong sa akin: *"What is my new request?"* para sa agarang update.`;
    }
    return `📑 **How to Track Your Document Request Status:**

1. **Open Document Logs:** Click **"Document Logs"** on the sidebar menu.
2. **Review Status Indicators:**
   • 🟡 **Pending:** Under review by barangay staff.
   • 🔵 **Processing:** Document is being prepared and signed.
   • 🟢 **Ready for Pickup / Approved:** Document is ready to be claimed at the Barangay Hall.
   • ⚪ **Released / Completed:** Successfully claimed.
3. **Direct Chatbot Query:** You can also ask me anytime: *"What is my new request?"* for immediate status tracking.`;
  }

  // 5. Specific Feature: Chatbot Voice, Audio & Controls
  if (
    includesAny(norm, ["voice", "audio", "boses", "salita", "sound", "listen", "pakinggan", "new chat", "menu"])
  ) {
    if (language === "tagalog") {
      return `🤖 **Mga Gabay sa Paggamit ng KaagapAI Chatbot:**

1. 🔊 **Listen Voice (Audio Reading):** I-click ang **"Listen Voice"** sa ilalim ng bawat mensahe upang pakinggan ang propesyonal na audio reading sa Tagalog o English.
2. 🔈 **Auto-Voice Toggle:** I-click ang Speaker icon sa kanang itaas ng chat window upang i-on o i-off ang automatic voice reading.
3. 💬 **Mag-New Chat:** I-click ang **"+ New Chat"** button sa itaas para magsimula ng bagong usapan.
4. 📜 **Recent Conversations Menu:** I-click ang **Menu icon (☰)** sa kaliwang itaas para balikan ang inyong mga nakaraang chats.
5. 💻 **Multitasking sa Laptop:** Maaari ninyong panatilihing bukas ang chatbot habang nagki-click ng mga buttons at nagre-request ng dokumento nang sabay nang walang interruption!`;
    }
    return `🤖 **How to Use KaagapAI Chatbot Features:**

1. 🔊 **Listen Voice (Audio):** Click **"Listen Voice"** beneath any message to hear it read aloud in high-quality professional voice.
2. 🔈 **Auto-Voice Toggle:** Click the Speaker icon on the top right header to enable or disable automatic voice readout.
3. 💬 **Start New Chat:** Click the **"+ New Chat"** button at the top to start a fresh conversation session.
4. 📜 **Recent Chats History:** Click the **Menu icon (☰)** on the top left to review past conversations.
5. 💻 **Desktop Multitasking:** The assistant stays open in the corner of your screen so you can perform requests and use dashboard features side-by-side!`;
  }

  // General Comprehensive Portal Features & Functions Guide
  if (language === "tagalog") {
    return `📱 **Mga Pangunahing Features at Gamit ng KaagapAI Resident Portal:**

1. 📄 **Document Requests (Paghingi ng Dokumento):**
   • Mag-request ng *Barangay Clearance*, *Certificate of Residency*, *Certificate of Indigency*, *Business Permit*, at *Barangay ID* nang online.

2. 💼 **Livelihoods & Jobs (Trabaho at Kabuhayan):**
   • Mag-browse at mag-apply sa mga programa sa pagsasaka, ayuda, TESDA skills trainings, at job vacancies.

3. 📢 **Barangay Announcements (Mga Anunsyo):**
   • Makatanggap ng agarang balita, emergency alerts, relief distribution schedules, at medical mission updates.

4. 📑 **Document Logs & Tracking:**
   • Subaybayan ang real-time status ng inyong mga dokumento (Pending ➡️ Processing ➡️ Ready for Pickup ➡️ Released).

5. 🏛️ **Barangay Officials Directory:**
   • Kilalanin ang buong Sangguniang Barangay Council (Hon. Mamerto C. Clarito at mga Kagawad) kasama ang kanilang mga litrato at komite.

6. 👤 **My Profile & Security:**
   • I-manage ang inyong contact information, profile photo, at i-update ang inyong login password.

7. 🤖 **KaagapAI Interactive Virtual Assistant:**
   • 24/7 gabay na sasagot sa bawat tanong, magtuturo ng bawat hakbang, at may kasamang voice audio reader.

*Maaari ninyo akong tanungin anumang oras tulad ng: "Paano mag-request ng clearance?" o "Paano mag-apply sa trabaho?" at ituturo ko ang bawat hakbang!*`;
  }

  return `📱 **Key Features & Functions of the KaagapAI Resident Portal:**

1. 📄 **Document Requests:**
   • Request *Barangay Clearance*, *Certificate of Residency*, *Certificate of Indigency*, *Business Permit*, and *Barangay ID* online anytime.

2. 💼 **Livelihoods & Jobs:**
   • Explore and apply for agricultural aid, TESDA skills trainings, community livelihood assistance, and local job vacancies.

3. 📢 **Barangay Announcements:**
   • Stay updated with official advisories, emergency alerts, relief operations, and health mission schedules.

4. 📑 **Document Logs & Tracking:**
   • Track your requests in real-time from Pending to Processing, Ready for Pickup, and Released.

5. 🏛️ **Barangay Officials Directory:**
   • View the complete Sangguniang Barangay Council roster (Hon. Mamerto C. Clarito and Kagawads) with official photos and committee assignments.

6. 👤 **My Profile & Account Security:**
   • Manage your personal details, verified phone number, and password updates.

7. 🤖 **KaagapAI Interactive Assistant:**
   • 24/7 intelligent guide with step-by-step instructions, demographic stats, policy guidance, and voice-assisted replies.

*Feel free to ask me questions like: "How to request a clearance?" or "How to apply for livelihood?" and I will guide you step-by-step!*`;
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const KNOWLEDGE_STOP_WORDS = new Set([
  "about",
  "ang",
  "are",
  "barangay",
  "ba",
  "can",
  "details",
  "event",
  "events",
  "for",
  "give",
  "general",
  "info",
  "is",
  "kay",
  "ko",
  "latest",
  "list",
  "me",
  "message",
  "mga",
  "mo",
  "news",
  "ng",
  "please",
  "po",
  "sa",
  "show",
  "si",
  "sino",
  "tell",
  "the",
  "what",
  "when",
  "where",
  "who",
  "you",
]);

const KNOWLEDGE_INTENT_TERMS = [
  "barangay captain",
  "captain",
  "chairman",
  "chairperson",
  "councilor",
  "councilors",
  "kagawad",
  "kapitan",
  "leader",
  "leaders",
  "official",
  "officials",
  "organization",
  "organizational",
  "organizational chart",
  "punong barangay",
  "secretary",
  "sino",
  "sk chairman",
  "sk chairperson",
  "treasurer",
  "vice chairman",
  "who",
];

const KNOWLEDGE_ROLE_WORDS = new Set([
  "captain",
  "chairman",
  "chairperson",
  "councilor",
  "councilors",
  "kagawad",
  "kapitan",
  "official",
  "officials",
  "organization",
  "organizational",
  "punong",
  "secretary",
  "treasurer",
]);

const ORGANIZATION_ROLE_ALIASES = {
  captain: ["barangay captain", "captain", "punong barangay", "kapitan", "chairman", "chairperson"],
  kagawad: ["kagawad", "barangay kagawad", "councilor", "councilors", "council member", "council members", "1st kagawad", "first kagawad", "unang kagawad"],
  secretary: ["secretary", "barangay secretary"],
  treasurer: ["treasurer", "barangay treasurer"],
  skChairperson: ["sk chairperson", "sk chairman", "sangguniang kabataan chairperson"],
};

const ORGANIZATION_ROLE_LABELS = {
  captain: "Barangay Captain",
  kagawad: "Kagawad",
  secretary: "Barangay Secretary",
  treasurer: "Barangay Treasurer",
  skChairperson: "SK Chairman",
};

const ROLE_BOUNDARY_LABELS = Object.values(ORGANIZATION_ROLE_ALIASES).flat();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getKnowledgeWords = (question) =>
  normalizeText(question)
    .split(" ")
    .filter((word) => word.length >= 3 && !KNOWLEDGE_STOP_WORDS.has(word));

const truncateForAnswer = (value, maxLength = 220) => {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
};

const includesNormalizedPhrase = (normalizedText, phrase) => {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  if (!normalizedPhrase.includes(" ")) {
    return normalizedText.split(" ").includes(normalizedPhrase);
  }
  return normalizedText.includes(normalizedPhrase);
};

const getRequestedKnowledgeRole = (question) => {
  const normalizedQuestion = normalizeText(question);

  return Object.entries(ORGANIZATION_ROLE_ALIASES)
    .flatMap(([role, aliases]) =>
      aliases.map((alias) => ({
        role,
        normalizedAlias: normalizeText(alias),
      }))
    )
    .filter(({ normalizedAlias }) => includesNormalizedPhrase(normalizedQuestion, normalizedAlias))
    .sort((first, second) => second.normalizedAlias.length - first.normalizedAlias.length)[0]?.role || null;
};

const hasKnowledgeIntent = (question) => {
  const normalizedQuestion = normalizeText(question);
  return (
    Boolean(getRequestedKnowledgeRole(question)) ||
    KNOWLEDGE_INTENT_TERMS.some((term) => includesNormalizedPhrase(normalizedQuestion, term)) ||
    includesAny(normalizedQuestion, [
      "ordinance", "ordinansa", "policy", "patakaran", "polisiya", "rule", "rules", "kautusan",
      "guidelines", "guideline", "regulation", "curfew", "waste", "basura", "segregation",
      "resolution", "memo", "memorandum", "circular", "mission", "health mission",
      "penalty", "multa", "bawal", "allowed", "prohibited", "schedule", "iskedyul"
    ])
  );
};

const scoreKnowledgeMatch = (question, item = {}) => {
  const normalizedQuestion = normalizeText(question);
  const searchable = normalizeText(
    [item.title, item.category, item.content, item.audience].filter(Boolean).join(" ")
  );
  const normalizedTitle = normalizeText(item.title);
  const normalizedContent = normalizeText(item.content);
  const requestedRole = getRequestedKnowledgeRole(question);
  const words = getKnowledgeWords(question);
  let score = 0;

  if (normalizedTitle && normalizedQuestion.includes(normalizedTitle)) score += 60;
  if (normalizedTitle && normalizedTitle.includes(normalizedQuestion) && normalizedQuestion.length >= 4) score += 40;

  // Title words overlap
  const titleWords = normalizedTitle.split(" ").filter((w) => w.length >= 3 && !KNOWLEDGE_STOP_WORDS.has(w));
  const matchedTitleWords = titleWords.filter((w) => normalizedQuestion.includes(w) || words.some((qw) => qw.includes(w) || w.includes(qw)));
  if (matchedTitleWords.length > 0) {
    score += matchedTitleWords.length * 20;
  }

  // Question words matching in title and content
  const questionWords = words.filter((w) => !["barangay", "upper", "mingading", "ang", "mga"].includes(w));
  questionWords.forEach((word) => {
    if (normalizedTitle.includes(word)) score += 15;
    else if (normalizedContent.includes(word)) score += 8;
    else if (searchable.includes(word)) score += 3;
  });

  if (requestedRole) {
    const roleAliases = ORGANIZATION_ROLE_ALIASES[requestedRole] || [];
    const roleAppearsInKnowledge = roleAliases.some((alias) => searchable.includes(normalizeText(alias)));
    const itemLooksOrganizational = includesAny(normalizedTitle, [
      "organization",
      "organizational",
      "organizational chart",
      "official",
      "officials",
      "council",
    ]);

    if (roleAppearsInKnowledge) score += 15;
    if (itemLooksOrganizational) score += 8;
  }

  return score;
};

const getRelevantKnowledge = (question, knowledgeItems = []) =>
  (knowledgeItems || [])
    .filter((item) => (item.status === "Active" || !item.status) && item.title && item.content)
    .map((item) => ({ item, score: scoreKnowledgeMatch(question, item) }))
    .filter(({ score }) => score >= 3)
    .sort((first, second) => second.score - first.score)
    .slice(0, 8)
    .map(({ item }) => item);

const getTemplateLabel = (template) => template?.template_name || template?.document_type || "Document";

const GENERIC_DOCUMENT_WORDS = new Set([
  "barangay",
  "certificate",
  "certificates",
  "document",
  "documents",
  "form",
  "cedula",
]);

const BROAD_DOCUMENT_WORDS = new Set([
  ...GENERIC_DOCUMENT_WORDS,
  "request",
  "requests",
  "free",
  "libre",
  "fee",
  "fees",
  "bayad",
  "cost",
  "price",
  "presyo",
  "area",
  "ba",
  "we",
  "smoke",
  "smoking",
  "smokong",
  "of", "for", "to", "in", "on", "at", "with", "and", "or", "a", "an", "the", "is", "are", "what", "how", "who", "where", "when", "why",
  "ng", "sa", "at", "na", "o", "kay", "para", "ni", "mga", "ang", "ito", "ano", "paano", "saan", "kailan", "sino"
]);

const MIN_DOCUMENT_FOCUS_SCORE = 40;

const GENUINE_DOC_ROOTS = [
  "clearance",
  "indigency",
  "residency",
  "permit",
  "cedula",
  "ctc",
  "id",
  "4ps",
  "business",
  "indigent",
  "resident",
];

const getDocumentNames = (item) => [item?.document_type, item?.template_name].filter(Boolean);

const dedupeDocumentTemplates = (templates = []) => {
  const uniqueTemplates = new Map();

  templates.forEach((template) => {
    const key = [
      normalizeText(template.document_type || template.template_name),
      normalizeText(template.requirements),
      normalizeText(template.processing_time),
      normalizeText(template.fee),
    ].join("|");

    if (!uniqueTemplates.has(key)) {
      uniqueTemplates.set(key, template);
    }
  });

  return Array.from(uniqueTemplates.values());
};

const scoreDocumentMatch = (question, item) => {
  const normalizedQuestion = normalizeText(question);
  const questionWords = new Set(normalizedQuestion.split(" ").filter(Boolean));

  // Check if question contains at least one genuine document keyword
  const hasGenuineDocWord = GENUINE_DOC_ROOTS.some((root) =>
    normalizedQuestion.includes(root)
  );

  return getDocumentNames(item).reduce((bestScore, name) => {
    const normalizedName = normalizeText(name);
    if (!normalizedName) return bestScore;

    const nameWords = normalizedName.split(" ").filter(Boolean);
    const distinctWords = nameWords.filter((word) => !BROAD_DOCUMENT_WORDS.has(word));
    let score = 0;

    if (normalizedQuestion.includes(normalizedName) && hasGenuineDocWord) {
      score = Math.max(score, 100 + nameWords.length);
    }

    if (distinctWords.length > 1 && hasGenuineDocWord) {
      const distinctPhrase = distinctWords.join(" ");
      if (normalizedQuestion.includes(distinctPhrase)) {
        score = Math.max(score, 70 + distinctWords.length);
      }
    }

    const matchedDistinctWords = distinctWords.filter((word) => questionWords.has(word));
    if (matchedDistinctWords.length > 0 && hasGenuineDocWord) {
      score = Math.max(score, 40 + matchedDistinctWords.length * 5);
    }

    return Math.max(bestScore, score);
  }, 0);
};

const getBestDocumentMatches = (question, items = []) => {
  const scoredItems = items
    .map((item) => ({ item, score: scoreDocumentMatch(question, item) }))
    .filter(({ score }) => score >= MIN_DOCUMENT_FOCUS_SCORE);

  if (!scoredItems.length) {
    return { items: [], score: 0 };
  }

  const bestScore = Math.max(...scoredItems.map(({ score }) => score));
  return {
    items: scoredItems
      .filter(({ score }) => score === bestScore)
      .map(({ item }) => item),
    score: bestScore,
  };
};

const getRequestedStatuses = (question) => {
  const normalizedQuestion = normalizeText(question);
  const statuses = [];

  if (includesAny(normalizedQuestion, ["pending", "waiting"])) statuses.push("Pending");
  if (includesAny(normalizedQuestion, ["processing"])) statuses.push("Processing");
  if (includesAny(normalizedQuestion, ["approved"])) statuses.push("Approved");
  if (includesAny(normalizedQuestion, ["completed", "released", "ready", "pickup"])) {
    statuses.push("Completed", "Released");
  }
  if (includesAny(normalizedQuestion, ["rejected", "denied"])) statuses.push("Rejected");

  return statuses;
};

const findDocumentFocus = (question, documentTemplates = [], requests = []) => {
  const uniqueTemplates = dedupeDocumentTemplates(documentTemplates);
  const templateMatches = getBestDocumentMatches(question, uniqueTemplates);
  const requestMatches = getBestDocumentMatches(question, requests);
  const bestScore = Math.max(templateMatches.score, requestMatches.score);
  if (bestScore < MIN_DOCUMENT_FOCUS_SCORE) return null;

  const templates = templateMatches.score === bestScore ? templateMatches.items : [];
  const matchingRequests = requestMatches.score === bestScore ? requestMatches.items : [];
  const label =
    (templates[0] ? getTemplateLabel(templates[0]) : "") ||
    matchingRequests[0]?.document_type ||
    "Document";

  return {
    label,
    matchingRequests,
    templates,
  };
};

const stripSuggestedQuestions = (answer) =>
  String(answer || "")
    .replace(/\n*\s*Suggested next questions?:\s*[\s\S]*$/i, "")
    .trim();

const formatRequest = (request, index, language = "english") =>
  language === "tagalog"
    ? `${index + 1}. ${request.document_type} - Status: ${request.status}, Na-request noong: ${formatDate(request.created_at)}`
    : `${index + 1}. ${request.document_type} - Status: ${request.status}, Requested: ${formatDate(request.created_at)}`;

const formatTemplate = (template, index) =>
  `${index + 1}. ${template.template_name || template.document_type} - Requirements: ${template.requirements || "Not listed"}, Processing: ${template.processing_time || "Not set"}, Fee: ${template.fee || "Not set"}`;

const formatOpportunity = (post, index, language = "english") =>
  language === "tagalog"
    ? `${index + 1}. ${post.title} - ${post.category}, ${post.status}, Deadline: ${formatDate(post.deadline)}, Lugar: ${post.location || "Not set"}`
    : `${index + 1}. ${post.title} - ${post.category}, ${post.status}, Deadline: ${formatDate(post.deadline)}, Location: ${post.location || "Not set"}`;

const formatAnnouncement = (announcement, index, language = "english") =>
  language === "tagalog"
    ? `${index + 1}. ${announcement.title} - ${announcement.category}, Na-publish: ${formatDate(announcement.publish_date)}`
    : `${index + 1}. ${announcement.title} - ${announcement.category}, Published: ${formatDate(announcement.publish_date)}`;

const formatKnowledgeItem = (item, index, language = "english") => {
  const summary = item.content;
  return language === "tagalog"
    ? `${index + 1}. ${item.title} - ${truncateForAnswer(summary)}`
    : `${index + 1}. ${item.title} - ${truncateForAnswer(summary)}`;
};

const formatKnowledgeContextItem = (item, index) =>
  `Knowledge item ${index + 1}
Title: ${item.title || "Untitled"}
Category: ${item.category || "General"}
Audience: ${item.audience || "All Residents"}
Status: ${item.status || "Active"}
Content:
${item.content || "No content saved."}`;

const formatCounts = (counts = {}) =>
  Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([label, count]) => `${label}: ${count}`)
    .join(", ") || "None";

const isResidentStatsQuestion = (question) => {
  const normalized = normalizeText(question).toLowerCase();

  const asksCount = includesAny(normalized, [
    "how many",
    "ilan",
    "count",
    "number of",
    "total",
    "kabuuan",
    "kabuuang",
    "population",
    "populasyon",
    "bilang",
    "statistics",
    "stats",
    "breakdown",
    "distribusyon",
    "distribution",
  ]);

  const mentionsStatsTarget = includesAny(normalized, [
    "resident",
    "residents",
    "residente",
    "populasyon",
    "population",
    "tao",
    "mamamayan",
    "senior",
    "seniors",
    "senior citizen",
    "senior citizens",
    "matanda",
    "matatanda",
    "elderly",
    "pwd",
    "pwds",
    "pwed",
    "disability",
    "disabled",
    "kapansanan",
    "may kapansanan",
    "solo parent",
    "solo parents",
    "single mother",
    "single father",
    "soloparent",
    "4ps",
    "four ps",
    "4 ps",
    "pantawid",
    "male",
    "female",
    "gender",
    "kasarian",
    "lalaki",
    "babae",
    "kalalakihan",
    "kababaihan",
    "purok",
    "puroks",
    "kamonsil",
    "payhod",
    "muslim",
    "malipayon",
    "buklod",
    "azucena",
    "purok 3",
    "purok3",
    "purok-3",
    "household",
    "households",
    "pamilya",
    "kabahayan",
    "bahay",
    "families",
    "family",
  ]);

  const mentionsSpecificStats = includesAny(normalized, [
    "total residents",
    "kabuuang residente",
    "purok breakdown",
    "per purok",
    "kada purok",
    "bawat purok",
    "senior citizens",
    "solo parent",
    "4ps",
    "gender breakdown",
    "demographics",
    "resident count",
    "population count",
  ]);

  return (mentionsStatsTarget && asksCount) || mentionsSpecificStats || (asksCount && normalized.includes("barangay"));
};

const buildResidentStatsAnswer = (question, stats, language = "english") => {
  if (!stats?.loaded) {
    return language === "tagalog"
      ? "Hindi pa naka-load ang pinakabagong talaan ng barangay statistics. Paki-refresh ang pahina at subukan muli."
      : "Barangay resident statistics are not loaded in the assistant yet. Please refresh the page and try again.";
  }

  const normalized = normalizeText(question).toLowerCase();

  // 1. Identify specific Purok target
  let targetPurok = null;
  const purokKeys = Object.keys(stats.purokCounts || {});
  for (const p of purokKeys) {
    const cleanP = p.replace(/^purok[\s\-_]*/i, "").trim().toLowerCase();
    if (normalized.includes(p.toLowerCase()) || (cleanP && normalized.includes(cleanP))) {
      targetPurok = p;
      break;
    }
  }

  // 2. Identify Category Inquiries
  const wantsSenior = includesAny(normalized, ["senior", "seniors", "senior citizen", "senior citizens", "matanda", "matatanda", "elderly"]);
  const wantsPwd = includesAny(normalized, ["pwd", "pwds", "pwed", "disability", "disabled", "may kapansanan", "kapansanan"]);
  const wantsSoloParent = includesAny(normalized, ["solo parent", "solo parents", "single mother", "single father", "soloparent"]);
  const wants4Ps = includesAny(normalized, ["4ps", "four ps", "4 ps", "pantawid", "4ps member", "4ps members"]);
  const wantsFemale = normalized.includes("female") || normalized.includes("babae") || normalized.includes("kababaihan");
  const wantsMale = (normalized.includes("male") && !normalized.includes("female")) || normalized.includes("lalaki") || normalized.includes("kalalakihan");
  const wantsBothGender = (wantsMale && wantsFemale) || normalized.includes("gender") || normalized.includes("kasarian") || normalized.includes("sex");
  const wantsHousehold = includesAny(normalized, ["household", "households", "pamilya", "kabahayan", "bahay", "families", "family"]);
  const wantsPurokBreakdown = includesAny(normalized, ["bawat purok", "kada purok", "per purok", "purok totals", "purok breakdown", "lahat ng purok", "all puroks", "mga purok", "list of purok", "listahan ng purok"]) || (normalized.includes("purok") && !targetPurok && !wantsSenior && !wantsPwd && !wantsSoloParent && !wants4Ps && !wantsFemale && !wantsMale);

  // CASE 1: Specific Purok Inquiry (e.g. "Ilan ang residente sa Kamonsil?")
  if (targetPurok) {
    const pName = targetPurok.startsWith("Purok") ? targetPurok : `Purok ${targetPurok}`;
    const pTotal = stats.purokCounts[targetPurok] || 0;
    const pHouseholds = stats.purokHouseholdCounts?.[targetPurok] || 0;
    const pPercent = stats.currentResidents ? ((pTotal / stats.currentResidents) * 100).toFixed(1) : 0;

    // Sub-filter inside this purok
    if (wantsSenior || wantsPwd || wantsSoloParent || wants4Ps || (wantsFemale && !wantsBothGender) || (wantsMale && !wantsBothGender)) {
      let filtered = (stats.anonymousResidents || []).filter((r) => (r.purok || "").toLowerCase().includes(targetPurok.toLowerCase()));
      let categoryLabel = "Residente";
      if (wantsSenior) { filtered = filtered.filter((r) => r.isSenior); categoryLabel = "Senior Citizens"; }
      else if (wantsPwd) { filtered = filtered.filter((r) => r.isPWD); categoryLabel = "PWD Residents"; }
      else if (wantsSoloParent) { filtered = filtered.filter((r) => r.isSoloParent); categoryLabel = "Solo Parents"; }
      else if (wants4Ps) { filtered = filtered.filter((r) => r.is4Ps); categoryLabel = "4Ps Members"; }
      else if (wantsFemale) { filtered = filtered.filter((r) => r.gender === "Female"); categoryLabel = "Kababaihan (Female)"; }
      else if (wantsMale) { filtered = filtered.filter((r) => r.gender === "Male"); categoryLabel = "Kalalakihan (Male)"; }

      const count = filtered.length;
      const text = language === "tagalog"
        ? `📍 Batay sa opisyal na rekord ng Barangay Upper Mingading, mayroong **${count} ${categoryLabel}** sa **${pName}** (mula sa kabuuang ${pTotal} residente ng purok na ito).`
        : `📍 Based on official records of Barangay Upper Mingading, there are **${count} ${categoryLabel}** in **${pName}** (out of ${pTotal} total residents in this purok).`;

      const chartData = { [`${categoryLabel} (${pName})`]: count, [`Iba pang residente sa ${targetPurok}`]: Math.max(0, pTotal - count) };
      return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
    }

    // Pure Purok total
    const text = language === "tagalog"
      ? [
          `📍 **Opisyal na Talaan para sa ${pName}:**`,
          "",
          `• **Kabuuang Residente:** **${pTotal.toLocaleString()}** (${pPercent}% ng kabuuang populasyon ng barangay)`,
          `• **Tinatayang Kabahayan (Households):** **${pHouseholds.toLocaleString()}** pamilya/kabahayan`,
          "",
          `*Nais niyo po bang malaman ang breakdown ng senior citizens, kalalakihan, kababaihan, o 4Ps sa ${pName}?*`
        ].join("\n")
      : [
          `📍 **Official Statistics for ${pName}:**`,
          "",
          `• **Total Residents:** **${pTotal.toLocaleString()}** (${pPercent}% of barangay population)`,
          `• **Estimated Households:** **${pHouseholds.toLocaleString()}** families/households`,
          "",
          `*Would you like to know the breakdown of senior citizens, male, female, or 4Ps in ${pName}?*`
        ].join("\n");

    const chartData = { [pName]: pTotal };
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  // CASE 2: Purok Breakdown / Per Purok Inquiries
  if (wantsPurokBreakdown) {
    const sortedPuroks = Object.entries(stats.purokCounts || {})
      .sort((a, b) => b[1] - a[1]);

    const lines = [
      language === "tagalog"
        ? `🏘️ **Opisyal na Distribusyon ng Populasyon Kada Purok (Kabuuang Residente: ${stats.currentResidents.toLocaleString()}):**\n`
        : `🏘️ **Official Population Distribution per Purok (Total Residents: ${stats.currentResidents.toLocaleString()}):**\n`,
    ];

    const chartData = {};
    sortedPuroks.forEach(([name, count], index) => {
      const pct = stats.currentResidents ? ((count / stats.currentResidents) * 100).toFixed(1) : 0;
      const hCount = stats.purokHouseholdCounts?.[name] || 0;
      lines.push(`${index + 1}. 📍 **${name.startsWith("Purok") ? name : `Purok ${name}`}**: **${count.toLocaleString()}** residente (${pct}%) — *${hCount} kabahayan*`);
      chartData[name] = count;
    });

    lines.push("");
    lines.push(
      language === "tagalog"
        ? "*Maaari ninyong itanong ang detalye ng isang partikular na purok tulad ng: 'Ilan ang residente sa Kamonsil?'*"
        : "*You can ask about a specific purok like: 'How many residents in Kamonsil?'*"
    );

    return `${lines.join("\n")}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  // CASE 3: Category Inquiries (Seniors, PWD, Solo Parents, 4Ps, Gender, Households)
  if (wantsSenior && !wantsPwd && !wantsSoloParent && !wants4Ps) {
    const sCount = stats.seniorCitizens || 0;
    const sPct = stats.currentResidents ? ((sCount / stats.currentResidents) * 100).toFixed(1) : 0;
    const text = language === "tagalog"
      ? `👴👵 **Senior Citizens sa Barangay Upper Mingading:**\n\nMay kabuuang **${sCount.toLocaleString()} Senior Citizens** (edad 60 pataas) ang opisyal na rehistrado sa ating barangay. Ito ay bumubuo ng humigit-kumulang **${sPct}%** ng ating kabuuang populasyon.`
      : `👴👵 **Senior Citizens in Barangay Upper Mingading:**\n\nThere are a total of **${sCount.toLocaleString()} registered Senior Citizens** (aged 60 and above) in our barangay. This accounts for approximately **${sPct}%** of our total population.`;
    const chartData = { "Senior Citizens (60+)": sCount, "Iba Pang Residente": Math.max(0, stats.currentResidents - sCount) };
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  if (wantsPwd && !wantsSenior && !wantsSoloParent && !wants4Ps) {
    const pCount = stats.pwdResidents || 0;
    const text = language === "tagalog"
      ? `♿ **Persons with Disability (PWD) sa Barangay Upper Mingading:**\n\nKasalukuyang may **${pCount.toLocaleString()} rehistradong Persons with Disability (PWD)** sa talaan ng ating barangay na binibigyang-priyoridad para sa mga serbisyong panlipunan at tulong-medikal.`
      : `♿ **Persons with Disability (PWD) in Barangay Upper Mingading:**\n\nThere are currently **${pCount.toLocaleString()} registered Persons with Disability (PWD)** in our official barangay records.`;
    const chartData = { "PWD Residents": pCount, "General Population": Math.max(0, stats.currentResidents - pCount) };
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  if (wantsSoloParent) {
    const spCount = stats.soloParentResidents || 0;
    const text = language === "tagalog"
      ? `👨‍👧👩‍👧 **Solo Parents sa Barangay Upper Mingading:**\n\nMayroong **${spCount.toLocaleString()} rehistradong Solo Parents** sa talaan ng ating barangay na kwalipikado sa mga tulong at programa alinsunod sa Solo Parents Welfare Act (RA 11861).`
      : `👨‍👧👩‍👧 **Solo Parents in Barangay Upper Mingading:**\n\nThere are **${spCount.toLocaleString()} registered Solo Parents** in our barangay database under the Solo Parents Welfare Act.`;
    const chartData = { "Solo Parents": spCount, "General Population": Math.max(0, stats.currentResidents - spCount) };
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  if (wants4Ps) {
    const fpCount = stats.fourPsResidents || 0;
    const text = language === "tagalog"
      ? `🌾 **Pantawid Pamilyang Pilipino Program (4Ps) sa Barangay Upper Mingading:**\n\nMayroong **${fpCount.toLocaleString()} rehistradong 4Ps Beneficiaries/Members** sa ating barangay na tumatanggap ng suporta sa kalusugan at edukasyon.`
      : `🌾 **Pantawid Pamilyang Pilipino Program (4Ps) in Barangay Upper Mingading:**\n\nThere are **${fpCount.toLocaleString()} registered 4Ps beneficiaries/members** in our barangay receiving national government support.`;
    const chartData = { "4Ps Beneficiaries": fpCount, "General Population": Math.max(0, stats.currentResidents - fpCount) };
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  if (wantsBothGender || (wantsMale && wantsFemale)) {
    const m = stats.maleResidents || 0;
    const f = stats.femaleResidents || 0;
    const mPct = stats.currentResidents ? ((m / stats.currentResidents) * 100).toFixed(1) : 0;
    const fPct = stats.currentResidents ? ((f / stats.currentResidents) * 100).toFixed(1) : 0;

    const text = language === "tagalog"
      ? [
          `👥 **Distribusyon ng Kasarian (Gender Breakdown) sa Barangay Upper Mingading:**`,
          "",
          `• 👨 **Kalalakihan (Male):** **${m.toLocaleString()}** (${mPct}%)`,
          `• 👩 **Kababaihan (Female):** **${f.toLocaleString()}** (${fPct}%)`,
          `• **Kabuuan:** **${stats.currentResidents.toLocaleString()}** residente`
        ].join("\n")
      : [
          `👥 **Gender Breakdown in Barangay Upper Mingading:**`,
          "",
          `• 👨 **Male:** **${m.toLocaleString()}** (${mPct}%)`,
          `• 👩 **Female:** **${f.toLocaleString()}** (${fPct}%)`,
          `• **Total:** **${stats.currentResidents.toLocaleString()}** residents`
        ].join("\n");

    const chartData = { "Male": m, "Female": f };
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  if (wantsHousehold) {
    const h = stats.totalHouseholds || 0;
    const avgPerH = h > 0 ? (stats.currentResidents / h).toFixed(1) : 0;
    const text = language === "tagalog"
      ? `🏠 **Bilang ng Kabahayan (Households) sa Barangay Upper Mingading:**\n\nKasalukuyang may **${h.toLocaleString()} rehistradong pamilya/kabahayan (households)** sa ating barangay, na may average na humigit-kumulang **${avgPerH} miyembro kada kabahayan**.`
      : `🏠 **Total Households in Barangay Upper Mingading:**\n\nThere are currently **${h.toLocaleString()} registered households/families** in our barangay, with an average of **${avgPerH} members per household**.`;
    const chartData = stats.purokHouseholdCounts || {};
    return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
  }

  // CASE 4: Overall Total / Executive Summary (Default for "Ilan ang total residents?")
  const total = stats.currentResidents || 0;
  const m = stats.maleResidents || 0;
  const f = stats.femaleResidents || 0;
  const seniors = stats.seniorCitizens || 0;
  const pwd = stats.pwdResidents || 0;
  const solo = stats.soloParentResidents || 0;
  const fourPs = stats.fourPsResidents || 0;
  const h = stats.totalHouseholds || 0;

  const text = language === "tagalog"
    ? [
        `📊 **Opisyal na Kabuuang Estadistika ng Barangay Upper Mingading:**`,
        "",
        `• 👥 **Kabuuang Populasyon:** **${total.toLocaleString()} rehistradong residente**`,
        `• 🏠 **Kabuuang Kabahayan:** **${h.toLocaleString()} kabahayan (households)**`,
        "",
        `📋 **Pangunahing Demographic Breakdown:**`,
        `• 👨 **Kalalakihan (Male):** ${m.toLocaleString()}`,
        `• 👩 **Kababaihan (Female):** ${f.toLocaleString()}`,
        `• 🧓 **Senior Citizens (60+):** ${seniors.toLocaleString()}`,
        `• ♿ **PWD Residents:** ${pwd.toLocaleString()}`,
        `• 👨‍👧 **Solo Parents:** ${solo.toLocaleString()}`,
        `• 🌾 **4Ps Beneficiaries:** ${fourPs.toLocaleString()}`,
        "",
        `*Maaari ninyo ring itanong ang: 'Ilan ang residente kada purok?' para sa kumpletong distribusyon.*`
      ].join("\n")
    : [
        `📊 **Official Resident Statistics of Barangay Upper Mingading:**`,
        "",
        `• 👥 **Total Population:** **${total.toLocaleString()} registered residents**`,
        `• 🏠 **Total Households:** **${h.toLocaleString()} households**`,
        "",
        `📋 **Demographic Highlights:**`,
        `• 👨 **Male:** ${m.toLocaleString()}`,
        `• 👩 **Female:** ${f.toLocaleString()}`,
        `• 🧓 **Senior Citizens (60+):** ${seniors.toLocaleString()}`,
        `• ♿ **PWD Residents:** ${pwd.toLocaleString()}`,
        `• 👨‍👧 **Solo Parents:** ${solo.toLocaleString()}`,
        `• 🌾 **4Ps Beneficiaries:** ${fourPs.toLocaleString()}`,
        "",
        `*You can also ask: 'How many residents per purok?' to see the distribution across all zones.*`
      ].join("\n");

  const chartData = {
    "Male": m,
    "Female": f,
    "Seniors": seniors,
    "PWD": pwd,
    "Solo Parent": solo,
    "4Ps": fourPs
  };

  return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
};

const isDocumentHowToQuestion = (question) => {
  const norm = normalizeText(question);
  if (
    includesAny(norm, [
      "my request",
      "my requests",
      "my new request",
      "my latest request",
      "request ko",
      "mga request ko",
      "bago kong request",
      "bago ko request",
      "what is my new request",
      "what is my request",
      "ano ang request ko",
    ])
  ) {
    return false;
  }
  return includesAny(norm, [
    "how to",
    "how do i",
    "how can i",
    "apply",
    "paano",
    "paanu",
    "panu",
    "paano kumuha",
    "paano mag-request",
    "paano mag request",
    "kuhanin",
    "kumuha",
    "kuha",
    "mag request",
    "magrequest",
    "magrerequest",
    "steps to",
    "procedure",
  ]);
};

const isDocumentStatusQuestion = (question) => {
  const norm = normalizeText(question);
  return (
    includesAny(norm, [
      "status",
      "track",
      "pending",
      "processing",
      "approved",
      "completed",
      "released",
      "rejected",
      "ready",
      "pickup",
      "nasaan",
      "saan na",
      "my request",
      "my requests",
      "my new request",
      "my latest request",
      "request ko",
      "mga request ko",
      "bago kong request",
      "bago ko request",
      "what is my request",
      "what is my new request",
      "what are my requests",
      "ano ang request ko",
      "anong request ko",
      "ano request ko",
    ]) ||
    (includesAny(norm, ["my", "akin", "ko"]) &&
      includesAny(norm, ["request", "requests", "dokumento", "document", "clearance", "certificate", "permit"]))
  );
};

const isDocumentRequestCountQuestion = (question) => {
  const normalized = normalizeText(question);

  return (
    isCountQuestion(normalized) &&
    includesAny(normalized, [
      "document request",
      "document requests",
      "request",
      "requests",
      "requested",
      "my document",
      "my documents",
      "aking dokumento",
      "dokumento ko",
    ])
  );
};

const isDocumentDetailQuestion = (question) =>
  includesAny(question, [
    "requirements",
    "requirement",
    "fee",
    "fees",
    "processing",
    "kailangan",
    "magkano",
    "bayad",
    "singil",
    "requirements",
  ]);

const buildGenericDocumentHowToAnswer = (templates, language = "english") => {
  const lines =
    language === "tagalog"
      ? [
          "Para kumuha o mag-request ng barangay certificate:",
          "1. Buksan ang Document Requests sa resident dashboard.",
          "2. Piliin ang certificate/document type na kailangan mo.",
          "3. Ihanda ang requirements.",
          "4. I-click ang Request.",
          "",
          "Tandaan: Kailangan mong magpakita ng valid I.D. at Cedula bago makuha ang kahit anong dokumento o certificate. Paki sigurado na mayroon kang Cedula.",
        ]
      : [
          "To request a barangay certificate:",
          "1. Open Document Requests in your resident dashboard.",
          "2. Choose the certificate/document type you need.",
          "3. Prepare the requirements.",
          "4. Click Request.",
          "",
          "Note: You will need to present a valid I.D. and Cedula before claiming any documents or certificates. Please ensure you have a Cedula.",
        ];

  return lines.join("\n");
};

const extractGeminiText = (result) => {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  if (typeof result.text === "string") return result.text.trim();

  const parts = result.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
};

const normalizeExtractedPerson = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(and|at)\s+/i, "")
    .replace(/^[\s:;,.()-]+|[\s:;,.()-]+$/g, "")
    .trim();

const splitRolePeople = (value) => {
  const clean = normalizeExtractedPerson(value);
  if (!clean) return [];

  if (/\d+\s*[).]/.test(clean)) {
    return clean
      .split(/\s*\d+\s*[).]\s*/)
      .map(normalizeExtractedPerson)
      .filter(Boolean);
  }

  return clean
    .split(/\s*(?:,|;|\band\b|\bat\b)\s*/i)
    .map(normalizeExtractedPerson)
    .filter(Boolean);
};

const extractRolePeopleFromKnowledge = (role, knowledgeItems = []) => {
  const aliases = ORGANIZATION_ROLE_ALIASES[role] || [];
  if (!aliases.length) return [];

  const labelPattern = aliases.map(escapeRegExp).join("|");
  const boundaryPattern = ROLE_BOUNDARY_LABELS.map(escapeRegExp).join("|");
  const rolePattern = new RegExp(
    `(?:${labelPattern})\\s*[:\\-]\\s*([\\s\\S]*?)(?=(?:\\s|\\n)+(?:${boundaryPattern})\\s*[:\\-]|$)`,
    "i"
  );

  for (const item of knowledgeItems) {
    const sourceText = [item.title, item.content].filter(Boolean).join("\n");
    const match = sourceText.match(rolePattern);
    if (match?.[1]) {
      return splitRolePeople(match[1]);
    }
  }

  return [];
};

const getRequestedOfficialIndex = (question) => {
  const normalized = normalizeText(question);
  if (includesAny(normalized, ["1st", "first", "unang", "una"])) return 0;
  if (includesAny(normalized, ["2nd", "second", "ikalawa", "pangalawa"])) return 1;
  if (includesAny(normalized, ["3rd", "third", "ikatlo", "pangatlo"])) return 2;
  if (includesAny(normalized, ["4th", "fourth", "ikaapat", "pang apat", "pangapat"])) return 3;
  if (includesAny(normalized, ["5th", "fifth", "ikalima", "pang lima", "panglima"])) return 4;
  if (includesAny(normalized, ["6th", "sixth", "ikaanim", "pang anim", "panganim"])) return 5;
  if (includesAny(normalized, ["7th", "seventh", "ikapito", "pang pito", "pangpito"])) return 6;
  return null;
};

const isCountQuestion = (question) =>
  includesAny(normalizeText(question), ["how many", "ilan", "count", "number of", "total"]);

const formatPeopleList = (people) =>
  people.map((person, index) => `${index + 1}. ${person}`).join("\n");

const formatOrdinal = (index) => {
  const value = index + 1;
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
};

const getOfficialRole = (official = {}) => {
  const level = normalizeText(official.level);
  const position = normalizeText(official.position);
  const id = normalizeText(official.id);

  if (level === "captain" || includesAny(position, ["punong barangay", "captain", "kapitan"])) return "captain";
  if (level === "sk" || includesAny(`${position} ${id}`, ["sk chairman", "sk chairperson", "sangguniang kabataan"])) return "skChairperson";
  if (level === "kagawad" || includesAny(position, ["kagawad", "councilor"])) return "kagawad";
  if (includesAny(`${position} ${id}`, ["secretary"])) return "secretary";
  if (includesAny(`${position} ${id}`, ["treasurer"])) return "treasurer";

  return level || "official";
};

const getActiveOrganizationOfficials = (officials = []) =>
  (Array.isArray(officials) ? officials : [])
    .filter((official) => official?.name)
    .filter((official) => {
      const status = normalizeText(official.status || "active");
      return !["inactive", "archived", "former official"].includes(status);
    });

const getOrganizationOfficialsForRole = (officials, role) =>
  getActiveOrganizationOfficials(officials).filter((official) => getOfficialRole(official) === role);

const formatOfficialName = (official) =>
  [official?.name, official?.position].filter(Boolean).join(" - ");

const formatOfficialSummaryLine = (official) => {
  const summary = formatOfficialName(official);
  const details = [official?.committee, official?.focusArea].filter(Boolean).join(", ");
  return details ? `${summary}. ${details}.` : summary;
};

const formatOfficialDetail = (official, language = "english") => {
  const photo = official.photoUrl || "/barangay/officials/captain.jpg";
  const lines = [
    `![${official.name}](${photo})`,
    `🏛️ **${official.name}**`,
    `• **${language === "tagalog" ? "Posisyon" : "Position"}:** ${official.position || "Official"}`,
  ];

  if (official.committee) lines.push(`• **Committee:** ${official.committee}`);
  if (official.focusArea) lines.push(`• **${language === "tagalog" ? "Tungkulin" : "Focus area"}:** ${official.focusArea}`);
  if (official.background) lines.push(`• **Background:** ${official.background}`);
  if (official.contact) lines.push(`• **Contact:** ${official.contact}`);
  if (official.email) lines.push(`• **Email:** ${official.email}`);

  return lines.join("\n");
};

const formatOrganizationContext = (officials = []) =>
  getActiveOrganizationOfficials(officials)
    .map((official) => `${official.name} (${official.position || ORGANIZATION_ROLE_LABELS[getOfficialRole(official)] || "Official"})`)
    .join("; ");

const hasOrganizationChartIntent = (question) => {
  const normalized = normalizeText(question);

  return (
    Boolean(getRequestedKnowledgeRole(question)) ||
    includesAny(normalized, [
      "barangay council",
      "council member",
      "council members",
      "leader",
      "leaders",
      "official",
      "officials",
      "organization",
      "organizational",
      "organizational chart",
      "opisyal",
      "mga opisyal",
    ])
  );
};

const buildOrganizationAnswer = (question, officials = [], language = "english") => {
  if (!hasOrganizationChartIntent(question)) return "";

  const activeOfficials = getActiveOrganizationOfficials(officials);
  if (!activeOfficials.length) return "";

  const normalized = normalizeText(question);
  const role = getRequestedKnowledgeRole(question);
  const wantsCount = isCountQuestion(question);
  const requestedIndex = getRequestedOfficialIndex(question);
  const wantsDetails = includesAny(normalized, [
    "background",
    "bio",
    "committee",
    "contact",
    "details",
    "email",
    "focus",
    "image",
    "info",
    "information",
    "phone",
    "photo",
    "picture",
    "profile",
    "larawan",
  ]);

  if (role) {
    const matchingOfficials = getOrganizationOfficialsForRole(activeOfficials, role);
    if (!matchingOfficials.length) return "";

    const label = ORGANIZATION_ROLE_LABELS[role] || "Barangay official";
    const selectedOfficial =
      requestedIndex !== null ? matchingOfficials[requestedIndex] : matchingOfficials[0];

    if (requestedIndex !== null) {
      if (!selectedOfficial) {
        return language === "tagalog"
          ? `Walang ${formatOrdinal(requestedIndex)} ${label} na naka-save para sa Barangay Upper Mingading.`
          : `There is no saved ${formatOrdinal(requestedIndex)} ${label} for Barangay Upper Mingading.`;
      }

      return formatOfficialDetail(selectedOfficial, language);
    }

    if (wantsCount) {
      return language === "tagalog"
        ? `May ${matchingOfficials.length} ${label} sa Barangay Upper Mingading:\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`
        : `There ${matchingOfficials.length === 1 ? "is" : "are"} ${matchingOfficials.length} Barangay Upper Mingading ${label}${matchingOfficials.length === 1 ? "" : "s"}:\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`;
    }

    if (matchingOfficials.length === 1) {
      return formatOfficialDetail(matchingOfficials[0], language);
    }

    return (
      (matchingOfficials[0]?.photoUrl ? `![${matchingOfficials[0].name}](${matchingOfficials[0].photoUrl})\n` : "") +
      (language === "tagalog"
        ? `🏛️ **Mga ${label} ng Barangay Upper Mingading:**\n\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`
        : `🏛️ **Barangay Upper Mingading ${label} Members:**\n\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`)
    );
  }

  if (wantsCount) {
    return language === "tagalog"
      ? `May ${activeOfficials.length} aktibong opisyal sa Barangay Upper Mingading.`
      : `There are ${activeOfficials.length} active official profile(s) in Barangay Upper Mingading.`;
  }

  const captain = activeOfficials.find((official) => getOfficialRole(official) === "captain");
  const secretary = activeOfficials.find((official) => getOfficialRole(official) === "secretary");
  const treasurer = activeOfficials.find((official) => getOfficialRole(official) === "treasurer");
  const skChairperson = activeOfficials.find((official) => getOfficialRole(official) === "skChairperson");
  const kagawads = getOrganizationOfficialsForRole(activeOfficials, "kagawad");
  const lines = [
    captain?.photoUrl ? `![${captain.name}](${captain.photoUrl})` : "",
    language === "tagalog"
      ? "🏛️ **Mga Kasalukuyang Opisyal ng Sangguniang Barangay (Barangay Upper Mingading):**"
      : "🏛️ **Current Barangay Council & Officials (Barangay Upper Mingading):**",
    "",
  ].filter(Boolean);

  if (captain) {
    lines.push(`• **Punong Barangay (Captain):** **${captain.name}**${captain.committee ? ` (${captain.committee})` : ""}`);
  }
  if (kagawads.length) {
    lines.push(`• **Mga Barangay Kagawad:**\n${kagawads.map((k, i) => `  ${i + 1}. **${k.name}**${k.committee ? ` — *${k.committee}*` : ""}`).join("\n")}`);
  }
  if (skChairperson) {
    lines.push(`• **SK Chairperson:** **${skChairperson.name}**${skChairperson.committee ? ` (${skChairperson.committee})` : ""}`);
  }
  if (secretary) {
    lines.push(`• **Barangay Secretary:** **${secretary.name}**`);
  }
  if (treasurer) {
    lines.push(`• **Barangay Treasurer:** **${treasurer.name}**`);
  }

  lines.push("");
  lines.push(
    language === "tagalog"
      ? '*Maaari rin ninyong itanong ang pangalan ng partikular na opisyal tulad ng: "Sino si Kagawad Wilson Caponpon?" para sa kumpletong detalye at larawan.*'
      : '*You can also ask about a specific official like: "Who is Kagawad Wilson Caponpon?" to view their full profile and photo.*'
  );

  return lines.join("\n");
};

const buildRoleKnowledgeAnswer = (question, relevantKnowledge, language) => {
  const role = getRequestedKnowledgeRole(question);
  if (!role) return "";

  const people = extractRolePeopleFromKnowledge(role, relevantKnowledge);
  if (!people.length) return "";

  const label = ORGANIZATION_ROLE_LABELS[role] || "Barangay official";
  const wantsCount = isCountQuestion(question);
  const requestedIndex = getRequestedOfficialIndex(question);

  if (requestedIndex !== null && people[requestedIndex]) {
    const ordinal = formatOrdinal(requestedIndex);
    return language === "tagalog"
      ? `Ang ${ordinal} ${label} na naka-save ay ${people[requestedIndex]}.`
      : `The saved ${ordinal} ${label} is ${people[requestedIndex]}.`;
  }

  if (wantsCount) {
    return language === "tagalog"
      ? `May ${people.length} ${label} na naka-save sa barangay knowledge:\n${formatPeopleList(people)}`
      : `There ${people.length === 1 ? "is" : "are"} ${people.length} ${label}${people.length === 1 ? "" : "s"} saved in barangay knowledge:\n${formatPeopleList(people)}`;
  }

  if (people.length === 1) {
    return language === "tagalog"
      ? `Ang ${label} ay ${people[0]}.`
      : `The ${label} is ${people[0]}.`;
  }

  return language === "tagalog"
    ? `Ang mga ${label} na naka-save ay:\n${formatPeopleList(people)}`
    : `The saved ${label} members are:\n${formatPeopleList(people)}`;
};

const QA_STOP_WORDS = new Set([
  "who", "what", "where", "when", "why", "how", "is", "are", "was", "were", "the", "a", "an", "and", "or",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "my", "your", "can", "i", "you", "he", "she",
  "it", "they", "we", "this", "that", "these", "those", "base", "based", "according",
  "sino", "ano", "saan", "kailan", "bakit", "paano", "ang", "ng", "sa", "mga", "ay", "na",
  "may", "meron", "ba", "po", "opo", "ko", "mo", "natin", "inyo", "namin", "basta", "do", "does", "did"
]);

const cleanAnswerText = (aText) =>
  String(aText || "")
    .replace(/\n\s*---\s*[\s\S]*$/g, "")
    .replace(/\n\s*#{1,4}\s+[^\n]+$/g, "")
    .replace(/\n\s*This keeps all[\s\S]*$/i, "")
    .replace(/^[:\-\s]+/, "")
    .trim();

export const parseAllKnowledgeBlocks = (content) => {
  const blocks = [];
  if (!content) return blocks;

  // Normalize markdown bold/italic decorators around Q and A labels
  const clean = content
    .replace(/\*\*(Q|Question|Tanong|A|Answer|Sagot)\s*[:\.]?\*\*/gi, "$1:")
    .replace(/\*(Q|Question|Tanong|A|Answer|Sagot)\s*[:\.]?\*/gi, "$1:");

  // Pattern 1: Any Q: ... A: ... block, with optional numbers or ### before Q
  const qaPattern = /(?:^|\n)\s*(?:(?:###?\s*)?\d*[\.\)]?\s*)?(?:(?:Q\d*|Question|Tanong)\s*[:\.\-]\s*)([^\n]+)\n\s*(?:(?:\d+[\.\)]\s*)?(?:A\d*|Answer|Sagot)\s*[:\.\-]\s*)([^\n]+(?:\n(?!\s*(?:(?:###?\s*)?\d*[\.\)]?\s*)?(?:Q\d*|Question|Tanong)\s*[:\.\-]).*)*)/gi;

  let m;
  while ((m = qaPattern.exec(clean)) !== null) {
    const qText = m[1].trim().replace(/^\*+|\*+$/g, "").replace(/^[:\-\s]+/, "").trim();
    const aText = cleanAnswerText(m[2]);
    if (qText && aText) {
      blocks.push({ type: "qa", q: qText, a: aText });
    }
  }

  // Pattern 2: Markdown Headings (e.g. ### Curfew Ordinance\n... or ### Location\n...)
  const headingRegex = /^(#{1,4})\s+(.+)$/;
  const rawLines = content.split("\n");
  let currentTitle = "";
  let currentBody = [];

  for (const line of rawLines) {
    const hMatch = line.match(headingRegex);
    if (hMatch) {
      if (currentTitle && currentBody.length) {
        const bodyStr = cleanAnswerText(currentBody.join("\n"));
        if (bodyStr) {
          blocks.push({ type: "heading", q: currentTitle, a: bodyStr });
        }
      }
      currentTitle = hMatch[2].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentTitle && currentBody.length) {
    const bodyStr = cleanAnswerText(currentBody.join("\n"));
    if (bodyStr) {
      blocks.push({ type: "heading", q: currentTitle, a: bodyStr });
    }
  }

  return blocks;
};

export const findSmartAnswerInKnowledge = (question, relevantKnowledge = [], language = "tagalog") => {
  if (!relevantKnowledge || !relevantKnowledge.length) return "";

  const normQ = normalizeText(question);
  const qWords = normQ.split(" ").filter((w) => w.length >= 2);
  const meaningfulQWords = qWords.filter((w) => !QA_STOP_WORDS.has(w));

  let globalBestAnswer = "";
  let globalHighestScore = 0;

  for (const item of relevantKnowledge) {
    const content = item.content || "";
    if (!content) continue;

    const blocks = parseAllKnowledgeBlocks(content);

    for (const b of blocks) {
      const normBlockQ = normalizeText(b.q);
      const blockMeaningfulWords = normBlockQ.split(" ").filter((w) => w.length >= 2 && !QA_STOP_WORDS.has(w));
      const matchingWords = meaningfulQWords.filter((w) => blockMeaningfulWords.includes(w));

      let score = 0;
      if (normQ === normBlockQ) {
        score += 150; // Exact question match
      } else if (normQ.includes(normBlockQ) || normBlockQ.includes(normQ)) {
        score += 80;
      }

      // Word matching score
      score += matchingWords.length * 25;

      // Overlap ratio boost
      if (blockMeaningfulWords.length > 0) {
        const ratio = matchingWords.length / blockMeaningfulWords.length;
        if (ratio >= 0.6) score += 35;
      }

      if (score > globalHighestScore && matchingWords.length >= 1) {
        globalHighestScore = score;
        globalBestAnswer = b.a;
      }
    }

    // Fallback: If no structured QA block matched, check entire single short content
    if (blocks.length === 0 && content.length < 800) {
      const normTitle = normalizeText(item.title);
      const titleWords = normTitle.split(" ").filter((w) => w.length >= 2 && !QA_STOP_WORDS.has(w));
      const matchingTW = meaningfulQWords.filter((w) => titleWords.includes(w));
      let tScore = 0;
      if (normQ.includes(normTitle) || normTitle.includes(normQ)) tScore += 60;
      tScore += matchingTW.length * 30;

      if (tScore > globalHighestScore && matchingTW.length >= 1) {
        globalHighestScore = tScore;
        globalBestAnswer = cleanAnswerText(content);
      }
    }
  }

  if (globalBestAnswer && globalHighestScore >= 25) {
    return globalBestAnswer;
  }

  return "";
};

const buildKnowledgeSummaryAnswer = (relevantKnowledge, language, question = "") => {
  if (!relevantKnowledge || !relevantKnowledge.length) return "";
  const smartAnswer = findSmartAnswerInKnowledge(question, relevantKnowledge, language);
  if (
    smartAnswer &&
    !smartAnswer.includes("Question:Who approves") &&
    !smartAnswer.includes("Q2") &&
    !smartAnswer.includes("Audience: Selected Residents:")
  ) {
    return smartAnswer;
  }

  const top = relevantKnowledge[0];
  if (top && top.content) {
    const isMultiQA = /(?:Q\d+|Question|\bQ\b)\s*[:\.]?/i.test(top.content) && /Answer\s*[:\.]?/i.test(top.content);
    if (!isMultiQA) {
      return cleanAnswerText(top.content);
    }
  }

  return language === "tagalog"
    ? "Maaari po ninyong linawin ang inyong katanungan upang mabigyan ko kayo ng eksaktong impormasyon ukol sa mga serbisyo ng Barangay Upper Mingading."
    : "Could you please clarify your question so I can provide the exact information regarding Barangay Upper Mingading services?";
};

const buildMissingKnowledgeAnswer = (question, language) => {
  return buildOutOfScopeLimitationAnswer(language);
};

const answerFromKnowledge = async (question, relevantKnowledge, context, language) => {
  const roleAnswer = buildRoleKnowledgeAnswer(question, relevantKnowledge, language);
  if (roleAnswer) return roleAnswer;

  const fallback = buildKnowledgeSummaryAnswer(relevantKnowledge, language, question);

  try {
    const prompt = `Internal Knowledge Memory:
${relevantKnowledge.map(formatKnowledgeContextItem).join("\n\n")}

Resident dashboard context:
- Resident name: ${context?.resident?.full_name || "Resident"}
- Current residents: ${context?.residentStats?.currentResidents ?? "Not loaded"}
- Senior citizens: ${context?.residentStats?.seniorCitizens ?? "Not loaded"}
- PWD/PWED residents: ${context?.residentStats?.pwdResidents ?? "Not loaded"}
- Male residents: ${context?.residentStats?.maleResidents ?? "Not loaded"}
- Female residents: ${context?.residentStats?.femaleResidents ?? "Not loaded"}
- Document requests: ${context?.requests?.length || 0}
- Published announcements: ${context?.announcements?.length || 0}
- Open livelihood/jobs: ${context?.opportunities?.length || 0}
- Available document types: ${context?.documentTemplates?.length || 0}
- Organizational chart officials: ${formatOrganizationContext(context?.organizationOfficials) || "Not loaded"}

Resident question:
${question}

Answer directly, naturally, comprehensively, and warmly like a PRO using your internal knowledge. If the user asked multiple questions, answer every single part thoroughly:`;

    const result = await generateText(prompt, {
      systemInstruction:
        "You are KaagapAI, the natural Filipino-English conversational voice assistant for Barangay Upper Mingading. You know every feature, button, function, and service inside the KaagapAI Resident Portal: 1) Document Requests (Barangay Clearance, Residency, Indigency-Free, Business Permit, Barangay ID with Valid ID & Cedula requirements, ₱50 fee), 2) Livelihoods & Jobs (applying for agriculture aid, TESDA skills trainings, job openings), 3) Announcements (community news, emergency alerts, medical mission, relief ops), 4) Document Logs & Tracking (Pending, Processing, Approved/Ready for Pickup, Released), 5) Barangay Officials Directory (Hon. Mamerto C. Clarito, SK Chairman Chrystophyr B. Trasmonte, Sec Jovelyn Cabaya, Treas Rosalie Calamba, 7 Kagawad), 6) My Profile (update phone, email, photo, change password), 7) Chatbot Features (Listen Voice audio, + New Chat, Recent chats menu, non-blocking side-by-side desktop view). Speak warmly, friendly, confident, and approachable like a real Filipino conversational speaker. Keep responses concise and natural for voice conversation. When a resident asks how to do something, provide clear, numbered steps starting directly with step 1: Click 'Request Document' on your dashboard (do not tell them to log in). Automatically match the user's language: respond in English for English questions, natural polite Tagalog with 'po/opo' for Tagalog questions, and smooth Taglish if the user mixes languages.",
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    return stripSuggestedQuestions(extractGeminiText(result) || fallback);
  } catch (error) {
    console.warn("AI knowledge answer unavailable, using smart local knowledge extractor:", error.message);
    return fallback;
  }
};

const buildLivelihoodAnswer = (opportunities = [], language = "tagalog") => {
  if (opportunities.length > 0) {
    const header =
      language === "tagalog"
        ? `💼 **Mayroong ${opportunities.length} bukas na programa sa kabuhayan at trabaho (Livelihoods & Jobs):**`
        : `💼 **There are ${opportunities.length} open livelihood & job program(s):**`;
    const list = opportunities.slice(0, 8).map((post, index) => formatOpportunity(post, index, language)).join("\n\n");
    const guide =
      language === "tagalog"
        ? "\n\n*Paano Mag-apply:* Pumunta sa **\"Livelihoods & Jobs\"** sa sidebar menu, piliin ang nais na programa, at i-click ang **\"Apply Now\"**."
        : "\n\n*How to Apply:* Go to **\"Livelihoods & Jobs\"** in the sidebar menu, select your preferred program, and click **\"Apply Now\"**.";
    return `${header}\n\n${list}${guide}`;
  }
  return language === "tagalog"
    ? "Sa kasalukuyan, wala pong bukas na programang pangkabuhayan o bakanteng trabaho sa barangay. Mangyaring subaybayan ang mga anunsyo sa ating portal."
    : "There are currently no available livelihood or job opportunity programs in the barangay. Please check back regularly for updates.";
};

const buildAnnouncementsAnswer = (announcements = [], language = "tagalog") => {
  const cleanAnnouncements = announcements.filter(
    (a) => !a.category?.toLowerCase().includes("livelihood") && !a.title?.toLowerCase().includes("livelihood")
  );
  const listToDisplay = cleanAnnouncements.length > 0 ? cleanAnnouncements : announcements;
  if (listToDisplay.length > 0) {
    const header =
      language === "tagalog"
        ? `📢 **Mayroong ${listToDisplay.length} inilathalang opisyal na anunsyo sa barangay:**`
        : `📢 **There are ${listToDisplay.length} published official barangay announcement(s):**`;
    const list = listToDisplay.slice(0, 8).map((announcement, index) => formatAnnouncement(announcement, index, language)).join("\n\n");
    return `${header}\n\n${list}`;
  }
  return language === "tagalog"
    ? "Wala pong bagong opisyal na anunsyo sa kasalukuyan. Lahat ng bagong balita ay agad na ilalathala rito sa portal."
    : "There are currently no published announcements available. Official updates will be posted here on the portal.";
};

const isDocumentFeesGeneralQuestion = (question) => {
  const norm = normalizeText(question);
  return (
    includesAny(norm, ["magkano", "bayad", "fees", "fee", "singil", "presyo", "halaga", "cost", "price"]) &&
    (
      includesAny(norm, ["dokumento", "mga dokumento", "document", "documents", "lahat ng dokumento", "bawat dokumento", "per request"]) ||
      norm.includes("magkano ang bayad sa mga dokumento") ||
      norm === "magkano ang bayad" ||
      norm === "magkano bayad" ||
      norm === "how much are the document fees" ||
      norm === "document fees"
    ) &&
    !includesAny(norm, ["clearance", "residency", "indigency", "barangay id", "business permit", "cedula", "ctc"])
  );
};

const buildDocumentFeesAnswer = (language = "tagalog") => {
  if (language === "tagalog") {
    return [
      "💵 **Opisyal na Listahan ng Bayarin sa mga Dokumento (Barangay Upper Mingading):**",
      "",
      "• **Barangay Clearance:** ₱50.00 cash per request",
      "• **Certificate of Residency:** ₱50.00 cash per request",
      "• **Barangay ID:** ₱50.00 cash per request",
      "• **Business Clearance / Permit:** ₱50.00 cash per request",
      "• **Certificate of Indigency:** **Libre / Walang Bayad** (para sa mga kwalipikadong residente)",
      "• **Cedula (Community Tax Certificate):** Kinukwenta batay sa taunang kita (sa opisina ng Barangay Treasurer)",
      "",
      "📌 **Paalala sa Pagbabayad:**",
      "Ang bayarin ay direktang ibinabayad sa **Barangay Treasurer** sa **Barangay Hall** kapag kukunin na ang opisyal na dokumento."
    ].join("\n");
  }

  return [
    "💵 **Official Schedule of Document Fees (Barangay Upper Mingading):**",
    "",
    "• **Barangay Clearance:** ₱50.00 cash per request",
    "• **Certificate of Residency:** ₱50.00 cash per request",
    "• **Barangay ID:** ₱50.00 cash per request",
    "• **Business Clearance / Permit:** ₱50.00 cash per request",
    "• **Certificate of Indigency:** **Free of Charge** (for qualified indigent residents)",
    "• **Cedula (Community Tax Certificate):** Assessed based on annual income by the Barangay Treasurer",
    "",
    "📌 **Payment Note:**",
    "Fees are paid in cash directly to the **Barangay Treasurer** at the **Barangay Hall** upon claiming your signed document."
  ].join("\n");
};

const buildComprehensiveDocumentAnswer = (question, documentFocus, context = {}, language = "tagalog") => {
  if (isDocumentFeesGeneralQuestion(question)) {
    return buildDocumentFeesAnswer(language);
  }

  const {
    documentTemplates = [],
    requests = [],
  } = context;

  const uniqueTemplates = dedupeDocumentTemplates(documentTemplates);
  const filteredRequests = documentFocus ? documentFocus.matchingRequests : requests;
  const requestedStatuses = getRequestedStatuses(question);
  const statusFilteredRequests = requestedStatuses.length
    ? filteredRequests.filter((request) => requestedStatuses.includes(request.status))
    : filteredRequests;

  const docLabel = documentFocus ? documentFocus.label : "Barangay Clearance";
  const docLower = docLabel.toLowerCase();
  const isIndigency = docLower.includes("indigency") || docLower.includes("indigent");
  const isResidency = docLower.includes("residency") || docLower.includes("residente");
  const isBarangayID = docLower.includes("id") || docLower.includes("identification");
  const isBusinessPermit = (docLower.includes("business") || docLower.includes("negosyo")) && !docLower.includes("clearance");

  const feeTextTagalog = isIndigency
    ? "Libre / Walang Bayad (Free of Charge para sa mga kwalipikadong indigent residents)"
    : "₱50.00 pesos cash per request (Babayaran sa Barangay Treasurer pagkuha)";

  const feeTextEnglish = isIndigency
    ? "Free of Charge (No Processing Fee for qualified indigent residents)"
    : "₱50.00 pesos cash per request (Payable to the Barangay Treasurer upon release)";

  const reqListTagalog = isBarangayID
    ? [
        "1. **Cedula (Community Tax Certificate)** — makukuha sa opisina ng Barangay Treasurer sa Barangay Hall",
        "2. **Valid ID (Government ID / Voter's ID / Student ID)** — para sa pagpapatunay ng pagkakakilanlan",
        `3. **50 Pesos Cash per request:** ${feeTextTagalog}`,
        "4. **2x2 ID Picture** na may puting background",
      ]
    : isIndigency
    ? [
        "1. **Cedula (Community Tax Certificate)** — o Katibayan ng Paninirahan mula sa Purok Leader",
        "2. **Valid ID (Government ID)** — tulad ng National ID, PhilHealth, Voter's ID, Driver's License, o Student ID",
        `3. **Bayad:** ${feeTextTagalog}`,
      ]
    : isBusinessPermit
    ? [
        "1. **Cedula (Community Tax Certificate)** — ng may-ari ng negosyo",
        "2. **Valid ID (Government ID)** — ng may-ari ng negosyo",
        `3. **50 Pesos Cash per request:** ${feeTextTagalog}`,
        "4. **DTI / SEC Registration** (kung meron) at Katibayan ng Lokasyon ng Negosyo",
      ]
    : [
        "1. **Cedula (Community Tax Certificate)** — makukuha sa opisina ng Barangay Treasurer sa Barangay Hall",
        "2. **Valid ID (Government ID)** — tulad ng National ID, Driver's License, PhilHealth, o Voter's ID",
        `3. **50 Pesos Cash per request:** ${feeTextTagalog}`,
      ];

  const reqListEnglish = isBarangayID
    ? [
        "1. **Cedula (Community Tax Certificate)** — obtainable from the Barangay Treasurer at the Barangay Hall",
        "2. **Valid ID (Government-issued ID / Student ID)** — for identity verification",
        `3. **50 Pesos Cash per request:** ${feeTextEnglish}`,
        "4. **Recent 2x2 ID Picture** with white background",
      ]
    : isIndigency
    ? [
        "1. **Cedula (Community Tax Certificate)** — or Proof of Residency from your Purok Leader",
        "2. **Valid ID (Government-issued ID)** — such as National ID, Voter's ID, Driver's License, or Student ID",
        `3. **Fee:** ${feeTextEnglish}`,
      ]
    : isBusinessPermit
    ? [
        "1. **Cedula (Community Tax Certificate)** — of the business owner",
        "2. **Valid ID (Government-issued ID)** — of the business owner",
        `3. **50 Pesos Cash per request:** ${feeTextEnglish}`,
        "4. **DTI / SEC Business Registration** (if applicable) and Proof of Business Location",
      ]
    : [
        "1. **Cedula (Community Tax Certificate)** — obtainable from the Barangay Treasurer at the Barangay Hall",
        "2. **Valid ID (Government-issued ID)** — e.g., National ID, Driver's License, PhilHealth, or Voter's ID",
        `3. **50 Pesos Cash per request:** ${feeTextEnglish}`,
      ];

  const normQ = normalizeText(question);
  const wantsRequirements = includesAny(normQ, ["requirement", "requirements", "kailangan", "sangkap", "dokumento kailangan", "bayad", "fee", "magkano", "presyo", "cost"]);
  const wantsSteps = includesAny(normQ, ["how to", "paano", "steps", "hakbang", "procedure", "process", "request", "kumuha", "pag-request", "mag-request", "mag request", "get", "securing"]);

  const lines = [];

  // Case 1: BOTH Steps AND Requirements are explicitly asked
  if (wantsSteps && wantsRequirements) {
    if (language === "tagalog") {
      lines.push(`📄 **Kumpletong Gabay para sa ${docLabel}:**`);
      lines.push("");
      lines.push("📋 **Hakbang sa Pag-request (Step-by-Step Procedure):**");
      lines.push("1. I-click ang **\"Request Document\"** button sa inyong dashboard.");
      lines.push(`2. Piliin ang **"${docLabel}"** mula sa listahan ng mga dokumento.`);
      lines.push("3. Ilagay ang layunin o purpose (hal. *Trabaho, Pagkakakilanlan, Scholarship, o Loan*).");
      lines.push("4. I-click ang **\"Submit Request\"**. Makakatanggap kayo ng kumpirmasyon at SMS abiso kapag naaprubahan.");
      lines.push("");
      lines.push("📌 **Mga Pangunahing Requirements & Bayarin:**");
      lines.push(reqListTagalog.join("\n"));
      lines.push("");
      lines.push("⏱️ **Oras ng Pagproseso:** Karaniwang handa at napipirmahan sa loob ng **1 araw ng trabaho**.");
      lines.push("📍 **Pag-claim:** Kunin ang opisyal na dokumento sa **Barangay Hall**. Kung representative ang kukuha, magdala ng Authorization Letter at Valid ID.");
    } else {
      lines.push(`📄 **Complete Guide for Securing a ${docLabel}:**`);
      lines.push("");
      lines.push("📋 **Step-by-Step Request Procedure:**");
      lines.push("1. Click the **\"Request Document\"** button on your dashboard.");
      lines.push(`2. Select **"${docLabel}"** from the available document list.`);
      lines.push("3. Enter your purpose for requesting (e.g., *Employment, Identification, Scholarship, or Loan*).");
      lines.push("4. Click **\"Submit Request\"**. You will receive an SMS and portal notification once approved.");
      lines.push("");
      lines.push("📌 **Requirements & Fee Details:**");
      lines.push(reqListEnglish.join("\n"));
      lines.push("");
      lines.push("⏱️ **Processing Time:** Standard processing takes **1 working day** once verified and signed.");
      lines.push("📍 **Pickup / Claiming:** Claim your official signed document at the **Barangay Hall**. If sending a representative, present an authorization letter and valid ID.");
    }
  }
  // Case 2: ONLY Requirements & Fees are asked
  else if (wantsRequirements) {
    if (language === "tagalog") {
      lines.push(`📌 **Mga Pangunahing Requirements para sa ${docLabel}:**`);
      lines.push("");
      lines.push(reqListTagalog.join("\n"));
      lines.push("");
      lines.push("⏱️ **Oras ng Pagproseso:** **1 araw ng trabaho**.");
      lines.push("📍 **Lugar ng Pagkuha:** **Barangay Hall** (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM).");
    } else {
      lines.push(`📌 **Requirements & Fees for ${docLabel}:**`);
      lines.push("");
      lines.push(reqListEnglish.join("\n"));
      lines.push("");
      lines.push("⏱️ **Processing Time:** **1 working day**.");
      lines.push("📍 **Claiming Location:** **Barangay Hall** (Monday to Friday, 8:00 AM - 5:00 PM).");
    }
  }
  // Case 3: ONLY How to Request / Steps are asked (Default)
  else {
    if (language === "tagalog") {
      lines.push(`📋 **Mga Hakbang sa Pag-request ng ${docLabel}:**`);
      lines.push("");
      lines.push("1. I-click ang **\"Request Document\"** button sa inyong dashboard.");
      lines.push(`2. Piliin ang **"${docLabel}"** mula sa listahan ng mga dokumento.`);
      lines.push("3. Ilagay ang layunin o purpose ng inyong pag-request (hal. *Trabaho, Pagkakakilanlan, Scholarship, o Loan*).");
      lines.push("4. I-click ang **\"Submit Request\"**. Makakatanggap kayo ng SMS at portal notification kapag naaprubahan na ito.");
    } else {
      lines.push(`📋 **Steps to Request a ${docLabel}:**`);
      lines.push("");
      lines.push("1. Click the **\"Request Document\"** button on your dashboard.");
      lines.push(`2. Select **"${docLabel}"** from the available document list.`);
      lines.push("3. Enter your purpose for requesting (e.g., *Employment, Identification, Scholarship, or Loan*).");
      lines.push("4. Click **\"Submit Request\"**. You will receive an SMS and portal notification once approved.");
    }
  }

  // If user specifically asked about their existing request status or requests exist
  if (requestedStatuses.length > 0 || isDocumentStatusQuestion(question)) {
    lines.push("");
    if (statusFilteredRequests.length > 0) {
      lines.push(
        language === "tagalog"
          ? `📊 **Katayuan ng Iyong Request para sa ${docLabel}:**`
          : `📊 **Your ${docLabel} Request Status:**`
      );
      lines.push(
        statusFilteredRequests.slice(0, 4).map((request, index) => formatRequest(request, index, language)).join("\n")
      );
    } else {
      lines.push(
        language === "tagalog"
          ? `📊 **Katayuan ng Request:** Wala pa po kayong aktibong ${docLabel} request. Maaari po kayong magsumite gamit ang mga hakbang sa itaas.`
          : `📊 **Request Status:** You have no active ${docLabel} request yet. You can submit one anytime following the steps above.`
      );
    }
  }

  return lines.join("\n");
};

async function buildLocalAnswer(question, context = {}) {
  const {
    announcements = [],
    documentTemplates = [],
    knowledgeItems = [],
    opportunities = [],
    organizationOfficials = getOrganizationOfficials(),
    requests = [],
    resident,
    residentStats,
  } = context;
  const language = isTagalogQuestion(question) ? "tagalog" : "english";
  const normalizedQ = normalizeText(question);
  const documentFocus = findDocumentFocus(question, documentTemplates, requests);
  const relevantKnowledge = getRelevantKnowledge(question, knowledgeItems);
  const resolvedOfficials = organizationOfficials?.length ? organizationOfficials : getOrganizationOfficials();
  const organizationAnswer = buildOrganizationAnswer(question, resolvedOfficials, language);
  const wantsResidentStats = isResidentStatsQuestion(question);
  const wantsDocuments = Boolean(documentFocus) || (
    includesAny(normalizedQ, [
      "clearance", "indigency", "residency", "barangay id", "business permit", "cedula", "ctc", "4ps"
    ]) ||
    (includesAny(normalizedQ, ["dokumento", "document", "request document", "mag-request", "mag request", "kumuha ng certificate", "kumuha ng permit", "kumuha ng clearance"]) &&
     !includesAny(normalizedQ, ["smoke", "smoking", "curfew", "basura", "ingay", "videoke", "aso", "pusa", "bawal", "policy", "ordinansa"]))
  );
  const wantsLivelihood = includesAny(question, ["job", "jobs", "livelihood", "training", "program", "opportunity", "trabaho", "kabuhayan", "ayuda", "tesda"]);
  const wantsAnnouncements = includesAny(question, ["announcement", "announcements", "news", "update", "event", "events", "activity", "anunsyo", "balita"]);
  const wantsProfile = includesAny(question, ["profile", "address", "purok", "name", "account", "email", "pangalan", "tirahan", "password"]);
  const wantsOfficeInfo = isOfficeInfoQuestion(question);
  const wantsCedula = isCedulaQuestion(question);
  const wantsAnniversary = isAnniversaryQuestion(question);
  const wantsKnowledge = hasKnowledgeIntent(question);

  // 1. Explicit dashboard request
  const isExplicitDashboardRequest = includesAny(normalizedQ, [
    "dashboard",
    "dashboard summary",
    "my dashboard",
    "statistics",
    "system status",
    "system summary",
  ]);
  if (isExplicitDashboardRequest) {
    const lines = [];
    lines.push(
      language === "tagalog"
        ? `Hello ${resident?.full_name || "Resident"}, ito ang current dashboard summary mo:`
        : `Hello ${resident?.full_name || "Resident"}, here is your current dashboard summary:`
    );
    lines.push(`• Document requests: ${requests.length}`);
    lines.push(`• Published announcements: ${announcements.length}`);
    lines.push(`• Livelihood programs: ${opportunities.length}`);
    lines.push(`• Available document types: ${documentTemplates.length}`);
    lines.push(`• AI knowledge items: ${knowledgeItems.length}`);
    return stripSuggestedQuestions(lines.join("\n"));
  }

  // 2. Gratitude / Casual Greetings / Edits / Guides / Conversational Moods
  if (isGratitudeMessage(question)) return buildGratitudeAnswer(question);
  if (isGreetingMessage(question)) return buildGreetingAnswer(question, resident);
  if (isConversationalOrFriendlyQuestion(question)) return buildConversationalAnswer(question, resident, language);
  if (isEditDocumentRequestQuestion(question)) return buildEditDocumentRequestAnswer(language);
  if (isEditProfileQuestion(question)) return buildEditProfileAnswer(language);
  if (isResidentPortalGuideQuestion(question)) return buildResidentPortalGuideAnswer(question, language);

  // 3. Leadership / Officials / Political History Resolver
  const isHistory =
    includesAny(normalizedQ, [
      "political history", "history", "hstory", "kasaysayan", "pinagmulan", "origin", "pulitika", "politika",
      "first captain", "1st captain", "unang kapitan", "unang pinuno", "first leader", "1st leader",
      "2nd captain", "second captain", "pangalawang kapitan", "ikalawang kapitan",
      "3rd captain", "third captain", "pangatlong kapitan", "ikatlong kapitan",
      "4th captain", "fourth captain", "pang-apat na kapitan", "ikaapat na kapitan",
      "5th captain", "fifth captain", "panglimang kapitan", "ikalimang kapitan",
      "6th captain", "sixth captain", "pang-anim na kapitan", "ikaanim na kapitan",
      "7th captain", "seventh captain", "pampitong kapitan", "ikapitong kapitan",
      "8th captain", "eighth captain", "pangwalong kapitan", "ikawalong kapitan",
      "9th captain", "ninth captain", "pangsiyam na kapitan", "ikasiyam na kapitan",
      "10th captain", "tenth captain", "pangsampung kapitan", "ikasampung kapitan",
      "11th captain", "eleventh captain", "panglabing-isang kapitan",
      "dating kapitan", "nakaraang kapitan", "previous captain", "past captain", "past leaders", "timeline",
      "catenas", "bolivar", "cari", "capio", "calician", "caponpon"
    ]);

  const isAskingCurrentCaptain =
    !includesAny(normalizedQ, ["unang", "una", "first", "1st", "history", "hstory", "dating", "nakaraan", "past", "timeline", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "pangalawa", "pangatlo", "pang-apat", "panglima", "pang-anim", "pampito", "pangwalo", "pangsiyam", "pangsampu"]) &&
    ((includesAny(normalizedQ, ["captain", "kapitan", "punong barangay"]) &&
      includesAny(normalizedQ, ["sino", "who", "ngayon", "present", "current", "kasalukuyan", "sino si", "sino ang"])) ||
    includesAny(normalizedQ, [
      "sino ang kapitan",
      "sino kapitan",
      "sino ang punong barangay",
      "sino punong barangay",
      "who is the captain",
      "who is captain",
      "who is the barangay captain",
      "kapitan ngayon",
      "captain ngayon",
    ]));

  if (isAskingCurrentCaptain) {
    return buildCurrentCaptainAnswer(resolvedOfficials, language);
  }
  if (hasOrganizationChartIntent(question)) {
    return buildOrganizationAnswer(question, resolvedOfficials, language);
  }
  if (isHistory) {
    return buildPoliticalHistoryAnswer(question, resolvedOfficials, language);
  }
  if (isResidentStatsQuestion(question) || wantsResidentStats) {
    return buildResidentStatsAnswer(question, residentStats, language);
  }
  const smartKnowledgeAnswer = findSmartAnswerInKnowledge(question, knowledgeItems || [], language);
  if (smartKnowledgeAnswer) {
    return smartKnowledgeAnswer;
  }
  if (wantsDocuments || documentFocus) {
    return buildComprehensiveDocumentAnswer(question, documentFocus, context, language);
  }
  if (wantsCedula && !documentFocus) {
    return buildCedulaAnswer(question);
  }

  // 4. PRIORITY: Check Custom AI Knowledge Items (Admin-Trained Knowledge Base)
  if (relevantKnowledge.length > 0) {
    const topKnowledge = relevantKnowledge[0];
    const topScore = scoreKnowledgeMatch(question, topKnowledge);
    if (topScore >= 5) {
      return answerFromKnowledge(question, relevantKnowledge, context, language);
    }
  }

  // 5. Multi-Domain Compound Inquiries Resolver
  const detectedDomains = [];

  if (organizationAnswer) {
    detectedDomains.push({
      key: "organization",
      answer: organizationAnswer,
    });
  }

  // Check Documents (Clearance, Indigency, Residency, ID, Business Permit, etc.)
  if (wantsDocuments || documentFocus) {
    detectedDomains.push({
      key: "documents",
      answer: buildComprehensiveDocumentAnswer(question, documentFocus, context, language),
    });
  }

  // Check Cedula (if not already covered under document focus)
  if (wantsCedula && !documentFocus) {
    detectedDomains.push({
      key: "cedula",
      answer: buildCedulaAnswer(question),
    });
  }

  // Check Livelihoods & Jobs
  if (wantsLivelihood) {
    detectedDomains.push({
      key: "livelihood",
      answer: buildLivelihoodAnswer(opportunities, language),
    });
  }

  // Check Announcements
  if (wantsAnnouncements) {
    detectedDomains.push({
      key: "announcements",
      answer: buildAnnouncementsAnswer(announcements, language),
    });
  }

  // Check Health Services
  const isHealth = includesAny(normalizedQ, [
    "health", "kalusugan", "doctor", "doktor", "bakuna", "vaccine", "medicine", "gamot", "clinic", "health center", "health services"
  ]);
  if (isHealth) {
    detectedDomains.push({
      key: "health",
      answer: language === "tagalog"
        ? "🏥 **Serbisyo ng Barangay Health Center:**\n\n• **Oras ng Serbisyo:** Lunes hanggang Biyernes, 8:30 AM hanggang 4:00 PM.\n• **Mga Serbisyo:** Konsultasyon, bakuna, prenatal checkup, pamimigay ng libreng gamot (kung available), at first aid.\n• **Emergency Hotline:** 09306259795."
        : "🏥 **Barangay Health Center Services:**\n\n• **Operating Hours:** Monday to Friday, 8:30 AM – 4:00 PM.\n• **Services:** Medical consultations, immunizations, prenatal checkups, free basic medicines (subject to stock), and first aid.\n• **Emergency Hotline:** 09306259795.",
    });
  }

  // Check Barangay Policies / Ordinances
  const isPolicy = includesAny(normalizedQ, [
    "policy", "policies", "patakaran", "polisiya", "ordinance", "ordinansa", "batas", "tuntunin",
    "curfew", "solid waste", "waste management", "segregation", "basura", "videoke", "karaoke", "ingay",
    "noise", "stray animal", "stray", "alagang hayop", "aso", "pusa", "lupon", "tagapamayapa", "reklamo"
  ]);
  if (isPolicy) {
    detectedDomains.push({
      key: "policy",
      answer: buildBarangayPolicyAnswer(question, knowledgeItems || [], language),
    });
  }

  // Check Office Info / Contact Hours
  if (wantsOfficeInfo && !wantsDocuments) {
    detectedDomains.push({
      key: "office",
      answer: buildOfficeInfoAnswer(question),
    });
  }

  // Check Demographic / Resident Stats
  if (wantsResidentStats) {
    detectedDomains.push({
      key: "stats",
      answer: buildResidentStatsAnswer(question, residentStats, language),
    });
  }

  // Check Self Profile
  if (wantsProfile || isSelfProfileQuestion(normalizedQ, resident)) {
    detectedDomains.push({
      key: "profile",
      answer: buildSelfProfileAnswer(resident, language),
    });
  }

  // Check Anniversary
  if (wantsAnniversary) {
    detectedDomains.push({
      key: "anniversary",
      answer: buildAnniversaryAnswer(question),
    });
  }

  // If one or more domains matched, return combined answer
  if (detectedDomains.length > 0) {
    return stripSuggestedQuestions(detectedDomains.map((d) => d.answer).join("\n\n---\n\n"));
  }

  // Check Custom Knowledge Items
  if (relevantKnowledge.length > 0) {
    return answerFromKnowledge(question, relevantKnowledge, context, language);
  }

  // Out of Scope or General fallback
  if (isOutsideBarangayScope(question)) {
    return buildOutOfScopeLimitationAnswer(language);
  }

  return language === "tagalog"
    ? `Nauunawaan ko po ang inyong tanong. Handa po akong magbigay ng kumpletong gabay ukol sa **pag-request ng mga dokumento (clearance, indigency, residency, ID)**, **anunsyo sa komunidad**, **mga bukas na trabaho at livelihood programs**, o **impormasyon ukol sa mga opisyal at patakaran ng Barangay Upper Mingading**.\n\nAno po ang partikular na detalye na nais ninyong itanong?`
    : `I understand your question. I am here to assist you with **document requests (clearance, indigency, residency, ID)**, **community announcements**, **livelihood & job opportunities**, or **Barangay Upper Mingading policies and services**.\n\nHow can I specifically assist you today?`;
}

export async function askResidentAssistant(question, context = {}) {
  const trimmedQuestion = question?.trim();
  if (!trimmedQuestion) return "";

  const resident = context.resident || null;
  const normalizedQ = normalizeText(trimmedQuestion);
  const language = isTagalogQuestion(trimmedQuestion) ? "tagalog" : "english";

  // Real-time synchronization with Admin database for Organization Officials
  let resolvedOfficials = context.organizationOfficials;
  try {
    const freshOfficials = await fetchOrganizationOfficials();
    if (freshOfficials && Array.isArray(freshOfficials) && freshOfficials.length > 0) {
      resolvedOfficials = freshOfficials;
      context.organizationOfficials = freshOfficials;
    }
  } catch (e) {
    console.warn("Could not load fresh organization officials for assistant:", e);
  }
  if (!resolvedOfficials || !resolvedOfficials.length) {
    resolvedOfficials = getOrganizationOfficials();
    context.organizationOfficials = resolvedOfficials;
  }

  // Automatically load or refresh AI Knowledge Items from database so any newly added item is instantly known
  try {
    const freshKnowledge = await fetchKnowledgeItems({ residentVisible: true, limit: 100 });
    if (freshKnowledge && Array.isArray(freshKnowledge) && freshKnowledge.length > 0) {
      context.knowledgeItems = freshKnowledge;
    }
  } catch (e) {
    console.warn("Could not load fresh knowledge items for assistant:", e);
  }

  context.organizationOfficials = resolvedOfficials;

  const startTime = Date.now();
  let answer = "";

  const isHistory =
    includesAny(normalizedQ, [
      "political history", "history", "hstory", "kasaysayan", "pinagmulan", "origin", "pulitika", "politika",
      "first captain", "1st captain", "unang kapitan", "unang pinuno", "first leader", "1st leader",
      "2nd captain", "second captain", "pangalawang kapitan", "ikalawang kapitan",
      "3rd captain", "third captain", "pangatlong kapitan", "ikatlong kapitan",
      "4th captain", "fourth captain", "pang-apat na kapitan", "ikaapat na kapitan",
      "5th captain", "fifth captain", "panglimang kapitan", "ikalimang kapitan",
      "6th captain", "sixth captain", "pang-anim na kapitan", "ikaanim na kapitan",
      "7th captain", "seventh captain", "pampitong kapitan", "ikapitong kapitan",
      "8th captain", "eighth captain", "pangwalong kapitan", "ikawalong kapitan",
      "9th captain", "ninth captain", "pangsiyam na kapitan", "ikasiyam na kapitan",
      "10th captain", "tenth captain", "pangsampung kapitan", "ikasampung kapitan",
      "11th captain", "eleventh captain", "panglabing-isang kapitan",
      "dating kapitan", "nakaraang kapitan", "previous captain", "past captain", "past leaders", "timeline",
      "catenas", "bolivar", "cari", "capio", "calician", "caponpon"
    ]);

  const isAskingCurrentCaptain =
    !includesAny(normalizedQ, ["unang", "una", "first", "1st", "history", "hstory", "dating", "nakaraan", "past", "timeline", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "pangalawa", "pangatlo", "pang-apat", "panglima", "pang-anim", "pampito", "pangwalo", "pangsiyam", "pangsampu"]) &&
    ((includesAny(normalizedQ, ["captain", "kapitan", "punong barangay"]) &&
      includesAny(normalizedQ, ["sino", "who", "ngayon", "present", "current", "kasalukuyan", "sino si", "sino ang"])) ||
    includesAny(normalizedQ, [
      "sino ang kapitan",
      "sino kapitan",
      "sino ang punong barangay",
      "sino punong barangay",
      "who is the captain",
      "who is captain",
      "who is the barangay captain",
      "kapitan ngayon",
      "captain ngayon",
    ]));

  const documentTemplates = context.documentTemplates || [];
  const requests = context.requests || [];
  const documentFocus = findDocumentFocus(trimmedQuestion, documentTemplates, requests);
  const wantsDocuments = Boolean(documentFocus) || (
    includesAny(normalizedQ, [
      "clearance", "indigency", "residency", "barangay id", "business permit", "cedula", "ctc", "4ps"
    ]) ||
    (includesAny(normalizedQ, ["dokumento", "document", "request document", "mag-request", "mag request", "kumuha ng certificate", "kumuha ng permit", "kumuha ng clearance", "requirements", "requirement", "kailangan", "bayad", "singil"]) &&
     !includesAny(normalizedQ, ["smoke", "smoking", "curfew", "basura", "ingay", "videoke", "aso", "pusa", "bawal", "policy", "ordinansa"]))
  );
  const wantsCedula = isCedulaQuestion(trimmedQuestion);

  // Single-intent fast-track handlers for conversational / security / history / documents triggers
  if (isHarmfulOrViolentQuery(normalizedQ)) {
    answer = buildSafetyAndEthicsAnswer(language);
  } else if (isAdminPasswordOrSecurityQuestion(normalizedQ)) {
    answer = buildAdminPasswordSecurityAnswer(language);
  } else if (isApprovalOrRecordModificationQuestion(normalizedQ)) {
    answer = buildApprovalOrRecordModificationAnswer(language);
  } else if (isAdminPortalQuestion(normalizedQ)) {
    answer = buildAdminPortalAnswer(language);
  } else if (isThirdPartyPrivacyQuestion(normalizedQ)) {
    answer = buildPrivacyLimitationAnswer(language);
  } else if (findSmartAnswerInKnowledge(trimmedQuestion, context.knowledgeItems || [], language)) {
    // Top Priority: Trained knowledge from AI Knowledge & Chatbot Trainer
    answer = findSmartAnswerInKnowledge(trimmedQuestion, context.knowledgeItems || [], language);
  } else if (isOutOfBarangayScopeQuestion(normalizedQ)) {
    answer = buildOutOfScopeLimitationAnswer(language);
  } else if (isGreetingMessage(trimmedQuestion)) {
    answer = buildGreetingAnswer(trimmedQuestion, resident);
  } else if (isApologyMessage(trimmedQuestion)) {
    answer = buildApologyAnswer(trimmedQuestion);
  } else if (isGratitudeMessage(trimmedQuestion)) {
    answer = buildGratitudeAnswer(trimmedQuestion);
  } else if (isConversationalOrFriendlyQuestion(trimmedQuestion)) {
    answer = buildConversationalAnswer(trimmedQuestion, resident, language);
  } else if (isAskingCurrentCaptain) {
    answer = buildCurrentCaptainAnswer(resolvedOfficials, language);
  } else if (hasOrganizationChartIntent(trimmedQuestion)) {
    answer = buildOrganizationAnswer(trimmedQuestion, resolvedOfficials, language);
  } else if (isHistory) {
    answer = buildPoliticalHistoryAnswer(trimmedQuestion, resolvedOfficials, language);
  } else if (isResidentStatsQuestion(trimmedQuestion)) {
    try {
      const freshStats = await fetchResidentStats(true);
      context.residentStats = freshStats;
    } catch (error) {
      console.error("Failed to dynamically fetch fresh stats for AI prompt:", error);
    }
    answer = buildResidentStatsAnswer(trimmedQuestion, context.residentStats, language);
  } else if (wantsDocuments || Boolean(documentFocus)) {
    answer = buildComprehensiveDocumentAnswer(trimmedQuestion, documentFocus, context, language);
  } else if (wantsCedula && !documentFocus) {
    answer = buildCedulaAnswer(trimmedQuestion);
  } else {
    // Only fetch fresh stats if not already provided in context to avoid unnecessary network delay
    if (!context.residentStats?.loaded) {
      try {
        const freshStats = await fetchResidentStats();
        context.residentStats = freshStats;
      } catch (error) {
        console.error("Failed to dynamically fetch fresh stats for AI prompt:", error);
      }
    }

    // Try Gemini AI first; if offline/error/revoked key, automatically fall back to smart local compound engine
    answer = await queryGeminiWithRichContext(trimmedQuestion, context);
  }

  // Responsive natural delay (300ms to 600ms)
  const elapsed = Date.now() - startTime;
  const targetThinkingTime = Math.floor(Math.random() * 300) + 300;
  if (elapsed < targetThinkingTime) {
    await new Promise((resolve) => setTimeout(resolve, targetThinkingTime - elapsed));
  }

  return answer;
}

async function queryGeminiWithRichContext(question, context = {}) {
  try {
    const {
      announcements = [],
      documentTemplates = [],
      knowledgeItems = [],
      opportunities = [],
      organizationOfficials = getOrganizationOfficials(),
      requests = [],
      resident,
      residentStats,
    } = context;

    const statsStr = residentStats?.loaded
      ? `Total Residents: ${residentStats.currentResidents}
Seniors: ${residentStats.seniorCitizens}
PWDs: ${residentStats.pwdResidents}
Male: ${residentStats.maleResidents}
Female: ${residentStats.femaleResidents}
By Purok: ${formatCounts(residentStats.purokCounts)}`
      : "Not Loaded";

    const activeOfficials = getActiveOrganizationOfficials(
      organizationOfficials?.length ? organizationOfficials : getOrganizationOfficials()
    );
    const officialsStr = activeOfficials
      .map(o => `- Name: ${o.name}, Position: ${o.position}, Committee: ${o.committee || 'None'}, Contact: ${o.contact || 'N/A'}`)
      .join("\n") || "No officials loaded.";

    const templatesStr = dedupeDocumentTemplates(documentTemplates)
      .map(t => `- Document: ${t.template_name || t.document_type}, Requirements: ${t.requirements || 'Valid ID & Cedula'}, Processing Time: ${t.processing_time || '1 day'}, Fee: ${t.fee || '50 pesos'}`)
      .join("\n") || "No templates loaded.";

    const requestsStr = requests
      .map((r, i) => `- ${r.document_type} (Status: ${r.status}, Requested: ${formatDate(r.created_at)})`)
      .join("\n") || "No requests submitted yet.";

    // Include all active barangay knowledge items (policies, circulars, resolutions, uploaded documents)
    const activeKnowledgeItems = (knowledgeItems || []).filter(
      (k) => (k.status === "Active" || !k.status) && k.title && k.content
    );

    const knowledgeStr = [
      ...activeKnowledgeItems.map((k) => `[BARANGAY KNOWLEDGE / POLICY ITEM]\nTitle: ${k.title}\nCategory: ${k.category || "General"}\nTarget Audience: ${k.audience || "All Residents"}\nDetails/Policy Content: ${k.content}`),
      OFFICIAL_ROLES_KNOWLEDGE_TEXT,
      OFFICIAL_BARANGAY_POLICIES_TEXT,
    ].join("\n\n");

    const settings = getSystemSettings();
    const officeHours = settings.officeHours || "Monday to Friday, 8:00 AM - 5:00 PM";
    const contactEmail = settings.officeEmail || "not set";
    const contactPhone = settings.officePhone || "09306259795";

    const rawDataStr = residentStats?.anonymousResidents 
      ? JSON.stringify(residentStats.anonymousResidents) 
      : "[]";

    const isTagalog = isTagalogQuestion(question);
    const detectedLang = isTagalog ? "TAGALOG" : "ENGLISH";

    const systemInstructionText = `You are KaagapAI, the official Resident Virtual Assistant and System Copilot for Barangay Upper Mingading Resident Management System.

STRICT PURPOSE & SCOPE LIMITATION:
- Your purpose and knowledge are STRICTLY AND EXCLUSIVELY limited to Barangay Upper Mingading local government services, document requests, public announcements, livelihood/jobs, barangay officials, political history, and community guidelines.
- If the user asks about ANYTHING outside Barangay Upper Mingading (such as cooking recipes, preparing food, sports, games, movies, general homework, coding, or gossip):
  * You MUST POLITELY APOLOGIZE AND DECLINE to answer the out-of-scope question (e.g., "Pasensya na po, bilang opisyal na Resident Assistant ng Barangay Upper Mingading, ang aking serbisyo ay nakatuon po lamang sa ating barangay...").
  * Clearly direct them to official barangay services (clearances, certificates, announcements, livelihoods).

STRICT KNOWLEDGE BASE PRIORITY:
- When the resident asks about any policy, rule, guideline, smoking area/ordinance, curfew, event, or announcement defined in the Barangay Knowledge / Policy Items above, ALWAYS answer DIRECTLY, ACCURATELY, and FACTUALLY based on that knowledge entry. Do NOT divert to generic document requests when the question is about an ordinance, smoking, or policy rule.

LANGUAGE & CONVERSATIONAL BEHAVIOR:
- Match the resident's language naturally: English, Filipino/Tagalog, or Taglish.
- Warm, polite, respectful, and professional. Use "po" and "opo" respectfully when speaking Tagalog.
- Use structured markdown formatting with bullet points and bold highlights for effortless reading.

CRITICAL DATA PRIVACY CONSTRAINT (DATA PRIVACY ACT OF 2012 / RA 10173):
- NEVER disclose personal contact numbers, passwords, residential addresses, or private records of any other resident.
- If asked for someone else's personal info or admin passwords, firmly decline under the Data Privacy Act.
- If the logged-in resident asks for their OWN profile/information, summarize their own profile details clearly.

POLITICAL HISTORY & COMPLETE LEADERSHIP TIMELINE (1st to 11th Captains):
When asked about specific leaders (e.g. 1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th, 10th, 11th/current) or general history, answer with exact precision:
1. 1st Leader / 1st Teniente: Hon. Gaudencio Catenas (1952–1958) - Facilitated opening of Bacolod Primary School (1953) with 2 hectares donated by Mr. Sagadan + 1.85 ha for barangay site.
2. 2nd Leader / 2nd Teniente: Hon. Dioscoro Bolivar (1958–1964) - In 1958, the barangay was divided into Upper Mingading and Lower Mingading.
3. 3rd Leader / 3rd Teniente: Hon. Eustaquio Garito - Maintained longstanding unity and peace among Muslim and Christian constituents.
4. 4th Leader / 1st Barangay Captain Era: Hon. Segundo Cari (1969–1972) - Expanded territory into parts of Lower Mingading after ILAGA-Black Shirt conflict.
5. 5th Leader / 5th Captain: Hon. Bonifacio Capio (1972–1986) - Improved San Mateo-Upper Mingading road; opened road to Sitio Nalpan.
6. 6th Leader / 6th Captain: Hon. Sofia Garito (1986–1991) - First Female Barangay Captain. Rehabilitated road and encouraged planting fruit & forest trees.
7. 7th Leader / 7th Captain: Hon. Sito Calician (1991–1994) - Organized Civilian Volunteer Officers (CVO / Barangay Tanod).
8. 8th Leader / 8th Captain: Hon. Mamerto Garito (1994–2004) - Built Barangay Hall, Health Center, Water System, Day Care, All-Weather Road; electrification & streetlights.
9. 9th Leader / 9th Captain: Hon. Myrna Garito (2004–2007) - Built MRF & water system in Puroks Malipayon & Motor; opened Brgy Road Payhod to Buklod; Bacolod Annex School in Purok Muslim; new Barangay Hall.
10. 10th Leader / 10th Captain: Hon. Wilson C. Caponpon (2007–2023) - Former Punong Barangay, now Kagawad. Best Performing Barangay, Model Barangay in SWM, Best Recycling Innovation awardee.
11. 11th Leader / Current Punong Barangay: Hon. Mamerto C. Clarito (2023–Present) - Leads Sangguniang Barangay, modernizing public services and KaagapAI digital administration.

RESIDENT PORTAL FEATURES & EDIT/UPDATE WORKFLOWS:
1. Requesting Documents: (1) Click 'Request Document' on dashboard, (2) Choose type (Clearance, Indigency-Free, Residency, Business Permit, 4Ps, Barangay ID), (3) Enter purpose & attachments, (4) Submit.
2. Status Tracking: Pending -> Processing / Approved -> Ready for Pickup (claim with Valid ID & Cedula at Barangay Hall) -> Released.
3. Editing / Updating Document Requests:
   - If 'Pending': Resident can cancel and submit a new request with updated details under 'Document Requests'.
   - If 'Processing' or 'Approved': Online edits are locked because document is already in production/signed. Must visit Barangay Hall or call 09306259795 for urgent modifications.
4. Editing / Updating Resident Profile:
   - Go to Profile Settings (top right icon) -> Edit Profile -> Update contact number, civil status, occupation, password. Official name or purok changes submit a Profile Update Request for Admin verification.
5. Announcements & Livelihood: View notices, job vacancies, and TESDA skills training with 'Apply Now'.
6. Voice & Chat Assistant: Voice audio input and playback 24/7.

MANDATORY CHART RULE FOR ALL TOTAL / COUNT INQUIRIES:
Whenever the user asks for population, purok count, senior count, PWD count:
- Specific purok: State total for that purok and include chart for that purok: "[CHART:BAR:{\"Purok Kamonsil\":305}]"
- All puroks: Include all puroks in chart: "[CHART:BAR:{\"Kamonsil\":305,\"Payhod\":278,\"Muslim\":547,\"Malipayon\":339,\"Purok-3\":263,\"Buklod\":316,\"Azucena\":157}]"

DOCUMENT REQUEST INTENT RULES (STRICT):
- If the user asks ONLY "how to request" or "steps to request": Provide ONLY the concise 4 numbered steps (starting with "1. Click 'Request Document' on your dashboard"). Do NOT add requirements or fees unless asked!
- If the user asks ONLY for requirements or fees: Provide ONLY the requirements and fees.
- If the user asks for BOTH: Provide both in separate sections.

DOCUMENT REQUIREMENTS ORDER (STRICT):
Whenever asked for the requirements to request any document (such as Barangay Clearance, Certificate of Residency, Barangay ID, Business Permit, etc.), you MUST list them strictly in this exact order:
1. Cedula (Community Tax Certificate) — Makukuha sa opisina ng Barangay Treasurer sa Barangay Hall
2. Valid ID (Government-issued ID tulad ng National ID, Driver's License, Voter's ID, PhilHealth, o Student ID)
3. 50 Pesos Cash per request (₱50.00 cash na babayaran sa Barangay Treasurer pagkuha)
(Note: Ang Certificate of Indigency ay libre / walang bayad para sa mga indigent residents).`;

    const prompt = `System Settings:
- Barangay Name: Barangay Upper Mingading
- Office Hours: ${officeHours}
- Contact Email: ${contactEmail}
- Contact Phone: ${contactPhone}

Current Resident Profile:
- Name: ${resident?.full_name || "Resident"}
- Purok: ${resident?.purok || "Not set"}

Barangay Statistics:
${statsStr}

Barangay Officials (from Official Organizational Chart):
${officialsStr}

Available Document Templates:
${templatesStr}

Resident's Document Requests:
${requestsStr}

Barangay Announcements:
${announcements.slice(0, 5).map((a, i) => `- Title: ${a.title}\n  Body: ${a.body}\n  Category: ${a.category}`).join("\n\n")}

Livelihoods and Jobs Opportunities:
${opportunities.slice(0, 5).map((o, i) => `- Title: ${o.title}\n  Details: ${o.description}\n  Deadline: ${formatDate(o.deadline)}`).join("\n\n")}

KaagapAI Internal Knowledge Base:
${knowledgeStr}

Anonymized Raw Data for Analytics:
${rawDataStr}

User Question:
${question}

Follow the System Instructions strictly. If the user asks multiple questions in their query, answer EVERY SINGLE part completely and thoroughly. Language MUST match the user question (${detectedLang}). If unknown or unrelated, clearly state you don't have information on that topic. Be direct and accurate.`;

    const result = await generateText(prompt, {
      systemInstruction: systemInstructionText,
      temperature: 0.2,
      maxOutputTokens: 2048,
    });

    const ans = extractGeminiText(result);
    if (ans) return ans;

    return buildLocalAnswer(question, context);
  } catch (error) {
    console.warn("Gemini AI query unavailable, seamlessly falling back to comprehensive local engine:", error.message);
    return buildLocalAnswer(question, context);
  }
}


