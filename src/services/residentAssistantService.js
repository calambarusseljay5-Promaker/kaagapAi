import { getSystemSettings } from "./adminActivityService";
import { generateText } from "./geminiService";
import { getOrganizationOfficials } from "./organizationService";
import { fetchResidentStats } from "./residentStatsService";

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

  return useTagalog
    ? "Pasensya ka na, hindi ako makakatulong sa pananakit o pagpatay ng tao kahit biro lang. Maaari kitang tulungan sa barangay documents, announcements, livelihood/jobs, o iba pang resident assistance."
    : "Sorry, I can't help with harming or killing anyone, even as a joke. I can help with barangay documents, announcements, livelihood/jobs, or other resident assistance.";
};

const buildRespectfulAnswer = (question) =>
  isTagalogQuestion(question)
    ? "Pakiusap po, panatilihin nating magalang ang usapan. Nandito ako para tumulong sa barangay documents, announcements, livelihood/jobs, office info, profile, at iba pang resident services."
    : "Please keep our conversation respectful. I can help with barangay documents, announcements, livelihood/jobs, office info, profile, and other resident services.";

const CLOSING_STATEMENTS_EN = [
  "For the most accurate and updated information, please visit the Barangay Upper Mingading Office.",
  "You may also contact the Barangay Office for official confirmation.",
  "If you need further assistance, our Barangay Office staff will be happy to assist you during office hours.",
  "Please coordinate with the Barangay Office for the latest requirements and schedules.",
  "For complete details, please inquire directly at the Barangay Upper Mingading Office."
];

const CLOSING_STATEMENTS_TL = [
  "Para sa pinakabagong impormasyon at opisyal na gabay, pakiusap bisitahin ang Barangay Upper Mingading Office.",
  "Maaari rin kayong makipag-ugnayan sa Barangay Office para sa opisyal na kumpirmasyon.",
  "Kung kailangan ninyo ng karagdagang tulong, nakahandang tumulong ang ating Barangay Office staff sa oras ng opisina.",
  "Mangyaring makipag-ugnayan sa Barangay Office para sa pinakahuling requirements at iskedyul.",
  "Para sa kumpletong detalye, pakiusap mag-inquire nang direkta sa ating Barangay Upper Mingading Office."
];

const getDynamicClosingStatement = (language = "english") => {
  const list = language === "tagalog" ? CLOSING_STATEMENTS_TL : CLOSING_STATEMENTS_EN;
  return list[Math.floor(Math.random() * list.length)];
};

const BARANGAY_SCOPE_KEYWORDS = [
  "barangay", "office", "hall", "document", "dokumento", "clearance", "cedula",
  "certificate", "permit", "request", "announcement", "anunsyo", "livelihood",
  "trabaho", "job", "health", "kalusugan", "disaster", "bagyo", "baha",
  "complaint", "reklamo", "waste", "basura", "senior", "pwd", "solo parent",
  "women", "babae", "sk", "youth", "official", "officials", "kapitan", "kagawad",
  "purok", "resident", "assistance", "tulong", "educational", "burial", "medical",
  "financial", "rabies", "vaccine", "vaccination", "scholarship", "event", "court",
  "edukasyon", "libing", "burol", "gamot", "ospital", "hospital", "ayuda", "tulong",
  "how", "can", "what", "where", "when", "who", "paano", "saan", "kailan", "sino"
];

const isOutsideBarangayScope = (question) => {
  const normalized = normalizeText(question);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length <= 4) return false;
  return !includesAny(normalized, BARANGAY_SCOPE_KEYWORDS);
};

const isGratitudeMessage = (question) => {
  const normalized = normalizeText(question);
  const words = normalized.split(" ").filter(Boolean);
  return (
    words.length <= 8 &&
    (
      includesAny(normalized, [
        "thank you",
        "thanks",
        "salamat",
        "maraming salamat",
        "salamat po",
        "maraming salamat po",
        "ty",
        "tnx",
        "thank u"
      ]) ||
      normalized.includes("salamat") ||
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

const buildPoliticalHistoryAnswer = (question, language = "tagalog") => {
  const norm = normalizeText(question);

  // Check if asking about the first leader or first captain
  if (
    includesAny(norm, [
      "first captain", "1st captain", "unang kapitan", "unang pinuno", "first leader",
      "1st barangay captain", "first barangay captain", "sino ang unang", "who is the first"
    ])
  ) {
    return language === "tagalog"
      ? "🏛️ **Ang Unang Pinuno at Kapitan ng Barangay Upper Mingading:**\n\n1. **Hon. Gaudencio Catenas** (1952–1958) — Ang **Unang Pinuno (Teniente del Barrio)** ng barangay. Sa kanyang pamumuno itinatag ang Bacolod Primary School noong 1953 mula sa donasyong 2 ektaryang lupa ni G. Sagadan kasama ang 1.85 ektarya para sa barangay site.\n\n2. **Hon. Segundo Cari** (1969–1972) — Ang **Unang may opisyal na titulong Barangay Captain** sa Upper Mingading na nagpalawak ng teritoryo ng barangay."
      : "🏛️ **The First Leader & Barangay Captain of Barangay Upper Mingading:**\n\n1. **Hon. Gaudencio Catenas** (1952–1958) — The **1st Leader (Teniente del Barrio)** of the barangay. He facilitated the opening of Bacolod Primary School (founded in 1953) on 2 hectares of donated land by Mr. Sagadan, plus 1.85 hectares for the barangay site.\n\n2. **Hon. Segundo Cari** (1969–1972) — The **1st official to carry the title of Barangay Captain** in Upper Mingading, who expanded the barangay territory.";
  }

  // Check if asking about a specific past leader
  if (includesAny(norm, ["catenas", "gaudencio"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Gaudencio Catenas** (1952–1958)\n• **Posisyon:** Teniente del Barrio\n• **Mga Nagawa:** Pinasimulan ang pagbubukas ng Bacolod Primary School (itinatag noong 1953) sa donasyong 2 ektaryang lupa ni G. Sagadan, kasama ang 1.85 ektarya para sa barangay site."
      : "🏛️ **Hon. Gaudencio Catenas** (1952–1958)\n• **Position:** Teniente del Barrio\n• **Accomplishments:** Facilitated the opening of Bacolod Primary School (founded in 1953) with 2 hectares donated by Mr. Sagadan, plus 1.85 hectares donated for the barangay site.";
  }

  if (includesAny(norm, ["bolivar", "dioscoro"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Dioscoro Bolivar** (1958–1964)\n• **Posisyon:** Teniente del Barrio\n• **Mga Nagawa:** Noong 1958 sa kanyang panunungkulan, opisyal na nahati ang barangay sa dalawa (Upper Mingading at Lower Mingading)."
      : "🏛️ **Hon. Dioscoro Bolivar** (1958–1964)\n• **Position:** Teniente del Barrio\n• **Accomplishments:** In 1958 during his tenure, the barangay was officially divided into two: Upper Mingading and Lower Mingading.";
  }

  if (includesAny(norm, ["eustaquio", "eustaquio garito"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Eustaquio Garito**\n• **Posisyon:** Teniente del Barrio\n• **Mga Nagawa:** Napanatili ang pangmatagalang kapayapaan, pagkakaisa, at pagkakaunawaan sa pagitan ng mga mamamayang Muslim at Kristiyano sa barangay."
      : "🏛️ **Hon. Eustaquio Garito**\n• **Position:** Teniente del Barrio\n• **Accomplishments:** Maintained longstanding unity, peace, and harmony between Muslim and Christian constituents.";
  }

  if (includesAny(norm, ["cari", "segundo"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Segundo Cari** (1969–1972)\n• **Posisyon:** Barangay Captain\n• **Mga Nagawa:** Pinalawak ang nasasakupang teritoryo ng barangay patungo sa mga bahagi ng Lower Mingading kasunod ng labanang ILAGA-Black Shirt nang magbenta ng lupa ang ilang residente."
      : "🏛️ **Hon. Segundo Cari** (1969–1972)\n• **Position:** Barangay Captain\n• **Accomplishments:** Expanded the barangay territory into parts of Lower Mingading following the ILAGA-Black Shirt conflict when Moro residents vacated and sold land.";
  }

  if (includesAny(norm, ["capio", "bonifacio"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Bonifacio Capio** (1972–1986)\n• **Posisyon:** Barangay Captain\n• **Mga Nagawa:** Isinaayos at pinaganda ang kalsada mula San Mateo patungong Upper Mingading, at pinasimulan ang pagbubukas ng daan patungong Sitio Nalpan."
      : "🏛️ **Hon. Bonifacio Capio** (1972–1986)\n• **Position:** Barangay Captain\n• **Accomplishments:** Improved the San Mateo to Upper Mingading road and initiated the road opening to Sitio Nalpan.";
  }

  if (includesAny(norm, ["sofia", "sofia garito"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Sofia Garito** (1986–1991)\n• **Posisyon:** Barangay Captain\n• **Mga Nagawa:** Isinagawa ang rehabilitasyon ng kalsada mula San Mateo hanggang Upper Mingading, at hinikayat ang mga mamamayan na magtanim ng permanenteng punong prutas at forest trees."
      : "🏛️ **Hon. Sofia Garito** (1986–1991)\n• **Position:** Barangay Captain\n• **Accomplishments:** Rehabilitated the San Mateo–Upper Mingading road and encouraged constituents to plant permanent fruit and forest trees.";
  }

  if (includesAny(norm, ["calician", "sito"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Sito Calician** (1991–1994)\n• **Posisyon:** Barangay Captain\n• **Mga Nagawa:** Itinatag at inorganisa ang Civilian Volunteer Officer (CVO / Barangay Tanod) para sa kaligtasan at kapayapaan ng barangay."
      : "🏛️ **Hon. Sito Calician** (1991–1994)\n• **Position:** Barangay Captain\n• **Accomplishments:** Organized the Civilian Volunteer Officers (CVO) in the barangay to maintain local safety and security.";
  }

  if (includesAny(norm, ["mamerto", "mamerto garito"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Mamerto Garito** (1994–2004)\n• **Posisyon:** Barangay Captain\n• **Mga Nagawa:** Pagtatayo ng Barangay Hall, Health Center, Water System, Day Care Center, at All-Weather Road. Pag-organisa ng CAFGU, kooperatiba, at Farmers Association. Pagpapakabit ng kuryente (electrification) at street lights sa barangay."
      : "🏛️ **Hon. Mamerto Garito** (1994–2004)\n• **Position:** Barangay Captain\n• **Accomplishments:** Construction of Barangay Hall, Health Center, Water System, Day Care Center, and All-Weather Road. Organized CAFGU, cooperatives, and Farmer Association. Established barangay electrification and street lights.";
  }

  if (includesAny(norm, ["myrna", "myrna garito"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Myrna Garito** (2004–2007)\n• **Posisyon:** Punong Barangay\n• **Mga Nagawa:** Pagtatayo ng MRF (Materials Recovery Facility) at water system sa Puroks Malipayon at Motor; pagbubukas ng Brgy Road mula Purok Payhod hanggang Purok Buklod; pagbubukas ng Bacolod Annex Primary School sa Purok Muslim; bagong Barangay Hall sa suporta ni Cong. Em 'Lala' Taliño-Mendoza; Box Culvert at 2 classrooms sa Purok Muslim."
      : "🏛️ **Hon. Myrna Garito** (2004–2007)\n• **Position:** Punong Barangay\n• **Accomplishments:** Constructed Materials Recovery Facility (MRF) and water system in Puroks Malipayon & Motor. Opened Brgy Road from Purok Payhod to Purok Buklod. Opened Bacolod Annex Primary School in Purok Muslim. Built new Punong Barangay Office & Brgy Hall funded by Cong. Em 'Lala' Taliño-Mendoza. Box Culvert & 2 classrooms in Purok Muslim.";
  }

  if (includesAny(norm, ["caponpon", "wilson", "kasalukuyang kapitan", "current captain", "punong barangay ngayon"])) {
    return language === "tagalog"
      ? "🏛️ **Hon. Wilson Caponpon** (2007–Kasalukuyan)\n• **Posisyon:** Punong Barangay (Kasalukuyang Punong Barangay)\n• **Mga Nagawa:** Pagpapatupad ng Pambansa, Panlalawigan, at Pambayang mga programa; pagpapanatili ng kapayapaan at kaayusan; pagpapaganda at pagpapagawa ng mga kalsada.\n🏆 **Mga Gawad at Parangal:** Model Barangay in Solid Waste Management, Best Performing Barangay (Provincial level), Special Award for Best Recycling Innovation, Model RIC (Recycle), Special Award Nominee sa National Level."
      : "🏛️ **Hon. Wilson Caponpon** (2007–Present)\n• **Position:** Punong Barangay (Current Barangay Captain)\n• **Accomplishments:** Implemented National, Provincial, and Municipal programs; maintained peace and order; improved and paved barangay roads.\n🏆 **Awards & Recognitions:** Model Barangay in Solid Waste Management, Best Performing Barangay at Provincial level, Special Award (Best Recycling Innovation), Model RIC, Special Award Nominee at National level.";
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

10. **Hon. Wilson Caponpon** (2007–Kasalukuyan) — *Punong Barangay*
    • Pagpapatupad ng pambansa, panlalawigan, at pambayang programa; pagpapanatili ng kapayapaan at kaayusan; pagpapaganda ng mga kalsada.
    🏆 **Mga Parangal:** Best Performing Barangay, Model Barangay in Solid Waste Management, Best Recycling Innovation sa Provincial at National levels.`;
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

10. **Hon. Wilson Caponpon** (2007–Present) — *Punong Barangay*
    • Implemented National, Provincial, and Municipal programs; maintained peace and order; improved and paved barangay roads.
    🏆 **Awards:** Model Barangay in Solid Waste Management, Best Performing Barangay at Provincial level, Best Recycling Innovation, Special Award Nominee at National level.`;
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
Position: Punong Barangay
Year of Service: 2007 up to present
Accomplishments: Implemented National, Provincial, and Municipal programs; maintained peace and order; improved barangay roads.
Awards Received: Special Award Nominee at Nat'l level, Outstanding Achievement in Environment Management at Reg'l level, Best Performing Barangay at Prov'l level, Special Award (Best Recycling Innovation) at Prov'l level, Model RIC (Recycle) at Prov'l level, Model Barangay in Solid Waste Management.
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

const ASSISTANT_META_TERMS = [
  "are you ai",
  "assistant",
  "capabilities",
  "chatbot",
  "help me",
  "how can you help",
  "kaagapai",
  "purpose",
  "role",
  "what can you do",
  "what do you know",
  "what is your job",
  "who are you",
  "ano kaya mo",
  "ano ang trabaho mo",
  "ano ka",
  "paano ka makakatulong",
  "sino ka",
];

const OUT_OF_SCOPE_TERMS = [
  "adobo",
  "sinigang",
  "luto",
  "lutuin",
  "magluto",
  "mag-luto",
  "recipe",
  "recipes",
  "cook",
  "cooking",
  "sabaw",
  "ulam",
  "kain",
  "pagkain",
  "basketball",
  "celebrity",
  "coding",
  "crypto",
  "essay",
  "facebook",
  "flight",
  "game",
  "gaming",
  "google",
  "homework",
  "hotel",
  "javascript",
  "movie",
  "nba",
  "president",
  "python",
  "science",
  "stock",
  "stocks",
  "tiktok",
  "travel",
  "weather",
  "youtube",
  "artista",
  "pelikula",
  "presidente",
  "laro",
];

const isAssistantMetaQuestion = (question) =>
  includesAny(normalizeText(question), ASSISTANT_META_TERMS);

const hasOutsideScopeTopic = (question, relevantKnowledge = []) => {
  if (relevantKnowledge.length > 0) return false;
  const normalized = normalizeText(question);
  return includesAny(normalized, OUT_OF_SCOPE_TERMS);
};

const buildAssistantMetaAnswer = (question) => {
  const norm = normalizeText(question);
  if (includesAny(norm, ["tao ka ba", "tao ka", "human ka ba", "are you human", "are you a human"])) {
    return isTagalogQuestion(question)
      ? "Ako si KaagapAI, ang opisyal na Virtual Assistant ng Barangay Upper Mingading! Hindi man ako tao, laging handa at mabilis akong tumulong sa inyong mga kailangan sa ating barangay. 😊"
      : "I am KaagapAI, the official Virtual Assistant of Barangay Upper Mingading! While I am an AI assistant and not a human, I am always ready to help you with any barangay services. 😊";
  }
  if (includesAny(norm, ["gwapo ako", "gwapo ba ako", "maganda ako", "pogi ako", "gwapo", "maganda", "handsome"])) {
    return isTagalogQuestion(question)
      ? "Oo naman! Bukod sa magandang araw, laging positibo ang ating vibes dito sa Barangay Upper Mingading. 😊 Paano kita matutulungan sa ating barangay services ngayon?"
      : "Of course! Staying positive and bright is our culture here in Barangay Upper Mingading. 😊 How can I assist you with our barangay services today?";
  }
  return isTagalogQuestion(question)
    ? "Ako si KaagapAI, ang opisyal na Virtual Assistant ng Barangay Upper Mingading. Nandito ako para tumulong sa inyong mga document requests, anunsyo, mga programa sa kabuhayan/trabaho, serbisyong pangkalusugan, at iba pang katanungan tungkol sa ating barangay."
    : "I am KaagapAI, the official Virtual Assistant of Barangay Upper Mingading. I am here to assist you with document requests, announcements, livelihood programs, health services, and any inquiries regarding our barangay.";
};

const buildGeneralFallbackAnswer = (question) =>
  isTagalogQuestion(question)
    ? "Maaari ko kayong tulungan sa mga serbisyo ng Barangay Upper Mingading tulad ng document requests, anunsyo, livelihood programs, at pampamahalaang katanungan. Paano ko po kayo matutulungan ngayon?"
    : "I am here to assist you with Barangay Upper Mingading services such as document requests, announcements, livelihood programs, and local government inquiries. How can I help you today?";

const buildConversationalFallbackAnswer = (question) =>
  isTagalogQuestion(question)
    ? "Nandito po ako. Pwede mo akong kausapin tungkol sa barangay services, documents, announcements, livelihood/jobs, events, office info, profile, at iba pang resident concerns. Ano pong kailangan ninyo?"
    : "I am here for you. You can talk to me about barangay services, documents, announcements, livelihood/jobs, events, office info, profile, and other resident concerns. How can I assist you?";

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
    KNOWLEDGE_INTENT_TERMS.some((term) => includesNormalizedPhrase(normalizedQuestion, term))
  );
};

const scoreKnowledgeMatch = (question, item = {}) => {
  const normalizedQuestion = normalizeText(question);
  const searchable = normalizeText(
    [item.title, item.category, item.content].filter(Boolean).join(" ")
  );
  const normalizedTitle = normalizeText(item.title);
  const requestedRole = getRequestedKnowledgeRole(question);
  const words = getKnowledgeWords(question);
  let score = 0;

  if (normalizedTitle && normalizedQuestion.includes(normalizedTitle)) score += 8;
  if (normalizedTitle && normalizedTitle.includes(normalizedQuestion) && normalizedQuestion.length >= 5) score += 4;

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

    if (roleAppearsInKnowledge) score += 5;
    if (itemLooksOrganizational) score += 3;
  }

  words.forEach((word) => {
    const weight = KNOWLEDGE_ROLE_WORDS.has(word) ? 3 : 1;
    if (normalizeText(item.title).includes(word)) score += 3 + weight;
    else if (normalizeText(item.category).includes(word)) score += 2 + weight;
    else if (searchable.includes(word)) score += weight;
  });

  return score;
};

const getRelevantKnowledge = (question, knowledgeItems = []) =>
  knowledgeItems
    .map((item) => ({ item, score: scoreKnowledgeMatch(question, item) }))
    .filter(({ score }) => score >= 2 || (score >= 1 && hasKnowledgeIntent(question)))
    .sort((first, second) => second.score - first.score)
    .slice(0, 5)
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
  "of", "for", "to", "in", "on", "at", "with", "and", "or", "a", "an", "the", "is", "are", "what", "how", "who", "where", "when", "why",
  "ng", "sa", "at", "na", "o", "kay", "para", "ni", "mga", "ang", "ito", "ano", "paano", "saan", "kailan", "sino"
]);

const MIN_DOCUMENT_FOCUS_SCORE = 40;

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

  return getDocumentNames(item).reduce((bestScore, name) => {
    const normalizedName = normalizeText(name);
    if (!normalizedName) return bestScore;

    const nameWords = normalizedName.split(" ").filter(Boolean);
    const distinctWords = nameWords.filter((word) => !BROAD_DOCUMENT_WORDS.has(word));
    let score = 0;

    if (normalizedQuestion.includes(normalizedName)) {
      score = Math.max(score, 100 + nameWords.length);
    }

    if (distinctWords.length > 1) {
      const distinctPhrase = distinctWords.join(" ");
      if (normalizedQuestion.includes(distinctPhrase)) {
        score = Math.max(score, 70 + distinctWords.length);
      }
    }

    const matchedDistinctWords = distinctWords.filter((word) => questionWords.has(word));
    if (matchedDistinctWords.length > 0) {
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
  const normalized = normalizeText(question);
  const asksCount = includesAny(normalized, [
    "how many",
    "ilan",
    "count",
    "number of",
    "total",
    "kabuuan",
    "population",
  ]);
  const mentionsStatsTarget = includesAny(normalized, [
    "resident",
    "residents",
    "residente",
    "population",
    "senior",
    "senior citizen",
    "senior citizens",
    "pwd",
    "pwed",
    "disability",
    "disabled",
    "male",
    "female",
    "gender",
    "lalaki",
    "babae",
    "purok",
  ]);
  const mentionsSpecificStats = includesAny(normalized, [
    "population",
    "senior",
    "senior citizen",
    "senior citizens",
    "pwd",
    "pwed",
    "disability",
    "disabled",
    "male",
    "female",
    "gender",
    "lalaki",
    "babae",
    "purok",
  ]);

  return mentionsStatsTarget && (asksCount || mentionsSpecificStats);
};

const buildResidentStatsAnswer = (question, stats, language = "english") => {
  if (!stats?.loaded) {
    return language === "tagalog"
      ? "Hindi pa naka-load ang barangay resident statistics sa assistant. Paki-refresh ang dashboard at subukan ulit."
      : "Barangay resident statistics are not loaded in the assistant yet. Please refresh the dashboard and try again.";
  }

  const normalized = normalizeText(question).toLowerCase();
  
  // 1. Identify specific Purok
  let targetPurok = null;
  const purokKeys = Object.keys(stats.purokCounts || {});
  for (const p of purokKeys) {
    if (normalized.includes(p.toLowerCase())) {
      targetPurok = p;
      break;
    }
  }

  // 2. Identify generic vs specific queries
  const wantsFemale = normalized.includes("female") || normalized.includes("babae");
  const wantsMale = (normalized.includes("male") && !normalized.includes("female")) || normalized.includes("lalaki");
  const wantsBothGender = (normalized.includes("male") && normalized.includes("female")) || (normalized.includes("lalaki") && normalized.includes("babae"));
  const wantsGenericGender = (normalized.includes("gender") || normalized.includes("sex") || wantsBothGender) && !targetPurok;
  
  const wantsSenior = includesAny(normalized, ["senior", "elderly", "matanda"]);
  const wantsPwd = includesAny(normalized, ["pwd", "pwed", "disability", "disabled"]);
  const wantsGenericPurok = normalized.includes("purok") && !targetPurok && !wantsFemale && !wantsMale && !wantsSenior && !wantsPwd;

  // 3. Dynamic Filtering using Anonymized Raw Data
  let filtered = stats.anonymousResidents || [];
  let baseCount = filtered.length;
  let otherLabel = "Others (Overall)";

  if (targetPurok) {
    filtered = filtered.filter(r => r.purok.toLowerCase() === targetPurok.toLowerCase());
    baseCount = filtered.length; // Base count becomes the total of the purok
    otherLabel = `Others in ${targetPurok}`;
  }
  
  const hasSpecificFilter = targetPurok || (wantsFemale && !wantsBothGender) || (wantsMale && !wantsBothGender) || wantsSenior || wantsPwd;

  if (hasSpecificFilter && !wantsGenericGender && !wantsGenericPurok) {
    // Apply remaining filters
    if (wantsFemale && !wantsBothGender) filtered = filtered.filter(r => r.gender === "Female");
    if (wantsMale && !wantsBothGender) filtered = filtered.filter(r => r.gender === "Male");
    if (wantsSenior) filtered = filtered.filter(r => r.isSenior);
    if (wantsPwd) filtered = filtered.filter(r => r.isPWD);

    const totalCount = filtered.length;

    // Build Descriptive Label
    const labels = [];
    if (wantsFemale && !wantsBothGender) labels.push(language === "tagalog" ? "Babae" : "Female");
    if (wantsMale && !wantsBothGender) labels.push(language === "tagalog" ? "Lalaki" : "Male");
    if (wantsSenior) labels.push("Senior");
    if (wantsPwd) labels.push("PWD");
    if (targetPurok) labels.push(`sa Purok ${targetPurok}`);
    
    const labelStr = labels.join(" ") || "Residente";
    const text = language === "tagalog" 
      ? `Mayroong ${totalCount} na ${labelStr}.` 
      : `There are ${totalCount} ${labelStr}.`;

    // Single Purok request (no other filters)
    if (targetPurok && labels.length === 1) {
      const pTotal = stats.purokCounts?.[targetPurok] ?? (totalCount > 0 ? totalCount : 0);
      const overallTotal = stats.currentResidents || baseCount || pTotal;
      const text = language === "tagalog"
        ? `Batay sa ating opisyal na rekord ng barangay, ang **Purok ${targetPurok}** ay may kabuuang **${pTotal} residente**.`
        : `Based on our official barangay records, **Purok ${targetPurok}** currently has a total of **${pTotal} residents**.`;

      const chartData = (stats.purokCounts && Object.keys(stats.purokCounts).length > 0)
        ? stats.purokCounts
        : { [`Purok ${targetPurok}`]: pTotal, "Other Resident Total": Math.max(0, overallTotal - pTotal) };

      return `${text}\n\n[CHART:BAR:${JSON.stringify(chartData)}]`;
    }

    // Intersection request (e.g. Female in Purok) -> Compare against the local base
    const data = {
      [labelStr]: totalCount,
      [otherLabel]: Math.max(0, baseCount - totalCount)
    };
    return `${text}\n[CHART:BAR:${JSON.stringify(data)}]`;
  }

  // Fallbacks for generic requests
  if (wantsGenericGender || wantsBothGender) {
    const data = { "Male": stats.maleResidents || 0, "Female": stats.femaleResidents || 0 };
    if (stats.unknownGenderResidents) data["Not Set"] = stats.unknownGenderResidents;
    const text = language === "tagalog" ? "Narito ang breakdown ng gender ng mga residente:" : "Here is the gender breakdown of residents:";
    return `${text}\n[CHART:BAR:${JSON.stringify(data)}]`;
  }

  if (wantsGenericPurok) {
    const data = stats.purokCounts || {};
    const totalRes = stats.currentResidents || 0;
    const text = language === "tagalog" 
      ? `Kabuuan ng mga residente: ${totalRes.toLocaleString()}. Narito ang breakdown kada purok:` 
      : `Total residents: ${totalRes.toLocaleString()}. Here is the breakdown by purok:`;
    return `${text}\n[CHART:BAR:${JSON.stringify(data)}]`;
  }

  // Default to general totals bar chart with demographic breakdown
  const data = {
     "Male": stats.maleResidents || 0,
     "Female": stats.femaleResidents || 0,
     "Seniors": stats.seniorCitizens || 0,
     "PWD": stats.pwdResidents || 0
  };
  const totalRes = stats.currentResidents || 0;
  const text = language === "tagalog" 
    ? `Kabuuan ng mga residente sa Barangay Upper Mingading: ${totalRes.toLocaleString()}. Narito ang demographic breakdown:` 
    : `Total overall residents in Barangay Upper Mingading: ${totalRes.toLocaleString()}. Here is the demographic breakdown:`;
  return `${text}\n[CHART:BAR:${JSON.stringify(data)}]`;
};

const isDocumentHowToQuestion = (question) =>
  includesAny(question, [
    "how",
    "apply",
    "get",
    "request",
    "paano",
    "paanu",
    "panu",
    "kuhanin",
    "kumuha",
    "kuha",
    "mag request",
    "magrequest",
    "magrerequest",
  ]);

const isDocumentStatusQuestion = (question) =>
  includesAny(question, [
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
  ]);

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
  const lines = [
    `${language === "tagalog" ? "Pangalan" : "Name"}: ${official.name}`,
    `${language === "tagalog" ? "Posisyon" : "Position"}: ${official.position || "Not set"}`,
  ];

  if (official.committee) lines.push(`Committee: ${official.committee}`);
  if (official.focusArea) lines.push(`${language === "tagalog" ? "Focus" : "Focus area"}: ${official.focusArea}`);
  if (official.background) lines.push(`Background: ${official.background}`);
  if (official.contact) lines.push(`Contact: ${official.contact}`);
  if (official.email) lines.push(`Email: ${official.email}`);

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

      return wantsDetails
        ? formatOfficialDetail(selectedOfficial, language)
        : language === "tagalog"
          ? `Ang ${formatOrdinal(requestedIndex)} ${label} ng Barangay Upper Mingading ay ${selectedOfficial.name}.`
          : `The ${formatOrdinal(requestedIndex)} ${label} of Barangay Upper Mingading is ${selectedOfficial.name}.`;
    }

    if (wantsCount) {
      return language === "tagalog"
        ? `May ${matchingOfficials.length} ${label} na naka-save para sa Barangay Upper Mingading:\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`
        : `There ${matchingOfficials.length === 1 ? "is" : "are"} ${matchingOfficials.length} Barangay Upper Mingading ${label}${matchingOfficials.length === 1 ? "" : "s"}:\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`;
    }

    if (matchingOfficials.length === 1) {
      return wantsDetails
        ? formatOfficialDetail(matchingOfficials[0], language)
        : language === "tagalog"
          ? `Ang ${label} ng Barangay Upper Mingading ay ${matchingOfficials[0].name}.`
          : `The ${label} of Barangay Upper Mingading is ${matchingOfficials[0].name}.`;
    }

    return language === "tagalog"
      ? `Ang mga ${label} ng Barangay Upper Mingading ay:\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`
      : `The Barangay Upper Mingading ${label} members are:\n${matchingOfficials.map(formatOfficialSummaryLine).join("\n")}`;
  }

  if (wantsCount) {
    return language === "tagalog"
      ? `May ${activeOfficials.length} active official profile(s) para sa Barangay Upper Mingading.`
      : `There are ${activeOfficials.length} active Barangay Upper Mingading official profile(s).`;
  }

  const captain = activeOfficials.find((official) => getOfficialRole(official) === "captain");
  const secretary = activeOfficials.find((official) => getOfficialRole(official) === "secretary");
  const treasurer = activeOfficials.find((official) => getOfficialRole(official) === "treasurer");
  const skChairperson = activeOfficials.find((official) => getOfficialRole(official) === "skChairperson");
  const kagawads = getOrganizationOfficialsForRole(activeOfficials, "kagawad");
  const lines = [
    language === "tagalog"
      ? "Ito ang kasalukuyang barangay officials:"
      : "Here are the current barangay officials:",
  ];

  if (captain) lines.push(`Captain: ${formatOfficialName(captain)}`);
  if (secretary) lines.push(`Secretary: ${formatOfficialName(secretary)}`);
  if (treasurer) lines.push(`Treasurer: ${formatOfficialName(treasurer)}`);
  if (skChairperson) lines.push(`SK Chairman: ${formatOfficialName(skChairperson)}`);
  if (kagawads.length) lines.push(`Kagawad: ${kagawads.map((official) => official.name).join(", ")}`);

  return lines.join("\n\n");
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

const findSmartAnswerInKnowledge = (question, relevantKnowledge, language = "tagalog") => {
  if (!relevantKnowledge || !relevantKnowledge.length) return "";

  const normQ = normalizeText(question);
  const qWords = normQ.split(" ").filter((w) => w.length >= 2);

  for (const item of relevantKnowledge) {
    const content = item.content || "";
    if (!content) continue;

    // Pattern 1: Quoted pairs e.g. "tanong" "sagot"
    const quoteRegex = /"([^"]+)"\s*[:\-\=]?\s*"([^"]+)"/g;
    let match;
    while ((match = quoteRegex.exec(content)) !== null) {
      const qText = match[1];
      const aText = match[2];
      const normKey = normalizeText(qText);
      if (
        normKey &&
        (normQ.includes(normKey) ||
          normKey.includes(normQ) ||
          (qWords.length > 0 && qWords.every((w) => normKey.includes(w))))
      ) {
        return aText.trim();
      }
    }

    // Pattern 2: Explicit Key-Value/QA lines (e.g. Tanong: ... Sagot: ... or Q: ... A: ...)
    const lines = content.split(/\n+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const qaMatch = trimmed.match(
        /(?:tanong|question|q)\s*[:\-]\s*(.*?)\s*(?:sagot|answer|a)\s*[:\-]\s*(.*)/i
      );
      if (qaMatch) {
        const qText = qaMatch[1];
        const aText = qaMatch[2];
        const normKey = normalizeText(qText);
        if (
          normKey &&
          (normQ.includes(normKey) ||
            normKey.includes(normQ) ||
            (qWords.length > 0 && qWords.every((w) => normKey.includes(w))))
        ) {
          return aText.trim();
        }
      }
    }

    // Pattern 3: Direct matching lines/sentences containing user question keywords
    const sentences = content.split(/(?<=[.!?])\s+|\n+/);
    for (const sentence of sentences) {
      const normS = normalizeText(sentence);
      if (normS && qWords.length > 0 && qWords.every((w) => normS.includes(w))) {
        let cleanSentence = sentence.trim();
        const normTitle = normalizeText(item.title);
        if (normTitle && normalizeText(cleanSentence).startsWith(normTitle)) {
          cleanSentence = cleanSentence.slice(item.title.length).replace(/^[\s:\-\=]+/, "").trim();
        }
        if (cleanSentence) return cleanSentence;
      }
    }
  }

  // Fallback: Clean top item's content without raw labels or bullet prefixes
  const topItem = relevantKnowledge[0];
  let cleanContent = (topItem.content || topItem.title || "").trim();
  const normTitle = normalizeText(topItem.title);
  if (normTitle && normalizeText(cleanContent).startsWith(normTitle)) {
    cleanContent = cleanContent.slice(topItem.title.length).replace(/^[\s:\-\=]+/, "").trim();
  }

  return cleanContent;
};

const buildKnowledgeSummaryAnswer = (relevantKnowledge, language, question = "") => {
  const smartAnswer = findSmartAnswerInKnowledge(question, relevantKnowledge, language);
  if (smartAnswer) return smartAnswer;

  const topItem = relevantKnowledge[0];
  return (topItem?.content || topItem?.title || "").trim();
};

const buildMissingKnowledgeAnswer = (question, language) => {
  return language === "tagalog"
    ? "Para sa eksaktong detalye ukol sa katanungang ito, maaari po kayong sumangguni o bumisita sa ating Barangay Upper Mingading Office sa oras ng opisina."
    : "For specific details regarding this request, please inquire directly at our Barangay Upper Mingading Office during office hours.";
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

Answer directly, naturally, and warmly like a PRO using your internal knowledge:`;

    const result = await generateText(prompt, {
      systemInstruction:
        "You are KaagapAI, a highly intelligent, friendly, and professional virtual assistant for Barangay Upper Mingading. STRICT LANGUAGE RULE: If the user asks in English, reply 100% in English. If the user asks in Tagalog or Taglish, reply 100% in fluent, polite Tagalog. NEVER say 'Based on AI', 'Based on admin', or 'Batay sa saved knowledge'. NEVER tell the user to 'Log in' or 'Sign in'—the resident is ALREADY logged in to their dashboard! Start instructions directly with step 1: Click 'Request Document' on your dashboard. Be extremely direct, concise, and friendly.",
      temperature: 0.6,
      maxOutputTokens: 2048,
    });

    return stripSuggestedQuestions(extractGeminiText(result) || fallback);
  } catch (error) {
    console.warn("AI knowledge answer unavailable, using smart local knowledge extractor:", error.message);
    return fallback;
  }
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
  const organizationAnswer = buildOrganizationAnswer(question, organizationOfficials, language);
  const wantsResidentStats = isResidentStatsQuestion(question);
  const wantsDocuments = Boolean(documentFocus) || includesAny(question, [
    "document",
    "dokumento",
    "clearance",
    "cedula",
    "certificate",
    "permit",
    "request",
    "status",
    "requirements",
    "requirement",
    "fee",
    "processing",
    "kuhanin",
    "kumuha",
    "paano",
  ]);
  const wantsLivelihood = includesAny(question, ["job", "jobs", "livelihood", "training", "program", "opportunity", "trabaho"]);
  const wantsAnnouncements = includesAny(question, ["announcement", "announcements", "news", "update", "event", "events", "activity", "anunsyo", "balita"]);
  const wantsProfile = includesAny(question, ["profile", "address", "purok", "name", "account", "email", "pangalan", "tirahan"]);
  const wantsOfficeInfo = isOfficeInfoQuestion(question);
  const wantsCedula = isCedulaQuestion(question);
  const wantsAnniversary = isAnniversaryQuestion(question);
  const wantsKnowledge = hasKnowledgeIntent(question);
  const requestedStatuses = getRequestedStatuses(question);

  const lines = [];

  // Intent detection helper for explicit dashboard requests ONLY
  const isExplicitDashboardRequest = includesAny(normalizeText(question), [
    "dashboard",
    "dashboard summary",
    "my dashboard",
    "statistics",
    "summary",
    "overview",
    "system status",
    "system summary",
  ]);

  // Handle explicit dashboard requests
  if (isExplicitDashboardRequest) {
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

  // Gratitude Intent (Check FIRST before greetings)
  if (isGratitudeMessage(question)) {
    return buildGratitudeAnswer(question);
  }

  // Greetings Intent
  if (isGreetingMessage(question)) {
    return language === "tagalog"
      ? "Mabuhay! Ako si KaagapAI, ang iyong Barangay Assistant. Paano kita matutulungan ngayon? Maaari mo akong tanungin tungkol sa pag-request ng dokumento, mga serbisyo ng barangay, reklamo, anunsyo, mga programa sa kabuhayan/trabaho, serbisyong pangkalusugan, at iba pa."
      : "Hello! I'm KaagapAI, your Barangay Assistant. How can I help you today? You can ask about document requests, barangay services, complaints, announcements, livelihood programs, health services, and more.";
  }

  // History / Kasaysayan & Political Leadership Intent
  const isHistory = includesAny(normalizedQ || normalizeText(question), [
    "history", "kasaysayan", "pinagmulan", "origin", "political", "pulitika", "politika",
    "pinuno", "leader", "leaders", "punong barangay", "kapitan", "teniente", "dating kapitan",
    "nakaraang kapitan", "previous captain", "past captain", "past leaders", "accomplishments",
    "catenas", "bolivar", "cari", "capio", "calician", "caponpon"
  ]);
  if (isHistory) {
    return buildPoliticalHistoryAnswer(question, language);
  }

  // Waste Management Intent (Checked before complaints to handle garbage collection queries containing 'basura')
  const isWaste = includesAny(normalizedQ, [
    "garbage", "waste", "hakot", "mrf", "recycling", "recyclables", "collection", "koleksyon"
  ]) || (
    normalizedQ.includes("basura") &&
    includesAny(normalizedQ, ["kailan", "schedule", "oras", "koleksyon", "hakot", "araw", "daan", "daanan", "tapon", "ipon", "kuha", "kukuha"]) &&
    !includesAny(normalizedQ, ["reklamo", "complaint", "report", "amoy", "mabaho", "kapitbahay", "kalat", "nagkakalat", "nagtatapon"])
  );
  if (isWaste) {
    return "Please contact the Barangay Office for updated garbage collection schedules and waste management policies.";
  }

  // Complaints Intent
  const isComplaint = includesAny(normalizedQ, [
    "complaint", "reklamo", "report", "noisy", "ingay", "dumping", "basura",
    "violence", "streetlight", "drainage", "kanal", "neighbor", "kapitbahay",
    "disturbance", "public disturbance", "anonymous"
  ]);
  if (isComplaint) {
    if (normalizedQ.includes("anonymous")) {
      return "Residents may contact or visit the Barangay Office to inquire about anonymous complaint filing procedures or call us at 09306259795.";
    }
    return "Residents may submit complaints through the Complaint section of the Resident Portal or directly at the Barangay Office.\n\nFor emergencies, advise contacting the appropriate emergency authorities or call us at 09306259795.";
  }

  // Disaster Preparedness Intent
  const isDisaster = includesAny(normalizedQ, [
    "disaster", "typhoon", "bagyo", "baha", "flood", "evacuation", "calamity", "emergency", "relief"
  ]);
  if (isDisaster) {
    return "I cannot verify current disaster alerts at the moment. For emergencies, please stay tuned to official government weather broadcasts or contact local disaster management and the Barangay Office.";
  }

  // Health Services Intent
  const isHealth = includesAny(normalizedQ, [
    "health", "kalusugan", "doctor", "doktor", "bakuna", "vaccine", "medicine", "gamot", "clinic", "health center", "health services"
  ]);
  if (isHealth) {
    return language === "tagalog"
      ? "Ang serbisyo ng Barangay Health Center ay bukas mula Lunes hanggang Biyernes, 8:30 AM hanggang 4:00 PM. Pakiusap bumisita sa Barangay Health Center para sa inyong konsultasyon at pangkalusugang kailangan.\n\nPara sa mga emerhensya, mangyaring tumawag sa ating opisyal na numero: 09306259795."
      : "Barangay Health Center services are available from Monday to Friday, 8:30 AM - 4:00 PM. Please visit the Barangay Health Center for check-ups and medical services.\n\nFor emergencies, please call our official Barangay hotline at 09306259795.";
  }

  // Senior Citizen Services Intent
  const isSenior = includesAny(normalizedQ, [
    "senior", "senior citizen", "pension", "elderly"
  ]);
  if (isSenior) {
    return "Please visit or contact the Barangay Office for assistance regarding Senior Citizen registration, benefits, and pension inquiries.";
  }

  // SK Youth Services Intent
  const isSK = includesAny(normalizedQ, [
    "sk", "sangguniang kabataan", "youth", "sports", "liga", "scholarship"
  ]);
  if (isSK) {
    return "Please contact the Sangguniang Kabataan (SK) officials or visit the Barangay Office for information on sports, youth programs, and scholarships.";
  }

  // PWD / Solo Parent / Women Services Intent
  const isSpecialGroup = includesAny(normalizedQ, [
    "pwd", "solo parent", "vawc", "women", "babae"
  ]);
  if (isSpecialGroup) {
    return "Please visit or contact the Barangay Office for inquiries regarding PWD ID, Solo Parent benefits, and Women's assistance (VAWC).";
  }

  // Reservations Intent
  const isReservation = includesAny(normalizedQ, [
    "reservation", "reserve", "book", "booking", "rent", "renta", "hiram", "pahiram", "reserba", "pag-book", "mag-book", "ipareserba", "manghiram"
  ]) || (
    includesAny(normalizedQ, ["covered court", "court", "gym", "multipurpose hall", "venue"]) &&
    !includesAny(normalizedQ, ["oras", "bukas", "sarado", "schedule", "hours", "close", "open", "time"])
  );
  if (isReservation) {
    return "Please visit or contact the Barangay Office to check availability and book barangay venues like the Covered Court or Barangay Hall.";
  }

  // Cedula Intent
  if (wantsCedula) {
    return buildCedulaAnswer(question);
  } else if (wantsAnniversary) {
    return buildAnniversaryAnswer(question);
  } else if (wantsOfficeInfo) {
    return buildOfficeInfoAnswer(question);
  } else if (wantsResidentStats) {
    return buildResidentStatsAnswer(question, residentStats, language);
  } else if (organizationAnswer) {
    return organizationAnswer;
  } else if (relevantKnowledge.length > 0 && !wantsDocuments) {
    return answerFromKnowledge(question, relevantKnowledge, context, language);
  } else if (wantsDocuments) {
    const uniqueTemplates = dedupeDocumentTemplates(documentTemplates);
    const filteredRequests = documentFocus ? documentFocus.matchingRequests : requests;
    const statusFilteredRequests = requestedStatuses.length
      ? filteredRequests.filter((request) => requestedStatuses.includes(request.status))
      : filteredRequests;
    const filteredTemplates = documentFocus ? documentFocus.templates : uniqueTemplates;
    const wantsCount = isDocumentRequestCountQuestion(question);
    const wantsStatus = requestedStatuses.length > 0 || isDocumentStatusQuestion(question) || wantsCount;
    const wantsReqs = includesAny(normalizedQ, [
      "requirement", "requirements", "kailangan", "rekitos", "pangangailangan",
      "anung requirement", "ano requirement", "what requirement", "what are the requirements", "what is the requirements", "anu requirement", "anung requirements"
    ]) || (
      includesAny(normalizedQ, ["kailangan", "requirement", "requirements"]) &&
      includesAny(normalizedQ, ["clearance", "permit", "certificate", "dokumento", "document", "sertipiko", "kuha", "kumuha"])
    );
    const wantsHowTo = !wantsReqs && isDocumentHowToQuestion(question) && !wantsStatus;
    const wantsDetails = !wantsReqs && isDocumentDetailQuestion(question);
    const wantsFee = includesAny(normalizedQ, ["magkano", "magkanu", "bayad", "singil", "fee", "fees", "cost", "price", "magbayad"]);

    if (normalizedQ.includes("online")) {
      return "Yes. Residents can submit document requests through the Resident Portal. After approval, you will receive a notification when your document is ready for pickup.";
    }

    if (normalizedQ.includes("processing time")) {
      return "Processing time depends on the document type and barangay approval. Please monitor your request status in the Resident Portal.";
    }

    if (normalizedQ.includes("someone else") || normalizedQ.includes("representative") || normalizedQ.includes("claim")) {
      return "Yes, if permitted by barangay policy. The representative may be required to present an authorization letter and valid identification.";
    }

    if (wantsReqs) {
      const docName = documentFocus ? documentFocus.label : "Barangay Clearance/Permit";
      return language === "tagalog"
        ? `Ang mga pangunahing kailangan (requirements) para sa pagkuha ng **${docName}** ay:\n1. **Cedula (Community Tax Certificate)**\n2. **Valid Government ID**\n3. **₱50 Processing Fee**`
        : `The primary requirements for securing a **${docName}** are:\n1. **Cedula (Community Tax Certificate)**\n2. **Valid Government ID**\n3. **₱50 Processing Fee**`;
    }

    if (!documentFocus && wantsFee) {
      return language === "tagalog"
        ? "Ang karaniwang bayad para sa mga dokumento sa barangay (tulad ng Barangay Clearance o Certificate of Residency) ay ₱50.00 pesos. Ang Certificate of Indigency naman ay walang bayad (Free). Mangyaring magbayad sa Barangay Treasurer."
        : "Standard barangay documents (such as Barangay Clearance or Certificate of Residency) have a processing fee of ₱50.00 pesos. The Certificate of Indigency is free of charge. All payments should be settled directly with the Barangay Treasurer.";
    }

    if (documentFocus) {
      if (wantsFee) {
        const docLabel = documentFocus.label.toLowerCase();
        if (docLabel.includes("residency") || docLabel.includes("residente") || docLabel.includes("residence")) {
          return language === "tagalog"
            ? "Ang processing fee para sa Certificate of Residency ay ₱50.00 pesos. Maaari ninyo itong bayaran sa Barangay Treasurer."
            : "The processing fee for the Certificate of Residency is ₱50.00 pesos. You can pay this at the Barangay Treasurer's office.";
        }
        if (docLabel.includes("indigency") || docLabel.includes("indigent")) {
          return language === "tagalog"
            ? "Ang Certificate of Indigency ay walang bayad (Free) para sa lahat ng kwalipikadong residente ng barangay."
            : "The Certificate of Indigency is free of charge for all qualified barangay residents.";
        }
        if (docLabel.includes("clearance")) {
          return language === "tagalog"
            ? "Ang bayad para sa Barangay Clearance ay ₱50.00 pesos. Mangyaring magbayad sa Barangay Treasurer pagkuha ng dokumento."
            : "The processing fee for a Barangay Clearance is ₱50.00 pesos. Please settle this with the Barangay Treasurer upon claiming.";
        }
        // Fallback to template fee if exists
        const feeTemplate = filteredTemplates.find(t => t.fee);
        if (feeTemplate && feeTemplate.fee) {
          return language === "tagalog"
            ? `Ang bayad para sa ${documentFocus.label} ay ${feeTemplate.fee}.`
            : `The fee for the ${documentFocus.label} is ${feeTemplate.fee}.`;
        }
        return language === "tagalog"
          ? `Ang bayad para sa ${documentFocus.label} ay karaniwang ₱50.00 pesos. Maaari ninyong kumpirmahin ang eksaktong halaga sa Barangay Treasurer.`
          : `The processing fee for the ${documentFocus.label} is typically ₱50.00 pesos. You can confirm the exact rate with the Barangay Treasurer.`;
      }
      if (wantsStatus && !wantsDetails) {
        lines.push(
          requestedStatuses.length
            ? language === "tagalog"
              ? `Mayroon kang ${statusFilteredRequests.length} ${requestedStatuses.join("/")} ${documentFocus.label} request(s).`
              : `You have ${statusFilteredRequests.length} ${requestedStatuses.join("/")} ${documentFocus.label} request(s).`
            : language === "tagalog"
              ? `Mayroon kang ${statusFilteredRequests.length} ${documentFocus.label} request(s).`
              : `You have ${statusFilteredRequests.length} ${documentFocus.label} request(s).`
        );
        lines.push(
          statusFilteredRequests.slice(0, 6).map((request, index) => formatRequest(request, index, language)).join("\n") ||
            `I can't check your request status at the moment. Please open **My Document Requests** in your account.`
        );
      } else if (wantsHowTo || wantsDetails) {
        const isFree = documentFocus.label.toLowerCase().includes("indigency");
        const feeText = isFree ? (language === "tagalog" ? "Libre (Free)" : "Free") : "₱50.00";
        return language === "tagalog"
          ? `Para mag-request ng ${documentFocus.label}:\n\n1. I-click ang "Request Document" button sa iyong dashboard.\n2. Piliin ang "${documentFocus.label}".\n3. Punan ang layunin (purpose) at i-submit.\n\nKailangan: Valid ID & Cedula\nBayad: ${feeText}\nPagproseso: 1 Araw`
          : `To request a ${documentFocus.label}:\n\n1. Click the "Request Document" button on your dashboard.\n2. Select "${documentFocus.label}".\n3. Fill in the purpose and submit.\n\nRequirements: Valid ID & Cedula\nFee: ${feeText}\nProcessing Time: 1 Day`;
      } else {
        lines.push(language === "tagalog" ? `Impormasyon tungkol sa ${documentFocus.label}:` : `${documentFocus.label} information:`);
      }

      if (!(wantsStatus && !wantsDetails)) {
        lines.push("");
        lines.push(language === "tagalog" ? "Mga kinakailangan at bayarin:" : "Requirements and fees:");
        lines.push(
          filteredTemplates.slice(0, 3).map(formatTemplate).join("\n") ||
            (language === "tagalog"
              ? "Mangyaring bisitahin o makipag-ugnayan sa Barangay Office upang kumpirmahin ang kasalukuyang mga kinakailangan at bayad sa pagproseso."
              : "Please visit or contact the Barangay Office to confirm the current requirements and processing fee.")
        );
        if (statusFilteredRequests.length > 0) {
          lines.push("");
          lines.push(language === "tagalog" ? `Katayuan ng iyong request para sa ${documentFocus.label}:` : `Your ${documentFocus.label} request status:`);
          lines.push(
            statusFilteredRequests.slice(0, 4).map((request, index) => formatRequest(request, index, language)).join("\n")
          );
        }
      }
    } else {
      if (wantsStatus) {
        lines.push(
          requestedStatuses.length
            ? `You have ${statusFilteredRequests.length} ${requestedStatuses.join("/")} document request(s).`
            : `You have ${requests.length} document request(s).`
        );
        lines.push(
          statusFilteredRequests.slice(0, 6).map((request, index) => formatRequest(request, index, language)).join("\n") ||
            "I can't check your request status at the moment. Please open **My Document Requests** in your account."
        );
        lines.push("");
      } else {
        return language === "tagalog"
          ? `Para mag-request ng mga dokumento sa barangay:\n\n1. I-click ang "Request Document" button sa iyong dashboard.\n2. Piliin ang kailangang dokumento.\n3. Punan ang mga detalye at i-submit.\n\nKailangan: Valid ID & Cedula`
          : `To request documents through the Resident Portal:\n\n1. Click the "Request Document" button on your dashboard.\n2. Select your document.\n3. Fill out the details and submit.\n\nRequirements: Valid ID & Cedula`;
      }
    }

    return stripSuggestedQuestions(lines.join("\n"));
  } else if (wantsLivelihood) {
    if (opportunities.length > 0) {
      lines.push(`There are ${opportunities.length} open livelihood/job opportunity record(s):`);
      lines.push(opportunities.slice(0, 8).map((post, index) => formatOpportunity(post, index, language)).join("\n"));
      return stripSuggestedQuestions(lines.join("\n"));
    }
    return "There are currently no available livelihood programs.";
  } else if (wantsAnnouncements) {
    if (announcements.length > 0) {
      lines.push(`There are ${announcements.length} published announcement(s):`);
      lines.push(announcements.slice(0, 8).map((announcement, index) => formatAnnouncement(announcement, index, language)).join("\n"));
      return stripSuggestedQuestions(lines.join("\n"));
    }
    return "There are currently no announcements available.";
  } else if (wantsProfile) {
    lines.push(`Profile summary for ${resident?.full_name || "Resident"}:`);
    lines.push(`Purok: ${resident?.purok || "Not set"}`);
    lines.push(`Username: ${resident?.username || resident?.portal_username || "Not set"}`);
    lines.push(`Address: ${resident?.address || "Not set"}`);
    lines.push(`Status: ${resident?.status || "Not set"}`);
    return stripSuggestedQuestions(lines.join("\n"));
  } else if (wantsKnowledge) {
    return buildMissingKnowledgeAnswer(question, language);
  }

  // Outside Scope Check
  if (isOutsideBarangayScope(question)) {
    return language === "tagalog"
      ? "Nakatutok ako sa pagtulong sa mga residente para sa Barangay Upper Mingading services, community programs, dokumento, anunsyo, at iba pang katanungang pampamahalaan. Kung may kinalaman po sa barangay ang inyong tanong, ikalulugod ko kayong tulungan."
      : "I specialize in assisting residents with Barangay Upper Mingading services, community programs, documents, announcements, and local government concerns. If your question is related to barangay services, I'd be happy to help.";
  }

  // Requirements for permits, clearances, certificates
  const isRequirementQuestion = (includesAny(normalizedQ, [
    "requirement", "requirements", "kailangan", "pangangailangan",
    "maka kuha", "kumuha", "paano kumuha", "ano kailangan", "paano makakuha"
  ]) && includesAny(normalizedQ, ["permit", "permits", "clearance", "clearances", "certificate", "dokumento", "document", "documents", "sertipiko"])) ||
  (normalizedQ.includes("requirement") || normalizedQ.includes("kailangan"));

  if (isRequirementQuestion && includesAny(normalizedQ, ["permit", "clearance", "certificate", "dokumento", "document", "sertipiko"])) {
    return language === "tagalog"
      ? "Ang mga pangunahing kailangan (requirements) para sa pagkuha ng barangay clearance, permit, o sertipiko ay:\n1. **Cedula (Community Tax Certificate)**\n2. **Valid Government ID**\n3. **₱50 Processing Fee**"
      : "The primary requirements for securing a barangay clearance, permit, or certificate are:\n1. **Cedula (Community Tax Certificate)**\n2. **Valid Government ID**\n3. **₱50 Processing Fee**";
  }

  // Government Assistance Intents (Educational, Burial, Medical)
  const isEducationalAssistance = includesAny(normalizedQ, ["educational", "edukasyon", "aral", "pa-aral", "school assistance", "tuition", "aaral"]);
  if (isEducationalAssistance) {
    const closing = getDynamicClosingStatement(language);
    return language === "tagalog"
      ? `Ang educational assistance programs ay maaaring magkaroon ng iba't ibang requirements depende sa sponsoring government agency o barangay program. Karaniwang humihingi ng valid ID at supporting documents. Ang eligibility at panahon ng pag-apply ay nag-iiba.\n\n${closing}`
      : `Educational assistance programs may have different requirements depending on the sponsoring government agency or barangay program. Applicants are typically required to submit valid identification and supporting documents. Eligibility and application periods may vary.\n\n${closing}`;
  }

  const isBurialAssistance = includesAny(normalizedQ, ["burial", "libing", "burol", "funeral assistance"]);
  if (isBurialAssistance) {
    const closing = getDynamicClosingStatement(language);
    return language === "tagalog"
      ? `Nagmumula sa local government unit o barangay ang tulong para sa burol/libing ng kwalipikadong residente. Nag-iiba ang requirements at eligibility depende sa lokal na polisiya at available na programa.\n\n${closing}`
      : `Some local government units provide burial assistance to qualified residents. Requirements and eligibility vary depending on local policies and available programs.\n\n${closing}`;
  }

  const isMedicalAssistance = includesAny(normalizedQ, ["medical assistance", "tulong sa gamot", "ospital", "hospital assistance", "pagpapagamot"]);
  if (isMedicalAssistance) {
    const closing = getDynamicClosingStatement(language);
    return language === "tagalog"
      ? `Ang medical assistance programs ay karaniwang nangangailangan ng valid identification at supporting medical documents (katulad ng medical abstract o reseta). Ang availability nito ay nakadepende sa kasalukuyang programa ng barangay o pamahalaan.\n\n${closing}`
      : `Medical assistance programs may require valid identification and supporting medical documents. The availability of assistance depends on current barangay or government programs.\n\n${closing}`;
  }

  // Out of Scope / Unrelated Questions Handler
  const isUnrelatedTopic = isOutsideBarangayScope(normalizedQ) || includesAny(normalizedQ, OUT_OF_SCOPE_TERMS);
  if (isUnrelatedTopic) {
    return language === "tagalog"
      ? "Paumanhin, wala po akong impormasyon ukol diyan dahil ang aking kaalaman ay para lamang sa mga serbisyo at programa ng ating Barangay Upper Mingading. Handa po akong tumulong sa inyo ukol sa ating barangay clearances, document requests, anunsyo, at iba pang lokal na serbisyo!"
      : "I apologize, but I don't have information regarding that topic as I am specifically trained to assist with Barangay Upper Mingading services and inquiries. I am more than willing to help you with barangay clearances, document requests, announcements, and local services!";
  }

  // Default Fallback for Unknown / General Questions (NEVER return dashboard summary!)
  const defaultClosing = getDynamicClosingStatement(language);
  return language === "tagalog"
    ? "Para sa mga partikular na katanungan tungkol sa barangay o pampamahalaang serbisyo, inirerekomenda ang pag-inquire sa ating opisina.\n\n" + defaultClosing
    : "For specific questions regarding barangay or local government services, inquiring directly with our office is recommended.\n\n" + defaultClosing;
}

export async function askResidentAssistant(question, context = {}) {
  const trimmedQuestion = question?.trim();
  if (!trimmedQuestion) return "";

  const normalizedQ = normalizeText(trimmedQuestion);
  const language = isTagalogQuestion(trimmedQuestion) ? "tagalog" : "english";

  // Check History / Political Leadership Intent FIRST
  const isHistory =
    includesAny(normalizedQ, [
      "history", "kasaysayan", "pinagmulan", "origin", "political", "pulitika", "politika",
      "first captain", "1st captain", "unang kapitan", "unang pinuno", "first leader",
      "1st barangay captain", "first barangay captain", "dating kapitan", "nakaraang kapitan",
      "previous captain", "past captain", "past leaders", "accomplishments",
      "catenas", "bolivar", "cari", "capio", "calician", "caponpon"
    ]) ||
    (
      includesAny(normalizedQ, ["captain", "kapitan", "leader", "pinuno"]) &&
      includesAny(normalizedQ, ["first", "1st", "una", "unang", "dating", "nakaraan", "past", "previous", "all", "lahat", "who", "sino", "list", "talaan"])
    );

  if (isHistory) {
    return buildPoliticalHistoryAnswer(trimmedQuestion, language);
  }

  // Only fetch fresh stats if not already provided in context to avoid unnecessary network delay
  if (!context.residentStats?.loaded) {
    try {
      const freshStats = await fetchResidentStats();
      context.residentStats = freshStats;
    } catch (error) {
      console.error("Failed to dynamically fetch fresh stats for AI prompt:", error);
    }
  }

  return queryGeminiWithRichContext(trimmedQuestion, context);
}

async function queryGeminiWithRichContext(question, context = {}) {
  try {
    const {
      announcements = [],
      documentTemplates = [],
      knowledgeItems = [],
      opportunities = [],
      organizationOfficials = [],
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

    const activeOfficials = getActiveOrganizationOfficials(organizationOfficials);
    const officialsStr = activeOfficials
      .map(o => `- Name: ${o.name}, Position: ${o.position}, Committee: ${o.committee || 'None'}`)
      .join("\n") || "No officials loaded.";

    const templatesStr = dedupeDocumentTemplates(documentTemplates)
      .map(t => `- Document: ${t.template_name || t.document_type}, Requirements: ${t.requirements || 'Valid ID'}, Processing Time: ${t.processing_time || '1 day'}, Fee: ${t.fee || '50 pesos'}`)
      .join("\n") || "No templates loaded.";

    const requestsStr = requests
      .map((r, i) => `- ${r.document_type} (Status: ${r.status}, Requested: ${formatDate(r.created_at)})`)
      .join("\n") || "No requests submitted yet.";

    const knowledgeStr = [
      OFFICIAL_ROLES_KNOWLEDGE_TEXT,
      ...knowledgeItems.map((k, i) => `- Title: ${k.title}\n  Content: ${k.content}`)
    ].join("\n\n");

    const settings = getSystemSettings();
    const officeHours = settings.officeHours || "Monday to Friday, 8:00 AM - 5:00 PM";
    const contactEmail = settings.officeEmail || "not set";
    const contactPhone = settings.officePhone || "not set";

    const rawDataStr = residentStats?.anonymousResidents 
      ? JSON.stringify(residentStats.anonymousResidents) 
      : "[]";

    const isTagalog = isTagalogQuestion(question);
    const detectedLang = isTagalog ? "TAGALOG" : "ENGLISH";

    const systemInstructionText = `You are KaagapAI, the official AI Virtual Assistant for Barangay Upper Mingading Resident Management System.
Your purpose is STRICTLY to assist residents with questions related to Barangay Upper Mingading services, local government programs, public assistance, community concerns, and resident information.

MANDATORY LANGUAGE MATCHING RULE (STRICT - PANEL EVALUATION CRITICAL):
- DETECTED USER LANGUAGE: ${detectedLang}
- YOU MUST ALWAYS REPLY 100% IN THE EXACT SAME LANGUAGE AS THE USER'S QUESTION:
  * IF USER ASKS IN ENGLISH -> YOU MUST REPLY 100% IN CLEAR, GRAMMATICALLY SOUND, PROFESSIONAL ENGLISH. DO NOT mix or include Tagalog/Filipino words.
  * IF USER ASKS IN TAGALOG / FILIPINO / TAGLISH -> YOU MUST REPLY 100% IN COURTEOUS, NATURAL, AND POLITE TAGALOG (use respectful words like "po" and "opo").
  * IF USER ASKS IN BISAYA / CEBUANO -> YOU MUST REPLY IN NATURAL BISAYA/CEBUANO OR POLITE TAGALOG.
- STRICT PROHIBITION: NEVER respond in Tagalog to an English question, and NEVER respond in English to a Tagalog question!

FAST, CONCISE & ACCURATE RESPONSES:
- Answer the user's question directly and concisely without unnecessary filler or delays.
- Keep explanations clear and actionable.

STRICT OUT-OF-SCOPE RULE:
If the user asks about non-barangay topics (such as cooking recipes, general games, movies, non-barangay coding, or global trivia):
- Refuse politely in the matching language and redirect them to barangay services.
- Tagalog Refusal Example: "Pasensya na po, ako ay nakatutok lamang sa pagtulong sa mga serbisyo, dokumento, anunsyo, at mga programa ng Barangay Upper Mingading. Paano ko po kayo matutulungan sa ating barangay services ngayon?"
- English Refusal Example: "I apologize, but I specialize exclusively in assisting with Barangay Upper Mingading services, documents, announcements, and community programs. How may I assist you with our barangay services today?"

MANDATORY CHART RULE FOR ALL TOTAL / COUNT INQUIRIES:
Whenever the user asks for ANY population, purok count, senior count, PWD count, or document count:
- Provide the exact count text AND ALWAYS APPEND A VALID BAR CHART TAG at the end!
- Example: "Based on our official barangay records, **Purok Malipayon** currently has a total of **340 residents**.\n[CHART:BAR:{\"Purok Malipayon\":340,\"Other Residents\":1200}]" (Use the real statistics from the provided data).

STRICT NO "LOG IN" STEP RULE:
- NEVER tell the user to "Log in to your account" or "Sign in"! The resident is ALREADY LOGGED IN to their dashboard. Start step 1 directly with: "1. Click 'Request Document' on your dashboard."

ELOQUENT TONE & NARRATION:
- Use complete, well-formed sentences so text-to-speech voice narration sounds graceful, human, and crystal clear.`;

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

Barangay Officials:
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

Follow the System Instructions strictly. Language MUST match the user question (${detectedLang}). Be direct and accurate.`;

    const result = await generateText(prompt, {
      systemInstruction: systemInstructionText,
      temperature: 0.2,
      maxOutputTokens: 2048,
    });

    const ans = extractGeminiText(result);
    if (ans) return ans;

    return buildLocalAnswer(question, context);
  } catch (error) {
    console.error("Gemini AI query failed, falling back to local heuristic mapping:", error);
    return buildLocalAnswer(question, context);
  }
}


