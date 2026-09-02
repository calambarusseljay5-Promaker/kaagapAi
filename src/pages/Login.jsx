import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  UserRound,
  Upload,
  CheckCircle2,
  Phone,
  FileText,
  AlertCircle,
  FileCheck2,
  User,
  MapPin,
  Heart,
  Menu,
  X,
  LogIn,
  Check,
  ArrowLeft,
  Maximize2,
  Sparkles,
  Calendar,
  Award,
  ExternalLink,
  Info,
  Users,
  Target,
  Compass,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import { useBarangayLogo } from "../services/logoService";
import { supabase } from "../lib/supabaseClient";
import FloatingModal from "../components/FloatingModal";
import BarangayCarousel, { DEFAULT_SHOWCASE_SLIDES } from "../components/BarangayCarousel";
import { clearAuthSession, getAdminSession, loginUser, resetPassword } from "../services/authService";
import {
  clearResidentSession,
  getResidentSession,
  loginResident,
  requestResidentActivation,
  validateResidentRegistrationProof,
  resetResidentPasswordByPhone,
  sendResidentForgotOTP,
  verifyResidentForgotOTP,
} from "../services/residentAuthService";
import { isValidSmsPhone, normalizeSmsPhone } from "../services/smsService";
import { getDashboardPathForRole, isTargetAdminPortal } from "../utils/authRoutes";
import {
  buildFullName,
  calculateAge,
  civilStatusOptions,
  educationalAttainmentOptions,
  formatPurok,
  getCustomPurokDefinitions,
  householdRelationshipOptions,
  purokOptions,
  sexOptions,
  standardOccupationOptions,
} from "../utils/residentProfile";
import { getSystemSettings } from "../services/adminActivityService";
import ReCAPTCHA from "react-google-recaptcha";
import {
  checkLoginAllowed,
  recordFailedAttempt,
  clearFailedAttempts,
  logSecurityEvent,
} from "../services/securityService";

const stepHeaders = [
  { label: "Personal Info", icon: User },
  { label: "Address & Household", icon: MapPin },
  { label: "Education & Work", icon: Briefcase },
  { label: "Sector Status", icon: Heart },
  { label: "Security & Contact", icon: Lock },
  { label: "Proof & Review", icon: FileCheck2 },
];

const RESEARCH_TEAM = [
  {
    name: "Russel Jay Calamba",
    role: "Researcher & Developer",
    tag: "Lead Dev",
    tagGradient: "from-[#0B5D3B] to-[#10B981]",
    badgeClass: "text-emerald-800 bg-emerald-100/90 border-emerald-300",
    image: "/about us.pic/about us.png1.webp",
    fallbackImage: "/about-us/russel.webp",
    initials: "RC",
    imageClass: "object-cover object-top",
  },
  {
    name: "Krizel Claire Condez",
    role: "Researcher & Documentation",
    tag: "Docs",
    tagGradient: "from-emerald-800 to-teal-600",
    badgeClass: "text-emerald-800 bg-emerald-100/90 border-emerald-300",
    image: "/about us.pic/about us.png3.webp",
    fallbackImage: "/about-us/krizel.webp",
    initials: "KC",
    imageClass: "object-cover object-top",
  },
  {
    name: "Adrianne Dave Esler",
    role: "Researcher & Documentation",
    tag: "Docs",
    tagGradient: "from-emerald-800 to-teal-600",
    badgeClass: "text-emerald-800 bg-emerald-100/90 border-emerald-300",
    image: "/about us.pic/about us.png2.1.jpg",
    fallbackImage: "/about-us/dave.jpg",
    initials: "AE",
    imageClass: "object-cover object-top scale-[1.28] origin-[50%_28%]",
  },
];

const getLoginDisplayName = ({ user, profile, resident }) =>
  resident?.full_name ||
  profile?.full_name ||
  profile?.name ||
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  user?.email?.split("@")[0] ||
  "User";

const Login = ({ portalMode = null }) => {
  const barangayLogo = useBarangayLogo();
  const [initialLoading, setInitialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const location = useLocation();
  const currentPath = location.pathname ? location.pathname.toLowerCase() : "";
  const isTargetAdmin = isTargetAdminPortal(portalMode, currentPath);
  const isExplicitResidentRoute =
    portalMode === "resident" ||
    currentPath.includes("resident") ||
    currentPath.includes("portal");

  // View state: ALWAYS start at 'landing' (Home Page) so user sees Home Page first
  const [currentView, setCurrentView] = useState("landing");

  const [modalStep, setModalStep] = useState(() =>
    isTargetAdmin ? "admin_login" : "resident_login"
  );
  const [accessMode, setAccessMode] = useState(() =>
    isTargetAdmin ? "Admin" : "Resident"
  );

  useEffect(() => {
    if (isTargetAdmin) {
      setAccessMode("Admin");
      setModalStep("admin_login");
    } else if (isExplicitResidentRoute) {
      setAccessMode("Resident");
      setModalStep("resident_login");
    }
  }, [isTargetAdmin, isExplicitResidentRoute]);

  const [residentAuthMode, setResidentAuthMode] = useState("signin");
  const [registrationProof, setRegistrationProof] = useState(null);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Password Recovery States
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOTP, setForgotOTP] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [canResendOTP, setCanResendOTP] = useState(false);

  // OTP Countdown timer effect
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            setCanResendOTP(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Modal Overlays
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedLightboxIndex, setSelectedLightboxIndex] = useState(null);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (selectedLightboxIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedLightboxIndex(null);
      } else if (e.key === "ArrowRight") {
        setSelectedLightboxIndex((prev) => (prev + 1) % DEFAULT_SHOWCASE_SLIDES.length);
      } else if (e.key === "ArrowLeft") {
        setSelectedLightboxIndex(
          (prev) => (prev - 1 + DEFAULT_SHOWCASE_SLIDES.length) % DEFAULT_SHOWCASE_SLIDES.length
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLightboxIndex]);

  const renderAboutModal = () => (
    <FloatingModal
      open={showAboutModal}
      title="ABOUT KAAGAPAI"
      eyebrow="Barangay Information Management System"
      description="Empowering Barangay Services Through Technology"
      maxWidth="max-w-2xl"
      onClose={() => setShowAboutModal(false)}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-500 truncate">
            KaagapAI v1.0 • AY 2026
          </span>
          <button
            type="button"
            onClick={() => setShowAboutModal(false)}
            className="px-5 py-2 text-xs font-black text-white bg-[#0B5D3B] hover:bg-[#08452B] rounded-xl transition cursor-pointer shadow-md active:scale-95"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-5 text-xs text-slate-700 py-1 text-left">
        {/* 1. ABOUT THE SYSTEM */}
        <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50/30 border border-emerald-200/90 p-3.5 sm:p-4 shadow-2xs">
          <h3 className="font-black text-[11px] sm:text-xs uppercase tracking-wider text-[#0B5D3B] mb-1.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-emerald-700 shrink-0" />
            <span>ABOUT THE SYSTEM</span>
          </h3>
          <p className="text-[11.5px] sm:text-xs text-slate-700 leading-relaxed font-medium">
            <strong>KaagapAI</strong> is an intelligent Web-based Barangay Information and Resident Services Management System developed for <strong>Barangay Upper Mingading, Aleosan, Cotabato</strong>. Designed as an academic capstone research initiative, the platform modernizes and streamlines local governance through digital resident profiling, verified document issuance, real-time demographic analytics, multi-channel SMS notifications, and AI-powered knowledge assistance.
          </p>
        </div>

        {/* 2. RESEARCH & DEVELOPMENT TEAM */}
        <div>
          <h3 className="font-black text-[11px] sm:text-xs uppercase tracking-wider text-[#0B5D3B] mb-2.5 flex items-center gap-1.5">
            <Users size={14} className="text-emerald-700 shrink-0" />
            <span>RESEARCH & DEVELOPMENT TEAM</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
            {RESEARCH_TEAM.map((member) => (
              <div
                key={member.name}
                className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-between text-center group h-full"
              >
                {/* Photo container */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 border-2 border-emerald-500/40 ring-2 ring-emerald-100/90 shadow-md group-hover:scale-105 group-hover:ring-emerald-400/60 transition-all duration-300 bg-emerald-50 flex items-center justify-center shrink-0">
                  <img
                    src={member.image}
                    alt={member.name}
                    className={`w-full h-full transition-transform duration-300 ${member.imageClass || "object-cover object-top"}`}
                    onError={(e) => {
                      if (member.fallbackImage && !e.currentTarget.src.includes("about-us/")) {
                        e.currentTarget.src = member.fallbackImage;
                      } else {
                        e.currentTarget.style.display = "none";
                        const fallbackBox = e.currentTarget.parentElement?.querySelector(".avatar-fallback");
                        if (fallbackBox) {
                          fallbackBox.classList.remove("hidden");
                          fallbackBox.classList.add("flex");
                        }
                      }
                    }}
                  />
                  <div
                    className={`avatar-fallback hidden absolute inset-0 bg-gradient-to-br ${member.tagGradient} text-white flex-col items-center justify-center font-black text-base sm:text-lg`}
                  >
                    <span>{member.initials}</span>
                    <span className="text-[8px] uppercase tracking-widest opacity-75 font-semibold">{member.tag}</span>
                  </div>
                  {/* Role Tag Overlay Pill on Bottom of Photo */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-3 pb-0.5 text-center pointer-events-none">
                    <span className="text-[8px] sm:text-[8.5px] uppercase tracking-widest font-black text-emerald-300 drop-shadow-xs">
                      {member.tag}
                    </span>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center flex-1 justify-between gap-1.5">
                  <h4 className="font-black text-xs sm:text-[13px] text-slate-900 leading-tight text-center">
                    {member.name}
                  </h4>
                  <span className={`text-[9.5px] sm:text-[10px] font-bold px-2.5 py-1 rounded-full border ${member.badgeClass} inline-flex items-center justify-center leading-none text-center shadow-2xs whitespace-nowrap`}>
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. RESEARCH INFORMATION */}
        <div className="rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 p-3 sm:p-4">
          <h3 className="font-black text-[11px] sm:text-xs uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
            <Info size={14} className="text-emerald-700 shrink-0" />
            <span>RESEARCH INFORMATION</span>
          </h3>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 sm:p-2.5 bg-white rounded-lg sm:rounded-xl border border-slate-200 text-center sm:text-left">
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Project Type</p>
              <p className="font-bold text-slate-800 mt-0.5 text-[11px] sm:text-xs">Capstone Project</p>
            </div>
            <div className="p-2 sm:p-2.5 bg-white rounded-lg sm:rounded-xl border border-slate-200 text-center sm:text-left">
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Academic Year</p>
              <p className="font-bold text-slate-800 mt-0.5 text-[11px] sm:text-xs">2026</p>
            </div>
            <div className="p-2 sm:p-2.5 bg-white rounded-lg sm:rounded-xl border border-slate-200 text-center sm:text-left">
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Researchers</p>
              <p className="font-bold text-slate-800 mt-0.5 text-[11px] sm:text-xs">3 Members</p>
            </div>
          </div>
        </div>
      </div>
    </FloatingModal>
  );

  // Google reCAPTCHA integration refs & token state
  const adminCaptchaRef = useRef(null);
  const residentCaptchaRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState(null);

  const isRecaptchaConfigured = () => {
    const hostname = window.location.hostname;
    const isLocalHostOrIP =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname);

    if (isLocalHostOrIP) {
      return false;
    }

    return Boolean(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY &&
        import.meta.env.VITE_RECAPTCHA_SITE_KEY !== "YOUR_SITE_KEY_HERE"
    );
  };

  const [formData, setFormData] = useState({
    fullName: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    suffix: "",
    email: "",
    password: "",
    birthday: "",
    householdNo: "",
    phone: "",
    sex: "Male",
    birthplace: "",
    purok: "",
    educational_attainment: "",
    occupation: "",
    civil_status: "Single",
    relationship_to_household_head: "Head",
    house_no: "",
    address: "",
    is_4ps_member: false,
    is_solo_parent: false,
    is_pwd: false,
    pwd_type: "",
    gmail: "",
    username: "",
    portal_password: "",
    confirm_password: "",
  });

  const navigate = useNavigate();
  const isResidentRegistration = modalStep === "resident_register";

  const residentRegistrationAge = useMemo(
    () => calculateAge(formData.birthday),
    [formData.birthday]
  );

  const residentRegistrationFullName = useMemo(
    () => buildFullName(formData),
    [formData]
  );

  // Initial loading splash simulation (500ms) and ensuring blank login fields
  useEffect(() => {
    setFormData((current) => ({
      ...current,
      email: "",
      password: "",
      username: "",
      portal_password: "",
    }));
    const splashTimer = setTimeout(() => {
      setInitialLoading(false);
    }, 500);
    return () => clearTimeout(splashTimer);
  }, []);

  const handleInputChange = (event) => {
    const { checked, name, type } = event.target;
    let value = event.target.value;

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 11);
    }
    if (name === "username") {
      value = value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    }

    const fieldName =
      name === "kaagapai_login_identifier"
        ? "email"
        : name === "kaagapai_login_secret"
        ? "password"
        : name;

    setFormData((current) => ({
      ...current,
      [fieldName]: type === "checkbox" ? checked : value,
      ...(fieldName === "is_pwd" && !checked ? { pwd_type: "" } : {}),
    }));
    setError(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        validateResidentRegistrationProof(file);
        setRegistrationProof(file);
        setError(null);
      } catch (err) {
        setError(err.message);
        setRegistrationProof(null);
      }
    }
  };

  const openLoginView = (type = "resident_login") => {
    sessionStorage.removeItem("just_logged_out");
    setModalStep(type);
    setAccessMode(type === "admin_login" ? "Admin" : "Resident");
    setFormData((current) => ({
      ...current,
      email: "",
      password: "",
      username: "",
      portal_password: "",
    }));
    setError(null);
    setNotice(null);
    setCurrentView("login");
  };

  const goToLanding = () => {
    setCurrentView("landing");
    setError(null);
    setNotice(null);
    setMobileMenuOpen(false);
  };

  // Session check & redirect (Supports both Admin and Resident portals on deployed link)
  useEffect(() => {
    const justLoggedOut = sessionStorage.getItem("just_logged_out") === "true";
    if (justLoggedOut) return;

    const adminSession = getAdminSession();
    const residentSession = getResidentSession();

    if (isTargetAdmin) {
      // Strictly check Admin Session on Admin Portal
      if (adminSession && adminSession.profile?.role === "admin") {
        navigate("/dashboard", { replace: true });
        return;
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          supabase
            .from("user_profiles")
            .select("role")
            .eq("id", session.user.id)
            .limit(1)
            .maybeSingle()
            .then(({ data: profile }) => {
              if (profile && profile.role === "admin") {
                navigate("/dashboard", { replace: true });
              }
            });
        }
      });
      return;
    }

    if (isExplicitResidentRoute) {
      if (residentSession) {
        navigate("/resident-dashboard", { replace: true });
      }
      return;
    }

    // On unified domain root: if already logged in as Admin or Resident, redirect appropriately
    if (adminSession && adminSession.profile?.role === "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (residentSession) {
      navigate("/resident-dashboard", { replace: true });
    }
  }, [navigate, isTargetAdmin, isExplicitResidentRoute]);

  const checkUsernameExists = async (usernameToCheck) => {
    const raw = (usernameToCheck || "").trim().toLowerCase();
    if (!raw) return false;

    try {
      // 1. Check resident_accounts
      const { data: resAcc, error: err1 } = await supabase
        .from("resident_accounts")
        .select("id, username")
        .ilike("username", raw)
        .limit(1)
        .maybeSingle();

      if (!err1 && resAcc) return true;

      // 2. Check user_profiles (Admin / Staff users)
      const { data: userProf, error: err2 } = await supabase
        .from("user_profiles")
        .select("id, username")
        .ilike("username", raw)
        .limit(1)
        .maybeSingle();

      if (!err2 && userProf) return true;

      // 3. Check residents table if username exists
      const { data: resUser, error: err3 } = await supabase
        .from("residents")
        .select("id")
        .ilike("username", raw)
        .limit(1)
        .maybeSingle();

      if (!err3 && resUser) return true;

      return false;
    } catch (err) {
      console.warn("Username availability check notice:", err);
      return false;
    }
  };

  const renderStep1Fields = () => (
    <div className="space-y-2.5 text-left">
      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-emerald-500/30 pb-1 mb-1.5">
        <User size={13} className="text-emerald-400" />
        <span className="text-[11px] uppercase tracking-wider">Personal Details</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">First Name *</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner"
            placeholder="Juan"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Middle Name <span className="normal-case font-normal text-emerald-200/60">(optional)</span></label>
          <input
            type="text"
            name="middle_name"
            value={formData.middle_name}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner"
            placeholder="Reyes"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Last Name *</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner"
            placeholder="Dela Cruz"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Suffix / Ext. <span className="normal-case font-normal text-emerald-200/60">(optional)</span></label>
          <input
            type="text"
            name="suffix"
            value={formData.suffix}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner"
            placeholder="Jr. / III"
          />
        </div>

        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Birth Date *</label>
          <input
            type="date"
            name="birthday"
            value={formData.birthday}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Sex *</label>
          <select
            name="sex"
            value={formData.sex}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner cursor-pointer"
          >
            <option value="Male" className="bg-[#022B1D] text-white">Male</option>
            <option value="Female" className="bg-[#022B1D] text-white">Female</option>
          </select>
        </div>

        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Birth Place *</label>
          <input
            type="text"
            name="birthplace"
            value={formData.birthplace}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner"
            placeholder="City / Municipality"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Civil Status *</label>
          <select
            name="civil_status"
            value={formData.civil_status}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/20 font-semibold shadow-inner cursor-pointer"
          >
            <option value="Single" className="bg-[#022B1D] text-white">Single</option>
            <option value="Married" className="bg-[#022B1D] text-white">Married</option>
            <option value="Widowed" className="bg-[#022B1D] text-white">Widowed</option>
            <option value="Separated" className="bg-[#022B1D] text-white">Separated</option>
          </select>
        </div>
      </div>
    </div>
  );

  const [isCustomRegOccupation, setIsCustomRegOccupation] = useState(false);
  const [customRegOccupationInput, setCustomRegOccupationInput] = useState("");

  const renderStep2Fields = () => {
    const puroks = getCustomPurokDefinitions();
    return (
      <div className="space-y-3 text-left">
        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-emerald-500/30 pb-1.5 mb-2">
          <MapPin size={14} className="text-emerald-400" />
          <span className="text-[11px] uppercase tracking-wider">Address & Household Information</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Household No *</label>
            <input
              type="text"
              name="householdNo"
              value={formData.householdNo}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
              placeholder="e.g. HH-001 or 024"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">House No <span className="normal-case font-normal text-emerald-200/60">(optional)</span></label>
            <input
              type="text"
              name="house_no"
              value={formData.house_no}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
              placeholder="e.g. 123"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Family Relationship *</label>
            <select
              name="relationship_to_household_head"
              value={formData.relationship_to_household_head}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner cursor-pointer"
            >
              {householdRelationshipOptions.map((rel) => (
                <option key={rel} value={rel} className="bg-[#022B1D] text-white">
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Purok *</label>
            <select
              name="purok"
              value={formData.purok}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner cursor-pointer"
            >
              <option value="" className="bg-[#022B1D] text-white">Select Purok</option>
              {puroks.map((purok) => (
                <option key={purok.value} value={purok.value} className="bg-[#022B1D] text-white">
                  {purok.label || formatPurok(purok.value)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formData.purok && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Auto-generated Address</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-100">
              Purok {formatPurok(formData.purok)}, Upper Mingading, Aleosan, Cotabato
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
            Address Notes / Sitio <span className="normal-case font-normal text-emerald-200/60">(optional)</span>
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
            placeholder="Sitio, street, landmark, or household notes"
          />
        </div>
      </div>
    );
  };

  const renderStep3Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-emerald-500/30 pb-1.5 mb-2">
        <Briefcase size={14} className="text-emerald-400" />
        <span className="text-[11px] uppercase tracking-wider">Education & Occupation</span>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Educational Attainment</label>
        <select
          name="educational_attainment"
          value={formData.educational_attainment}
          onChange={handleInputChange}
          className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner cursor-pointer"
        >
          <option value="" className="bg-[#022B1D] text-white">Select Educational Attainment</option>
          {educationalAttainmentOptions.map((opt) => (
            <option key={opt} value={opt} className="bg-[#022B1D] text-white">
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Occupation</label>
        <select
          value={
            !formData.occupation
              ? ""
              : standardOccupationOptions.includes(formData.occupation) && formData.occupation !== "Others (Please Specify)"
              ? formData.occupation
              : "Others (Please Specify)"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "Others (Please Specify)") {
              setIsCustomRegOccupation(true);
              setFormData((prev) => ({ ...prev, occupation: customRegOccupationInput || "" }));
            } else {
              setIsCustomRegOccupation(false);
              setFormData((prev) => ({ ...prev, occupation: val }));
            }
          }}
          className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner cursor-pointer"
        >
          <option value="" className="bg-[#022B1D] text-white">Select Occupation</option>
          {standardOccupationOptions.map((occ) => (
            <option key={occ} value={occ} className="bg-[#022B1D] text-white">
              {occ}
            </option>
          ))}
        </select>
      </div>

      {isCustomRegOccupation && (
        <div className="space-y-1 pt-1">
          <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Specify Occupation *</label>
          <input
            type="text"
            value={customRegOccupationInput}
            onChange={(e) => {
              setCustomRegOccupationInput(e.target.value);
              setFormData((prev) => ({ ...prev, occupation: e.target.value }));
            }}
            placeholder="Type your specific occupation..."
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 px-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
          />
        </div>
      )}
    </div>
  );

  const renderStep4Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-emerald-500/30 pb-1.5 mb-2">
        <Heart size={14} className="text-emerald-400" />
        <span className="text-[11px] uppercase tracking-wider">Community Sector Details</span>
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-black/25 p-3 space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="is_pwd"
            checked={formData.is_pwd}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">Person with Disability (PWD / PWED)</p>
            <p className="text-[10px] text-emerald-200/70 font-medium">Check this if you are a registered PWD.</p>
          </div>
        </label>

        {formData.is_pwd && (
          <div className="pl-7 pt-1">
            <input
              type="text"
              name="pwd_type"
              value={formData.pwd_type}
              onChange={handleInputChange}
              className="w-full rounded-xl border border-emerald-400/30 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 font-medium"
              placeholder="Specify disability type..."
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-black/25 p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="is_solo_parent"
            checked={formData.is_solo_parent}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">Solo Parent</p>
            <p className="text-[10px] text-emerald-200/70 font-medium">Registered single parent supporting dependents.</p>
          </div>
        </label>
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-black/25 p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="is_4ps_member"
            checked={formData.is_4ps_member}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">DSWD 4Ps Beneficiary</p>
            <p className="text-[10px] text-emerald-200/70 font-medium">Household listed as DSWD 4Ps beneficiary.</p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderStep5Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-emerald-500/30 pb-1.5 mb-2">
        <Lock size={14} className="text-emerald-400" />
        <span className="text-[11px] uppercase tracking-wider">Account Credentials & Contact</span>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Email Address *</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" size={14} />
          <input
            type="email"
            name="gmail"
            value={formData.gmail}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 pl-10 pr-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
            placeholder="resident@email.com"
          />
        </div>
        <p className="text-[10px] text-emerald-200/70 mt-1 font-medium">Required for password recovery and account verification.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
          Phone Number * <span className="text-emerald-200/60 font-normal">(Strictly 11 digits)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" size={14} />
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            maxLength={11}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 pl-10 pr-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-mono font-semibold shadow-inner"
            placeholder="09171234567"
          />
        </div>
        <p className="text-[10px] text-emerald-200/70 mt-1 font-medium">Used for SMS notifications. Must start with 09 (11 digits).</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Portal Username *</label>
        <div className="relative">
          <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" size={14} />
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 pl-10 pr-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
            placeholder="Choose unique username"
            autoComplete="username"
          />
        </div>
        <p className="text-[10px] text-emerald-200/70 mt-1 font-medium">You will use this to log in after approval. Must be unique.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Password *</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" size={14} />
          <input
            type={showPassword ? "text" : "password"}
            name="portal_password"
            value={formData.portal_password}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 pl-10 pr-10 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
            placeholder="Create your password"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-emerald-300/70 hover:text-white transition cursor-pointer"
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-emerald-200/70 mt-1 font-medium">Must be at least 6 characters long.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">Confirm Password *</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/60" size={14} />
          <input
            type={showPassword ? "text" : "password"}
            name="confirm_password"
            value={formData.confirm_password}
            onChange={handleInputChange}
            className="w-full rounded-xl border border-emerald-400/30 bg-black/25 pl-10 pr-3 py-2 text-xs text-white placeholder-emerald-100/40 outline-none focus:border-emerald-400 focus:bg-black/40 font-semibold shadow-inner"
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
        </div>
      </div>
    </div>
  );

  const renderStep6Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs border-b border-emerald-500/30 pb-1.5 mb-2">
        <FileText size={14} className="text-emerald-400" />
        <span className="text-[11px] uppercase tracking-wider">Attach Valid ID Proof & Review</span>
      </div>

      <div className="space-y-2 text-left">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider block">
            Attach Official ID or Residency Proof <span className="text-rose-400 font-black">*</span>
          </label>
          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
            registrationProof
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
              : "bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse"
          }`}>
            {registrationProof ? "✓ Proof Attached" : "⚠️ Required"}
          </span>
        </div>

        <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-4 text-center transition relative overflow-hidden group ${
          registrationProof
            ? "border-emerald-400 bg-emerald-950/30 hover:bg-emerald-950/40"
            : "border-amber-400/60 bg-amber-950/15 hover:bg-amber-950/25"
        }`}>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            required
          />

          {registrationProof ? (
            <div className="flex flex-col items-center">
              <FileCheck2 size={26} className="text-emerald-400 mb-1" />
              <p className="text-xs font-extrabold text-white truncate max-w-[240px]">
                {registrationProof.name}
              </p>
              <p className="text-[10px] text-emerald-200/80 font-bold mt-0.5">
                {(registrationProof.size / 1024 / 1024).toFixed(2)} MB • Click to replace file
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-400/30">
                <CheckCircle2 size={10} /> Valid ID / Proof Ready
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload size={24} className="text-amber-300 mb-1 animate-bounce" />
              <p className="text-xs font-extrabold text-white">Upload Valid ID or Residency Proof *</p>
              <p className="text-[10px] text-amber-200/70 font-semibold mt-0.5">
                JPG, PNG, WebP or PDF (Max 5MB)
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-400/30">
                Kailangan mag-upload bago makapag-submit
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive Registration Summary Card */}
      <div className="space-y-2.5 rounded-2xl border border-emerald-400/40 bg-black/45 p-3.5 text-xs text-left shadow-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5">
          <p className="text-[11px] font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span>Buong Detalye ng Rehistrasyon (Summary Review)</span>
          </p>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 shrink-0">
            I-review Bago I-submit
          </span>
        </div>

        {/* Section 1: Personal Details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] pt-1">
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Pangalan (Full Name):</span>
            <span className="font-bold text-white break-words block">{residentRegistrationFullName || "N/A"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Kapanganakan & Edad:</span>
            <span className="font-bold text-white break-words block">{formData.birthday ? `${formData.birthday} (${residentRegistrationAge} y/o)` : "N/A"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Kasarian (Sex):</span>
            <span className="font-bold text-white block">{formData.sex || "N/A"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Civil Status:</span>
            <span className="font-bold text-white block">{formData.civil_status || "N/A"}</span>
          </div>
          <div className="min-w-0 col-span-2">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Lugar ng Kapanganakan:</span>
            <span className="font-bold text-white break-words block">{formData.birthplace || "N/A"}</span>
          </div>
        </div>

        <div className="border-t border-emerald-500/20 my-1" />

        {/* Section 2: Address & Household */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Purok:</span>
            <span className="font-bold text-white block">Purok {formatPurok(formData.purok)}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Household No:</span>
            <span className="font-bold text-white font-mono break-all block">{formData.householdNo || "N/A"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">House No:</span>
            <span className="font-bold text-white font-mono block">{formData.house_no || "N/A"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Family Relationship:</span>
            <span className="font-bold text-white block">{formData.relationship_to_household_head || "Head"}</span>
          </div>
          <div className="min-w-0 col-span-2">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Address Notes / Sitio:</span>
            <span className="font-bold text-white break-words block">{formData.address || "None"}</span>
          </div>
        </div>

        <div className="border-t border-emerald-500/20 my-1" />

        {/* Section 3: Education, Occupation & Sector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Edukasyon:</span>
            <span className="font-bold text-white break-words block">{formData.educational_attainment || "N/A"}</span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Hanapbuhay (Occupation):</span>
            <span className="font-bold text-white break-words block">{formData.occupation || "None"}</span>
          </div>
          <div className="min-w-0 col-span-2 sm:col-span-1">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Sector:</span>
            <span className="font-bold text-white break-words block">
              {[
                formData.is_pwd ? `PWD (${formData.pwd_type || 'Yes'})` : null,
                formData.is_solo_parent ? "Solo Parent" : null,
                formData.is_4ps_member ? "4Ps Member" : null,
              ].filter(Boolean).join(", ") || "General"}
            </span>
          </div>
        </div>

        <div className="border-t border-emerald-500/20 my-1" />

        {/* Section 4: Credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Username:</span>
            <span className="font-bold text-amber-300 font-mono truncate block" title={formData.username}>
              {formData.username || "N/A"}
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Contact Phone:</span>
            <span className="font-bold text-white font-mono truncate block" title={formData.phone}>
              {formData.phone || "N/A"}
            </span>
          </div>
          <div className="min-w-0 col-span-1 sm:col-span-1">
            <span className="text-emerald-300/70 font-semibold block text-[10px] uppercase">Email Address:</span>
            <span className="font-bold text-white break-all block" title={formData.gmail}>
              {formData.gmail || "N/A"}
            </span>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="h-4 w-4 rounded border-emerald-500/40 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5 cursor-pointer"
        />
        <span className="text-xs text-emerald-100/90 font-semibold leading-normal">
          I agree to the{" "}
          <span
            onClick={(e) => {
              e.preventDefault();
              setShowTermsModal(true);
            }}
            className="font-semibold text-amber-300 hover:underline cursor-pointer"
          >
            Privacy Policy and Terms of Service
          </span>{" "}
          of Barangay Upper Mingading.
        </span>
      </label>
    </div>
  );

  const validateStep = (step) => {
    try {
      if (step === 1) {
        if (!formData.first_name.trim() || !formData.last_name.trim())
          throw new Error("First name and last name are required.");
        if (!formData.birthday) throw new Error("Please select a valid birth date.");
        if (!formData.sex) throw new Error("Please select your sex.");
        if (!formData.birthplace.trim())
          throw new Error("Please enter your birth place.");
      } else if (step === 2) {
        if (!formData.householdNo.trim())
          throw new Error("Household number is required.");
        if (!formData.purok) throw new Error("Please select your Purok.");
      } else if (step === 3) {
        if (isCustomRegOccupation && !customRegOccupationInput.trim()) {
          throw new Error("Please specify your occupation or select from the list.");
        }
      } else if (step === 4) {
        if (formData.is_pwd && !formData.pwd_type.trim())
          throw new Error("Please detail your PWD type.");
      } else if (step === 5) {
        if (!formData.gmail.trim())
          throw new Error("Email address is required for account recovery.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.gmail.trim()))
          throw new Error("Please enter a valid email address.");
        const cleanPhone = formData.phone.replace(/\D/g, "");
        if (!cleanPhone)
          throw new Error("Phone number is required for SMS notifications.");
        if (cleanPhone.length !== 11 || !cleanPhone.startsWith("09"))
          throw new Error("Phone number must be exactly 11 digits starting with 09 (e.g. 09171234567).");
        if (!formData.username.trim())
          throw new Error("Username is required.");
        if (formData.username.trim().length < 3)
          throw new Error("Username must be at least 3 characters.");
        if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username.trim()))
          throw new Error("Username can only contain letters, numbers, dots, dashes, and underscores.");
        if (!formData.portal_password || formData.portal_password.length < 6)
          throw new Error("Password must be at least 6 characters.");
        if (formData.portal_password !== formData.confirm_password)
          throw new Error("Passwords do not match.");
      } else if (step === 6) {
        if (!registrationProof)
          throw new Error("Kailangang mag-attach ng valid ID o proof of residency bago mag-submit.");
        if (!agreeTerms)
          throw new Error("Kailangang sumang-ayon sa Privacy Policy at Terms of Service.");
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const nextStep = async () => {
    if (!validateStep(registrationStep)) return;

    // Real-time strict database duplicate username check before proceeding from step 5
    if (registrationStep === 5) {
      const normalizedUsername = formData.username.trim().toLowerCase();
      setLoading(true);
      try {
        const isTaken = await checkUsernameExists(normalizedUsername);
        if (isTaken) {
          setError(`⚠️ Ang username na "${formData.username}" ay nagamit na o existing na sa database. Mangyaring pumili ng ibang unique username.`);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Username uniqueness check notice:", err);
      } finally {
        setLoading(false);
      }
    }

    setRegistrationStep((current) => current + 1);
    setError(null);
  };

  const prevStep = () => {
    setRegistrationStep((current) => current - 1);
    setError(null);
  };

  const goToRegistrationStep = (step) => {
    if (step <= registrationStep) {
      setRegistrationStep(step);
      setError(null);
    }
  };

  const signInAdmin = async () => {
    const result = await loginUser(formData.email, formData.password);
    const role = result.profile?.role;

    if (role !== "admin") {
      await clearAuthSession();
      throw new Error("Access Denied: This portal is strictly for Barangay Administrators and Staff.");
    }

    navigate("/welcome", {
      replace: true,
      state: {
        redirectTo: "/dashboard",
        role: "admin",
        displayName: getLoginDisplayName(result),
      },
    });
  };

  const signInResident = async () => {
    const resident = await loginResident(formData.email, formData.password);
    navigate("/welcome", {
      replace: true,
      state: {
        redirectTo: "/resident-dashboard",
        role: "resident",
        displayName: getLoginDisplayName({ resident }),
      },
    });
  };

  const registerResidentOnline = async () => {
    if (!registrationProof) {
      throw new Error("Kailangang mag-attach ng Official Valid ID o Proof of Residency bago mag-submit.");
    }
    if (!agreeTerms) {
      throw new Error("Kailangang sumang-ayon sa Privacy Policy at Terms of Service.");
    }

    const normalizedUsername = (formData.username || "").trim().toLowerCase();
    const isTaken = await checkUsernameExists(normalizedUsername);
    if (isTaken) {
      throw new Error(`⚠️ Ang username na "${formData.username}" ay nagamit na sa database. Paki-palitan ang username bago mag-rehistro.`);
    }

    const result = await requestResidentActivation({
      ...formData,
      fullName: residentRegistrationFullName,
      first_name: formData.first_name,
      middle_name: formData.middle_name,
      last_name: formData.last_name,
      suffix: formData.suffix,
      birthday: formData.birthday,
      householdNo: formData.householdNo,
      household_no: formData.householdNo,
      house_no: formData.house_no,
      relationship_to_household_head: formData.relationship_to_household_head,
      sex: formData.sex,
      gender: formData.sex,
      birthplace: formData.birthplace,
      purok: formData.purok,
      educational_attainment: formData.educational_attainment,
      occupation: formData.occupation,
      civil_status: formData.civil_status,
      address: formData.address,
      is_4ps_member: Boolean(formData.is_4ps_member),
      is_solo_parent: Boolean(formData.is_solo_parent),
      is_pwd: Boolean(formData.is_pwd),
      pwd_type: formData.pwd_type,
      phone: formData.phone,
      username: formData.username,
      portal_username: formData.username,
      portal_password: formData.portal_password,
      password: formData.portal_password,
      gmail: formData.gmail,
      email: formData.gmail || formData.email,
      proofFile: registrationProof,
    });

    setNotice({
      type: "pending",
      text: result.message,
    });
    setModalStep("resident_login");
    setAccessMode("Resident");
    setResidentAuthMode("signin");
    setRegistrationStep(1);
    setRegistrationProof(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (isResidentRegistration) {
      if (!validateStep(registrationStep)) return;

      if (registrationStep < 6) {
        await nextStep();
        return;
      }

      if (!registrationProof) {
        setError("Kailangang mag-attach ng Official Valid ID o Proof of Residency bago mag-submit.");
        return;
      }

      if (!agreeTerms) {
        setError("Kailangang sumang-ayon sa Privacy Policy at Terms of Service.");
        return;
      }
    }

    if (modalStep === "admin_login" || modalStep === "resident_login") {
      const loginCheck = checkLoginAllowed(formData.email);
      if (!loginCheck.allowed) {
        setError(loginCheck.reason);
        return;
      }
    }

    if ((modalStep === "admin_login" || modalStep === "resident_login") && isRecaptchaConfigured()) {
      if (!showRecaptcha) {
        setShowRecaptcha(true);
        setError("Please complete the security check before logging in.");
        return;
      }
      if (!captchaToken) {
        setError("Please solve the reCAPTCHA verification.");
        return;
      }
    }

    setLoading(true);

    try {
      clearResidentSession();
      await clearAuthSession();

      if (isTargetAdmin || modalStep === "admin_login" || accessMode === "Admin") {
        await signInAdmin();
        clearFailedAttempts(formData.email);
        logSecurityEvent("login_success", { identifier: formData.email, role: "admin" });
        setCaptchaToken(null);
        return;
      }

      if (isResidentRegistration) {
        await registerResidentOnline();
        return;
      }

      await signInResident();
      clearFailedAttempts(formData.email);
      logSecurityEvent("login_success", { identifier: formData.email, role: "resident" });
      setCaptchaToken(null);
    } catch (submitError) {
      if (modalStep === "admin_login" || modalStep === "resident_login") {
        recordFailedAttempt(formData.email);
        logSecurityEvent("login_failed", {
          identifier: formData.email,
          role: isTargetAdmin ? "admin" : "resident",
          error: submitError.message,
        });

        if (modalStep === "admin_login") {
          adminCaptchaRef.current?.reset();
        } else {
          residentCaptchaRef.current?.reset();
        }
        setCaptchaToken(null);
      }
      setError(submitError.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResidentForgotSendOTP = async (e) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizeSmsPhone(forgotPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      setError("Please enter a valid 11-digit registered mobile number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendResidentForgotOTP(cleanPhone);
      setNotice({
        type: "success",
        text: "Verification code sent! Please check your SMS.",
      });
      setModalStep("resident_otp_verify");
      setOtpCountdown(60);
      setCanResendOTP(false);
    } catch (err) {
      setError(err.message || "Failed to send verification code. Please check your mobile number.");
    } finally {
      setLoading(false);
    }
  };

  const handleResidentForgotVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (!forgotOTP || forgotOTP.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanPhone = normalizeSmsPhone(forgotPhone);
      verifyResidentForgotOTP(cleanPhone, forgotOTP);
      setNotice({
        type: "success",
        text: "Code verified successfully! You may now set your new password.",
      });
      setModalStep("resident_forgot_newpass");
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResidentForgotResetPassword = async (e) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizeSmsPhone(forgotPhone);

    if (forgotNewPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      await resetResidentPasswordByPhone(cleanPhone, forgotNewPassword);
      setNotice({
        type: "success",
        text: "Password updated successfully! Please login with your new password.",
      });

      logSecurityEvent("password_reset_completed", {
        phone: cleanPhone,
        role: "resident",
      });

      setModalStep(accessMode === "Admin" ? "admin_login" : "resident_login");
      setForgotPhone("");
      setForgotOTP("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── INITIAL LOADING SCREEN (Step 1: First visit loading state) ───
  if (initialLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#01160E] text-white select-none">
        <div className="relative flex flex-col items-center">
          <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-b from-emerald-900/80 to-emerald-950 p-2 shadow-2xl shadow-emerald-950/80 ring-4 ring-emerald-500/20 animate-pulse">
            <img
              src={barangayLogo || "/logo.png"}
              alt="Barangay Upper Mingading Seal"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-emerald-400" />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-emerald-200">
              Loading Barangay Upper Mingading Portal...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // VIEW 1: FULLSCREEN WHITE LANDING PAGE (SEPARATE HEADER, CAROUSEL & BUTTON)
  // ═════════════════════════════════════════════════════════════════
  if (currentView === "landing") {
    return (
      <div className="min-h-screen w-full bg-white flex flex-col justify-between select-none font-sans text-slate-800 antialiased overflow-x-hidden">
        
        {/* TOP SOCIAL BAR */}
        <div className="w-full bg-[#0B5D3B] text-white py-1 px-3 sm:px-8 flex items-center justify-center sm:justify-end text-xs">
          <div className="flex items-center gap-4 text-white/90">
            <span className="text-[10.5px] sm:text-[11px] font-semibold tracking-wide">
              Upper Mingading Official Portal
            </span>
          </div>
        </div>

        {/* 1. SEPARATE FULL-WIDTH HEADER */}
        <header className="w-full bg-white border-b-4 border-[#0B5D3B] shadow-xs relative z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
            {/* Logo and Titles */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-slate-200 p-0.5 flex items-center justify-center shrink-0 bg-emerald-50/40">
                <img
                  src={barangayLogo || "/logo.png"}
                  alt="Barangay Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="text-left">
                <h1 className="text-base sm:text-lg md:text-xl font-black text-[#0B5D3B] leading-tight tracking-tight">
                  KaagapAI
                </h1>
                <p className="text-[11.5px] sm:text-xs text-slate-500 font-semibold leading-tight mt-0.5">
                  Barangay Upper Mingading, Aleosan, Cotabato
                </p>
              </div>
            </div>

            {/* Direct "About Us" Action Button (Top Right) */}
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="shrink-0 whitespace-nowrap px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-[#0B5D3B] sm:border-2 hover:border-emerald-800 bg-white hover:bg-emerald-50 text-[#0B5D3B] text-[11px] sm:text-xs font-black shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95 group"
            >
              <Users size={14} className="text-[#0B5D3B] group-hover:scale-110 transition-transform shrink-0" />
              <span className="leading-none whitespace-nowrap">About Us</span>
            </button>
          </div>
        </header>

        {/* 2. MAIN CONTENT (CAROUSEL, LOGIN BUTTON, MISSION, VISION & GOALS) */}
        <main className="w-full flex-1 flex flex-col items-center justify-start pt-2 sm:pt-3 pb-6 px-3 sm:px-6">
          <div className="w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto flex justify-center">
            <div className="w-full overflow-hidden">
              <BarangayCarousel autoPlayInterval={3500} />
            </div>
          </div>

          {/* 3. SEPARATE "LOG IN NOW" BUTTON SECTION */}
          <div className="w-full flex justify-center pt-2.5 sm:pt-3.5 pb-3 px-4">
            <div className="relative group">
              {/* Pulsing ambient glow aura behind button */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-teal-500/30 to-emerald-600/30 blur-md opacity-70 group-hover:opacity-100 transition-all duration-500 animate-pulse pointer-events-none" />

              <motion.button
                type="button"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => openLoginView(isTargetAdmin ? "admin_login" : "resident_login")}
                className="relative w-full min-w-[220px] sm:min-w-[260px] max-w-[300px] py-3 px-6 rounded-2xl bg-gradient-to-r from-[#0B5D3B] via-[#0D7349] to-[#08452B] hover:brightness-110 text-white font-black text-xs sm:text-sm tracking-wider shadow-lg hover:shadow-emerald-900/30 transition-all duration-300 active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 overflow-hidden border border-emerald-400/40"
              >
                {/* Continuous light sheen sweep on hover */}
                <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />

                <LogIn size={16} className="text-emerald-300 group-hover:-translate-x-0.5 transition-transform" />
                <span>LOG IN NOW</span>
                <ArrowRight size={16} className="text-emerald-300 group-hover:translate-x-1.5 transition-transform duration-200" />
              </motion.button>
            </div>
          </div>

          {/* 4. MISSION, VISION & GOALS SECTION (3-COLUMN DYNAMIC GRID) */}
          <section className="w-full max-w-5xl mx-auto px-1 sm:px-4 pt-1 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-stretch text-center sm:text-left">
              
              {/* MISSION */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                whileHover={{ y: -3 }}
                className="group relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-lg hover:border-emerald-300 transition-all duration-300 overflow-hidden h-full flex flex-col justify-start"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <h2 className="text-xs sm:text-sm font-black text-[#0B5D3B] uppercase tracking-wider mb-2 flex items-center justify-center sm:justify-start gap-2">
                  <span className="h-7 w-7 rounded-lg bg-emerald-50 text-[#0B5D3B] flex items-center justify-center border border-emerald-200 shadow-2xs group-hover:bg-[#0B5D3B] group-hover:text-white group-hover:rotate-45 transition-all duration-500 shrink-0">
                    <Compass size={15} />
                  </span>
                  <span>Our Mission</span>
                </h2>
                <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                  To attain healthy, peaceful and progressive Barangay Upper Mingading through improved delivery of basic services with access to health programs and quality education, people empowerment for peaceful community and sustainable environment, enhancement of infrastructure facilities and promotion of economic activities and livelihood opportunities that is supportive to the development of socio-economic condition of the populace.
                </p>
              </motion.div>

              {/* VISION */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                whileHover={{ y: -3 }}
                className="group relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-lg hover:border-emerald-300 transition-all duration-300 overflow-hidden h-full flex flex-col justify-start"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <h2 className="text-xs sm:text-sm font-black text-[#0B5D3B] uppercase tracking-wider mb-2 flex items-center justify-center sm:justify-start gap-2">
                  <span className="h-7 w-7 rounded-lg bg-emerald-50 text-[#0B5D3B] flex items-center justify-center border border-emerald-200 shadow-2xs group-hover:bg-[#0B5D3B] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
                    <Target size={15} />
                  </span>
                  <span>Our Vision</span>
                </h2>
                <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                  Barangay Upper Mingading envision a balance and agricultural progressive community where people enjoy a safe environment educated and healthy constituents supported with adequate infrastructure through good governance and transparent leadership.
                </p>
              </motion.div>

              {/* GOALS */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                whileHover={{ y: -3 }}
                className="group relative rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:shadow-lg hover:border-emerald-300 transition-all duration-300 overflow-hidden h-full flex flex-col justify-start"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <h2 className="text-xs sm:text-sm font-black text-[#0B5D3B] uppercase tracking-wider mb-2 flex items-center justify-center sm:justify-start gap-2">
                  <span className="h-7 w-7 rounded-lg bg-emerald-50 text-[#0B5D3B] flex items-center justify-center border border-emerald-200 shadow-2xs group-hover:bg-[#0B5D3B] group-hover:text-white group-hover:rotate-12 transition-all duration-500 shrink-0">
                    <Award size={15} />
                  </span>
                  <span>Our Goals</span>
                </h2>
                <p className="text-[11.5px] sm:text-xs text-slate-600 leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                  To effectively escalate the community awareness and disaster preparedness, focus on proactive measures like community engagement, education, and practical training.
                </p>
              </motion.div>

            </div>
          </section>
        </main>

        {/* 5. SLIM FOOTER WITH FB LINK (SCROLLABLE AT NATURAL BOTTOM) */}
        <footer className="w-full bg-[#0B5D3B] text-white py-2.5 sm:py-3 px-4 text-center text-xs font-medium border-t border-emerald-800/40 mt-auto">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-white font-medium text-xs sm:text-[13px]">
              © {new Date().getFullYear()} Barangay Upper Mingading, Aleosan, Cotabato • KaagapAI Portal
            </p>

            {/* Facebook 'f' Logo Button */}
            <div className="flex items-center gap-2">
              <a
                href="https://www.facebook.com/profile.php/?id=61568631073581"
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-full bg-[#1877F2] hover:bg-[#166FE5] text-white flex items-center justify-center font-black text-sm shadow-md transition-transform hover:scale-110 active:scale-95 border border-white/30 cursor-pointer"
                title="Barangay Upper Mingading Official Facebook Page"
                aria-label="Barangay Upper Mingading Facebook Page"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>
        </footer>

        {/* ABOUT KAAGAPAI MODAL */}
        {renderAboutModal()}

      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // VIEW 2: ORIGINAL LOGIN PAGE (MATCHING THE EXACT USER DESIGN IMAGE 3)
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen w-full font-sans antialiased text-white flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#01160E] via-[#022B1D] to-[#01110A] select-none">
      
      {/* Background Seal & Barangay Building Photo */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
        style={{ backgroundImage: 'url("/new%20barangay.pmg.png")' }}
      />

      {/* Floating Radiant Ambient Color Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-teal-500/25 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#01160E]/70 via-transparent to-[#01110A]/85 pointer-events-none" />

      {/* Giant Clear Watermark Barangay Seal Logo in Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <img
          src={barangayLogo || "/logo.png"}
          alt="Barangay Upper Mingading Seal Watermark"
          className="w-[680px] sm:w-[840px] md:w-[980px] max-w-none opacity-20 filter drop-shadow-[0_0_120px_rgba(16,185,129,0.35)] brightness-110 pointer-events-none"
        />
      </div>

      {/* Back to Home Button (Top Left) */}
      <button
        type="button"
        onClick={goToLanding}
        className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition cursor-pointer shadow-md"
      >
        <ArrowLeft size={14} />
        <span>Back to Home</span>
      </button>

      {/* About Us Button (Top Right) */}
      <button
        type="button"
        onClick={() => setShowAboutModal(true)}
        className="absolute top-4 right-14 z-30 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition cursor-pointer shadow-md"
        title="About KaagapAI"
      >
        <Users size={14} className="text-emerald-300" />
        <span className="hidden sm:inline">About Us</span>
      </button>

      {/* Pure Frosted Emerald Glass Card Container (Matching Image 3) */}
      <div className="relative z-10 w-full max-w-[460px] bg-gradient-to-b from-[rgba(2,43,29,0.92)] via-[rgba(3,62,43,0.85)] to-[rgba(1,28,19,0.95)] backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 shadow-[0_30px_100px_rgba(1,20,13,0.85)] border border-emerald-400/35 flex flex-col items-center text-center my-auto transition-all duration-300 text-white overflow-hidden">
        
        {/* Top subtle sheen light line */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        
        {/* Subtle Glass Sheen Reflection Light Ray */}
        <div className="absolute -left-28 -top-28 h-56 w-96 rotate-45 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={goToLanding}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 transition cursor-pointer z-20"
          title="Back to Home"
        >
          <X size={16} />
        </button>

        {/* Centered Logo Badge */}
        {modalStep !== "resident_register" && (
          <div className="flex flex-col items-center mb-5 relative z-10 w-full">
            {/* Centered Logo Presentation */}
            <div className="relative flex items-center justify-center mb-3">
              <div className="relative h-20 w-20 sm:h-22 sm:w-22 rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-b from-emerald-900/70 to-emerald-950/90 p-2 shadow-xl shadow-emerald-950/60 overflow-hidden ring-4 ring-emerald-500/20 flex items-center justify-center">
                <img
                  src={barangayLogo || "/logo.png"}
                  alt="Barangay Upper Mingading Seal"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            {/* Role / Portal Status Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/70 border border-emerald-400/40 backdrop-blur-md shadow-xs mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-200">
                {modalStep === "admin_login" || accessMode === "Admin" ? "Official Admin Portal" : "Citizen Services Portal"}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
              Kaagap<span className="text-[#FFD700]">AI</span>
            </h1>
            <p className="text-xs font-semibold text-emerald-100/90 mt-0.5 flex items-center justify-center gap-1 drop-shadow-xs">
              <MapPin size={12} className="text-emerald-300" />
              Barangay Upper Mingading • Aleosan, Cotabato
            </p>
          </div>
        )}

        {/* ─── DYNAMIC FORM STEPS (MATCHING IMAGE 3) ─── */}
        {(modalStep === "admin_login" || modalStep === "resident_login") && (
          <div className="w-full space-y-4 relative z-10">
            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-950/90 border border-rose-500/50 p-3.5 text-xs font-semibold text-rose-200 text-left backdrop-blur-md shadow-lg shadow-rose-950/40">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 p-3.5 text-xs font-semibold text-emerald-200 text-left backdrop-blur-md shadow-lg shadow-emerald-950/40">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{notice.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-3.5" autoComplete="off" data-form-type="other">
              {/* Offscreen decoy inputs to absorb browser password autofill */}
              <input
                type="text"
                name="fake_user_trap"
                style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
                tabIndex={-1}
                autoComplete="username"
                readOnly
              />
              <input
                type="password"
                name="fake_pass_trap"
                style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
                tabIndex={-1}
                autoComplete="current-password"
                readOnly
              />

              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" size={18} />
                <input
                  type="text"
                  name="kaagapai_login_identifier"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder={
                    modalStep === "admin_login" || accessMode === "Admin"
                      ? "Enter admin username"
                      : "Enter your username"
                  }
                  className="w-full h-12 rounded-xl bg-black/35 border border-emerald-400/30 pl-11 pr-4 outline-none text-xs font-semibold text-white placeholder-emerald-200/60 focus:border-emerald-400 focus:bg-black/50 focus:ring-2 focus:ring-emerald-400/30 transition-all duration-200 backdrop-blur-md"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" size={18} />
                <input
                  type="text"
                  name="kaagapai_login_secret"
                  value={formData.password}
                  onChange={handleInputChange}
                  style={{
                    WebkitTextSecurity: showPassword ? "none" : "disc",
                    textSecurity: showPassword ? "none" : "disc",
                  }}
                  placeholder={
                    modalStep === "admin_login" || accessMode === "Admin"
                      ? "Enter admin password"
                      : "Enter your password"
                  }
                  className="w-full h-12 rounded-xl bg-black/35 border border-emerald-400/30 pl-11 pr-11 outline-none text-xs font-semibold text-white placeholder-emerald-200/60 focus:border-emerald-400 focus:bg-black/50 focus:ring-2 focus:ring-emerald-400/30 transition-all duration-200 backdrop-blur-md"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300/80 hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {isRecaptchaConfigured() && showRecaptcha && (
                <div className="flex justify-center py-1 transition-all duration-300">
                  <ReCAPTCHA
                    ref={modalStep === "admin_login" ? adminCaptchaRef : residentCaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                    onChange={(token) => setCaptchaToken(token)}
                    onErrored={() => setCaptchaToken("dev-bypass-token")}
                  />
                </div>
              )}

              {/* GLOSSY HIGH-DEFINITION EMERALD LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#059669] via-[#10B981] to-[#0D9488] hover:from-[#047857] hover:via-[#059669] hover:to-[#0F766E] text-sm font-black text-white transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-950/60 cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2 border border-emerald-300/40"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={17} />}
                {loading ? "Signing in..." : "Login Securely"}
              </button>
            </form>

            <div className="w-full flex items-center justify-end pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setModalStep("forgot_password_verified");
                }}
                className="font-black text-emerald-300 hover:text-white hover:underline transition cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {modalStep === "resident_login" && (
              <div className="pt-3 border-t border-white/15">
                <p className="text-xs text-emerald-200/90 font-medium">
                  New resident of Barangay Upper Mingading?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setModalStep("resident_register");
                      setRegistrationStep(1);
                      setError(null);
                    }}
                    className="font-black text-amber-300 hover:text-white hover:underline transition cursor-pointer"
                  >
                    Register Account Online
                  </button>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── RESIDENT REGISTRATION ─── */}
        {modalStep === "resident_register" && (
          <div className="w-full space-y-4 text-left">
            <button
              onClick={() => setModalStep("resident_login")}
              className="flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ChevronLeft size={16} /> Back to Sign In
            </button>
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div>
                <h3 className="text-xl font-bold text-white">Online Registration</h3>
                <p className="text-[11px] text-emerald-300/80 font-semibold mt-0.5">
                  Step {registrationStep} of 6: {stepHeaders[registrationStep - 1].label}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center relative my-3 px-1">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-950 -z-10" />
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#10B981] transition-all duration-300 -z-10"
                style={{ width: `${((registrationStep - 1) / 5) * 100}%` }}
              />
              {stepHeaders.map((step, idx) => {
                const StepIcon = step.icon;
                const stepNumber = idx + 1;
                const active = registrationStep === idx + 1;
                const completed = registrationStep > idx + 1;
                const canOpenStep = stepNumber <= registrationStep;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!canOpenStep}
                    onClick={() => goToRegistrationStep(stepNumber)}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition duration-200 text-[10px] font-bold ${
                      active
                        ? "bg-emerald-400 text-slate-950 ring-4 ring-emerald-300/30 scale-110"
                        : completed
                        ? "bg-[#0B5D3B] text-white"
                        : "bg-black/40 border border-emerald-500/30 text-emerald-300/50"
                    }`}
                  >
                    {completed ? <CheckCircle2 size={12} /> : <StepIcon size={12} />}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-950/80 border border-rose-500/50 p-3 text-xs font-semibold text-rose-200">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="max-h-[320px] overflow-y-auto pr-1">
                {registrationStep === 1 && renderStep1Fields()}
                {registrationStep === 2 && renderStep2Fields()}
                {registrationStep === 3 && renderStep3Fields()}
                {registrationStep === 4 && renderStep4Fields()}
                {registrationStep === 5 && renderStep5Fields()}
                {registrationStep === 6 && renderStep6Fields()}
              </div>

              <div className="flex gap-3 pt-3 border-t border-emerald-500/20">
                {registrationStep > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex h-11 items-center justify-center gap-1.5 px-4 rounded-xl border border-white/20 text-white/80 font-bold hover:bg-white/10 text-xs transition cursor-pointer"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || (registrationStep === 6 && (!registrationProof || !agreeTerms))}
                  title={
                    registrationStep === 6 && !registrationProof
                      ? "Kailangang mag-upload ng Valid ID o Proof of Residency bago mag-submit"
                      : registrationStep === 6 && !agreeTerms
                      ? "Kailangang sumang-ayon sa Terms of Service bago mag-submit"
                      : undefined
                  }
                  className={`flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white shadow-md transition duration-200 ${
                    registrationStep === 6 && (!registrationProof || !agreeTerms)
                      ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300/50 cursor-not-allowed opacity-60"
                      : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-lg cursor-pointer disabled:opacity-50"
                  }`}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : registrationStep === 6 ? (
                    <FileCheck2 size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  {loading
                    ? "Registering..."
                    : registrationStep === 6
                    ? "Submit Application"
                    : "Continue"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── RESIDENT PASSWORD RECOVERY: STEP 1 - PHONE INPUT ─── */}
        {(modalStep === "resident_forgot_phone" ||
          modalStep === "admin_forgot_password" ||
          modalStep === "forgot_password_verified") && (
          <div className="w-full space-y-4 text-left">
            <button
              onClick={() =>
                setModalStep(accessMode === "Admin" ? "admin_login" : "resident_login")
              }
              className="flex items-center gap-1 text-xs font-bold text-emerald-300 hover:text-white transition mb-1 cursor-pointer"
            >
              <ChevronLeft size={16} /> Back to Sign In
            </button>

            <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-900/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/40">
                <Phone size={20} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">Password Recovery</h4>
                <p className="text-[11px] text-emerald-200/80 font-medium">
                  Enter mobile number
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 p-3.5 text-xs font-semibold text-rose-200">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResidentForgotSendOTP} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider block text-left">
                  Registered Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" size={16} />
                  <input
                    type="tel"
                    maxLength={11}
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="Enter mobile number"
                    className="w-full h-12 rounded-xl border border-emerald-400/30 bg-black/40 pl-11 pr-4 text-xs text-white placeholder-emerald-200/50 outline-none focus:border-emerald-400 focus:bg-black/60 transition font-medium"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-extrabold text-white shadow-md transition duration-200 disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                {loading ? "Sending verification code..." : "Send Verification Code"}
              </button>
            </form>
          </div>
        )}

        {/* ─── RESIDENT PASSWORD RECOVERY: STEP 2 - OTP VERIFY ─── */}
        {modalStep === "resident_otp_verify" && (
          <div className="w-full space-y-4 text-left">
            <button
              onClick={() => setModalStep("resident_forgot_phone")}
              className="flex items-center gap-1 text-xs font-bold text-emerald-300 hover:text-white transition mb-1 cursor-pointer"
            >
              <ChevronLeft size={16} /> Back to Mobile Number
            </button>

            <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-900/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/40">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">Enter Verification Code</h4>
                <p className="text-[11px] text-emerald-200/80 font-medium">
                  Provide 6-digit SMS code sent to your number
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 p-3.5 text-xs font-semibold text-rose-200">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResidentForgotVerifyOTP} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider block text-left">
                  6-Digit SMS Code *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" size={16} />
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOTP}
                    onChange={(e) => setForgotOTP(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit code"
                    className="w-full h-12 text-center tracking-[0.5em] rounded-xl border border-emerald-400/30 bg-black/40 pl-11 pr-4 text-sm text-white outline-none focus:border-emerald-400 focus:bg-black/60 transition font-bold"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-emerald-200/70 font-medium">
                  {otpCountdown > 0 ? `Resend code in ${otpCountdown}s` : "Didn't receive code?"}
                </span>
                <button
                  type="button"
                  disabled={!canResendOTP || loading}
                  onClick={handleResidentForgotSendOTP}
                  className="font-bold text-emerald-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Resend Code
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || forgotOTP.length !== 6}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-extrabold text-white shadow-md transition duration-200 disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {loading ? "Verifying code..." : "Verify Code"}
              </button>
            </form>
          </div>
        )}

        {/* ─── RESIDENT PASSWORD RECOVERY: STEP 3 - SET NEW PASSWORD ─── */}
        {modalStep === "resident_forgot_newpass" && (
          <div className="w-full space-y-4 text-left">
            <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-900/60 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/40">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">Set New Password</h4>
                <p className="text-[11px] text-emerald-200/80 font-medium">
                  Create and confirm your new account password
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 p-3.5 text-xs font-semibold text-rose-200">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResidentForgotResetPassword} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider block text-left">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" size={16} />
                  <input
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full h-12 rounded-xl border border-emerald-400/30 bg-black/40 pl-11 pr-4 text-xs text-white placeholder-emerald-200/50 outline-none focus:border-emerald-400 focus:bg-black/60 transition font-medium"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider block text-left">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-300" size={16} />
                  <input
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full h-12 rounded-xl border border-emerald-400/30 bg-black/40 pl-11 pr-4 text-xs text-white placeholder-emerald-200/50 outline-none focus:border-emerald-400 focus:bg-black/60 transition font-medium"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-extrabold text-white shadow-md transition duration-200 disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
                {loading ? "Updating password..." : "Update Password"}
              </button>
            </form>
          </div>
        )}

        {/* Modal Footer Text */}
        <div className="w-full text-center text-xs text-white/90 font-medium mt-6 pt-4 border-t border-white/20 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>By signing in, you agree to our</span>
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="font-extrabold text-[#FFB800] hover:text-white underline underline-offset-2 decoration-[#FFB800]/80 cursor-pointer transition inline"
          >
            Terms and Conditions
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className="font-extrabold text-emerald-300 hover:text-white underline underline-offset-2 decoration-emerald-300/80 cursor-pointer transition inline"
          >
            About Us
          </button>
        </div>

      </div>

      {/* Terms and Conditions Modal */}
      <FloatingModal
        open={showTermsModal}
        title="Terms of Service & Privacy Policy"
        eyebrow="Official Barangay Agreement"
        description="Barangay Upper Mingading • Republic of the Philippines"
        maxWidth="max-w-lg"
        onClose={() => setShowTermsModal(false)}
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <span className="text-[11px] font-semibold text-slate-500">
              Republic Act No. 10173 (Data Privacy Act of 2012)
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreeTerms(true);
                  setShowTermsModal(false);
                }}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#0B5D3B] via-[#0D7349] to-[#08452B] hover:brightness-110 text-white px-5 py-2 text-xs font-black transition shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check size={14} className="text-emerald-300" />
                <span>I Accept & Agree</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs text-slate-700 py-1 font-medium">
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 text-emerald-950 space-y-1">
            <p className="font-extrabold text-xs text-emerald-900 leading-snug">
              Welcome to KaagapAI — Official Administrative & Resident Portal of Barangay Upper Mingading.
            </p>
            <p className="text-[11.5px] text-emerald-800/90 leading-relaxed">
              By accessing, registering, or signing into this portal, you agree to comply with the terms and privacy regulations set forth by the Sangguniang Barangay.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-emerald-300 transition">
            <h4 className="font-black text-xs uppercase tracking-wider text-[#0B5D3B] flex items-center gap-1.5">
              <span>🏛️ 1. Eligibility & Verified Residency</span>
            </h4>
            <p className="text-[11.5px] leading-relaxed text-slate-600">
              Access is strictly authorized for verified residents, household heads, and officials of Barangay Upper Mingading.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-emerald-300 transition">
            <h4 className="font-black text-xs uppercase tracking-wider text-[#0B5D3B] flex items-center gap-1.5">
              <span>🔐 2. Account Confidentiality & Security</span>
            </h4>
            <p className="text-[11.5px] leading-relaxed text-slate-600">
              You are solely responsible for maintaining the confidentiality of your username and password.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-2xs space-y-1.5 hover:border-emerald-300 transition">
            <h4 className="font-black text-xs uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <span>🛡️ 3. Privacy Policy & Data Privacy Act (R.A. 10173)</span>
            </h4>
            <p className="text-[11.5px] leading-relaxed text-slate-700">
              In strict compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, all personal data is encrypted and processed exclusively for official barangay registry and clearance generation.
            </p>
          </div>
        </div>
      </FloatingModal>

      {/* About KaagapAI Modal */}
      {renderAboutModal()}

    </div>
  );
};

export default Login;
