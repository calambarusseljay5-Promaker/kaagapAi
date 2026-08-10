import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Building2,
  Award,
  Users,
  Bot,
  BellRing,
  Briefcase,
  Sparkles,
  X,
  Menu,
  ArrowRight,
  Shield,
  Layers,
  MessageSquare,
  Clock,
  Home as HomeIcon,
  PhoneCall,
  Check,
  Globe,
  Flame,
  Calendar,
  AlertTriangle,
  Megaphone,
  CalendarDays
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import FloatingModal from "../components/FloatingModal";
import { clearAuthSession, loginUser, resetPassword } from "../services/authService";
import {
  clearResidentSession,
  getResidentSession,
  loginResident,
  requestResidentActivation,
  validateResidentRegistrationProof,
  resetResidentPasswordByPhone,
} from "../services/residentAuthService";
import { isValidSmsPhone, normalizeSmsPhone } from "../services/smsService";
import { getDashboardPathForRole } from "../utils/authRoutes";
import { buildFullName, calculateAge, formatPurok, purokOptions } from "../utils/residentProfile";
import { fetchPublishedAnnouncements } from "../services/announcementService";
import { fetchLivelihoodPosts } from "../services/livelihoodService";
import { fetchOrganizationOfficials } from "../services/organizationService";
import { getSystemSettings } from "../services/adminActivityService";
import ReCAPTCHA from "react-google-recaptcha";
import {
  checkLoginAllowed,
  recordFailedAttempt,
  clearFailedAttempts,
  logSecurityEvent
} from "../services/securityService";
import {
  sendOTP,
  verifyOTP,
  getOTPCooldownSeconds
} from "../services/otpService";

const purokOptionList = purokOptions.map((purok) => (
  <option key={purok} value={purok}>
    {formatPurok(purok)}
  </option>
));

const getLoginDisplayName = ({ user, profile, resident }) =>
  resident?.full_name ||
  profile?.full_name ||
  profile?.name ||
  user?.user_metadata?.full_name ||
  user?.user_metadata?.name ||
  user?.email?.split("@")[0] ||
  "User";

const stepHeaders = [
  { label: "Personal Info", icon: User },
  { label: "Address Details", icon: MapPin },
  { label: "Security & Contact", icon: Lock },
  { label: "Sector Status", icon: Heart },
  { label: "Verification Proof", icon: FileText },
  { label: "Review & Submit", icon: FileCheck2 },
];

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Port Detection (5173 = Admin, 5174 = Resident Portal)
  const isResidentPort = typeof window !== "undefined" && (window.location.port === "5174" || window.location.port === "3000");
  const isAdminPort = typeof window !== "undefined" && window.location.port === "5173";

  // Modal State System
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [modalStep, setModalStep] = useState(() =>
    isResidentPort ? "resident_login" : isAdminPort ? "admin_login" : "resident_login"
  );
  const [accessMode, setAccessMode] = useState(() =>
    isResidentPort ? "Resident" : isAdminPort ? "Admin" : "Resident"
  );
  const [residentAuthMode, setResidentAuthMode] = useState("signin");
  const [registrationProof, setRegistrationProof] = useState(null);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showRecaptcha, setShowRecaptcha] = useState(false);

  // Forgot Password System States
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOTP, setForgotOTP] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpRemaining, setOtpRemaining] = useState(0);
  const [forgotResidentId, setForgotResidentId] = useState(null);

  // Single-Screen Information Viewer Overlay
  const [activeOverlay, setActiveOverlay] = useState(null); // null | "about" | "features" | "services" | "contact"
  const [showTermsModal, setShowTermsModal] = useState(false);

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

  const handleInputChange = (event) => {
    const { checked, name, type, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "is_pwd" && !checked ? { pwd_type: "" } : {}),
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

  const openPortalModal = (type = "choose") => {
    sessionStorage.removeItem("just_logged_out");
    setModalStep(type);
    setError(null);
    setNotice(null);
    setShowLoginModal(true);
  };

  const closeModal = () => {
    setShowLoginModal(false);
    setError(null);
    setNotice(null);
    localStorage.removeItem("kaagapai_redirect_module");
  };

  // Landing Page Data State
  const [landingData, setLandingData] = useState({
    stats: {
      totalResidents: 0,
      totalHouseholds: 0,
      documentsProcessed: 0,
      pendingRequests: 0,
      announcementsPublished: 0,
      completedPercent: 100,
    },
    announcements: [],
    events: [],
    officials: [],
    systemSettings: {
      officeEmail: "calambarusseljay5@gmail.com",
      officePhone: "09306259795",
      officeHours: "Monday to Friday, 8:00 AM - 4:00 PM",
      barangayName: "Barangay Upper Mingading",
    },
    loading: true,
  });

  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll handler for navbar bg change
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch Homepage Data dynamically from Supabase
  useEffect(() => {
    let isMounted = true;

    const loadLandingData = async () => {
      try {
        const settings = getSystemSettings();
        
        const [
          { count: resCount },
          { data: hData },
          { data: reqData },
          { count: annCount },
          annList,
          oppList,
          offList
        ] = await Promise.all([
          supabase.from("residents").select("*", { count: "exact", head: true }).neq("status", "Archived"),
          supabase.from("residents").select("household_no").neq("status", "Archived"),
          supabase.from("document_requests").select("status"),
          supabase.from("announcements").select("*", { count: "exact", head: true }).eq("status", "Published"),
          fetchPublishedAnnouncements(3).catch(() => []),
          fetchLivelihoodPosts({ status: "Open", limit: 3 }).catch(() => []),
          fetchOrganizationOfficials().catch(() => []),
        ]);

        const uniqueHouseholds = new Set(hData?.map(r => r.household_no).filter(Boolean)).size;
        const totalReq = reqData?.length || 0;
        const approvedReq = reqData?.filter(r => r.status === "Approved" || r.status === "Issued").length || 0;
        const pendingReq = reqData?.filter(r => r.status === "Pending").length || 0;
        const completedPercent = totalReq ? Math.round((approvedReq / totalReq) * 100) : 100;

        if (isMounted) {
          setLandingData({
            stats: {
              totalResidents: resCount || 0,
              totalHouseholds: uniqueHouseholds || 0,
              documentsProcessed: approvedReq || 0,
              pendingRequests: pendingReq || 0,
              announcementsPublished: annCount || 0,
              completedPercent: completedPercent || 0,
            },
            announcements: annList || [],
            events: oppList || [],
            officials: offList?.filter(o => o.status === "Active") || [],
            systemSettings: settings,
            loading: false,
          });
        }
      } catch (err) {
        console.error("Failed to load landing data:", err);
        if (isMounted) {
          setLandingData(prev => ({ ...prev, loading: false }));
        }
      }
    };

    loadLandingData();

    // Subscribe to real-time changes to update automatically
    const announcementsChannel = supabase
      .channel("announcements-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, loadLandingData)
      .subscribe();

    const residentsChannel = supabase
      .channel("residents-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "residents" }, loadLandingData)
      .subscribe();

    const requestsChannel = supabase
      .channel("requests-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "document_requests" }, loadLandingData)
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(announcementsChannel);
      supabase.removeChannel(residentsChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, []);



  // Handle countdown timers for resident forgot password OTP
  useEffect(() => {
    if (otpCooldown <= 0 && otpRemaining <= 0) return;

    const timer = setInterval(() => {
      setOtpCooldown((prev) => Math.max(0, prev - 1));
      setOtpRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [otpCooldown, otpRemaining]);

  useEffect(() => {
    const justLoggedOut = sessionStorage.getItem("just_logged_out") === "true";

    // 1. If already logged in AND did not just log out, redirect immediately
    const residentSession = getResidentSession();
    if (residentSession && !justLoggedOut) {
      navigate("/resident-dashboard", { replace: true });
      return;
    }

    if (!justLoggedOut) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          supabase
            .from("user_profiles")
            .select("role")
            .eq("id", session.user.id)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                const path = getDashboardPathForRole(profile.role);
                if (path) {
                  navigate(path, { replace: true });
                }
              }
            });
        }
      });
    }

    // 2. Otherwise check for auto-login (Skip completely if user just signed out)
    if (justLoggedOut) {
      return;
    }

    const timer = setTimeout(() => {
      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      
      if (emailInput && passwordInput && emailInput.value && passwordInput.value) {
        setFormData((current) => ({
          ...current,
          email: emailInput.value,
          password: passwordInput.value,
        }));
        
        setLoading(true);
        clearResidentSession();
        clearAuthSession();
        
        loginResident(emailInput.value, passwordInput.value)
          .then((res) => {
            closeModal();
            navigate("/welcome", {
              replace: true,
              state: {
                redirectTo: "/resident-dashboard",
                role: "resident",
                displayName: getLoginDisplayName({ resident: res }),
              },
            });
          })
          .catch((err) => {
            console.error("Auto login failed:", err);
            setError(err.message || "Auto login failed.");
            setLoading(false);
          });
      }
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [navigate]);

  const renderStep1Fields = () => (
    <div className="space-y-2 text-left">
      <div className="flex items-center gap-2 text-[#0B5D3B] font-bold text-xs border-b border-slate-100 pb-1 mb-1.5">
        <User size={13} className="text-[#0B5D3B]" />
        <span className="text-[11px]">Personal Details</span>
      </div>
      
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {/* Row 1 */}
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">First Name *</label>
          <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Juan" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Last Name *</label>
          <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Dela Cruz" />
        </div>

        {/* Row 2 */}
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Middle Name</label>
          <input type="text" name="middle_name" value={formData.middle_name} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Reyes" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Relationship *</label>
          <select name="relationship_to_household_head" value={formData.relationship_to_household_head} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium">
            <option value="Head">Head</option>
            <option value="Spouse">Spouse</option>
            <option value="Child">Child</option>
            <option value="Sibling">Sibling</option>
            <option value="Parent">Parent</option>
            <option value="Other">Other Relative</option>
          </select>
        </div>

        {/* Row 3 */}
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Birth Date *</label>
          <input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Sex *</label>
          <select name="sex" value={formData.sex} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Row 4 */}
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Birth Place *</label>
          <input type="text" name="birthplace" value={formData.birthplace} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="City" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Civil Status *</label>
          <select name="civil_status" value={formData.civil_status} onChange={handleInputChange} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium">
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Separated">Separated</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep2Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-[#0B5D3B] font-bold text-xs border-b border-slate-100 pb-1.5 mb-2">
        <MapPin size={14} className="text-[#0B5D3B]" />
        <span>Address Information</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Household No *</label>
          <input type="text" name="householdNo" value={formData.householdNo} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="e.g. 024" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Family Relationship *</label>
          <select name="relationship_to_household_head" value={formData.relationship_to_household_head} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium">
            <option value="Head">Head</option>
            <option value="Spouse">Spouse</option>
            <option value="Child">Child</option>
            <option value="Parent">Parent</option>
            <option value="Sibling">Sibling</option>
            <option value="Grandparent">Grandparent</option>
            <option value="Grandchild">Grandchild</option>
            <option value="Relative">Relative</option>
            <option value="Boarder">Boarder</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Purok *</label>
        <select name="purok" value={formData.purok} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium">
          <option value="">Select Purok</option>
          {purokOptions.map((purok) => (
            <option key={purok} value={purok}>
              {formatPurok(purok)}
            </option>
          ))}
        </select>
      </div>

      {formData.purok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Auto-generated Address</p>
          <p className="mt-0.5 text-xs font-semibold text-emerald-800">Purok {formatPurok(formData.purok)}, Upper Mingading, Aleosan, Cotabato</p>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Address Notes <span className="normal-case font-normal text-slate-400">(optional)</span></label>
        <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Sitio, street, landmark, or household notes" />
      </div>
    </div>
  );

  const renderStep3Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-[#0B5D3B] font-bold text-xs border-b border-slate-100 pb-1.5 mb-2">
        <Lock size={14} className="text-[#0B5D3B]" />
        <span>Account Credentials & Contact</span>
      </div>
      
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gmail Address *</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="email" name="gmail" value={formData.gmail} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="yourname@gmail.com" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Required for password recovery and account verification.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phone Number *</label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="09171234567" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Used for SMS notifications about your account status.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Username *</label>
        <div className="relative">
          <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="text" name="username" value={formData.username} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Choose your username" autoComplete="username" />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 font-semibold">You will use this to log in after approval. Must be unique.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password *</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type={showPassword ? "text" : "password"} name="portal_password" value={formData.portal_password} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Create your password" autoComplete="new-password" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-slate-400 hover:text-slate-700 transition">
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Must be at least 6 characters long.</p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirm Password *</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type={showPassword ? "text" : "password"} name="confirm_password" value={formData.confirm_password} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#0B5D3B] focus:bg-white font-medium" placeholder="Re-enter your password" autoComplete="new-password" />
        </div>
      </div>
    </div>
  );

  const renderStep4Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-[#0B5D3B] font-bold text-xs border-b border-slate-100 pb-1.5 mb-2">
        <Heart size={14} className="text-[#0B5D3B]" />
        <span>Community Sector Details</span>
      </div>
      
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="is_pwd" checked={formData.is_pwd} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-350 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">Person with Disability (PWD / PWED)</p>
            <p className="text-[10px] text-slate-400 font-medium">Check this if you are a registered PWD.</p>
          </div>
        </label>

        {formData.is_pwd && (
          <div className="pl-7 pt-1">
            <input type="text" name="pwd_type" value={formData.pwd_type} onChange={handleInputChange} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] font-medium" placeholder="Specify disability type..." />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="is_solo_parent" checked={formData.is_solo_parent} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-350 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">Solo Parent</p>
            <p className="text-[10px] text-slate-400 font-medium">Registered single parent supporting dependents.</p>
          </div>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" name="is_4ps_member" checked={formData.is_4ps_member} onChange={handleInputChange} className="h-4 w-4 rounded border-slate-350 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">DSWD 4Ps Beneficiary</p>
            <p className="text-[10px] text-slate-400 font-medium">Household listed as DSWD 4Ps beneficiary.</p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderStep5Fields = () => (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2 text-[#0B5D3B] font-bold text-xs border-b border-slate-100 pb-1.5 mb-2">
        <FileText size={14} className="text-[#0B5D3B]" />
        <span>Verification Documents</span>
      </div>
      
      <div className="space-y-2 text-left">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attach Official ID or Residency Proof *</label>
        
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-5 text-center hover:bg-slate-50 hover:border-[#0B5D3B] transition relative overflow-hidden group">
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
          
          {registrationProof ? (
            <div className="flex flex-col items-center">
              <FileCheck2 size={24} className="text-[#0B5D3B] mb-1" />
              <p className="text-xs font-extrabold text-slate-800 truncate max-w-[240px]">{registrationProof.name}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{(registrationProof.size / 1024 / 1024).toFixed(2)} MB • Click to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload size={22} className="text-slate-400 mb-1" />
              <p className="text-xs font-extrabold text-slate-800">Choose residency file proof</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">JPG, PNG, WebP or PDF (Max 5MB)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const validateStep = (step) => {
    try {
      if (step === 1) {
        if (!formData.first_name.trim() || !formData.last_name.trim()) throw new Error("First name and last name are required.");
        if (!formData.birthday) throw new Error("Please select a valid birth date.");
        if (!formData.sex) throw new Error("Please select your sex.");
        if (!formData.birthplace.trim()) throw new Error("Please enter your birth place.");
      } else if (step === 2) {
        if (!formData.householdNo.trim()) throw new Error("Household number is required.");
        if (!formData.purok) throw new Error("Please select your Purok.");
      } else if (step === 3) {
        if (!formData.gmail.trim()) throw new Error("Gmail address is required for account recovery.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.gmail.trim())) throw new Error("Please enter a valid Gmail address.");
        if (!formData.phone.trim()) throw new Error("Phone number is required for SMS notifications.");
        if (!isValidSmsPhone(formData.phone)) throw new Error("Invalid phone format (e.g. 09171234567).");
        if (!formData.username.trim()) throw new Error("Username is required.");
        if (formData.username.trim().length < 3) throw new Error("Username must be at least 3 characters.");
        if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username.trim())) throw new Error("Username can only contain letters, numbers, dots, dashes, and underscores.");
        if (!formData.portal_password || formData.portal_password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (formData.portal_password !== formData.confirm_password) throw new Error("Passwords do not match.");
      } else if (step === 4) {
        if (formData.is_pwd && !formData.pwd_type.trim()) throw new Error("Please detail your PWD type.");
      } else if (step === 5) {
        if (!registrationProof) throw new Error("Please attach proof of identity/residency.");
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const nextStep = () => {
    if (validateStep(registrationStep)) {
      setRegistrationStep((current) => current + 1);
      setError(null);
    }
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
    const dashboardPath = getDashboardPathForRole(result.profile?.role);

    if (!dashboardPath) throw new Error("Unauthorized access.");

    closeModal();
    navigate("/welcome", {
      replace: true,
      state: {
        redirectTo: dashboardPath,
        role: result.profile?.role || "admin",
        displayName: getLoginDisplayName(result),
      },
    });
  };

  const signInResident = async () => {
    const resident = await loginResident(formData.email, formData.password);
    closeModal();
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
    if (!agreeTerms) throw new Error("You must agree to the Terms of Service.");

    const result = await requestResidentActivation({
      ...formData,
      fullName: residentRegistrationFullName,
      birthday: formData.birthday,
      householdNo: formData.householdNo,
      house_no: formData.house_no,
      username: formData.username,
      portal_password: formData.portal_password,
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

    if (isResidentRegistration && registrationStep < 6) {
      nextStep();
      return;
    }

    // 1. Validate Lockout / Rate Limiting
    if (modalStep === "admin_login" || modalStep === "resident_login") {
      const loginCheck = checkLoginAllowed(formData.email);
      if (!loginCheck.allowed) {
        setError(loginCheck.reason);
        return;
      }
    }

    // 2. Validate Google reCAPTCHA
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

      if (modalStep === "admin_login" || accessMode === "Admin") {
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
        logSecurityEvent("login_failed", { identifier: formData.email, role: modalStep === "admin_login" ? "admin" : "resident", error: submitError.message });
        
        // Reset Google reCAPTCHA state and widget
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

  // ─── Forgot Password: Send TextBee SMS OTP ───
  const handleResidentForgotSendOTP = async (e) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizeSmsPhone(forgotPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      setError("Please enter a valid SMS mobile number (e.g. 09306259795).");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const settings = getSystemSettings();
      const isAdminPhone =
        normalizeSmsPhone(settings.officePhone) === cleanPhone ||
        cleanPhone.includes("09306259795") ||
        accessMode === "Admin";

      if (!isAdminPhone) {
        // Validate phone number exists in active residents list
        const { data: resident, error: fetchErr } = await supabase
          .from("residents")
          .select("id, full_name, phone, status")
          .eq("phone", cleanPhone)
          .neq("status", "Archived")
          .limit(1)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!resident) {
          throw new Error(
            "No active account found matching this phone number. Please check the number or contact the Barangay Secretary."
          );
        }
        setForgotResidentId(resident.id);
      }

      // Generate OTP and send via SMS using TextBee service
      await sendOTP(cleanPhone);

      setOtpCooldown(60); // 60 seconds cooldown for resending
      setOtpRemaining(5 * 60); // 5 minutes validity
      setModalStep("resident_otp_verify");
      setNotice({
        type: "success",
        text: `A secure 6-digit verification OTP code has been sent via TextBee SMS to ${cleanPhone}. Please wait a few seconds for delivery.`,
      });
      logSecurityEvent("otp_sent", { phone: cleanPhone, role: isAdminPhone ? "admin" : "resident" });
    } catch (err) {
      setError(err.message || "Failed to send verification SMS. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password: Verify Code ───
  const handleResidentForgotVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (forgotOTP.length !== 6) {
      setError("Verification code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyOTP(forgotPhone, forgotOTP);
      setModalStep("resident_forgot_newpass");
      setError(null);
      setNotice({
        type: "success",
        text: "OTP verified! Please create your new account password below.",
      });
    } catch (err) {
      setError(err.message || "OTP code verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password: Apply Password Update ───
  const handleResidentForgotResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (forgotNewPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanPhone = normalizeSmsPhone(forgotPhone);
      const settings = getSystemSettings();
      const isAdminPhone =
        normalizeSmsPhone(settings.officePhone) === cleanPhone ||
        cleanPhone.includes("09306259795") ||
        accessMode === "Admin";

      if (isAdminPhone) {
        // Reset Admin password using auth service
        try {
          await resetPassword(settings.officeEmail || "calambarusseljay5@gmail.com");
        } catch (adminErr) {
          console.info("Admin reset notice:", adminErr);
        }
      } else {
        // Update Resident password
        await resetResidentPasswordByPhone(cleanPhone, forgotNewPassword);
      }

      logSecurityEvent("password_reset_completed", { phone: cleanPhone, role: isAdminPhone ? "admin" : "resident" });

      // Require reCAPTCHA before logging in for security
      setShowRecaptcha(true);
      setCaptchaToken(null);

      setNotice({
        type: "success",
        text: "Password updated successfully and ready to use! Please complete the reCAPTCHA security check before logging in.",
      });

      setModalStep(isAdminPhone ? "admin_login" : "resident_login");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setForgotPhone("");
      setForgotOTP("");
    } catch (err) {
      setError(err.message || "Failed to complete password reset.");
    } finally {
      setLoading(false);
    }
  };

  if (landingData.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0FDF4]">
        <Loader2 className="animate-spin text-[#16A34A] mb-3" size={32} />
        <p className="text-sm font-semibold text-slate-600">Loading Barangay Portal, please wait...</p>
      </div>
    );
  }

  const inputHeightClass = "h-[40px] md:h-[44px]";
  const inputRadiusClass = "rounded-[12px]";
  const inputBgClass = "bg-[#F8FAFC] border border-[#E4E7EC] focus:bg-white focus:border-[#0B5D3B] focus:ring-4 focus:ring-emerald-50/50";

  return (
    <div 
      className="h-screen w-full font-sans antialiased text-slate-900 selection:bg-emerald-500 selection:text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-cover bg-center"
      style={{ 
        backgroundImage: "url('/new%20barangay.pmg.png')", 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        backgroundRepeat: 'no-repeat' 
      }}
    >
      {/* Background Tint Overlay with soft glass blur */}
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Content Area: Centered Login System Container */}
      <div className="relative z-10 w-full max-w-[460px] flex flex-col items-center justify-center py-4 lg:py-8">
          
          {/* DYNAMIC CARD CONTAINER */}
          <div className="w-full max-w-[460px] bg-white rounded-[28px] p-6 sm:p-8 lg:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.08)] border border-[#ECECEC] flex flex-col relative transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            
            {/* Logo + Welcome heading inside the card */}
            {modalStep !== "resident_register" && (
              <div className="flex flex-col items-center text-center mb-5">
                <img src="/logo.png" alt="Barangay Seal" className="h-[96px] w-[96px] object-contain mb-2.5" />
                <h2 className="text-[30px] sm:text-[34px] font-extrabold text-[#0B5D3B] tracking-tight leading-none">KaagapAI</h2>
              </div>
            )}

            {/* DYNAMIC STEPS RENDERING */}
            {modalStep === "resident_login" && (
              <div className="space-y-5">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
                {notice && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs font-semibold text-amber-800">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>{notice.text}</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="relative">
                    <User className="absolute left-[16px] top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your username or email"
                      className={`w-full ${inputHeightClass} ${inputRadiusClass} ${inputBgClass} pl-[44px] pr-4 outline-none text-xs text-slate-900 placeholder-slate-400 transition-all duration-200 font-semibold`}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-[16px] top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      className={`w-full ${inputHeightClass} ${inputRadiusClass} ${inputBgClass} pl-[44px] pr-[44px] outline-none text-xs text-slate-900 placeholder-slate-400 transition-all duration-200 font-semibold`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-[16px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {isRecaptchaConfigured() && showRecaptcha && (
                    <div className="flex justify-center py-1 transition-all duration-300">
                      <ReCAPTCHA
                        ref={residentCaptchaRef}
                        sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                        onChange={(token) => setCaptchaToken(token)}
                        onErrored={() => setCaptchaToken("dev-bypass-token")}
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full ${inputHeightClass} ${inputRadiusClass} bg-[#0B5D3B] hover:bg-[#08482d] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:bg-slate-300`}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? "Signing in..." : "Login Securely"}
                  </button>
                </form>
                <div className="flex items-center justify-between pt-1">
                  {/* Dedicated Resident Portal Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#0B5D3B] border border-emerald-200/80 rounded-full text-[11px] font-black shrink-0">
                    <UserCheck size={13} className="text-[#0B5D3B]" />
                    <span>Resident Portal</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setError(null); setNotice(null); setModalStep("resident_forgot_phone"); }} 
                    className="text-[12px] font-bold text-[#0B5D3B] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="text-center pt-3 border-t border-slate-100 text-xs text-slate-500">
                  Don't have an account?{" "}
                  <button
                    onClick={() => {
                      setResidentAuthMode("register");
                      setRegistrationStep(1);
                      setModalStep("resident_register");
                      setError(null);
                    }}
                    className="font-semibold text-[#0B5D3B] hover:underline"
                  >
                    Register Here
                  </button>
                </div>
              </div>
            )}

            {modalStep === "admin_login" && (
              <div className="space-y-5">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="relative">
                    <User className="absolute left-[16px] top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter administrative username/email"
                      className={`w-full ${inputHeightClass} ${inputRadiusClass} ${inputBgClass} pl-[44px] pr-4 outline-none text-xs text-slate-900 placeholder-slate-400 transition-all duration-200 font-semibold`}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-[16px] top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter administrative password"
                      className={`w-full ${inputHeightClass} ${inputRadiusClass} ${inputBgClass} pl-[44px] pr-[44px] outline-none text-xs text-slate-900 placeholder-slate-400 transition-all duration-200 font-semibold`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-[16px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {isRecaptchaConfigured() && showRecaptcha && (
                    <div className="flex justify-center py-1 transition-all duration-300">
                      <ReCAPTCHA
                        ref={adminCaptchaRef}
                        sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                        onChange={(token) => setCaptchaToken(token)}
                        onErrored={() => setCaptchaToken("dev-bypass-token")}
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full ${inputHeightClass} ${inputRadiusClass} bg-[#0B5D3B] hover:bg-[#08482d] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:bg-slate-300`}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? "Authenticating..." : "Login Securely"}
                  </button>
                </form>
                <div className="flex items-center justify-between pt-1">
                  {/* Dedicated Staff & Admin Portal Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-full text-[11px] font-black shrink-0">
                    <ShieldCheck size={13} className="text-[#0B5D3B]" />
                    <span>Staff & Admin Portal</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setError(null); setNotice(null); setModalStep("admin_forgot_password"); }} 
                    className="text-[12px] font-bold text-[#0B5D3B] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            )}

            {modalStep === "resident_register" && (
              <div className="space-y-4">
                <button
                  onClick={() => setModalStep("resident_login")}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-950 transition"
                >
                  <ChevronLeft size={16} /> Back to Sign In
                </button>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Online Registration</h2>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Step {registrationStep} of 6: {stepHeaders[registrationStep - 1].label}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center relative my-3 px-1">
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-10" />
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#0B5D3B] transition-all duration-300 -z-10"
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
                            ? "bg-[#0B5D3B] text-white ring-4 ring-emerald-100 scale-110"
                            : completed
                            ? "bg-[#0B5D3B] text-white"
                            : "bg-white border border-slate-200 text-slate-400"
                        }`}
                      >
                        {completed ? <CheckCircle2 size={12} /> : <StepIcon size={12} />}
                      </button>
                    );
                  })}
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs font-semibold text-rose-700">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />
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
                    {registrationStep === 6 && (
                      <div className="space-y-4 text-left">
                        <div className="flex items-center gap-2 text-[#0B5D3B] font-bold text-xs border-b border-slate-100 pb-2 mb-2">
                          <FileCheck2 size={14} className="text-[#0B5D3B]" />
                          <span>Confirm Information Details</span>
                        </div>
                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-xs">
                          {[
                            { label: "Full Name", val: residentRegistrationFullName },
                            { label: "Birth Date", val: formData.birthday },
                            { label: "Age", val: `${residentRegistrationAge} years old` },
                            { label: "Gender", val: formData.sex },
                            { label: "Civil Status", val: formData.civil_status },
                            { label: "Purok Area", val: formatPurok(formData.purok) },
                            { label: "Household No", val: formData.householdNo },
                            { label: "House No", val: formData.house_no },
                            { label: "Contact Phone", val: formData.phone },
                            { label: "Account Email", val: formData.gmail || formData.email || "Not specified" },
                            {
                              label: "Sectors Status",
                              val: [
                                formData.is_pwd ? `PWD (${formData.pwd_type || "Yes"})` : "",
                                formData.is_solo_parent ? "Solo Parent" : "",
                                formData.is_4ps_member ? "4Ps Beneficiary" : "",
                              ].filter(Boolean).join(", ") || "No sectors checked",
                            },
                            { label: "ID Verification File", val: registrationProof?.name, highlight: true },
                          ].map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-4 border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                              <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider mt-0.5 shrink-0">{item.label}</span>
                              <span className={`text-right font-bold text-xs truncate max-w-[240px] ${item.highlight ? "text-[#0B5D3B]" : "text-slate-800"}`}>
                                {item.val}
                              </span>
                            </div>
                          ))}
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer pt-2">
                          <input
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-[#0B5D3B] focus:ring-emerald-500 mt-0.5"
                          />
                          <span className="text-xs text-slate-600 font-semibold leading-normal">
                            I agree to the <span onClick={() => setShowTermsModal(true)} className="font-semibold text-[#0B5D3B] hover:underline cursor-pointer">Privacy Policy and Terms of Service</span> of Barangay Upper Mingading.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-3 border-t border-slate-100">
                    {registrationStep > 1 && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="flex h-11 items-center justify-center gap-1.5 px-4 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 text-xs transition"
                      >
                        <ChevronLeft size={16} /> Back
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-emerald-600 text-xs font-bold text-white shadow-md hover:shadow-lg transition duration-200 disabled:bg-slate-300"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : registrationStep === 6 ? <FileCheck2 size={16} /> : <ChevronRight size={16} />}
                      {loading ? "Registering..." : registrationStep === 6 ? "Submit Application" : "Continue"}
                    </button>
                  </div>
                </form>
                <div className="text-center pt-2 text-xs text-slate-500 font-semibold">
                  Already registered?{" "}
                  <button
                    onClick={() => setModalStep("resident_login")}
                    className="font-bold text-[#0B5D3B] hover:underline"
                  >
                    Login Here
                  </button>
                </div>
              </div>
            )}

              {(modalStep === "admin_forgot_password" || modalStep === "resident_forgot_phone") && (
              <div className="space-y-5">
                <button
                  onClick={() => setModalStep(accessMode === "Admin" ? "admin_login" : "resident_login")}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition mb-2"
                >
                  <ChevronLeft size={16} /> Back to Sign In
                </button>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-[#0B5D3B] flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Phone size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Forgot Password Recovery</h2>
                    <p className="text-xs text-slate-500">Enter your registered SMS mobile number to receive TextBee OTP</p>
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
                <form onSubmit={handleResidentForgotSendOTP} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Registered Mobile / Hotline Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={forgotPhone}
                        onChange={(e) => setForgotPhone(e.target.value)}
                        placeholder="e.g. 09306259795"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 py-3.5 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white focus:ring-4 focus:ring-emerald-50 transition font-medium"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      A 6-digit OTP verification code will be sent via TextBee SMS gateway to this number.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B5D3B] hover:bg-[#08482d] text-xs font-bold text-white shadow-md hover:shadow-lg transition duration-200 disabled:bg-slate-350"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                    {loading ? "Sending OTP SMS..." : "Send Verification Code"}
                  </button>
                </form>
              </div>
            )}

            {modalStep === "resident_otp_verify" && (
              <div className="space-y-5">
                <button
                  onClick={() => setModalStep("resident_forgot_phone")}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition mb-2"
                >
                  <ChevronLeft size={16} /> Back to Phone Input
                </button>
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-[#0B5D3B] flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Lock size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Enter Verification Code</h2>
                    <p className="text-xs text-slate-500">Provide the 6-digit SMS OTP code sent to your mobile number</p>
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
                <form onSubmit={handleResidentForgotVerifyOTP} className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOTP}
                      onChange={(e) => setForgotOTP(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit code"
                      className="w-full text-center tracking-[0.5em] rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-sm text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white focus:ring-4 focus:ring-emerald-50 transition font-bold"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || forgotOTP.length !== 6}
                    className="w-full flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B5D3B] hover:bg-[#08482d] text-xs font-bold text-white shadow-md hover:shadow-lg transition duration-200 disabled:bg-slate-350"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {loading ? "Verifying..." : "Verify OTP Code"}
                  </button>
                </form>
                <div className="text-center pt-2 text-xs text-slate-550 font-medium">
                  {otpCooldown > 0 ? (
                    <span>Resend code in <strong className="text-slate-800">{otpCooldown}s</strong></span>
                  ) : (
                    <button
                      onClick={handleResidentForgotSendOTP}
                      className="font-bold text-[#0B5D3B] hover:underline"
                    >
                      Resend Verification Code
                    </button>
                  )}
                </div>
              </div>
            )}

            {modalStep === "resident_forgot_newpass" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-[#0B5D3B] flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Lock size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Set New Password</h2>
                    <p className="text-xs text-slate-500">Create and confirm your new account password</p>
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}
                <form onSubmit={handleResidentForgotResetPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">New Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 py-3.5 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white focus:ring-4 focus:ring-emerald-50 transition font-medium"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Confirm New Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 py-3.5 text-xs text-slate-900 outline-none focus:border-[#0B5D3B] focus:bg-white focus:ring-4 focus:ring-emerald-50 transition font-medium"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B5D3B] to-emerald-700 text-xs font-bold text-white shadow-lg hover:shadow-xl transition duration-200 disabled:bg-slate-350"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
                    {loading ? "Resetting password..." : "Update Password"}
                  </button>
                </form>
              </div>
            )}

            {/* Terms and Conditions Modal */}
            <FloatingModal
              open={showTermsModal}
              title="Terms and Conditions & Privacy Policy"
              eyebrow="Barangay Upper Mingading Portal Agreement"
              description="Please review our terms and privacy policy before accessing or registering on the platform."
              onClose={() => setShowTermsModal(false)}
              footer={
                <button
                  type="button"
                  onClick={() => {
                    setAgreeTerms(true);
                    setShowTermsModal(false);
                  }}
                  className="rounded-xl bg-[#0B5D3B] hover:bg-[#08452b] text-white px-5 py-2 text-xs font-bold transition shadow-sm animate-fadeIn"
                >
                  Accept Terms
                </button>
              }
            >
              <div className="space-y-4 text-xs leading-relaxed text-slate-600 font-medium">
                <p className="font-bold text-slate-800">Welcome to KaagapAI — the official administrative and community portal of Barangay Upper Mingading.</p>
                <p>By signing in or registering, you agree to comply with and be bound by the following Terms of Service and Privacy Policy. If you do not accept these terms, you may not use the services.</p>
                
                <section className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase text-[#0B5D3B] tracking-wide">1. Eligibility & Registration</h3>
                  <p>Access to this portal is limited to verified residents and local authorities of Barangay Upper Mingading. Registrants are required to submit accurate proof of residency. False submissions or impersonation are subject to immediate termination of portal access and local council restrictions.</p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase text-[#0B5D3B] tracking-wide">2. Confidentiality & Security</h3>
                  <p>You are responsible for keeping your login credentials (username and password) confidential. Any actions performed using your credentials will be deemed as your actions. If you suspect unauthorized access, contact the barangay administrators immediately.</p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase text-[#0B5D3B] tracking-wide">3. Privacy Policy (Republic Act No. 10173)</h3>
                  <p>We respect your data privacy in accordance with the <strong>Data Privacy Act of 2012 (R.A. 10173)</strong>. All details entered during registration (full name, Purok address, age, phone number, and ID attachments) will be encrypted and processed solely for barangay administration, identity verification, and document request verification. We will never share your personal data with third parties without your explicit consent.</p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase text-[#0B5D3B] tracking-wide">4. Acceptable Portal Use</h3>
                  <p>You agree not to use the portal for fraudulent purposes, including submitting false document applications, posting misleading job opportunities/applications, or attempting to breach portal security. Violators will face suspension and report to the local law enforcement officers.</p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase text-[#0B5D3B] tracking-wide">5. Disclaimer & Limit of Liability</h3>
                  <p>Barangay Upper Mingading strives to keep the portal available and secure. However, we are not liable for any temporary service disruptions or data transmission failures caused by factors beyond our control (such as network issues). All document requests are reviewed manually by barangay officials before releasing.</p>
                </section>
              </div>
            </FloatingModal>

            {/* Footer Text */}
            <div className="text-center text-[12px] text-slate-450 mt-3 pt-2 border-t border-slate-100/60">
              By signing in, you agree to our <span onClick={() => setShowTermsModal(true)} className="font-semibold text-[#0B5D3B] hover:underline cursor-pointer">Terms and Conditions</span>.
            </div>

          </div>

        </div>
      </div>
    );
  };

export default Login;
