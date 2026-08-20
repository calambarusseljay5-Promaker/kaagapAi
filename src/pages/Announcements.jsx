import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Copy,
  Edit2,
  Home,
  Loader,
  Megaphone,
  Phone,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import Header from "../components/Header";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
} from "../services/announcementService";
import { fetchResidents } from "../services/adminService";
import {
  isValidSmsPhone,
  normalizeSmsPhone,
  parseSmsRecipients,
  sendBulkSmsNotifications,
} from "../services/smsService";
import {
  getResidentDisplayName,
  purokDefinitions,
  normalizePurokValue,
} from "../utils/residentProfile";

const HOUSEHOLD_AUDIENCE = "Family Household Representatives";

const audienceOptions = [
  "All Residents",
  "Family Household Representatives",
  "Senior Citizens",
  "PWD/PWED Residents",
  "Youth",
  "Selected Resident",
  "Multiple Puroks",
  ...purokDefinitions.map((p) => `Purok: ${p.label}`),
];

const categoryOptions = ["General", "Community", "Livelihood", "Training", "Health", "Emergency"];

const announcementMessageTemplates = {
  General:
    "Barangay Announcement:\n\nPlease be informed of an important update from the barangay office.\n\nDetails:\n[Add announcement details here]\n\nPlease be guided accordingly.",
  Community:
    "Community Announcement:\n\nThe barangay invites residents to join the upcoming community activity.\n\nActivity:\nDate and Time:\nVenue:\n\nYour participation is highly encouraged.",
  Livelihood:
    "Livelihood Announcement:\n\nA livelihood opportunity or program is available for interested residents.\n\nProgram/Opportunity:\nRequirements:\nSchedule:\nContact Person:\n\nPlease visit or contact the barangay office for assistance.",
  Training:
    "Training Announcement:\n\nThe barangay will conduct a training session for interested residents.\n\nTraining Topic:\nDate and Time:\nVenue:\nSlots Available:\n\nPlease coordinate with the barangay office to register.",
  Health:
    "Health Advisory:\n\nPlease be informed of an upcoming health service or advisory for residents.\n\nService/Advisory:\nDate and Time:\nVenue:\nReminders:\n\nKindly follow the health guidelines and bring necessary documents.",
  Emergency:
    "Emergency Announcement:\n\nThis is an urgent barangay advisory.\n\nSituation:\nAffected Area:\nImmediate Action:\nContact Number:\n\nPlease stay alert and follow official instructions.",
};

const templateMessages = Object.values(announcementMessageTemplates);

const isTemplateMessage = (message) => templateMessages.includes(message);

// Language detection from Title text (Tagalog / Filipino vs English)
const detectLanguageFromTitle = (title = "") => {
  const tagalogKeywords = [
    "ang", "mga", "ng", "sa", "na", "para", "may", "meron", "purok", "lunsod",
    "baha", "sunog", "lindol", "kuryente", "tubig", "bakuna", "trabaho", "ayuda",
    "pamamahagi", "mag-ingat", "paalala", "babala", "isyu", "oras", "araw", "tulong",
    "lahat", "kami", "tayo", "dengue", "reklamo", "hulog", "nanakaw", "nakaw", "kalusugan",
    "sakuna", "alerto", "doktor", "gamot", "pag-ulan", "bagyo", "saklolo", "pulis", "tanod"
  ];
  const lower = title.toLowerCase();
  const words = lower.split(/[^a-z0-9\-]+/).filter(Boolean);
  const isTagalog = words.some((w) => tagalogKeywords.includes(w));
  return isTagalog ? "tagalog" : "english";
};

// AI Generator logic for common causes, emergencies, calamities, and announcements
const generateAiAnnouncementDraft = (title = "", category = "General") => {
  const cleanTitle = title.trim();
  const lowerTitle = cleanTitle.toLowerCase();
  const lang = detectLanguageFromTitle(cleanTitle);

  // 1. EARTHQUAKE / LINDOL / SEISMIC
  if (
    lowerTitle.includes("earthquake") ||
    lowerTitle.includes("earth quake") ||
    lowerTitle.includes("lindol") ||
    lowerTitle.includes("quake") ||
    lowerTitle.includes("seismic") ||
    lowerTitle.includes("pag-alog")
  ) {
    const generatedCategory = "Emergency";
    const generatedBody =
      lang === "tagalog"
        ? `ABISO NG BARANGAY - BABALA SA LINDOL 🌋\n\nNagkaroon ng pag-yanig (Earthquake) sa ating lugar. Pinapaalalahanan ang lahat ng residente ng Barangay Upper Mingading na manatiling kalmado at mag-ingat.\n\nMGA DAPAT SUNDIN:\n1. DUCK, COVER, & HOLD kung may pag-yanig pa.\n2. Lumabas sa mga gusali o bahay papunta sa open area malayo sa poste o puno.\n3. I-check ang inyong linya ng kuryente at gas bago muling pumasok sa bahay.\n4. Para sa emergency o saklolo, tumawag agad sa Barangay Hotline: 09306259795.\n\nManatiling alerto at sumunod sa mga opisyal na babala.`
        : `BARANGAY ADVISORY - EARTHQUAKE SAFETY ALERT 🌋\n\nAn earthquake tremor has been reported in our area. All residents of Barangay Upper Mingading are strongly advised to remain calm and follow safety protocols.\n\nSAFETY INSTRUCTIONS:\n1. DUCK, COVER, & HOLD during active tremors.\n2. Evacuate to designated open areas away from electrical posts and fragile structures.\n3. Inspect your homes for gas leaks and electrical damage before re-entering.\n4. For immediate rescue or medical assistance, contact the Barangay Hotline: 09306259795.\n\nPlease stay vigilant and follow official updates.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 2. CARNAP / THEFT / NANAKAW / CRIME / SECURITY
  if (
    lowerTitle.includes("carnap") ||
    lowerTitle.includes("car nap") ||
    lowerTitle.includes("theft") ||
    lowerTitle.includes("stolen") ||
    lowerTitle.includes("nanakaw") ||
    lowerTitle.includes("nakaw") ||
    lowerTitle.includes("robbery") ||
    lowerTitle.includes("crime") ||
    lowerTitle.includes("security")
  ) {
    const generatedCategory = "Emergency";
    const generatedBody =
      lang === "tagalog"
        ? `BARANGAY SECURITY ALERT - PAALALA SA SEKURIDAD 🚨\n\nIsang insidente ng Carnapping / Pagnanakaw ng Sasakyan ang naitala sa ating barangay. Pinapaalalahanan ang lahat ng residente na maging masigasig sa seguridad ng inyong mga sasakyan at ari-arian.\n\nMGA PAALALA SA SEKURIDAD:\n1. I-lock nang maayos ang inyong mga motorsiklo at sasakyan, gamitan ng anti-theft lock.\n2. Huwag iwanan ang susi sa sasakyan o magpark sa madilim at walang taong lugar.\n3. Ipagbigay-alam agad sa Barangay Tanod / Police Station kung may napapansing kaduda-dudang tao.\n4. Barangay Emergency Hotline: 09306259795.\n\nMagtulungan tayo para sa kapayapaan at seguridad ng Barangay Upper Mingading.`
        : `BARANGAY SECURITY ALERT - VEHICLE THEFT / CARNAPPING NOTICE 🚨\n\nA vehicle theft / carnapping incident has been reported within the barangay vicinity. All residents of Barangay Upper Mingading are advised to take extra precautions.\n\nSECURITY MEASURES:\n1. Ensure all motorcycles and vehicles are locked securely with steering locks or anti-theft devices.\n2. Avoid parking in poorly lit or isolated areas.\n3. Report suspicious individuals or activity immediately to the Barangay Tanod on patrol.\n4. Barangay Emergency Hotline: 09306259795.\n\nLet us remain watchful and protect our community together.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 3. MEDICAL CHECKUP / HEALTH MISSION / VACCINATION / CLINIC
  if (
    lowerTitle.includes("medical") ||
    lowerTitle.includes("checkup") ||
    lowerTitle.includes("check up") ||
    lowerTitle.includes("check-up") ||
    lowerTitle.includes("health") ||
    lowerTitle.includes("vaccine") ||
    lowerTitle.includes("bakuna") ||
    lowerTitle.includes("doktor") ||
    lowerTitle.includes("clinic") ||
    lowerTitle.includes("dengue")
  ) {
    const generatedCategory = "Health";
    const generatedBody =
      lang === "tagalog"
        ? `IMPORMASYON SA SERBISYONG PANGKALUSUGAN - MEDICAL CHECKUP 🏥\n\nMagkakaroon ng Libreng Medical Check-up at Health Mission sa ating Barangay Health Center para sa lahat ng residente ng Barangay Upper Mingading.\n\nMGA DETALYE NG PROGRAMA:\n- Petsa at Oras: [Ilagay ang Petsa], 8:00 AM - 3:00 PM\n- Lugar: Barangay Upper Mingading Health Center\n- Mga Serbisyo: Libreng Check-up, Konsultasyon, Reseta ng Gamot, at BP / Blood Sugar Testing.\n\nKUMUHA NG NUMBER:\nMangyaring magdala ng Valid ID o Barangay Clearance. Ang pamamahagi ng priority numbers ay magsisimula ng 7:30 AM.`
        : `HEALTH SERVICE ANNOUNCEMENT - FREE MEDICAL CHECKUP 🏥\n\nBarangay Upper Mingading will be conducting a Free Medical Checkup and Health Consultation for all registered residents.\n\nPROGRAM DETAILS:\n- Date & Time: [Specify Date], 8:00 AM - 3:00 PM\n- Location: Barangay Upper Mingading Health Center\n- Available Services: General Medical Consultation, Prescription Medicines, BP & Blood Sugar Testing.\n\nREQUIREMENTS:\nPlease bring a Valid ID or Barangay Resident Certificate. Priority registration opens at 7:30 AM.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 4. FIRE / SUNOG / BLAZE
  if (
    lowerTitle.includes("fire") ||
    lowerTitle.includes("sunog") ||
    lowerTitle.includes("wildfire") ||
    lowerTitle.includes("burn") ||
    lowerTitle.includes("blaze")
  ) {
    const generatedCategory = "Emergency";
    const generatedBody =
      lang === "tagalog"
        ? `EMERGENCY ANNOUNCEMENT - BABALA SA SUNOG 🔥\n\nIsang alerto sa sunog ang inilabas para sa kaligtasan ng lahat ng residente sa Barangay Upper Mingading.\n\nMGA GABAY SA KALIGTASAN:\n1. I-turn off agad ang main switch ng kuryente at LPG tank valves kung ligtas gawin.\n2. Lumabas agad ng bahay kung may usok o apoy, iwasan ang mag-panic.\n3. I-prioritize ang kaligtasan ng pamilya bago ang gamit.\n4. Tumawag agad sa Fire Hotline o Barangay Emergency Team: 09306259795.\n\nManatiling alerto at mag-ingat po ang lahat.`
        : `EMERGENCY ANNOUNCEMENT - FIRE SAFETY ALERT 🔥\n\nAn urgent fire emergency advisory is in effect for Barangay Upper Mingading.\n\nIMMEDIATE ACTIONS REQUIRED:\n1. Shut off main circuit breakers and LPG gas regulators if safe to do so.\n2. Evacuate immediately if smoke or fire is present.\n3. Prioritize family safety over personal belongings.\n4. Contact the Fire Department or Barangay Rescue Hotline immediately: 09306259795.\n\nStay alert and follow safety instructions from local authorities.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 5. FLOOD / TYPHOON / BAGYO / BAHA / STORM
  if (
    lowerTitle.includes("typhoon") ||
    lowerTitle.includes("bagyo") ||
    lowerTitle.includes("flood") ||
    lowerTitle.includes("baha") ||
    lowerTitle.includes("storm") ||
    lowerTitle.includes("rain") ||
    lowerTitle.includes("landslide")
  ) {
    const generatedCategory = "Emergency";
    const generatedBody =
      lang === "tagalog"
        ? `BABALA SA BAGYO AT BAHA - ADVISORY SA MGA RESIDENTE ⛈️\n\nDahil sa malakas na pag-ulan at masamang panahon, pinapayuhan ang mga residente sa mabababang lugar ng Barangay Upper Mingading na maghanda sa posibleng pagbaha.\n\nMGA HAKBANG SA PAGHAHANDA:\n1. Ihanda ang Emergency Go-Bag (pagkain, tubig, gamot, flashlight, at importanteng dokumento).\n2. Alamin ang pinakamalapit na Evacuation Center sa inyong Purok.\n3. Mag-charge ng mga mobile phones at power banks.\n4. Para sa tulong o evacuation assistance: 09306259795.\n\nMag-ingat po ang bawat pamilya sa Barangay Upper Mingading.`
        : `TYPHOON & FLOOD ADVISORY - RESIDENT ALERT ⛈️\n\nDue to heavy rainfall and inclement weather, residents in low-lying areas of Barangay Upper Mingading are advised to take precautionary measures for potential flooding.\n\nPREPARATION STEPS:\n1. Prepare Emergency Go-Bags with food, drinking water, first-aid items, and essential documents.\n2. Monitor official barangay weather updates and locate your nearest evacuation site.\n3. Charge communication devices and emergency lights.\n4. For evacuation response and assistance: 09306259795.\n\nStay safe and indoors during heavy rainfall.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 6. POWER / WATER / BROWNOUT / KURYENTE / TUBIG / INTERRUPTION
  if (
    lowerTitle.includes("power") ||
    lowerTitle.includes("brownout") ||
    lowerTitle.includes("kuryente") ||
    lowerTitle.includes("water") ||
    lowerTitle.includes("tubig") ||
    lowerTitle.includes("interruption") ||
    lowerTitle.includes("outage") ||
    lowerTitle.includes("blackout")
  ) {
    const generatedCategory = "General";
    const generatedBody =
      lang === "tagalog"
        ? `PATALASTAS SA PAGPAPATAY NG KURYENTE / TUBIG ⚡\n\nInanunsyo ng barangay ang nakatakdang power / water interruption upang magbigay-daan sa pasilidad at linya ng maintenance work.\n\nDETALYE NG INTERRUPTIYO:\n- Apektadong Lugar: Barangay Upper Mingading (Lahat ng Purok)\n- Petsa at Oras: [Ilagay ang Petsa], 8:00 AM hanggang 5:00 PM\n- Dahilan: Scheduled Maintenance at Line Improvement Work.\n\nPAALALA:\nMag-ipon ng sapat na tubig at mag-charge ng mga ilaw bago ang takdang oras.`
        : `NOTICE OF POWER / WATER SERVICE INTERRUPTION ⚡\n\nPlease be informed of a scheduled service interruption affecting Barangay Upper Mingading for maintenance and infrastructure upgrading.\n\nINTERRUPTION SCHEDULE:\n- Affected Area: Barangay Upper Mingading (All Puroks)\n- Date & Time: [Specify Date], 8:00 AM to 5:00 PM\n- Reason: Utility Line Inspection and System Maintenance.\n\nRECOMMENDATION:\nPlease store adequate water supply and charge essential equipment prior to the scheduled outage.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 7. AYUDA / RELIEF / DISTRIBUTION / CASH ASSISTANCE
  if (
    lowerTitle.includes("ayuda") ||
    lowerTitle.includes("relief") ||
    lowerTitle.includes("distribution") ||
    lowerTitle.includes("cash assistance") ||
    lowerTitle.includes("pangkabuhayan")
  ) {
    const generatedCategory = "Livelihood";
    const generatedBody =
      lang === "tagalog"
        ? `ANUNSYO SA PAMAMAHAGI NG AYUDA AT RELIEF GOODS 🌾\n\nIpinapabatid sa lahat ng nakatalagang benepisyaryo ng Barangay Upper Mingading ang nakatakdang pamamahagi ng Ayuda / Relief Assistance.\n\nMGA DETALYE NG DISTRIBUTION:\n- Petsa at Oras: [Ilagay ang Petsa], 9:00 AM - 4:00 PM\n- Lugar: Barangay Upper Mingading Covered Court\n- Mga Kailangan Dalhin: Valid ID, Barangay Certificate, at Stub Number.\n\nPinapaalalahanan ang lahat na panatilihin ang kaayusan sa pila.`
        : `COMMUNITY ANNOUNCEMENT - AYUDA & RELIEF DISTRIBUTION 🌾\n\nPlease be informed of the scheduled distribution of Ayuda and Relief Assistance for eligible beneficiaries of Barangay Upper Mingading.\n\nDISTRIBUTION DETAILS:\n- Date & Time: [Specify Date], 9:00 AM - 4:00 PM\n- Venue: Barangay Upper Mingading Covered Court\n- Requirements: Valid ID, Barangay Resident Certificate, and Priority Stub.\n\nPlease maintain orderly lines during the distribution process.`;
    return { category: generatedCategory, body: generatedBody, language: lang };
  }

  // 8. DEFAULT GENERIC AI GENERATOR ACCORDING TO TITLE & LANGUAGE
  const cat = category || "General";
  const defaultBody =
    lang === "tagalog"
      ? `OPISYAL NA ANUNSYO NG BARANGAY UPPER MINGADING 📢\n\nPamagat: ${cleanTitle || "Opisyal na Patalastas"}\nKategorya: ${cat}\n\nMGA IMPORMASYON AT DETALYE:\nIpinapabatid sa lahat ng residente ng Barangay Upper Mingading ang mahalagang patalastas na ito ukol sa ${cleanTitle || "aktibidad ng barangay"}.\n\nMGA DETALYE:\n- Petsa at Oras: [Ilagay ang Petsa/Oras]\n- Lugar: Barangay Upper Mingading Hall / Covered Court\n- Paalala: Mangyaring sumunod sa mga panuntunan ng barangay.\n\nPara sa karagdagang katanungan, tumawag sa Barangay Office: 09306259795.\n\nMaraming salamat sa inyong kooperasyon!`
      : `OFFICIAL BARANGAY UPPER MINGADING ANNOUNCEMENT 📢\n\nTitle: ${cleanTitle || "Official Advisory"}\nCategory: ${cat}\n\nIMPORTANT ADVISORY & DETAILS:\nAll registered residents of Barangay Upper Mingading are hereby informed regarding ${cleanTitle || "the official barangay update"}.\n\nDETAILS:\n- Date & Schedule: [Specify Date & Time]\n- Venue: Barangay Upper Mingading Hall / Covered Court\n- Guidelines: Please be guided accordingly and observe standard protocols.\n\nFor inquiries, please contact the Barangay Office Hotline: 09306259795.\n\nThank you for your cooperation!`;

  return { category: cat, body: defaultBody, language: lang };
};

const getSelectedResidentNames = (audience = "") => {
  if (!audience || (!audience.startsWith("Selected Resident:") && !audience.startsWith("Selected Residents:"))) {
    return [];
  }
  const namesStr = audience.replace(/^Selected Residents?:/, "").trim();
  if (!namesStr) return [];
  return namesStr.split(",").map((s) => s.trim()).filter(Boolean);
};

const getInitialForm = () => ({
  title: "",
  body: announcementMessageTemplates.General,
  category: "General",
  audience: "All Residents",
  status: "Published",
  publish_date: new Date().toISOString().slice(0, 10),
  expires_at: "",
  sms_recipient_phones: "",
});

const statusClass = (status) => {
  if (status === "Published") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Archived") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "Not set";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizePhone = normalizeSmsPhone;

const hasPhone = (resident) => isValidSmsPhone(resident?.phone);

const getHouseholdKey = (resident) => {
  const householdNo = normalizeKey(resident.household_no);
  if (householdNo) return `household:${householdNo}`;

  const houseLocation = [resident.purok, resident.house_no]
    .map(normalizeKey)
    .filter(Boolean)
    .join("|");
  if (houseLocation) return `house:${houseLocation}`;

  const addressLocation = [resident.purok, resident.address]
    .map(normalizeKey)
    .filter(Boolean)
    .join("|");
  if (addressLocation) return `address:${addressLocation}`;

  return `resident:${resident.id || getResidentDisplayName(resident)}`;
};

const getHouseholdLabel = (resident) => {
  if (resident.household_no) return `Household ${resident.household_no}`;
  if (resident.house_no || resident.purok) {
    return [resident.purok, resident.house_no && `House ${resident.house_no}`]
      .filter(Boolean)
      .join(" - ");
  }
  return resident.address || "Unlisted household";
};

const getRepresentativeRank = (resident) => {
  const relationship = normalizeKey(resident.relationship_to_household_head);
  if (relationship === "head") return 0;
  if (relationship === "spouse") return 1;
  if (relationship === "parent") return 2;
  return 3;
};

const chooseHouseholdRepresentative = (members) =>
  [...members].sort((first, second) => {
    if (hasPhone(first) !== hasPhone(second)) return hasPhone(first) ? -1 : 1;
    const relationshipRank = getRepresentativeRank(first) - getRepresentativeRank(second);
    if (relationshipRank !== 0) return relationshipRank;
    return getResidentDisplayName(first).localeCompare(getResidentDisplayName(second));
  })[0];

const buildHouseholdSmsRecipients = (residents = []) => {
  const groups = new Map();

  residents
    .filter((resident) => resident?.status !== "Archived")
    .forEach((resident) => {
      const key = getHouseholdKey(resident);
      const current = groups.get(key) || [];
      groups.set(key, [...current, resident]);
    });

  const households = [...groups.values()].map((members) => {
    const representative = chooseHouseholdRepresentative(members);

    return {
      key: getHouseholdKey(representative),
      householdLabel: getHouseholdLabel(representative),
      members,
      representative,
      phone: normalizePhone(representative?.phone),
    };
  });

  households.sort((first, second) => first.householdLabel.localeCompare(second.householdLabel));

  return {
    households,
    phoneRecipients: households.filter((item) => item.phone),
    missingPhoneHouseholds: households.filter((item) => !item.phone),
  };
};

const isHouseholdAnnouncement = (audience) => audience === HOUSEHOLD_AUDIENCE;

const buildAnnouncementSmsMessage = (announcement) => {
  const lines = [
    "[OFFICIAL KAAGAPAI NOTIFICATION]",
    "BARANGAY UPPER MINGADING, ALEOSAN",
    "----------------------------------------",
  ];

  if (announcement.title) {
    lines.push(`📢 Pamagat: ${announcement.title}`);
  }

  if (announcement.body) {
    lines.push(announcement.body);
  }

  if (announcement.publish_date) {
    lines.push(`Petsa: ${formatDate(announcement.publish_date)}`);
  }

  lines.push("----------------------------------------");
  lines.push(
    "⚠️ PAALALA: Ang Barangay Upper Mingading ay HINDI kailanman hihingi ng inyong password, OTP, o bayad sa GCash via text."
  );

  return lines.join("\n").slice(0, 1500);
};

const formatBulkSmsFailureDetails = (failed = []) => {
  const firstReason = failed.find((item) => item.error)?.error;
  if (!firstReason) return "";
  return ` Reason: ${firstReason}`;
};

const Announcements = () => {
  const { confirm } = useConfirm();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState(getInitialForm);
  const [residents, setResidents] = useState([]);
  const [recipientError, setRecipientError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [sendingAnnouncementId, setSendingAnnouncementId] = useState(null);
  const [aiGeneratedNotice, setAiGeneratedNotice] = useState("");

  const handleAiGenerateDraft = (customTitle = null) => {
    const targetTitle = customTitle !== null ? customTitle : formData.title;
    const res = generateAiAnnouncementDraft(targetTitle, formData.category);
    setFormData((current) => ({
      ...current,
      title: targetTitle || current.title,
      category: res.category,
      body: res.body,
    }));
    const langLabel = res.language === "tagalog" ? "Tagalog 🇵🇭" : "English 🇺🇸";
    setAiGeneratedNotice(`✨ AI Announcement Draft created in ${langLabel}!`);
    setTimeout(() => setAiGeneratedNotice(""), 4500);
  };

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnnouncements({
        search,
        status: statusFilter,
        category: categoryFilter,
      });
      setAnnouncements(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load announcements." });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadAnnouncements, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnnouncements]);

  useEffect(() => {
    let isMounted = true;

    const loadResidents = async () => {
      try {
        const data = await fetchResidents("", "", { excludeArchived: true });
        if (isMounted) {
          setResidents(data);
          setRecipientError("");
        }
      } catch (error) {
        if (isMounted) {
          setResidents([]);
          setRecipientError(error.message || "Unable to load resident phone numbers.");
        }
      }
    };

    loadResidents();

    return () => {
      isMounted = false;
    };
  }, []);

  const householdSmsRecipients = useMemo(
    () => buildHouseholdSmsRecipients(residents),
    [residents]
  );

  const formSmsRecipients = useMemo(
    () => parseSmsRecipients(formData.sms_recipient_phones),
    [formData.sms_recipient_phones]
  );

  const stats = useMemo(
    () => ({
      total: announcements.length,
      published: announcements.filter((item) => item.status === "Published").length,
      drafts: announcements.filter((item) => item.status === "Draft").length,
      archived: announcements.filter((item) => item.status === "Archived").length,
      householdSms: householdSmsRecipients.phoneRecipients.length,
    }),
    [announcements, householdSmsRecipients.phoneRecipients.length]
  );

  const [residentSearchQuery, setResidentSearchQuery] = useState("");

  const filteredFormResidents = useMemo(() => {
    const query = residentSearchQuery.trim().toLowerCase();
    if (!query) return residents.slice(0, 50);
    return residents
      .filter((r) =>
        [r.full_name, r.email, r.phone, r.purok]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query))
      )
      .slice(0, 50);
  }, [residents, residentSearchQuery]);

  const selectedResidentNames = useMemo(
    () => getSelectedResidentNames(formData.audience),
    [formData.audience]
  );

  const getAudienceSelectValue = (audience) => {
    if (!audience) return "All Residents";
    if (audience.startsWith("Selected Resident:") || audience.startsWith("Selected Residents:")) return "Selected Resident";
    if (audience.startsWith("Purok: ")) return audience;
    if (audience.startsWith("Puroks: ")) return "Multiple Puroks";
    return audience;
  };

  const handleToggleSelectedResident = (resident) => {
    const rName = (resident.full_name || getResidentDisplayName(resident)).trim();
    let nextNames = [];
    if (selectedResidentNames.includes(rName)) {
      nextNames = selectedResidentNames.filter((n) => n !== rName);
    } else {
      nextNames = [...selectedResidentNames, rName];
    }

    const matchedResidents = residents.filter((r) =>
      nextNames.includes((r.full_name || getResidentDisplayName(r)).trim())
    );
    const phones = matchedResidents.map((r) => normalizePhone(r.phone)).filter(Boolean);
    const uniquePhones = [...new Set(phones)];

    setFormData((current) => ({
      ...current,
      audience: nextNames.length > 0 ? `Selected Residents: ${nextNames.join(", ")}` : "Selected Resident:",
      sms_recipient_phones: uniquePhones.join("\n"),
    }));
  };

  const handleSelectAllFilteredResidents = () => {
    const filteredNames = filteredFormResidents.map((r) => (r.full_name || getResidentDisplayName(r)).trim());
    const combinedNames = [...new Set([...selectedResidentNames, ...filteredNames])];
    const matchedResidents = residents.filter((r) =>
      combinedNames.includes((r.full_name || getResidentDisplayName(r)).trim())
    );
    const phones = matchedResidents.map((r) => normalizePhone(r.phone)).filter(Boolean);
    const uniquePhones = [...new Set(phones)];

    setFormData((current) => ({
      ...current,
      audience: combinedNames.length > 0 ? `Selected Residents: ${combinedNames.join(", ")}` : "Selected Resident:",
      sms_recipient_phones: uniquePhones.join("\n"),
    }));
  };

  const handleClearSelectedResidents = () => {
    setFormData((current) => ({
      ...current,
      audience: "Selected Resident:",
      sms_recipient_phones: "",
    }));
  };

  const openCreate = () => {
    setEditingAnnouncement(null);
    setFormData(getInitialForm());
    setMessage(null);
    setCopyStatus("");
    setResidentSearchQuery("");
    setAiGeneratedNotice("");
    setShowModal(true);
  };

  const openEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title || "",
      body: announcement.body || "",
      category: announcement.category || "General",
      audience: announcement.audience || "All Residents",
      status: announcement.status || "Draft",
      publish_date: announcement.publish_date || new Date().toISOString().slice(0, 10),
      expires_at: announcement.expires_at || "",
      sms_recipient_phones: announcement.sms_recipient_phones || "",
    });
    setMessage(null);
    setCopyStatus("");
    setResidentSearchQuery("");
    setAiGeneratedNotice("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData(getInitialForm());
    setCopyStatus("");
    setAiGeneratedNotice("");
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    setFormData((current) => {
      if (name !== "category") {
        return { ...current, [name]: value };
      }

      const nextTemplate = announcementMessageTemplates[value] || "";
      const shouldApplyTemplate = !current.body.trim() || isTemplateMessage(current.body);

      return {
        ...current,
        category: value,
        body: shouldApplyTemplate ? nextTemplate : current.body,
      };
    });
  };

  const handleSaveAnnouncement = async (shouldPublish = false) => {
    setSaving(true);
    setMessage(null);

    try {
      if (formSmsRecipients.invalid.length > 0) {
        throw new Error(`Invalid SMS phone number(s): ${formSmsRecipients.invalid.slice(0, 3).join(", ")}`);
      }

      const targetStatus = shouldPublish ? "Published" : "Draft";
      const announcementPayload = {
        ...formData,
        status: targetStatus,
        publish_date: formData.publish_date || new Date().toISOString().slice(0, 10),
        sms_recipient_phones: formSmsRecipients.recipients.join("\n"),
      };

      let savedData;
      if (editingAnnouncement) {
        savedData = await updateAnnouncement(editingAnnouncement.id, announcementPayload);
      } else {
        savedData = await createAnnouncement(announcementPayload);
      }

      let smsMsg = "";
      if (shouldPublish) {
        let phones = formSmsRecipients.recipients;
        if (isHouseholdAnnouncement(formData.audience)) {
          const hhPhones = householdSmsRecipients.phoneRecipients.map((r) => normalizePhone(r.phone)).filter(Boolean);
          phones = [...new Set([...phones, ...hhPhones])];
        } else if (formData.audience === "All Residents" || formData.audience === "Registered Residents") {
          const allPhones = residents.filter((r) => hasPhone(r)).map((r) => normalizePhone(r.phone)).filter(Boolean);
          phones = [...new Set([...phones, ...allPhones])];
        }

        if (phones.length > 0) {
          // Asynchronous non-blocking SMS dispatch for sub-2s response time
          sendBulkSmsNotifications({
            recipients: phones,
            body: buildAnnouncementSmsMessage(savedData),
          }).catch((err) => console.warn("Background SMS error:", err.message));
          smsMsg = ` SMS alert broadcast dispatched to ${phones.length} recipients.`;
        }
      }

      setMessage({
        type: "success",
        text: shouldPublish
          ? `Announcement published successfully!${smsMsg}`
          : "Announcement saved successfully as Draft.",
      });

      closeModal();
      await loadAnnouncements();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save announcement." });
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (announcement, status) => {
    if (status === "Published") {
      const ok = await confirm({
        title: "Publish Announcement",
        message: "Are you sure you want to publish this announcement to all residents immediately?",
        confirmText: "Publish Now",
        cancelText: "Cancel",
        variant: "emerald",
        icon: Megaphone,
      });
      if (!ok) return;
    }

    setUpdatingStatusId(announcement.id);
    setMessage(null);

    try {
      // Fast Supabase update (< 300ms)
      await updateAnnouncement(announcement.id, { ...announcement, status });
      
      // Update local state instantly for 0-lag UI feedback
      setAnnouncements((prev) => prev.map((a) => (a.id === announcement.id ? { ...a, status } : a)));

      let smsResultMsg = "";
      if (status === "Published") {
        let phones = parseSmsRecipients(announcement.sms_recipient_phones || "").recipients;
        
        if (announcement.audience === "Family Household Representatives") {
          const hhPhones = householdSmsRecipients.phoneRecipients.map((r) => normalizePhone(r.phone)).filter(Boolean);
          phones = [...new Set([...phones, ...hhPhones])];
        } else if (announcement.audience === "All Residents" || announcement.audience === "Registered Residents") {
          const allPhones = residents.filter((r) => hasPhone(r)).map((r) => normalizePhone(r.phone)).filter(Boolean);
          phones = [...new Set([...phones, ...allPhones])];
        } else if (announcement.audience && announcement.audience.startsWith("Purok: ")) {
          const targetPurokLabel = announcement.audience.replace("Purok: ", "").trim();
          const targetPurok = purokDefinitions.find((p) => p.label === targetPurokLabel);
          if (targetPurok) {
            const targetValue = targetPurok.value;
            const purokPhones = residents
              .filter((r) => normalizePurokValue(r.purok) === targetValue && hasPhone(r))
              .map((r) => normalizePhone(r.phone))
              .filter(Boolean);
            phones = [...new Set([...phones, ...purokPhones])];
          }
        }
        
        if (phones.length > 0) {
          sendBulkSmsNotifications({
            recipients: phones,
            body: buildAnnouncementSmsMessage(announcement),
          }).catch((err) => console.warn("Background SMS error:", err.message));
          smsResultMsg = ` Auto-sent SMS broadcast to ${phones.length} recipients.`;
        }
      }

      setMessage({
        type: "success",
        text:
          status === "Published"
            ? `Announcement published successfully!${smsResultMsg}`
            : `Announcement marked as ${status.toLowerCase()}.`,
      });

      await loadAnnouncements();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to update announcement." });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (announcement) => {
    const ok = await confirm({
      title: "Delete Announcement",
      message: "Are you sure you want to delete this announcement?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await deleteAnnouncement(announcement.id);
      setMessage({ type: "success", text: "Announcement deleted." });
      await loadAnnouncements();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete announcement." });
    }
  };

  const handleCopyHouseholdPhones = async () => {
    const phoneList = householdSmsRecipients.phoneRecipients
      .map(
        (item) =>
          `${item.phone} - ${getResidentDisplayName(item.representative)} (${item.householdLabel})`
      )
      .join("\n");

    if (!phoneList) {
      setCopyStatus("No household phone numbers available to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(phoneList);
      setCopyStatus("Household SMS phone list copied.");
    } catch {
      setCopyStatus("Unable to copy automatically. Select and copy the list manually.");
    }
  };

  const handleSendAnnouncementSms = async (announcement) => {
    const parsed = parseSmsRecipients(announcement.sms_recipient_phones);

    if (parsed.invalid.length > 0) {
      setMessage({
        type: "error",
        text: `Invalid SMS phone number(s): ${parsed.invalid.slice(0, 3).join(", ")}`,
      });
      return;
    }

    if (parsed.recipients.length === 0) {
      setMessage({
        type: "error",
        text: "Add SMS recipient phone numbers to this announcement first.",
      });
      return;
    }

    if (
      !window.confirm(
        `Send this announcement by SMS to ${parsed.recipients.length} resident phone number(s)?`
      )
    ) {
      return;
    }

    setSendingAnnouncementId(announcement.id);
    setMessage(null);

    try {
      const result = await sendBulkSmsNotifications({
        recipients: parsed.recipients,
        body: buildAnnouncementSmsMessage(announcement),
      });

      setMessage({
        type: result.failed.length > 0 ? "error" : "success",
        text:
          result.failed.length > 0
            ? `SMS sent to ${result.sent.length} of ${result.total} recipient(s). Failed: ${result.failed
              .slice(0, 3)
              .map((item) => item.to)
              .join(", ")}.${formatBulkSmsFailureDetails(result.failed)}`
            : `TextBee accepted ${result.sent.length} SMS message(s) into the device queue. Check the TextBee device and dashboard for delivery status if phones do not receive it.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to send announcement SMS.",
      });
    } finally {
      setSendingAnnouncementId(null);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header title="Announcements" subtitle="Create, publish, and manage barangay announcements" />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div
            className={`glass-panel mb-5 p-4 text-sm font-semibold shadow-soft ${message.type === "success"
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/50"
                : "bg-rose-50/80 text-rose-700 border-rose-200/50"
              }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="glass-container mt-6">
          <div className="p-6 border-b border-slate-200/50 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white/20">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 flex-1 max-w-4xl">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-emerald-500" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, message..."
                  className="w-full h-[46px] rounded-[12px] border border-slate-200 bg-white/60 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-[46px] rounded-[12px] border border-slate-200 bg-white/60 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                <option value="">All categories</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-[46px] rounded-[12px] border border-slate-200 bg-white/60 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                <option value="">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl bg-[#14532D] px-6 text-sm font-bold text-white transition hover:bg-[#0f3e21] shadow-sm hover:shadow active:scale-95 shrink-0"
            >
              <Plus size={18} />
              New Announcement
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">
                <Loader className="mx-auto mb-3 animate-spin" size={24} />
                Loading announcements...
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">No announcements found.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {announcements.map((announcement) => {
                  const announcementSmsRecipients = parseSmsRecipients(
                    announcement.sms_recipient_phones
                  ).recipients;

                  const borderColor = announcement.status === "Published" ? "#10B981" : announcement.status === "Draft" ? "#F59E0B" : "#94A3B8";

                  return (
                    <article key={announcement.id} className="relative rounded-[20px] bg-white/60 border border-slate-200/60 p-6 flex flex-col group overflow-hidden border-l-[6px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all" style={{ borderLeftColor: borderColor }}>
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          {announcement.category}
                        </span>
                        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusClass(announcement.status)}`}>
                          {announcement.status}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-800 line-clamp-2 mb-2">{announcement.title}</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 line-clamp-3 mb-6 flex-1">
                        {announcement.body}
                      </p>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-medium text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Audience</p>
                          <p className="text-slate-700 truncate" title={announcement.audience || "-"}>
                            {announcement.audience || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">SMS Targets</p>
                          <p className="text-slate-700">
                            {isHouseholdAnnouncement(announcement.audience)
                              ? `${householdSmsRecipients.phoneRecipients.length} hhs`
                              : announcementSmsRecipients.length
                                ? `${announcementSmsRecipients.length} recips`
                                : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Publish</p>
                          <p className="text-slate-700">{formatDate(announcement.publish_date)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Expires</p>
                          <p className="text-slate-700">{formatDate(announcement.expires_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 mt-auto">
                        {announcement.status !== "Published" ? (
                          <button
                            type="button"
                            onClick={() => handleStatus(announcement, "Published")}
                            disabled={updatingStatusId === announcement.id}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingStatusId === announcement.id ? (
                              <Loader size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Publish
                          </button>
                        ) : null}

                        {/* Removed isolated Send SMS button as it's now integrated into Publish */}

                        <div className="flex gap-2 w-full mt-2">
                          {announcement.status !== "Archived" ? (
                            <button
                              type="button"
                              onClick={() => handleStatus(announcement, "Archived")}
                              className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                            >
                              <Archive size={14} /> Archive
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEdit(announcement)}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-blue-600 transition hover:bg-slate-50 hover:border-blue-200"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(announcement)}
                            className="inline-flex w-[46px] h-[38px] items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-200"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <FloatingModal
        open={showModal}
        onClose={closeModal}
        title={editingAnnouncement ? "Edit Announcement" : "New Announcement"}
        maxWidth="max-w-2xl"
        eyebrow="Announcement Details"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-600 animate-pulse" />
              <span>KaagapA.I Smart Publishing Engine</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveAnnouncement(false)}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {saving ? <Loader size={16} className="animate-spin" /> : null}
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveAnnouncement(true)}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14532D] via-[#157347] to-[#0F4324] px-6 py-2.5 font-bold text-white transition hover:brightness-110 disabled:opacity-60 shadow-md cursor-pointer active:scale-95"
              >
                {saving ? <Loader size={16} className="animate-spin" /> : <Send size={15} />}
                <span>🚀 Publish Now</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            
            {/* AI ASSISTANT SMART GENERATOR BAR */}
            <div className="sm:col-span-2 rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-blue-50/90 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shrink-0">
                    <Sparkles size={18} className="animate-pulse" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                      <span>KaagapA.I Announcement Assistant</span>
                      <span className="text-[9px] px-2 py-0.2 rounded-full bg-purple-200 text-purple-900 font-black">AI DRAFT</span>
                    </h4>
                    <p className="text-[11px] font-semibold text-indigo-800">
                      Auto-generates official announcements in <b>English</b> or <b>Tagalog</b> based on your title.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAiGenerateDraft()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer"
                  title="Generate AI Announcement Draft based on Title"
                >
                  <Wand2 size={14} className="text-amber-300" />
                  <span>✨ Generate AI Draft</span>
                </button>
              </div>

              {/* Quick Idea Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] font-bold">
                <span className="text-slate-500 uppercase tracking-wider text-[9.5px]">Quick Ideas:</span>
                {[
                  { label: "🌋 Earthquake", title: "Earthquake Emergency Advisory" },
                  { label: "🚨 Carnap / Crime", title: "Carnapping & Vehicle Theft Security Alert" },
                  { label: "🏥 Medical Checkup", title: "Free Medical Checkup & Health Mission" },
                  { label: "🔥 Fire Alert", title: "Fire Safety Emergency Advisory" },
                  { label: "⛈️ Flood / Typhoon", title: "Typhoon & Heavy Rainfall Advisory" },
                  { label: "⚡ Power Outage", title: "Scheduled Power & Water Interruption" },
                  { label: "🌾 Ayuda Relief", title: "Pamamahagi ng Relief Goods at Ayuda" }
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleAiGenerateDraft(chip.title)}
                    className="px-2.5 py-1 rounded-lg bg-white/95 border border-indigo-200 text-indigo-900 hover:bg-indigo-600 hover:text-white transition shadow-2xs cursor-pointer active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {aiGeneratedNotice && (
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-3.5 py-2 rounded-xl animate-fadeIn">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{aiGeneratedNotice}</span>
                </div>
              )}
            </div>

            <label className="text-sm font-bold text-slate-700 sm:col-span-2">
              Title *
              <input
                name="title"
                value={formData.title}
                onChange={handleInput}
                placeholder="e.g. Earthquake, Carnap, Medical Checkup..."
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Category
              <select
                name="category"
                value={formData.category}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                {categoryOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">
              Audience
              <select
                name="audience"
                value={getAudienceSelectValue(formData.audience)}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val === "Selected Resident") {
                    setFormData((current) => ({
                      ...current,
                      audience: "Selected Resident:",
                      sms_recipient_phones: "",
                    }));
                  } else {
                    setFormData((current) => ({
                      ...current,
                      audience: val,
                      sms_recipient_phones: "",
                    }));
                  }
                  setResidentSearchQuery("");
                }}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              >
                {audienceOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            {getAudienceSelectValue(formData.audience) === "Selected Resident" && (
              <div className="sm:col-span-2 rounded-2xl border border-indigo-200 bg-slate-50/90 p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                      <span>Target Selected Residents ({selectedResidentNames.length})</span>
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Check multiple residents below. Only checked residents will receive this announcement.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredResidents}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                    >
                      Select All Filtered
                    </button>
                    {selectedResidentNames.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearSelectedResidents}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        Clear All ({selectedResidentNames.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected Resident Chips / Badges */}
                {selectedResidentNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white border border-indigo-100 max-h-28 overflow-y-auto custom-scrollbar">
                    {selectedResidentNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold shadow-2xs"
                      >
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const targetRes = residents.find((r) => (r.full_name || getResidentDisplayName(r)).trim() === name);
                            if (targetRes) handleToggleSelectedResident(targetRes);
                            else {
                              const nextNames = selectedResidentNames.filter((n) => n !== name);
                              setFormData((current) => ({
                                ...current,
                                audience: nextNames.length > 0 ? `Selected Residents: ${nextNames.join(", ")}` : "Selected Resident:",
                              }));
                            }
                          }}
                          className="rounded-full p-0.5 hover:bg-indigo-200 text-indigo-700 cursor-pointer"
                          title="Remove resident"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search Resident Filter Box */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 text-slate-400" size={15} />
                  <input
                    value={residentSearchQuery}
                    onChange={(event) => setResidentSearchQuery(event.target.value)}
                    placeholder="Search resident name, purok, or phone..."
                    className="w-full h-[40px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-medium outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 shadow-xs"
                  />
                </div>

                {/* Checkbox List of Residents */}
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 custom-scrollbar">
                  {filteredFormResidents.length === 0 ? (
                    <p className="p-4 text-center text-xs font-semibold text-slate-400">
                      No residents match your search.
                    </p>
                  ) : (
                    filteredFormResidents.map((r) => {
                      const rName = (r.full_name || getResidentDisplayName(r)).trim();
                      const isChecked = selectedResidentNames.includes(rName);
                      const hasPhoneNumber = hasPhone(r);

                      return (
                        <label
                          key={r.id}
                          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium transition cursor-pointer ${
                            isChecked ? "bg-indigo-50/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectedResident(r)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-800">{rName}</p>
                              <p className="truncate text-[11px] text-slate-500 font-semibold">
                                {r.purok ? `Purok: ${r.purok}` : "No Purok"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              hasPhoneNumber ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <Phone size={10} />
                            {hasPhoneNumber ? r.phone : "No phone"}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {getAudienceSelectValue(formData.audience) === "Multiple Puroks" && (
              <div className="sm:col-span-2 border border-slate-100 bg-slate-50/50 p-4 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Puroks Targets</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {purokDefinitions.map((purok) => {
                    const currentPuroks = formData.audience.startsWith("Puroks: ")
                      ? formData.audience.replace("Puroks: ", "").split(",").map(s => s.trim()).filter(Boolean)
                      : [];
                    const isChecked = currentPuroks.includes(purok.label);
                    
                    return (
                      <label key={purok.value} className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer hover:text-[#14532D]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let nextPuroks = [...currentPuroks];
                            if (e.target.checked) {
                              nextPuroks.push(purok.label);
                            } else {
                              nextPuroks = nextPuroks.filter(lbl => lbl !== purok.label);
                            }
                            setFormData((current) => ({
                              ...current,
                              audience: `Puroks: ${nextPuroks.join(", ")}`,
                              sms_recipient_phones: "",
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-350 text-[#14532D] focus:ring-[#14532D] cursor-pointer"
                        />
                        <span>{purok.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {isHouseholdAnnouncement(formData.audience) ? (
              <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 sm:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <Home size={22} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-blue-950">
                        One SMS recipient per family household
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-800">
                        The system chooses the household head first. If the head has no phone number, it chooses another household member with a phone number.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyHouseholdPhones}
                    className="inline-flex h-[36px] items-center justify-center gap-2 rounded-lg bg-white border border-blue-200 px-4 text-xs font-bold text-blue-700 transition hover:bg-blue-50 shadow-sm shrink-0"
                  >
                    <Copy size={14} />
                    Copy phones
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <div className="rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Households</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">
                      {householdSmsRecipients.households.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">With phone</p>
                    <p className="mt-1 text-2xl font-black text-emerald-600">
                      {householdSmsRecipients.phoneRecipients.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Missing phone</p>
                    <p className="mt-1 text-2xl font-black text-amber-500">
                      {householdSmsRecipients.missingPhoneHouseholds.length}
                    </p>
                  </div>
                </div>

                {recipientError ? (
                  <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                    {recipientError}
                  </p>
                ) : null}

                {copyStatus ? (
                  <p className="mb-4 text-xs font-bold text-blue-700">{copyStatus}</p>
                ) : null}

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm custom-scrollbar">
                  {householdSmsRecipients.phoneRecipients.length === 0 ? (
                    <p className="p-6 text-center text-sm font-semibold text-slate-500">
                      No household phone recipients available yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {householdSmsRecipients.phoneRecipients.slice(0, 12).map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {getResidentDisplayName(item.representative)}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                              {item.householdLabel} - {item.members.length} member(s)
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">
                            <Phone size={12} />
                            {item.phone}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {householdSmsRecipients.phoneRecipients.length > 12 ? (
                  <p className="mt-3 text-xs font-semibold text-blue-700 text-center">
                    Showing 12 of {householdSmsRecipients.phoneRecipients.length} phone recipients. Use copy to get the full list.
                  </p>
                ) : null}
              </section>
            ) : null}
            <label className="text-sm font-bold text-slate-700">
              Publish Date
              <input
                name="publish_date"
                type="date"
                value={formData.publish_date}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Expiration Date
              <input
                name="expires_at"
                type="date"
                value={formData.expires_at}
                onChange={handleInput}
                className="mt-2 w-full h-[46px] rounded-[12px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">
              Message *
              <textarea
                name="body"
                value={formData.body}
                onChange={handleInput}
                rows="8"
                className="mt-2 w-full rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none transition focus:border-[#14532D] focus:bg-white focus:ring-4 focus:ring-[#14532D]/10 shadow-sm"
              />
            </label>
          </div>
        </div>
      </FloatingModal>
    </div>
  );
};

export default Announcements;
