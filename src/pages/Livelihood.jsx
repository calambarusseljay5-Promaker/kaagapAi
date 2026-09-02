import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  FileText,
  FileUp,
  GraduationCap,
  Image as ImageIcon,
  Loader,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Trash2,
  User,
  Users,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import Header from "../components/Header";
import FloatingModal from "../components/FloatingModal";
import { useConfirm } from "../context/ConfirmContext";
import {
  createLivelihoodPost,
  deleteLivelihoodPost,
  fetchLivelihoodPosts,
  updateLivelihoodPost,
  fetchLivelihoodApplications,
  updateLivelihoodApplicationStatus,
  notifyResidentsForLivelihoodPost,
  fetchLivelihoodApplicationsCountsGrouped,
} from "../services/livelihoodService";
import { subscribeAdminNotificationChanges } from "../services/adminNotificationService";
import { fetchResidents } from "../services/adminService";
import {
  isValidSmsPhone,
  normalizeSmsPhone,
  parseSmsRecipients,
  sendBulkSmsNotifications,
} from "../services/smsService";
import { generateText } from "../services/geminiService";
import {
  getResidentDisplayName,
  purokDefinitions,
  normalizePurokValue,
} from "../utils/residentProfile";

const audienceOptions = [
  "All Residents",
  "Family Household Representatives",
  "Youth",
  "Senior Citizens",
  "PWD/PWED Residents",
  "Multiple Puroks",
  "Selected Resident",
  ...purokDefinitions.map((p) => `Purok: ${p.label}`),
];

const initialForm = {
  title: "",
  category: "Program",
  organization: "",
  description: "",
  eligibility: "",
  slots: "",
  location: "",
  contact: "",
  status: "Open",
  deadline: "",
  audience: "All Residents",
  sms_recipient_phones: "",
};

const statusClass = (status) => {
  if (status === "Open") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Closed") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "Draft") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "No deadline";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString();
};

const normalizePhone = normalizeSmsPhone;
const hasPhone = (resident) => isValidSmsPhone(resident?.phone);

const detectLanguage = (text = "") => {
  const tagalogKeywords = [
    "ang", "mga", "ng", "sa", "na", "para", "may", "meron", "purok", "lunsod",
    "trabaho", "ayuda", "pamamahagi", "mag-ingat", "paalala", "oras", "araw", "tulong",
    "lahat", "kami", "tayo", "kalusugan", "sakuna", "doktor", "gamot", "kabuhayan",
    "kasanayan", "pagsasanay", "kailangan", "dokumentong", "dalhin", "magparehistro", "patahian"
  ];
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9\-]+/).filter(Boolean);
  const isTagalog = words.some((w) => tagalogKeywords.includes(w));
  return isTagalog ? "tagalog" : "english";
};

// AI Livelihood Draft Generator with North Cotabato SPES & TESDA Vocations (Driving NC2, Welding, Baking, etc.)
const generateAiLivelihoodDraft = (title = "", category = "Program") => {
  const cleanTitle = title.trim();
  const lower = cleanTitle.toLowerCase();
  const lang = detectLanguage(cleanTitle);

  // 1. DRIVING NC II / TRANSPORT / VEHICLE OPERATION
  if (
    lower.includes("driv") ||
    lower.includes("nc2") ||
    lower.includes("nc 2") ||
    lower.includes("nc ii") ||
    lower.includes("ncii") ||
    lower.includes("driver") ||
    lower.includes("kotse") ||
    lower.includes("sakay") ||
    lower.includes("sasakyan") ||
    lower.includes("forklift") ||
    lower.includes("heavy equipment")
  ) {
    return {
      title: cleanTitle || "TESDA Driving NC II Skills Training & Certification Program",
      category: "Training",
      organization: "TESDA Accredited Driving Center, LTO & Barangay Transport Office",
      location: "Barangay Upper Mingading Covered Court & Practical Driving Circuit",
      slots: "25",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay Livelihood & Transport Desk: 09306259795",
      eligibility: lang === "tagalog"
        ? `1. Residente ng Barangay Upper Mingading (18 taong gulang pataas)\n2. May hawak na Valid Student Permit o Driver's License\n3. Medical Certificate (fit to drive & good eyesight)\n4. Dedicated na kumpletuhin ang 15-day theoretical at practical driving sessions.`
        : `1. Bonafide resident of Barangay Upper Mingading (18 years old and above)\n2. Holder of a Valid Student Permit or Driver's License\n3. Medical Certificate of Physical and Visual Fitness to drive\n4. Committed to completing the 15-day theoretical and practical driving curriculum.`,
      description: lang === "tagalog"
        ? `DRIVING NC II TRAINING OVERVIEW 🚗💨:\nLibreng pagsasanay at TESDA National Assessment para sa mga residenteng nais magkaroon ng professional Driving NC II qualification para sa trabaho bilang professional driver, delivery operator, o transport personnel.\n\nMGA MATUTUTUNAN (COURSE MODULES):\n- Traffic Rules, Road Signs, & LTO Regulations (TDC)\n- Defensive Driving & Hazard Avoidance\n- Pre-trip Vehicle Inspection & Troubleshooting\n- Parking Mastery (Parallel, Reverse, Hill Start)\n- Vehicle Maintenance & Road Safety Ethics\n\nBENEPISYO:\n- 100% Free Tuition & Free National Assessment\n- Certificate of Training & Endorsement for LTO Professional License Upgrading.`
        : `DRIVING NC II TRAINING OVERVIEW 🚗💨:\nComprehensive technical vocational driving course sponsored by TESDA and Barangay Upper Mingading.\n\nCOURSE MODULES:\n- LTO Traffic Laws, Road Signs & Defensive Driving Principles\n- Vehicle Pre-Trip Inspection & Mechanical Troubleshooting\n- Maneuvering & Parking Mastery (Parallel, Reverse, Uphill/Downhill)\n- Emergency Response & Road Safety Ethics\n\nBENEFITS:\n- 100% Free Tuition & Official TESDA NC II National Assessment\n- Endorsement for Professional Driver's License upgrading.`,
      language: lang,
    };
  }

  // 2. WELDING / SHIELDED METAL ARC WELDING (SMAW NC I / NC II)
  if (lower.includes("weld") || lower.includes("smaw") || lower.includes("bakal") || lower.includes("fabrication")) {
    return {
      title: cleanTitle || "TESDA Shielded Metal Arc Welding (SMAW NC II) Training",
      category: "Training",
      organization: "TESDA & Barangay Livelihood Committee",
      location: "Barangay Upper Mingading Technical Workshop Center",
      slots: "20",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay Livelihood Desk: 09306259795",
      eligibility: "1. Resident of Barangay Upper Mingading (18+ yrs old)\n2. High School graduate or ALS passer\n3. Physically fit with good eyesight.",
      description: "Hands-on welding course covering arc welding techniques, metal preparation, joint fabrication, safety protocols, and preparation for official TESDA NC II assessment.",
      language: lang,
    };
  }

  // 3. ELECTRICAL INSTALLATION & MAINTENANCE (EIM / SOLAR PV)
  if (lower.includes("electri") || lower.includes("kuryente") || lower.includes("eim") || lower.includes("solar") || lower.includes("wiring")) {
    return {
      title: cleanTitle || "Electrical Installation & Maintenance (EIM NC II) Program",
      category: "Training",
      organization: "TESDA & Department of Energy (DOE)",
      location: "Barangay Upper Mingading Skills Hub",
      slots: "25",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay Skills Coordinator: 09306259795",
      eligibility: "1. Resident of Barangay Upper Mingading (18-50 yrs old)\n2. Basic knowledge in tools\n3. Committed to full training duration.",
      description: "Comprehensive training in residential wiring, circuit breakers, conduit bending, electrical safety, and solar panel installation with free tools kit.",
      language: lang,
    };
  }

  // 4. COOKERY, BAKING, BREAD & PASTRY, FOOD PROCESSING
  if (lower.includes("bake") || lower.includes("baking") || lower.includes("bread") || lower.includes("pastry") || lower.includes("cook") || lower.includes("food") || lower.includes("lutuin")) {
    return {
      title: cleanTitle || "Bread & Pastry Production / Commercial Cookery NC II",
      category: "Training",
      organization: "TESDA, DTI Negosyo Center & Barangay GAD",
      location: "Barangay Upper Mingading Community Kitchen",
      slots: "25",
      deadline: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay Livelihood Committee: 09306259795",
      eligibility: "1. Resident of Barangay Upper Mingading (18+ yrs old)\n2. Interested in bakery business or commercial culinary\n3. Possesses food hygiene awareness.",
      description: "Hands-on commercial baking course: pastry making, cakes, commercial breads, costing, food safety, and free starter ingredients package.",
      language: lang,
    };
  }

  // 5. CAREGIVING / HEALTHCARE AIDE / HOUSEKEEPING
  if (lower.includes("caregiv") || lower.includes("care") || lower.includes("nurse") || lower.includes("housekeep") || lower.includes("health")) {
    return {
      title: cleanTitle || "Caregiving & Healthcare Support Services NC II",
      category: "Training",
      organization: "TESDA & Municipal Health Office",
      location: "Barangay Health Station & Livelihood Center",
      slots: "30",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay Health & Livelihood Focal Person: 09306259795",
      eligibility: "1. Resident of Upper Mingading (18-45 yrs old)\n2. High School graduate\n3. Passionate about elderly & infant care.",
      description: "Intensive training in vital signs monitoring, elderly care, pediatric assistance, first aid, and direct endorsement for local and overseas healthcare jobs.",
      language: lang,
    };
  }

  // 6. BEAUTY CARE, HAIRDRESSING, BARBERING, NAIL CARE
  if (lower.includes("hair") || lower.includes("barber") || lower.includes("gupit") || lower.includes("salon") || lower.includes("nail") || lower.includes("beauty")) {
    return {
      title: cleanTitle || "Beauty Care, Hairdressing & Barbering Livelihood Course",
      category: "Training",
      organization: "Barangay GAD & TESDA",
      location: "Barangay Upper Mingading Multi-Purpose Hall",
      slots: "25",
      deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay GAD Desk: 09306259795",
      eligibility: "1. Resident of Barangay Upper Mingading\n2. Open to women, youth, solo parents, and LGBTQ+ members\n3. Committed to attending all sessions.",
      description: "Complete salon & barbershop training: modern haircutting, styling, hair coloring, nail art, and business startup kit provided.",
      language: lang,
    };
  }

  // 7. SPES PROGRAM - PROVINCIAL GOVERNMENT OF COTABATO & DOLE (GOV. EMMYLOU "LALA" TALIÑO-MENDOZA)
  if (
    lower.includes("spes") ||
    lower.includes("special program") ||
    lower.includes("student employment") ||
    lower.includes("lala") ||
    lower.includes("mendoza") ||
    lower.includes("talino")
  ) {
    return {
      title: cleanTitle || "Special Program for Employment of Students (SPES) - Cotabato Province & DOLE",
      category: "Job",
      organization: 'Provincial Government of Cotabato (Gov. Hon. Emmylou "Lala" Taliño-Mendoza) & DOLE North Cotabato',
      location: "Barangay Upper Mingading Hall / Municipal PESO Office, North Cotabato",
      slots: "50",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay PESO Desk / Provincial Livelihood Focal Person: 09306259795",
      eligibility: lang === "tagalog"
        ? `1. Bonafide resident ng Barangay Upper Mingading, North Cotabato\n2. Edad 15 hanggang 30 taong gulang (High School, Senior High, College Student, o Out-of-School Youth na babalik sa pag-aaral)\n3. Ang pinagsamang annual net income ng magulang ay hindi lalampas sa regional poverty threshold\n4. Passing General Weighted Average (GWA) sa nakaraang school year/semester\n5. Physically at mentally fit sa pagsasagawa ng clerical o community support tasks.`
        : `1. Bonafide resident of Barangay Upper Mingading, North Cotabato\n2. 15 to 30 years of age (High School, Senior High, College Student, or Out-of-School Youth returning to school)\n3. Combined annual net income of parents does not exceed the regional poverty threshold\n4. Passing General Weighted Average (GWA) in the previous academic term\n5. Physically fit to perform clerical, administrative, or community support duties.`,
      description: lang === "tagalog"
        ? `SPES PROGRAM OVERVIEW 🎓💼:\nAng Special Program for Employment of Students (SPES) ay isang flagship employment bridging program ng Provincial Government of Cotabato sa ilalim ng pamumuno ni Governor Hon. Emmylou "Lala" Taliño-Mendoza katuwang ang Department of Labor and Employment (DOLE) at Barangay Upper Mingading.\n\nLAYUNIN NG PROGRAMA:\nMagbigay ng pansamantalang hanapbuhay tuwing bakasyon o enrollment season sa mga mahihirap ngunit karapat-dapat na mga kabataan upang magkaroon ng pondo para sa kanilang pag-aaral at matuto ng professional work ethics.\n\nSAHOD AT SALARY SHARING:\n• 60% ng sahod ay sasagutin ng Provincial Government of Cotabato / LGU\n• 40% ng sahod ay ibibigay ng DOLE sa pamamagitan ng educational vouchers / cash assistance\n• May kalakip na GSIS Group Personal Accident Insurance coverage.\n\nMGA KAILANGANG DOKUMENTO (REQUIREMENTS):\n1. SPES Application Form (available sa Barangay / PESO Office)\n2. Photocopy ng PSA Birth Certificate o Barangay Resident Certificate\n3. Form 138 / Copy of Grades (para sa high school) o Transcript / Enrollment Assessment Form (para sa college)\n4. Latest Income Tax Return (ITR) ng mga magulang o Certificate of Low Income / Indigency mula sa Barangay.`
        : `SPES PROGRAM OVERVIEW 🎓💼:\nThe Special Program for Employment of Students (SPES) is a flagship employment bridging initiative by the Provincial Government of Cotabato under the leadership of Governor Hon. Emmylou "Lala" Taliño-Mendoza, in active partnership with the Department of Labor and Employment (DOLE) and Barangay Upper Mingading.\n\nPROGRAM OBJECTIVES:\nTo provide temporary employment to underprivileged but deserving students and out-of-school youth, helping them earn income to finance their education while gaining public service work experience.\n\nSALARY & STIPEND SHARING SCHEME:\n• 60% of the wage is subsidized by the Provincial Government of Cotabato / LGU\n• 40% of the wage is paid by DOLE via educational vouchers / cash assistance\n• Inclusive of GSIS Group Personal Accident Insurance coverage.\n\nDOCUMENTARY REQUIREMENTS:\n1. Duly accomplished SPES Application Form\n2. Photocopy of PSA Birth Certificate or Barangay Resident Certificate\n3. Copy of Grades / Form 138 (High School) or Transcript of Records / Enrollment Assessment (College)\n4. Parents' latest ITR or Barangay Certificate of Low Income / Indigency.`,
      language: lang,
    };
  }

  // 8. TESDA ORGANIC FARMING / AGRICULTURE
  if (
    lower.includes("farm") ||
    lower.includes("agri") ||
    lower.includes("tanim") ||
    lower.includes("gulay") ||
    lower.includes("organic")
  ) {
    return {
      title: cleanTitle || "TESDA Organic Agriculture & Vegetable Farming Production",
      category: "Training",
      organization: "TESDA & Department of Agriculture (DA)",
      location: "Barangay Upper Mingading Multi-Purpose Hall & Demo Farm",
      slots: "35",
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay Livelihood Committee: 09306259795",
      eligibility: lang === "tagalog"
        ? "1. Residente ng Barangay Upper Mingading\n2. Edad 18 pataas\n3. Interesado sa Organic Agriculture at High-Value Crops\n4. Kayang tapusin ang training duration."
        : "1. Registered resident of Barangay Upper Mingading\n2. 18 years old and above\n3. Interested in sustainable organic farming\n4. Committed to completing the training course.",
      description: lang === "tagalog"
        ? `PROGRAM OVERVIEW 🌾:\nLibreng pagsasanay sa Organikong Pagsasaka mula sa TESDA at DA para sa mga residente ng Upper Mingading.\n\nMGA MATUTUTUNAN:\n- Organic fertilizer & concoctions making\n- Seedling nursery management & pest control\n- Post-harvest handling & farm marketing.\n\nBENEPISYO:\n- Libreng Training at Assessment (NC II)\n- Daily Training Allowance & Free Starter Kit.`
        : `PROGRAM OVERVIEW 🌾:\nA free technical vocational training program in Organic Agriculture Production sponsored by TESDA and the Department of Agriculture.\n\nBENEFITS:\n- 100% Free Tuition & NC II National Assessment\n- Daily training allowance and agricultural starter toolkit.`,
      language: lang,
    };
  }

  // 9. TUPAD / DOLE EMERGENCY WORK
  if (
    lower.includes("tupad") ||
    lower.includes("dole") ||
    lower.includes("emergency work") ||
    lower.includes("linis") ||
    lower.includes("community work")
  ) {
    return {
      title: cleanTitle || "DOLE-TUPAD Community Emergency Employment Program",
      category: "Job",
      organization: "Department of Labor and Employment (DOLE) & Barangay Council",
      location: "Barangay Upper Mingading (Assigned Purok Stations)",
      slots: "50",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay PESO Desk: 09306259795",
      eligibility: lang === "tagalog"
        ? "1. Residente ng Barangay Upper Mingading (Edad 18 - 60)\n2. Unemployed, underemployed, o displaced worker\n3. 1 miyembro lamang bawat pamilya."
        : "1. Resident of Barangay Upper Mingading (Ages 18 - 60)\n2. Displaced, underemployed, or seasonal worker\n3. Limit 1 beneficiary per household.",
      description: lang === "tagalog"
        ? `TUPAD PROGRAM ADVISORY 💼:\nAng TUPAD ay emergency employment program para sa displaced workers.\n\nTRABAHO: Paglilinis ng kanal, road maintenance, at community sanitation.\nBENEPISYO: Statutory daily minimum wage rate + GSIS insurance coverage.`
        : `TUPAD PROGRAM ADVISORY 💼:\nEmergency community employment for displaced and seasonal workers.\n\nDUTIES: Community cleaning, canal de-clogging, and roadside maintenance.\nBENEFITS: Statutory daily wage + GSIS accident insurance.`,
      language: lang,
    };
  }

  // 10. YOUTH DIGITAL SKILLS / TECH / BPO / VIRTUAL ASSISTANT
  if (
    lower.includes("tech") ||
    lower.includes("digital") ||
    lower.includes("call center") ||
    lower.includes("bpo") ||
    lower.includes("virtual") ||
    lower.includes("computer")
  ) {
    return {
      title: cleanTitle || "Youth Digital Skills & Virtual Assistant Training",
      category: "Training",
      organization: "DICT & Barangay Sangguniang Kabataan (SK)",
      location: "Barangay E-Library & Computer Training Hub",
      slots: "30",
      deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      contact: "SK Chairman & Digital Coordinator: 09306259795",
      eligibility: "1. Resident of Upper Mingading (Ages 18-35)\n2. Basic computer literacy\n3. High School graduate or College level.",
      description: "Comprehensive bootcamp on English communication, Virtual Assistance tools, CRM, and direct job endorsements to partner remote employers.",
      language: lang,
    };
  }

  // 11. WOMEN TAILORING / GAD
  if (
    lower.includes("sew") ||
    lower.includes("tailor") ||
    lower.includes("tahi") ||
    lower.includes("garment") ||
    lower.includes("women")
  ) {
    return {
      title: cleanTitle || "Women Sewing & Garment Tailoring Livelihood Workshop",
      category: "Program",
      organization: "DSWD & Barangay Gender and Development (GAD)",
      location: "Barangay Upper Mingading Women's Center",
      slots: "25",
      deadline: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
      contact: "Barangay GAD Focal Person: 09306259795",
      eligibility: "1. Women, homemakers, solo parents, or PWD residents\n2. 18 years old and above\n3. Interested in garment production.",
      description: "Hands-on industrial sewing machine training, pattern drafting, uniform and bag making with free sewing kit and fabric starter package.",
      language: lang,
    };
  }

  // 12. DEFAULT DYNAMIC VOCATIONAL TEMPLATE
  return {
    title: cleanTitle || "Barangay Livelihood & Skills Program",
    category: category || "Training",
    organization: "Barangay Upper Mingading Livelihood Committee",
    location: "Barangay Upper Mingading Covered Court / Training Hall",
    slots: "30",
    deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    contact: "Barangay Livelihood Desk: 09306259795",
    eligibility: `1. Bonafide resident of Barangay Upper Mingading (18+ years old)\n2. Valid Government ID or Barangay Resident Certificate\n3. Committed to completing the training course\n4. Willing to engage in productive community livelihood.`,
    description: `Official skills development & livelihood opportunity for ${cleanTitle || "our community"}.\n\nPROGRAM HIGHLIGHTS:\n- Professional coaching and practical hands-on application\n- Official Certificate of Completion\n- Startup toolkit and direct livelihood assistance endorsements.`,
    language: lang,
  };
};

const getSelectedResidentNames = (audience = "") => {
  if (!audience || (!audience.startsWith("Selected Resident:") && !audience.startsWith("Selected Residents:"))) {
    return [];
  }
  const namesStr = audience.replace(/^Selected Residents?:/, "").trim();
  if (!namesStr) return [];
  return namesStr.split(",").map((s) => s.trim()).filter(Boolean);
};

const buildLivelihoodSmsMessage = (post) =>
  [
    `Barangay Livelihood Alert`,
    post.title ? `Title: ${post.title}` : "",
    post.category ? `Category: ${post.category}` : "",
    post.organization ? `Org: ${post.organization}` : "",
    post.deadline ? `Deadline: ${formatDate(post.deadline)}` : "",
    `Apply now via your Resident Portal or visit Barangay Hall.`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);

const Livelihood = () => {
  const { confirm } = useConfirm();
  const [posts, setPosts] = useState([]);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  // Residents & Audience State
  const [residents, setResidents] = useState([]);
  const [residentSearchQuery, setResidentSearchQuery] = useState("");
  const [selectedPuroks, setSelectedPuroks] = useState([]);

  // Applications Review Modal State
  const [showAppsModal, setShowAppsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const [appStatusTab, setAppStatusTab] = useState("All");

  // AI Assistant & OCR Memo State
  const [aiGeneratedNotice, setAiGeneratedNotice] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [ocrPrompt, setOcrPrompt] = useState("");
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [extractedOcrText, setExtractedOcrText] = useState("");
  const [copyOcrStatus, setCopyOcrStatus] = useState(false);
  const fileInputRef = useRef(null);

  // Load residents
  useEffect(() => {
    let isMounted = true;
    const loadResidents = async () => {
      try {
        const data = await fetchResidents("", "", { excludeArchived: true });
        if (isMounted) setResidents(data || []);
      } catch (err) {
        if (isMounted) setResidents([]);
      }
    };
    loadResidents();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const [data, appCounts] = await Promise.all([
        fetchLivelihoodPosts({
          search,
          category: categoryFilter,
          status: statusFilter,
        }),
        fetchLivelihoodApplicationsCountsGrouped().catch(() => ({})),
      ]);
      setPosts(data || []);
      setApplicationCounts(appCounts || {});
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to load livelihood posts." });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadPosts, 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  // Real-time synchronization for application changes
  useEffect(() => {
    const unsubscribe = subscribeAdminNotificationChanges(() => {
      fetchLivelihoodApplicationsCountsGrouped()
        .then((counts) => setApplicationCounts(counts || {}))
        .catch(() => {});
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const stats = useMemo(
    () => ({
      total: posts.length,
      open: posts.filter((post) => post.status === "Open").length,
      jobs: posts.filter((post) => post.category === "Job").length,
      programs: posts.filter((post) => post.category === "Program").length,
    }),
    [posts]
  );

  // Audience matching
  const selectedResidentNames = useMemo(
    () => getSelectedResidentNames(formData.audience),
    [formData.audience]
  );

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

  const matchedTargetResidents = useMemo(() => {
    const aud = formData.audience || "All Residents";
    if (aud === "All Residents" || aud === "Registered Residents") return residents;
    if (aud === "Family Household Representatives") {
      return residents.filter((r) => String(r.relationship_to_household_head || "").toLowerCase() === "head");
    }
    if (aud === "Youth") {
      return residents.filter((r) => {
        const age = Number(r.age);
        return !isNaN(age) && age >= 15 && age <= 30;
      });
    }
    if (aud === "Senior Citizens") {
      return residents.filter((r) => {
        const age = Number(r.age);
        return !isNaN(age) && age >= 60;
      });
    }
    if (aud === "PWD/PWED Residents") {
      return residents.filter((r) => r.is_pwd === true || String(r.pwd_id || "").trim() !== "");
    }
    if (aud.startsWith("Purok: ")) {
      const targetPurok = aud.replace("Purok: ", "").trim();
      return residents.filter((r) => normalizePurokValue(r.purok) === normalizePurokValue(targetPurok));
    }
    if (aud.startsWith("Multiple Puroks") || aud.startsWith("Puroks: ")) {
      if (selectedPuroks.length === 0) return [];
      return residents.filter((r) =>
        selectedPuroks.some((p) => normalizePurokValue(r.purok) === normalizePurokValue(p))
      );
    }
    if (aud.startsWith("Selected Resident:") || aud.startsWith("Selected Residents:")) {
      return residents.filter((r) =>
        selectedResidentNames.includes((r.full_name || getResidentDisplayName(r)).trim())
      );
    }
    return residents;
  }, [formData.audience, residents, selectedPuroks, selectedResidentNames]);

  const targetPhones = useMemo(() => {
    const phones = matchedTargetResidents
      .filter((r) => hasPhone(r))
      .map((r) => normalizePhone(r.phone))
      .filter(Boolean);
    return [...new Set(phones)];
  }, [matchedTargetResidents]);

  const getAudienceSelectValue = (audience) => {
    if (!audience) return "All Residents";
    if (audience.startsWith("Selected Resident:") || audience.startsWith("Selected Residents:")) return "Selected Resident";
    if (audience.startsWith("Purok: ")) return audience;
    if (audience.startsWith("Multiple Puroks") || audience.startsWith("Puroks: ")) return "Multiple Puroks";
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

    const matched = residents.filter((r) =>
      nextNames.includes((r.full_name || getResidentDisplayName(r)).trim())
    );
    const phones = matched.map((r) => normalizePhone(r.phone)).filter(Boolean);

    setFormData((current) => ({
      ...current,
      audience: nextNames.length > 0 ? `Selected Residents: ${nextNames.join(", ")}` : "Selected Resident:",
      sms_recipient_phones: [...new Set(phones)].join("\n"),
    }));
  };

  const handleTogglePurok = (purokLabel) => {
    let nextPuroks = [];
    if (selectedPuroks.includes(purokLabel)) {
      nextPuroks = selectedPuroks.filter((p) => p !== purokLabel);
    } else {
      nextPuroks = [...selectedPuroks, purokLabel];
    }
    setSelectedPuroks(nextPuroks);

    const matched = residents.filter((r) =>
      nextPuroks.some((p) => normalizePurokValue(r.purok) === normalizePurokValue(p))
    );
    const phones = matched.map((r) => normalizePhone(r.phone)).filter(Boolean);

    setFormData((current) => ({
      ...current,
      audience: nextPuroks.length > 0 ? `Puroks: ${nextPuroks.join(", ")}` : "Multiple Puroks",
      sms_recipient_phones: [...new Set(phones)].join("\n"),
    }));
  };

  // AI Generator Handler (Supports Real-Time Gemini AI & Rich Vocational Templates)
  const handleAiGenerateDraft = async (customTitle = null) => {
    const targetTitle = (customTitle !== null ? customTitle : formData.title || "").trim();
    setAiGeneratedNotice(`✨ Generating intelligent draft for "${targetTitle || "Livelihood"}"...`);

    // 1. First attempt dynamic generation via Gemini AI if online
    if (targetTitle) {
      try {
        const aiPrompt = `You are an expert Livelihood, Job, and TESDA Skills Program Coordinator for Barangay Upper Mingading.
Create a complete, professional, realistic livelihood/job/training post for the title: "${targetTitle}".
Return ONLY a valid JSON object with the following keys:
{
  "title": "Full Official Title (e.g. ${targetTitle})",
  "category": "Training" | "Job" | "Program" | "Grant",
  "organization": "Partner Agency / Institution / Barangay Committee",
  "location": "Venue or training location in Barangay Upper Mingading",
  "slots": "Number of slots (e.g. 25)",
  "contact": "Barangay Livelihood Desk: 09306259795",
  "eligibility": "Numbered list of 3-4 realistic qualifications and requirements",
  "description": "Comprehensive structured program description with course highlights and benefits"
}`;

        const geminiRes = await generateText(aiPrompt, {
          temperature: 0.2,
          maxOutputTokens: 1024,
          timeoutMs: 6000,
        });

        const rawText = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (parsed && parsed.title && parsed.description) {
            setFormData((current) => ({
              ...current,
              title: parsed.title || current.title,
              category: parsed.category || current.category,
              organization: parsed.organization || current.organization,
              location: parsed.location || current.location,
              slots: String(parsed.slots || current.slots || "25"),
              deadline: current.deadline || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
              contact: parsed.contact || current.contact || "Barangay Livelihood Desk: 09306259795",
              eligibility: parsed.eligibility || current.eligibility,
              description: parsed.description || current.description,
            }));
            setAiGeneratedNotice(`✨ AI Livelihood Draft generated for ${parsed.title.slice(0, 32)}...`);
            setTimeout(() => setAiGeneratedNotice(""), 4500);
            return;
          }
        }
      } catch (err) {
        // Fallback gracefully to specialized local generator
      }
    }

    // 2. High-precision specialized local vocational template fallback
    const res = generateAiLivelihoodDraft(targetTitle, formData.category);
    setFormData((current) => ({
      ...current,
      title: res.title || current.title,
      category: res.category || current.category,
      organization: res.organization || current.organization,
      location: res.location || current.location,
      slots: res.slots || current.slots,
      deadline: res.deadline || current.deadline,
      contact: res.contact || current.contact,
      eligibility: res.eligibility || current.eligibility,
      description: res.description || current.description,
    }));
    const langLabel = res.language === "tagalog" ? "Tagalog 🇵🇭" : "English 🇺🇸";
    setAiGeneratedNotice(`✨ AI Livelihood Draft generated for ${res.title.slice(0, 32)}... (${langLabel})`);
    setTimeout(() => setAiGeneratedNotice(""), 4500);
  };

  // OCR Memo Upload Handlers
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setAttachedFile({
        name: file.name,
        type: file.type,
        size: (file.size / 1024).toFixed(1) + " KB",
        base64,
        previewUrl: file.type.startsWith("image/") ? base64 : null,
      });
      setExtractedOcrText("");
      setOcrPrompt("Extract all text and details from this memo, then draft a livelihood and job post.");
    };
    reader.readAsDataURL(file);
  };

  const parseExtractedDetails = (text = "") => {
    const raw = String(text || "").trim();
    if (!raw) return null;

    // 1. Try finding JSON block
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const candidate = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (candidate && typeof candidate === "object") {
          return candidate;
        }
      } catch (e) {
        // continue to heuristic parser
      }
    }

    // 2. Heuristic extraction from labeled / formatted text
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    let title = "";
    let category = "Program";
    let organization = "Barangay Upper Mingading";
    let location = "Barangay Hall / Municipal PESO";
    let slots = "";
    let deadline = "";
    let contact = "Barangay Livelihood Focal Person: 09306259795";
    let eligibility = "";

    const findValueAfter = (patterns) => {
      for (const line of lines) {
        for (const p of patterns) {
          const match = line.match(new RegExp(`^(?:[#*•\\-\\s]*)${p}\\s*[:=-]\\s*(.+)`, "i"));
          if (match && match[1]) {
            return match[1].replace(/[*_#`]/g, "").trim();
          }
        }
      }
      return "";
    };

    // Extract Title
    title = findValueAfter(["title", "program title", "job title", "activity", "subject", "pamagat", "memo subject", "document", "name of program"]);
    if (!title && lines.length > 0) {
      const candidateLine = lines.find((l) => !l.startsWith("---") && l.length > 5 && l.length < 90 && !l.toLowerCase().includes("extracted text"));
      if (candidateLine) {
        title = candidateLine.replace(/^[#*•\-\s]+/, "").replace(/[*_#`]/g, "").trim();
      }
    }

    // Extract Organization / Sponsor
    const orgFound = findValueAfter(["organization", "sponsor", "organizer", "agency", "office", "partner", "department"]);
    if (orgFound) organization = orgFound;
    else if (raw.toLowerCase().includes("tesda")) organization = "TESDA / Provincial Govt of Cotabato";
    else if (raw.toLowerCase().includes("dole") || raw.toLowerCase().includes("tupad") || raw.toLowerCase().includes("spes")) organization = "DOLE / LGU Aleosan PESO";
    else if (raw.toLowerCase().includes("dti")) organization = "DTI / LGU Aleosan";

    // Extract Location
    const locFound = findValueAfter(["location", "venue", "place", "address", "saan", "lugar"]);
    if (locFound) location = locFound;

    // Extract Slots
    const slotsFound = findValueAfter(["slots", "available slots", "open slots", "quota", "bilang ng slots"]);
    if (slotsFound) {
      const numOnly = slotsFound.match(/\d+/);
      if (numOnly) slots = numOnly[0];
    }

    // Extract Deadline
    const deadlineFound = findValueAfter(["deadline", "due date", "until", "last day of submission", "petsa ng deadline"]);
    if (deadlineFound) deadline = deadlineFound;

    // Extract Contact
    const contactFound = findValueAfter(["contact", "contact person", "phone", "hotline", "mobile", "inquiries"]);
    if (contactFound) contact = contactFound;

    // Extract Eligibility
    const eligFound = findValueAfter(["eligibility", "qualifications", "requirements", "criteria", "who can apply"]);
    if (eligFound) eligibility = eligFound;
    else {
      // Pick numbered list items
      const listItems = lines.filter((l) => /^\d+\.\s+|^-\s+|^•\s+/.test(l));
      if (listItems.length > 0) {
        eligibility = listItems.slice(0, 4).join("\n");
      }
    }

    // Infer Category
    const lowerRaw = raw.toLowerCase();
    if (lowerRaw.includes("training") || lowerRaw.includes("scholarship") || lowerRaw.includes("course") || lowerRaw.includes("skills") || lowerRaw.includes("tesda")) {
      category = "Training";
    } else if (lowerRaw.includes("job") || lowerRaw.includes("hiring") || lowerRaw.includes("vacancy") || lowerRaw.includes("employment") || lowerRaw.includes("worker") || lowerRaw.includes("staff")) {
      category = "Job";
    } else if (lowerRaw.includes("grant") || lowerRaw.includes("tupad") || lowerRaw.includes("ayuda") || lowerRaw.includes("cash") || lowerRaw.includes("financial assistance")) {
      category = "Grant";
    } else {
      category = "Program";
    }

    return {
      title: title || "Official Barangay Livelihood Program",
      category,
      status: "Open",
      organization,
      location,
      slots,
      deadline,
      contact,
      eligibility: eligibility || "1. Bonafide resident of Barangay Upper Mingading\n2. Must present valid government / resident ID",
      description: raw,
    };
  };

  const handleScanOcrMemo = async () => {
    if (!attachedFile?.base64) return;
    setIsScanningOcr(true);
    setExtractedOcrText("");

    try {
      const systemInstruction = `You are an expert AI Document OCR & Livelihood Form Assistant for Barangay Upper Mingading.
Read the provided memo, circular, or form image/document.
Extract all key details and return a clean JSON object with the following fields:
{
  "title": "Clean, concise title of the program, job, training, or livelihood post (e.g. SPES Summer Employment Program 2026, TESDA Free Agriculture Training)",
  "category": "One of: Job, Training, Grant, Program",
  "status": "One of: Open, Ongoing, Completed, Closed",
  "organization": "Sponsor or organizing agency (e.g. Provincial Government of Cotabato, DOLE, TESDA, Barangay Upper Mingading)",
  "location": "Venue or application location (e.g. Barangay Hall / Municipal PESO)",
  "slots": "Number of slots if mentioned (e.g. 50) or empty string",
  "deadline": "Deadline in YYYY-MM-DD format if mentioned, or empty string",
  "contact": "Contact person or office hotline (e.g. Barangay Livelihood Focal Person: 09306259795)",
  "eligibility": "Numbered list of qualifications, age limits, and criteria",
  "description": "Full program description, objectives, requirements to bring, and application steps",
  "rawText": "Complete readable text from the document"
}`;

      const userPrompt = `${ocrPrompt || "Extract all details from this memo."}\n\nPlease output the extracted details in structured JSON so all form fields are auto-filled.`;

      const result = await generateText(userPrompt, {
        systemInstruction,
        fileData: {
          mimeType: attachedFile.type || "image/jpeg",
          data: attachedFile.base64,
        },
        maxOutputTokens: 2048,
      });

      const extracted =
        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
        result?.text ||
        "No text could be extracted from this document.";

      const parsed = parseExtractedDetails(extracted);

      if (parsed) {
        setFormData((prev) => ({
          ...prev,
          title: parsed.title || prev.title,
          category: ["Job", "Training", "Grant", "Program"].includes(parsed.category) ? parsed.category : prev.category,
          status: ["Open", "Ongoing", "Completed", "Closed"].includes(parsed.status) ? parsed.status : prev.status,
          organization: parsed.organization || prev.organization,
          location: parsed.location || prev.location,
          slots: parsed.slots ? String(parsed.slots) : prev.slots,
          deadline: parsed.deadline || prev.deadline,
          contact: parsed.contact || prev.contact,
          eligibility: parsed.eligibility || prev.eligibility,
          description: parsed.description || prev.description,
        }));
        setExtractedOcrText(parsed.rawText || parsed.description || extracted);
        setAiGeneratedNotice("✨ Memo scanned and ALL form fields auto-filled!");
        setTimeout(() => setAiGeneratedNotice(""), 4500);
      } else {
        setExtractedOcrText(extracted);
      }
    } catch (err) {
      console.error("OCR scanning error:", err);
      setExtractedOcrText(
        `⚠️ Document OCR Scanning Notice: ${err.message || "Failed to process document image."}`
      );
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleCopyExtractedText = async () => {
    if (!extractedOcrText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(extractedOcrText);
        setCopyOcrStatus(true);
        setTimeout(() => setCopyOcrStatus(false), 3000);
      }
    } catch {
      // ignore clipboard error in restricted webviews
    }
  };

  const handleApplyExtractedTextToForm = () => {
    if (!extractedOcrText) return;
    const parsed = parseExtractedDetails(extractedOcrText);
    if (parsed) {
      setFormData((prev) => ({
        ...prev,
        title: parsed.title || prev.title,
        category: ["Job", "Training", "Grant", "Program"].includes(parsed.category) ? parsed.category : prev.category,
        status: ["Open", "Ongoing", "Completed", "Closed"].includes(parsed.status) ? parsed.status : prev.status,
        organization: parsed.organization || prev.organization,
        location: parsed.location || prev.location,
        slots: parsed.slots ? String(parsed.slots) : prev.slots,
        deadline: parsed.deadline || prev.deadline,
        contact: parsed.contact || prev.contact,
        eligibility: parsed.eligibility || prev.eligibility,
        description: parsed.description || prev.description,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        description: prev.description ? `${prev.description}\n\n--- EXTRACTED MEMO DETAILS ---\n${extractedOcrText}` : extractedOcrText,
      }));
    }
    setAiGeneratedNotice("✅ Extracted details auto-filled into all form fields!");
    setTimeout(() => setAiGeneratedNotice(""), 4000);
  };

  const openCreate = () => {
    setEditingPost(null);
    setFormData(initialForm);
    setSelectedPuroks([]);
    setAttachedFile(null);
    setExtractedOcrText("");
    setMessage(null);
    setShowModal(true);
  };

  const openEdit = (post) => {
    setEditingPost(post);
    setFormData({
      title: post.title || "",
      category: post.category || "Program",
      organization: post.organization || "",
      description: post.description || "",
      eligibility: post.eligibility || "",
      slots: post.slots?.toString() || "",
      location: post.location || "",
      contact: post.contact || "",
      status: post.status || "Open",
      deadline: post.deadline || "",
      audience: post.audience || "All Residents",
      sms_recipient_phones: post.sms_recipient_phones || "",
    });
    setSelectedPuroks([]);
    setAttachedFile(null);
    setExtractedOcrText("");
    setMessage(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPost(null);
    setFormData(initialForm);
    setSelectedPuroks([]);
    setAttachedFile(null);
    setExtractedOcrText("");
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async (shouldPublish = true) => {
    setSaving(true);
    setMessage(null);

    try {
      const targetStatus = shouldPublish ? "Open" : "Draft";
      const payload = {
        ...formData,
        status: targetStatus,
        slots: formData.slots === "" || formData.slots == null ? null : Number(formData.slots),
      };

      let savedData;
      if (editingPost) {
        savedData = await updateLivelihoodPost(editingPost.id, payload);
      } else {
        savedData = await createLivelihoodPost(payload);
      }

      if (shouldPublish) {
        // Send in-app notifications
        notifyResidentsForLivelihoodPost(savedData, matchedTargetResidents).catch(() => {});

        // Send SMS notifications
        if (targetPhones.length > 0) {
          sendBulkSmsNotifications({
            recipients: targetPhones,
            body: buildLivelihoodSmsMessage(savedData),
          }).catch((err) => console.warn("Background SMS notice:", err.message));
        }
      }

      setMessage({
        type: "success",
        text: shouldPublish
          ? `Livelihood opportunity "${savedData.title}" published successfully!`
          : "Livelihood post saved as Draft.",
      });

      closeModal();
      await loadPosts();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to save livelihood post." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;

    try {
      await deleteLivelihoodPost(post.id);
      setMessage({ type: "success", text: "Livelihood post deleted." });
      await loadPosts();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to delete livelihood post." });
    }
  };

  // Open Applications Review Modal
  const openApplications = async (post) => {
    setSelectedPost(post);
    setShowAppsModal(true);
    setAppsLoading(true);
    setAppSearch("");
    setAppStatusTab("All");
    try {
      const data = await fetchLivelihoodApplications({ livelihoodId: post.id });
      setApplications(data || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load applications." });
    } finally {
      setAppsLoading(false);
    }
  };

  const handleUpdateAppStatus = async (appId, newStatus, residentId) => {
    try {
      await updateLivelihoodApplicationStatus(appId, newStatus, residentId, selectedPost?.title);
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app))
      );
      fetchLivelihoodApplicationsCountsGrouped()
        .then((counts) => setApplicationCounts(counts || {}))
        .catch(() => {});
      setMessage({ type: "success", text: `Application ${newStatus.toLowerCase()} successfully.` });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update application status." });
    }
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchTab = appStatusTab === "All" || app.status === appStatusTab;
      const q = appSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        [app.residents?.full_name, app.residents?.purok, app.residents?.phone, app.residents?.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchTab && matchSearch;
    });
  }, [applications, appStatusTab, appSearch]);

  const appStats = useMemo(
    () => ({
      total: applications.length,
      pending: applications.filter((a) => a.status === "Pending").length,
      approved: applications.filter((a) => a.status === "Approved").length,
      rejected: applications.filter((a) => a.status === "Rejected").length,
    }),
    [applications]
  );

  return (
    <div className="min-h-screen bg-transparent">
      <Header
        title="Livelihood & Jobs"
        subtitle="Manage programs, trainings, and job opportunities with AI assistance & application reviews"
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {message ? (
          <div
            className={`glass-panel mb-5 p-4 text-sm font-semibold shadow-soft ${
              message.type === "success"
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/50"
                : "bg-rose-50/80 text-rose-700 border-rose-200/50"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="glass-container mt-6">
          <div className="flex items-center justify-between border-b border-slate-200/50 bg-slate-50/50 px-6 py-4">
            <div className="text-sm font-bold text-slate-700">Livelihood & Employment Board</div>
            <div>
              <button
                type="button"
                onClick={openCreate}
                className="strict-button-hover inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14532D] to-[#0F4324] hover:brightness-110 px-5 py-2.5 text-xs font-bold text-white transition shadow-md cursor-pointer active:scale-95"
              >
                <Plus size={16} />
                Add Livelihood Post
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 border-b border-slate-200/50 flex flex-wrap items-center gap-3 bg-white/20">
            <div className="relative w-full sm:w-72 md:w-80">
              <Search className="absolute left-3.5 top-3 text-emerald-600" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search livelihood & jobs..."
                className="w-full h-[40px] rounded-[12px] border border-slate-200 bg-white/80 pl-9 pr-3 text-xs sm:text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 shadow-xs"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-[40px] w-full sm:w-40 rounded-[12px] border border-slate-200 bg-white/80 px-3 text-xs sm:text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 shadow-xs cursor-pointer"
            >
              <option value="">All categories</option>
              <option value="Program">Program</option>
              <option value="Job">Job</option>
              <option value="Training">Training</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-[40px] w-full sm:w-36 rounded-[12px] border border-slate-200 bg-white/80 px-3 text-xs sm:text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 shadow-xs cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 p-6 border-b border-slate-200/50 bg-slate-50/20">
            {[
              ["Total Posts", stats.total, Briefcase, "bg-slate-100 text-slate-600"],
              ["Open", stats.open, Calendar, "bg-emerald-100 text-emerald-600"],
              ["Jobs", stats.jobs, Briefcase, "bg-blue-100 text-blue-600"],
              ["Programs", stats.programs, GraduationCap, "bg-amber-100 text-amber-600"],
            ].map(([label, value, Icon, colorClass]) => (
              <div key={label} className="relative overflow-hidden group">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110 ${colorClass}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-900 leading-none">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">
                <Loader className="mx-auto mb-3 animate-spin" size={24} />
                Loading livelihood posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="p-10 text-center text-slate-500 font-semibold bg-white/40 rounded-xl">No livelihood or job posts found.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => {
                  const borderColor = post.status === "Open" ? "#10B981" : post.status === "Draft" ? "#F59E0B" : "#94A3B8";
                  const appSummary = applicationCounts[post.id] || { total: 0, pending: 0, approved: 0, rejected: 0 };
                  const totalApplicants = appSummary.total || 0;
                  const pendingApplicants = appSummary.pending || 0;

                  return (
                    <article
                      key={post.id}
                      className="relative rounded-[20px] bg-white/60 border border-slate-200/60 p-6 flex flex-col group overflow-hidden border-l-[6px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                      style={{ borderLeftColor: borderColor }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            {post.category}
                          </span>
                          <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusClass(post.status)}`}>
                            {post.status}
                          </span>
                        </div>
                        {totalApplicants > 0 && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black shadow-xs ${
                            pendingApplicants > 0 
                              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 animate-pulse" 
                              : "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                          }`}>
                            <Users size={12} className={pendingApplicants > 0 ? "text-amber-700" : "text-emerald-700"} />
                            <span>{totalApplicants} {totalApplicants === 1 ? "Applicant" : "Applicants"}</span>
                            {pendingApplicants > 0 && (
                              <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[9px] font-extrabold">
                                {pendingApplicants} New
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-slate-800 line-clamp-2 mb-2">{post.title}</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 line-clamp-3 mb-6 flex-1">
                        {post.description || "No description provided."}
                      </p>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-medium text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Organization</p>
                          <p className="text-slate-700 truncate font-semibold" title={post.organization || "-"}>{post.organization || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Location</p>
                          <p className="text-slate-700 truncate font-semibold" title={post.location || "-"}>{post.location || "-"}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Deadline</p>
                          <p className="text-slate-700 font-semibold">{formatDate(post.deadline)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold mb-0.5">Slots & Applicants</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-700 font-bold">{post.slots ?? "Open"}</span>
                            <span className="text-[10px] text-slate-400 font-medium">slots</span>
                            {totalApplicants > 0 && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                post.slots && totalApplicants >= post.slots 
                                  ? "bg-rose-100 text-rose-800 border border-rose-200" 
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                • {totalApplicants} applied
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-auto">
                        <button
                          type="button"
                          onClick={() => openApplications(post)}
                          className={`inline-flex w-full h-[40px] items-center justify-center gap-2 rounded-xl border text-xs font-black transition cursor-pointer shadow-xs ${
                            totalApplicants > 0
                              ? "bg-gradient-to-r from-emerald-100/90 via-teal-50 to-emerald-50 text-emerald-950 border-emerald-300 hover:border-emerald-400 hover:shadow-md active:scale-98"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          <Briefcase size={15} className={totalApplicants > 0 ? "text-emerald-700" : "text-slate-500"} />
                          <span>View Applications</span>
                          {totalApplicants > 0 ? (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#FFB800] text-slate-950 text-[10.5px] font-black shadow-sm ring-2 ring-white animate-pulse">
                              {totalApplicants}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              (0)
                            </span>
                          )}
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(post)}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-blue-600 transition hover:bg-slate-50 hover:border-blue-200 cursor-pointer"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(post)}
                            className="inline-flex flex-1 h-[38px] items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={14} /> Delete
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

      {/* MODERN PORTRAIT APPLICATIONS REVIEW MODAL (COMPACT & SLIM) */}
      <FloatingModal
        open={showAppsModal}
        onClose={() => setShowAppsModal(false)}
        title={selectedPost?.title ? `Applications: ${selectedPost.title}` : "Applications Review"}
        eyebrow="Resident Applications Desk"
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-between w-full text-xs">
            <span className="text-[11px] text-slate-500 font-semibold">
              {filteredApplications.length} of {applications.length} applicant(s)
            </span>
            <button
              type="button"
              onClick={() => setShowAppsModal(false)}
              className="px-4 py-1.5 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer border border-slate-200 text-xs"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* SUPER COMPACT MINI STAT RIBBON */}
          <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <div className="py-1">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 block">Total</span>
              <p className="text-xs font-black text-slate-900 mt-0.5">{appStats.total}</p>
            </div>
            <div className="py-1 bg-amber-50 rounded-xl border border-amber-200/70">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-amber-700 block">Pending</span>
              <p className="text-xs font-black text-amber-900 mt-0.5">{appStats.pending}</p>
            </div>
            <div className="py-1 bg-emerald-50 rounded-xl border border-emerald-200/70">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-700 block">Approved</span>
              <p className="text-xs font-black text-emerald-900 mt-0.5">{appStats.approved}</p>
            </div>
            <div className="py-1 bg-rose-50 rounded-xl border border-rose-200/70">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-rose-700 block">Rejected</span>
              <p className="text-xs font-black text-rose-900 mt-0.5">{appStats.rejected}</p>
            </div>
          </div>

          {/* COMPACT FILTER PILLS & SEARCH (PORTRAIT STACK) */}
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
              {["All", "Pending", "Approved", "Rejected"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAppStatusTab(tab)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer text-center ${
                    appStatusTab === tab
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative w-full">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search applicant name, purok..."
                style={{ paddingLeft: "34px" }}
                className="w-full h-8.5 pr-3 text-xs rounded-xl border border-slate-200 bg-white font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
              />
            </div>
          </div>

          {/* PORTRAIT APPLICANT CARDS */}
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-0.5">
            {appsLoading ? (
              <div className="py-8 text-center text-slate-500 font-bold text-xs">
                <Loader className="mx-auto animate-spin mb-2 text-emerald-600" size={20} />
                Loading applications...
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <Users size={26} className="mx-auto text-slate-400 mb-1" />
                <p className="font-bold text-xs text-slate-700">No applicants found</p>
                <p className="text-[10.5px] text-slate-500">
                  {applications.length === 0
                    ? "Resident applications will appear here."
                    : "No applicants match this filter."}
                </p>
              </div>
            ) : (
              filteredApplications.map((app) => {
                const residentName = app.residents?.full_name || "Resident Applicant";
                const phone = app.residents?.phone || "";
                const purok = app.residents?.purok || "Upper Mingading";
                const house = app.residents?.house_no || "";

                return (
                  <div
                    key={app.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                          {residentName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate leading-snug">{residentName}</h4>
                          <p className="text-[10px] text-slate-500 truncate">{purok} {house ? `• House ${house}` : ""}</p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider shrink-0 ${
                          app.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : app.status === "Rejected"
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-slate-400" />
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </span>
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Phone size={10} />
                          <span>{phone}</span>
                        </a>
                      )}
                    </div>

                    {/* STATUS ACTION BUTTONS */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      {app.status === "Pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateAppStatus(app.id, "Approved", app.resident_id)}
                            className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Check size={12} />
                            <span>Approve & List</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateAppStatus(app.id, "Rejected", app.resident_id)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 text-[11px] font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <X size={12} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateAppStatus(app.id, "Pending", app.resident_id)}
                          className="w-full text-center text-[10.5px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer py-0.5"
                        >
                          Reset to Pending
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </FloatingModal>

      {/* COMPACT, PRO FLOATING MODAL FOR ADD / EDIT LIVELIHOOD POST */}
      <FloatingModal
        open={showModal}
        onClose={closeModal}
        title={editingPost ? "Edit Livelihood / Job Post" : "Add Livelihood or Job Post"}
        maxWidth="max-w-3xl"
        eyebrow="Livelihood & Skills Desk"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-600" />
              <span>Audience: {matchedTargetResidents.length} Resident(s)</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {saving ? <Loader size={14} className="animate-spin" /> : null}
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#14532D] via-[#157347] to-[#0F4324] px-5 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60 shadow-md cursor-pointer active:scale-95"
              >
                {saving ? <Loader size={14} className="animate-spin" /> : <Send size={13} />}
                <span>🚀 Publish Post</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-slate-900">
          
          {/* AI ASSISTANT & OCR MEMO UPLOAD BAR (COMPACT & PRO) */}
          <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-blue-50/90 p-3.5 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm shrink-0">
                  <Sparkles size={16} className="animate-pulse" />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <span>KaagapA.I Livelihood & Memo Assistant</span>
                    <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900 font-black">AI OCR</span>
                  </h4>
                  <p className="text-[10.5px] font-semibold text-indigo-800">
                    Auto-drafts SPES Cotabato, TESDA & TUPAD or upload memo images to extract text.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="livelihood-memo-upload"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-indigo-900 hover:bg-indigo-50 font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                  title="Upload image, document, or file"
                >
                  <Plus size={14} className="text-purple-600 font-black" />
                  <Paperclip size={12} className="text-indigo-600" />
                  <span>Attach File</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAiGenerateDraft()}
                  className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f3e21] text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                  title="Generate Livelihood Draft based on Title"
                >
                  <span>Generate</span>
                </button>
              </div>
            </div>

            {/* Quick Idea Preset Chips including North Cotabato SPES */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5 text-[10.5px] font-bold">
              <span className="text-slate-500 uppercase tracking-wider text-[9px] mr-0.5">Presets:</span>
              {[
                { label: "🎓 SPES Cotabato", title: "Special Program for Employment of Students (SPES) - Cotabato Province" },
                { label: "🌾 TESDA Farming", title: "TESDA Organic Agriculture & Vegetable Farming Production" },
                { label: "💼 TUPAD Work", title: "DOLE-TUPAD Community Emergency Employment Program" },
                { label: "💻 Youth Tech / BPO", title: "Youth Digital Skills & Virtual Assistant Training" },
                { label: "🧵 Women Tailoring", title: "Women Sewing & Garment Tailoring Workshop" },
                { label: "🛠️ SMAW Welding", title: "TESDA Shielded Metal Arc Welding NC II Training" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleAiGenerateDraft(chip.title)}
                  className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 hover:bg-indigo-600 hover:text-white transition shadow-2xs cursor-pointer active:scale-95 text-[10.5px]"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* OCR FILE ATTACHMENT / EXTRACTION PANEL */}
            {attachedFile && (
              <div className="p-2.5 rounded-xl bg-white border border-purple-200 shadow-xs space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {attachedFile.previewUrl ? (
                      <img
                        src={attachedFile.previewUrl}
                        alt="Memo Preview"
                        className="h-8 w-8 object-cover rounded-md border border-purple-200 shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                        <FileText size={16} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{attachedFile.name}</p>
                      <span className="text-[9.5px] text-slate-500 block">{attachedFile.size}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleScanOcrMemo}
                      disabled={isScanningOcr}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-60"
                    >
                      {isScanningOcr ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      <span>{isScanningOcr ? "Scanning..." : "✨ Scan & Extract Memo Text"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Remove file"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {extractedOcrText && (
                  <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-purple-950">Extracted Text:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleCopyExtractedText}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-purple-200 text-purple-800 text-[10px] font-bold hover:bg-purple-100 transition cursor-pointer"
                        >
                          {copyOcrStatus ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          <span>{copyOcrStatus ? "Copied!" : "Copy Text"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyExtractedTextToForm}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 transition cursor-pointer"
                        >
                          <CheckCircle2 size={11} />
                          <span>Insert into Description</span>
                        </button>
                      </div>
                    </div>
                    <pre className="max-h-28 overflow-y-auto text-[10.5px] text-slate-700 whitespace-pre-wrap font-sans bg-white p-2 rounded border border-purple-100">
                      {extractedOcrText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {aiGeneratedNotice && (
              <div className="rounded-lg px-2.5 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 size={13} className="text-emerald-700 shrink-0" />
                <span>{aiGeneratedNotice}</span>
              </div>
            )}
          </div>

          {/* MAIN FORM INPUTS (COMPACT GRID) */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-bold text-slate-700">
              Title *
              <input
                name="title"
                value={formData.title}
                onChange={handleInput}
                placeholder="e.g., SPES Program, TESDA Organic Farming, TUPAD"
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Category
              <select
                name="category"
                value={formData.category}
                onChange={handleInput}
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="Program">Program</option>
                <option value="Job">Job</option>
                <option value="Training">Training</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700">
              Status
              <select
                name="status"
                value={formData.status}
                onChange={handleInput}
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Draft">Draft</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-700">
              Organization / Sponsor
              <input
                name="organization"
                value={formData.organization}
                onChange={handleInput}
                placeholder="e.g., Provincial Govt of Cotabato, DOLE, TESDA"
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Location / Venue
              <input
                name="location"
                value={formData.location}
                onChange={handleInput}
                placeholder="e.g., Barangay Hall / Municipal PESO"
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Slots Available
              <input
                name="slots"
                type="number"
                min="0"
                value={formData.slots}
                onChange={handleInput}
                placeholder="e.g., 50"
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <label className="text-xs font-bold text-slate-700">
              Deadline
              <input
                name="deadline"
                type="date"
                value={formData.deadline}
                onChange={handleInput}
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <label className="sm:col-span-2 text-xs font-bold text-slate-700">
              Contact Person / Phone
              <input
                name="contact"
                value={formData.contact}
                onChange={handleInput}
                placeholder="e.g., Barangay Livelihood Focal Person: 09306259795"
                className="mt-1 w-full h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </label>

            <label className="sm:col-span-2 text-xs font-bold text-slate-700">
              Qualifications & Eligibility
              <textarea
                name="eligibility"
                value={formData.eligibility}
                onChange={handleInput}
                rows="2"
                placeholder="e.g., 1. Bonafide resident of Barangay Upper Mingading..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white leading-relaxed"
              />
            </label>

            <label className="sm:col-span-2 text-xs font-bold text-slate-700">
              Program Description & Requirements
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInput}
                rows="4"
                placeholder="Detailed objectives, benefits, and documentary requirements..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium outline-none transition focus:border-emerald-500 focus:bg-white leading-relaxed"
              />
            </label>
          </div>

          {/* AUDIENCE FILTER (STREAMLINED & CLEAN) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users size={14} className="text-emerald-700" />
                Target Audience Filter:
              </span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {matchedTargetResidents.length} Residents ({targetPhones.length} SMS ready)
              </span>
            </div>

            <select
              value={getAudienceSelectValue(formData.audience)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Multiple Puroks") {
                  setSelectedPuroks(["Purok 1"]);
                  setFormData((cur) => ({ ...cur, audience: "Puroks: Purok 1" }));
                } else if (val === "Selected Resident") {
                  setFormData((cur) => ({ ...cur, audience: "Selected Resident:" }));
                } else {
                  setFormData((cur) => ({ ...cur, audience: val }));
                }
              }}
              className="w-full h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-emerald-500"
            >
              {audienceOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {/* Multiple Puroks Pills */}
            {getAudienceSelectValue(formData.audience) === "Multiple Puroks" && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {purokDefinitions.map((p) => {
                  const isSelected = selectedPuroks.includes(p.label);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleTogglePurok(p.label)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                        isSelected ? "bg-emerald-700 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {isSelected && <Check size={11} />}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Resident Search */}
            {getAudienceSelectValue(formData.audience) === "Selected Resident" && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={residentSearchQuery}
                  onChange={(e) => setResidentSearchQuery(e.target.value)}
                  placeholder="Search resident name..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white outline-none"
                />
                <div className="max-h-32 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                  {filteredFormResidents.map((r) => {
                    const rName = (r.full_name || getResidentDisplayName(r)).trim();
                    const isChecked = selectedResidentNames.includes(rName);
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleToggleSelectedResident(r)}
                        className={`flex items-center justify-between p-1.5 rounded text-[11px] cursor-pointer ${
                          isChecked ? "bg-emerald-50 text-emerald-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded pointer-events-none"
                          />
                          <span>{rName}</span>
                          <span className="text-[9.5px] text-slate-400">({r.purok || "N/A"})</span>
                        </div>
                        <span className="text-[9.5px] font-mono text-slate-500">{r.phone || "No phone"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </FloatingModal>
    </div>
  );
};

export default Livelihood;
